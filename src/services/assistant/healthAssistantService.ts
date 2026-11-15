import type {
  DailyCheckIn,
  HealthCategory,
  HealthRecord,
} from '@/types';
import { calculatePersonalBaselineFromRecords } from '@/services/baseline';
import { evaluateSelfAssessmentFromRecords } from '@/services/assessment';
import { getHazardsForIndicator } from '@/services/hazards';
import { listDailyCheckIns } from '@/services/checkIn';
import { queryRecords } from '@/services/storage';
import { summarizeIndicatorRecords } from '@/services/analytics';
import { listIndicatorsByCategory } from '@/services/indicators';

export interface HealthAssistantEvidence {
  label: string;
  date: string;
}

export interface HealthAssistantAnswer {
  id: 'change' | 'history' | 'missing' | 'review';
  question: string;
  observation: string;
  evidence: HealthAssistantEvidence[];
  next_step: string;
  not_enough_data: boolean;
  educational_context?: string;
}

interface IndicatorGroup {
  category: HealthCategory;
  indicator: string;
  records: HealthRecord[];
}

function indicatorGroups(records: readonly HealthRecord[]): IndicatorGroup[] {
  const grouped = new Map<string, IndicatorGroup>();
  for (const record of records) {
    const key = `${record.category}:${record.indicator}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.records.push(record);
    } else {
      grouped.set(key, {
        category: record.category,
        indicator: record.indicator,
        records: [record],
      });
    }
  }
  return [...grouped.values()].map((group) => ({
    ...group,
    records: [...group.records].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    ),
  }));
}

function displayDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function emptyAnswer(
  id: HealthAssistantAnswer['id'],
  question: string,
  observation: string,
  nextStep: string,
): HealthAssistantAnswer {
  return {
    id,
    question,
    observation,
    evidence: [],
    next_step: nextStep,
    not_enough_data: true,
  };
}

export function buildHealthAssistantAnswers(
  profileId: string,
  records: readonly HealthRecord[],
  checkins: readonly DailyCheckIn[],
): HealthAssistantAnswer[] {
  const groups = indicatorGroups(records);
  const withTwoMeasurements = groups
    .filter((group) => group.records.filter((record) => record.value !== null).length >= 2)
    .sort((a, b) => {
      const aLatest = Date.parse(a.records[a.records.length - 1].timestamp);
      const bLatest = Date.parse(b.records[b.records.length - 1].timestamp);
      return bLatest - aLatest;
    });

  let changeAnswer: HealthAssistantAnswer;
  const changedGroup = withTwoMeasurements[0];
  if (!changedGroup) {
    changeAnswer = emptyAnswer(
      'change',
      'What changed since my last record?',
      'Not enough data yet. Two dated measurements of the same indicator are needed for a comparison.',
      'Import another measurement for an indicator already in your history.',
    );
  } else {
    const summary = summarizeIndicatorRecords(
      profileId,
      changedGroup.category,
      changedGroup.indicator,
      changedGroup.records,
    );
    const comparison = summary.comparison;
    changeAnswer = {
      id: 'change',
      question: 'What changed since my last record?',
      observation:
        comparison.previous_value === null || comparison.latest_value === null
          ? 'Not enough numeric data yet to compare the latest two records.'
          : `${changedGroup.indicator} changed from ${comparison.previous_value} ${summary.unit ?? ''} to ${comparison.latest_value} ${summary.unit ?? ''}. This is a comparison of records, not a medical interpretation.`,
      evidence: [
        { label: `Previous ${changedGroup.indicator}`, date: comparison.previous_timestamp?.slice(0, 10) ?? '' },
        { label: `Latest ${changedGroup.indicator}`, date: comparison.latest_timestamp?.slice(0, 10) ?? '' },
      ],
      next_step: 'Review the readings and their measurement context in My Health Trends.',
      not_enough_data: false,
    };
  }

  const baselineGroups = groups
    .map((group) => ({
      group,
      baseline: calculatePersonalBaselineFromRecords(group.records, {
        astronaut_id: profileId,
        category: group.category,
        indicator: group.indicator,
      }),
    }))
    .filter(({ baseline }) => baseline.status === 'computed')
    .sort((a, b) => {
      const aLatest = Date.parse(a.group.records[a.group.records.length - 1].timestamp);
      const bLatest = Date.parse(b.group.records[b.group.records.length - 1].timestamp);
      return bLatest - aLatest;
    });
  let historyAnswer: HealthAssistantAnswer;
  if (baselineGroups.length === 0) {
    historyAnswer = emptyAnswer(
      'history',
      'How does it compare with my history?',
      'Not enough data yet. The personal baseline engine needs at least three valid measurements with compatible units.',
      'Import more measurements for the same indicator and unit.',
    );
  } else {
    const { group, baseline } = baselineGroups[0];
    const summary = summarizeIndicatorRecords(
      profileId,
      group.category,
      group.indicator,
      group.records,
    );
    const assessment = evaluateSelfAssessmentFromRecords(group.records, {
      astronaut_id: profileId,
      category: group.category,
      indicator: group.indicator,
    });
    const hazards = getHazardsForIndicator(group.indicator).map((hazard) => hazard.name);
    historyAnswer = {
      id: 'history',
      question: 'How does it compare with my history?',
      observation: `${group.indicator} has a personal median of ${baseline.median?.toFixed(2)} ${baseline.unit ?? ''} from ${baseline.valid_count} valid records. The latest record is dated ${displayDate(group.records[group.records.length - 1].timestamp)}. ${assessment.explanation}`,
      evidence: [
        {
          label: `${group.indicator} history (${summary.total_records} records)`,
          date: `${baseline.time_period.from?.slice(0, 10) ?? 'unknown'} to ${baseline.time_period.to?.slice(0, 10) ?? 'unknown'}`,
        },
      ],
      next_step: assessment.recommended_next_action,
      not_enough_data: false,
      ...(hazards.length > 0
        ? {
            educational_context: `Spaceflight hazards such as ${hazards.join(', ')} can be relevant in general. This does not establish exposure or explain an individual result.`,
          }
        : {}),
    };
  }

  const expectedIndicators = [
    { category: 'sleep' as const, indicator: 'sleep_duration', label: 'sleep duration' },
    { category: 'cardiovascular' as const, indicator: 'heart_rate', label: 'heart rate' },
    { category: 'cardiovascular' as const, indicator: 'systolic_blood_pressure', label: 'blood pressure' },
    { category: 'blood' as const, indicator: 'glucose', label: 'glucose' },
    { category: 'blood' as const, indicator: 'hemoglobin', label: 'blood biomarkers such as hemoglobin' },
  ];
  const registeredExpectedIndicators = expectedIndicators.filter(({ category, indicator }) =>
    listIndicatorsByCategory(category).some((entry) => entry.indicator_id === indicator),
  );
  const presentIndicators = new Set(records.map((record) => `${record.category}:${record.indicator}`));
  const missing = registeredExpectedIndicators.filter(
    ({ category, indicator }) => !presentIndicators.has(`${category}:${indicator}`),
  );
  const missingAnswer: HealthAssistantAnswer = {
    id: 'missing',
    question: 'What data is missing, and what should I import?',
    observation:
      missing.length === 0
        ? 'The listed core indicators have records in this profile. Other indicators in the registry may still be useful for your mission.'
        : `Not enough data yet. No imported records were found for: ${missing.map((item) => item.label).join(', ')}.`,
    evidence: [],
    next_step: 'Use My Measurements to import CSV, XML, or XLSX files. Only indicators in the registry are accepted.',
    not_enough_data: missing.length > 0,
  };

  const latestCheckIn = [...checkins].sort((a, b) =>
    b.checkin_date.localeCompare(a.checkin_date),
  )[0];
  const symptomsReported = Boolean(
    latestCheckIn && (latestCheckIn.mood === 'unwell' || latestCheckIn.symptoms.length > 0),
  );
  const symptomAssessment = symptomsReported
    ? evaluateSelfAssessmentFromRecords(groups[0]?.records ?? [], {
        astronaut_id: profileId,
        category: groups[0]?.category ?? 'sleep',
        indicator: groups[0]?.indicator ?? 'sleep_duration',
        user_reported_symptoms: true,
      })
    : undefined;
  const reviewCandidates = groups
    .map((group) =>
      evaluateSelfAssessmentFromRecords(group.records, {
        astronaut_id: profileId,
        category: group.category,
        indicator: group.indicator,
        user_reported_symptoms: symptomsReported,
      }),
    )
    .filter(
      (assessment) =>
        assessment.assessment_status === 'REVIEW_REQUIRED' ||
        assessment.assessment_status === 'MEDICAL_ESCALATION',
    );
  let reviewAnswer: HealthAssistantAnswer;
  if (symptomsReported && latestCheckIn) {
    reviewAnswer = {
      id: 'review',
      question: 'What should I review with the medical team?',
      observation: `${symptomAssessment?.explanation ?? 'A symptom was reported'} Your ${latestCheckIn.mood === 'unwell' ? '“I feel unwell” check-in' : 'symptom report'} is dated ${latestCheckIn.checkin_date}. This is not a diagnosis.`,
      evidence: [{ label: 'Self-reported check-in', date: latestCheckIn.checkin_date }],
      next_step: symptomAssessment?.recommended_next_action ??
        'Follow your mission medical protocol. You can save a local review request here; this app cannot send it.',
      not_enough_data: false,
    };
  } else if (reviewCandidates.length > 0) {
    const flagged = reviewCandidates[0];
    const supportingRecordIds = new Set(flagged.supporting_records);
    const evidenceRecords = records.filter((record) =>
      supportingRecordIds.has(record.id),
    );
    reviewAnswer = {
      id: 'review',
      question: 'What should I review with the medical team?',
      observation: flagged.explanation,
      evidence: evidenceRecords.map((record) => ({
        label: record.indicator,
        date: displayDate(record.timestamp),
      })),
      next_step: flagged.recommended_next_action,
      not_enough_data: false,
    };
  } else if (groups.length === 0) {
    reviewAnswer = emptyAnswer(
      'review',
      'What should I review with the medical team?',
      'Not enough data yet for a rule-based review suggestion. If you have symptoms, record a Daily Check-in.',
      'Import measurements or complete a Daily Check-in. Follow mission protocols for urgent concerns.',
    );
  } else if (baselineGroups.length === 0) {
    reviewAnswer = emptyAnswer(
      'review',
      'What should I review with the medical team?',
      'Not enough data yet. The assessment engines need at least three valid measurements with compatible units before they can compare a personal history.',
      'Import additional records for an indicator using consistent units. Follow mission protocols for urgent concerns.',
    );
  } else {
    reviewAnswer = {
      id: 'review',
      question: 'What should I review with the medical team?',
      observation: 'The existing assessment engines have not raised a review flag from the available records. This does not rule out a health concern.',
      evidence: [],
      next_step: 'If you have symptoms or concerns, follow your mission medical protocol and use the local review request.',
      not_enough_data: false,
    };
  }

  return [changeAnswer, historyAnswer, missingAnswer, reviewAnswer];
}

export async function getHealthAssistantAnswers(
  profileId: string,
): Promise<HealthAssistantAnswer[]> {
  if (!profileId.trim()) throw new Error('profileId is required for the Health Assistant.');
  const [records, checkins] = await Promise.all([
    queryRecords({ astronaut_id: profileId.trim() }),
    listDailyCheckIns(profileId.trim()),
  ]);
  return buildHealthAssistantAnswers(profileId.trim(), records, checkins);
}
