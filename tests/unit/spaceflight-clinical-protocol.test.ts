import { describe, expect, it } from 'vitest';
import {
  calculatePersonalBaselineFromRecords,
  evaluateIndicatorClinicalSeverity,
  evaluateMultiSystemConsensus,
  evaluateSelfAssessmentFromRecords,
  formatClinicalUnit,
  formatPercentageShift,
  getSpaceflightProtocol,
} from '@/services';
import type { BloodRecord, CardiovascularRecord, SleepRecord } from '@/types';

function makeSleepRecord(id: string, ts: string, hours: number | null): SleepRecord {
  return {
    id,
    category: 'sleep',
    astronaut_id: 'astro-test',
    timestamp: ts,
    indicator: 'sleep_duration',
    value: hours,
    unit: 'hours',
    sleep_duration: hours,
    data_origin: 'SYNTHETIC',
    ingestion_method: 'CSV_IMPORT',
    source_dataset: 'test',
    quality_status: hours === null ? 'missing_value' : 'verified',
    created_at: ts,
    updated_at: ts,
  };
}

function makeBpRecord(
  id: string,
  ts: string,
  systolic: number,
  diastolic: number,
): CardiovascularRecord {
  return {
    id,
    category: 'cardiovascular',
    astronaut_id: 'astro-test',
    timestamp: ts,
    indicator: 'systolic_blood_pressure',
    value: systolic,
    unit: 'mmHg',
    blood_pressure: { systolic, diastolic },
    data_origin: 'SYNTHETIC',
    ingestion_method: 'CSV_IMPORT',
    source_dataset: 'test',
    quality_status: 'verified',
    created_at: ts,
    updated_at: ts,
  };
}

function makeHgbRecord(id: string, ts: string, gdl: number): BloodRecord {
  return {
    id,
    category: 'blood',
    astronaut_id: 'astro-test',
    timestamp: ts,
    indicator: 'hemoglobin',
    value: gdl,
    unit: 'g/dL',
    data_origin: 'SYNTHETIC',
    ingestion_method: 'CSV_IMPORT',
    source_dataset: 'test',
    quality_status: 'verified',
    created_at: ts,
    updated_at: ts,
  };
}

describe('Spaceflight Clinical Protocol & Severity System', () => {
  it('formats percentage shifts strictly to 1 decimal place and normalizes sleep units to hrs', () => {
    expect(formatPercentageShift(-20.61234567890123)).toBe('-20.6%');
    expect(formatPercentageShift(19.389123456789)).toBe('+19.4%');
    expect(formatPercentageShift(-10.349999999)).toBe('-10.3%');
    expect(formatPercentageShift(null)).toBeNull();

    expect(formatClinicalUnit('hours', 'sleep_duration')).toBe('hrs');
    expect(formatClinicalUnit('mmHg', 'systolic_blood_pressure')).toBe('mmHg');
  });

  it('classifies elevated blood pressure (134/85 mmHg) as Elevated / Monitor (Amber)', () => {
    const bpRecords = [
      makeBpRecord('bp1', '2026-10-01T08:00:00Z', 120, 76),
      makeBpRecord('bp2', '2026-10-05T08:00:00Z', 122, 78),
      makeBpRecord('bp3', '2026-10-10T08:00:00Z', 122, 78),
      makeBpRecord('bp4', '2026-10-15T08:00:00Z', 134, 85),
    ];
    const baseline = calculatePersonalBaselineFromRecords(bpRecords, {
      astronaut_id: 'astro-test',
      category: 'cardiovascular',
      indicator: 'systolic_blood_pressure',
    });
    const evalResult = evaluateIndicatorClinicalSeverity({
      indicator: 'systolic_blood_pressure',
      category: 'cardiovascular',
      latestValue: 134,
      diastolicValue: 85,
      baseline,
      assessmentStatus: 'INFORMATIONAL',
    });

    expect(evalResult.severity).toBe('attention');
    expect(evalResult.badgeLabel).toBe('Elevated / Monitor');
  });

  it('triggers Flight Surgeon Alert (Red) when Hemoglobin drops below 12.0 g/dL', () => {
    const hgbRecords = [
      makeHgbRecord('h1', '2026-10-01T08:00:00Z', 13.8),
      makeHgbRecord('h2', '2026-10-10T08:00:00Z', 13.5),
      makeHgbRecord('h3', '2026-10-20T08:00:00Z', 12.9),
      makeHgbRecord('h4', '2026-10-30T08:00:00Z', 11.8),
    ];
    const baseline = calculatePersonalBaselineFromRecords(hgbRecords, {
      astronaut_id: 'astro-test',
      category: 'blood',
      indicator: 'hemoglobin',
    });
    const evalResult = evaluateIndicatorClinicalSeverity({
      indicator: 'hemoglobin',
      category: 'blood',
      latestValue: 11.8,
      baseline,
      assessmentStatus: 'INFORMATIONAL',
    });

    expect(evalResult.severity).toBe('alert');
    expect(evalResult.badgeLabel).toBe('Action / Flight Surgeon Alert');
  });

  it('correlates multiple deviated systems in Mission Health Consensus and adapts by environment', () => {
    const issConsensus = evaluateMultiSystemConsensus({
      environment: 'iss-microgravity',
      sleepHours: 5.05,
      sleepPctChange: -20.6,
      sleepSeverity: 'attention',
      heartRateBpm: 81,
      heartRatePctChange: 19.4,
      heartRateSeverity: 'attention',
      systolicMmHg: 134,
      diastolicMmHg: 85,
      bpPctChange: 8.2,
      bpSeverity: 'attention',
      hemoglobinGdL: 12.38,
      hemoglobinPctChange: -10.3,
      hemoglobinSeverity: 'attention',
    });

    expect(issConsensus.overallSeverity).toBe('alert');
    expect(issConsensus.overallBadgeLabel).toBe('Action / Flight Surgeon Alert');
    expect(issConsensus.synthesizedDiagnosis).toContain('-20.6%');
    expect(issConsensus.synthesizedDiagnosis).toContain('+19.4%');
    expect(issConsensus.synthesizedDiagnosis).toContain('134/85 mmHg');
    expect(issConsensus.missionRoutinePrompt.length).toBeGreaterThanOrEqual(3);
    expect(issConsensus.flightSurgeonTrigger).toContain('12.0 g/dL');

    const lunarProtocol = getSpaceflightProtocol('sleep_duration', 'sleep', 'lunar-base');
    const marsProtocol = getSpaceflightProtocol('sleep_duration', 'sleep', 'mars-transit');
    expect(lunarProtocol.spaceflightContext).not.toBe(marsProtocol.spaceflightContext);
  });

  it('replaces software-debugging next steps with NASA spaceflight countermeasures in selfAssessmentEngine', () => {
    const records = [
      makeSleepRecord('s1', '2026-11-01T08:00:00Z', 7.5),
      makeSleepRecord('s2', '2026-11-02T08:00:00Z', null),
      makeSleepRecord('s3', '2026-11-03T08:00:00Z', 7.4),
      makeSleepRecord('s4', '2026-11-04T08:00:00Z', 7.6),
    ];
    const result = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-test',
      category: 'sleep',
      indicator: 'sleep_duration',
      referenceDate: '2026-11-05T08:00:00Z',
    });

    expect(result.recommended_next_action).not.toContain('Review excluded entries');
    expect(result.recommended_next_action).toContain('NASA Circadian Light Protocol');
  });
});
