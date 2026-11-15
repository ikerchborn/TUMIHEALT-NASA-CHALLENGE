import * as XLSX from 'xlsx';
import type { HealthCategory, ImportFileFormat } from '@/types';
import { INDICATOR_UNIT_REGISTRY } from '@/services/validation/unitRegistry';
import { getIndicatorMetadata } from '@/services/indicators/indicatorCatalog';

const headers = ['timestamp', 'indicator', 'value', 'unit'];

const templateIndicator: Record<HealthCategory, string> = {
  blood: 'glucose',
  sleep: 'sleep_duration',
  cardiovascular: 'heart_rate',
};

function getSample(category: HealthCategory): string[] {
  const indicator = templateIndicator[category];
  const unit = INDICATOR_UNIT_REGISTRY[category][indicator]?.[0];
  if (!unit || !getIndicatorMetadata(indicator)) {
    throw new Error(`No verified template indicator is available for ${category}.`);
  }
  const timestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const value = category === 'blood' ? '95' : category === 'sleep' ? '7' : '68';
  return [timestamp, indicator, value, unit];
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toXmlElement(name: string, value: string): string {
  return `    <${name}>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${name}>`;
}

export interface GeneratedImportTemplate {
  fileName: string;
  mimeType: string;
  content: string | ArrayBuffer;
}

export type ImportTemplateFormat = Exclude<ImportFileFormat, 'xls'>;

export function generateImportTemplate(
  category: HealthCategory,
  format: ImportTemplateFormat,
): GeneratedImportTemplate {
  const row = getSample(category);
  const fileName = `tumi-${category}-template.${format}`;

  if (format === 'csv') {
    return {
      fileName,
      mimeType: 'text/csv;charset=utf-8',
      content: [headers, row].map((line) => line.map(toCsvCell).join(',')).join('\r\n'),
    };
  }

  if (format === 'xml') {
    const measurement = headers.map((header, index) => toXmlElement(header, row[index])).join('\n');
    return {
      fileName,
      mimeType: 'application/xml;charset=utf-8',
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<TUMIMeasurements>\n  <Measurement>\n${measurement}\n  </Measurement>\n</TUMIMeasurements>\n`,
    };
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, row]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Measurements');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return {
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content,
  };
}
