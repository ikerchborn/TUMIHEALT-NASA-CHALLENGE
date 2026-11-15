import type {
  DataOrigin,
  HealthCategory,
  ValidationIssue,
} from './common';
import type { HealthRecordInput } from './index';

export type ImportBatchStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'partially_confirmed'
  | 'cancelled'
  | 'failed';

export interface ImportBatch {
  batch_id: string;
  profile_id: string;
  category: HealthCategory;
  file_name: string;
  data_origin: DataOrigin;
  source_dataset: string;
  status: ImportBatchStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_record_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CsvInspectionResult {
  file_name: string;
  headers: string[];
  total_rows: number;
  sample_rows: Record<string, string>[];
}

/**
 * Maps TUMI-HEALT target fields to CSV column header names.
 */
export interface CsvColumnMapping {
  timestamp: string;
  indicator: string;
  value: string;
  unit: string;
  astronaut_id?: string;
  quality_status?: string;
  // Blood optional mappings
  sample_id?: string;
  specimen_type?: string;
  assay?: string;
  // Sleep optional mappings
  sleep_start?: string;
  sleep_end?: string;
  sleep_duration?: string;
  sleep_efficiency?: string;
  sleep_latency?: string;
  // Cardiovascular optional mappings
  heart_rate?: string;
  systolic_blood_pressure?: string;
  diastolic_blood_pressure?: string;
  cardiac_output?: string;
  activity_context?: string;
  sleep_state?: string;
  device_id?: string;
}

export interface CsvValidatedRow {
  row_number: number;
  raw: Record<string, string>;
  record_input: HealthRecordInput | null;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface CsvImportPreview {
  batch: ImportBatch;
  headers: string[];
  mapping: CsvColumnMapping;
  rows: CsvValidatedRow[];
  valid_records: HealthRecordInput[];
  invalid_rows: CsvValidatedRow[];
}

export interface CsvImportResult {
  batch: ImportBatch;
  imported_count: number;
  skipped_invalid_count: number;
  imported_record_ids: string[];
}
