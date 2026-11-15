import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  computePersonalBaseline,
  deleteRecord,
  getCategoryAnalytics,
  getIndicatorMetadata,
  getRecords,
} from '@/services';
import type { CardiovascularRecord } from '@/types';
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

type CardioZone = 'heart' | 'head_shift' | 'lower_body';

const zoneInfo: Record<CardioZone, { title: string; summary: string }> = {
  heart: {
    title: 'Heart Pump and Arterial Pressure',
    summary:
      'Your heart adjusts beat rate and blood pressure to deliver oxygen during rest, exercise, and posture changes.',
  },
  head_shift: {
    title: 'Upper-Body Fluid Shift',
    summary:
      'In microgravity, fluids shift upward toward the chest and head, changing how pressure sensors respond.',
  },
  lower_body: {
    title: 'Lower-Body and Gravity Adaptation',
    summary:
      'When gravity returns, blood shifts downward again, making cardiovascular adaptation important to understand.',
  },
};

function formatLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HeartPage() {
  const { active } = useProfile();
  const astronautId = active?.astronaut_id;
  const [zone, setZone] = useState<CardioZone>('heart');
  const [selected, setSelected] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!astronautId) return undefined;
    const [analytics, allRecords] = await Promise.all([
      getCategoryAnalytics({ astronaut_id: astronautId, category: 'cardiovascular' }),
      getRecords({ astronaut_id: astronautId, category: 'cardiovascular' }),
    ]);
    const records = allRecords
      .filter((record): record is CardiovascularRecord => record.category === 'cardiovascular')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const indicator = selected ?? analytics.indicators[0]?.indicator ?? 'heart_rate';
    const baseline = await computePersonalBaseline({
      astronaut_id: astronautId,
      category: 'cardiovascular',
      indicator,
    });
    return { analytics, records, baseline, indicator };
  }, [astronautId, selected]);

  const summary = data?.analytics.indicators.find(
    (item) => item.indicator === data.indicator,
  );

  async function onDelete(recordId: string) {
    if (!astronautId || !window.confirm('Delete this cardiovascular measurement?')) return;
    await deleteRecord(recordId, 'cardiovascular', astronautId, astronautId);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Health · Heart"
        title="Heart and Circulation"
        subtitle="Review cardiovascular measurements and learn how circulation responds to spaceflight."
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
              Heart Guides
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card
          title="Interactive Circulation Diagram"
          subtitle="Select an area to learn how it relates to circulation."
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <svg
              viewBox="0 0 180 260"
              className="h-56 w-40 shrink-0"
              role="img"
              aria-label="Diagram showing the heart, upper body, and lower body"
            >
              <rect x="20" y="10" width="140" height="240" rx="24" fill="#060f20" stroke="#1e293b" />
              <circle
                cx="90"
                cy="48"
                r="22"
                fill={zone === 'head_shift' ? '#0891b2' : '#0f172a'}
                stroke="#38bdf8"
                strokeWidth="2"
                className="cursor-pointer"
                onClick={() => setZone('head_shift')}
              />
              <line x1="90" y1="70" x2="90" y2="215" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="4 3" />
              <circle
                cx="90"
                cy="115"
                r="24"
                fill={zone === 'heart' ? '#e11d48' : '#881337'}
                stroke="#fda4af"
                strokeWidth="2.5"
                className="cursor-pointer"
                onClick={() => setZone('heart')}
              />
              <text x="90" y="119" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                HEART
              </text>
              <rect
                x="56"
                y="165"
                width="68"
                height="56"
                rx="12"
                fill={zone === 'lower_body' ? '#0284c7' : '#0f172a'}
                stroke="#38bdf8"
                strokeWidth="2"
                className="cursor-pointer"
                onClick={() => setZone('lower_body')}
              />
            </svg>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['heart', 'head_shift', 'lower_body'] as const).map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setZone(region)}
                    aria-pressed={zone === region}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      zone === region
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                        : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {region === 'heart' ? 'Heart' : region === 'head_shift' ? 'Upper Fluid Shift' : 'Lower Body'}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
                <p className="font-semibold text-white">{zoneInfo[zone].title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{zoneInfo[zone].summary}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Understanding Heart and Circulation"
          subtitle="Why cardiovascular tracking matters during spaceflight."
        >
          <ProgressiveDisclosure
            simple="Your heart and blood vessels move oxygen and nutrients around your body. Heart rate and blood pressure change with activity, stress, and posture."
            spaceContext="In microgravity, fluids shift upward and the heart does not pump against Earth's gravity in the same way. Measurements help describe how the body adapts."
            scientificDetails={
              <>
                <p>
                  <strong>Indicators:</strong> heart rate, systolic and diastolic blood pressure, and cardiac output.
                </p>
                <p>
                  Cardiovascular research datasets may contain group summaries, not individual astronaut readings.
                </p>
              </>
            }
          />
        </Card>
      </div>

      {!active ? (
        <Card>
          <EmptyState>
            Select or <Link to="/profiles" className="text-cyan-400 underline">create an astronaut profile</Link> to view imported cardiovascular measurements.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Alert kind="info">
            Health measurements are added by importing a file. This page does not provide manual measurement entry.
          </Alert>
          {error && <Alert kind="error">{error}</Alert>}
          {loading && <p className="text-sm text-slate-400">Loading cardiovascular history…</p>}

          <Card
            title="Cardiovascular trends"
            subtitle="Heart rate and blood pressure vary with activity and posture."
            action={
              data && data.analytics.indicators.length > 0 ? (
                <select
                  aria-label="Select cardiovascular indicator to plot"
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
                No cardiovascular measurements yet. <Link to="/import" className="text-cyan-300 underline">Import data</Link> to view your history.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Latest {getIndicatorMetadata(summary.indicator)?.name ?? formatLabel(summary.indicator)}:{' '}
                  <strong className="text-cyan-300">
                    {summary.comparison.latest_value === null
                      ? 'Missing value'
                      : `${summary.comparison.latest_value} ${summary.unit ?? ''}`}
                  </strong>
                  {summary.comparison.latest_timestamp
                    ? ` on ${summary.comparison.latest_timestamp.slice(0, 10)}`
                    : ''}
                </p>
                {data?.baseline.status === 'computed' && (
                  <p className="text-xs text-slate-400">
                    Personal baseline: {data.baseline.median?.toFixed(2)} {data.baseline.unit} ({data.baseline.valid_count} readings).
                  </p>
                )}
                <TrendChart
                  points={summary.points}
                  unit={summary.unit}
                  baselineMedian={data?.baseline.status === 'computed' ? data.baseline.median : null}
                />
              </div>
            )}
          </Card>

          <Card title={`Imported measurement history (${data?.records.length ?? 0})`}>
            {!data || data.records.length === 0 ? (
              <EmptyState>Imported cardiovascular records will appear here.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Indicator</th>
                      <th className="py-2 pr-3">Value</th>
                      <th className="py-2 pr-3">Activity</th>
                      <th className="py-2 pr-3">Origin</th>
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
                        <td className="py-2.5 pr-3">{record.activity_context ?? 'Not recorded'}</td>
                        <td className="py-2.5 pr-3"><OriginBadge origin={record.data_origin} /></td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void onDelete(record.id)}
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
