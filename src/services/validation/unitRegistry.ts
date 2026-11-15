import type { HealthCategory } from '@/types';

/**
 * Registry of known indicators and their accepted measurement units per category.
 *
 * Units are never silently converted. Submitting an incompatible unit for a
 * registered indicator is rejected by validation so measurement provenance
 * remains exact.
 */
export const INDICATOR_UNIT_REGISTRY: Record<
  HealthCategory,
  Record<string, readonly string[]>
> = {
  blood: {
    albumin: ['g/dL', 'g/L'],
    glucose: ['mg/dL', 'mmol/L'],
    hemoglobin: ['g/dL', 'g/L'],
    hematocrit: ['%'],
    white_blood_cell_count: ['10^3/uL', '10^9/L'],
    red_blood_cell_count: ['10^6/uL', '10^12/L'],
    platelet_count: ['10^3/uL', '10^9/L'],
    creatinine: ['mg/dL', 'umol/L'],
    sodium: ['mmol/L', 'mEq/L'],
    potassium: ['mmol/L', 'mEq/L'],
    calcium: ['mg/dL', 'mmol/L'],
  },
  sleep: {
    sleep_duration: ['hours', 'minutes'],
    sleep_latency: ['hours', 'minutes'],
    sleep_efficiency: ['%'],
  },
  cardiovascular: {
    heart_rate: ['bpm'],
    blood_pressure: ['mmHg'],
    systolic_blood_pressure: ['mmHg'],
    diastolic_blood_pressure: ['mmHg'],
    cardiac_output: ['L/min'],
  },
};

export function getAllowedUnits(
  category: HealthCategory,
  indicator: string,
): readonly string[] | undefined {
  const normalized = indicator.trim().toLowerCase();
  return INDICATOR_UNIT_REGISTRY[category][normalized];
}
