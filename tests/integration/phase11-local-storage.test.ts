import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeSha256Hex,
  createLocalProfile,
  deleteLocalProfileData,
  deleteLocalDatabase,
  exportLocalBackup,
  getLocalStorageInfo,
  initializeDatabase,
  requestPersistentStorage,
  restoreLocalBackup,
  saveCardiovascularMeasurement,
  saveDailyCheckIn,
  saveMedicalReviewRequest,
  saveMissionContext,
  TumiHealthDatabase,
} from '@/services';

const PROFILE_ID = 'phase11-astronaut';

describe('Phase 11 local storage guarantees', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
    await createLocalProfile({ astronaut_id: PROFILE_ID, display_name: 'Storage Tester' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates a populated version 4 database to the current schema without losing data', async () => {
    const databaseName = `tumi-phase11-v4-${Date.now()}`;
    const legacy = new Dexie(databaseName);
    legacy.version(4).stores({
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

    await legacy.open();
    await legacy.table('profiles').add({
      astronaut_id: 'v4-profile',
      display_name: 'Version 4 Crew',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    await legacy.table('cardiovascular_records').add({
      id: 'v4-record',
      astronaut_id: 'v4-profile',
      timestamp: '2026-01-02T08:00:00.000Z',
      indicator: 'heart_rate',
      value: 64,
      unit: 'bpm',
      category: 'cardiovascular',
      data_origin: 'SPACEFLIGHT',
      ingestion_method: 'MANUAL',
      source_dataset: 'v4-migration-fixture',
      quality_status: 'verified',
      created_at: '2026-01-02T08:01:00.000Z',
      updated_at: '2026-01-02T08:01:00.000Z',
    });
    await legacy.table('mission_contexts').add({
      context_id: 'v4-context',
      astronaut_id: 'v4-profile',
      mission_id: 'V4-MISSION',
      mission_phase: 'inflight',
      environment_type: 'ISS',
      gravity_environment: 'microgravity',
      mission_start_date: '2026-01-01',
      recorded_at: '2026-01-02T08:02:00.000Z',
      source: 'migration-fixture',
    });
    await legacy.table('audit_events').add({
      event_id: 'v4-audit',
      record_id: 'v4-record',
      profile_id: 'v4-profile',
      actor_id: 'v4-profile',
      action: 'RECORD_CREATED',
      timestamp: '2026-01-02T08:01:00.000Z',
      status: 'success',
      details: { migrationFixture: true },
    });
    await legacy.table('import_batches').add({
      batch_id: 'v4-batch',
      profile_id: 'v4-profile',
      category: 'cardiovascular',
      file_name: 'v4.csv',
      data_origin: 'SPACEFLIGHT',
      source_dataset: 'v4-migration-fixture',
      status: 'completed',
      total_rows: 1,
      valid_rows: 1,
      invalid_rows: 0,
      imported_record_ids: ['v4-record'],
      created_at: '2026-01-02T08:00:00.000Z',
      updated_at: '2026-01-02T08:01:00.000Z',
    });
    legacy.close();

    const upgraded = new TumiHealthDatabase(databaseName);
    try {
      await upgraded.open();
      expect(upgraded.verno).toBe(6);
      expect(await upgraded.profiles.get('v4-profile')).toMatchObject({
        display_name: 'Version 4 Crew',
      });
      expect(await upgraded.cardiovascular_records.get('v4-record')).toMatchObject({
        value: 64,
      });
      expect(await upgraded.mission_contexts.get('v4-context')).toMatchObject({
        mission_start_date: '2026-01-01',
      });
      expect(await upgraded.audit_events.get('v4-audit')).toMatchObject({
        details: { migrationFixture: true },
      });
      expect(await upgraded.import_batches.get('v4-batch')).toBeDefined();
      expect(await upgraded.daily_checkins.count()).toBe(0);
      expect(await upgraded.medical_review_requests.count()).toBe(0);
    } finally {
      upgraded.close();
      await Dexie.delete(databaseName);
    }
  });

  it('closes an open v6 connection when another tab requests a schema upgrade', async () => {
    const databaseName = `tumi-phase11-versionchange-${Date.now()}`;
    const current = new TumiHealthDatabase(databaseName);
    const upgrader = new TumiHealthDatabase(databaseName);
    let versionChangeObserved = false;
    current.on('versionchange', () => {
      versionChangeObserved = true;
    });

    try {
      await current.open();
      upgrader.version(7).stores({
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
        medical_review_requests:
          'id, profile_id, status, created_at, [profile_id+created_at]',
        migration_marker: 'id',
      });
      await upgrader.open();
      expect(versionChangeObserved).toBe(true);
      expect(current.isOpen()).toBe(false);
    } finally {
      current.close();
      upgrader.close();
      await Dexie.delete(databaseName);
    }
  });

  it('round-trips check-ins and medical review requests in schema 4 backups and still accepts v3 backups', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const record = await saveCardiovascularMeasurement({
      astronaut_id: PROFILE_ID,
      timestamp: `${today}T00:00:00Z`,
      indicator: 'heart_rate',
      value: 66,
      unit: 'bpm',
      data_origin: 'GROUND_ANALOG',
    });
    const checkin = await saveDailyCheckIn({
      profile_id: PROFILE_ID,
      checkin_date: today,
      mood: 'good',
      energy_level: 4,
      symptoms: [],
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });
    await saveMedicalReviewRequest({
      profile_id: PROFILE_ID,
      date_range: { from: '2000-01-01', to: '2099-12-31' },
      record_ids: [record.id],
      checkin_ids: [checkin.id],
      status: 'PENDING_LOCAL',
      data_origin: 'SELF_REPORTED',
      source: 'phase11-test',
    });
    await saveMissionContext({
      astronaut_id: PROFILE_ID,
      mission_id: 'PHASE11',
      mission_phase: 'inflight',
      environment_type: 'ISS',
      gravity_environment: 'microgravity',
      mission_start_date: '2026-11-01',
    });

    const backup = await exportLocalBackup(PROFILE_ID);
    expect(backup.schema_version).toBe(4);
    expect(backup.daily_checkins).toHaveLength(1);
    expect(backup.medical_review_requests).toHaveLength(1);

    await deleteLocalDatabase();
    await initializeDatabase();
    await restoreLocalBackup(backup);
    let db = await initializeDatabase();
    expect(await db.daily_checkins.get(checkin.id)).toMatchObject({ mood: 'good' });
    expect(await db.medical_review_requests.count()).toBe(1);
    expect(await db.mission_contexts.count()).toBe(1);

    const { daily_checkins: _checkins, medical_review_requests: _requests, checksum_sha256: _checksum, ...legacyBody } = backup;
    const v3Body = { ...legacyBody, schema_version: 3 };
    const legacyBackup = {
      ...v3Body,
      checksum_sha256: await computeSha256Hex(JSON.stringify(v3Body)),
    };
    await deleteLocalDatabase();
    await initializeDatabase();
    await restoreLocalBackup(legacyBackup);
    db = await initializeDatabase();
    expect(await db.profiles.get(PROFILE_ID)).toBeDefined();
    expect(await db.daily_checkins.count()).toBe(0);

    await deleteLocalProfileData(PROFILE_ID);
    expect(await db.daily_checkins.count()).toBe(0);
    expect(await db.medical_review_requests.count()).toBe(0);
  });

  it('validates check-ins and medical review requests when a backup has no audit events', async () => {
    const backup = await exportLocalBackup(PROFILE_ID);
    const addChecksum = async (
      payload: Parameters<typeof restoreLocalBackup>[0],
    ): Promise<Parameters<typeof restoreLocalBackup>[0]> => {
      const { checksum_sha256: _checksum, ...body } = payload;
      return {
        ...body,
        checksum_sha256: await computeSha256Hex(JSON.stringify(body)),
      };
    };

    const malformedCheckInBackup = await addChecksum({
      ...backup,
      audit_events: [],
      daily_checkins: [null],
    } as unknown as Parameters<typeof restoreLocalBackup>[0]);
    await expect(restoreLocalBackup(malformedCheckInBackup)).rejects.toThrow(
      /malformed daily_checkin entry/i,
    );

    const malformedRequestBackup = await addChecksum({
      ...backup,
      audit_events: [],
      medical_review_requests: [
        { id: 'missing-checkin-ids', profile_id: PROFILE_ID, record_ids: [] },
      ],
    } as unknown as Parameters<typeof restoreLocalBackup>[0]);
    await expect(restoreLocalBackup(malformedRequestBackup)).rejects.toThrow(
      /malformed medical_review_request entry/i,
    );
  });

  it('reports persistent-storage API outcomes and surfaces IndexedDB write failures', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: vi.fn().mockResolvedValue(true),
        estimate: vi.fn().mockResolvedValue({ usage: 1_048_576, quota: 8_388_608 }),
        persist: vi.fn().mockResolvedValue(true),
      },
    });
    await expect(getLocalStorageInfo()).resolves.toEqual({
      persistence: 'granted',
      usage: 1_048_576,
      quota: 8_388_608,
    });
    await expect(requestPersistentStorage()).resolves.toEqual({ status: 'granted' });

    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockResolvedValue(false) },
    });
    await expect(requestPersistentStorage()).resolves.toEqual({ status: 'not granted' });

    vi.stubGlobal('navigator', {});
    await expect(requestPersistentStorage()).resolves.toEqual({ status: 'unsupported' });

    const db = await initializeDatabase();
    vi.spyOn(db.profiles, 'add').mockRejectedValue(
      new DOMException('Storage quota exceeded', 'QuotaExceededError'),
    );
    await expect(
      createLocalProfile({ astronaut_id: 'quota-profile', display_name: 'Quota Failure' }),
    ).rejects.toThrow(/storage quota exceeded/i);
  });
});
