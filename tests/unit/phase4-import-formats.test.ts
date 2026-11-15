import * as XLSX from 'xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractSheetsFromFile,
  findFormulaWithoutStoredResult,
} from '@/services/dataEngineering/etl/spreadsheetAdapter';
import { generateImportTemplate } from '@/services/ingestion/importTemplateService';
import {
  MeasurementXmlError,
  parseMeasurementXml,
} from '@/services/ingestion/xmlMeasurementAdapter';
import {
  MAX_MEASUREMENT_FILE_BYTES,
  decodeUtf8Text,
  validateMeasurementFileConstraints,
} from '@/services/security';
import { inspectCsvFile } from '@/services/ingestion/csvImportService';
import { parseCsv } from '@/services/ingestion/csvParser';

class FakeElement {
  constructor(
    readonly localName: string,
    readonly textContent: string,
    readonly children: FakeElement[] = [],
  ) {}
}

class FakeDomParser {
  parseFromString(source: string) {
    if (source.includes('<broken')) {
      return {
        documentElement: new FakeElement('parsererror', 'XML parsing failed at line 2.'),
        getElementsByTagName: (name: string) => name === 'parsererror'
          ? [new FakeElement('parsererror', 'XML parsing failed at line 2.')]
          : [],
      };
    }

    const measurements = [...source.matchAll(/<Measurement>([\s\S]*?)<\/Measurement>/g)]
      .map(([, body]) => {
        const children = [...body.matchAll(/<([\w-]+)>([\s\S]*?)<\/\1>/g)]
          .map(([, name, value]) => new FakeElement(name, value.trim()));
        return new FakeElement('Measurement', '', children);
      });
    return {
      documentElement: new FakeElement('TUMIMeasurements', '', measurements),
      getElementsByTagName: () => [],
    };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Phase 4 import formats', () => {
  it('explains unsupported, empty, and oversized personal measurement files', () => {
    expect(validateMeasurementFileConstraints('data.json', 10).error).toMatch(/not supported/i);
    expect(validateMeasurementFileConstraints('empty.csv', 0).error).toMatch(/empty/i);
    expect(validateMeasurementFileConstraints('large.xml', MAX_MEASUREMENT_FILE_BYTES + 1).error)
      .toMatch(/5 MiB/i);
    expect(validateMeasurementFileConstraints('records.xml', 10)).toMatchObject({
      valid: true,
      format: 'xml',
    });
  });

  it('reports CSV files with alternate delimiters, no rows, or malformed quoting', () => {
    expect(() => inspectCsvFile('', 'empty.csv')).toThrow(/empty/i);
    expect(() => inspectCsvFile('a;b\n1;2', 'semicolon.csv')).toThrow(/delimiter/i);
    expect(() => inspectCsvFile('date;note\n2026-01-01,"comma, inside text"', 'semicolon.csv'))
      .toThrow(/delimiter/i);
    expect(() => inspectCsvFile('a,b', 'headers-only.csv')).toThrow(/no measurement rows/i);
    expect(() => inspectCsvFile('a,b\n"unfinished,1', 'broken.csv')).toThrow(/unclosed quoted.*line 2/i);
  });

  it('rejects hostile CSV header names with a location and upload guidance without changing prototypes', () => {
    for (const header of ['__proto__', 'constructor', 'prototype']) {
      expect(() => parseCsv(`${header},timestamp,indicator,value,unit\nx,2026-10-10,glucose,95,mg/dL`))
        .toThrow(new RegExp(`${header}.*column 1.*header row 1.*template`, 'i'));
      expect(Object.prototype).not.toHaveProperty('polluted');
    }

    const parsed = parseCsv('timestamp,indicator,value,unit\n2026-10-10,glucose,95,mg/dL');
    expect(Object.getPrototypeOf(parsed.rows[0])).toBeNull();
  });

  it('rejects invalid UTF-8 bytes with an explicit re-upload format', () => {
    expect(() => decodeUtf8Text(new Uint8Array([0xc3, 0x28]).buffer))
      .toThrow(/invalid UTF-8.*CSV or XML.*XLSX/i);
  });

  it('generates CSV, XML, and XLSX templates with the shared required field names', () => {
    const csv = generateImportTemplate('blood', 'csv');
    expect(csv.content).toContain('"timestamp","indicator","value","unit"');

    const xml = generateImportTemplate('sleep', 'xml');
    expect(xml.content).toContain('<TUMIMeasurements>');
    expect(xml.content).toContain('<Measurement>');
    expect(xml.content).toContain('<indicator>sleep_duration</indicator>');

    const xlsx = generateImportTemplate('cardiovascular', 'xlsx');
    expect(xlsx.content).toBeInstanceOf(ArrayBuffer);
    const workbook = XLSX.read(xlsx.content, { type: 'array' });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Measurements, { header: 1 })[0])
      .toEqual(['timestamp', 'indicator', 'value', 'unit']);
  });

  it('parses safe XML records and retains element-missing locations', () => {
    vi.stubGlobal('DOMParser', FakeDomParser);
    const parsed = parseMeasurementXml(
      '<TUMIMeasurements>\n  <Measurement>\n    <indicator>glucose</indicator>\n    <value>95</value>\n    <unit>mg/dL</unit>\n  </Measurement>\n</TUMIMeasurements>',
    );
    expect(parsed.csvText).toContain('"timestamp","indicator","value","unit"');
    expect(parsed.recordLocations[2].missingElements).toEqual(['timestamp']);
    expect(parsed.recordLocations[2].line).toBe(2);
  });

  it('rejects unsafe and malformed XML with actionable codes and locations', () => {
    expect(() => parseMeasurementXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///private">]><x/>'))
      .toThrowError(MeasurementXmlError);
    vi.stubGlobal('DOMParser', FakeDomParser);
    try {
      parseMeasurementXml('<broken');
      throw new Error('Expected malformed XML to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MeasurementXmlError);
      expect(error).toMatchObject({ code: 'MALFORMED_XML', line: 2 });
    }
  });

  it('rejects deeply nested XML before DOM parsing with a line and template recommendation', () => {
    const nested = `${'<node>'.repeat(33)}${'</node>'.repeat(33)}`;
    expect(() => parseMeasurementXml(`<TUMIMeasurements>\n${nested}\n</TUMIMeasurements>`))
      .toThrowError(MeasurementXmlError);
    try {
      parseMeasurementXml(`<TUMIMeasurements>\n${nested}\n</TUMIMeasurements>`);
    } catch (error) {
      expect(error).toMatchObject({ code: 'UNSAFE_XML', line: 2 });
      expect((error as Error).message).toMatch(/32 levels.*line 2.*XML template.*CSV/i);
    }
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects hostile XML element name %s with a source line and upload guidance',
    (name) => {
      vi.stubGlobal('DOMParser', FakeDomParser);
      const xml = `<TUMIMeasurements>\n  <Measurement>\n    <${name}>x</${name}>\n  </Measurement>\n</TUMIMeasurements>`;
      try {
        parseMeasurementXml(xml);
        throw new Error('Expected a hostile element name to fail.');
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNSAFE_FIELD_NAME', line: 3 });
        expect((error as Error).message).toMatch(new RegExp(`${name}.*line 3.*XML template.*CSV`, 'i'));
        expect(Object.prototype).not.toHaveProperty('polluted');
      }
    },
  );

  it('rejects merged cells in strict personal XLSX imports without affecting default extraction', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['timestamp', 'indicator', 'value', 'unit'],
      ['2026-01-01', 'glucose', '95', 'mg/dL'],
    ]);
    sheet['!merges'] = [XLSX.utils.decode_range('A1:B1')];
    XLSX.utils.book_append_sheet(workbook, sheet, 'Measurements');
    const file = new File(
      [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })],
      'measurements.xlsx',
    );

    await expect(extractSheetsFromFile(file, { strictPersonalImport: true }))
      .rejects.toThrow(/merged cell/i);
    await expect(extractSheetsFromFile(file)).resolves.toHaveLength(1);
  });

  it('rejects personal XLSX formulas without a cached value', async () => {
    const sheet: XLSX.WorkSheet = {
      C2: { t: 'n', f: '90+5' },
      D2: { t: 'n', f: '90+5', v: 95 },
      '!ref': 'C2:D2',
    };
    expect(findFormulaWithoutStoredResult(sheet)).toEqual(['C2']);
    expect(findFormulaWithoutStoredResult({ D2: { t: 'n', f: '90+5', v: 95 } })).toEqual([]);
  });

  it('rejects XLSX workbooks without a readable data sheet', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty');
    const file = new File(
      [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })],
      'empty.xlsx',
    );

    await expect(extractSheetsFromFile(file, { strictPersonalImport: true }))
      .rejects.toThrow(/0 readable data sheets.*1 worksheet/i);
  });
});
