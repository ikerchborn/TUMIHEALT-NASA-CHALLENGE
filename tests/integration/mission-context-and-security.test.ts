import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalProfile,
  deleteLocalDatabase,
  deleteLocalProfileData,
  exportLocalBackup,
  exportRecordsToSafeCsv,
  getLatestMissionContext,
  getMissionContexts,
  getRecords,
  initializeDatabase,
  restoreLocalBackup,
  sanitizeCsvCell,
  saveCardiovascularMeasurement,
  saveMissionContext,
  validateCsvUploadConstraints,
} from '@/services';

describe('Phase 7-8 Mission Context, Security Hardening, and Backup/Restore', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
    await createLocalProfile({
      astronaut_id: 'astro-sec-1',
      display_name: 'Security Tester',
    });
  });

  it('stores and retrieves mission context and cascades deletion with profile', async () => {
    await saveMissionContext({
      astronaut_id: 'astro-sec-1',
      mission_id: 'ARTEMIS-SIM-01',
      mission_phase: 'inflight',
      environment_type: 'ISS_analog_module',
      gravity_environment: 'microgravity',
      mission_start_date: '2026-04-04',
      activity_context: 'resting',
      sleep_context: 'post_sleep',
    });

    const latest = await getLatestMissionContext('astro-sec-1');
    expect(latest?.mission_id).toBe('ARTEMIS-SIM-01');
    expect(latest?.gravity_environment).toBe('microgravity');
    expect(latest?.mission_start_date).toBe('2026-04-04');

    await deleteLocalProfileData('astro-sec-1');
    expect(await getMissionContexts('astro-sec-1')).toHaveLength(0);
  });

  it('protects CSV exports against formula injection and validates CSV upload constraints', async () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+123')).toBe("'+123");
    expect(validateCsvUploadConstraints('bad.xlsx', 100).valid).toBe(false);
    expect(validateCsvUploadConstraints('empty.csv', 0).valid).toBe(false);
    expect(validateCsvUploadConstraints('ok.csv', 1024).valid).toBe(true);

    const saved = await saveCardiovascularMeasurement({
      astronaut_id: 'astro-sec-1',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'heart_rate',
      value: 66,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
      source_dataset: '=HYPERLINK("http://evil")',
    });

    const csv = exportRecordsToSafeCsv([saved]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it('exports and restores local backups with SHA-256 integrity verification', async () => {
    await saveCardiovascularMeasurement({
      astronaut_id: 'astro-sec-1',
      timestamp: '2026-11-14T10:00:00Z',
      indicator: 'heart_rate',
      value: 65,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
    });

    const backup = await exportLocalBackup('astro-sec-1');
    expect(backup.blood_records.length + backup.cardiovascular_records.length).toBe(1);

    // Tampered backup must be rejected
    const tampered = { ...backup, astronaut_id: 'tampered' };
    await expect(restoreLocalBackup(tampered)).rejects.toThrow(/checksum mismatch/i);

    // Wipe DB and restore valid backup
    await deleteLocalDatabase();
    await initializeDatabase();
    const restored = await restoreLocalBackup(backup);
    expect(restored.restoredRecords).toBe(1);

    const records = await getRecords({ astronaut_id: 'astro-sec-1' });
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(65);
  });
});
