import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildSyntheticScenarioXlsx,
  SYNTHETIC_SCENARIO_ASTRONAUT_ID,
  SYNTHETIC_SCENARIO_XLSX_FILENAME,
} from '@/services/demo';
import { extractSheetsFromFile } from '@/services/dataEngineering/etl/spreadsheetAdapter';
import {
  inspectCsvFile,
  prepareCsvImportPreview,
} from '@/services/ingestion/csvImportService';
import { INDICATOR_UNIT_REGISTRY } from '@/services/validation/unitRegistry';
import { getRecords, initializeDatabase } from '@/services';
import type { HealthCategory } from '@/types';

describe('90-day synthetic astronaut scenario .xlsx workbook', () => {
  beforeEach(async () => {
    const db = await initializeDatabase();
    await db.delete();
    await initializeDatabase();
  });

  it('generates all 6 expected sheets without inserting records into IndexedDB', async () => {
    const generated = buildSyntheticScenarioXlsx(new Date('2026-11-15T12:00:00Z'));
    expect(generated.fileName).toBe(SYNTHETIC_SCENARIO_XLSX_FILENAME);
    expect(generated.sheetNames).toEqual([
      'README',
      'Cardiovascular',
      'Sleep',
      'Blood_Labs',
      'Daily_CheckIn',
      'Data_Dictionary',
    ]);

    const wb = XLSX.read(generated.content, { type: 'array' });
    expect(wb.SheetNames).toEqual(generated.sheetNames);

    // Must never auto-insert records into IndexedDB
    const stored = await getRecords({ astronaut_id: SYNTHETIC_SCENARIO_ASTRONAUT_ID });
    expect(stored).toHaveLength(0);
  });

  it('extracts and validates Cardiovascular, Sleep, and Blood_Labs sheets via the real TUMI-HEALT importer', async () => {
    const generated = buildSyntheticScenarioXlsx(new Date('2026-11-15T12:00:00Z'));
    const file = {
      name: generated.fileName,
      arrayBuffer: async () => generated.content,
    } as unknown as File;

    const extracted = await extractSheetsFromFile(file, { strictPersonalImport: true });
    const byName = new Map(extracted.map((s) => [s.sheetName, s.csvText]));

    const targets: Array<{ sheet: string; category: HealthCategory }> = [
      { sheet: 'Cardiovascular', category: 'cardiovascular' },
      { sheet: 'Sleep', category: 'sleep' },
      { sheet: 'Blood_Labs', category: 'blood' },
    ];

    const seenIndicators = new Set<string>();

    for (const target of targets) {
      const csvText = byName.get(target.sheet);
      expect(csvText).toBeTruthy();

      const inspection = inspectCsvFile(csvText!, `${generated.fileName}#${target.sheet}`);
      const mapping = {
        ...Object.fromEntries(inspection.headers.map((h) => [h, h])),
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
      } as Parameters<typeof prepareCsvImportPreview>[0]['mapping'];

      const preview = await prepareCsvImportPreview({
        profileId: 'local-profile-01',
        category: target.category,
        fileName: `${target.sheet}.csv`,
        sourceFileName: `${generated.fileName}#${target.sheet}`,
        fileFormat: 'xlsx',
        csvText: csvText!,
        dataOrigin: 'SYNTHETIC',
        sourceDataset: 'TUMI-HEALT 90-Day Synthetic Scenario',
        mapping,
      });

      expect(preview.invalid_rows).toHaveLength(0);
      expect(preview.valid_records.length).toBeGreaterThan(0);

      for (const rec of preview.valid_records) {
        expect(rec.data_origin).toBe('SYNTHETIC');
        seenIndicators.add(rec.indicator);
      }
    }

    // Verify 100% coverage of all 52 supported indicators across blood, sleep, cardiovascular
    const allSupportedIndicators = [
      ...Object.keys(INDICATOR_UNIT_REGISTRY.blood),
      ...Object.keys(INDICATOR_UNIT_REGISTRY.sleep),
      ...Object.keys(INDICATOR_UNIT_REGISTRY.cardiovascular),
    ];
    for (const id of allSupportedIndicators) {
      expect(seenIndicators.has(id)).toBe(true);
    }
  });

  it('exhibits gradual 3-stage progressive deterioration across Sleep, Cardiovascular, Blood_Labs, and Daily_CheckIn', () => {
    const generated = buildSyntheticScenarioXlsx(new Date('2026-11-15T12:00:00Z'));
    const wb = XLSX.read(generated.content, { type: 'array' });

    const sleepRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Sleep']);
    const sleepDur = sleepRows.filter((r) => r.indicator === 'sleep_duration' && typeof r.value === 'number');
    const s1Sleep = sleepDur.filter((r) => Number(r.mission_day) <= 30).map((r) => Number(r.value));
    const s2Sleep = sleepDur.filter((r) => Number(r.mission_day) > 30 && Number(r.mission_day) <= 60).map((r) => Number(r.value));
    const s3Sleep = sleepDur.filter((r) => Number(r.mission_day) > 60).map((r) => Number(r.value));

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(s1Sleep)).toBeGreaterThan(avg(s2Sleep));
    expect(avg(s2Sleep)).toBeGreaterThan(avg(s3Sleep));

    const cvRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Cardiovascular']);
    const hrRows = cvRows.filter((r) => r.indicator === 'heart_rate' && typeof r.value === 'number');
    const s1Hr = hrRows.filter((r) => Number(r.mission_day) <= 30).map((r) => Number(r.value));
    const s2Hr = hrRows.filter((r) => Number(r.mission_day) > 30 && Number(r.mission_day) <= 60).map((r) => Number(r.value));
    const s3Hr = hrRows.filter((r) => Number(r.mission_day) > 60).map((r) => Number(r.value));
    expect(avg(s1Hr)).toBeLessThan(avg(s2Hr));
    expect(avg(s2Hr)).toBeLessThan(avg(s3Hr));

    const bloodRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Blood_Labs']);
    const hgbRows = bloodRows.filter((r) => r.indicator === 'hemoglobin');
    expect(hgbRows).toHaveLength(7); // Periodic every 15 days, NOT daily
    expect(Number(hgbRows[0].value)).toBeGreaterThan(Number(hgbRows[6].value));

    const checkIns = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Daily_CheckIn']);
    expect(checkIns).toHaveLength(90);
    expect(Number(checkIns[0].energy_level)).toBeGreaterThan(Number(checkIns[89].energy_level));
    expect(String(checkIns[89].note)).toContain('SYNTHETIC');
  });
});
