import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calculatePersonalBaselineFromRecords,
  evaluateIndicatorClinicalSeverity,
  evaluateMultiSystemConsensus,
  evaluateSelfAssessmentFromRecords,
  formatClinicalUnit,
  formatPercentageShift,
  getDailyCheckIn,
  getIndicatorMetadata,
  getLatestMissionContext,
  getRecords,
  listDailyCheckIns,
  type IndicatorClinicalEvaluation,
  type MissionEnvironment,
} from '@/services';
import type {
  AssessmentStatus,
  HealthCategory,
  HealthRecord,
  IndicatorInformationType,
  PersonalBaselineResult,
  SelfAssessmentResult,
} from '@/types';
import { useProfile } from '../context/ProfileContext';
import { useAsync } from '../hooks/useAsync';
import { buildSyntheticScenarioXlsx } from '@/services/demo';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  OriginBadge,
  StatusBadge,
  clinicalSeverityToHealthStatus,
  severityBorderClass,
} from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import { MissionHealthConsensusCard } from '../components/MissionHealthConsensusCard';

interface HomeMetric {
  id: 'sleep' | 'heart-rate' | 'blood-pressure' | 'blood';
  label: string;
  category: HealthCategory;
  record?: HealthRecord;
  value?: string;
  latestNumericValue: number | null;
  diastolicNumericValue: number | null;
  baselineMedianDisplay?: string;
  trendValues: number[];
  baseline?: PersonalBaselineResult;
  assessment?: SelfAssessmentResult;
  clinical: IndicatorClinicalEvaluation;
}

interface IndicatorObservationDetail {
  indicatorId: string;
  indicatorName: string;
  category: HealthCategory;
  informationType: IndicatorInformationType;
  latestRecord: HealthRecord;
  previousRecord?: HealthRecord;
  baseline: PersonalBaselineResult;
  assessment: SelfAssessmentResult;
  clinical: IndicatorClinicalEvaluation;
  observationKindLabel:
    | 'Statistical Observation'
    | 'Outdated Measurement Warning'
    | 'Insufficient Data Notice'
    | 'Data-Quality Warning'
    | 'User-Reported Symptom Escalation';
  whyDisplayed: string;
  changeExplanation: string;
  sufficiencySummary: string;
}

interface RecentActivity {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function missionDay(startDate: string | undefined): number | undefined {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  const [year, month, day] = startDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const todayKey = localDateKey();
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);
  if (!Number.isFinite(start) || start > today) return undefined;
  return Math.floor((today - start) / 86_400_000) + 1;
}

