import { useEffect, useMemo, useState } from 'react';
import type { DateRangeFilter, HealthCategory, HealthRecord, MissionContext } from '@/types';
import {
  buildTrendPoints,
  calculatePersonalBaselineFromRecords,
  filterRecordsByDateRange,
  getMissionContexts,
  listDailyCheckIns,
  queryRecords,
} from '@/services';
import { TrendChart } from '../components/TrendChart';
import { useProfile } from '../context/ProfileContext';
import { Alert, Card, EmptyState, PageHeader, inputClass } from '../components/ui';

const ranges = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'MAX', days: null },
] as const;

const metrics = [
  { id: 'blood', title: 'Blood', category: 'blood', preferred: 'glucose' },
  { id: 'sleep', title: 'Sleep', category: 'sleep', preferred: 'sleep_duration' },
  { id: 'heart-rate', title: 'Heart rate', category: 'cardiovascular', preferred: 'heart_rate' },
  { id: 'blood-pressure', title: 'Blood pressure', category: 'cardiovascular', preferred: 'systolic_blood_pressure' },
] as const satisfies readonly {
  id: string;
  title: string;
  category: HealthCategory;
  preferred: string;
}[];

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
}

interface TimelineGroup {
  label: string;
  events: TimelineEvent[];
}

function localDateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function groupTimelineEvents(
  events: TimelineEvent[],
  missionStartDate?: string,
): TimelineGroup[] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const dateKey = localDateKey(event.date);
    const dayOffset = missionStartDate
      ? Math.floor(
          (Date.parse(`${dateKey}T00:00:00Z`) -
            Date.parse(`${missionStartDate}T00:00:00Z`)) /
            (24 * 60 * 60 * 1000),
        )
      : undefined;
    const label = dayOffset === undefined
      ? dateKey
      : dayOffset < 0
        ? `Before mission · ${dateKey}`
        : `Mission day ${dayOffset + 1}`;
    const group = groups.get(label) ?? [];
    group.push(event);
    groups.set(label, group);
  }
  return Array.from(groups, ([label, groupedEvents]) => ({ label, events: groupedEvents }));
}

