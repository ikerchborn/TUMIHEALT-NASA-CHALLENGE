import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  evaluateSelfAssessmentFromRecords,
  getDailyCheckIn,
  getLatestMissionContext,
  getRecords,
  listDailyCheckIns,
} from '@/services';
import type {
  AssessmentStatus,
  HealthCategory,
  HealthRecord,
  SelfAssessmentResult,
} from '@/types';
import { useProfile } from '../context/ProfileContext';
import { useAsync } from '../hooks/useAsync';
import { Alert, Button, Card, EmptyState, StatusBadge } from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import type { HealthStatus } from '../components/ui';

interface HomeMetric {
  id: 'sleep' | 'heart-rate' | 'blood-pressure' | 'blood';
  label: string;
  category: HealthCategory;
  record?: HealthRecord;
  value?: string;
  trendValues: number[];
  assessment?: SelfAssessmentResult;
}

interface RecentActivity {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function missionDay(startDate: string | undefined): number | undefined {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  const [year, month, day] = startDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const todayKey = localDateKey();
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);
  if (!Number.isFinite(start) || start > today) return undefined;
  return Math.floor((today - start) / 86_400_000) + 1;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp.slice(0, 10)
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function recordValue(record: HealthRecord): number | null {
  if (record.category === 'sleep') {
    return record.sleep_duration ?? record.value;
  }
  if (record.category === 'cardiovascular' && record.indicator === 'heart_rate') {
    return record.heart_rate ?? record.value;
  }
  return record.value;
}

function assessmentStatusToHealthStatus(status: AssessmentStatus | undefined): HealthStatus {
  switch (status) {
    case 'INFORMATIONAL':
      return 'within-usual-range';
    case 'REVIEW_REQUIRED':
      return 'different-from-usual';
    case 'MEDICAL_ESCALATION':
    case 'MONITOR':
      return 'review-recommended';
    case 'INSUFFICIENT_DATA':
    default:
      return 'not-enough-data';
  }
}

function formatMetricValue(metric: HomeMetric): string | undefined {
  const record = metric.record;
  if (!record) return undefined;

  if (metric.id === 'sleep' && record.category === 'sleep') {
    const value = record.sleep_duration ?? record.value;
    return value === null ? undefined : `${value} ${record.unit || 'hours'}`;
  }
  if (metric.id === 'heart-rate' && record.category === 'cardiovascular') {
    const value = record.heart_rate ?? record.value;
    return value === null ? undefined : `${value} ${record.unit || 'bpm'}`;
  }
  if (metric.id === 'blood-pressure' && record.category === 'cardiovascular') {
    if (record.blood_pressure) {
      return `${record.blood_pressure.systolic}/${record.blood_pressure.diastolic} mmHg`;
    }
    return record.value === null ? undefined : `${record.value} ${record.unit}`;
  }
  if (metric.id === 'blood' && record.category === 'blood') {
    return record.value === null ? `${record.indicator}: value unavailable` : `${record.indicator}: ${record.value} ${record.unit}`;
  }
  return undefined;
}

function metricTrendValue(metricId: HomeMetric['id'], record: HealthRecord): number | undefined {
  if (metricId === 'sleep' && record.category === 'sleep') {
    const value = record.sleep_duration ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'heart-rate' && record.category === 'cardiovascular') {
    const value = record.heart_rate ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'blood-pressure' && record.category === 'cardiovascular') {
    const value = record.blood_pressure?.systolic ?? record.value;
    return typeof value === 'number' ? value : undefined;
  }
  if (metricId === 'blood' && record.category === 'blood') {
    return typeof record.value === 'number' ? record.value : undefined;
  }
  return undefined;
}

function buildMetrics(
  records: HealthRecord[],
  astronautId: string,
  reportedSymptoms: boolean,
): HomeMetric[] {
  const definitions: Array<Pick<HomeMetric, 'id' | 'label' | 'category'>> = [
    { id: 'sleep', label: 'Sleep', category: 'sleep' },
    { id: 'heart-rate', label: 'Heart rate', category: 'cardiovascular' },
    { id: 'blood-pressure', label: 'Blood pressure', category: 'cardiovascular' },
    { id: 'blood', label: 'Blood biomarkers', category: 'blood' },
  ];

  return definitions.map((definition) => {
    const matching = records.filter((record) => {
      if (definition.id === 'sleep') {
        return record.category === 'sleep' &&
          (record.indicator === 'sleep_duration' ||
            (record.category === 'sleep' && record.sleep_duration !== undefined));
      }
      if (definition.id === 'heart-rate') {
        return record.category === 'cardiovascular' &&
          (record.indicator === 'heart_rate' ||
            (record.category === 'cardiovascular' && record.heart_rate !== undefined));
      }
      if (definition.id === 'blood-pressure') {
        return record.category === 'cardiovascular' &&
          (record.indicator === 'blood_pressure' ||
            (record.category === 'cardiovascular' && record.blood_pressure != null));
      }
      return record.category === 'blood';
    });
    const latest = matching.at(-1);
    const assessment = latest
      ? evaluateSelfAssessmentFromRecords(records, {
          astronaut_id: astronautId,
          category: latest.category,
          indicator: latest.indicator,
          user_reported_symptoms: reportedSymptoms,
        })
      : undefined;
    const metric: HomeMetric = {
      ...definition,
      record: latest,
      assessment,
      trendValues: matching
        .slice(-5)
        .map((record) => metricTrendValue(definition.id, record))
        .filter((value): value is number => value !== undefined),
    };
    metric.value = formatMetricValue(metric);
    return metric;
  });
}

function TinyTrend({ label, values }: { label: string; values: number[] }) {
  if (values.length < 2) {
    return <p className="mt-2 text-xs text-slate-400">Trend needs more records.</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 22 - ((value - min) / spread) * 18;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      role="img"
      aria-label={`${label} recent values: ${values.join(', ')}`}
      viewBox="0 0 100 24"
      className="mt-2 h-6 w-full"
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400" />
    </svg>
  );
}

function previousRecordSummary(record: HealthRecord, allRecords: HealthRecord[]): string {
  let previous: HealthRecord | undefined;
  for (const candidate of allRecords) {
    if (
      candidate.category === record.category &&
      candidate.indicator === record.indicator &&
      Date.parse(candidate.timestamp) < Date.parse(record.timestamp)
    ) {
      previous = candidate;
    }
  }
  if (!previous) return 'First record for this indicator.';
  const oldValue = recordValue(previous);
  const newValue = recordValue(record);
  if (oldValue === null || newValue === null || oldValue === undefined || newValue === undefined) {
    return 'New record added; one or both values are unavailable.';
  }
  if (oldValue === newValue) return `No numeric change from the previous record (${oldValue} ${record.unit}).`;
  return `Changed from ${oldValue} to ${newValue} ${record.unit}.`;
}

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { active, isDemoMode } = useProfile();
  const [reviewOpen, setReviewOpen] = useState(false);
  const id = active?.astronaut_id;
  const today = localDateKey();
  const { data, loading, error } = useAsync(async () => {
    if (!id) return undefined;
    const [records, mission, todayCheckIn, checkIns] = await Promise.all([
      getRecords({ astronaut_id: id }),
      getLatestMissionContext(id),
      getDailyCheckIn(id, today),
      listDailyCheckIns(id, 5),
    ]);
    const metrics = buildMetrics(
      records,
      id,
      Boolean(todayCheckIn && (todayCheckIn.mood === 'unwell' || todayCheckIn.symptoms.length > 0)),
    );

    const activity: RecentActivity[] = [
      ...records.map((record) => ({
        id: record.id,
        timestamp: record.timestamp,
        title: `${record.indicator.replaceAll('_', ' ')} recorded`,
        detail: previousRecordSummary(record, records),
      })),
      ...checkIns.map((checkIn) => {
        const previous = checkIns.find((candidate) => candidate.checkin_date < checkIn.checkin_date);
        const change = previous
          ? `Compared with previous check-in: ${previous.mood.replaceAll('_', ' ')}, energy ${previous.energy_level} of 5.`
          : 'No earlier check-in in the recent history.';
        return {
          id: checkIn.id,
          timestamp: checkIn.updated_at,
          title: 'Daily self-report',
          detail: `${checkIn.mood.replaceAll('_', ' ')} · energy ${checkIn.energy_level} of 5 · ${
            checkIn.symptoms.length ? checkIn.symptoms.join(', ') : 'no symptoms selected'
          }. ${change}`,
        };
      }),
    ];
    activity.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return {
      records,
      mission,
      todayCheckIn,
      metrics,
      activity: activity.slice(0, 5),
    };
  }, [id, today]);

