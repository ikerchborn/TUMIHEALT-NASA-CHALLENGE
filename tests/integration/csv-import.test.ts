import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelCsvImport,
  confirmCsvImport,
  createLocalProfile,
  getProfileAuditHistory,
  getRecords,
  inspectCsvFile,
  prepareCsvImportPreview,
} from '@/services/healthService';
import { extractSheetsFromFile } from '@/services/dataEngineering/etl/spreadsheetAdapter';
import { parseMeasurementXml } from '@/services/ingestion/xmlMeasurementAdapter';
import { generateImportTemplate } from '@/services/ingestion/importTemplateService';
import { deleteLocalDatabase, initializeDatabase } from '@/services/storage';

const SAMPLE_CSV = [
  'date_iso,metric,reading,units,context',
  '2026-11-10T08:00:00Z,heart_rate,64,bpm,resting',
  '2026-11-11T08:00:00Z,heart_rate,0,bpm,sensor_zero_test',
  '2026-11-12T08:00:00Z,heart_rate,NA,bpm,resting',
  '2026-11-13T08:00:00Z,heart_rate,72,mmHg,invalid_unit_row',
].join('\n');

describe('CSV Ingestion Service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect(stored.every((r) => r.import_batch_id === result.batch.batch_id)).toBe(true);
    const recordsForBatch = stored.filter(
      (record) =>
        record.import_batch_id === result.batch.batch_id &&
        result.imported_record_ids.includes(record.id),
    );
    expect(recordsForBatch).toHaveLength(result.imported_count);
    expect(stored.every((r) => r.data_origin === 'GROUND_ANALOG')).toBe(true);
    expect(stored[1].value).toBe(0);
    expect(stored[2].value).toBeNull();
  });

  it('rejects unknown indicators, incompatible units, invalid values, and future or invalid dates with row numbers', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const csv = [
      'timestamp,indicator,value,unit',
      '2026-01-01T08:00:00Z,unlisted_metric,1,unit',
      '2026-01-02T08:00:00Z,heart_rate,72,mmHg',
      '2026-01-03T08:00:00Z,heart_rate,not-a-number,bpm',
      `${futureDate},heart_rate,70,bpm`,
      'not-a-date,heart_rate,68,bpm',
    ].join('\n');

    const preview = await prepareCsvImportPreview({
      csvText: csv,
      fileName: 'normalized.csv',
      sourceFileName: 'source.xml',
      fileFormat: 'xml',
      profileId: 'astro-csv-1',
      category: 'cardiovascular',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'xml_measurements',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      },
    });

    expect(preview.batch.file_name).toBe('source.xml');
    expect(preview.batch.file_format).toBe('xml');
    expect(preview.valid_records).toHaveLength(0);
    expect(preview.invalid_rows.map((row) => row.row_number)).toEqual([2, 3, 4, 5, 6]);
    const codes = preview.invalid_rows.flatMap((row) => row.errors.map((issue) => issue.code));
    expect(codes).toEqual(expect.arrayContaining([
      'UNKNOWN_INDICATOR',
      'INCOMPATIBLE_UNIT',
      'INVALID_CSV_NUMBER',
      'FUTURE_DATE',
      'INVALID_TIMESTAMP',
    ]));
    expect(await getRecords({ astronaut_id: 'astro-csv-1' })).toHaveLength(0);
  });

  it('imports a flat XLSX sheet through the same preview and explicit-confirmation pipeline', async () => {
    const template = generateImportTemplate('blood', 'xlsx');
    if (!(template.content instanceof ArrayBuffer)) {
      throw new Error('The XLSX template must be generated as an ArrayBuffer.');
    }
    const file = new File(
      [template.content],
      template.fileName,
    );
    const [sheet] = await extractSheetsFromFile(file, { strictPersonalImport: true });

    const preview = await prepareCsvImportPreview({
      csvText: sheet.csvText,
      fileName: 'tumi-blood-template_Measurements.csv',
      sourceFileName: file.name,
      fileFormat: 'xlsx',
      profileId: 'astro-csv-1',
      category: 'blood',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'tumi-blood-template',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      },
    });

    expect(await getRecords({ astronaut_id: 'astro-csv-1' })).toHaveLength(0);
    expect(preview.valid_records).toHaveLength(1);
    const result = await confirmCsvImport(preview);
    expect(result.batch.file_name).toBe('tumi-blood-template.xlsx');
    expect(result.batch.file_format).toBe('xlsx');
    expect((await getRecords({ astronaut_id: 'astro-csv-1' }))[0].value).toBe(95);
  });

  it('imports a valid XML measurement through the same explicit-confirmation pipeline', async () => {
    class XmlNode {
      constructor(
        readonly localName: string,
        readonly textContent: string,
        readonly children: XmlNode[] = [],
      ) {}
    }
    class FixtureDomParser {
      parseFromString(source: string) {
        const body = [...source.matchAll(/<Measurement>([\s\S]*?)<\/Measurement>/g)][0]?.[1] ?? '';
        const fields = [...body.matchAll(/<([\w-]+)>([\s\S]*?)<\/\1>/g)]
          .map(([, name, value]) => new XmlNode(name, value.trim()));
        return {
          documentElement: new XmlNode('TUMIMeasurements', '', [new XmlNode('Measurement', '', fields)]),
          getElementsByTagName: () => [],
        };
      }
    }
    vi.stubGlobal('DOMParser', FixtureDomParser);
    const xmlContent = generateImportTemplate('blood', 'xml').content;
    if (typeof xmlContent !== 'string') {
      throw new Error('The XML template must be generated as text.');
    }
    const parsed = parseMeasurementXml(xmlContent);
    const preview = await prepareCsvImportPreview({
      csvText: parsed.csvText,
      fileName: 'normalized.xml_measurements.csv',
      sourceFileName: 'tumi-blood-template.xml',
      fileFormat: 'xml',
      profileId: 'astro-csv-1',
      category: 'blood',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'xml_measurements',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      },
    });

    expect(preview.valid_records).toHaveLength(1);
    const result = await confirmCsvImport(preview);
    expect(result.batch.file_format).toBe('xml');
    expect(result.batch.file_name).toBe('tumi-blood-template.xml');
    expect((await getRecords({ astronaut_id: 'astro-csv-1' }))[0].indicator).toBe('glucose');
  });

  it('reports absent required source columns and stores the failed batch without health records', async () => {
    await expect(prepareCsvImportPreview({
      csvText: 'timestamp,indicator\n2026-01-01T08:00:00Z,glucose',
      fileName: 'missing.csv',
      profileId: 'astro-csv-1',
      category: 'blood',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'missing_columns',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      },
    })).rejects.toThrow(/missing required columns/i);

    const db = await initializeDatabase();
    const failedBatch = (await db.import_batches.toArray()).find((batch) => batch.file_name === 'missing.csv');
    expect(failedBatch?.status).toBe('failed');
    expect(failedBatch?.invalid_rows).toBe(1);
    expect(await getRecords({ astronaut_id: 'astro-csv-1' })).toHaveLength(0);
  });

  it('imports a generated CSV template and persists its measurement after confirmation', async () => {
    const template = generateImportTemplate('blood', 'csv');
    if (typeof template.content !== 'string') {
      throw new Error('The CSV template must be generated as text.');
    }
    const inspection = inspectCsvFile(template.content, template.fileName);
    const preview = await prepareCsvImportPreview({
      csvText: template.content,
      fileName: template.fileName,
      sourceFileName: template.fileName,
      fileFormat: 'csv',
      profileId: 'astro-csv-1',
      category: 'blood',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'generated_template',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      },
    });

    expect(inspection.total_rows).toBe(1);
    expect(preview.valid_records).toHaveLength(1);
    const result = await confirmCsvImport(preview);

    expect(result.imported_count).toBe(1);
    expect(result.batch.file_format).toBe('csv');
    expect((await getRecords({ astronaut_id: 'astro-csv-1' }))[0].indicator).toBe('glucose');
  });
});
