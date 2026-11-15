import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalProfile,
  deleteLocalProfileData,
  deleteRecord,
  getHistoricalTrends,
  getLocalProfileData,
  getProfileAuditHistory,
  getRecordAuditHistory,
  getRecords,
  saveBloodMeasurement,
  saveCardiovascularMeasurement,
  saveSleepMeasurement,
  updateRecord,
} from '@/services/healthService';
import { saveDailyCheckIn } from '@/services/checkIn';
import {
  closeDatabase,
  deleteLocalDatabase,
  initializeDatabase,
} from '@/services/storage';

describe('IndexedDB Storage, Persistence, Profile Separation, and Audit Trail', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
  });

  it('passes the 7-step minimal functional persistence test and profile separation', async () => {
    // 1. Create local test profile
    const profile1 = await createLocalProfile({
      astronaut_id: 'astro-test-1',
      display_name: 'Commander Alpha',
      mission_role: 'Commander',
    });
    expect(profile1.astronaut_id).toBe('astro-test-1');

    // 2. Register a heart rate measurement
    const savedHr = await saveCardiovascularMeasurement({
      astronaut_id: 'astro-test-1',
      timestamp: '2026-11-14T12:00:00Z',
      indicator: 'heart_rate',
      value: 68,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
      heart_rate: 68,
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'wearable-01',
    });
    expect(savedHr.id).toBeTruthy();

    // 3. Simulate closing and reopening the application
    closeDatabase();
    await initializeDatabase();

    // 4. Verify the measurement is still persisted
    const persisted = await getRecords({
      astronaut_id: 'astro-test-1',
      category: 'cardiovascular',
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].value).toBe(68);

    // 5. Query history / trends
    const trends = await getHistoricalTrends({
      astronaut_id: 'astro-test-1',
      category: 'cardiovascular',
      indicator: 'heart_rate',
    });
    expect(trends.average).toBe(68);
    expect(trends.points).toHaveLength(1);

    // Verify a second profile does NOT see the first profile's records
    await createLocalProfile({
      astronaut_id: 'astro-test-2',
      display_name: 'Specialist Beta',
    });
    const profile2Data = await getLocalProfileData('astro-test-2');
    expect(profile2Data.records).toHaveLength(0);

    // 6. Delete the measurement
    const deleted = await deleteRecord(savedHr.id, 'cardiovascular');
    expect(deleted).toBe(true);

    // 7. Verify it no longer appears
    const afterDelete = await getRecords({ astronaut_id: 'astro-test-1' });
    expect(afterDelete).toHaveLength(0);

    // Verify audit trail recorded creation and deletion
    const recordAudit = await getRecordAuditHistory(savedHr.id);
    expect(recordAudit.map((e) => e.action)).toEqual(
      expect.arrayContaining(['RECORD_CREATED', 'RECORD_DELETED']),
    );
  });

  it('supports category filtering, date filtering, updates with audit diff, and profile cascade delete', async () => {
    await createLocalProfile({
      astronaut_id: 'astro-01',
      display_name: 'Astronaut 01',
    });

    const blood = await saveBloodMeasurement({
      astronaut_id: 'astro-01',
      timestamp: '2026-11-10T08:00:00Z',
      indicator: 'albumin',
      value: 4.5,
      unit: 'g/dL',
      data_origin: 'SPACEFLIGHT',
      specimen_type: 'Serum',
    });

    await saveSleepMeasurement({
      astronaut_id: 'astro-01',
      timestamp: '2026-11-12T07:00:00Z',
      indicator: 'sleep_duration',
      value: 7.2,
      unit: 'hours',
      data_origin: 'SPACEFLIGHT',
      sleep_duration: 7.2,
      sleep_efficiency: 91,
    });
    await saveDailyCheckIn({
      profile_id: 'astro-01',
      mood: 'good',
      energy_level: 4,
      symptoms: [],
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });

    const updatedBlood = await updateRecord(blood.id, 'blood', { value: 4.7 });
    expect(updatedBlood.value).toBe(4.7);

    const bloodAudit = await getRecordAuditHistory(blood.id);
    const updateEvt = bloodAudit.find((e) => e.action === 'RECORD_UPDATED');
    expect(updateEvt).toBeDefined();
    expect(updateEvt?.details.changed_fields).toEqual(['value']);
    expect(updateEvt?.details.previous_values).toBeUndefined();
    expect(updateEvt?.details.new_values).toBeUndefined();
    expect(updateEvt?.details.value).toBeUndefined();

    const sleepOnly = await getRecords({
      astronaut_id: 'astro-01',
      category: 'sleep',
    });
    expect(sleepOnly).toHaveLength(1);

    const dateFiltered = await getRecords({
      astronaut_id: 'astro-01',
      dateRange: { from: '2026-11-11T00:00:00Z', to: '2026-11-13T00:00:00Z' },
    });
    expect(dateFiltered).toHaveLength(1);
    expect(dateFiltered[0].category).toBe('sleep');

    const deletionResult = await deleteLocalProfileData('astro-01');
    expect(deletionResult.deletedProfile).toBe(true);
    expect(deletionResult.deletedRecordsCount).toBe(3);

    const remainingRecords = await getRecords({ astronaut_id: 'astro-01' });
    expect(remainingRecords).toHaveLength(0);

    const profileAudit = await getProfileAuditHistory('astro-01');
    expect(profileAudit.some((e) => e.action === 'PROFILE_DELETED')).toBe(true);
  });
});
