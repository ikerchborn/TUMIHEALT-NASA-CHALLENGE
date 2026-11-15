import type { DataOrigin, HealthCategory } from './common';

export type IndicatorAvailabilityStatus =
  | 'available_in_nasa_dataset'
  | 'partial_in_nasa_dataset'
  | 'planned_manual_or_device';

export interface ScientificIndicatorMetadata {
  indicator_id: string;
  name: string;
  category: HealthCategory;
  definition: string;
  measurement_unit: string;
  measurement_method: string;
  scientific_relevance: string;
  physiological_context: string;
  potential_influencing_factors: string[];
  data_source: string[];
  evidence_reference: string[];
  limitations: string[];
  availability_status: IndicatorAvailabilityStatus;
}

export interface ExcludedRecordReason {
  record_id: string;
  reason: string;
}

export interface PersonalBaselineResult {
  astronaut_id: string;
  category: HealthCategory;
  indicator_id: string;
  status: 'computed' | 'insufficient_data';
  unit: string | null;
  time_period: {
    from: string | null;
    to: string | null;
  };
  calculation_method: string;
  valid_count: number;
  total_examined: number;
  excluded_records: ExcludedRecordReason[];
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  standard_deviation: number | null;
  measurement_frequency_per_day: number | null;
  completeness_ratio: number;
  freshness_days: number | null;
  period_comparison: {
    earlier_mean: number | null;
    recent_mean: number | null;
    absolute_change: number | null;
    percentage_change: number | null;
    direction: 'increase' | 'decrease' | 'stable' | 'insufficient_data';
  };
  input_record_ids: string[];
  limitations: string[];
}

export type InsightType =
  | 'baseline_deviation'
  | 'trend_direction'
  | 'sleep_change'
  | 'cardiovascular_variation'
  | 'insufficient_data'
  | 'outdated_measurements'
  | 'data_quality_issue';

export type InsightSeverity = 'info' | 'attention' | 'warning';

export type EvidenceQuality = 'high' | 'moderate' | 'low' | 'insufficient';

export interface HealthInsight {
  insight_id: string;
  astronaut_id: string;
  indicator_id: string;
  insight_type: InsightType;
  severity: InsightSeverity;
  description: string;
  observed_facts: string[];
  statistical_findings: string[];
  scientific_interpretations: string[];
  recommendations: string[];
  unknown_information: string[];
  supporting_records: string[];
  calculation_method: string;
  comparison_period: {
    from: string | null;
    to: string | null;
  };
  evidence_quality: EvidenceQuality;
  confidence: 'high' | 'moderate' | 'low';
  limitations: string[];
  scientific_references: string[];
  created_at: string;
}

export type HazardId =
  | 'space_radiation'
  | 'isolation_confinement'
  | 'distance_from_earth'
  | 'gravity_fields'
  | 'hostile_closed_environments';

export interface SpaceHazard {
  hazard_id: HazardId;
  name: string;
  description: string;
  physiological_mechanism: string;
  potential_health_effects: string[];
  related_indicators: string[];
  evidence_strength: 'established' | 'moderate' | 'emerging';
  scientific_references: string[];
  limitations: string[];
  mitigation_information: string[];
}

export type AssessmentStatus =
  | 'INFORMATIONAL'
  | 'MONITOR'
  | 'REVIEW_REQUIRED'
  | 'MEDICAL_ESCALATION'
  | 'INSUFFICIENT_DATA';

export interface SelfAssessmentResult {
  assessment_id: string;
  astronaut_id: string;
  assessment_status: AssessmentStatus;
  indicators_evaluated: string[];
  supporting_records: string[];
  rules_applied: string[];
  explanation: string;
  recommended_next_action: string;
  scientific_references: string[];
  limitations: string[];
  assessment_timestamp: string;
  rule_version: string;
}

export interface GuidanceItem {
  guidance_id: string;
  title: string;
  category: HealthCategory | 'general';
  guidance_type:
    | 'measurement_instruction'
    | 'data_quality'
    | 'follow_up'
    | 'preventive_info'
    | 'repeat_measurement'
    | 'medical_escalation';
  content: string;
  scientific_reference: string;
  version: string;
  review_date: string;
}

export type MissionPhase =
  | 'preflight'
  | 'launch'
  | 'inflight'
  | 'postflight'
  | 'ground_analog'
  | 'unknown';

export type GravityEnvironment =
  | 'microgravity'
  | 'lunar_partial'
  | 'martian_partial'
  | 'earth_1g'
  | 'bedrest_analog'
  | 'unknown';

export interface MissionContext {
  context_id: string;
  astronaut_id: string;
  mission_id: string;
  mission_phase: MissionPhase;
  environment_type: string;
  gravity_environment: GravityEnvironment;
  mission_start_date?: string;
  activity_context?: string;
  sleep_context?: string;
  measurement_context?: string;
  recorded_at: string;
  source: string;
}

export interface MissionContextInput {
  astronaut_id: string;
  mission_id: string;
  mission_phase: MissionPhase;
  environment_type: string;
  gravity_environment: GravityEnvironment;
  mission_start_date?: string;
  activity_context?: string;
  sleep_context?: string;
  measurement_context?: string;
  recorded_at?: string;
  source?: string;
}

export interface LocalBackupPayload {
  schema_version: number;
  exported_at: string;
  astronaut_id: string | 'ALL';
  data_origins_present: DataOrigin[];
  profiles: unknown[];
  blood_records: unknown[];
  sleep_records: unknown[];
  cardiovascular_records: unknown[];
  mission_contexts: unknown[];
  import_batches: unknown[];
  audit_events: unknown[];
  daily_checkins?: unknown[];
  medical_review_requests?: unknown[];
  checksum_sha256: string;
}

export interface ResearchProvenance {
  source_dataset: string;
  source_file: string;
  source_variable: string;
  source_subject_id?: string;
  original_value: number | string | null;
  original_unit: string | null;
  transformation_version: string;
  data_origin: Exclude<DataOrigin, 'SYNTHETIC'>;
}

export interface ResearchDatasetRecord {
  record_id: string;
  category: HealthCategory;
  source_dataset: string;
  source_subject_id: string;
  timestamp: string | null;
  study_timepoint: string | null;
  study_phase: string | null;
  collection_context: string;
  indicator: string;
  value: number | null;
  unit: string;
  reference_range_min?: number | null;
  reference_range_max?: number | null;
  sample_id?: string;
  specimen_type?: string;
  assay?: string;
  quality_status: string;
  data_origin: Exclude<DataOrigin, 'SYNTHETIC'>;
  provenance: ResearchProvenance;
}

export interface ResearchAggregate {
  aggregate_id: string;
  category: HealthCategory;
  source_dataset: string;
  source_sheet: string;
  source_row: number;
  indicator: string;
  value: number | null;
  unit: string;
  group_label: string;
  aggregation_level: string;
  measurement_phase: string;
  statistic_type: string;
  protocol_condition: string;
  sample_size: number | null;
  sd_i: number | null;
  sd_t: number | null;
  p_value: string | null;
  quality_status: 'aggregated_not_individual';
  data_origin: Exclude<DataOrigin, 'SYNTHETIC'>;
  provenance: ResearchProvenance;
}

export interface EtlQualityIssue {
  row_index: number;
  variable: string;
  code: string;
  message: string;
}

export interface EtlProcessingReport {
  dataset: string;
  transformation_version: string;
  total_source_rows: number;
  output_records: number;
  missing_value_count: number;
  flagged_count: number;
  deduplicated_count: number;
  issues: EtlQualityIssue[];
}