function toTimelineEvents(
  records: HealthRecord[],
  checkIns: Awaited<ReturnType<typeof listDailyCheckIns>>,
  missionContexts: MissionContext[],
): TimelineEvent[] {
  const measurementEvents = records.map((record) => ({
    id: `record-${record.id}`,
    date: record.timestamp,
    title: `${record.category} measurement · ${record.indicator}`,
    detail: record.value === null ? `Missing value · ${record.unit}` : `${record.value} ${record.unit} · ${record.data_origin}`,
  }));
  const checkInEvents = checkIns.map((checkIn) => ({
    id: `check-in-${checkIn.id}`,
    date: `${checkIn.checkin_date}T12:00:00`,
    title: `Daily check-in · ${checkIn.mood.replace(/_/g, ' ')}`,
    detail: checkIn.symptoms.length > 0
      ? `Symptoms: ${checkIn.symptoms.join(', ')}${checkIn.other_symptom ? ` (${checkIn.other_symptom})` : ''}`
      : `Energy level: ${checkIn.energy_level}/5 · no symptoms reported`,
  }));
  const contextEvents = missionContexts.flatMap((context) => {
    const events: TimelineEvent[] = [{
      id: `context-${context.context_id}`,
      date: context.recorded_at,
      title: `Mission context · ${context.mission_id}`,
      detail: `${context.mission_phase} · ${context.gravity_environment} · ${context.environment_type}`,
    }];
    if (context.mission_start_date) {
      events.push({
        id: `mission-start-${context.context_id}`,
        date: `${context.mission_start_date}T00:00:00`,
        title: `Mission start · ${context.mission_id}`,
        detail: `${context.gravity_environment} · ${context.environment_type}`,
      });
    }
    return events;
  });
  return [...measurementEvents, ...checkInEvents, ...contextEvents]
    .filter((event) => !Number.isNaN(Date.parse(event.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function TrendsPage() {
  const { active } = useProfile();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [checkIns, setCheckIns] = useState<Awaited<ReturnType<typeof listDailyCheckIns>>>([]);
  const [missionContexts, setMissionContexts] = useState<MissionContext[]>([]);
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [activeView, setActiveView] = useState<'trends' | 'timeline'>('trends');
  const [selectedIndicators, setSelectedIndicators] = useState<Record<string, string>>(
    Object.fromEntries(metrics.map((metric) => [metric.id, metric.preferred])),
  );
  const [loading, setLoading] = useState(true);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setRecords([]);
      setCheckIns([]);
      setMissionContexts([]);
      setLoadedProfileId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadedProfileId(null);
    setError(null);
    Promise.all([
      queryRecords({ astronaut_id: active.astronaut_id }),
      listDailyCheckIns(active.astronaut_id, Number.MAX_SAFE_INTEGER),
      getMissionContexts(active.astronaut_id),
    ])
      .then(([personalRecords, personalCheckIns, contexts]) => {
        if (cancelled) return;
        setRecords(personalRecords);
        setCheckIns(personalCheckIns);
        setMissionContexts(contexts);
        setLoadedProfileId(active.astronaut_id);
        setSelectedIndicators(
          Object.fromEntries(
            metrics.map((metric) => {
              const available = personalRecords
                .filter((record) => record.category === metric.category)
                .map((record) => record.indicator);
              return [metric.id, available.includes(metric.preferred) ? metric.preferred : available[0] ?? metric.preferred];
            }),
          ),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const dateRange = useMemo<DateRangeFilter | undefined>(() => {
    if (rangeDays === null) return undefined;
    const now = new Date();
    return {
      from: new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, [rangeDays]);
  const visibleRecords = useMemo(
    () => filterRecordsByDateRange(records, dateRange),
    [records, dateRange],
  );
  const visibleCheckIns = useMemo(
    () => checkIns.filter((checkIn) => {
      if (!dateRange?.from) return true;
      return Date.parse(`${checkIn.checkin_date}T23:59:59`) >= Date.parse(dateRange.from);
    }),
    [checkIns, dateRange],
  );
  const timeline = useMemo(
    () => activeView === 'timeline'
      ? toTimelineEvents(records, checkIns, missionContexts)
      : [],
    [activeView, records, checkIns, missionContexts],
  );
  const filteredTimeline = useMemo(
    () => timeline.filter((event) => {
      const timestamp = Date.parse(event.date);
      if (dateRange?.from && timestamp < Date.parse(dateRange.from)) return false;
      if (dateRange?.to && timestamp > Date.parse(dateRange.to)) return false;
      return true;
    }),
    [timeline, dateRange],
  );
  const missionStartDate = missionContexts
    .map((context) => context.mission_start_date)
    .filter((date): date is string => Boolean(date))
    .sort()[0];
  const visibleTimeline = useMemo(
    () => filteredTimeline.slice(0, 100),
    [filteredTimeline],
  );
  const timelineGroups = useMemo(
    () => groupTimelineEvents(visibleTimeline, missionStartDate),
    [visibleTimeline, missionStartDate],
  );

  if (!active) {
    return <EmptyState>Select an astronaut profile to view personal trends.</EmptyState>;
  }

  const panels = metrics.map((metric) => {
    const indicator = selectedIndicators[metric.id] ?? metric.preferred;
    const allMatchingRecords = visibleRecords.filter(
      (record) => record.category === metric.category && record.indicator === indicator,
    );
    const baseline = calculatePersonalBaselineFromRecords(records, {
      astronaut_id: active.astronaut_id,
      category: metric.category,
      indicator,
      minSamples: 3,
    });
    const matchingRecords = baseline.unit
      ? allMatchingRecords.filter((record) => record.unit === baseline.unit)
      : allMatchingRecords;
    const numericRecords = matchingRecords.filter(
      (record): record is HealthRecord & { value: number } => record.value !== null,
    );
    const latest = numericRecords[numericRecords.length - 1];
    const average = numericRecords.length > 0
      ? numericRecords.reduce((sum, record) => sum + record.value, 0) / numericRecords.length
      : null;
    const indicators = Array.from(new Set(
      records
        .filter((record) => record.category === metric.category)
        .map((record) => record.indicator),
    )).sort();
    if (!indicators.includes(indicator)) indicators.unshift(indicator);
    const unit = latest?.unit ?? baseline.unit;
    const baselineChange =
      baseline.status === 'computed' && latest && baseline.median !== null
        ? latest.value - baseline.median
        : null;
    const changeDescription = baselineChange === null
      ? 'Not enough data for a personal baseline.'
      : `${baselineChange > 0 ? '+' : ''}${baselineChange.toFixed(2)} ${unit ?? ''} vs personal median.`;
    const summary = latest && average !== null
      ? `Latest: ${latest.value} ${latest.unit} on ${new Date(latest.timestamp).toLocaleDateString('en-US')}. Average in this range: ${average.toFixed(2)} ${unit ?? ''}. ${changeDescription}`
      : 'No numeric measurements in this range. Import personal records for this indicator to see a trend.';
    return {
      metric,
      indicator,
      matchingRecords,
      excludedUnitCount: allMatchingRecords.length - matchingRecords.length,
      latest,
      average,
      unit,
      baseline,
      baselineChange,
      indicators,
      summary,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Personal health history"
        title="My Health Trends"
        subtitle={`Measurements and check-ins for ${active.display_name}. Personal records only; NASA research aggregates are not used.`}
      />
      <div className="space-y-6">
        <Card title="Time range">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Trend time range">
            {ranges.map((range) => (
              <button
                key={range.label}
                type="button"
                aria-pressed={rangeDays === range.days}
                onClick={() => setRangeDays(range.days)}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  rangeDays === range.days
                    ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </Card>
        <div className="flex gap-2 border-b border-slate-800" role="tablist" aria-label="Trend views">
          {([
            ['trends', 'Trends'],
            ['timeline', 'Mission Timeline'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={activeView === view}
              onClick={() => setActiveView(view)}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                activeView === view
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {loading || loadedProfileId !== active.astronaut_id ? (
          <Card><p className="text-sm text-slate-400">Loading personal trend data…</p></Card>
        ) : (
          <>
            {activeView === 'trends' ? (
              <>
                <section aria-label="Trend summaries" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {panels.map((panel) => (
                    <Card
                      key={panel.metric.id}
                      title={panel.metric.title}
                      subtitle={panel.indicator}
                      className="p-4"
                    >
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <dt className="text-slate-400">Latest</dt>
                        <dd className="text-right text-slate-200">
                          {panel.latest ? `${panel.latest.value} ${panel.latest.unit}` : 'No data'}
                        </dd>
                        <dt className="text-slate-400">Average in range</dt>
                        <dd className="text-right text-slate-200">
                          {panel.average === null ? '—' : `${panel.average.toFixed(2)} ${panel.unit ?? ''}`}
                        </dd>
                        <dt className="text-slate-400">Vs personal median</dt>
                        <dd className="text-right text-slate-200">
                          {panel.baselineChange === null
                            ? 'Not enough data'
                            : `${panel.baselineChange > 0 ? '+' : ''}${panel.baselineChange.toFixed(2)} ${panel.unit ?? ''}`}
                        </dd>
                        <dt className="text-slate-400">Records in range</dt>
                        <dd className="text-right text-slate-200">{panel.matchingRecords.length}</dd>
                      </dl>
                    </Card>
                  ))}
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  {panels.map((panel) => (
                    <Card
                      key={panel.metric.id}
                      title={panel.metric.title}
                      subtitle={panel.indicator}
                      action={(
                        <select
                          aria-label={`${panel.metric.title} indicator`}
                          className={`${inputClass} w-auto min-w-40`}
                          value={panel.indicator}
                          onChange={(event) => setSelectedIndicators((current) => ({
                            ...current,
                            [panel.metric.id]: event.target.value,
                          }))}
                        >
                          {panel.indicators.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      )}
                    >
                      <TrendChart
                        points={buildTrendPoints(panel.matchingRecords)}
                        unit={panel.unit}
                        baselineMedian={panel.baseline.status === 'computed' ? panel.baseline.median : null}
                        baselineBand={
                          panel.baseline.status === 'computed' &&
                          panel.baseline.mean !== null &&
                          panel.baseline.standard_deviation !== null
                            ? {
                                from: panel.baseline.mean - panel.baseline.standard_deviation,
                                to: panel.baseline.mean + panel.baseline.standard_deviation,
                              }
                            : null
                        }
                        symptomCheckIns={visibleCheckIns}
                      />
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{panel.summary}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {panel.baseline.status === 'computed'
                          ? 'The shaded band uses the existing personal mean ± standard deviation; it is descriptive, not a medical threshold.'
                          : 'A personal baseline is shown only after at least three valid, compatible measurements.'}
                        {panel.excludedUnitCount > 0
                          ? ` ${panel.excludedUnitCount} record(s) with a different unit were excluded from this chart.`
                          : ''}
                      </p>
                      {panel.baseline.status === 'insufficient_data' && (
                        <p className="mt-1 text-xs text-slate-400">
                          Personal baseline is not shown: {panel.baseline.limitations.find((item) => item.includes('valid measurements'))}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>

                <Card title="Symptom check-ins">
                  <p className="mb-3 text-xs text-slate-400">
                    Markers identify self-reported symptom dates only; they do not imply a relationship with a measurement.
                  </p>
                  {visibleCheckIns.filter((checkIn) => checkIn.symptoms.length > 0).length === 0 ? (
                    <EmptyState>No symptom check-ins are recorded in this time range.</EmptyState>
                  ) : (
                    <ul className="divide-y divide-slate-800">
                      {visibleCheckIns
                        .filter((checkIn) => checkIn.symptoms.length > 0)
                        .map((checkIn) => (
                          <li key={checkIn.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                            <time className="text-slate-400">{checkIn.checkin_date}</time>
                            <span className="text-amber-200">
                              {checkIn.symptoms.join(', ')}
                              {checkIn.other_symptom ? ` (${checkIn.other_symptom})` : ''}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Card>
              </>
            ) : (
              <Card
                title="Mission Timeline"
                subtitle="Personal measurements, daily check-ins, and saved mission context for the selected range, grouped by mission day when a start date is available."
              >
                <Alert kind="info">Events are shown together, not as cause and effect.</Alert>
                {filteredTimeline.length === 0 ? (
                  <EmptyState>No personal measurements, check-ins, or mission context events are available in this range.</EmptyState>
                ) : (
                  <ol className="mt-4 space-y-4">
                    {timelineGroups.map((group) => (
                      <li key={group.label}>
                        <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold text-cyan-200">{group.label}</h2>
                        <ol className="divide-y divide-slate-800">
                          {group.events.map((event) => (
                            <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                              <time className="text-xs text-slate-400">
                                {new Date(event.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </time>
                              <div>
                                <p className="text-sm font-medium text-slate-200">{event.title}</p>
                                <p className="text-xs text-slate-400">{event.detail}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ol>
                )}
                {filteredTimeline.length > visibleTimeline.length && (
                  <p className="mt-3 text-xs text-slate-400">Showing the latest {visibleTimeline.length} of {filteredTimeline.length} timeline events.</p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
