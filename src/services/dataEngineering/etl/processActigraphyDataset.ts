import type {
  EtlProcessingReport,
  EtlQualityIssue,
  HealthRecordInput,
  ResearchDatasetRecord,
} from '@/types';
import { parseCsv } from '@/services/ingestion/csvParser';
import {
  isMissingRawValue,
  parseNullableEtlNumber,
  TRANSFORMATION_VERSION,
} from './etlUtils';

export const ACTIGRAPHY_SOURCE_FILE =
  'data/raw/sleep/UTMB_Campaign_1/BRSMAct_1794688595631/BRSMACT_Campaign_1_Actigraphy/BRSMACT_Campagin_1_Actigraphy';

/**
 * Converts `M/D/YYYY` (e.g. `9/7/2004`) to ISO `YYYY-MM-DD` (`2004-09-07`).
 * Returns `null` if the input is not a valid date.
 */
function parseUsDateToIso(rawDate: string | undefined): string | null {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Converts `H:mm`, `H:mm:ss`, or `"0"` into decimal hours.
 * Returns `{ value, malformed }` so dot-formatted anomalies (e.g. `6.56`)
 * are flagged rather than silently misinterpreted.
 */
function parseDurationToDecimalHours(raw: string | undefined): {
  value: number | null;
  malformed: boolean;
} {
  if (isMissingRawValue(raw)) {
    return { value: null, malformed: false };
  }
  const trimmed = raw!.trim();
  if (trimmed === '0') {
    return { value: 0, malformed: false };
  }
  const hmsMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!hmsMatch) {
    return { value: null, malformed: true };
  }
  const hours = Number(hmsMatch[1]);
  const minutes = Number(hmsMatch[2]);
  const seconds = hmsMatch[3] ? Number(hmsMatch[3]) : 0;
  if (minutes >= 60 || seconds >= 60) {
    return { value: null, malformed: true };
  }
  return {
    value: hours + minutes / 60 + seconds / 3600,
    malformed: false,
  };
}

interface ActigraphyIndicatorSpec {
  column: string;
  indicator: 'sleep_latency' | 'sleep_duration' | 'sleep_efficiency';
  unit: string;
  originalUnit: string;
  kind: 'hhmm' | 'percent';
}

const ACTIGRAPHY_SPECS: readonly ActigraphyIndicatorSpec[] = [
  {
    column: 'Sleep Latency (hours)',
    indicator: 'sleep_latency',
    unit: 'hours',
    originalUnit: 'HH:mm',
    kind: 'hhmm',
  },
  {
    column: 'Sleep Duration (hours)',
    indicator: 'sleep_duration',
    unit: 'hours',
    originalUnit: 'HH:mm:ss',
    kind: 'hhmm',
  },
  {
    column: 'Sleep Efficiency (%)',
    indicator: 'sleep_efficiency',
    unit: '%',
    originalUnit: '%',
    kind: 'percent',
  },
];

/**
 * Transforms one or more raw UTMB Campaign 1 Actigraphy (BRSMACT) CSV texts
 * into deduplicated `ResearchDatasetRecord[]` and `HealthRecordInput[]`
 * (classified as `GROUND_ANALOG`).
 */
