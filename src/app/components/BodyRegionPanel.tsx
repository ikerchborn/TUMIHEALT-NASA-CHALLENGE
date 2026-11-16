import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GUIDANCE_CATALOG,
  computePersonalBaseline,
  evaluateIndicatorClinicalSeverity,
  formatClinicalUnit,
  formatPercentageShift,
  getIndicatorMetadata,
  getRecords,
  listIndicatorsByCategory,
  runSelfAssessment,
} from '@/services';
import type { HealthCategory, HealthRecord, PersonalBaselineResult, SelfAssessmentResult } from '@/types';
import { Alert, OriginBadge, StatusBadge, clinicalSeverityToHealthStatus } from './ui';

export type BodyRegionId = HealthCategory | 'bones_muscles';

const REGION_META: Record<
  HealthCategory,
  {
    title: string;
    level1Simple: string;
    level2Space: string;
    caution?: string;
  }
> = {
  cardiovascular: {
    title: 'Heart & Circulatory System',
    level1Simple:
      'Your heart and blood vessels pump oxygen and nutrients throughout your body every minute, adjusting automatically when you rest, stand, or exercise.',
    level2Space:
      'In microgravity, body fluids shift toward the chest and head. When astronauts return to gravity, the cardiovascular system must re-adapt to keep blood pressure steady (related to Gravity Fields & Distance from Earth).',
  },
  blood: {
    title: 'Blood & Immune Context',
    level1Simple:
      'Your blood carries oxygen (red blood cells), supports clotting (platelets), transports nutrients, and includes white blood cells that participate in immune defense.',
    level2Space:
      'Spaceflight can alter plasma volume, red blood cell counts, and metabolic markers. Note: A Complete Blood Count (CBC) gives useful hematology context, but does not provide a complete immune-system assessment.',
  },
  sleep: {
    title: 'Brain, Sleep & Circadian Health',
    level1Simple:
      'Your circadian rhythm is your body’s internal clock. It helps regulate when you feel awake and when you feel sleepy.',
    level2Space:
      'Rapid orbital sunrises/sunsets, mission workloads, and isolation and confinement can disrupt sleep duration, latency (time to fall asleep), and efficiency.',
    caution:
      'Educational visualization only — TUMI-HEALT does not measure brain activity (EEG), neurological signals, or cognitive performance.',
  },
};

