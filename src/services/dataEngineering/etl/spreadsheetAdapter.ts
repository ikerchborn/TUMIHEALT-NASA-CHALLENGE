import * as XLSX from 'xlsx';
import type {
  DataOrigin,
  EtlProcessingReport,
  HealthCategory,
  ResearchAggregate,
  ResearchDatasetRecord,
} from '@/types';
import { parseCsv } from '@/services/ingestion/csvParser';
import { decodeUtf8Text } from '@/services/security';
import { getAmbiguousUnitNote } from '@/services/validation/unitRegistry';
import { parseNullableEtlNumber, TRANSFORMATION_VERSION } from './etlUtils';
import { processActigraphyDataset } from './processActigraphyDataset';
import { processApolloDataset } from './processApolloDataset';
import { processCbcDataset } from './processCbcDataset';
import { processCmpDataset } from './processCmpDataset';

export interface ExtractedSheetCsv {
  sheetName: string;
  csvText: string;
}

export interface ExtractSheetsOptions {
  strictPersonalImport?: boolean;
}

export function findFormulaWithoutStoredResult(
  sheet: XLSX.WorkSheet,
): string[] {
  return Object.entries(sheet)
    .filter(
      ([address, cell]) =>
        !address.startsWith('!') &&
        typeof cell === 'object' &&
        cell !== null &&
        'f' in cell &&
        typeof cell.f === 'string' &&
        (!('v' in cell) || cell.v === undefined || cell.v === null || cell.v === ''),
    )
    .map(([address]) => address);
}

/**
 * Extracts CSV text from a `.csv`, extensionless text file, `.xlsx`, or `.xls`
 * workbook in the browser.
 */
export async function extractSheetsFromFile(
  file: File,
  options: ExtractSheetsOptions = {},
): Promise<ExtractedSheetCsv[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const extracted = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (options.strictPersonalImport) {
        const merges = sheet['!merges'] ?? [];
        if (merges.length > 0) {
          throw new Error(
            `Worksheet "${sheetName}" contains ${merges.length} merged cell range(s); first at ${XLSX.utils.encode_range(merges[0])}. Unmerge them before importing.`,
          );
        }
        const formulaCell = findFormulaWithoutStoredResult(sheet);
        if (formulaCell.length > 0) {
          throw new Error(
            `Worksheet "${sheetName}" has ${formulaCell.length} formula(s) without stored results; first at ${formulaCell[0]}. Save the workbook with calculated values before importing.`,
          );
        }
      }
      const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return { sheetName, csvText };
    });
    const sheetsWithData = extracted.filter(({ csvText }) => csvText.trim().length > 0);
    if (options.strictPersonalImport && sheetsWithData.length === 0) {
      throw new Error(
        `The XLSX workbook has 0 readable data sheets (of ${extracted.length} worksheet${extracted.length === 1 ? '' : 's'}). Add a sheet with headers and measurement rows, or upload a CSV/XML file.`,
      );
    }
    return options.strictPersonalImport ? sheetsWithData : extracted;
  }
  const csvText = decodeUtf8Text(await file.arrayBuffer());
  return [{ sheetName: file.name, csvText }];
}

function inferCategoryFromDataset(dataset: string, indicator: string): HealthCategory {
  const ds = dataset.toUpperCase();
  const ind = indicator.toLowerCase();
  if (ds.includes('UTMB') || ds.includes('BRSMACT') || ind.startsWith('sleep_')) {
    return 'sleep';
  }
  if (ds.includes('APOLLO') || ds.includes('AP005') || ind.includes('heart_rate') || ind.includes('blood_pressure')) {
    return 'cardiovascular';
  }
  return 'blood';
}

function inferOriginFromDataset(dataset: string): Exclude<DataOrigin, 'SYNTHETIC'> {
  const ds = dataset.toUpperCase();
  if (ds.includes('UTMB') || ds.includes('BRSMACT') || ds.includes('BEDREST')) {
    return 'GROUND_ANALOG';
  }
  return 'SPACEFLIGHT';
}

/**
 * Processes pre-normalized `data/processed/blood_processed.csv` or
 * `data/processed/sleep_processed.csv` into `ResearchDatasetRecord[]`.
 */
