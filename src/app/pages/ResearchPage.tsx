import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  autoProcessNasaSheet,
  extractSheetsFromFile,
  processActigraphyDataset,
  processApolloDataset,
  processCbcDataset,
  processCmpDataset,
  processProcessedResearchCsv,
  queryResearchAggregates,
  queryResearchDatasetRecords,
  saveResearchAggregates,
  saveResearchDatasetRecords,
} from '@/services';
import type {
  EtlProcessingReport,
  ResearchAggregate,
  ResearchDatasetRecord,
} from '@/types';
import { useProfile } from '../context/ProfileContext';
import {
  Alert,
  Card,
  EmptyState,
  Field,
  OriginBadge,
  PageHeader,
  StatCard,
  inputClass,
} from '../components/ui';

type NasaEtlSource = 'auto' | 'cmp' | 'cbc' | 'actigraphy' | 'apollo' | 'processed_csv';

const SOURCE_OPTIONS: Array<{ value: NasaEtlSource; label: string; hint: string }> = [
  {
    value: 'auto',
    label: 'Auto-Detect (Recommended — CSV, Excel .xlsx/.xls, data/processed/*)',
    hint: 'Automatically detects OSD-575 CMP, OSD-569 CBC, UTMB Actigraphy, Apollo AP005, multi-sheet Excel workbooks, or pre-processed NASA CSVs.',
  },
  {
    value: 'cmp',
    label: 'OSD-575 — Raw CMP (Serum, wide format)',
    hint: 'Raw Comprehensive Metabolic Panel CSV/Excel (preserves relative timepoints L-3, R+1 without inventing ISO dates).',
  },
  {
    value: 'cbc',
    label: 'OSD-569 — Raw CBC (Whole blood, file labeled OSD-596)',
    hint: 'Raw Complete Blood Count CSV/Excel; flags hemoglobin (%) for unit verification.',
  },
  {
    value: 'actigraphy',
    label: 'UTMB Campaign 1 — Raw Actigraphy (BRSMACT)',
    hint: 'Raw actigraphy file(s) (M/D/YYYY & HH:mm); deduplicates identical copies.',
  },
  {
    value: 'apollo',
    label: 'Apollo AP005 — Cardiovascular Cohort Aggregates',
    hint: 'Normalized Apollo cohort CSV (cardiovascular_processed.csv); stored strictly in research_aggregates.',
  },
  {
    value: 'processed_csv',
    label: 'Pre-processed NASA CSV (blood_processed.csv / sleep_processed.csv)',
    hint: 'Imports normalized long-format NASA research CSVs into research_records.',
  },
];