export function BodyRegionPanel({
  region,
  astronautId,
  onBackToSummary,
}: {
  region: BodyRegionId;
  astronautId?: string;
  onBackToSummary?: () => void;
}) {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [latestRecord, setLatestRecord] = useState<HealthRecord | null>(null);
  const [baseline, setBaseline] = useState<PersonalBaselineResult | null>(null);
  const [assessment, setAssessment] = useState<SelfAssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const catalogList = region === 'bones_muscles' ? [] : listIndicatorsByCategory(region);

  useEffect(() => {
    if (region === 'bones_muscles') return;
    if (catalogList.length > 0 && !catalogList.some((m) => m.indicator_id === selectedIndicator)) {
      setSelectedIndicator(catalogList[0].indicator_id);
    }
  }, [region, catalogList, selectedIndicator]);

  useEffect(() => {
    if (region === 'bones_muscles' || !selectedIndicator) return;
    if (!astronautId) {
      setLatestRecord(null);
      setBaseline(null);
      setAssessment(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [recs, base, assess] = await Promise.all([
          getRecords({ astronaut_id: astronautId, category: region, indicator: selectedIndicator }),
          computePersonalBaseline({ astronaut_id: astronautId, category: region, indicator: selectedIndicator }),
          runSelfAssessment({ astronaut_id: astronautId, category: region, indicator: selectedIndicator }),
        ]);
        if (cancelled) return;
        const sorted = [...recs].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        setLatestRecord(sorted[0] ?? null);
        setBaseline(base);
        setAssessment(assess);
        setLoadError(null);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [region, selectedIndicator, astronautId]);

  if (region === 'bones_muscles') {
    return (
      <div className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="space-y-4">
          {onBackToSummary && (
            <button
              type="button"
              onClick={onBackToSummary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              ← View All-Systems Summary
            </button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-amber-400">Educational Module</p>
              <h3 className="text-lg font-semibold text-white">Bones & Muscles</h3>
            </div>
            <span className="rounded-full border border-amber-700 bg-amber-950/60 px-2.5 py-0.5 text-sm font-semibold text-amber-300">
              Educational information — not currently monitored.
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
              <p className="font-bold uppercase tracking-wider text-cyan-400">Level 1 — Simple explanation</p>
              <p className="mt-1.5 leading-relaxed text-slate-300">
                Your bones give your body structure and strength, while your muscles let you move, stand, and lift objects against gravity.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
              <p className="font-bold uppercase tracking-wider text-cyan-400">Level 2 — Why it matters in space</p>
              <p className="mt-1.5 leading-relaxed text-slate-300">
                Without Earth&apos;s constant pull of gravity, weight-bearing bones and postural muscles work much less, which can reduce bone mineral density and muscle mass over long missions unless countered with resistance exercise.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
              <p className="font-bold uppercase tracking-wider text-slate-400">Level 3 — Scientific status</p>
              <p className="mt-1.5 leading-relaxed text-slate-400">
                TUMI-HEALT does not collect DEXA bone scans or muscle-mass measurements in this prototype. No bone or muscle indicators are fabricated or displayed.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/hazards"
            className="rounded-lg border border-cyan-700 bg-cyan-950/40 px-3.5 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-950"
          >
            Explore Gravity Fields Hazard →
          </Link>
          <Link
            to="/guides"
            className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            View Health Guides →
          </Link>
        </div>
      </div>
    );
  }

  const regionInfo = REGION_META[region];
  const meta = selectedIndicator ? getIndicatorMetadata(selectedIndicator) : undefined;
  const guidance = GUIDANCE_CATALOG.find((g) => g.category === region) ?? GUIDANCE_CATALOG[3];
  const diastolicValue =
    latestRecord?.category === 'cardiovascular'
      ? (latestRecord.blood_pressure?.diastolic ?? null)
      : null;
  const clinical = evaluateIndicatorClinicalSeverity({
    indicator: selectedIndicator,
    category: region,
    latestValue: latestRecord?.value ?? null,
    diastolicValue,
    baseline: baseline ?? undefined,
    assessmentStatus: assessment?.assessment_status,
  });
  const status = clinicalSeverityToHealthStatus(clinical.severity);
  const displayUnit = formatClinicalUnit(latestRecord?.unit, selectedIndicator);
  const pctFormatted = formatPercentageShift(baseline?.period_comparison.percentage_change);

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="space-y-3.5">
        {onBackToSummary && (
          <button
            type="button"
            onClick={onBackToSummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            ← View All-Systems Summary
          </button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-cyan-400">Selected Body Region</p>
            <h3 className="text-lg font-semibold text-white">{regionInfo.title}</h3>
          </div>
          {catalogList.length > 0 && (
            <select
              aria-label="Select indicator in this body system"
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200"
            >
              {catalogList.map((item) => (
                <option key={item.indicator_id} value={item.indicator_id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {regionInfo.caution && <Alert kind="info">{regionInfo.caution}</Alert>}
        {loadError && <Alert kind="error">{loadError}</Alert>}

        {/* Level 1 — Simple explanation */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="font-bold uppercase tracking-wider text-cyan-400">Level 1 — Simple explanation</p>
          <p className="mt-1 leading-relaxed text-slate-200">{regionInfo.level1Simple}</p>
        </div>

        {/* Level 2 — Why it matters in space */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="font-bold uppercase tracking-wider text-cyan-400">Level 2 — Why it matters in space</p>
          <p className="mt-1 leading-relaxed text-slate-300">{regionInfo.level2Space}</p>
        </div>

        {/* Your Recorded Measurements */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="mb-1.5 font-semibold uppercase tracking-wider text-slate-400">Your Recorded Measurements</p>
          {!astronautId ? (
            <p className="text-slate-400">
              Select or <Link to="/profiles" className="text-cyan-400 underline">create an astronaut profile</Link> to view personal measurements.
            </p>
          ) : loading ? (
            <p className="text-slate-400">Loading measurements…</p>
          ) : !latestRecord ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-400">No data yet for {meta?.name ?? selectedIndicator}.</span>
              <Link
                to="/import"
                className="rounded-md bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-800"
              >
                Import data
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-base font-semibold text-cyan-300">
                    {latestRecord.category === 'cardiovascular' &&
                    (selectedIndicator === 'systolic_blood_pressure' || selectedIndicator === 'blood_pressure') &&
                    latestRecord.blood_pressure
                      ? `${latestRecord.blood_pressure.systolic}/${latestRecord.blood_pressure.diastolic} mmHg`
                      : `${latestRecord.value ?? 'Missing'} ${displayUnit}`}
                  </span>
                  <span className="ml-2 text-slate-400">
                    on {new Date(latestRecord.timestamp).toLocaleDateString('en-US')}
                  </span>
                </div>
                <OriginBadge origin={latestRecord.data_origin} />
              </div>
              <StatusBadge status={status} label={clinical.badgeLabel} />
              {baseline && (
                <p className="text-slate-400">
                  {baseline.status === 'insufficient_data'
                    ? `Insufficient data for a personal baseline (${baseline.valid_count} of 3 valid samples).`
                    : `Personal median ${baseline.median?.toFixed(2)} ${formatClinicalUnit(baseline.unit, selectedIndicator)} across ${baseline.valid_count} samples${pctFormatted ? ` (${pctFormatted} recent shift)` : ''}.`}
                </p>
              )}
              <p className="text-slate-300">
                <strong className="text-cyan-300">Spaceflight Context:</strong> {clinical.spaceflightContext}
              </p>
              <p className="text-cyan-100">
                <strong className="text-cyan-300">NASA Countermeasure:</strong> {clinical.countermeasure}
              </p>
            </div>
          )}
        </div>

        {/* Level 3 — Scientific information (expandable) */}
        {meta && (
          <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <summary className="cursor-pointer font-bold uppercase tracking-wider text-slate-300">
              Level 3 — Scientific information ({meta.name})
            </summary>
            <div className="mt-2 space-y-1.5 text-slate-400">
              <p><strong>Definition:</strong> {meta.definition} ({meta.measurement_unit})</p>
              <p><strong>Method:</strong> {meta.measurement_method}</p>
              <p><strong>NASA Sources:</strong> {meta.data_source.join(', ')}</p>
              <p><strong>Limitations:</strong> {meta.limitations.join(' ')}</p>
              <p><strong>Guidance:</strong> {guidance.content}</p>
            </div>
          </details>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pt-2">
        <Link
          to="/import"
          className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800"
        >
          Import data
        </Link>
        <Link
          to="/trends"
          className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          View trend
        </Link>
      </div>
    </div>
  );
}
