import type {
  DateRangeFilter,
  ExcludedRecordReason,
  HealthCategory,
  HealthRecord,
  PersonalBaselineResult,
} from '@/types';
import { queryRecords } from '@/services/storage';

export interface ComputeBaselineOptions {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  dateRange?: DateRangeFilter;
  minSamples?: number;
  referenceDate?: string;
}

function computeMedian(sortedValues: number[]): number {
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  return sortedValues[mid];
}

function computeStandardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Pure calculation of a personal historical baseline from a set of records
 * belonging to a single astronaut, category, and indicator.
 *
 * - Excludes missing (`null`), non-finite, and `aggregated_not_individual` records.
 * - Refuses to mix incompatible units (excludes records whose unit differs from
 *   the primary unit established by the first valid record).
 * - Returns `status: 'insufficient_data'` if fewer than `minSamples` valid
 *   measurements are available.
 */
export function calculatePersonalBaselineFromRecords(
  records: readonly HealthRecord[],
  options: ComputeBaselineOptions,
): PersonalBaselineResult {
  const minSamples = options.minSamples ?? 3;
  const refMs = options.referenceDate
    ? Date.parse(options.referenceDate)
    : Date.now();

  const fromMs = options.dateRange?.from
    ? Date.parse(options.dateRange.from)
    : undefined;
  const toMs = options.dateRange?.to ? Date.parse(options.dateRange.to) : undefined;

  const scoped = records.filter((r) => {
      if (
        r.astronaut_id !== options.astronaut_id ||
        r.category !== options.category ||
        r.indicator !== options.indicator
      ) {
        return false;
      }
      if (fromMs !== undefined && !Number.isNaN(fromMs)) {
        const ts = Date.parse(r.timestamp);
        if (Number.isNaN(ts) || ts < fromMs) return false;
      }
      if (toMs !== undefined && !Number.isNaN(toMs)) {
        const ts = Date.parse(r.timestamp);
        if (Number.isNaN(ts) || ts > toMs) return false;
      }
      return true;
    });
  let previousTimestamp = scoped.length > 0 ? Date.parse(scoped[0].timestamp) : 0;
  for (let index = 1; index < scoped.length; index += 1) {
    const currentTimestamp = Date.parse(scoped[index].timestamp);
    if (
      Number.isNaN(previousTimestamp) ||
      Number.isNaN(currentTimestamp) ||
      currentTimestamp < previousTimestamp
    ) {
      scoped.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      break;
    }
    previousTimestamp = currentTimestamp;
  }

  const excluded: ExcludedRecordReason[] = [];
  const validRecords: Array<HealthRecord & { value: number }> = [];
  let primaryUnit: string | null = null;

  for (const record of scoped) {
    if (record.quality_status === 'aggregated_not_individual') {
      excluded.push({
        record_id: record.id,
        reason: 'Excluded cohort-level aggregate (aggregated_not_individual).',
      });
      continue;
    }
    if (record.value === null || !Number.isFinite(record.value)) {
      excluded.push({
        record_id: record.id,
        reason: 'Excluded missing or non-numeric value.',
      });
      continue;
    }
    const tsMs = Date.parse(record.timestamp);
    if (Number.isNaN(tsMs)) {
      excluded.push({
        record_id: record.id,
        reason: 'Excluded invalid timestamp.',
      });
      continue;
    }
    if (primaryUnit === null) {
      primaryUnit = record.unit;
    } else if (record.unit !== primaryUnit) {
      excluded.push({
        record_id: record.id,
        reason: `Excluded incompatible unit "${record.unit}" (expected "${primaryUnit}").`,
      });
      continue;
    }
    validRecords.push(record as HealthRecord & { value: number });
  }

  const totalExamined = scoped.length;
  const completenessRatio =
    totalExamined > 0 ? validRecords.length / totalExamined : 0;

  const fromTs = validRecords.length > 0 ? validRecords[0].timestamp : null;
  const toTs =
    validRecords.length > 0
      ? validRecords[validRecords.length - 1].timestamp
      : null;

  const freshnessDays =
    toTs !== null
      ? Math.max(0, (refMs - Date.parse(toTs)) / (1000 * 60 * 60 * 24))
      : null;

  const spanDays =
    fromTs && toTs
      ? Math.max(1, (Date.parse(toTs) - Date.parse(fromTs)) / (1000 * 60 * 60 * 24))
      : null;

  const frequencyPerDay =
    spanDays !== null && validRecords.length > 0
      ? validRecords.length / spanDays
      : null;

  const limitations: string[] = [
    'Statistical baseline reflects personal historical measurements only and does not represent a clinical diagnosis.',
  ];
  if (excluded.length > 0) {
    limitations.push(
      `${excluded.length} record(s) were excluded due to missing values, aggregation level, or incompatible units.`,
    );
  }

  if (validRecords.length < minSamples) {
    limitations.push(
      `At least ${minSamples} valid measurements are required to compute a personal baseline (found ${validRecords.length}).`,
    );
    return {
      astronaut_id: options.astronaut_id,
      category: options.category,
      indicator_id: options.indicator,
      status: 'insufficient_data',
      unit: primaryUnit,
      time_period: { from: fromTs, to: toTs },
      calculation_method: 'descriptive_statistics_v1',
      valid_count: validRecords.length,
      total_examined: totalExamined,
      excluded_records: excluded,
      mean: null,
      median: null,
      min: null,
      max: null,
      standard_deviation: null,
      measurement_frequency_per_day: frequencyPerDay,
      completeness_ratio: completenessRatio,
      freshness_days: freshnessDays,
      period_comparison: {
        earlier_mean: null,
        recent_mean: null,
        absolute_change: null,
        percentage_change: null,
        direction: 'insufficient_data',
      },
      input_record_ids: validRecords.map((r) => r.id),
      limitations,
    };
  }

  const values = validRecords.map((r) => r.value);
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const median = computeMedian(sorted);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const standardDeviation = computeStandardDeviation(values, mean);

  const splitIndex = Math.floor(values.length / 2);
  const earlierSlice = values.slice(0, splitIndex);
  const recentSlice = values.slice(splitIndex);

  const earlierMean =
    earlierSlice.length > 0
      ? earlierSlice.reduce((a, b) => a + b, 0) / earlierSlice.length
      : null;
  const recentMean =
    recentSlice.length > 0
      ? recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
      : null;

  const absoluteChange =
    earlierMean !== null && recentMean !== null ? recentMean - earlierMean : null;
  const percentageChange =
    earlierMean !== null && earlierMean !== 0 && absoluteChange !== null
      ? (absoluteChange / earlierMean) * 100
      : null;

  let direction: 'increase' | 'decrease' | 'stable' | 'insufficient_data' =
    'insufficient_data';
  if (absoluteChange !== null) {
    const tolerance = Math.max(1e-9, standardDeviation * 0.1);
    if (Math.abs(absoluteChange) <= tolerance) {
      direction = 'stable';
    } else if (absoluteChange > 0) {
      direction = 'increase';
    } else {
      direction = 'decrease';
    }
  }

  return {
    astronaut_id: options.astronaut_id,
    category: options.category,
    indicator_id: options.indicator,
    status: 'computed',
    unit: primaryUnit,
    time_period: { from: fromTs, to: toTs },
    calculation_method: 'descriptive_statistics_v1',
    valid_count: validRecords.length,
    total_examined: totalExamined,
    excluded_records: excluded,
    mean,
    median,
    min,
    max,
    standard_deviation: standardDeviation,
    measurement_frequency_per_day: frequencyPerDay,
    completeness_ratio: completenessRatio,
    freshness_days: freshnessDays,
    period_comparison: {
      earlier_mean: earlierMean,
      recent_mean: recentMean,
      absolute_change: absoluteChange,
      percentage_change: percentageChange,
      direction,
    },
    input_record_ids: validRecords.map((r) => r.id),
    limitations,
  };
}

/**
 * Queries IndexedDB and computes the personal historical baseline for an astronaut's indicator.
 */
export async function computePersonalBaseline(
  options: ComputeBaselineOptions,
): Promise<PersonalBaselineResult> {
  const records = await queryRecords({
    astronaut_id: options.astronaut_id,
    category: options.category,
    indicator: options.indicator,
    dateRange: options.dateRange,
  });
  return calculatePersonalBaselineFromRecords(records, options);
}
