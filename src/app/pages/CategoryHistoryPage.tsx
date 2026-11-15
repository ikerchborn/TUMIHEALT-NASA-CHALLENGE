import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  computePersonalBaseline,
  deleteRecord,
  getCategoryAnalytics,
  getIndicatorMetadata,
  getRecords,
} from '@/services';
import type { HealthCategory, HealthRecord } from '@/types';
import { useProfile } from '../context/ProfileContext';
import { useAsync } from '../hooks/useAsync';
import { TrendChart } from '../components/TrendChart';
import {
  Alert,
  Card,
  EmptyState,
  OriginBadge,
  PageHeader,
  ProgressiveDisclosure,
} from '../components/ui';

const DEFAULT_INDICATOR: Record<HealthCategory, string> = {
  blood: 'hemoglobin',
  sleep: 'sleep_duration',
  cardiovascular: 'heart_rate',
};

function formatLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CategoryHistoryPage({
  category,
  title,
  subtitle,
  spaceContext,
}: {
  category: HealthCategory;
  title: string;
  subtitle: string;
  spaceContext: string;
}) {
  const { active } = useProfile();
  const astronautId = active?.astronaut_id;
  const [selected, setSelected] = useState(DEFAULT_INDICATOR[category]);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!astronautId) return undefined;
    const [analytics, records] = await Promise.all([
      getCategoryAnalytics({ astronaut_id: astronautId, category }),
      getRecords({ astronaut_id: astronautId, category }),
    ]);
    const indicator = analytics.indicators.some((item) => item.indicator === selected)
      ? selected
      : analytics.indicators[0]?.indicator ?? selected;
    const baseline = await computePersonalBaseline({
      astronaut_id: astronautId,
      category,
      indicator,
    });
    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { analytics, records, baseline, indicator };
  }, [astronautId, category, selected]);

  const summary = data?.analytics.indicators.find(
    (item) => item.indicator === data.indicator,
  );
  const metadata = getIndicatorMetadata(summary?.indicator ?? selected);

  async function onDelete(record: HealthRecord) {
    if (!astronautId || !window.confirm(`Delete this ${category} measurement?`)) return;
    await deleteRecord(record.id, category, astronautId, astronautId);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`My Health · ${title}`}
        title={title}
        subtitle={subtitle}
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/import"
              className="inline-flex items-center rounded-xl bg-cyan-700 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-800"
            >
              Import data
            </Link>
            <Link
              to="/guides"
              className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-500"
            >
              Health Guides
            </Link>
          </div>
        }
      />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-400">Loading {title.toLowerCase()} history…</p>}

      {!active ? (
        <Card>
          <EmptyState>
            Select or <Link to="/profiles" className="text-cyan-400 underline">create an astronaut profile</Link> to view imported measurements.
          </EmptyState>
        </Card>
      ) : (
        <>
          {metadata && (
            <Card title={`About ${metadata.name}`}>
              <ProgressiveDisclosure
                simple={`${metadata.definition} It is usually measured by ${metadata.measurement_method}.`}
                spaceContext={spaceContext}
                scientificDetails={
                  <>
                    <p><strong>Physiological context:</strong> {metadata.physiological_context}</p>
                    <p><strong>Limitations:</strong> {metadata.limitations.join(' ')}</p>
                    <p><strong>Sources:</strong> {metadata.data_source.join(', ')}</p>
                  </>
                }
              />
            </Card>
          )}

          <Card
            title="Measurement trends"
            subtitle="Trends and baselines use this profile's imported personal records only."
            action={
              data && data.analytics.indicators.length > 0 ? (
                <select
                  aria-label={`Select ${title.toLowerCase()} indicator`}
                  value={summary?.indicator ?? data.indicator}
                  onChange={(event) => setSelected(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
                >
                  {data.analytics.indicators.map((item) => (
                    <option key={item.indicator} value={item.indicator}>
                      {formatLabel(item.indicator)}
                    </option>
                  ))}
                </select>
              ) : null
            }
          >
            {!summary ? (
              <EmptyState>
                No {title.toLowerCase()} measurements yet.{' '}
                <Link to="/import" className="text-cyan-300 underline">Import data</Link> to view your history.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-sm">
                    <p className="text-xs text-slate-400">Latest reading</p>
                    <p className="mt-1 font-semibold text-cyan-300">
                      {summary.comparison.latest_value === null
                        ? 'Missing value'
                        : `${summary.comparison.latest_value} ${summary.unit ?? ''}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {summary.comparison.latest_timestamp?.slice(0, 10) ?? 'Date unavailable'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-sm">
                    <p className="text-xs text-slate-400">Personal baseline</p>
                    {data?.baseline.status === 'computed' ? (
                      <p className="mt-1 font-semibold text-white">
                        {data.baseline.median?.toFixed(2)} {data.baseline.unit}
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-300">Not enough data for a baseline.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-sm">
                    <p className="text-xs text-slate-400">Recorded values</p>
                    <p className="mt-1 font-semibold text-white">{summary.valid_numeric_count}</p>
                    <p className="text-xs text-slate-400">for {formatLabel(summary.indicator)}</p>
                  </div>
                </div>
                <TrendChart
                  points={summary.points}
                  unit={summary.unit}
                  baselineMedian={data?.baseline.status === 'computed' ? data.baseline.median : null}
                />
              </div>
            )}
          </Card>

          <Card title={`Measurement history (${data?.records.length ?? 0})`}>
            {!data || data.records.length === 0 ? (
              <EmptyState>Imported records for this category will appear here.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Indicator</th>
                      <th className="py-2 pr-3">Value</th>
                      <th className="py-2 pr-3">Origin</th>
                      <th className="py-2 pr-3">Source file</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {data.records.map((record) => (
                      <tr key={record.id}>
                        <td className="py-2.5 pr-3">{record.timestamp.slice(0, 16).replace('T', ' ')}</td>
                        <td className="py-2.5 pr-3 font-medium text-white">{formatLabel(record.indicator)}</td>
                        <td className="py-2.5 pr-3 text-cyan-300">
                          {record.value === null ? 'Missing' : `${record.value} ${record.unit}`}
                        </td>
                        <td className="py-2.5 pr-3"><OriginBadge origin={record.data_origin} /></td>
                        <td className="py-2.5 pr-3">{record.source_dataset}</td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void onDelete(record)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