export function ResearchPage() {
  const { isDemoMode } = useProfile();
  const [etlSource, setEtlSource] = useState<NasaEtlSource>('auto');
  const [report, setReport] = useState<EtlProcessingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [records, setRecords] = useState<ResearchDatasetRecord[]>([]);
  const [aggregates, setAggregates] = useState<ResearchAggregate[]>([]);
  const [tab, setTab] = useState<'records' | 'aggregates'>('records');

  const [datasetFilter, setDatasetFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [indicatorQuery, setIndicatorQuery] = useState<string>('');

  const loadStoredResearch = useCallback(async () => {
    const [recs, aggs] = await Promise.all([
      queryResearchDatasetRecords(),
      queryResearchAggregates(),
    ]);
    setRecords(recs);
    setAggregates(aggs);
  }, []);

  useEffect(() => {
    void loadStoredResearch();
  }, [loadStoredResearch]);

  async function onUploadNasaFile(e: ChangeEvent<HTMLInputElement>) {
    if (isDemoMode) {
      setError('Research file import is unavailable in Demo Mode. Exit Demo Mode before importing a dataset.');
      e.target.value = '';
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setStatusMsg(null);
    setReport(null);

    try {
      const extractedPerFile = await Promise.all(
        Array.from(files).map(async (f) => ({
          fileName: f.name,
          sheets: await extractSheetsFromFile(f),
        })),
      );
      const primaryName = files[0].name;

      if (etlSource === 'auto') {
        const allResearch: ResearchDatasetRecord[] = [];
        const allAggregates: ResearchAggregate[] = [];
        const actigraphyTexts: string[] = [];
        const matchedLabels: string[] = [];
        let lastReport: EtlProcessingReport | null = null;

        for (const item of extractedPerFile) {
          for (const sheet of item.sheets) {
            const labelName =
              item.sheets.length > 1 ? `${item.fileName} [${sheet.sheetName}]` : item.fileName;
            const res = autoProcessNasaSheet(sheet.csvText, labelName);
            if (res.kind === 'research') {
              if (res.label.startsWith('UTMB Actigraphy')) {
                actigraphyTexts.push(sheet.csvText);
              } else {
                allResearch.push(...res.researchRecords);
              }
              matchedLabels.push(res.label);
              if (res.report) lastReport = res.report;
            } else if (res.kind === 'aggregate') {
              allAggregates.push(...res.aggregates);
              matchedLabels.push(res.label);
              if (res.report) lastReport = res.report;
            }
          }
        }

        if (actigraphyTexts.length > 0) {
          const actRes = processActigraphyDataset(actigraphyTexts, primaryName);
          allResearch.push(...actRes.researchRecords);
          lastReport = actRes.report;
        }

        if (allResearch.length === 0 && allAggregates.length === 0) {
          setError(
            'Could not auto-detect a supported NASA dataset format in the uploaded file/sheets. Try selecting a specific ETL source.',
          );
          return;
        }

        if (allResearch.length > 0) await saveResearchDatasetRecords(allResearch);
        if (allAggregates.length > 0) await saveResearchAggregates(allAggregates);

        setReport(lastReport);
        setStatusMsg(
          `Processed ${matchedLabels.join(', ')}: saved ${allResearch.length} research observations and ${allAggregates.length} cohort aggregates.`,
        );
        setTab(allAggregates.length > 0 && allResearch.length === 0 ? 'aggregates' : 'records');
      } else if (etlSource === 'cmp') {
        const text = extractedPerFile[0].sheets[0].csvText;
        const res = processCmpDataset(text, primaryName);
        await saveResearchDatasetRecords(res.records);
        setReport(res.report);
        setStatusMsg(`OSD-575 ETL complete: ${res.records.length} observations saved to research_records.`);
        setTab('records');
      } else if (etlSource === 'cbc') {
        const text = extractedPerFile[0].sheets[0].csvText;
        const res = processCbcDataset(text, primaryName);
        await saveResearchDatasetRecords(res.records);
        setReport(res.report);
        setStatusMsg(`OSD-569 ETL complete: ${res.records.length} observations saved to research_records.`);
        setTab('records');
      } else if (etlSource === 'actigraphy') {
        const texts = extractedPerFile.flatMap((f) => f.sheets.map((s) => s.csvText));
        const res = processActigraphyDataset(texts, primaryName);
        await saveResearchDatasetRecords(res.researchRecords);
        setReport(res.report);
        setStatusMsg(
          `Actigraphy ETL complete: ${res.researchRecords.length} observations saved (${res.report.deduplicated_count} duplicates skipped).`,
        );
        setTab('records');
      } else if (etlSource === 'processed_csv') {
        const text = extractedPerFile[0].sheets[0].csvText;
        const res = processProcessedResearchCsv(text, primaryName);
        await saveResearchDatasetRecords(res.records);
        setReport(res.report);
        setStatusMsg(`Processed NASA CSV imported: ${res.records.length} observations saved to research_records.`);
        setTab('records');
      } else {
        const text = extractedPerFile[0].sheets[0].csvText;
        const res = processApolloDataset(text, primaryName);
        await saveResearchAggregates(res.aggregates);
        setReport(res.report);
        setStatusMsg(`Apollo AP005 ETL complete: ${res.aggregates.length} aggregates saved to research_aggregates.`);
        setTab('aggregates');
      }

      await loadStoredResearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = '';
    }
  }

  const datasets = useMemo(
    () => Array.from(new Set(records.map((r) => r.source_dataset))).sort(),
    [records],
  );

  const subjects = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .filter((r) => datasetFilter === 'ALL' || r.source_dataset === datasetFilter)
            .map((r) => r.source_subject_id),
        ),
      ).sort(),
    [records, datasetFilter],
  );

  const filteredRecords = useMemo(() => {
    const q = indicatorQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (datasetFilter !== 'ALL' && r.source_dataset !== datasetFilter) return false;
      if (subjectFilter !== 'ALL' && r.source_subject_id !== subjectFilter) return false;
      if (q && !r.indicator.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, datasetFilter, subjectFilter, indicatorQuery]);

  const filteredAggregates = useMemo(() => {
    const q = indicatorQuery.trim().toLowerCase();
    return aggregates.filter((a) => !q || a.indicator.toLowerCase().includes(q));
  }, [aggregates, indicatorQuery]);

  const activeSourceMeta = SOURCE_OPTIONS.find((o) => o.value === etlSource)!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data and Privacy · Scientific Evidence"
        title="Explore NASA Research"
        subtitle="Discover scientific studies that help us understand how spaceflight and space-related conditions affect human health."
        primaryAction={
          <Link
            to="/import"
            className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-500"
          >
            Uploading Personal Data? Go to Upload Your Measurements →
          </Link>
        }
      />

      <Alert kind="info">
        <strong>Scientific research, not your personal health records.</strong> Research observations and cohort summaries stay separate from personal measurements, trends, and baselines.
      </Alert>

      {/* A. Research Overview & B. Dataset Catalog */}
      <Card
        title="NASA Research Dataset Catalog"
        subtitle="Each dataset is labeled by its scientific origin and stored separately from personal astronaut records."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-panel border border-mission-border bg-mission-canvas/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">OSD-575 (LSDS-8 CMP)</p>
              <OriginBadge origin="SPACEFLIGHT" />
            </div>
            <p className="mt-1 text-slate-300">NASA OSDR · Blood (Metabolic Panel) · Spaceflight Study</p>
            <p className="mt-2 leading-relaxed text-slate-300">
              Serum metabolic and nutritional biomarkers (albumin, glucose, creatinine, calcium, electrolytes) across relative mission timepoints.
            </p>
            <details className="mt-2 text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-200">Research details &amp; limitations</summary>
              <p className="mt-1.5">
                Uses relative timepoints (e.g. L-3, R+1) instead of absolute ISO dates; missing timestamps are never invented.
              </p>
            </details>
          </div>

          <div className="rounded-panel border border-mission-border bg-mission-canvas/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">OSD-596 / OSD-569 (LSDS-7 CBC)</p>
              <OriginBadge origin="SPACEFLIGHT" />
            </div>
            <p className="mt-1 text-slate-300">NASA OSDR · Blood (Complete Blood Count) · Spaceflight Study</p>
            <p className="mt-2 leading-relaxed text-slate-300">
              Whole-blood cellular counts (RBC, WBC, platelets, hematocrit, hemoglobin) with strict unit verification.
            </p>
            <details className="mt-2 text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-200">Research details &amp; limitations</summary>
              <p className="mt-1.5">
                Rows with ambiguous unit labels (such as hemoglobin in %) are flagged for verification rather than silently converted.
              </p>
            </details>
          </div>

          <div className="rounded-panel border border-mission-border bg-mission-canvas/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">UTMB Bedrest Campaign 1 (BRSMACT)</p>
              <OriginBadge origin="GROUND_ANALOG" />
            </div>
            <p className="mt-1 text-slate-300">NASA NLSP · Sleep &amp; Actigraphy · Ground Analog Study</p>
            <p className="mt-2 leading-relaxed text-slate-300">
              Wrist actigraphy sleep duration, sleep latency, and sleep efficiency from head-down bed-rest analog participants.
            </p>
            <details className="mt-2 text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-200">Research details &amp; limitations</summary>
              <p className="mt-1.5">
                Ground analog studies simulate fluid shifts and confinement on Earth; they are not identical to orbital spaceflight.
              </p>
            </details>
          </div>

          <div className="rounded-panel border border-mission-border bg-mission-canvas/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Apollo AP005 Cardiovascular</p>
              <span className="inline-flex items-center rounded-full border border-indigo-700/80 bg-indigo-950/80 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                Aggregated Cohort
              </span>
            </div>
            <p className="mt-1 text-slate-300">NASA NLSP · Heart &amp; Circulation · Cohort Summary Statistics</p>
            <p className="mt-2 leading-relaxed text-slate-300">
              Grouped heart rate and blood pressure summaries from Apollo mission LBNP protocols stored in <code>research_aggregates</code>.
            </p>
            <details className="mt-2 text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-200">Research details &amp; limitations</summary>
              <p className="mt-1.5">
                Aggregated cohort statistics (means/SDs across groups) cannot be treated as individual astronaut measurements.
              </p>
            </details>
          </div>
        </div>
      </Card>

      {/* E. Scientific limitations */}
      <Alert kind="warn">
        <strong>Scientific Boundaries:</strong> Research data does not represent the active astronaut, ground analog studies are not identical to spaceflight, cohort aggregates are never converted into individual vital signs, missing timestamps are not invented, and research datasets never enter personal baselines.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="NASA Observations" value={records.length} hint="research_records (IndexedDB)" />
        <StatCard label="Cohort Aggregates" value={aggregates.length} hint="research_aggregates (Apollo AP005)" />
        <StatCard label="Loaded Datasets" value={datasets.length + (aggregates.length > 0 ? 1 : 0)} hint="With traceable provenance" />
      </div>

      <Card title="1. Import a NASA research dataset (CSV or Excel)">
        {isDemoMode && (
          <Alert kind="warn">
            Research file import is disabled in Demo Mode so demo data stays separate from locally imported datasets. Exit Demo Mode to import research files.
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="NASA Source / ETL Mode">
            <select
              className={inputClass}
              value={etlSource}
              onChange={(e) => setEtlSource(e.target.value as NasaEtlSource)}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Source File(s) (.csv, .xlsx, .xls, or extensionless)">
            <input
              type="file"
              multiple={etlSource === 'actigraphy' || etlSource === 'auto'}
              accept=".csv,.xlsx,.xls,.txt,*"
              onChange={onUploadNasaFile}
              disabled={isDemoMode}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-control file:border-0 file:bg-cyan-600/20 file:px-4 file:py-2 file:text-sm file:text-cyan-100 hover:file:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>
        </div>

        <p className="mt-3 text-sm text-slate-300">{activeSourceMeta.hint}</p>

        {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
        {statusMsg && <div className="mt-4"><Alert kind="success">{statusMsg}</Alert></div>}

        {report && (
          <div className="mt-4 rounded-panel border border-mission-border bg-mission-canvas/60 p-4 text-sm text-slate-200">
            <p className="font-semibold text-cyan-300">
              ETL Report — {report.dataset} (v{report.transformation_version})
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <span>Source rows: {report.total_source_rows}</span>
              <span>Output records: {report.output_records}</span>
              <span>Missing (null): {report.missing_value_count}</span>
              <span>Flagged/Alerts: {report.flagged_count}</span>
            </div>
            {report.issues.length > 0 && (
              <p className="mt-2 text-amber-300">
                Notice ({report.issues[0].code}): {report.issues[0].message}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card
        title="2. Explore Stored Research Data"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('records')}
              aria-pressed={tab === 'records'}
              className={`rounded-control px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                tab === 'records' ? 'bg-cyan-600/20 text-cyan-100' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Observations ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('aggregates')}
              aria-pressed={tab === 'aggregates'}
              className={`rounded-control px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                tab === 'aggregates' ? 'bg-cyan-600/20 text-cyan-100' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Apollo Aggregates ({aggregates.length})
            </button>
          </div>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {tab === 'records' && (
            <>
              <Field label="Dataset">
                <select
                  className={inputClass}
                  value={datasetFilter}
                  onChange={(e) => {
                    setDatasetFilter(e.target.value);
                    setSubjectFilter('ALL');
                  }}
                >
                  <option value="ALL">All</option>
                  {datasets.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Study Subject">
                <select
                  className={inputClass}
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Filter Indicator">
            <input
              className={inputClass}
              placeholder="e.g., albumin, hemoglobin, sleep_duration..."
              value={indicatorQuery}
              onChange={(e) => setIndicatorQuery(e.target.value)}
            />
          </Field>
        </div>

        {tab === 'records' ? (
          filteredRecords.length === 0 ? (
            <EmptyState>
              No research observations loaded yet. Upload OSD-575 (CMP), OSD-569 (CBC), UTMB Actigraphy, an Excel workbook, or data/processed/*.csv above.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mission-border text-slate-300">
                  <tr>
                    <th className="py-2 pr-3">Dataset</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Time / Phase</th>
                    <th className="py-2 pr-3">Indicator</th>
                    <th className="py-2 pr-3">Value</th>
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Origin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredRecords.slice(0, 100).map((r) => (
                    <tr key={r.record_id}>
                      <td className="py-2 pr-3 font-medium text-white">{r.source_dataset}</td>
                      <td className="py-2 pr-3">{r.source_subject_id}</td>
                      <td className="py-2 pr-3">
                        {r.timestamp ?? r.study_timepoint ?? 'N/A'}
                        {r.study_phase ? ` (${r.study_phase})` : ''}
                      </td>
                      <td className="py-2 pr-3">{r.indicator}</td>
                      <td className="py-2 pr-3 font-mono">{r.value === null ? 'N/A' : r.value.toFixed(3).replace(/\.?0+$/, '')}</td>
                      <td className="py-2 pr-3">{r.unit}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            r.quality_status.includes('requires_verification')
                              ? 'text-amber-300'
                              : 'text-slate-400'
                          }
                        >
                          {r.quality_status}
                        </span>
                      </td>
                      <td className="py-2">
                        <OriginBadge origin={r.data_origin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length > 100 && (
                <p className="mt-2 text-xs text-slate-400">
                  Showing 100 of {filteredRecords.length} observations. Use filters to narrow results.
                </p>
              )}
            </div>
          )
        ) : filteredAggregates.length === 0 ? (
          <EmptyState>
            No cohort aggregates loaded yet. Upload cardiovascular_processed.csv (Apollo AP005) above to store it as aggregated evidence.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="border-b border-mission-border text-slate-300">
                <tr>
                  <th className="py-2 pr-3">Sheet</th>
                  <th className="py-2 pr-3">Group</th>
                  <th className="py-2 pr-3">Phase / Condition</th>
                  <th className="py-2 pr-3">Indicator</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">N</th>
                  <th className="py-2 pr-3">p-value</th>
                  <th className="py-2">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredAggregates.slice(0, 100).map((a) => (
                  <tr key={a.aggregate_id}>
                    <td className="py-2 pr-3 font-medium text-white">{a.source_sheet}</td>
                    <td className="py-2 pr-3">{a.group_label}</td>
                    <td className="py-2 pr-3">{a.protocol_condition || a.measurement_phase}</td>
                    <td className="py-2 pr-3">{a.indicator}</td>
                    <td className="py-2 pr-3 font-mono">
                      {a.value === null ? 'N/A' : `${a.value} ${a.unit}`}
                    </td>
                    <td className="py-2 pr-3">{a.sample_size ?? 'N/A'}</td>
                    <td className="py-2 pr-3">{a.p_value ?? 'N/A'}</td>
                    <td className="py-2 text-indigo-300">{a.quality_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
