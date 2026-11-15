import type { BaseHealthRecord, DataOrigin, IngestionMethod, QualityStatus } from './common';

/**
 * Sleep monitoring record.
 * Category-specific fields are optional to accommodate partial actigraphy or manual logs.
 */
export interface SleepRecord extends BaseHealthRecord {
  category: 'sleep';
  /** ISO 8601 timestamp for sleep onset/start, or null if unavailable. */
  sleep_start?: string | null;
  /** ISO 8601 timestamp for wake/end time, or null if unavailable. */
  sleep_end?: string | null;
  /** Total sleep duration in hours (or unit matching record), or null if unavailable. */
  sleep_duration?: number | null;
  /** Sleep efficiency percentage (0-100), or null if unavailable. */
  sleep_efficiency?: number | null;
  /** Time to fall asleep (latency) in minutes or hours, or null if unavailable. */
  sleep_latency?: number | null;
}

export interface SleepRecordInput {
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
  sleep_start?: string | null;
  sleep_end?: string | null;
  sleep_duration?: number | null;
  sleep_efficiency?: number | null;
  sleep_latency?: number | null;
}
