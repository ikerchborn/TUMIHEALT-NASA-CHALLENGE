import {
  calculatePersonalBaselineFromRecords,
  evaluateIndicatorClinicalSeverity,
  evaluateSelfAssessmentFromRecords,
  formatClinicalUnit,
  formatPercentageShift,
  type ClinicalSeverity,
} from '@/services';
import type { HealthRecord } from '@/types';
import type { BodyRegionId } from './BodyRegionPanel';
import { clinicalSeverityToHealthStatus, severityBorderClass, StatusBadge } from './ui';

export interface BodySystemSummaryItem {
  id: BodyRegionId;
  title: string;
  severity: ClinicalSeverity | 'educational';
  badgeLabel: string;
  metricLine: string;
  summaryText: string;
  immediateAction: string;
}

function latestNumericRecord(
  records: readonly HealthRecord[],
  category: HealthRecord['category'],
  indicator: string,
): HealthRecord | undefined {
  const matching = records
    .filter((r) => r.category === category && r.indicator === indicator && r.value !== null)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return matching.at(-1);
}

export function buildBodySystemSummaries(
  records: readonly HealthRecord[],
  astronautId?: string,
): {
  items: BodySystemSummaryItem[];
  severities: Record<BodyRegionId, ClinicalSeverity | 'educational'>;
  deviationCount: number;
  nominalCount: number;
} {
  const id = astronautId ?? '';

  // 1. Sleep / Neuro-Circadian
  const sleepRec = latestNumericRecord(records, 'sleep', 'sleep_duration');
  const sleepBase = id
    ? calculatePersonalBaselineFromRecords(records, {
        astronaut_id: id,
        category: 'sleep',
        indicator: 'sleep_duration',
      })
    : undefined;
  const sleepAssess = id
    ? evaluateSelfAssessmentFromRecords(records, {
        astronaut_id: id,
        category: 'sleep',
        indicator: 'sleep_duration',
      })
    : undefined;
  const sleepEval = evaluateIndicatorClinicalSeverity({
    indicator: 'sleep_duration',
    category: 'sleep',
    latestValue: sleepRec?.value ?? null,
    baseline: sleepBase,
    assessmentStatus: sleepAssess?.assessment_status,
  });
  const sleepPct = formatPercentageShift(sleepBase?.period_comparison.percentage_change);
  const sleepMetricLine = sleepRec
    ? `${sleepRec.value} ${formatClinicalUnit(sleepRec.unit, 'sleep_duration')}${sleepPct ? ` (${sleepPct} vs baseline)` : ''}`
    : 'No sleep duration telemetry recorded';

  // 2. Heart & Cardiovascular
  const hrRec = latestNumericRecord(records, 'cardiovascular', 'heart_rate');
  const hrBase = id
    ? calculatePersonalBaselineFromRecords(records, {
        astronaut_id: id,
        category: 'cardiovascular',
        indicator: 'heart_rate',
      })
    : undefined;
  const hrAssess = id
    ? evaluateSelfAssessmentFromRecords(records, {
        astronaut_id: id,
        category: 'cardiovascular',
        indicator: 'heart_rate',
      })
    : undefined;
  const hrEval = evaluateIndicatorClinicalSeverity({
    indicator: 'heart_rate',
    category: 'cardiovascular',
    latestValue: hrRec?.value ?? null,
    baseline: hrBase,
    assessmentStatus: hrAssess?.assessment_status,
  });

  const bpRec =
    latestNumericRecord(records, 'cardiovascular', 'systolic_blood_pressure') ??
    latestNumericRecord(records, 'cardiovascular', 'blood_pressure');
  const bpBase = id
    ? calculatePersonalBaselineFromRecords(records, {
        astronaut_id: id,
        category: 'cardiovascular',
        indicator: bpRec?.indicator ?? 'systolic_blood_pressure',
      })
    : undefined;
  const bpAssess = id
    ? evaluateSelfAssessmentFromRecords(records, {
        astronaut_id: id,
        category: 'cardiovascular',
        indicator: bpRec?.indicator ?? 'systolic_blood_pressure',
      })
    : undefined;
  const bpDia =
    bpRec?.category === 'cardiovascular' ? (bpRec.blood_pressure?.diastolic ?? null) : null;
  const bpEval = evaluateIndicatorClinicalSeverity({
    indicator: bpRec?.indicator ?? 'systolic_blood_pressure',
    category: 'cardiovascular',
    latestValue: bpRec?.value ?? null,
    diastolicValue: bpDia,
    baseline: bpBase,
    assessmentStatus: bpAssess?.assessment_status,
  });

  const severityRank: Record<ClinicalSeverity, number> = {
    alert: 0,
    attention: 1,
    nominal: 2,
    insufficient: 3,
  };
  const cardioSeverity: ClinicalSeverity =
    severityRank[hrEval.severity] <= severityRank[bpEval.severity]
      ? hrEval.severity
      : bpEval.severity;
  const hrPct = formatPercentageShift(hrBase?.period_comparison.percentage_change);
  const hrPart = hrRec ? `${hrRec.value} bpm${hrPct ? ` (${hrPct})` : ''}` : null;
  const bpPart = bpRec
    ? `BP ${bpDia !== null ? `${bpRec.value}/${bpDia}` : bpRec.value} mmHg`
    : null;
  const cardioMetricLine =
    [hrPart, bpPart].filter(Boolean).join(' | ') || 'No cardiovascular telemetry recorded';

  // 3. Blood & Immune
  const hgbRec = latestNumericRecord(records, 'blood', 'hemoglobin');
  const hgbBase = id
    ? calculatePersonalBaselineFromRecords(records, {
        astronaut_id: id,
        category: 'blood',
        indicator: 'hemoglobin',
      })
    : undefined;
  const hgbAssess = id
    ? evaluateSelfAssessmentFromRecords(records, {
        astronaut_id: id,
        category: 'blood',
        indicator: 'hemoglobin',
      })
    : undefined;
  const hgbEval = evaluateIndicatorClinicalSeverity({
    indicator: 'hemoglobin',
    category: 'blood',
    latestValue: hgbRec?.value ?? null,
    baseline: hgbBase,
    assessmentStatus: hgbAssess?.assessment_status,
  });
  const hgbPct = formatPercentageShift(hgbBase?.period_comparison.percentage_change);
  const bloodMetricLine = hgbRec
    ? `Hemoglobin ${hgbRec.value} ${hgbRec.unit}${hgbPct ? ` (${hgbPct})` : ''}`
    : 'No hematology lab records imported';

  const monitoredItems: BodySystemSummaryItem[] = [
    {
      id: 'sleep',
      title: 'Sleep / Neuro-Circadian',
      severity: sleepEval.severity,
      badgeLabel:
        sleepEval.severity === 'attention'
          ? 'Attention'
          : sleepEval.badgeLabel,
      metricLine: sleepMetricLine,
      summaryText:
        sleepEval.severity === 'attention' || sleepEval.severity === 'alert'
          ? 'Acute sleep restriction detected.'
          : sleepEval.severity === 'nominal'
            ? 'Sleep duration within personal baseline (± 1 SD).'
            : 'Import sleep records to compute personal baseline.',
      immediateAction:
        sleepEval.severity === 'insufficient'
          ? 'Import wearable actigraphy data to establish baseline.'
          : 'Initiate NASA Circadian Light Protocol & 20-min pre-EVA recovery nap.',
    },
    {
      id: 'cardiovascular',
      title: 'Heart & Cardiovascular',
      severity: cardioSeverity,
      badgeLabel:
        cardioSeverity === 'attention'
          ? 'Review'
          : cardioSeverity === 'alert'
            ? 'Action / Flight Surgeon Alert'
            : cardioSeverity === 'nominal'
              ? 'Nominal'
              : 'Not enough data',
      metricLine: cardioMetricLine,
      summaryText:
        cardioSeverity === 'attention' || cardioSeverity === 'alert'
          ? 'Elevated autonomic load & mild systolic shift.'
          : cardioSeverity === 'nominal'
            ? 'Heart rate and blood pressure within personal range.'
            : 'Import resting HR and BP cuff readings to establish baseline.',
      immediateAction:
        cardioSeverity === 'insufficient'
          ? 'Import resting HR and BP measurements.'
          : 'Complete scheduled ARED/CEVIS session & check hydration.',
    },
    {
      id: 'blood',
      title: 'Blood & Immune',
      severity: hgbEval.severity,
      badgeLabel: hgbEval.badgeLabel,
      metricLine: bloodMetricLine,
      summaryText:
        hgbEval.severity === 'alert'
          ? 'Hemoglobin below 12.0 g/dL threshold — Flight Surgeon review required.'
          : hgbEval.severity === 'attention'
            ? 'Significant hematologic shift from personal baseline.'
            : hgbEval.severity === 'nominal'
              ? 'Within personal range; monitor for spaceflight plasma shift.'
              : 'Import CBC lab records to evaluate hematology trends.',
      immediateAction:
        hgbEval.severity === 'alert'
          ? 'Flag for immediate Flight Surgeon review and log fatigue/dizziness.'
          : 'Maintain iron-balanced spaceflight nutrition & log workout fatigue.',
    },
  ];

  monitoredItems.sort(
    (a, b) =>
      severityRank[a.severity as ClinicalSeverity] -
      severityRank[b.severity as ClinicalSeverity],
  );

  const bonesItem: BodySystemSummaryItem = {
    id: 'bones_muscles',
    title: 'Bones & Muscles',
    severity: 'educational',
    badgeLabel: 'Educational / Routine',
    metricLine: 'Microgravity musculoskeletal unloading module',
    summaryText: 'Educational reference — DEXA/muscle scans are not actively streamed.',
    immediateAction: 'Prompt: Complete scheduled ARED resistive exercise check-in.',
  };

  const items = [...monitoredItems, bonesItem];
  const deviationCount = monitoredItems.filter(
    (item) => item.severity === 'alert' || item.severity === 'attention',
  ).length;
  const nominalCount = monitoredItems.filter(
    (item) => item.severity === 'nominal',
  ).length;

  return {
    items,
    severities: {
      sleep: sleepEval.severity,
      cardiovascular: cardioSeverity,
      blood: hgbEval.severity,
      bones_muscles: 'educational',
    },
    deviationCount,
    nominalCount,
  };
}

