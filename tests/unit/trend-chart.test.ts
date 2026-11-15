import { describe, expect, it } from 'vitest';
import type { TrendPoint } from '@/types';
import { downsampleTrendPoints } from '@/app/components/TrendChart';

describe('downsampleTrendPoints', () => {
  it('keeps every point below the chart limit', () => {
    const points: TrendPoint[] = [
      {
        record_id: 'a',
        timestamp: '2026-01-01T00:00:00Z',
        indicator: 'heart_rate',
        value: 60,
        unit: 'bpm',
        quality_status: 'verified',
        data_origin: 'SYNTHETIC',
      },
      {
        record_id: 'b',
        timestamp: '2026-01-02T00:00:00Z',
        indicator: 'heart_rate',
        value: null,
        unit: 'bpm',
        quality_status: 'verified',
        data_origin: 'SYNTHETIC',
      },
    ];

    expect(downsampleTrendPoints(points)).toEqual(points);
  });

  it('caps dense charts while preserving bucket extrema and missing-value gaps', () => {
    const points: TrendPoint[] = Array.from({ length: 2_000 }, (_, index) => ({
      record_id: `record-${index}`,
      timestamp: new Date(index * 60_000).toISOString(),
      indicator: 'heart_rate',
      value: index === 10 ? 10_000 : index === 11 ? null : index % 20,
      unit: 'bpm',
      quality_status: 'verified',
      data_origin: 'SYNTHETIC',
    }));

    const sampled = downsampleTrendPoints(points);
    expect(sampled.length).toBeLessThanOrEqual(250);
    expect(sampled.some((point) => point.record_id === 'record-10')).toBe(true);
    expect(sampled.some((point) => point.record_id === 'record-11')).toBe(true);
    expect(sampled.at(-1)?.record_id).toBe('record-1999');
  });
});
