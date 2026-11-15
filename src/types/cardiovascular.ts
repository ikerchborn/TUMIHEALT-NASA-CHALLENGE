import type { BaseHealthRecord, DataOrigin, IngestionMethod, QualityStatus } from './common';

/**
 * Structured blood pressure reading in mmHg.
 */
export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
}

/**
 * Cardiovascular monitoring record.
 * Category-specific fields are optional because different devices or sessions
 * capture different subsets of parameters.
 */
export interface CardiovascularRecord extends BaseHealthRecord {
  category: 'cardiovascular';
  /** Heart rate in beats per minute (bpm), or null if unavailable. */
  heart_rate?: number | null;
  /** Blood pressure reading (systolic/diastolic in mmHg), or null if unavailable. */
  blood_pressure?: BloodPressureReading | null;
  /** Cardiac output in L/min, or null if unavailable. */
  cardiac_output?: number | null;
  /** Activity context during measurement (e.g., "resting", "exercise", "postflight"). */
  activity_context?: string;
  /** Sleep state during measurement (e.g., "awake", "asleep", "unknown"). */
  sleep_state?: string;
  /** Identifier of the monitoring device or sensor. */
  device_id?: string;
}

export interface CardiovascularRecordInput {
  astronaut_id: string;
  timestamp: string;
  indicator: string;
  value: number | null;
  unit: string;
  data_origin: DataOrigin;
  ingestion_method?: IngestionMethod;
  import_batch_id?: string;
  source_dataset?: string;
  quality_status?: QualityStatus;
  heart_rate?: number | null;
  blood_pressure?: BloodPressureReading | null;
  cardiac_output?: number | null;
  activity_context?: string;
  sleep_state?: string;
  device_id?: string;
}