export function processActigraphyDataset(
  csvTexts: string | readonly string[],
  sourceFile: string = ACTIGRAPHY_SOURCE_FILE,
): {
  researchRecords: ResearchDatasetRecord[];
  healthRecordInputs: HealthRecordInput[];
  report: EtlProcessingReport;
} {
  const inputs = Array.isArray(csvTexts) ? csvTexts : [csvTexts];
  const seenKeys = new Set<string>();
  const researchRecords: ResearchDatasetRecord[] = [];
  const healthRecordInputs: HealthRecordInput[] = [];
  const issues: EtlQualityIssue[] = [];

  let totalSourceRows = 0;
  let missingValueCount = 0;
  let flaggedCount = 0;
  let deduplicatedCount = 0;

  for (const csvText of inputs) {
    const { rows } = parseCsv(csvText);
    totalSourceRows += rows.length;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
      const row = rows[rowIdx];
      const subjectId = (row.Subject ?? '').trim();
      const isoDate = parseUsDateToIso(row.Date);
      const testPhase = (row.Test_Phase ?? '').trim() || null;
      const brDay = (row.BR_Day ?? '').trim();
      const notes = (row.Notes ?? '').trim();

      if (!subjectId || !isoDate) {
        flaggedCount += 1;
        issues.push({
          row_index: rowIdx + 1,
          variable: 'Subject/Date',
          code: 'INVALID_ROW_KEY',
          message: `Skipped row with missing Subject ("${subjectId}") or unparseable Date ("${row.Date ?? ''}").`,
        });
        continue;
      }

      for (const spec of ACTIGRAPHY_SPECS) {
        const dedupKey = `${subjectId}|${isoDate}|${testPhase ?? ''}|${brDay}|${spec.indicator}`;
        if (seenKeys.has(dedupKey)) {
          deduplicatedCount += 1;
          continue;
        }
        seenKeys.add(dedupKey);

        const rawVal = row[spec.column];
        let numericVal: number | null = null;
        let qualityStatus = 'source_value_present';

        if (spec.kind === 'hhmm') {
          const parsed = parseDurationToDecimalHours(rawVal);
          numericVal = parsed.value;
          if (parsed.malformed) {
            flaggedCount += 1;
            qualityStatus = 'malformed_duration_value';
            issues.push({
              row_index: rowIdx + 1,
              variable: spec.column,
              code: 'MALFORMED_DURATION',
              message: `Unparseable duration "${rawVal}" for ${subjectId} on ${isoDate}; preserved as null.`,
            });
          } else if (numericVal === null) {
            missingValueCount += 1;
            qualityStatus = 'missing_value';
          } else {
            qualityStatus = 'source_value_present; converted_from_HH_mm_to_decimal_hours';
          }
        } else {
          numericVal = parseNullableEtlNumber(rawVal);
          if (numericVal === null) {
            missingValueCount += 1;
            qualityStatus = 'missing_value';
          }
        }

        const collectionContext = `UTMB Bed-Rest Campaign 1 | Phase: ${testPhase ?? 'N/A'} | BR_Day: ${brDay || 'N/A'}${notes && notes.toUpperCase() !== 'NA' ? ` | Notes: ${notes}` : ''}`;

        researchRecords.push({
          record_id: `BRSMACT_${subjectId}_${isoDate}_${spec.indicator}`,
          category: 'sleep',
          source_dataset: 'UTMB_Campaign_1_BRSMACT',
          source_subject_id: subjectId,
          timestamp: isoDate,
          study_timepoint: brDay ? `BR_Day_${brDay}` : null,
          study_phase: testPhase,
          collection_context: collectionContext,
          indicator: spec.indicator,
          value: numericVal,
          unit: spec.unit,
          quality_status: qualityStatus,
          data_origin: 'GROUND_ANALOG',
          provenance: {
            source_dataset: 'UTMB_Campaign_1_BRSMACT',
            source_file: sourceFile,
            source_variable: spec.column,
            source_subject_id: subjectId,
            original_value: isMissingRawValue(rawVal) ? null : (rawVal ?? null),
            original_unit: spec.originalUnit,
            transformation_version: TRANSFORMATION_VERSION,
            data_origin: 'GROUND_ANALOG',
          },
        });

        healthRecordInputs.push({
          astronaut_id: `ref_UTMB_Campaign_1_BRSMACT_${subjectId}`,
          category: 'sleep',
          timestamp: isoDate,
          indicator: spec.indicator,
          value: numericVal,
          unit: spec.unit,
          data_origin: 'GROUND_ANALOG',
          ingestion_method: 'CSV_IMPORT',
          source_dataset: 'UTMB_Campaign_1_BRSMACT',
          quality_status: numericVal === null ? 'missing_value' : 'verified',
          sleep_duration: spec.indicator === 'sleep_duration' ? numericVal : undefined,
          sleep_efficiency: spec.indicator === 'sleep_efficiency' ? numericVal : undefined,
          sleep_latency: spec.indicator === 'sleep_latency' ? numericVal : undefined,
        });
      }
    }
  }

  return {
    researchRecords,
    healthRecordInputs,
    report: {
      dataset: 'UTMB_Campaign_1_BRSMACT',
      transformation_version: TRANSFORMATION_VERSION,
      total_source_rows: totalSourceRows,
      output_records: researchRecords.length,
      missing_value_count: missingValueCount,
      flagged_count: flaggedCount,
      deduplicated_count: deduplicatedCount,
      issues,
    },
  };
}