function formatDate(timestamp: string | null | undefined): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp.slice(0, 10)
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatIndicatorTitle(indicatorId: string): string {
  const meta = getIndicatorMetadata(indicatorId);
  if (meta) return meta.name;
  return indicatorId
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatInfoTypeLabel(infoType?: IndicatorInformationType): string {
  switch (infoType) {
    case 'instrument_measurement':
      return 'Instrument Measurement';
    case 'wearable_estimate':
      return 'Wearable Estimate';
    case 'laboratory_result':
      return 'Laboratory Result';
    case 'subjective_self_report':
      return 'Subjective Self-Report';
    default:
      return 'Recorded Measurement';
  }
}

function recordValue(record: HealthRecord): number | null {
  if (record.category === 'sleep' && record.indicator === 'sleep_duration') {
    return record.sleep_duration ?? record.value;
  }
  if (record.category === 'cardiovascular' && record.indicator === 'heart_rate') {
    return record.heart_rate ?? record.value;
  }
  return record.value;
}

function formatMetricValue(metric: Pick<HomeMetric, 'id' | 'record'>): string | undefined {
  const record = metric.record;
  if (!record) return undefined;

  if (metric.id === 'sleep' && record.category === 'sleep') {
    const value = record.sleep_duration ?? record.value;
    return value === null ? undefined : `${value} ${formatClinicalUnit(record.unit, 'sleep_duration')}`;
  }
  if (metric.id === 'heart-rate' && record.category === 'cardiovascular') {
    const value = record.heart_rate ?? record.value;
    return value === null ? undefined : `${value} ${record.unit || 'bpm'}`;
  }
  if (metric.id === 'blood-pressure' && record.category === 'cardiovascular') {
    if (record.blood_pressure) {
      return `${record.blood_pressure.systolic}/${record.blood_pressure.diastolic} mmHg`;
    }
    return record.value === null ? undefined : `${record.value} ${record.unit}`;
  }
  if (metric.id === 'blood' && record.category === 'blood') {
    const label = formatIndicatorTitle(record.indicator);
    return record.value === null
      ? `${label}: value unavailable`
      : `${label}: ${record.value} ${record.unit}`;
  }
  return undefined;
}

function metricTrendValue(metricId: HomeMetric['id'], record: HealthRecord): number | undefined {
  if (metricId === 'sleep' && record.category === 'sleep') {
    const value = record.sleep_duration ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'heart-rate' && record.category === 'cardiovascular') {
    const value = record.heart_rate ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'blood-pressure' && record.category === 'cardiovascular') {
    const value = record.blood_pressure?.systolic ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'blood' && record.category === 'blood') {
    return typeof record.value === 'number' ? record.value : undefined;
  }
  return undefined;
}

function computeMedianValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildMetrics(
  records: HealthRecord[],
  astronautId: string,
  reportedSymptoms: boolean,
  environment: MissionEnvironment,
): HomeMetric[] {
  const definitions: Array<Pick<HomeMetric, 'id' | 'label' | 'category'>> = [
    { id: 'sleep', label: 'Sleep', category: 'sleep' },
    { id: 'heart-rate', label: 'Heart rate', category: 'cardiovascular' },
    { id: 'blood-pressure', label: 'Blood pressure', category: 'cardiovascular' },
    { id: 'blood', label: 'Blood biomarkers', category: 'blood' },
  ];

  return definitions.map((definition) => {
    const matching = records.filter((record) => {
      if (definition.id === 'sleep') {
        return record.category === 'sleep' && record.indicator === 'sleep_duration';
      }
      if (definition.id === 'heart-rate') {
        return record.category === 'cardiovascular' && record.indicator === 'heart_rate';
      }
      if (definition.id === 'blood-pressure') {
        return (
          record.category === 'cardiovascular' &&
          (record.indicator === 'systolic_blood_pressure' ||
            record.indicator === 'blood_pressure')
        );
      }
      return record.category === 'blood' && record.indicator === 'hemoglobin';
    });

    const fallbackMatching =
      matching.length > 0
        ? matching
        : definition.id === 'blood'
          ? records.filter((r) => r.category === 'blood')
          : matching;

    const sortedMatching = [...fallbackMatching].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    const nonNullMatching = sortedMatching.filter((r) => recordValue(r) !== null);
    const latest = nonNullMatching.at(-1) ?? sortedMatching.at(-1);

    const targetIndicator =
      definition.id === 'sleep'
        ? 'sleep_duration'
        : definition.id === 'heart-rate'
          ? 'heart_rate'
          : definition.id === 'blood-pressure'
            ? latest?.indicator === 'systolic_blood_pressure'
              ? 'systolic_blood_pressure'
              : latest?.indicator ?? 'systolic_blood_pressure'
            : latest?.indicator ?? 'hemoglobin';

    const baseline = latest
      ? calculatePersonalBaselineFromRecords(records, {
          astronaut_id: astronautId,
          category: latest.category,
          indicator: targetIndicator,
        })
      : undefined;

    const assessment = latest
      ? evaluateSelfAssessmentFromRecords(records, {
          astronaut_id: astronautId,
          category: latest.category,
          indicator: targetIndicator,
          user_reported_symptoms: reportedSymptoms,
        })
      : undefined;

    const latestNumericValue = latest ? recordValue(latest) : null;
    const diastolicNumericValue =
      definition.id === 'blood-pressure' && latest?.category === 'cardiovascular'
        ? (latest.blood_pressure?.diastolic ?? null)
        : null;

    let baselineMedianDisplay: string | undefined;
    if (baseline && baseline.median !== null) {
      if (definition.id === 'blood-pressure') {
        const diaBaseline = calculatePersonalBaselineFromRecords(records, {
          astronaut_id: astronautId,
          category: 'cardiovascular',
          indicator: 'diastolic_blood_pressure',
        });
        const embeddedDiaMedian = computeMedianValue(
          nonNullMatching
            .map((r) => (r.category === 'cardiovascular' ? r.blood_pressure?.diastolic : undefined))
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
        );
        const diaMedian = diaBaseline.median ?? embeddedDiaMedian;
        baselineMedianDisplay =
          diaMedian !== null
            ? `${Math.round(baseline.median)}/${Math.round(diaMedian)} mmHg`
            : `${Math.round(baseline.median)} mmHg`;
      } else {
        const unitLabel = formatClinicalUnit(baseline.unit, targetIndicator);
        const formattedMedian = Number.isInteger(baseline.median)
          ? String(baseline.median)
          : baseline.median.toFixed(2);
        baselineMedianDisplay = `${formattedMedian} ${unitLabel}`.trim();
      }
    }

    const clinical = evaluateIndicatorClinicalSeverity({
      indicator: targetIndicator,
      category: definition.category,
      latestValue: latestNumericValue,
      diastolicValue: diastolicNumericValue,
      baseline,
      assessmentStatus: assessment?.assessment_status,
      environment,
    });

    const metric: HomeMetric = {
      ...definition,
      record: latest,
      latestNumericValue,
      diastolicNumericValue,
      baselineMedianDisplay,
      baseline,
      assessment,
      clinical,
      trendValues: nonNullMatching
        .slice(-12)
        .map((record) => metricTrendValue(definition.id, record))
        .filter((value): value is number => value !== undefined),
    };
    metric.value = formatMetricValue(metric);
    return metric;
  });
}

function buildExplainableObservations(
  records: HealthRecord[],
  astronautId: string,
  reportedSymptoms: boolean,
  environment: MissionEnvironment,
): IndicatorObservationDetail[] {
  const byIndicator = new Map<string, HealthRecord[]>();
  for (const rec of records) {
    const key = `${rec.category}:${rec.indicator}`;
    const existing = byIndicator.get(key);
    if (existing) {
      existing.push(rec);
    } else {
      byIndicator.set(key, [rec]);
    }
  }

  const details: IndicatorObservationDetail[] = [];

  for (const [key, group] of byIndicator.entries()) {
    const [category, indicatorId] = key.split(':') as [HealthCategory, string];
    const sorted = [...group].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const nonNull = sorted.filter((r) => r.value !== null);
    const latestRecord = nonNull.at(-1) ?? sorted.at(-1);
    if (!latestRecord) continue;
    const previousRecord = nonNull.length >= 2 ? nonNull.at(-2) : undefined;

    const meta = getIndicatorMetadata(indicatorId);
    const infoType: IndicatorInformationType =
      meta?.information_type ??
      (category === 'blood'
        ? 'laboratory_result'
        : category === 'sleep'
          ? 'wearable_estimate'
          : 'instrument_measurement');

    const baseline = calculatePersonalBaselineFromRecords(records, {
      astronaut_id: astronautId,
      category,
      indicator: indicatorId,
    });

    const assessment = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: astronautId,
      category,
      indicator: indicatorId,
      user_reported_symptoms: reportedSymptoms,
    });

    const pct = baseline.period_comparison.percentage_change;
    const pctFormatted = formatPercentageShift(pct);
    const absPctFormatted = pct !== null ? `${Math.abs(pct).toFixed(1)}%` : null;
    const dir = baseline.period_comparison.direction;
    const earlierMean = baseline.period_comparison.earlier_mean;
    const recentMean = baseline.period_comparison.recent_mean;
    const displayUnit = formatClinicalUnit(latestRecord.unit, indicatorId);

    const clinical = evaluateIndicatorClinicalSeverity({
      indicator: indicatorId,
      category,
      latestValue: recordValue(latestRecord),
      diastolicValue:
        latestRecord.category === 'cardiovascular'
          ? (latestRecord.blood_pressure?.diastolic ?? null)
          : null,
      baseline,
      assessmentStatus: assessment.assessment_status,
      environment,
    });

    let observationKindLabel: IndicatorObservationDetail['observationKindLabel'] =
      'Statistical Observation';
    let whyDisplayed =
      'Displayed because this indicator has personal baseline measurements available for longitudinal review.';
    let changeExplanation = assessment.explanation;

    if (assessment.assessment_status === 'MEDICAL_ESCALATION') {
      observationKindLabel = 'User-Reported Symptom Escalation';
      whyDisplayed =
        'Triggered by Rule R1 (User-Reported Symptoms / Distress): self-reported check-in symptoms were logged alongside measurement history.';
    } else if (assessment.assessment_status === 'INSUFFICIENT_DATA') {
      observationKindLabel = 'Insufficient Data Notice';
      whyDisplayed = `Triggered by Rule R2 (Minimum Sample Requirement): ${baseline.valid_count} of 3 required valid measurements are available.`;
      changeExplanation = `${formatIndicatorTitle(indicatorId)} currently has ${baseline.valid_count} valid recorded measurement(s). At least 3 valid measurements are required before TUMI-HEALT computes a personal baseline or percentage shift.`;
    } else if (assessment.assessment_status === 'REVIEW_REQUIRED') {
      observationKindLabel = 'Statistical Observation';
      whyDisplayed = `Triggered by Rule R4 (Statistical Period Shift ≥20%): recent period mean shifted by ${pctFormatted ?? '≥20%'} compared with your earlier personal baseline.`;
      if (earlierMean !== null && recentMean !== null && absPctFormatted !== null) {
        const directionWord = dir === 'decrease' ? 'decreased' : dir === 'increase' ? 'increased' : 'changed';
        changeExplanation = `Your ${formatIndicatorTitle(indicatorId).toLowerCase()} has ${directionWord} by ${absPctFormatted} in the recent period (recent mean ${recentMean.toFixed(2)} ${displayUnit} vs. earlier baseline mean ${earlierMean.toFixed(2)} ${displayUnit}).`;
      }
    } else if (assessment.assessment_status === 'MONITOR') {
      if (baseline.freshness_days !== null && baseline.freshness_days > 14) {
        observationKindLabel = 'Outdated Measurement Warning';
        whyDisplayed = `Triggered by Rule R3 (Data Freshness >14 Days): latest valid measurement was recorded ${baseline.freshness_days.toFixed(1)} days ago.`;
        changeExplanation = `${formatIndicatorTitle(indicatorId)} has a valid personal baseline (${baseline.median?.toFixed(2)} ${displayUnit}), but the most recent measurement is ${baseline.freshness_days.toFixed(1)} days old. Collect an updated reading before relying on current trend status.`;
      } else {
        observationKindLabel = 'Data-Quality Warning';
        whyDisplayed = `Longitudinal baseline computed from ${baseline.valid_count} valid measurement(s) with null gaps preserved without zero-filling.`;
      }
    } else {
      observationKindLabel = 'Statistical Observation';
      whyDisplayed =
        'Triggered by Rule R5 (Within Personal Baseline Variability): recent measurements remain within personal baseline continuity.';
      if (earlierMean !== null && recentMean !== null && pctFormatted !== null) {
        changeExplanation = `${formatIndicatorTitle(indicatorId)} shifted by ${pctFormatted} compared with your personal baseline (recent mean ${recentMean.toFixed(2)} ${displayUnit} vs. earlier baseline mean ${earlierMean.toFixed(2)} ${displayUnit}).`;
      }
    }

    const excludedNote =
      baseline.excluded_records.length > 0
        ? ` (${baseline.excluded_records.length} null gap(s) preserved without zero-filling)`
        : '';
    const sufficiencySummary =
      baseline.status === 'computed'
        ? `Sufficient history: ${baseline.valid_count} valid measurements of ${baseline.total_examined} examined${excludedNote} · Freshness: ${baseline.freshness_days !== null ? baseline.freshness_days.toFixed(0) : 0}d ago`
        : `Insufficient history: ${baseline.valid_count} of 3 required valid measurements (${baseline.total_examined} examined)`;

    details.push({
      indicatorId,
      indicatorName: formatIndicatorTitle(indicatorId),
      category,
      informationType: infoType,
      latestRecord,
      previousRecord,
      baseline,
      assessment,
      clinical,
      observationKindLabel,
      whyDisplayed,
      changeExplanation,
      sufficiencySummary,
    });
  }

  // Sort priority: MEDICAL_ESCALATION -> REVIEW_REQUIRED -> MONITOR -> INSUFFICIENT_DATA -> INFORMATIONAL
  const rank: Record<AssessmentStatus, number> = {
    MEDICAL_ESCALATION: 0,
    REVIEW_REQUIRED: 1,
    MONITOR: 2,
    INSUFFICIENT_DATA: 3,
    INFORMATIONAL: 4,
  };

  details.sort((a, b) => {
    const diff = rank[a.assessment.assessment_status] - rank[b.assessment.assessment_status];
    if (diff !== 0) return diff;
    const pctA = Math.abs(a.baseline.period_comparison.percentage_change ?? 0);
    const pctB = Math.abs(b.baseline.period_comparison.percentage_change ?? 0);
    return pctB - pctA;
  });

  return details;
}

