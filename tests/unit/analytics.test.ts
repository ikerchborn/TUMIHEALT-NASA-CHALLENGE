import { describe, expect, it } from 'vitest';
import {
  compareLatestMeasurements,
  identifyMissingMeasurements,
  summarizeDataQuality,
  summarizeIndicatorRecords,
} from '@/services/analytics';
import type { SleepRecord } from '@/types';

function makeSleepRecord(
  id: string,
  timestamp: string,
  value: number | null,
): SleepRecord {
  return {
    id,
    category: 'sleep',
    astronaut_id: 'astro-01',
    timestamp,
    indicator: 'sleep_duration',
    value,
    unit: 'hours',
    data_origin: 'GROUND_ANALOG',
    ingestion_method: 'MANUAL',
    source_dataset: 'local_manual_entry',
    quality_status: value === null ? 'missing_value' : 'verified',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

describe('Analytics Engine', () => {
  it('computes average, min, max, missing count, and period comparison', () => {
    const records = [
      makeSleepRecord('1', '2026-11-10T07:00:00Z', 6.0),
      makeSleepRecord('2', '2026-11-11T07:00:00Z', null),
      makeSleepRecord('3', '2026-11-12T07:00:00Z', 7.5),
    ];

    const summary = summarizeIndicatorRecords(
      'astro-01',
      'sleep',
      'sleep_duration',
      records,
    );

    expect(summary.total_records).toBe(3);
    expect(summary.valid_numeric_count).toBe(2);
    expect(summary.missing_count).toBe(1);
    expect(summary.average).toBe(6.75);
    expect(summary.min).toBe(6.0);
    expect(summary.max).toBe(7.5);
    expect(summary.comparison.previous_value).toBe(6.0);
    expect(summary.comparison.latest_value).toBe(7.5);
    expect(summary.comparison.absolute_change).toBe(1.5);
    expect(summary.comparison.percentage_change).toBe(25);
    expect(summary.points).toHaveLength(3);
  });

  it('distinguishes numeric zero from missing values and avoids division by zero', () => {
    const records = [
      makeSleepRecord('1', '2026-11-10T07:00:00Z', 0),
      makeSleepRecord('2', '2026-11-11T07:00:00Z', 5),
      makeSleepRecord('3', '2026-11-12T07:00:00Z', null),
    ];

    expect(identifyMissingMeasurements(records)).toHaveLength(1);
    const quality = summarizeDataQuality(records);
    expect(quality.numeric_count).toBe(2);
    expect(quality.zero_count).toBe(1);
    expect(quality.missing_count).toBe(1);

    const comparison = compareLatestMeasurements(records.slice(0, 2));
    expect(comparison.absolute_change).toBe(5);
    expect(comparison.percentage_change).toBeNull();
  });
});
