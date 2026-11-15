import type { BaseHealthRecord, DataOrigin, IngestionMethod, QualityStatus } from './common';

/**
 * Blood biomarker record.
 * Category-specific fields are optional because not every assay or manual entry
 * captures all sample metadata.
 */
export interface BloodRecord extends BaseHealthRecord {
  category: 'blood';
  /** Specimen or laboratory sample identifier. */
  sample_id?: string;
  /** Biological specimen type (e.g., "Serum", "Whole Blood", "Plasma"). */
  specimen_type?: string;
  /** Assay or panel name (e.g., "Complete Blood Count", "Comprehensive Metabolic Panel"). */
  assay?: string;
}

export interface BloodRecordInput {
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
  sample_id?: string;
  specimen_type?: string;
  assay?: string;
}