export function processProcessedResearchCsv(
  csvText: string,
  sourceFile: string,
): { records: ResearchDatasetRecord[]; report: EtlProcessingReport } {
  const { rows } = parseCsv(csvText);
  const records: ResearchDatasetRecord[] = [];
  let missingValueCount = 0;
  let flaggedCount = 0;

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const indicator = (row.indicator ?? '').trim();
    const sourceDataset = (row.source_dataset ?? 'NASA_RESEARCH').trim();
    if (!indicator) continue;

    const category = inferCategoryFromDataset(sourceDataset, indicator);
    const dataOrigin = inferOriginFromDataset(sourceDataset);
    const rawTimestamp = (row.timestamp ?? '').trim();
    const timestamp =
      !rawTimestamp || rawTimestamp.toUpperCase() === 'NOT_AVAILABLE' || Number.isNaN(Date.parse(rawTimestamp))
        ? null
        : rawTimestamp;

    const subjectId = (row.subject_id ?? row.source_subject_id ?? 'UNKNOWN').trim();
    const value = parseNullableEtlNumber(row.value);
    if (value === null) missingValueCount += 1;

    const rawUnit = (row.unit ?? '').trim();
    const unit = !rawUnit || rawUnit.toUpperCase() === 'NOT_AVAILABLE' ? 'dimensionless' : rawUnit;
    const qualityStatus = (row.quality_status ?? (value === null ? 'missing_value' : 'source_value_present')).trim();

    if (
      qualityStatus.includes('requires_verification') ||
      getAmbiguousUnitNote(category, indicator, unit)
    ) {
      flaggedCount += 1;
    }

    records.push({
      record_id: `${sourceDataset}_${subjectId}_${timestamp ?? row.relative_timepoint ?? idx}_${indicator}_${idx}`,
      category,
      source_dataset: sourceDataset,
      source_subject_id: subjectId,
      timestamp,
      study_timepoint:
        row.relative_timepoint && row.relative_timepoint.toUpperCase() !== 'NOT_AVAILABLE'
          ? row.relative_timepoint.trim()
          : row.bedrest_day
            ? `BR_Day_${row.bedrest_day.trim()}`
            : null,
      study_phase:
        row.collection_phase && row.collection_phase.toUpperCase() !== 'NOT_AVAILABLE'
          ? row.collection_phase.trim()
          : row.test_phase && row.test_phase.toUpperCase() !== 'NOT_AVAILABLE'
            ? row.test_phase.trim()
            : null,
      collection_context: (row.assay ?? row.source_variant ?? sourceDataset).trim(),
      indicator,
      value,
      unit,
      reference_range_min: parseNullableEtlNumber(row.reference_range_min),
      reference_range_max: parseNullableEtlNumber(row.reference_range_max),
      sample_id: row.sample_id && row.sample_id !== 'NOT_AVAILABLE' ? row.sample_id.trim() : undefined,
      specimen_type:
        row.specimen_type && row.specimen_type !== 'NOT_AVAILABLE' ? row.specimen_type.trim() : undefined,
      assay: row.assay && row.assay !== 'NOT_AVAILABLE' ? row.assay.trim() : undefined,
      quality_status: qualityStatus,
      data_origin: dataOrigin,
      provenance: {
        source_dataset: sourceDataset,
        source_file: (row.source_file ?? sourceFile).trim(),
        source_variable: indicator,
        source_subject_id: subjectId,
        original_value: row.source_value ?? row.value ?? null,
        original_unit: unit,
        transformation_version: TRANSFORMATION_VERSION,
        data_origin: dataOrigin,
      },
    });
  }

  return {
    records,
    report: {
      dataset: records[0]?.source_dataset ?? sourceFile,
      transformation_version: TRANSFORMATION_VERSION,
      total_source_rows: rows.length,
      output_records: records.length,
      missing_value_count: missingValueCount,
      flagged_count: flaggedCount,
      deduplicated_count: 0,
      issues: [],
    },
  };
}

export interface AutoSheetProcessResult {
  kind: 'research' | 'aggregate' | 'skipped';
  label: string;
  researchRecords: ResearchDatasetRecord[];
  aggregates: ResearchAggregate[];
  report?: EtlProcessingReport;
}

/**
 * Automatically detects the NASA dataset format of a CSV or Excel sheet and
 * routes it to the corresponding ETL processor.
 */
export function autoProcessNasaSheet(
  csvText: string,
  sheetOrFileName: string,
): AutoSheetProcessResult {
  const { headers } = parseCsv(csvText);
  const headerSet = new Set(headers.map((h) => h.trim()));

  if (headerSet.has('Sample Name') && headerSet.has('albumin_value_gram_per_deciliter')) {
    const res = processCmpDataset(csvText, sheetOrFileName);
    return {
      kind: 'research',
      label: `OSD-575 CMP (${sheetOrFileName})`,
      researchRecords: res.records,
      aggregates: [],
      report: res.report,
    };
  }

  if (headerSet.has('Sample Name') && headerSet.has('absolute_basophils_value_cells_per_microliter')) {
    const res = processCbcDataset(csvText, sheetOrFileName);
    return {
      kind: 'research',
      label: `OSD-569 CBC (${sheetOrFileName})`,
      researchRecords: res.records,
      aggregates: [],
      report: res.report,
    };
  }

  if (headerSet.has('Subject') && headerSet.has('Sleep Latency (hours)') && headerSet.has('Sleep Duration (hours)')) {
    const res = processActigraphyDataset(csvText, sheetOrFileName);
    return {
      kind: 'research',
      label: `UTMB Actigraphy (${sheetOrFileName})`,
      researchRecords: res.researchRecords,
      aggregates: [],
      report: res.report,
    };
  }

  if (headerSet.has('aggregation_level') && headerSet.has('group_label')) {
    const res = processApolloDataset(csvText, sheetOrFileName);
    return {
      kind: 'aggregate',
      label: `Apollo AP005 (${sheetOrFileName})`,
      researchRecords: [],
      aggregates: res.aggregates,
      report: res.report,
    };
  }

  if (
    headerSet.has('source_dataset') &&
    headerSet.has('indicator') &&
    headerSet.has('value') &&
    headerSet.has('unit')
  ) {
    const res = processProcessedResearchCsv(csvText, sheetOrFileName);
    return {
      kind: 'research',
      label: `Processed NASA CSV (${sheetOrFileName})`,
      researchRecords: res.records,
      aggregates: [],
      report: res.report,
    };
  }

  return {
    kind: 'skipped',
    label: `Skipped metadata/non-ETL sheet (${sheetOrFileName})`,
    researchRecords: [],
    aggregates: [],
  };
}
