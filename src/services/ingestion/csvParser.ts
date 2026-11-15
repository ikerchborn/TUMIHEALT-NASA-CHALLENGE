/**
 * Lightweight RFC-4180 compatible CSV parser for browser and Node environments.
 * Handles quoted fields, escaped quotes (""), CRLF/LF line endings, and BOM.
 */
export interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvRows(csvText: string): string[][] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let currentLine = 1;
  let quoteStartLine = 1;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
        if (char === '\n' || (char === '\r' && nextChar !== '\n')) {
          currentLine += 1;
        }
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      quoteStartLine = currentLine;
    } else if (char === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 1;
      currentLine += 1;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      currentLine += 1;
    } else {
      currentField += char;
    }
  }

  if (inQuotes) {
    throw new Error(`Malformed CSV: unclosed quoted field opened on line ${quoteStartLine}.`);
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function parseCsv(csvText: string): ParsedCsvData {
  const matrix = parseCsvRows(csvText);
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0];
  const unsafeHeaderIndex = headers.findIndex((header) =>
    ['__proto__', 'constructor', 'prototype'].includes(header),
  );
  if (unsafeHeaderIndex >= 0) {
    const header = headers[unsafeHeaderIndex];
    throw new Error(
      `Unsupported CSV header "${header}" at column ${unsafeHeaderIndex + 1} (header row 1). Rename it and upload a TUMI-HEALT CSV, XML, or XLSX template.`,
    );
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const rowCells = matrix[i];
    const record = Object.create(null) as Record<string, string>;
    for (let col = 0; col < headers.length; col += 1) {
      record[headers[col]] = rowCells[col] ?? '';
    }
    rows.push(record);
  }

  return { headers, rows };
}
