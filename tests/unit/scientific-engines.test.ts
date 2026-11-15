import { describe, expect, it } from 'vitest';
import {
  buildExplainableInsights,
  calculatePersonalBaselineFromRecords,
  classifyScientificOrigin,
  evaluateSelfAssessmentFromRecords,
  getHazardsForIndicator,
  getIndicatorMetadata,
  listAllHazards,
  listGuidanceCatalog,
  listIndicatorsByCategory,
  mapProcessedDatasetRow,
} from '@/services';
import type { CardiovascularRecord, SleepRecord } from '@/types';

function makeHrRecord(
  id: string,
  timestamp: string,
  value: number | null,
  unit = 'bpm',
): CardiovascularRecord {
  return {
    id,
    category: 'cardiovascular',
    astronaut_id: 'astro-01',
    timestamp,
    indicator: 'heart_rate',
    value,
    unit,
    data_origin: 'SYNTHETIC',
    ingestion_method: 'MANUAL',
    source_dataset: 'synthetic_test',
    quality_status: value === null ? 'missing_value' : 'verified',
    created_at: timestamp,
    updated_at: timestamp,
  };
}

describe('Phase 1-6 Scientific Engines', () => {
  it('maps NASA processed rows while preserving origin and rejecting aggregates/missing timestamps', () => {
    expect(classifyScientificOrigin('UTMB_Campaign_1_BRSMACT')).toBe('GROUND_ANALOG');
    expect(classifyScientificOrigin('OSD-575')).toBe('SPACEFLIGHT');

    const aggregateOutcome = mapProcessedDatasetRow(
      {
        subject_id: 'NOT_AVAILABLE',
        timestamp: 'NOT_AVAILABLE',
        indicator: 'heart_rate',
        value: '57.4',
        unit: 'bpm',
        data_origin: 'https://nlsp.nasa.gov/explore/lsdahome',
        source_dataset: 'Apollo_AP005',
        quality_status: 'aggregated_not_individual',
      },
      'cardiovascular',
    );
    expect(aggregateOutcome.mapped).toBeNull();
    expect(aggregateOutcome.classified_origin).toBe('SPACEFLIGHT');

    const sleepOutcome = mapProcessedDatasetRow(
      {
        subject_id: 'C1G0001',
        timestamp: '2004-09-07',
        indicator: 'sleep_duration',
        value: '7.5',
        unit: 'hours',
        data_origin: 'https://nlsp.nasa.gov/explore/lsdahome',
        source_dataset: 'UTMB_Campaign_1_BRSMACT',
        quality_status: 'source_value_present',
      },
      'sleep',
    );
    expect(sleepOutcome.mapped).not.toBeNull();
    expect(sleepOutcome.mapped?.data_origin).toBe('GROUND_ANALOG');
    expect(sleepOutcome.mapped?.astronaut_id).toBe('ref_UTMB_Campaign_1_BRSMACT_C1G0001');
  });

  it('retrieves scientific indicator metadata and availability status', () => {
    const hr = getIndicatorMetadata('heart_rate');
    expect(hr?.measurement_unit).toBe('bpm');
    expect(hr?.availability_status).toBe('partial_in_nasa_dataset');

    const co = getIndicatorMetadata('cardiac_output');
    expect(co?.availability_status).toBe('planned_manual_or_device');

    expect(listIndicatorsByCategory('sleep').map((i) => i.indicator_id)).toEqual([
      'sleep_duration',
      'sleep_efficiency',
      'sleep_latency',
    ]);
  });

  it('computes personal baseline, excludes unit mismatches/nulls, and flags insufficient data', () => {
    const insufficient = calculatePersonalBaselineFromRecords(
      [makeHrRecord('1', '2026-11-10T08:00:00Z', 62)],
      {
        astronaut_id: 'astro-01',
        category: 'cardiovascular',
        indicator: 'heart_rate',
      },
    );
    expect(insufficient.status).toBe('insufficient_data');
    expect(insufficient.mean).toBeNull();

    const records = [
      makeHrRecord('1', '2026-11-01T08:00:00Z', 60),
      makeHrRecord('2', '2026-11-02T08:00:00Z', 62),
      makeHrRecord('3', '2026-11-03T08:00:00Z', null),
      makeHrRecord('4', '2026-11-04T08:00:00Z', 70, 'Hz'),
      makeHrRecord('5', '2026-11-05T08:00:00Z', 72),
      makeHrRecord('6', '2026-11-06T08:00:00Z', 74),
    ];

    const baseline = calculatePersonalBaselineFromRecords(records, {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      referenceDate: '2026-11-07T08:00:00Z',
    });

    expect(baseline.status).toBe('computed');
    expect(baseline.valid_count).toBe(4);
    expect(baseline.excluded_records).toHaveLength(2);
    expect(baseline.mean).toBe(67);
    expect(baseline.min).toBe(60);
    expect(baseline.max).toBe(74);
    expect(baseline.period_comparison.direction).toBe('increase');
  });

  it('generates explainable insights and spaceflight hazard relationships', () => {
    const sleepRecords: SleepRecord[] = [
      {
        id: 's1',
        category: 'sleep',
        astronaut_id: 'astro-01',
        timestamp: '2026-10-01T07:00:00Z',
        indicator: 'sleep_duration',
        value: 7.5,
        unit: 'hours',
        data_origin: 'GROUND_ANALOG',
        ingestion_method: 'MANUAL',
        source_dataset: 'local',
        quality_status: 'verified',
        created_at: '2026-10-01T07:00:00Z',
        updated_at: '2026-10-01T07:00:00Z',
      },
      {
        id: 's2',
        category: 'sleep',
        astronaut_id: 'astro-01',
        timestamp: '2026-10-02T07:00:00Z',
        indicator: 'sleep_duration',
        value: 7.3,
        unit: 'hours',
        data_origin: 'GROUND_ANALOG',
        ingestion_method: 'MANUAL',
        source_dataset: 'local',
        quality_status: 'verified',
        created_at: '2026-10-02T07:00:00Z',
        updated_at: '2026-10-02T07:00:00Z',
      },
      {
        id: 's3',
        category: 'sleep',
        astronaut_id: 'astro-01',
        timestamp: '2026-10-03T07:00:00Z',
        indicator: 'sleep_duration',
        value: 5.5,
        unit: 'hours',
        data_origin: 'GROUND_ANALOG',
        ingestion_method: 'MANUAL',
        source_dataset: 'local',
        quality_status: 'verified',
        created_at: '2026-10-03T07:00:00Z',
        updated_at: '2026-10-03T07:00:00Z',
      },
    ];

    const insights = buildExplainableInsights(sleepRecords, {
      astronaut_id: 'astro-01',
      category: 'sleep',
      indicator: 'sleep_duration',
      referenceDate: '2026-11-14T07:00:00Z',
    });

    expect(insights.some((i) => i.insight_type === 'outdated_measurements')).toBe(true);
    expect(insights.some((i) => i.insight_type === 'sleep_change')).toBe(true);

    expect(listAllHazards()).toHaveLength(5);
    const sleepHazards = getHazardsForIndicator('sleep_duration');
    expect(sleepHazards.map((h) => h.hazard_id)).toContain('isolation_confinement');
  });

  it('evaluates all self-assessment states deterministically without inventing thresholds', () => {
    const emptyAssessment = evaluateSelfAssessmentFromRecords([], {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
    });
    expect(emptyAssessment.assessment_status).toBe('INSUFFICIENT_DATA');

    const records = [
      makeHrRecord('1', '2026-11-01T08:00:00Z', 60),
      makeHrRecord('2', '2026-11-02T08:00:00Z', 60),
      makeHrRecord('3', '2026-11-03T08:00:00Z', 61),
      makeHrRecord('4', '2026-11-04T08:00:00Z', 60),
      makeHrRecord('5', '2026-11-05T08:00:00Z', 60),
    ];

    const infoAssessment = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      referenceDate: '2026-11-06T08:00:00Z',
    });
    expect(infoAssessment.assessment_status).toBe('INFORMATIONAL');

    const monitorAssessment = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      referenceDate: '2026-12-15T08:00:00Z',
    });
    expect(monitorAssessment.assessment_status).toBe('MONITOR');

    const shiftedRecords = [
      makeHrRecord('1', '2026-11-01T08:00:00Z', 60),
      makeHrRecord('2', '2026-11-02T08:00:00Z', 60),
      makeHrRecord('3', '2026-11-03T08:00:00Z', 85),
      makeHrRecord('4', '2026-11-04T08:00:00Z', 90),
      makeHrRecord('5', '2026-11-05T08:00:00Z', 92),
    ];
    const reviewAssessment = evaluateSelfAssessmentFromRecords(shiftedRecords, {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      referenceDate: '2026-11-06T08:00:00Z',
    });
    expect(reviewAssessment.assessment_status).toBe('REVIEW_REQUIRED');

    const escalated = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-01',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      user_reported_symptoms: true,
    });
    expect(escalated.assessment_status).toBe('MEDICAL_ESCALATION');
    expect(listGuidanceCatalog().length).toBeGreaterThanOrEqual(4);
  });
});
