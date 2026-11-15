import type {
  HealthCategory,
  HealthInsight,
  HealthRecord,
  PersonalBaselineResult,
} from '@/types';
import { calculatePersonalBaselineFromRecords } from '@/services/baseline';
import { getIndicatorMetadata } from '@/services/indicators';
import { queryRecords } from '@/services/storage';

function makeInsightId(prefix: string, indicator: string): string {
  return `ins_${prefix}_${indicator}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface GenerateInsightsOptions {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  staleThresholdDays?: number;
  referenceDate?: string;
}

/**
 * Deterministically converts validated records and personal baseline statistics
 * into traceable, explainable insights.
 *
 * Explicitly separates observed facts, statistical findings, scientific
 * interpretations, recommendations, and unknown information.
 */
export function buildExplainableInsights(
  records: readonly HealthRecord[],
  options: GenerateInsightsOptions,
): HealthInsight[] {
  const staleDays = options.staleThresholdDays ?? 14;
  const nowIso = new Date().toISOString();
  const metadata = getIndicatorMetadata(options.indicator);
  const refs = metadata?.evidence_reference ?? [
    'https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/',
  ];

  const baseline: PersonalBaselineResult = calculatePersonalBaselineFromRecords(
    records,
    {
      astronaut_id: options.astronaut_id,
      category: options.category,
      indicator: options.indicator,
      referenceDate: options.referenceDate,
    },
  );

  const insights: HealthInsight[] = [];

  if (baseline.excluded_records.length > 0) {
    insights.push({
      insight_id: makeInsightId('quality', options.indicator),
      astronaut_id: options.astronaut_id,
      indicator_id: options.indicator,
      insight_type: 'data_quality_issue',
      severity: 'attention',
      description: `${baseline.excluded_records.length} record(s) for ${options.indicator} were excluded from baseline calculation due to missing values, incompatible units, or aggregate-only status.`,
      observed_facts: [
        `Examined ${baseline.total_examined} record(s); ${baseline.excluded_records.length} excluded.`,
      ],
      statistical_findings: [
        `Data completeness ratio is ${(baseline.completeness_ratio * 100).toFixed(1)}%.`,
      ],
      scientific_interpretations: [
        'Incomplete or unit-mismatched records cannot be safely combined into a longitudinal baseline.',
      ],
      recommendations: [
        'Review excluded records and ensure consistent units and complete timestamps on future entries.',
      ],
      unknown_information: [
        'Whether excluded entries reflect sensor gaps or unrecorded measurements.',
      ],
      supporting_records: baseline.excluded_records.map((e) => e.record_id),
      calculation_method: 'completeness_and_unit_audit_v1',
      comparison_period: baseline.time_period,
      evidence_quality: 'low',
      confidence: 'high',
      limitations: baseline.limitations,
      scientific_references: refs,
      created_at: nowIso,
    });
  }

  if (baseline.status === 'insufficient_data') {
    insights.push({
      insight_id: makeInsightId('insufficient', options.indicator),
      astronaut_id: options.astronaut_id,
      indicator_id: options.indicator,
      insight_type: 'insufficient_data',
      severity: 'info',
      description: `Insufficient valid measurements (${baseline.valid_count}) to establish a personal baseline for ${options.indicator}.`,
      observed_facts: [
        `Found ${baseline.valid_count} valid measurement(s) for ${options.indicator}.`,
      ],
      statistical_findings: [
        'Baseline mean and standard deviation are not computed when fewer than 3 valid measurements exist.',
      ],
      scientific_interpretations: [
        'Trend interpretation is deferred until sufficient personal longitudinal data is available.',
      ],
      recommendations: [
        'Record additional measurements over multiple timepoints before evaluating personal trends.',
      ],
      unknown_information: [
        'Personal baseline variability and longitudinal direction for this indicator.',
      ],
      supporting_records: baseline.input_record_ids,
      calculation_method: baseline.calculation_method,
      comparison_period: baseline.time_period,
      evidence_quality: 'insufficient',
      confidence: 'low',
      limitations: baseline.limitations,
      scientific_references: refs,
      created_at: nowIso,
    });
    return insights;
  }

  if (baseline.freshness_days !== null && baseline.freshness_days > staleDays) {
    insights.push({
      insight_id: makeInsightId('stale', options.indicator),
      astronaut_id: options.astronaut_id,
      indicator_id: options.indicator,
      insight_type: 'outdated_measurements',
      severity: 'attention',
      description: `Most recent ${options.indicator} measurement is ${baseline.freshness_days.toFixed(1)} days old (exceeds ${staleDays}-day freshness window).`,
      observed_facts: [
        `Latest valid measurement timestamp: ${baseline.time_period.to}.`,
      ],
      statistical_findings: [
        `Elapsed time since last measurement: ${baseline.freshness_days.toFixed(1)} days.`,
      ],
      scientific_interpretations: [
        'Older measurements may not reflect current physiological status during an active mission phase.',
      ],
      recommendations: [
        'Consider taking a new measurement under documented mission context if operationally appropriate.',
      ],
      unknown_information: [
        'Current physiological value since the last recorded measurement.',
      ],
      supporting_records: baseline.input_record_ids,
      calculation_method: 'freshness_elapsed_days_v1',
      comparison_period: baseline.time_period,
      evidence_quality: 'moderate',
      confidence: 'high',
      limitations: baseline.limitations,
      scientific_references: refs,
      created_at: nowIso,
    });
  }

  const dir = baseline.period_comparison.direction;
  const pct = baseline.period_comparison.percentage_change;
  const abs = baseline.period_comparison.absolute_change;

  if (dir === 'increase' || dir === 'decrease') {
    const insightType =
      options.category === 'sleep'
        ? 'sleep_change'
        : options.category === 'cardiovascular'
          ? 'cardiovascular_variation'
          : 'trend_direction';

    const pctText = pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : '';
    const absText = abs !== null ? `${abs >= 0 ? '+' : ''}${abs.toFixed(2)} ${baseline.unit ?? ''}` : '';

    insights.push({
      insight_id: makeInsightId('trend', options.indicator),
      astronaut_id: options.astronaut_id,
      indicator_id: options.indicator,
      insight_type: insightType,
      severity: pct !== null && Math.abs(pct) >= 15 ? 'attention' : 'info',
      description: `Recent ${options.indicator} measurements show a statistical ${dir} of ${absText}${pctText} compared with the earlier half of recorded history.`,
      observed_facts: [
        `Evaluated ${baseline.valid_count} valid ${options.indicator} measurement(s) in ${baseline.unit}.`,
        `Earlier half mean: ${baseline.period_comparison.earlier_mean?.toFixed(2)} ${baseline.unit}; recent half mean: ${baseline.period_comparison.recent_mean?.toFixed(2)} ${baseline.unit}.`,
      ],
      statistical_findings: [
        `Personal baseline mean: ${baseline.mean?.toFixed(2)} ${baseline.unit}, SD: ${baseline.standard_deviation?.toFixed(2)} ${baseline.unit}.`,
        `Observed change: ${absText}${pctText}.`,
      ],
      scientific_interpretations: [
        metadata?.scientific_relevance ??
          'Statistical variation relative to personal baseline; context such as activity, hydration, and mission phase must be considered.',
      ],
      recommendations: [
        'Review measurement context (activity, sleep state, mission phase) and consult flight medical personnel if persistent.',
      ],
      unknown_information: [
        'Underlying clinical cause cannot be determined from statistical trend alone.',
      ],
      supporting_records: baseline.input_record_ids,
      calculation_method: baseline.calculation_method,
      comparison_period: baseline.time_period,
      evidence_quality: baseline.valid_count >= 5 ? 'high' : 'moderate',
      confidence: baseline.valid_count >= 5 ? 'moderate' : 'low',
      limitations: baseline.limitations,
      scientific_references: refs,
      created_at: nowIso,
    });
  }

  return insights;
}

export async function generateExplainableInsights(
  options: GenerateInsightsOptions,
): Promise<HealthInsight[]> {
  const records = await queryRecords({
    astronaut_id: options.astronaut_id,
    category: options.category,
    indicator: options.indicator,
  });
  return buildExplainableInsights(records, options);
}
