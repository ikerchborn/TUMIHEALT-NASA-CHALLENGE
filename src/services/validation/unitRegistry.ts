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
    albumin_to_globulin_ratio: ['ratio', 'dimensionless'],
    alkaline_phosphatase: ['U/L'],
    alt: ['U/L'],
    ast: ['U/L'],
    total_bilirubin: ['mg/dL', 'umol/L'],
    bun_to_creatinine_ratio: ['ratio', 'dimensionless'],
    glucose: ['mg/dL', 'mmol/L'],
    hemoglobin: ['g/dL', 'g/L'],
    hematocrit: ['%'],
    white_blood_cell_count: ['10^3/uL', '10^9/L'],
    red_blood_cell_count: ['10^6/uL', '10^12/L'],
    platelet_count: ['10^3/uL', '10^9/L'],
    creatinine: ['mg/dL', 'umol/L'],
    carbon_dioxide: ['mmol/L', 'mEq/L'],
    chloride: ['mmol/L', 'mEq/L'],
    egfr_african_american: ['mL/min/1.73m^2'],
    egfr_non_african_american: ['mL/min/1.73m^2'],
    globulin: ['g/dL', 'g/L'],
    total_protein: ['g/dL', 'g/L'],
    urea_nitrogen_bun: ['mg/dL', 'mmol/L'],
    sodium: ['mmol/L', 'mEq/L'],
    potassium: ['mmol/L', 'mEq/L'],
    calcium: ['mg/dL', 'mmol/L'],
    absolute_basophils: ['cells/uL'],
    absolute_eosinophils: ['cells/uL'],
    absolute_lymphocytes: ['cells/uL'],
    absolute_monocytes: ['cells/uL'],
    absolute_neutrophils: ['cells/uL'],
    basophils_percent: ['%'],
    eosinophils_percent: ['%'],
    lymphocytes_percent: ['%'],
    monocytes_percent: ['%'],
    neutrophils_percent: ['%'],
    mch: ['pg'],
    mchc: ['g/dL'],
    mcv: ['fL'],
    mpv: ['fL'],
    rdw: ['%'],
  },
  sleep: {
    sleep_duration: ['hours', 'minutes'],
    sleep_latency: ['hours', 'minutes'],
    sleep_efficiency: ['%', 'percent'],
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

/**
 * Known source-dataset unit discrepancies that require verification and must
 * be rejected rather than silently converted or accepted as standard units.
 */
export const AMBIGUOUS_SOURCE_UNIT_NOTES: Record<string, string> = {
  'blood:hemoglobin:%':
    'OSD-569 (LSDS-7 CBC) labels hemoglobin with "%" (marked unit_label_requires_verification). "%" is rejected without converting to g/dL until the source unit is verified.',
};

export function getAmbiguousUnitNote(
  category: HealthCategory,
  indicator: string,
  unit: string,
): string | undefined {
  const key = `${category}:${indicator.trim().toLowerCase()}:${unit.trim()}`;
  return AMBIGUOUS_SOURCE_UNIT_NOTES[key];
}
