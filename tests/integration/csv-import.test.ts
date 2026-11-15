import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelCsvImport,
  confirmCsvImport,
  createLocalProfile,
  getProfileAuditHistory,
  getRecords,
  inspectCsvFile,
  prepareCsvImportPreview,
} from '@/services/healthService';
import { deleteLocalDatabase, initializeDatabase } from '@/services/storage';

const SAMPLE_CSV = [
  'date_iso,metric,reading,units,context',
  '2026-11-10T08:00:00Z,heart_rate,64,bpm,resting',
  '2026-11-11T08:00:00Z,heart_rate,0,bpm,sensor_zero_test',
  '2026-11-12T08:00:00Z,heart_rate,NA,bpm,resting',
  '2026-11-13T08:00:00Z,heart_rate,72,mmHg,invalid_unit_row',
].join('\n');

describe('CSV Ingestion Service', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
    await createLocalProfile({
      astronaut_id: 'astro-csv-1',
      display_name: 'CSV Tester',
    });
  });

  it('inspects headers, validates rows in preview, and writes nothing on cancel', async () => {
    const inspection = inspectCsvFile(SAMPLE_CSV, 'hr_log.csv');
    expect(inspection.headers).toEqual([
      'date_iso',
      'metric',
      'reading',
      'units',
      'context',
    ]);
    expect(inspection.total_rows).toBe(4);

    const preview = await prepareCsvImportPreview({
      csvText: SAMPLE_CSV,
      fileName: 'hr_log.csv',
      profileId: 'astro-csv-1',
      category: 'cardiovascular',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'manual_csv_upload',
      mapping: {
        timestamp: 'date_iso',
        indicator: 'metric',
        value: 'reading',
        unit: 'units',
        activity_context: 'context',
      },
    });

    expect(preview.batch.status).toBe('pending_confirmation');
    expect(preview.valid_records).toHaveLength(3); // 64, 0, and NA (null)
    expect(preview.invalid_rows).toHaveLength(1); // mmHg for heart_rate

    // Before confirmation, nothing is in health record tables
    expect(await getRecords({ astronaut_id: 'astro-csv-1' })).toHaveLength(0);

    const cancelledBatch = await cancelCsvImport(preview);
    expect(cancelledBatch.status).toBe('cancelled');
    expect(await getRecords({ astronaut_id: 'astro-csv-1' })).toHaveLength(0);

    const audit = await getProfileAuditHistory('astro-csv-1');
    expect(audit.map((e) => e.action)).toEqual(
      expect.arrayContaining(['IMPORT_VALIDATED', 'IMPORT_CANCELLED']),
    );
  });

  it('persists valid records with CSV_IMPORT provenance upon user confirmation', async () => {
    const preview = await prepareCsvImportPreview({
      csvText: SAMPLE_CSV,
      fileName: 'hr_log.csv',
      profileId: 'astro-csv-1',
      category: 'cardiovascular',
      dataOrigin: 'GROUND_ANALOG',
      sourceDataset: 'bedrest_csv_export',
      mapping: {
        timestamp: 'date_iso',
        indicator: 'metric',
        value: 'reading',
        unit: 'units',
        activity_context: 'context',
      },
    });

    const result = await confirmCsvImport(preview);
    expect(result.imported_count).toBe(3);
    expect(result.skipped_invalid_count).toBe(1);
    expect(result.batch.status).toBe('partially_confirmed');

    const stored = await getRecords({ astronaut_id: 'astro-csv-1' });
    expect(stored).toHaveLength(3);
    expect(stored.every((r) => r.ingestion_method === 'CSV_IMPORT')).toBe(true);
    expect(stored.every((r) => r.data_origin === 'GROUND_ANALOG')).toBe(true);
    expect(stored[1].value).toBe(0);
    expect(stored[2].value).toBeNull();
  });
});
