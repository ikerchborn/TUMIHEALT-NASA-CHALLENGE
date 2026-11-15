import type {
  AssessmentStatus,
  GuidanceItem,
  HealthCategory,
  HealthRecord,
  SelfAssessmentResult,
} from '@/types';
import { calculatePersonalBaselineFromRecords } from '@/services/baseline';
import { queryRecords } from '@/services/storage';

export const ASSESSMENT_RULE_VERSION = '1.0.0';

export const GUIDANCE_CATALOG: readonly GuidanceItem[] = [
  {
    guidance_id: 'guide-repeat-measurement',
    title: 'Repeat Measurement Under Resting Context',
    category: 'cardiovascular',
    guidance_type: 'repeat_measurement',
    content:
      'When a cardiovascular reading differs from your personal baseline, repeat the measurement after 5–10 minutes of quiet rest and record activity_context and sleep_state.',
    scientific_reference: 'https://www.nasa.gov/hrp/hazards',
    version: '1.0.0',
    review_date: '2026-11-14',
  },
  {
    guidance_id: 'guide-sleep-hygiene',
    title: 'Track Sleep Latency and Efficiency Consistently',
    category: 'sleep',
    guidance_type: 'measurement_instruction',
    content:
      'Record sleep duration, latency, and efficiency consistently using the same unit (hours and %) to avoid unit-mismatch exclusions in longitudinal baselines.',
    scientific_reference:
      'https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS',
    version: '1.0.0',
    review_date: '2026-11-14',
  },
  {
    guidance_id: 'guide-blood-context',
    title: 'Document Specimen Type and Assay for Blood Biomarkers',
    category: 'blood',
    guidance_type: 'data_quality',
    content:
      'Blood biomarkers are sampled intermittently. Always record specimen_type, assay, and exact laboratory units without manual unit conversion.',
    scientific_reference: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575',
    version: '1.0.0',
    review_date: '2026-11-14',
  },
  {
    guidance_id: 'guide-medical-escalation',
    title: 'Flight Surgeon / Medical Team Escalation',
    category: 'general',
    guidance_type: 'medical_escalation',
    content:
      'TUMI-HEALT is a self-monitoring tool and does not diagnose medical conditions. If you experience concerning symptoms or persistent deviations, contact your flight surgeon or mission medical officer.',
    scientific_reference:
      'https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/',
    version: '1.0.0',
    review_date: '2026-11-14',
  },
];

export interface RunSelfAssessmentOptions {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  /** Explicit protocol flag when the astronaut reports subjective symptoms. */
  user_reported_symptoms?: boolean;
  /** Explicit protocol flag when the astronaut requests medical escalation. */
  manual_escalation_requested?: boolean;
  staleThresholdDays?: number;
  referenceDate?: string;
}

/**
 * Deterministic, protocol-driven self-assessment engine.
 *
 * - Never invents clinical thresholds or diagnoses diseases.
 * - Returns `INSUFFICIENT_DATA` when valid longitudinal records are lacking.
 * - Escalates to `MEDICAL_ESCALATION` only via explicit protocol flags (e.g.,
 *   user-reported symptoms or manual escalation request), not unverified thresholds.
 */
