import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  cancelCsvImport,
  confirmCsvImport,
  extractSheetsFromFile,
  generateImportTemplate,
  getRecords,
  getIndicatorMetadata,
  INDICATOR_UNIT_REGISTRY,
  inspectCsvFile,
  listImportBatches,
  prepareCsvImportPreview,
  sanitizeCsvCell,
  validateMeasurementFileConstraints,
  type ExtractedSheetCsv,
  type ImportTemplateFormat,
} from '@/services';
import type {
  CsvColumnMapping,
  CsvImportPreview,
  CsvInspectionResult,
  DataOrigin,
  HealthCategory,
  HealthRecord,
  ImportBatch,
  ImportFileFormat,
  ValidationIssue,
} from '@/types';
import {
  MeasurementXmlError,
  parseMeasurementXml,
  type XmlRecordLocation,
} from '@/services/ingestion/xmlMeasurementAdapter';
import { useProfile } from '../context/ProfileContext';
import { Alert, Button, Card, EmptyState, Field, PageHeader, StepProgress, inputClass } from '../components/ui';

type RequiredField = 'timestamp' | 'indicator' | 'value' | 'unit';
const required: RequiredField[] = ['timestamp', 'indicator', 'value', 'unit'];

function guessMapping(headers: string[]): Partial<Record<RequiredField, string>> {
  const find = (...names: string[]) => headers.find((h) => names.includes(h.trim().toLowerCase()));
  return {
    timestamp: find('timestamp', 'date', 'datetime', 'fecha'),
    indicator: find('indicator', 'variable', 'analyte', 'indicador'),
    value: find('value', 'result', 'valor'),
    unit: find('unit', 'units', 'unidad'),
  };
}

function toCsvFileName(originalName: string, sheetName: string): string {
  const base = originalName.replace(/\.(xlsx|xls|csv|xml)$/i, '');
  if (originalName.toLowerCase().endsWith('.csv')) return originalName;
  return `${base}_${sheetName.replace(/\s+/g, '_')}.csv`;
}

