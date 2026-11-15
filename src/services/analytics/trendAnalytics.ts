import type {
  AnalyticsSummary,
  DateRangeFilter,
  HealthCategory,
  HealthRecord,
  TrendComparison,
  TrendPoint,
} from '@/types';
import { queryRecords } from '@/services/storage';
import { validateUnitConsistency } from '@/services/validation';

/**
 * Filters records to an inclusive date range and returns them sorted chronologically.
 */
export function filterRecordsByDateRange(
  records: readonly HealthRecord[],
  dateRange?: DateRangeFilter,
): HealthRecord[] {
  const fromMs = dateRange?.from ? Date.parse(dateRange.from) : undefined;
  const toMs = dateRange?.to ? Date.parse(dateRange.to) : undefined;

  return records
    .filter((record) => {
      const ts = Date.parse(record.timestamp);
      if (Number.isNaN(ts)) {
        return false;
      }
      if (fromMs !== undefined && !Number.isNaN(fromMs) && ts < fromMs) {
        return false;
      }
      if (toMs !== undefined && !Number.isNaN(toMs) && ts > toMs) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

/**
 * Returns records where `value === null` (explicitly missing measurement).
 * Numeric `0` is NOT treated as missing.
 */
export function identifyMissingMeasurements(
  records: readonly HealthRecord[],
): HealthRecord[] {
  return records.filter((record) => record.value === null);
}

/**
 * Converts sorted records into chart-ready trend points.
 */
export function buildTrendPoints(records: readonly HealthRecord[]): TrendPoint[] {
  const sorted = [...records].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  return sorted.map((record) => ({
    record_id: record.id,
    timestamp: record.timestamp,
    indicator: record.indicator,
    value: record.value,
    unit: record.unit,
    quality_status: record.quality_status,
    data_origin: record.data_origin,
  }));
}

/**
 * Compares the most recent numeric measurement against the immediately preceding
 * numeric measurement. Does not interpret changes clinically.
 */
export function compareLatestMeasurements(
  records: readonly HealthRecord[],
): TrendComparison {
  const numericRecords = [...records]
    .filter((r): r is HealthRecord & { value: number } => r.value !== null)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  if (numericRecords.length === 0) {
    return {
      latest_value: null,
      latest_timestamp: null,
      previous_value: null,
      previous_timestamp: null,
      absolute_change: null,
      percentage_change: null,
    };
  }

  const latest = numericRecords[numericRecords.length - 1];
  if (numericRecords.length === 1) {
    return {
      latest_value: latest.value,
      latest_timestamp: latest.timestamp,
      previous_value: null,
      previous_timestamp: null,
      absolute_change: null,
      percentage_change: null,
    };
  }

  const previous = numericRecords[numericRecords.length - 2];
  const absoluteChange = latest.value - previous.value;
  const percentageChange =
    previous.value !== 0 ? (absoluteChange / previous.value) * 100 : null;

  return {
    latest_value: latest.value,
    latest_timestamp: latest.timestamp,
    previous_value: previous.value,
    previous_timestamp: previous.timestamp,
    absolute_change: absoluteChange,
    percentage_change: percentageChange,
  };
}

/**
 * Computes statistical summary and trend points for a set of records belonging
 * to a single astronaut, category, and indicator.
 *
 * Throws if records contain mixed incompatible units.
 */
export function summarizeIndicatorRecords(
  astronautId: string,
  category: HealthCategory,
  indicator: string,
  records: readonly HealthRecord[],
): AnalyticsSummary {
  const scoped = records
    .filter(
      (r) =>
        r.astronaut_id === astronautId &&
        r.category === category &&
        r.indicator === indicator,
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const unitCheck = validateUnitConsistency(scoped);
  if (!unitCheck.valid) {
    throw new Error(unitCheck.errors.map((e) => e.message).join(' '));
  }

  const numericValues = scoped
    .map((r) => r.value)
    .filter((v): v is number => v !== null);

  const missingCount = scoped.length - numericValues.length;
  const sum = numericValues.reduce((acc, val) => acc + val, 0);

  return {
    astronaut_id: astronautId,
    category,
    indicator,
    unit: scoped.length > 0 ? scoped[0].unit : null,
    total_records: scoped.length,
    valid_numeric_count: numericValues.length,
    missing_count: missingCount,
    average: numericValues.length > 0 ? sum / numericValues.length : null,
    min: numericValues.length > 0 ? Math.min(...numericValues) : null,
    max: numericValues.length > 0 ? Math.max(...numericValues) : null,
    comparison: compareLatestMeasurements(scoped),
    points: buildTrendPoints(scoped),
  };
}

/**
 * Queries IndexedDB for a specific astronaut, category, indicator, and optional
 * date range, then computes the statistical analytics summary.
 */
export async function analyzeIndicatorTrends(params: {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  dateRange?: DateRangeFilter;
}): Promise<AnalyticsSummary> {
  const records = await queryRecords({
    astronaut_id: params.astronaut_id,
    category: params.category,
    indicator: params.indicator,
    dateRange: params.dateRange,
  });

  return summarizeIndicatorRecords(
    params.astronaut_id,
    params.category,
    params.indicator,
    records,
  );
}

export interface DataQualitySummary {
  total_records: number;
  numeric_count: number;
  zero_count: number;
  missing_count: number;
  by_quality_status: Record<string, number>;
  by_data_origin: Record<string, number>;
  by_ingestion_method: Record<string, number>;
}

/**
 * Summarizes technical data quality and provenance distribution across a set of records.
 * Explicitly distinguishes numeric zero (`0`) from missing values (`null`).
 */
export function summarizeDataQuality(
  records: readonly HealthRecord[],
): DataQualitySummary {
  const byQualityStatus: Record<string, number> = {};
  const byDataOrigin: Record<string, number> = {};
  const byIngestionMethod: Record<string, number> = {};
  let numericCount = 0;
  let zeroCount = 0;
  let missingCount = 0;

  for (const record of records) {
    if (record.value === null) {
      missingCount += 1;
    } else {
      numericCount += 1;
      if (record.value === 0) {
        zeroCount += 1;
      }
    }

    byQualityStatus[record.quality_status] =
      (byQualityStatus[record.quality_status] ?? 0) + 1;
    byDataOrigin[record.data_origin] = (byDataOrigin[record.data_origin] ?? 0) + 1;
    byIngestionMethod[record.ingestion_method] =
      (byIngestionMethod[record.ingestion_method] ?? 0) + 1;
  }

  return {
    total_records: records.length,
    numeric_count: numericCount,
    zero_count: zeroCount,
    missing_count: missingCount,
    by_quality_status: byQualityStatus,
    by_data_origin: byDataOrigin,
    by_ingestion_method: byIngestionMethod,
  };
}

export interface CategoryAnalyticsResult {
  astronaut_id: string;
  category: HealthCategory;
  quality: DataQualitySummary;
  indicators: AnalyticsSummary[];
}

/**
 * Performs category-specific analytics across all indicators recorded for an
 * astronaut in a given category and optional date range.
 */
export async function analyzeCategorySummary(params: {
  astronaut_id: string;
  category: HealthCategory;
  dateRange?: DateRangeFilter;
}): Promise<CategoryAnalyticsResult> {
  const records = await queryRecords({
    astronaut_id: params.astronaut_id,
    category: params.category,
    dateRange: params.dateRange,
  });

  const indicatorNames = Array.from(new Set(records.map((r) => r.indicator))).sort();
  const indicators = indicatorNames.map((indicator) =>
    summarizeIndicatorRecords(params.astronaut_id, params.category, indicator, records),
  );

  return {
    astronaut_id: params.astronaut_id,
    category: params.category,
    quality: summarizeDataQuality(records),
    indicators,
  };
}
