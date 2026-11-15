import type {
  EtlProcessingReport,
  EtlQualityIssue,
  ResearchAggregate,
} from '@/types';
import { parseCsv } from '@/services/ingestion/csvParser';
import { parseNullableEtlNumber, TRANSFORMATION_VERSION } from './etlUtils';

export const APOLLO_DEFAULT_SOURCE_FILE =
  'data/processed/cardiovascular_processed.csv';

/**
 * Processes Apollo AP005 cohort-level cardiovascular summaries into
 * `ResearchAggregate` records.
 *
 * Apollo AP005 tables contain group means, standard deviations, p-values,
 * and percentage changes — never individual astronaut measurements.
 */
export function processApolloDataset(
  csvText: string,
  sourceFile: string = APOLLO_DEFAULT_SOURCE_FILE,
): { aggregates: ResearchAggregate[]; report: EtlProcessingReport } {
  const { rows } = parseCsv(csvText);
  const aggregates: ResearchAggregate[] = [];
  const issues: EtlQualityIssue[] = [];
  let missingValueCount = 0;

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const indicator = (row.indicator ?? '').trim();
    if (!indicator) continue;

    const value = parseNullableEtlNumber(row.value);
    if (value === null) {
      missingValueCount += 1;
    }

    const rowSourceFile = (row.source_file ?? sourceFile).trim();
    const sourceSheet = (row.source_sheet ?? 'unknown_sheet').trim();
    const sourceRow = parseNullableEtlNumber(row.source_row) ?? idx + 1;
    const pValueRaw = (row.p_value ?? '').trim();
    const pValue =
      !pValueRaw || pValueRaw.toUpperCase() === 'NOT_AVAILABLE'
        ? null
        : pValueRaw;

    aggregates.push({
      aggregate_id: `Apollo_AP005_${sourceSheet.replace(/\s+/g, '_')}_r${sourceRow}_${indicator}_${idx}`,
      category: 'cardiovascular',
      source_dataset: (row.source_dataset ?? 'Apollo_AP005').trim(),
      source_sheet: sourceSheet,
      source_row: sourceRow,
      indicator,
      value,
      unit: (row.unit ?? 'dimensionless').trim(),
      group_label: (row.group_label ?? 'Apollo cohort').trim(),
      aggregation_level: (row.aggregation_level ?? 'cohort_summary').trim(),
      measurement_phase: (row.measurement_phase ?? 'unspecified').trim(),
      statistic_type: (row.statistic_type ?? 'summary_statistic').trim(),
      protocol_condition: (row.source_column_context ?? row.activity_context ?? '').trim(),
      sample_size: parseNullableEtlNumber(row.sample_size),
      sd_i: parseNullableEtlNumber(row.sd_i),
      sd_t: parseNullableEtlNumber(row.sd_t),
      p_value: pValue,
      quality_status: 'aggregated_not_individual',
      data_origin: 'SPACEFLIGHT',
      provenance: {
        source_dataset: (row.source_dataset ?? 'Apollo_AP005').trim(),
        source_file: rowSourceFile,
        source_variable: indicator,
        original_value: row.source_value ?? row.value ?? null,
        original_unit: row.unit ?? null,
        transformation_version: TRANSFORMATION_VERSION,
        data_origin: 'SPACEFLIGHT',
      },
    });
  }

  return {
    aggregates,
    report: {
      dataset: 'Apollo_AP005',
      transformation_version: TRANSFORMATION_VERSION,
      total_source_rows: rows.length,
      output_records: aggregates.length,
      missing_value_count: missingValueCount,
      flagged_count: 0,
      deduplicated_count: 0,
      issues,
    },
  };
}