function TinyTrend({ label, values }: { label: string; values: number[] }) {
  if (values.length < 2) {
    return <p className="mt-2 text-xs text-slate-400">Trend needs more records.</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 22 - ((value - min) / spread) * 18;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      role="img"
      aria-label={`${label} recent values: ${values.join(', ')}`}
      viewBox="0 0 100 24"
      className="mt-2 h-6 w-full"
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
    </svg>
  );
}

function previousRecordSummary(record: HealthRecord, allRecords: HealthRecord[]): string {
  let previous: HealthRecord | undefined;
  for (const candidate of allRecords) {
    if (
      candidate.category === record.category &&
      candidate.indicator === record.indicator &&
      Date.parse(candidate.timestamp) < Date.parse(record.timestamp)
    ) {
      previous = candidate;
    }
  }
  if (!previous) return 'First record for this indicator.';
  const oldValue = recordValue(previous);
  const newValue = recordValue(record);
  if (oldValue === null || newValue === null || oldValue === undefined || newValue === undefined) {
    return 'New record added; one or both values are marked missing (NA).';
  }
  if (oldValue === newValue) return `No numeric change from the previous record (${oldValue} ${record.unit}).`;
  return `Changed from ${oldValue} to ${newValue} ${record.unit}.`;
}

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { active, isDemoMode, enterDemoMode } = useProfile();
  const [environment, setEnvironment] = useState<MissionEnvironment>('iss-microgravity');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showAllObservations, setShowAllObservations] = useState(false);
  const [observationFilter, setObservationFilter] = useState<'attention' | 'all'>('attention');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoReadyMsg, setDemoReadyMsg] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  function onDownloadExampleXlsx() {
    setDemoError(null);
    const workbook = buildSyntheticScenarioXlsx();
    const blob = new Blob([workbook.content], { type: workbook.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = workbook.fileName;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadMsg(
      `Downloaded ${workbook.fileName}. Open "Import data" to upload the workbook and import all sheets into your profile.`,
    );
  }

  async function onExploreDemo() {
    setDemoLoading(true);
    setDemoError(null);
    setDemoReadyMsg(null);
    try {
      await enterDemoMode();
      setDemoReadyMsg('90-day synthetic astronaut scenario loaded in isolated Demo Mode.');
    } catch (err) {
      setDemoError(
        err instanceof Error
          ? `Could not load the 90-day synthetic demo: ${err.message}`
          : 'Could not load the 90-day synthetic demo.',
      );
    } finally {
      setDemoLoading(false);
    }
  }
  const id = active?.astronaut_id;
  const today = localDateKey();

  const { data, loading, error } = useAsync(async () => {
    if (!id) return undefined;
    const [records, mission, todayCheckIn, checkIns] = await Promise.all([
      getRecords({ astronaut_id: id }),
      getLatestMissionContext(id),
      getDailyCheckIn(id, today),
      listDailyCheckIns(id, 10),
    ]);
    const hasSymptoms = Boolean(
      todayCheckIn && (todayCheckIn.mood === 'unwell' || todayCheckIn.symptoms.length > 0),
    );
    const metrics = buildMetrics(records, id, hasSymptoms, environment);
    const allObservations = buildExplainableObservations(records, id, hasSymptoms, environment);
    const sleepMetric = metrics.find((m) => m.id === 'sleep');
    const hrMetric = metrics.find((m) => m.id === 'heart-rate');
    const bpMetric = metrics.find((m) => m.id === 'blood-pressure');
    const bloodMetric = metrics.find((m) => m.id === 'blood');
    const consensus = evaluateMultiSystemConsensus({
      environment,
      sleepHours: sleepMetric?.latestNumericValue ?? null,
      sleepPctChange: sleepMetric?.baseline?.period_comparison.percentage_change ?? null,
      sleepSeverity: sleepMetric?.clinical.severity ?? 'insufficient',
      heartRateBpm: hrMetric?.latestNumericValue ?? null,
      heartRatePctChange: hrMetric?.baseline?.period_comparison.percentage_change ?? null,
      heartRateSeverity: hrMetric?.clinical.severity ?? 'insufficient',
      systolicMmHg: bpMetric?.latestNumericValue ?? null,
      diastolicMmHg: bpMetric?.diastolicNumericValue ?? null,
      bpPctChange: bpMetric?.baseline?.period_comparison.percentage_change ?? null,
      bpSeverity: bpMetric?.clinical.severity ?? 'insufficient',
      hemoglobinGdL: bloodMetric?.latestNumericValue ?? null,
      hemoglobinPctChange: bloodMetric?.baseline?.period_comparison.percentage_change ?? null,
      hemoglobinSeverity: bloodMetric?.clinical.severity ?? 'insufficient',
      reportedSymptoms: hasSymptoms,
    });

    const activity: RecentActivity[] = [
      ...records.slice(-25).map((record) => ({
        id: record.id,
        timestamp: record.timestamp,
        title: `${formatIndicatorTitle(record.indicator)} recorded`,
        detail: previousRecordSummary(record, records),
      })),
      ...checkIns.map((checkIn) => {
        const previous = checkIns.find((candidate) => candidate.checkin_date < checkIn.checkin_date);
        const change = previous
          ? `Compared with previous check-in: ${previous.mood.replaceAll('_', ' ')}, energy ${previous.energy_level} of 5.`
          : 'No earlier check-in in the recent history.';
        return {
          id: checkIn.id,
          timestamp: checkIn.updated_at,
          title: 'Daily self-report (Check-in)',
          detail: `${checkIn.mood.replaceAll('_', ' ')} · energy ${checkIn.energy_level} of 5 · ${
            checkIn.symptoms.length ? checkIn.symptoms.join(', ') : 'no symptoms selected'
          }. ${change}`,
        };
      }),
    ];
    activity.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return {
      records,
      mission,
      todayCheckIn,
      checkIns,
      metrics,
      consensus,
      allObservations,
      activity: activity.slice(0, 6),
    };
  }, [id, today, environment]);

  const metrics = data?.metrics ?? [];
  const allObservations = data?.allObservations ?? [];
  const missingMetrics = metrics.filter((metric) => !metric.record);
  const day = missionDay(data?.mission?.mission_start_date);

  const sufficientIndicators = allObservations.filter((o) => o.baseline.status === 'computed');
  const insufficientIndicators = allObservations.filter(
    (o) => o.baseline.status === 'insufficient_data',
  );
  const outdatedIndicators = allObservations.filter(
    (o) => o.baseline.freshness_days !== null && o.baseline.freshness_days > 14,
  );
  const reviewRequiredIndicators = allObservations.filter(
    (o) =>
      o.assessment.assessment_status === 'REVIEW_REQUIRED' ||
      o.assessment.assessment_status === 'MEDICAL_ESCALATION',
  );
  const missingValueRecordsCount = (data?.records ?? []).filter((r) => r.value === null).length;

  const filteredObservations =
    observationFilter === 'attention'
      ? allObservations.filter((o) => o.assessment.assessment_status !== 'INFORMATIONAL')
      : allObservations;
  const visibleObservations = showAllObservations
    ? filteredObservations
    : filteredObservations.slice(0, 6);

  const latestOverallTimestamp = (data?.records ?? []).reduce<string | null>((acc, r) => {
    if (!acc || Date.parse(r.timestamp) > Date.parse(acc)) return r.timestamp;
    return acc;
  }, null);

  return (
    <div className="space-y-6">
      {/* Top Mission Overview Banner */}
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                {isDemoMode
                  ? 'DEMO MODE · 90-DAY SYNTHETIC ASTRONAUT DATASET'
                  : 'MISSION HEALTH OVERVIEW'}
              </p>
              {isDemoMode && <OriginBadge origin="SYNTHETIC" />}
            </div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              {active ? `${greeting()}, ${active.display_name}` : 'Dashboard · Health Overview'}
            </h1>
            <p className="text-sm text-slate-200">
              {day
                ? `Mission Day ${day} · ${data?.mission?.environment_type ?? 'Orbital Habitat'} (${data?.mission?.gravity_environment ?? 'microgravity'})`
                : 'Add a mission start date in Mission & Privacy to track your mission day.'}
            </p>
            {active && (
              <p className="text-xs text-slate-400">
                Active profile: <strong className="text-slate-200">{active.display_name}</strong> (
                <span className="font-mono">{active.astronaut_id}</span>)
                {active.mission_role ? ` · ${active.mission_role}` : ''}
                {latestOverallTimestamp
                  ? ` · Latest measurement: ${formatDate(latestOverallTimestamp)}`
                  : ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/import"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              + Import data
            </Link>
            <Link
              to="/trends"
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm font-medium text-slate-100 hover:border-cyan-500/50"
            >
              90-Day Trends
            </Link>
            {!day && (
              <Link
                to="/profiles"
                className="rounded-lg border border-cyan-700/70 px-3 py-2 text-sm font-medium text-cyan-200 hover:border-cyan-400"
              >
                Add mission start
              </Link>
            )}
          </div>
        </div>

        {/* 90-Day Data Availability & Sufficiency Strip (Answers Questions 1, 2, 4, 5, 6) */}
        {data && data.records.length > 0 && (
          <div className="mt-5 grid gap-3 border-t border-slate-800/90 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Available Measurements
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-white">
                {data.records.length} records · {allObservations.length} indicators
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Latest recorded: <strong className="text-cyan-300">{formatDate(latestOverallTimestamp)}</strong>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Baseline Sufficiency
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-300">
                {sufficientIndicators.length} of {allObservations.length} ready
              </p>
              <p className="mt-1 text-xs text-slate-300">
                &ge;3 valid samples for personal baseline comparison
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                3. Changes to Review
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-300">
                {reviewRequiredIndicators.length} indicator{reviewRequiredIndicators.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {reviewRequiredIndicators.length > 0
                  ? reviewRequiredIndicators.map((i) => i.indicatorName).join(', ')
                  : 'All computed baselines within <20% shift'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                4. Missing or Outdated
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-cyan-200">
                {insufficientIndicators.length} insufficient · {outdatedIndicators.length} outdated
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {missingValueRecordsCount > 0
                  ? `${missingValueRecordsCount} explicit missing (NA) row(s) preserved`
                  : 'No missing value rows'}
              </p>
            </div>
          </div>
        )}
      </section>

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-300">Loading your local health summary…</p>}

      {/* Guided Empty State when a personal profile has 0 measurements */}
      {!loading && data && data.records.length === 0 && (
        <Card
          title="No health measurements recorded in this profile yet"
          subtitle="Start by importing a measurement file or exploring the 90-day synthetic astronaut timeline."
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-300">
              Your personal profile (<strong className="text-white">{active?.display_name}</strong>) is currently empty. You can download a complete 90-day example Excel workbook (.xlsx) and upload all its sheets in <strong>Import data</strong>, or explore the isolated Demo Astronaut profile.
            </p>
            {downloadMsg && <Alert kind="info">{downloadMsg}</Alert>}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onDownloadExampleXlsx}
                className="border-purple-400/50 bg-purple-950/60 text-purple-100 hover:bg-purple-900/70"
              >
                Download 90-Day Example (.xlsx)
              </Button>
              <Link
                to="/import"
                className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Import data
              </Link>
              <Link
                to="/check-in"
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-cyan-500/50"
              >
                Complete Daily Check-In
              </Link>
            </div>
            <div className="rounded-xl border border-violet-500/40 bg-violet-950/35 p-4 space-y-2.5">
              <p className="text-sm font-semibold text-violet-100">Explore with a Demo Astronaut</p>
              <p className="text-sm leading-relaxed text-violet-100/85">
                Load a complete 90-day synthetic astronaut health scenario and explore how TUMI-HEALT identifies changes in sleep, cardiovascular indicators, laboratory results and daily health assessments.
              </p>
              {demoError && <Alert kind="error">{demoError}</Alert>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={demoLoading}
                  onClick={() => void onExploreDemo()}
                  className="border-violet-400/50 bg-violet-700 text-white hover:bg-violet-600"
                >
                  {demoLoading ? 'Loading 90-Day Demo…' : 'Explore 90-Day Demo'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isDemoMode && demoReadyMsg && (
        <Alert kind="info">{demoReadyMsg}</Alert>
      )}

      {/* Unified Multi-System Clinical Consensus Panel (Top Priority) */}
      {data && data.records.length > 0 && (
        <MissionHealthConsensusCard
          environment={environment}
          onEnvironmentChange={setEnvironment}
          consensus={data.consensus}
        />
      )}

      {/* Key Vital & Biomarker Summary Cards */}
      <section aria-labelledby="health-summary-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="health-summary-title" className="text-lg font-semibold text-white">
              Health summary
            </h2>
            <p className="text-xs text-slate-400">
              Latest recorded measurements across Sleep, Cardiovascular Vitals, and Blood Biomarkers compared with your personal baseline (± 1 SD).
            </p>
          </div>
          <Link to="/import" className="text-sm font-medium text-cyan-300 hover:underline">
            + Import data
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const pctFormatted = formatPercentageShift(
              metric.baseline?.period_comparison.percentage_change,
            );
            const cardStatus = clinicalSeverityToHealthStatus(metric.clinical.severity);
            const borderClass = severityBorderClass(cardStatus);
            return (
              <Card key={metric.id} className={`min-w-0 border-2 ${borderClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">{metric.label}</h3>
                  {metric.record && <OriginBadge origin={metric.record.data_origin} />}
                </div>
                <p className="mt-2 font-mono text-xl font-bold text-white">
                  {metric.value ?? 'No data yet'}
                </p>
                {metric.record ? (
                  <>
                    <p className="mt-1 text-xs text-slate-300">
                      Latest: {formatDate(metric.record.timestamp)}
                    </p>
                    {metric.baselineMedianDisplay && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Personal baseline median:{' '}
                        <strong className="text-slate-200">{metric.baselineMedianDisplay}</strong>
                        {pctFormatted ? ` (${pctFormatted} recent shift)` : ''}
                      </p>
                    )}
                    <TinyTrend label={`${metric.label} trend`} values={metric.trendValues} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge
                        status={cardStatus}
                        label={metric.clinical.badgeLabel}
                      />
                      <Link
                        to="/trends"
                        className="text-xs font-medium text-cyan-300 hover:underline"
                      >
                        90d chart →
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <StatusBadge status="not-enough-data" className="mt-3" />
                    <Link to="/import" className="mt-3 inline-block text-sm text-cyan-300 hover:underline">
                      Import data
                    </Link>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Explainable Observations & Actionable Analysis (Section 4.1, 4.2, 4.3) */}
      <Card
        title="Health Assistant · Explainable Observations & Next Steps"
        subtitle="Every observation distinguishes statistical baseline shifts, data-quality/outdated notices, missing history, and self-reported symptoms. Non-diagnostic decision support."
        action={
          allObservations.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setObservationFilter('attention')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  observationFilter === 'attention'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                Needs Attention ({allObservations.filter((o) => o.assessment.assessment_status !== 'INFORMATIONAL').length})
              </button>
              <button
                type="button"
                onClick={() => setObservationFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  observationFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                All Indicators ({allObservations.length})
              </button>
            </div>
          ) : undefined
        }
      >
        {allObservations.length === 0 && missingMetrics.length === 0 ? (
          <EmptyState>
            {data?.records.length
              ? 'Not enough data yet for an assessment. Import additional records to build a personal history.'
              : 'Not enough data yet. Import sleep, heart rate, blood pressure, or blood biomarker records to see observations.'}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {visibleObservations.length > 0 ? (
              <ul className="space-y-3.5">
                {visibleObservations.map((obs) => {
                  const prevVal = obs.previousRecord ? recordValue(obs.previousRecord) : null;
                  const currVal = recordValue(obs.latestRecord);
                  const earlierMean = obs.baseline.period_comparison.earlier_mean;
                  const recentMean = obs.baseline.period_comparison.recent_mean;
                  const pctFormatted = formatPercentageShift(
                    obs.baseline.period_comparison.percentage_change,
                  );
                  const obsUnit = formatClinicalUnit(obs.latestRecord.unit, obs.indicatorId);
                  const obsHealthStatus = clinicalSeverityToHealthStatus(obs.clinical.severity);
                  const obsBorderClass = severityBorderClass(obsHealthStatus);

                  return (
                    <li
                      key={`${obs.category}:${obs.indicatorId}`}
                      data-testid="observation-detail-card"
                      className={`rounded-xl border-2 ${obsBorderClass} bg-slate-950/65 p-4 sm:p-5`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-white">
                              {obs.indicatorName}
                            </h3>
                            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-medium text-cyan-300">
                              {formatInfoTypeLabel(obs.informationType)}
                            </span>
                            <span className="rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-300">
                              {obs.observationKindLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            Recorded on <strong className="text-slate-200">{formatDate(obs.latestRecord.timestamp)}</strong>
                            {obs.baseline.time_period.from && obs.baseline.time_period.to
                              ? ` · 90-day comparison window: ${formatDate(obs.baseline.time_period.from)} – ${formatDate(obs.baseline.time_period.to)}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={obsHealthStatus}
                            label={obs.clinical.badgeLabel}
                          />
                          <OriginBadge origin={obs.latestRecord.data_origin} />
                        </div>
                      </div>

                      {/* Value, Unit, Previous Value & Baseline Comparison */}
                      <div className="mt-3 grid gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-slate-400">Current Value &amp; Unit:</span>
                          <p className="mt-0.5 font-mono text-sm font-bold text-cyan-300">
                            {currVal !== null ? `${currVal} ${obsUnit}` : `Missing (NA) ${obsUnit}`}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Previous Recorded Value:</span>
                          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                            {prevVal !== null && obs.previousRecord
                              ? `${prevVal} ${formatClinicalUnit(obs.previousRecord.unit, obs.indicatorId)} (${formatDate(obs.previousRecord.timestamp)})`
                              : 'No prior sample'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Personal Baseline Comparison:</span>
                          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                            {earlierMean !== null && recentMean !== null && pctFormatted !== null
                              ? `${earlierMean.toFixed(2)} → ${recentMean.toFixed(2)} ${obsUnit} (${pctFormatted})`
                              : obs.baseline.median !== null
                                ? `Median: ${obs.baseline.median.toFixed(2)} ${obsUnit}`
                                : 'Requires ≥3 valid samples'}
                          </p>
                        </div>
                      </div>

                      {/* Spaceflight Context & Actionable Countermeasures */}
                      <div className="mt-3 space-y-2 text-sm">
                        <p className="leading-relaxed text-slate-200">
                          <strong className="text-white">Clinical trend:</strong> {obs.changeExplanation}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-300">
                          <strong className="text-cyan-300">Spaceflight Context:</strong> {obs.clinical.spaceflightContext}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-400">
                          <strong className="text-slate-300">Data sufficiency:</strong> {obs.sufficiencySummary}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-900/50 bg-cyan-950/25 px-3 py-2 text-xs">
                          <p className="text-cyan-100">
                            <strong className="text-cyan-300">Actionable Countermeasure:</strong>{' '}
                            {obs.clinical.countermeasure}
                          </p>
                          <div className="flex items-center gap-3">
                            <Link
                              to="/trends"
                              className="font-semibold text-cyan-300 hover:underline"
                            >
                              Inspect timeline →
                            </Link>
                            <Link
                              to="/guides"
                              className="font-semibold text-slate-300 hover:text-white hover:underline"
                            >
                              Indicator guide →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-300">
                No indicators currently require special review. Switch to <strong>All Indicators ({allObservations.length})</strong> to inspect all stable baselines.
              </p>
            )}

            {filteredObservations.length > 6 && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAllObservations((prev) => !prev)}
                  className="text-xs"
                >
                  {showAllObservations
                    ? 'Show fewer observations'
                    : `Show all ${filteredObservations.length} observations`}
                </Button>
              </div>
            )}

            {missingMetrics.length > 0 && (
              <div className="border-t border-slate-800 pt-3">
                <h3 className="text-sm font-semibold text-slate-200">Missing category data</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {missingMetrics.map((metric) => (
                    <li key={metric.id}>
                      <Link
                        to="/import"
                        className="inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-sm text-cyan-200 hover:border-cyan-500"
                      >
                        Import {metric.label.toLowerCase()}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Subjective Self-Report Check-in & Medical Review Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Daily check-in (Subjective Self-Report)"
          subtitle="Mood, fatigue/energy, and self-reported symptoms—kept strictly separate from laboratory and instrument measurements."
          action={
            <Link
              to="/check-in"
              className="rounded-lg border border-cyan-600/70 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-400"
            >
              {data?.todayCheckIn ? 'Edit' : 'Check in'}
            </Link>
          }
        >
          {data?.todayCheckIn ? (
            <div className="space-y-1.5 text-sm">
              <p className="text-slate-200">
                <strong>Today:</strong> {data.todayCheckIn.mood.replaceAll('_', ' ')} · energy{' '}
                {data.todayCheckIn.energy_level} of 5 ·{' '}
                {data.todayCheckIn.symptoms.length
                  ? data.todayCheckIn.symptoms.map((s) => s.replaceAll('_', ' ')).join(', ')
                  : 'no symptoms selected'}
              </p>
              {data.todayCheckIn.note && (
                <p className="text-xs text-slate-300">Note: {data.todayCheckIn.note}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              {loading ? 'Checking today’s entry…' : 'No check-in saved for today.'}
            </p>
          )}
        </Card>

        <Card
          title="Medical team access"
          subtitle="This app does not transmit telemetry automatically to an external server."
        >
          <p className="text-sm leading-relaxed text-slate-300">
            Prepare a structured local summary package combining selected 90-day measurements, baseline shifts, and daily check-ins for flight surgeon review.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setReviewOpen(true)}>
              Request medical review
            </Button>
            <Link
              to="/assistant"
              className="text-sm font-medium text-cyan-300 hover:underline"
            >
              Ask Rule-Based Health Assistant →
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card
        title="Recent activity"
        subtitle="Latest imported measurements and self-reported check-ins from this profile."
      >
        {!data || data.activity.length === 0 ? (
          <EmptyState>
            No recent records or check-ins yet. Import measurements or add a daily check-in.
          </EmptyState>
        ) : (
          <ol className="divide-y divide-slate-800">
            {data.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.detail}</p>
                </div>
                <time className="text-sm text-slate-400" dateTime={item.timestamp}>
                  {formatDate(item.timestamp)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <MedicalReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        profileId={active?.astronaut_id}
        isDemoMode={isDemoMode}
      />
    </div>
  );
}