interface MissionBodyStatusSummaryProps {
  records: readonly HealthRecord[];
  astronautId?: string;
  loading: boolean;
  onSelectRegion: (region: BodyRegionId) => void;
}

export function MissionBodyStatusSummary({
  records,
  astronautId,
  loading,
  onSelectRegion,
}: MissionBodyStatusSummaryProps) {
  const { items, deviationCount, nominalCount } = buildBodySystemSummaries(
    records,
    astronautId,
  );

  const counterText =
    deviationCount === 0 && nominalCount === 0
      ? 'Awaiting Telemetry'
      : `${deviationCount} Deviation${deviationCount === 1 ? '' : 's'} Detected · ${nominalCount} Nominal`;

  const counterStyle =
    deviationCount > 0
      ? 'border-amber-500/70 bg-amber-950/50 text-amber-200'
      : nominalCount > 0
        ? 'border-emerald-600/70 bg-emerald-950/45 text-emerald-200'
        : 'border-slate-700 bg-slate-900 text-slate-300';

  return (
    <section
      aria-labelledby="body-alerts-summary-title"
      className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/75 p-5"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              ACTIVE BODY ALERTS &amp; SYSTEM CONSENSUS
            </p>
            <h2
              id="body-alerts-summary-title"
              className="mt-1 text-lg font-semibold text-white"
            >
              Mission Body Status Summary
            </h2>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${counterStyle}`}
          >
            {counterText}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Prioritized multi-system triage. Select any system below or click a hotspot on the 2D body map for a focused deep-dive.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400">Evaluating body systems…</p>
        ) : (
          <ul className="space-y-2.5" aria-label="Prioritized body system issues">
            {items.map((item) => {
              const isEducational = item.severity === 'educational';
              const healthStatus = isEducational
                ? 'not-enough-data'
                : clinicalSeverityToHealthStatus(item.severity as ClinicalSeverity);
              const borderClass = isEducational
                ? 'border-cyan-800/50 hover:border-cyan-500/60'
                : `${severityBorderClass(healthStatus)} hover:brightness-110`;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRegion(item.id)}
                    className={`w-full rounded-xl border-2 ${borderClass} bg-slate-950/75 p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {item.title}
                      </span>
                      {isEducational ? (
                        <span className="inline-flex items-center rounded-full border border-cyan-700/70 bg-cyan-950/45 px-2.5 py-0.5 text-xs font-semibold text-cyan-200">
                          {item.badgeLabel}
                        </span>
                      ) : (
                        <StatusBadge
                          status={healthStatus}
                          label={item.badgeLabel}
                          className="px-2.5 py-0.5 text-xs"
                        />
                      )}
                    </div>

                    <p className="mt-1.5 font-mono text-xs font-semibold text-cyan-300">
                      {item.metricLine}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      <strong className="text-slate-200">Summary:</strong> {item.summaryText}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100">
                      <strong className="text-cyan-300">Immediate Action:</strong> {item.immediateAction}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
        Click any system card or anatomical hotspot to inspect Level 1–3 details and baseline trends.
      </p>
    </section>
  );
}
