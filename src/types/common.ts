/**
 * Core shared types for the TUMI-HEALT local data architecture.
 *
 * All personal health records are stored locally in the user's browser via
 * IndexedDB. These types distinguish missing values (`null`) from numeric zero (`0`)
 * and preserve measurement units and data provenance without encoding clinical
 * thresholds or medical diagnoses.
 */

export type HealthCategory = 'blood' | 'sleep' | 'cardiovascular';

/**
 * Classification of where a measurement originated:
 * - SPACEFLIGHT: Collected during actual spaceflight missions.
 * - GROUND_ANALOG: Collected in ground-based simulations or bed-rest studies.
 * - SYNTHETIC: Artificially generated data used strictly for development or testing.
 */
export type DataOrigin = 'SPACEFLIGHT' | 'GROUND_ANALOG' | 'SYNTHETIC';

/**
 * Mechanism by which a health record entered local storage.
 * Kept strictly separate from `data_origin` (scientific provenance).
 */
export type IngestionMethod = 'MANUAL' | 'CSV_IMPORT';

export type CanonicalQualityStatus =
  | 'verified'
  | 'pending_review'
  | 'incomplete'
  | 'missing_value';

export type QualityStatus = CanonicalQualityStatus | (string & {});

/**
 * Common metadata shared by all health records across categories.
 */
export interface BaseHealthRecord {
  /** Local unique identifier generated on persistence (UUID v4). */
  id: string;
  /** Local astronaut profile identifier. */
  astronaut_id: string;
  /** ISO 8601 timestamp representing when the measurement was taken. */
  timestamp: string;
  /** Standardized indicator name (e.g., "heart_rate", "sleep_duration", "albumin"). */
  indicator: string;
  /**
   * Numeric measurement value.
   * Explicitly `null` when missing; `0` represents an actual measured zero.
   */
  value: number | null;
  /** Explicit measurement unit (e.g., "bpm", "hours", "g/dL", "%", "mmHg", "L/min"). */
  unit: string;
  /** Origin classification of the measurement. */
  data_origin: DataOrigin;
  /** Ingestion mechanism used to create this record locally. */
  ingestion_method: IngestionMethod;
  /** Optional reference to the CSV import batch that created this record. */
  import_batch_id?: string;
  /** Dataset or local source identifier (e.g., "local_manual_entry", "OSD-575"). */
  source_dataset: string;
  /** Technical quality status of the record. */
  quality_status: QualityStatus;
  /** ISO 8601 timestamp when the record was created locally. */
  created_at: string;
  /** ISO 8601 timestamp when the record was last updated locally. */
  updated_at: string;
}

/**
 * Local astronaut profile stored in IndexedDB.
 * Note: Profile separation provides logical organization on the same browser,
 * not cryptographic security or user authentication.
 */
export interface LocalAstronautProfile {
  astronaut_id: string;
  display_name: string;
  mission_role?: string;
  created_at: string;
  updated_at: string;
}

export interface LocalAstronautProfileInput {
  astronaut_id: string;
  display_name: string;
  mission_role?: string;
}

export interface DateRangeFilter {
  /** Inclusive ISO 8601 start timestamp or date string. */
  from?: string;
  /** Inclusive ISO 8601 end timestamp or date string. */
  to?: string;
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface TrendPoint {
  record_id: string;
  timestamp: string;
  indicator: string;
  value: number | null;
  unit: string;
  quality_status: QualityStatus;
  data_origin: DataOrigin;
}

export interface TrendComparison {
  latest_value: number | null;
  latest_timestamp: string | null;
  previous_value: number | null;
  previous_timestamp: string | null;
  absolute_change: number | null;
  /**
   * Percentage change relative to `previous_value`.
   * Remains `null` when either value is missing or `previous_value === 0`.
   */
  percentage_change: number | null;
}

export interface AnalyticsSummary {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  unit: string | null;
  total_records: number;
  valid_numeric_count: number;
  missing_count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  comparison: TrendComparison;
  points: TrendPoint[];
}
