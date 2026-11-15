import type { DataOrigin, HealthCategory, HealthRecordInput } from '@/types';

export interface ProcessedDatasetRow {
  astronaut_id?: string;
  subject_id?: string;
  timestamp?: string;
  indicator: string;
  value: string | number | null;
  unit: string;
  data_origin: string;
  source_dataset: string;
  quality_status: string;
  sample_id?: string;
  specimen_type?: string;
  assay?: string;
  sleep_start?: string;
  sleep_end?: string;
  sleep_duration?: string | number | null;
  sleep_efficiency?: string | number | null;
  sleep_latency?: string | number | null;
  activity_context?: string;
  sleep_state?: string;
  device_id?: string;
}

export interface ScientificMappingOutcome {
  mapped: HealthRecordInput | null;
  skipped_reason?: string;
  subject_id: string | null;
  source_dataset: string;
  classified_origin: DataOrigin;
}

const MISSING_TOKENS = new Set(['', 'NA', 'N/A', 'NULL', 'NONE', 'NOT_AVAILABLE']);

export function classifyScientificOrigin(sourceDataset: string): DataOrigin {
  const normalized = sourceDataset.trim().toUpperCase();
  if (normalized.includes('UTMB') || normalized.includes('BEDREST')) {
    return 'GROUND_ANALOG';
  }
  if (
    normalized.includes('OSD-569') ||
    normalized.includes('OSD-575') ||
    normalized.includes('APOLLO') ||
    normalized.includes('AP005')
  ) {
    return 'SPACEFLIGHT';
  }
  return 'SYNTHETIC';
}

function parseScientificNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const trimmed = raw.trim();
  if (MISSING_TOKENS.has(trimmed.toUpperCase())) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanOptionalText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return MISSING_TOKENS.has(trimmed.toUpperCase()) ? undefined : trimmed;
}

/**
 * Maps a single row from a processed NASA research dataset into a TUMI-HEALT
 * `HealthRecordInput` while preserving scientific provenance.
 *
 * - Never invents missing timestamps (skips rows with `NOT_AVAILABLE` timestamps).
 * - Never treats `aggregated_not_individual` cohort summaries as personal records.
 * - Never combines different `subject_id` cohorts into a single astronaut.
 * - Never converts missing values to `0`.
 */
export function mapProcessedDatasetRow(
  row: ProcessedDatasetRow,
  category: HealthCategory,
): ScientificMappingOutcome {
  const classifiedOrigin = classifyScientificOrigin(row.source_dataset);
  const subjectId = cleanOptionalText(row.subject_id) ?? null;

  if (row.quality_status === 'aggregated_not_individual') {
    return {
      mapped: null,
      skipped_reason:
        'Row is a cohort-level aggregate (aggregated_not_individual), not an individual astronaut record.',
      subject_id: subjectId,
      source_dataset: row.source_dataset,
      classified_origin: classifiedOrigin,
    };
  }

  const timestamp = cleanOptionalText(row.timestamp);
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    return {
      mapped: null,
      skipped_reason:
        'Source row lacks an absolute ISO timestamp; timestamps are never invented.',
      subject_id: subjectId,
      source_dataset: row.source_dataset,
      classified_origin: classifiedOrigin,
    };
  }

  if (!subjectId) {
    return {
      mapped: null,
      skipped_reason:
        'Source row lacks an individual subject_id; cohorts are never merged.',
      subject_id: null,
      source_dataset: row.source_dataset,
      classified_origin: classifiedOrigin,
    };
  }

  const unit = cleanOptionalText(row.unit) ?? 'dimensionless';
  const value = parseScientificNumber(row.value);

  const base = {
    astronaut_id: `ref_${row.source_dataset}_${subjectId}`,
    timestamp,
    indicator: row.indicator.trim(),
    value,
    unit,
    data_origin: classifiedOrigin,
    ingestion_method: 'CSV_IMPORT' as const,
    source_dataset: row.source_dataset,
    quality_status: value === null ? 'missing_value' : row.quality_status || 'verified',
  };

  if (category === 'blood') {
    return {
      mapped: {
        ...base,
        category: 'blood',
        sample_id: cleanOptionalText(row.sample_id),
        specimen_type: cleanOptionalText(row.specimen_type),
        assay: cleanOptionalText(row.assay),
      },
      subject_id: subjectId,
      source_dataset: row.source_dataset,
      classified_origin: classifiedOrigin,
    };
  }

  if (category === 'sleep') {
    return {
      mapped: {
        ...base,
        category: 'sleep',
        sleep_start: cleanOptionalText(row.sleep_start) ?? null,
        sleep_end: cleanOptionalText(row.sleep_end) ?? null,
        sleep_duration: parseScientificNumber(row.sleep_duration),
        sleep_efficiency: parseScientificNumber(row.sleep_efficiency),
        sleep_latency: parseScientificNumber(row.sleep_latency),
      },
      subject_id: subjectId,
      source_dataset: row.source_dataset,
      classified_origin: classifiedOrigin,
    };
  }

  return {
    mapped: {
      ...base,
      category: 'cardiovascular',
      activity_context: cleanOptionalText(row.activity_context),
      sleep_state: cleanOptionalText(row.sleep_state),
      device_id: cleanOptionalText(row.device_id),
    },
    subject_id: subjectId,
    source_dataset: row.source_dataset,
    classified_origin: classifiedOrigin,
  };
}
