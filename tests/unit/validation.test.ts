import { describe, expect, it } from 'vitest';
import {
  validateHealthRecordInput,
  validateUnitConsistency,
} from '@/services/validation';
import type { CardiovascularRecord } from '@/types';

describe('Data Validation Layer', () => {
  it('accepts a valid cardiovascular record including numeric zero values', () => {
    const result = validateHealthRecordInput({
      category: 'cardiovascular',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'heart_rate',
      value: 0,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
      heart_rate: 0,
      activity_context: 'resting',
      sleep_state: 'awake',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts explicit null value as missing without treating it as invalid type', () => {
    const result = validateHealthRecordInput({
      category: 'blood',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'albumin',
      value: null,
      unit: 'g/dL',
      data_origin: 'SPACEFLIGHT',
      quality_status: 'missing_value',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects incompatible units without silent conversion', () => {
    const result = validateHealthRecordInput({
      category: 'cardiovascular',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'heart_rate',
      value: 72,
      unit: 'mmHg',
      data_origin: 'SPACEFLIGHT',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INCOMPATIBLE_UNIT')).toBe(true);
  });

  it('rejects invalid timestamps, NaN values, and invalid data_origin', () => {
    const result = validateHealthRecordInput({
      category: 'sleep',
      astronaut_id: '',
      timestamp: 'not-a-date',
      indicator: 'sleep_duration',
      value: Number.NaN,
      unit: '',
      data_origin: 'UNKNOWN' as 'SPACEFLIGHT',
      sleep_efficiency: 120,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining([
        'astronaut_id',
        'timestamp',
        'value',
        'unit',
        'data_origin',
        'sleep_efficiency',
      ]),
    );
  });

  it('rejects sleep_end earlier than sleep_start', () => {
    const result = validateHealthRecordInput({
      category: 'sleep',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T07:00:00Z',
      indicator: 'sleep_duration',
      value: 7.5,
      unit: 'hours',
      data_origin: 'GROUND_ANALOG',
      sleep_start: '2026-11-14T08:00:00Z',
      sleep_end: '2026-11-14T06:00:00Z',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_SLEEP_INTERVAL')).toBe(true);
  });

  it('detects mixed units across records for the same indicator', () => {
    const base: Omit<CardiovascularRecord, 'id' | 'unit'> = {
      category: 'cardiovascular',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'heart_rate',
      value: 70,
      data_origin: 'SYNTHETIC',
      ingestion_method: 'MANUAL',
      source_dataset: 'local',
      quality_status: 'verified',
      created_at: '2026-11-14T10:00:00Z',
      updated_at: '2026-11-14T10:00:00Z',
    };

    const check = validateUnitConsistency([
      { ...base, id: '1', unit: 'bpm' },
      { ...base, id: '2', unit: 'Hz' },
    ]);

    expect(check.valid).toBe(false);
    expect(check.errors[0].code).toBe('INCONSISTENT_UNITS');
  });

  it('validates newly supported vital and countermeasure indicators and numeric bounds', () => {
    const validTemp = validateHealthRecordInput({
      category: 'cardiovascular',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'body_temperature',
      value: 36.7,
      unit: '°C',
      data_origin: 'SYNTHETIC',
    });
    expect(validTemp.valid).toBe(true);

    const invalidSpo2 = validateHealthRecordInput({
      category: 'cardiovascular',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'blood_oxygen_saturation',
      value: 105,
      unit: '%',
      data_origin: 'SYNTHETIC',
    });
    expect(invalidSpo2.valid).toBe(false);
    expect(invalidSpo2.errors.some((e) => e.code === 'OUT_OF_PERCENTAGE_BOUNDS')).toBe(true);
  });
});