export function evaluateSelfAssessmentFromRecords(
  records: readonly HealthRecord[],
  options: RunSelfAssessmentOptions,
): SelfAssessmentResult {
  const nowIso = new Date().toISOString();
  const staleDays = options.staleThresholdDays ?? 14;
  const baseline = calculatePersonalBaselineFromRecords(records, {
    astronaut_id: options.astronaut_id,
    category: options.category,
    indicator: options.indicator,
    referenceDate: options.referenceDate,
  });

  const rulesApplied: string[] = [];
  let status: AssessmentStatus = 'INFORMATIONAL';
  let explanation = '';
  let nextAction = '';

  if (options.user_reported_symptoms || options.manual_escalation_requested) {
    status = 'MEDICAL_ESCALATION';
    rulesApplied.push('PROTOCOL_EXPLICIT_SYMPTOM_OR_ESCALATION_FLAG');
    explanation =
      'Medical escalation was triggered by an explicit crew symptom report or manual escalation request.';
    nextAction =
      'Contact the flight surgeon or mission medical team per mission medical protocol. Do not rely on software alone for clinical decisions.';
  } else if (baseline.status === 'insufficient_data') {
    status = 'INSUFFICIENT_DATA';
    rulesApplied.push('RULE_MIN_BASELINE_SAMPLES_REQUIRED');
    explanation = `Only ${baseline.valid_count} valid measurement(s) are available for ${options.indicator}; at least 3 are required for a personal baseline.`;
    nextAction =
      'Record additional valid measurements with consistent units before evaluating personal trends.';
  } else if (
    baseline.freshness_days !== null &&
    baseline.freshness_days > staleDays
  ) {
    status = 'MONITOR';
    rulesApplied.push('RULE_STALE_MEASUREMENT_FRESHNESS_CHECK');
    explanation = `Personal baseline is available (${baseline.valid_count} records), but the most recent measurement is ${baseline.freshness_days.toFixed(1)} days old.`;
    nextAction =
      'Repeat the measurement under documented mission context to refresh your current status.';
  } else if (
    baseline.period_comparison.percentage_change !== null &&
    Math.abs(baseline.period_comparison.percentage_change) >= 20 &&
    baseline.valid_count >= 5
  ) {
    status = 'REVIEW_REQUIRED';
    rulesApplied.push('RULE_STATISTICAL_PERSONAL_BASELINE_SHIFT_20PCT');
    explanation = `Recent ${options.indicator} measurements shifted by ${baseline.period_comparison.percentage_change.toFixed(1)}% relative to your earlier personal baseline mean. This is a statistical observation, not a medical diagnosis.`;
    nextAction =
      'Repeat the measurement under resting context, verify measurement units/device, and review with mission medical support if persistent.';
  } else if (baseline.excluded_records.length > 0) {
    status = 'MONITOR';
    rulesApplied.push('RULE_DATA_QUALITY_EXCLUSIONS_PRESENT');
    explanation = `Personal baseline was computed from ${baseline.valid_count} valid record(s), with ${baseline.excluded_records.length} record(s) excluded due to missing values or unit mismatches.`;
    nextAction =
      'Review excluded entries for missing values or incompatible units and continue routine monitoring.';
  } else {
    status = 'INFORMATIONAL';
    rulesApplied.push('RULE_PERSONAL_BASELINE_WITHIN_STATISTICAL_CONTINUITY');
    explanation = `${baseline.valid_count} valid ${options.indicator} measurements are consistent with your personal historical baseline (mean: ${baseline.mean?.toFixed(2)} ${baseline.unit}).`;
    nextAction = 'Continue routine self-monitoring as scheduled.';
  }

  return {
    assessment_id: `asm_${options.indicator}_${Date.now()}`,
    astronaut_id: options.astronaut_id,
    assessment_status: status,
    indicators_evaluated: [options.indicator],
    supporting_records: baseline.input_record_ids,
    rules_applied: rulesApplied,
    explanation,
    recommended_next_action: nextAction,
    scientific_references: [
      'https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/',
      'https://www.nasa.gov/hrp/hazards',
    ],
    limitations: [
      ...baseline.limitations,
      'Self-assessment states are deterministic statistical/protocol summaries and never constitute a certified medical diagnosis.',
    ],
    assessment_timestamp: nowIso,
    rule_version: ASSESSMENT_RULE_VERSION,
  };
}

export async function runSelfAssessment(
  options: RunSelfAssessmentOptions,
): Promise<SelfAssessmentResult> {
  const records = await queryRecords({
    astronaut_id: options.astronaut_id,
    category: options.category,
    indicator: options.indicator,
  });
  return evaluateSelfAssessmentFromRecords(records, options);
}

export function listGuidanceCatalog(
  category?: HealthCategory | 'general',
): GuidanceItem[] {
  if (!category) return [...GUIDANCE_CATALOG];
  return GUIDANCE_CATALOG.filter((g) => g.category === category);
}
