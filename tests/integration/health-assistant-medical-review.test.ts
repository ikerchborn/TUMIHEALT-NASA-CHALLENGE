import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalProfile,
  deleteLocalProfileData,
  ensureDemoProfileAndData,
  clearDemoProfileAndData,
  getHealthAssistantAnswers,
  saveCardiovascularMeasurement,
  saveDailyCheckIn,
  saveMedicalReviewRequest,
  listMedicalReviewRequests,
} from '@/services';
import {
  closeDatabase,
  deleteLocalDatabase,
  initializeDatabase,
  TumiHealthDatabase,
} from '@/services/storage';

describe('Health Assistant and local medical review', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
  });

  it('uses not-enough-data messages until personal records meet engine minimums', async () => {
    await createLocalProfile({ astronaut_id: 'assistant-empty', display_name: 'Empty profile' });
    const answers = await getHealthAssistantAnswers('assistant-empty');

    expect(answers).toHaveLength(4);
    expect(answers.find((answer) => answer.id === 'change')?.observation).toMatch(/not enough data/i);
    expect(answers.find((answer) => answer.id === 'history')?.observation).toMatch(/at least three valid/i);
    expect(answers.find((answer) => answer.id === 'review')?.observation).toMatch(/not enough data/i);
    expect(answers.map((answer) => answer.observation).join(' ')).not.toMatch(/you have (a |an )?(disease|condition|diagnosis)/i);
  });

  it('compares dated personal records and cites the evidence', async () => {
    await createLocalProfile({ astronaut_id: 'assistant-history', display_name: 'History profile' });
    for (const [timestamp, value] of [
      ['2026-11-01T08:00:00Z', 60],
      ['2026-11-05T08:00:00Z', 64],
      ['2026-11-10T08:00:00Z', 66],
    ] as const) {
      await saveCardiovascularMeasurement({
        astronaut_id: 'assistant-history',
        timestamp,
        indicator: 'heart_rate',
        value,
        unit: 'bpm',
        data_origin: 'SPACEFLIGHT',
        heart_rate: value,
        activity_context: 'resting',
        sleep_state: 'awake',
      });
    }

    const answers = await getHealthAssistantAnswers('assistant-history');
    const change = answers.find((answer) => answer.id === 'change');
    const history = answers.find((answer) => answer.id === 'history');

    expect(change?.observation).toContain('64 bpm to 66 bpm');
    expect(change?.evidence.map((item) => item.date)).toEqual([
      '2026-11-05',
      '2026-11-10',
    ]);
    expect(history?.observation).toContain('heart_rate');
    expect(history?.evidence[0].date).toContain('2026-11');
  });

  it('treats a symptom check-in as a reason to consider medical review', async () => {
    await createLocalProfile({ astronaut_id: 'assistant-symptoms', display_name: 'Symptom profile' });
    await saveDailyCheckIn({
      profile_id: 'assistant-symptoms',
      checkin_date: '2026-11-14',
      mood: 'unwell',
      energy_level: 2,
      symptoms: ['dizziness'],
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });

    const answer = (await getHealthAssistantAnswers('assistant-symptoms'))
      .find((item) => item.id === 'review');
    expect(answer?.observation).toContain('2026-11-14');
    expect(answer?.next_step).toMatch(/mission medical protocol/i);
    expect(answer?.observation).not.toMatch(/you have (a |an )?(disease|condition)|diagnosed with|take medication/i);
  });

  it('saves review requests locally, isolates profiles, and deletes them with their profile', async () => {
    await createLocalProfile({ astronaut_id: 'review-one', display_name: 'Review One' });
    await createLocalProfile({ astronaut_id: 'review-two', display_name: 'Review Two' });
    const record = await saveCardiovascularMeasurement({
      astronaut_id: 'review-one',
      timestamp: '2026-11-12T08:00:00Z',
      indicator: 'heart_rate',
      value: 72,
      unit: 'bpm',
      data_origin: 'SPACEFLIGHT',
      heart_rate: 72,
      activity_context: 'resting',
      sleep_state: 'awake',
    });

    const saved = await saveMedicalReviewRequest({
      profile_id: 'review-one',
      date_range: { from: '2026-11-01', to: '2026-11-15' },
      record_ids: [record.id],
      checkin_ids: [],
      observations: 'Please review this reading.',
      status: 'PENDING_LOCAL',
      data_origin: 'SELF_REPORTED',
      source: 'medical_review_drawer',
    });
    expect(saved.status).toBe('PENDING_LOCAL');
    expect((await listMedicalReviewRequests('review-one'))).toHaveLength(1);
    expect(await listMedicalReviewRequests('review-two')).toHaveLength(0);

    await expect(saveMedicalReviewRequest({
      profile_id: 'review-two',
      date_range: {},
      record_ids: [record.id],
      checkin_ids: [],
      status: 'DRAFT',
      data_origin: 'SELF_REPORTED',
      source: 'medical_review_drawer',
    })).rejects.toThrow(/not found for this profile/i);

    const deletion = await deleteLocalProfileData('review-one');
    expect(deletion.deletedRecordsCount).toBe(2);
    expect(await listMedicalReviewRequests('review-one')).toHaveLength(0);
  });

  it('clears demo review requests on exit without changing an existing real profile', async () => {
    await createLocalProfile({ astronaut_id: 'real-before-demo', display_name: 'Real profile' });
    await ensureDemoProfileAndData();
    await saveMedicalReviewRequest({
      profile_id: 'demo-astronaut',
      date_range: {},
      record_ids: [],
      checkin_ids: [],
      observations: 'Synthetic review fixture.',
      status: 'PENDING_LOCAL',
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });

    await clearDemoProfileAndData();

    expect(await listMedicalReviewRequests('demo-astronaut')).toHaveLength(0);
    const db = await initializeDatabase();
    expect((await db.profiles.get('real-before-demo'))?.display_name).toBe('Real profile');
  });

  it('adds the medical request store in version 6 without losing version 5 data', async () => {
    const databaseName = `tumi-medical-review-migration-${Date.now()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(5).stores({
      profiles: 'astronaut_id, display_name, created_at',
      blood_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      sleep_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      cardiovascular_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      import_batches:
        'batch_id, profile_id, category, status, created_at, [profile_id+created_at]',
      audit_events:
        'event_id, record_id, profile_id, action, timestamp, status, [profile_id+timestamp], [record_id+timestamp]',
      mission_contexts:
        'context_id, astronaut_id, mission_id, mission_phase, recorded_at, [astronaut_id+recorded_at]',
      research_records:
        'record_id, category, source_dataset, source_subject_id, indicator, study_timepoint, [source_dataset+source_subject_id]',
      research_aggregates:
        'aggregate_id, category, source_dataset, indicator, group_label, [source_dataset+indicator]',
      daily_checkins:
        'id, profile_id, checkin_date, created_at, [profile_id+checkin_date], [profile_id+created_at]',
    });
    await legacy.open();
    await legacy.table('profiles').add({
      astronaut_id: 'migration-profile',
      display_name: 'Migration Profile',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    });
    await legacy.table('blood_records').add({
      id: 'migration-record',
      astronaut_id: 'migration-profile',
      timestamp: '2026-11-01T08:00:00Z',
      indicator: 'glucose',
      value: 90,
      unit: 'mg/dL',
      category: 'blood',
      data_origin: 'SPACEFLIGHT',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: 'migration-fixture',
      quality_status: 'verified',
      created_at: '2026-11-01T08:01:00Z',
      updated_at: '2026-11-01T08:01:00Z',
    });
    legacy.close();

    const upgraded = new TumiHealthDatabase(databaseName);
    try {
      await upgraded.open();
      expect((await upgraded.profiles.get('migration-profile'))?.display_name).toBe('Migration Profile');
      expect(await upgraded.blood_records.get('migration-record')).toMatchObject({ value: 90 });
      expect(await upgraded.medical_review_requests.count()).toBe(0);
    } finally {
      upgraded.close();
      await Dexie.delete(databaseName);
    }
    closeDatabase();
  });
});
