import { MAX_MEASUREMENT_FILE_BYTES } from '@/services/security';

const requiredElements = ['timestamp', 'indicator', 'value', 'unit'] as const;
const supportedElements = [
  ...requiredElements,
  'astronaut_id',
  'quality_status',
  'sample_id',
  'specimen_type',
  'assay',
  'sleep_start',
  'sleep_end',
  'sleep_duration',
  'sleep_efficiency',
  'sleep_latency',
  'heart_rate',
  'systolic_blood_pressure',
  'diastolic_blood_pressure',
  'cardiac_output',
  'activity_context',
  'sleep_state',
  'device_id',
] as const;

export interface XmlRecordLocation {
  line: number;
  missingElements: string[];
}

export interface ParsedMeasurementXml {
  csvText: string;
  recordLocations: Record<number, XmlRecordLocation>;
}

export class MeasurementXmlError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'EMPTY_XML'
      | 'FILE_TOO_LARGE'
      | 'UNSAFE_XML'
      | 'UNSAFE_FIELD_NAME'
      | 'MALFORMED_XML'
      | 'INVALID_XML_SCHEMA'
      | 'XML_PARSER_UNAVAILABLE',
    readonly line?: number,
  ) {
    super(message);
    this.name = 'MeasurementXmlError';
  }
}

function lineAt(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r\n|\r|\n/).length;
}

function enforceNestingLimit(source: string): void {
  const maxDepth = 32;
  let depth = 0;
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    if (start < 0) return;

    if (source.startsWith('<!--', start)) {
      const end = source.indexOf('-->', start + 4);
      if (end < 0) return;
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', start)) {
      const end = source.indexOf(']]>', start + 9);
      if (end < 0) return;
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<?', start)) {
      const end = source.indexOf('?>', start + 2);
      if (end < 0) return;
      cursor = end + 2;
      continue;
    }

    let quote: '"' | "'" | undefined;
    let end = start + 1;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (quote) {
        if (char === quote) quote = undefined;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
    }
    if (end >= source.length) return;

    const tag = source.slice(start + 1, end).trim();
    if (tag.startsWith('!')) {
      cursor = end + 1;
      continue;
    }
    if (tag.startsWith('/')) {
      depth = Math.max(0, depth - 1);
    } else {
      depth += 1;
      if (depth > maxDepth) {
        const line = lineAt(source, start);
        throw new MeasurementXmlError(
          `XML nesting exceeds ${maxDepth} levels at line ${line}. Use a flat TUMI-HEALT XML template or upload CSV instead.`,
          'UNSAFE_XML',
          line,
        );
      }
      if (/\/\s*$/.test(tag)) depth -= 1;
    }
    cursor = end + 1;
  }
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function elementValues(element: Element, xmlText: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const child of Array.from(element.children)) {
    if (['__proto__', 'constructor', 'prototype'].includes(child.localName)) {
      const escapedName = child.localName;
      const match = new RegExp(`<(?:(?:[\\w.-]+):)?${escapedName}(?:\\s|>)`).exec(xmlText);
      const line = lineAt(xmlText, match?.index ?? 0);
      throw new MeasurementXmlError(
        `Unsupported XML element <${child.localName}> at line ${line}. Rename it and upload a TUMI-HEALT XML template or CSV file.`,
        'UNSAFE_FIELD_NAME',
        line,
      );
    }
    values.set(child.localName, child.textContent?.trim() ?? '');
  }
  return values;
}

function findMeasurementLine(xmlText: string, index: number): number {
  const comments = [...xmlText.matchAll(/<!--[\s\S]*?-->/g)]
    .map((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }));
  const matches = [...xmlText.matchAll(/<(?:[\w.-]+:)?Measurement\b(?:\s[^>]*)?\s*\/?>/g)]
    .filter((match) => {
      const position = match.index ?? -1;
      return !comments.some(({ start, end }) => position >= start && position < end);
    });
  const match = matches[index];
  return match?.index === undefined ? 1 : lineAt(xmlText, match.index);
}

export function parseMeasurementXml(xmlText: string): ParsedMeasurementXml {
  if (!xmlText.trim()) {
    throw new MeasurementXmlError('The XML file is empty.', 'EMPTY_XML', 1);
  }
  if (new TextEncoder().encode(xmlText).byteLength > MAX_MEASUREMENT_FILE_BYTES) {
    throw new MeasurementXmlError('The XML file exceeds the 5 MiB limit.', 'FILE_TOO_LARGE');
  }
  const unsafeDeclarationIndex = xmlText.search(/<!DOCTYPE\b|<!ENTITY\b/i);
  if (unsafeDeclarationIndex >= 0) {
    const line = lineAt(xmlText, unsafeDeclarationIndex);
    throw new MeasurementXmlError(
      `DTD and entity declarations are not allowed in measurement XML (line ${line}).`,
      'UNSAFE_XML',
      line,
    );
  }
  enforceNestingLimit(xmlText);
  if (typeof DOMParser === 'undefined') {
    throw new MeasurementXmlError(
      'XML parsing is unavailable in this browser. Use the CSV or XLSX template instead.',
      'XML_PARSER_UNAVAILABLE',
    );
  }

  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    const text = parserError.textContent ?? 'Malformed XML.';
    const lineMatch =
      /(?:line|Line Number)\s*[:=]?\s*(\d+)/i.exec(text) ??
      /^\s*(\d+):\d+:/.exec(text);
    throw new MeasurementXmlError(
      `The XML file is not well formed: ${text.trim()}`,
      'MALFORMED_XML',
      lineMatch ? Number(lineMatch[1]) : undefined,
    );
  }

  const root = document.documentElement;
  if (root.localName !== 'TUMIMeasurements') {
    throw new MeasurementXmlError(
      'The XML root must be <TUMIMeasurements>.',
      'INVALID_XML_SCHEMA',
      1,
    );
  }

  const measurements = Array.from(root.children).filter(
    (element) => element.localName === 'Measurement',
  );
  if (measurements.length === 0) {
    throw new MeasurementXmlError(
      'No <Measurement> elements were found under <TUMIMeasurements>.',
      'INVALID_XML_SCHEMA',
      1,
    );
  }

  const rows = measurements.map((measurement, index) => {
    const values = elementValues(measurement, xmlText);
    const missingElements = requiredElements.filter(
      (name) => !values.has(name) || values.get(name) === '',
    );
    const line = findMeasurementLine(xmlText, index);
    const csvRow = supportedElements.map((name) => values.get(name) ?? '');
    return {
      csvRow,
      location: { line, missingElements: [...missingElements] },
    };
  });

  return {
    csvText: [
      supportedElements.map(escapeCsv).join(','),
      ...rows.map(({ csvRow }) => csvRow.map(escapeCsv).join(',')),
    ].join('\r\n'),
    recordLocations: Object.fromEntries(
      rows.map(({ location }, index) => [index + 2, location]),
    ),
  };
}
