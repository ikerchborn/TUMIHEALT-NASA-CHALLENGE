import type {
  DataOrigin,
  EtlProcessingReport,
  EtlQualityIssue,
  HealthCategory,
  ResearchDatasetRecord,
} from '@/types';
import { parseCsv } from '@/services/ingestion/csvParser';
import { getAmbiguousUnitNote } from '@/services/validation/unitRegistry';

export const TRANSFORMATION_VERSION = '1.0.0';

const MISSING_TOKENS = new Set([
  '',
  'NA',
  'N/A',
  'NULL',
  'NONE',
  'NOT_AVAILABLE',
  'NO DATA',
]);

export function parseNullableEtlNumber(
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const trimmed = raw.trim();
  if (MISSING_TOKENS.has(trimmed.toUpperCase())) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMissingRawValue(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  return MISSING_TOKENS.has(raw.trim().toUpperCase());
}

export function parseSampleTimepoint(sampleName: string): {
  subjectId: string;
  timepoint: string | null;
  phase: string | null;
} {
  const parts = sampleName.trim().split('_');
  const subjectId = parts[0] || 'UNKNOWN';
  const timepointPart = parts.find((p) => /^[LR][+-]\d+$/i.test(p)) ?? null;
  let phase: string | null = null;
  if (timepointPart) {
    phase = timepointPart.toUpperCase().startsWith('L') ? 'preflight' : 'postflight';
  }
  return { subjectId, timepoint: timepointPart, phase };
}

export interface WidePanelVariableSpec {
  valueCol: string;
  minCol: string;
  maxCol: string;
  indicator: string;
  originalUnit: string | null;
  normalizedUnit: string;
}

export interface WidePanelEtlConfig {
  datasetId: string;
  sourceFile: string;
  category: HealthCategory;
  specimenType: string;
  assay: string;
  collectionContext: string;
  dataOrigin: Exclude<DataOrigin, 'SYNTHETIC'>;
  variables: readonly WidePanelVariableSpec[];
}

/**
 * Shared wide-to-long ETL processor for NASA OSDR blood panels (CMP / CBC).
 * Preserves relative timepoints without inventing ISO timestamps, retains
 * missing values as `null`, and flags ambiguous source units.
 */
export function processWidePanelCsv(
  csvText: string,
  config: WidePanelEtlConfig,
): { records: ResearchDatasetRecord[]; report: EtlProcessingReport } {
  const { headers, rows } = parseCsv(csvText);
  const issues: EtlQualityIssue[] = [];
  const records: ResearchDatasetRecord[] = [];
  let missingValueCount = 0;
  let flaggedCount = 0;

  if (!headers.includes('Sample Name')) {
    issues.push({
      row_index: 0,
      variable: 'Sample Name',
      code: 'MISSING_SAMPLE_NAME_COLUMN',
      message: `Expected "Sample Name" column in ${config.datasetId} CSV.`,
    });
    return {
      records: [],
      report: {
        dataset: config.datasetId,
        transformation_version: TRANSFORMATION_VERSION,
        total_source_rows: rows.length,
        output_records: 0,
        missing_value_count: 0,
        flagged_count: 0,
        deduplicated_count: 0,
        issues,
      },
    };
  }

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
    const row = rows[rowIdx];
    const sampleId = (row['Sample Name'] ?? '').trim();
    if (!sampleId) continue;

    const { subjectId, timepoint, phase } = parseSampleTimepoint(sampleId);

    for (const spec of config.variables) {
      const rawVal = row[spec.valueCol];
      const numericVal = parseNullableEtlNumber(rawVal);
      const refMin = parseNullableEtlNumber(row[spec.minCol]);
      const refMax = parseNullableEtlNumber(row[spec.maxCol]);

      if (numericVal === null) {
        missingValueCount += 1;
        if (!isMissingRawValue(rawVal)) {
          issues.push({
            row_index: rowIdx + 1,
            variable: spec.valueCol,
            code: 'NON_NUMERIC_VALUE',
            message: `Unparseable value "${rawVal}" preserved as null.`,
          });
        }
      }

      const ambiguousNote = getAmbiguousUnitNote(
        config.category,
        spec.indicator,
        spec.normalizedUnit,
      );
      let qualityStatus = numericVal === null ? 'missing_value' : 'source_value_present';

      if (ambiguousNote) {
        flaggedCount += 1;
        qualityStatus =
          numericVal === null
            ? 'missing_value; unit_label_requires_verification'
            : 'source_value_present; unit_label_requires_verification';
        issues.push({
          row_index: rowIdx + 1,
          variable: spec.valueCol,
          code: 'UNIT_LABEL_REQUIRES_VERIFICATION',
          message: ambiguousNote,
        });
      }

      records.push({
        record_id: `${config.datasetId}_${sampleId}_${spec.indicator}`,
        category: config.category,
        source_dataset: config.datasetId,
        source_subject_id: subjectId,
        timestamp: null,
        study_timepoint: timepoint,
        study_phase: phase,
        collection_context: config.collectionContext,
        indicator: spec.indicator,
        value: numericVal,
        unit: spec.normalizedUnit,
        reference_range_min: refMin,
        reference_range_max: refMax,
        sample_id: sampleId,
        specimen_type: config.specimenType,
        assay: config.assay,
        quality_status: qualityStatus,
        data_origin: config.dataOrigin,
        provenance: {
          source_dataset: config.datasetId,
          source_file: config.sourceFile,
          source_variable: spec.valueCol,
          source_subject_id: subjectId,
          original_value: isMissingRawValue(rawVal) ? null : (rawVal ?? null),
          original_unit: spec.originalUnit,
          transformation_version: TRANSFORMATION_VERSION,
          data_origin: config.dataOrigin,
        },
      });
    }
  }

  return {
    records,
    report: {
      dataset: config.datasetId,
      transformation_version: TRANSFORMATION_VERSION,
      total_source_rows: rows.length,
      output_records: records.length,
      missing_value_count: missingValueCount,
      flagged_count: flaggedCount,
      deduplicated_count: 0,
      issues,
    },
  };
}