  const metrics = data?.metrics ?? [];
  const missingMetrics = metrics.filter((metric) => !metric.record).slice(0, 3);
  const observations = metrics
    .filter((metric) => metric.assessment && metric.assessment.assessment_status !== 'INSUFFICIENT_DATA')
    .slice(0, 3);
  const day = missionDay(data?.mission?.mission_start_date);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              {isDemoMode ? 'DEMO DATA · SYNTHETIC EXAMPLES' : 'MISSION HOME'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {active ? `${greeting()}, ${active.display_name}` : 'Mission Home'}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {day
                ? `Mission day ${day}`
                : 'Add a mission start date to see your mission day.'}
            </p>
            {active && (
              <p className="mt-1 text-sm text-slate-400">
                Active profile: {active.display_name}{active.mission_role ? ` · ${active.mission_role}` : ''}
              </p>
            )}
          </div>
          {!day && (
            <Link
              to="/profiles"
              className="rounded-lg border border-cyan-700/70 px-3 py-2 text-sm font-medium text-cyan-200 hover:border-cyan-400"
            >
              Add mission start
            </Link>
          )}
        </div>
      </section>

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-400">Loading your local health summary…</p>}

      <Card
        title="Daily check-in"
        subtitle="A self-reported state, separate from imported health measurements."
        action={
          <Link
            to="/check-in"
            className="rounded-lg border border-cyan-600/70 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-400"
          >
            {data?.todayCheckIn ? 'Edit' : 'Check in'}
          </Link>
        }
      >
        {data?.todayCheckIn ? (
          <p className="text-sm text-slate-200">
            {data.todayCheckIn.mood.replaceAll('_', ' ')} · energy {data.todayCheckIn.energy_level} of 5 ·{' '}
            {data.todayCheckIn.symptoms.length
              ? data.todayCheckIn.symptoms.join(', ')
              : 'no symptoms selected'}
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            {loading ? 'Checking today’s entry…' : 'No check-in saved for today.'}
          </p>
        )}
      </Card>

      <section aria-labelledby="health-summary-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="health-summary-title" className="text-lg font-semibold text-white">Health summary</h2>
          <Link to="/import" className="text-sm font-medium text-cyan-300 hover:underline">
            + Import data
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.id} className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-200">{metric.label}</h3>
              <p className="mt-2 text-lg font-semibold text-white">
                {metric.value ?? 'No data yet'}
              </p>
              {metric.record ? (
                <>
                  <p className="mt-1 text-xs text-slate-400">Latest: {formatDate(metric.record.timestamp)}</p>
                  <TinyTrend label={`${metric.label} trend`} values={metric.trendValues} />
                  <StatusBadge
                    status={assessmentStatusToHealthStatus(metric.assessment?.assessment_status)}
                    className="mt-3"
                  />
                </>
              ) : (
                <>
                  <StatusBadge status="not-enough-data" className="mt-3" />
                  <Link to="/import" className="mt-3 inline-block text-sm text-cyan-300 hover:underline">
                    Import data
                  </Link>
                </>
              )}
            </Card>
          ))}
        </div>
      </section>

      <Card title="Recent activity" subtitle="Imported records and self-reported check-ins from this profile.">
        {!data || data.activity.length === 0 ? (
          <EmptyState>No recent records or check-ins yet. Import measurements or add a daily check-in.</EmptyState>
        ) : (
          <ol className="divide-y divide-slate-800">
            {data.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.detail}</p>
                </div>
                <time className="text-sm text-slate-400" dateTime={item.timestamp}>
                  {formatDate(item.timestamp)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card
        title="Health Assistant"
        subtitle="Observations use the existing self-assessment rules and your local records only."
      >
        {observations.length === 0 && missingMetrics.length === 0 ? (
          <EmptyState>
            {data?.records.length
              ? 'Not enough data yet for an assessment. Import additional records to build a personal history.'
              : 'Not enough data yet. Import sleep, heart rate, blood pressure, or blood biomarker records to see observations.'}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {observations.length > 0 && (
              <ul className="space-y-3">
                {observations.map((metric) => (
                  <li key={metric.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-sm font-semibold text-white">{metric.label}</p>
                    <p className="mt-1 text-sm text-slate-300">{metric.assessment?.explanation}</p>
                    <p className="mt-2 text-sm text-slate-400">{metric.assessment?.recommended_next_action}</p>
                  </li>
                ))}
              </ul>
            )}
            {missingMetrics.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Missing data</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {missingMetrics.map((metric) => (
                    <li key={metric.id}>
                      <Link
                        to="/import"
                        className="inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-sm text-cyan-200 hover:border-cyan-500"
                      >
                        Import {metric.label.toLowerCase()}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Medical team access" subtitle="This app does not connect to your medical team.">
        <p className="text-sm leading-relaxed text-slate-300">
          Prepare a local summary of selected measurements and check-ins. Nothing is sent to or received from a medical team.
        </p>
        <Button type="button" className="mt-4" onClick={() => setReviewOpen(true)}>
          Request medical review
        </Button>
      </Card>
      <MedicalReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        profileId={active?.astronaut_id}
        isDemoMode={isDemoMode}
      />
    </div>
  );
}
