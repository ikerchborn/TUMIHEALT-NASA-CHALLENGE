import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalProfile,
  deleteLocalDatabase,
  getDailyCheckIn,
  getLocalCheckInDate,
  initializeDatabase,
  listDailyCheckIns,
  saveDailyCheckIn,
} from '@/services';
import { DATABASE_VERSION, TumiHealthDatabase } from '@/services/storage/db';

describe('daily check-ins', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
  });

  it('creates one editable check-in per profile and date', async () => {
    await createLocalProfile({ astronaut_id: 'checkin-astro', display_name: 'Test Astronaut' });

    const first = await saveDailyCheckIn({
      profile_id: 'checkin-astro',
      mood: 'a_bit_tired',
      energy_level: 3,
      symptoms: ['headache'],
      note: 'First note',
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });
    const edited = await saveDailyCheckIn({
      profile_id: 'checkin-astro',
      mood: 'good',
      energy_level: 4,
      symptoms: [],
      note: 'Updated note',
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });

    expect(edited.id).toBe(first.id);
    expect(edited.created_at).toBe(first.created_at);
    expect(edited.note).toBe('Updated note');
    expect(edited.updated_at).toBeTruthy();
    expect(await getDailyCheckIn('checkin-astro')).toEqual(edited);
    expect(await listDailyCheckIns('checkin-astro')).toHaveLength(1);
    expect(edited.checkin_date).toBe(getLocalCheckInDate());
  });

  it('rejects invalid energy, dates, and symptom combinations', async () => {
    await createLocalProfile({ astronaut_id: 'checkin-astro', display_name: 'Test Astronaut' });
    const base = {
      profile_id: 'checkin-astro',
      mood: 'good' as const,
      energy_level: 3,
      symptoms: [],
      data_origin: 'SELF_REPORTED' as const,
      source: 'daily_check_in',
    };

    await expect(saveDailyCheckIn({ ...base, energy_level: 6 })).rejects.toThrow(
      'energy_level must be an integer from 1 to 5',
    );
    await expect(saveDailyCheckIn({ ...base, checkin_date: '2025-02-31' })).rejects.toThrow(
      'checkin_date must be a valid YYYY-MM-DD date',
    );
    await expect(
      saveDailyCheckIn({ ...base, other_symptom: 'dizziness detail' }),
    ).rejects.toThrow('other_symptom can only be saved when Other is selected');
  });

  it('adds the check-in store without removing version 4 data', async () => {
    const dbName = `tumi-migration-${Date.now()}`;
    const oldDb = new Dexie(dbName);
    oldDb.version(4).stores({
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
    });
    await oldDb.open();
    await oldDb.table('profiles').add({
      astronaut_id: 'existing-astro',
      display_name: 'Existing Profile',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    });
    await oldDb.table('blood_records').add({
      id: 'existing-record',
      astronaut_id: 'existing-astro',
      timestamp: '2025-01-02T00:00:00.000Z',
      indicator: 'hemoglobin',
      value: 14,
      unit: 'g/dL',
      data_origin: 'SPACEFLIGHT',
    });
    oldDb.close();

    const upgraded = new TumiHealthDatabase(dbName);
    await upgraded.open();
    expect(upgraded.verno).toBe(DATABASE_VERSION);
    expect((await upgraded.profiles.get('existing-astro'))?.display_name).toBe('Existing Profile');
    expect((await upgraded.blood_records.get('existing-record'))?.value).toBe(14);
    expect(await upgraded.daily_checkins.count()).toBe(0);

    upgraded.close();
    await Dexie.delete(dbName);
  });
});
