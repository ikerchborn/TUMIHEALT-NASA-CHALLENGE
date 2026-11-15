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

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function elementValues(element: Element): Map<string, string> {
  const values = new Map<string, string>();
  for (const child of Array.from(element.children)) {
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
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xmlText)) {
    throw new MeasurementXmlError(
      'DTD and entity declarations are not allowed in measurement XML.',
      'UNSAFE_XML',
    );
  }
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
    const values = elementValues(measurement);
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