function downloadFile(fileName: string, content: string | ArrayBuffer, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getIssueGuidance(issue: ValidationIssue, category: HealthCategory): string | undefined {
  if (issue.code === 'UNKNOWN_INDICATOR') {
    const indicators = Object.keys(INDICATOR_UNIT_REGISTRY[category]);
    return `Supported ${category} indicators: ${indicators.join(', ')}.`;
  }
  if (issue.field === 'unit' && issue.code.toLowerCase().includes('unit')) {
    const allowed = issue.message.match(/expected(?: one of)?\s*:?(.+)$/i)?.[1];
    return allowed ? `Use one of these units: ${allowed}.` : undefined;
  }
  return undefined;
}

function rejectedRowsCsv(preview: CsvImportPreview): string {
  const headers = ['row_number', 'field', 'error_code', 'error_message', ...preview.headers];
  const lines = preview.invalid_rows.flatMap((row) =>
    row.errors.map((issue) =>
      [
        String(row.row_number),
        issue.field,
        issue.code,
        issue.message,
        ...preview.headers.map((header) => row.raw[header] ?? ''),
      ]
        .map(sanitizeCsvCell)
        .join(','),
    ),
  );
  return [headers.map(sanitizeCsvCell).join(','), ...lines].join('\r\n');
}

function isLikelyNasaResearchSheet(headers: string[], sheetCount: number): boolean {
  const set = new Set(headers.map((h) => h.trim()));
  if (set.has('Archivo original') && set.has('Hoja en este Excel')) return true;
  if (set.has('Sample Name') && (set.has('albumin_value_gram_per_deciliter') || set.has('absolute_basophils_value_cells_per_microliter'))) return true;
  if (set.has('aggregation_level') && set.has('group_label')) return true;
  if (set.has('Subject') && set.has('Sleep Latency (hours)')) return true;
  if (set.has('source_dataset') && set.has('quality_status')) return true;
  return sheetCount >= 5;
}

export function ImportPage() {
  const { active, isDemoMode } = useProfile();
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [sheets, setSheets] = useState<ExtractedSheetCsv[]>([]);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [originalFileName, setOriginalFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<ImportFileFormat>('csv');
  const [xmlRecordLocations, setXmlRecordLocations] = useState<Record<number, XmlRecordLocation>>({});
  const [csvText, setCsvText] = useState('');
  const [inspection, setInspection] = useState<CsvInspectionResult | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<RequiredField, string>>>({});
  const [category, setCategory] = useState<HealthCategory>('blood');
  const [origin, setOrigin] = useState<DataOrigin>('GROUND_ANALOG');
  const [sourceDataset, setSourceDataset] = useState('');
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [importedBatch, setImportedBatch] = useState<ImportBatch | null>(null);
  const [importedRecords, setImportedRecords] = useState<HealthRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HealthRecord[]>([]);

  useEffect(() => {
    setBatches([]);
    setHistoryRecords([]);
    setError(null);
    if (!active) {
      return;
    }
    let cancelled = false;
    void listImportBatches(active.astronaut_id)
      .then((loadedBatches) => {
        if (!cancelled) setBatches(loadedBatches);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [active, result]);

  function loadSheet(fileName: string, sheet: ExtractedSheetCsv) {
    const normalizedName = toCsvFileName(fileName, sheet.sheetName);
    const info = inspectCsvFile(sheet.csvText, normalizedName);
    setCsvText(sheet.csvText);
    setInspection(info);
    setMapping(guessMapping(info.headers));
    setSourceDataset(fileName.replace(/\.(csv|xml|xlsx|xls)$/i, ''));
    setPreview(null);
    setImportedBatch(null);
    setImportedRecords([]);
  }

  useEffect(() => {
    if (!active || activeTab !== 'history') return;
    let cancelled = false;
    void getRecords({ astronaut_id: active.astronaut_id })
      .then((records) => {
        if (!cancelled) setHistoryRecords(records.slice().reverse());
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [active, activeTab]);

  function downloadTemplate(format: ImportTemplateFormat) {
    try {
      const template = generateImportTemplate(category, format);
      downloadFile(template.fileName, template.content, template.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function downloadRejectedRows() {
    if (!preview) return;
    const content = rejectedRowsCsv(preview);
    downloadFile('rejected-import-rows.csv', content, 'text/csv;charset=utf-8');
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isDemoMode) {
      setError('Personal data import is unavailable in Demo Mode. Exit Demo Mode before importing your records.');
      e.target.value = '';
      return;
    }
    setError(null);
    setResult(null);
    setPreview(null);
    setImportedBatch(null);
    setImportedRecords([]);
    setXmlRecordLocations({});
    setInspection(null);
    setSheets([]);
    setCsvText('');
    const constraints = validateMeasurementFileConstraints(file.name, file.size);
    if (!constraints.valid || !constraints.format) {
      setError(constraints.error ?? 'The selected file could not be validated.');
      e.target.value = '';
      return;
    }
    try {
      setFileFormat(constraints.format);
      let extracted: ExtractedSheetCsv[];
      if (constraints.format === 'xml') {
        const parsed = parseMeasurementXml(await file.text());
        setXmlRecordLocations(parsed.recordLocations);
        extracted = [{ sheetName: 'XML Measurements', csvText: parsed.csvText }];
      } else {
        extracted = await extractSheetsFromFile(file, { strictPersonalImport: true });
      }
      if (extracted.length === 0) {
        setError('No readable measurement rows were found in the selected file.');
        return;
      }
      setOriginalFileName(file.name);
      setSheets(extracted);
      setSelectedSheetIdx(0);
      loadSheet(file.name, extracted[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        err instanceof MeasurementXmlError && err.line
          ? `${message} (line ${err.line}).`
          : message,
      );
    }
  }

  function onSheetChange(idx: number) {
    setSelectedSheetIdx(idx);
    setError(null);
    setResult(null);
    if (sheets[idx]) {
      loadSheet(originalFileName, sheets[idx]);
    }
  }

  async function onPreview() {
    if (isDemoMode) {
      setError('Personal data import is unavailable in Demo Mode. Exit Demo Mode before importing your records.');
      return;
    }
    if (!active || !inspection) return;
    setError(null);
    if (!required.every((f) => mapping[f])) {
      const missing = required.filter((field) => !mapping[field]);
      setError(
        `Missing required column mapping(s): ${missing.join(', ')}. Detected columns: ${inspection.headers.join(', ') || 'none'}. Choose a column for each required field or use a TUMI-HEALT template.`,
      );
      return;
    }
    try {
      setPreview(
        await prepareCsvImportPreview({
          csvText,
          fileName: inspection.file_name,
          profileId: active.astronaut_id,
          category,
          dataOrigin: origin,
          sourceDataset: sourceDataset || inspection.file_name,
          sourceFileName: originalFileName,
          fileFormat,
          mapping: mapping as CsvColumnMapping,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onConfirm() {
    if (isDemoMode) {
      setError('Personal data import is unavailable in Demo Mode. Exit Demo Mode before importing your records.');
      return;
    }
    if (!preview) return;
    try {
      const res = await confirmCsvImport(preview);
      setResult(`Imported ${res.imported_count} records. Skipped invalid rows: ${res.skipped_invalid_count}.`);
      setImportedBatch(res.batch);
      const importedIds = new Set(res.imported_record_ids);
      const records = await getRecords({ astronaut_id: res.batch.profile_id });
      setImportedRecords(
        records.filter((record) => importedIds.has(record.id) && record.import_batch_id === res.batch.batch_id),
      );
      setPreview(null);
      setInspection(null);
      setSheets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onCancel() {
    if (!preview) return;
    try {
      await cancelCsvImport(preview);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!active) {
    return (
      <>
        <PageHeader title="Upload Your Measurements" />
        <Card>
          <EmptyState>
            Select or{' '}
            <Link to="/profiles" className="text-cyan-400 underline">create an astronaut profile</Link>{' '}
            first, or use{' '}
            <Link to="/research" className="text-cyan-400 underline">Explore NASA Research</Link>{' '}
            for study datasets.
          </EmptyState>
        </Card>
      </>
    );
  }

  const currentStep = result ? 5 : preview ? 3 : inspection ? 2 : 1;
  const exampleTemplate = generateImportTemplate(category, 'csv').content;
  const exampleRow =
    typeof exampleTemplate === 'string' ? exampleTemplate.split('\r\n')[1] : '';

  return (
    <>
      <PageHeader
        eyebrow="Data and Privacy · Personal Import"
        title="My Measurements"
        subtitle={`Import your personal health records to explore your history in TUMI-HEALT (${active.display_name}).`}
        primaryAction={
          <Link
            to="/research"
            className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-500"
          >
            Looking for NASA Studies? Explore NASA Research →
          </Link>
        }
      />
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-slate-800" role="tablist" aria-label="My Measurements">
          {(['import', 'history'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <Card title="Import could not continue">
            <Alert kind="error">{error}</Alert>
            <p className="my-3 text-sm text-slate-300">
              No health records were saved. Fix the issue described above, then retry with a supported file or start from one of these templates.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => downloadTemplate('csv')}>CSV template</Button>
              <Button variant="ghost" onClick={() => downloadTemplate('xml')}>XML template</Button>
              <Button variant="ghost" onClick={() => downloadTemplate('xlsx')}>XLSX template</Button>
            </div>
          </Card>
        )}

        {activeTab === 'import' ? (
          <div className="space-y-6">
        <StepProgress
          steps={[
            'Select a supported file',
            'Review detected columns',
            'Check valid & invalid records',
            'Confirm the import',
            'View imported measurements',
          ]}
          currentStep={currentStep}
        />

        <Alert kind="info">
          <strong>Personal records vs. NASA studies:</strong> Measurements enter the app only by importing a personal time-series file. CSV, XML, and Excel (.xlsx; legacy .xls is also accepted) files are limited to 5 MiB and must include dates such as <code>YYYY-MM-DD</code>. Excel workbooks need flat measurement sheets; multi-sheet raw NASA workbooks belong in{' '}
          <Link to="/research" className="font-semibold underline">Explore NASA Research</Link>.
        </Alert>
        {isDemoMode && (
          <Alert kind="warn">
            Personal data import is disabled in Demo Mode so demonstration data stays separate from your records. Exit Demo Mode to import personal files.
          </Alert>
        )}

        <Card title="What can I upload?">
          <p className="mb-3 text-sm text-slate-300">
            Upload one personal time-series in CSV, XML, or XLSX (maximum 5 MiB). Each measurement needs a timestamp, indicator, numeric value, and unit. XML files use a <code>TUMIMeasurements</code> root with one <code>Measurement</code> element per record. DTDs and entity declarations are not accepted.
          </p>
          <p className="mb-3 text-xs text-slate-400">
            Required columns/elements: <code>timestamp</code>, <code>indicator</code>, <code>value</code>, and <code>unit</code>. Use ISO dates such as <code>2026-01-15T08:00:00Z</code>; future dates are rejected.
          </p>
          <ul className="mb-3 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
            <li>Heart rate: <code>heart_rate</code> · {INDICATOR_UNIT_REGISTRY.cardiovascular.heart_rate.join(', ')}</li>
            <li>Blood pressure: systolic/diastolic · {INDICATOR_UNIT_REGISTRY.cardiovascular.systolic_blood_pressure.join(', ')}</li>
            <li>Sleep: duration/latency/efficiency · {INDICATOR_UNIT_REGISTRY.sleep.sleep_duration.join(', ')}, {INDICATOR_UNIT_REGISTRY.sleep.sleep_efficiency.join(', ')}</li>
            <li>Glucose: <code>glucose</code> · {INDICATOR_UNIT_REGISTRY.blood.glucose.join(', ')}</li>
            <li className="sm:col-span-2">Blood biomarkers: choose a CBC/CMP indicator from the registry list below.</li>
          </ul>
          <p className="mb-3 text-xs text-slate-400">Example row generated from the selected category's template:</p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-slate-950/70 p-3 text-[11px] text-cyan-100">{exampleRow}</pre>
          <details className="mb-4 rounded-lg border border-slate-800 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">
              View supported {category} indicators and accepted units
            </summary>
            <ul className="mt-3 grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
              {Object.entries(INDICATOR_UNIT_REGISTRY[category]).map(([indicator, units]) => {
                const metadata = getIndicatorMetadata(indicator);
                return (
                  <li key={indicator}>
                    <span className="font-medium">{metadata?.name ?? indicator}</span>
                    <span className="text-slate-400"> ({indicator}) · {units.join(', ')}</span>
                  </li>
                );
              })}
            </ul>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => downloadTemplate('csv')}>Download CSV template</Button>
            <Button variant="ghost" onClick={() => downloadTemplate('xml')}>Download XML template</Button>
            <Button variant="ghost" onClick={() => downloadTemplate('xlsx')}>Download XLSX template</Button>
          </div>
        </Card>

        <Card title="1 · File & Context">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="CSV, XML, or Excel File (.csv, .xml, .xlsx; .xls — max 5 MiB)">
              <input
                type="file"
                accept=".csv,.xml,.xlsx,.xls"
                onChange={(e) => void onFile(e)}
                className={inputClass}
                disabled={isDemoMode}
              />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as HealthCategory)}>
                <option value="blood">Blood</option>
                <option value="sleep">Sleep</option>
                <option value="cardiovascular">Cardiovascular</option>
              </select>
            </Field>
            <Field label="Data Origin">
              <select className={inputClass} value={origin} onChange={(e) => setOrigin(e.target.value as DataOrigin)}>
                <option value="GROUND_ANALOG">Ground Analog</option>
                <option value="SPACEFLIGHT">Spaceflight</option>
                <option value="SYNTHETIC">Synthetic</option>
              </select>
            </Field>
          </div>
          {sheets.length > 1 && (
            <div className="mt-4 max-w-sm">
              <Field label="Excel Sheet">
                <select
                  className={inputClass}
                  value={selectedSheetIdx}
                  onChange={(e) => onSheetChange(Number(e.target.value))}
                >
                  {sheets.map((s, idx) => (
                    <option key={s.sheetName} value={idx}>
                      {s.sheetName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </Card>

        {inspection && isLikelyNasaResearchSheet(inspection.headers, sheets.length) && (
          <Alert kind="warn">
            This file looks like a <strong>NASA Research dataset or combined workbook</strong> ({sheets.length} sheet{sheets.length === 1 ? '' : 's'}),
            not a personal astronaut time-series CSV. Please upload it on the{' '}
            <Link to="/research" className="font-semibold underline">NASA Research (/research)</Link>{' '}
            page, where <strong>Auto-Detect</strong> will process all sheets automatically.
          </Alert>
        )}

        {inspection && (
          <Card title={`2 · Column Mapping (${inspection.total_rows} rows)`}>
            <div className="grid gap-4 md:grid-cols-5">
              {required.map((f) => (
                <Field key={f} label={f}>
                  <select className={inputClass} value={mapping[f] ?? ''} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}>
                    <option value="">— choose —</option>
                    {inspection.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              ))}
              <Field label="Source Dataset">
                <input className={inputClass} value={sourceDataset} onChange={(e) => setSourceDataset(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-400">
                <thead>
                  <tr>{inspection.headers.map((h) => <th key={h} className="pb-1 pr-4 text-slate-400">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {inspection.sample_rows.map((row, i) => (
                    <tr key={i}>{inspection.headers.map((h) => <td key={h} className="pr-4">{row[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="mt-4" onClick={() => void onPreview()}>Validate & Preview</Button>
          </Card>
        )}

        {preview && (
          <Card title="3 · Preview">
            <div className="mb-4 flex gap-6 text-sm">
              <span className="text-emerald-300">Valid: {preview.valid_records.length}</span>
              <span className="text-rose-300">Invalid: {preview.invalid_rows.length}</span>
            </div>
            {preview.invalid_rows.length > 0 && (
              <>
                <Alert kind="warn">
                  Only the {preview.valid_records.length} valid row(s) will be imported if you continue. The {preview.invalid_rows.length} rejected row(s) will be skipped; review them or download the rejection report below.
                </Alert>
                <ul className="my-4 max-h-64 space-y-3 overflow-y-auto text-xs text-rose-200">
                  {preview.invalid_rows.map((row) => {
                    const location = xmlRecordLocations[row.row_number];
                    return (
                      <li key={row.row_number} className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3">
                        <p className="mb-1 font-semibold">
                          Row {row.row_number}
                          {fileFormat === 'xml' && location ? ` · XML line ${location.line}` : ''}
                        </p>
                        {location?.missingElements.length ? (
                          <p className="mb-1 text-amber-200">
                            Missing required XML element(s): {location.missingElements.map((name) => `<${name}>`).join(', ')}.
                          </p>
                        ) : null}
                        {row.errors.map((issue, index) => (
                          <p key={`${issue.code}-${index}`} className="text-rose-200">
                            {issue.field} · {issue.code}: {issue.message}
                            {getIssueGuidance(issue, category) ? ` ${getIssueGuidance(issue, category)}` : ''}
                          </p>
                        ))}
                      </li>
                    );
                  })}
                </ul>
                <Button variant="ghost" onClick={downloadRejectedRows}>
                  Download rejected rows report
                </Button>
              </>
            )}
            <div className="flex gap-3">
              <Button onClick={() => void onConfirm()} disabled={preview.valid_records.length === 0}>
                {preview.invalid_rows.length > 0
                  ? `Import ${preview.valid_records.length} valid rows and skip ${preview.invalid_rows.length} invalid`
                  : `Confirm import of ${preview.valid_records.length} rows`}
              </Button>
              <Button variant="ghost" onClick={() => void onCancel()}>Cancel</Button>
            </div>
          </Card>
        )}

        {result && <Alert kind="success">{result}</Alert>}

        {result && importedBatch && (
          <Card
            title={`5 · Imported measurements (${importedRecords.length})`}
            subtitle={`Records from ${importedBatch.file_name}, matched to this import batch.`}
          >
            {importedRecords.length === 0 ? (
              <EmptyState>No records were imported from this batch.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Indicator</th>
                      <th className="py-2 pr-3">Value</th>
                      <th className="py-2 pr-3">Origin</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {importedRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="py-2.5 pr-3">{record.timestamp.slice(0, 16).replace('T', ' ')}</td>
                        <td className="py-2.5 pr-3 font-medium text-white">{record.indicator}</td>
                        <td className="py-2.5 pr-3 text-cyan-300">
                          {record.value === null ? 'Missing' : `${record.value} ${record.unit}`}
                        </td>
                        <td className="py-2.5 pr-3">{record.data_origin}</td>
                        <td className="py-2.5">{record.source_dataset}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

          </div>
        ) : (
          <div className="space-y-6">
            <Card title={`Measurement History (${historyRecords.length})`}>
              {historyRecords.length === 0 ? (
                <EmptyState>No personal measurements are recorded for {active.display_name} yet.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Indicator</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Origin</th>
                        <th className="py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-300">
                      {historyRecords.slice(0, 100).map((record) => (
                        <tr key={record.id}>
                          <td className="py-2.5 pr-3">{record.timestamp.slice(0, 16).replace('T', ' ')}</td>
                          <td className="py-2.5 pr-3">{record.category}</td>
                          <td className="py-2.5 pr-3 font-medium text-white">{record.indicator}</td>
                          <td className="py-2.5 pr-3 text-cyan-300">
                            {record.value === null ? 'Missing' : `${record.value} ${record.unit}`}
                          </td>
                          <td className="py-2.5 pr-3">{record.data_origin}</td>
                          <td className="py-2.5">{record.source_dataset}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {historyRecords.length > 100 && (
                    <p className="mt-3 text-xs text-slate-400">Showing the latest 100 measurements.</p>
                  )}
                </div>
              )}
            </Card>
            <Card title={`Import Batches (${batches.length})`}>
              {batches.length === 0 ? (
                <EmptyState>No personal import batches recorded for {active.display_name} yet.</EmptyState>
              ) : (
                <ul className="divide-y divide-slate-800 text-xs">
                  {batches.slice(0, 50).map((batch) => (
                    <li key={batch.batch_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <span className="font-medium text-slate-200">{batch.file_name}</span>{' '}
                        <span className="text-slate-400">· {(batch.file_format ?? 'csv').toUpperCase()} · {batch.category} · {batch.status}</span>
                      </div>
                      <span className="text-slate-400">
                        {batch.imported_record_ids.length}/{batch.total_rows} imported · {new Date(batch.created_at).toLocaleDateString('en-US')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
