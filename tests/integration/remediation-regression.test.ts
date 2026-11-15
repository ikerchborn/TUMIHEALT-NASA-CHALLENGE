import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculatePersonalBaselineFromRecords,
  confirmCsvImport,
  createLocalProfile,
  deleteLocalDatabase,
  deleteRecord,
  exportLocalBackup,
  getIndicatorMetadata,
  getProfileAuditHistory,
  getRecordAuditHistory,
  getRecords,
  initializeDatabase,
  prepareCsvImportPreview,
  restoreLocalBackup,
  saveBloodMeasurement,
  saveCardiovascularMeasurement,
  saveMissionContext,
  updateRecord,
  validateHealthRecordInput,
} from '@/services';
import { closeDatabase, DATABASE_NAME } from '@/services/storage/db';
import type { CardiovascularRecord, LocalBackupPayload } from '@/types';

describe('Backend Remediation Regression Suite (P1–P3)', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
  });

  it('P1: rejects OSD-569 hemoglobin "%" unit without converting to g/dL and documents discrepancy', () => {
    const meta = getIndicatorMetadata('hemoglobin');
    expect(meta?.limitations.some((l) => l.includes('OSD-569'))).toBe(true);

    const res = validateHealthRecordInput({
      category: 'blood',
      astronaut_id: 'astro-01',
      timestamp: '2026-11-14T08:00:00Z',
      indicator: 'hemoglobin',
      value: 14.2,
      unit: '%',
      data_origin: 'SPACEFLIGHT',
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'AMBIGUOUS_SOURCE_UNIT')).toBe(true);
  });

  it('P1: minimizes audit event details by excluding raw biometric values', async () => {
    await createLocalProfile({
      astronaut_id: 'astro-audit-1',
      display_name: 'Audit Minimization Tester',
    });

    const saved = await saveBloodMeasurement({
      astronaut_id: 'astro-audit-1',
      timestamp: '2026-11-14T08:00:00Z',
      indicator: 'albumin',
      value: 4.6,
      unit: 'g/dL',
      data_origin: 'SYNTHETIC',
    });

    await updateRecord(saved.id, 'blood', { value: 4.8 });
    await deleteRecord(saved.id, 'blood');

    const events = await getRecordAuditHistory(saved.id);
    expect(events.map((e) => e.action)).toEqual(
      expect.arrayContaining(['RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED']),
    );

    for (const evt of events) {
      expect(evt.details.value).toBeUndefined();
      expect(evt.details.previous_values).toBeUndefined();
      expect(evt.details.new_values).toBeUndefined();
      expect(evt.details.deleted_record_snapshot).toBeUndefined();
    }
  });

  it('P2: validates backup schema/version and prevents partial restoration on invalid payloads', async () => {
    await createLocalProfile({
      astronaut_id: 'astro-bk-1',
      display_name: 'Backup Tester',
    });
    await saveCardiovascularMeasurement({
      astronaut_id: 'astro-bk-1',
      timestamp: '2026-11-14T08:00:00Z',
      indicator: 'heart_rate',
      value: 64,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
    });

    const validBackup = await exportLocalBackup('astro-bk-1');
    await deleteLocalDatabase();
    await initializeDatabase();

    const unsupportedVersion = {
      ...validBackup,
      schema_version: 99,
    } as LocalBackupPayload;
    await expect(restoreLocalBackup(unsupportedVersion)).rejects.toThrow(
      /Unsupported backup schema_version/i,
    );

    const malformedRecordBackup: LocalBackupPayload = {
      ...validBackup,
      cardiovascular_records: [{ id: 'bad-1', category: 'cardiovascular' }],
    };
    await expect(restoreLocalBackup(malformedRecordBackup)).rejects.toThrow(
      /failed schema validation/i,
    );
    expect(await getRecords({ astronaut_id: 'astro-bk-1' })).toHaveLength(0);

    const restored = await restoreLocalBackup(validBackup);
    expect(restored.restoredRecords).toBe(1);
    expect(await getProfileAuditHistory('astro-bk-1')).not.toHaveLength(0);
  });

  it('P2: enforces profile existence and cross-profile ownership boundaries', async () => {
    await expect(
      saveCardiovascularMeasurement({
        astronaut_id: 'non-existent-profile',
        timestamp: '2026-11-14T08:00:00Z',
        indicator: 'heart_rate',
        value: 70,
        unit: 'bpm',
        data_origin: 'SYNTHETIC',
      }),
    ).rejects.toThrow(/does not exist/i);

    await createLocalProfile({ astronaut_id: 'astro-a', display_name: 'Astro A' });
    await createLocalProfile({ astronaut_id: 'astro-b', display_name: 'Astro B' });

    const recA = await saveCardiovascularMeasurement({
      astronaut_id: 'astro-a',
      timestamp: '2026-11-14T08:00:00Z',
      indicator: 'heart_rate',
      value: 70,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
    });

    await expect(
      updateRecord(recA.id, 'cardiovascular', { value: 72 }, 'astro-b', 'astro-b'),
    ).rejects.toThrow(/Cross-profile access denied/i);

    await expect(
      updateRecord(recA.id, 'cardiovascular', { astronaut_id: 'astro-b' }),
    ).rejects.toThrow(/Cross-profile reassignment is not allowed/i);

    await expect(
      deleteRecord(recA.id, 'cardiovascular', 'astro-b', 'astro-b'),
    ).rejects.toThrow(/Cross-profile access denied/i);
  });

  it('P2: detects and blocks duplicate CSV imports via SHA-256 content hash', async () => {
    await createLocalProfile({
      astronaut_id: 'astro-dup-1',
      display_name: 'Duplicate CSV Tester',
    });

    const csv = [
      'ts,ind,val,unit',
      '2026-11-14T08:00:00Z,heart_rate,65,bpm',
    ].join('\n');

    const preview1 = await prepareCsvImportPreview({
      csvText: csv,
      fileName: 'first.csv',
      profileId: 'astro-dup-1',
      category: 'cardiovascular',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'dup_test',
      mapping: { timestamp: 'ts', indicator: 'ind', value: 'val', unit: 'unit' },
    });
    expect(preview1.batch.content_hash).toBeTruthy();
    await confirmCsvImport(preview1);

    // Same content with CRLF and different filename must still be detected as duplicate
    await expect(
      prepareCsvImportPreview({
        csvText: csv.replace('\n', '\r\n'),
        fileName: 'renamed_copy.csv',
        profileId: 'astro-dup-1',
        category: 'cardiovascular',
        dataOrigin: 'SYNTHETIC',
        sourceDataset: 'dup_test',
        mapping: { timestamp: 'ts', indicator: 'ind', value: 'val', unit: 'unit' },
      }),
    ).rejects.toThrow(/Duplicate import blocked.*entire file.*1 measurement row/i);

    // Explicit override with allowDuplicate: true succeeds and links batch ID
    const previewOverride = await prepareCsvImportPreview({
      csvText: csv,
      fileName: 'renamed_copy.csv',
      profileId: 'astro-dup-1',
      category: 'cardiovascular',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'dup_test',
      mapping: { timestamp: 'ts', indicator: 'ind', value: 'val', unit: 'unit' },
      allowDuplicate: true,
    });
    expect(previewOverride.batch.is_duplicate_of_batch_id).toBe(preview1.batch.batch_id);
  });

  it('P3: applies options.dateRange directly inside calculatePersonalBaselineFromRecords', () => {
    const makeRec = (id: string, ts: string, val: number): CardiovascularRecord => ({
      id,
      category: 'cardiovascular',
      astronaut_id: 'astro-dr',
      timestamp: ts,
      indicator: 'heart_rate',
      value: val,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'MANUAL',
      source_dataset: 'local',
      quality_status: 'verified',
      created_at: ts,
      updated_at: ts,
    });

    const records = [
      makeRec('1', '2026-10-01T08:00:00Z', 100),
      makeRec('2', '2026-11-01T08:00:00Z', 60),
      makeRec('3', '2026-11-02T08:00:00Z', 62),
      makeRec('4', '2026-11-03T08:00:00Z', 64),
      makeRec('5', '2026-12-01T08:00:00Z', 120),
    ];

    const baseline = calculatePersonalBaselineFromRecords(records, {
      astronaut_id: 'astro-dr',
      category: 'cardiovascular',
      indicator: 'heart_rate',
      dateRange: {
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
      },
    });

    expect(baseline.status).toBe('computed');
    expect(baseline.valid_count).toBe(3);
    expect(baseline.mean).toBe(62);
    expect(baseline.min).toBe(60);
    expect(baseline.max).toBe(64);
  });

  it('P3: migrates existing Dexie v1 records safely through version 6', async () => {
    await deleteLocalDatabase();

    // Seed a legacy v1 database directly
    const legacyDb = new Dexie(DATABASE_NAME);
    legacyDb.version(1).stores({
      profiles: 'astronaut_id, display_name, created_at',
      blood_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
      sleep_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
      cardiovascular_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
    });
    await legacyDb.open();
    await legacyDb.table('profiles').add({
      astronaut_id: 'astro-v1',
      display_name: 'Legacy V1 Astronaut',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    });
    await legacyDb.table('blood_records').add({
      id: 'legacy-blood-1',
      category: 'blood',
      astronaut_id: 'astro-v1',
      timestamp: '2026-10-01T08:00:00Z',
      indicator: 'albumin',
      value: 4.4,
      unit: 'g/dL',
      data_origin: 'SPACEFLIGHT',
      source_dataset: 'legacy_entry',
      quality_status: 'verified',
      created_at: '2026-10-01T08:00:00Z',
      updated_at: '2026-10-01T08:00:00Z',
    });
    legacyDb.close();
    closeDatabase();

    // Open current TumiHealthDatabase and verify migration preserved data
    const upgraded = await initializeDatabase();
    expect(upgraded.verno).toBe(6);
    expect(await upgraded.daily_checkins.count()).toBe(0);
    expect(await upgraded.medical_review_requests.count()).toBe(0);

    const migratedRecords = await getRecords({ astronaut_id: 'astro-v1' });
    expect(migratedRecords).toHaveLength(1);
    expect(migratedRecords[0].ingestion_method).toBe('MANUAL');
    expect(migratedRecords[0].value).toBe(4.4);

    // Verify the additive mission-context store remains available after migration.
    const ctx = await saveMissionContext({
      astronaut_id: 'astro-v1',
      mission_id: 'MIGRATION-CHECK',
      mission_phase: 'inflight',
      environment_type: 'orbital',
      gravity_environment: 'microgravity',
    });
    expect(ctx.context_id).toBeTruthy();
  });
});
