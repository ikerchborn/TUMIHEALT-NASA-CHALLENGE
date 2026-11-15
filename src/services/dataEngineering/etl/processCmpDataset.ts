import type { EtlProcessingReport, ResearchDatasetRecord } from '@/types';
import { processWidePanelCsv, type WidePanelVariableSpec } from './etlUtils';

export const CMP_SOURCE_FILE =
  'data/raw/blood/OSD-575/OSD-575-LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv';

export const CMP_VARIABLE_SPECS: readonly WidePanelVariableSpec[] = [
  {
    valueCol: 'albumin_value_gram_per_deciliter',
    minCol: 'albumin_range_min_gram_per_deciliter',
    maxCol: 'albumin_range_max_gram_per_deciliter',
    indicator: 'albumin',
    originalUnit: 'gram_per_deciliter',
    normalizedUnit: 'g/dL',
  },
  {
    valueCol: 'albumin_to_globulin_ratio_value',
    minCol: 'albumin_to_globulin_ratio_range_min',
    maxCol: 'albumin_to_globulin_ratio_range_max',
    indicator: 'albumin_to_globulin_ratio',
    originalUnit: null,
    normalizedUnit: 'ratio',
  },
  {
    valueCol: 'alkaline_phosphatase_value_units_per_liter',
    minCol: 'alkaline_phosphatase_range_min_units_per_liter',
    maxCol: 'alkaline_phosphatase_range_max_units_per_liter',
    indicator: 'alkaline_phosphatase',
    originalUnit: 'units_per_liter',
    normalizedUnit: 'U/L',
  },
  {
    valueCol: 'alt_value_units_per_liter',
    minCol: 'alt_range_min_units_per_liter',
    maxCol: 'alt_max_units_per_liter',
    indicator: 'alt',
    originalUnit: 'units_per_liter',
    normalizedUnit: 'U/L',
  },
  {
    valueCol: 'ast_value_units_per_liter',
    minCol: 'ast_range_min_units_per_liter',
    maxCol: 'ast_max_units_per_liter',
    indicator: 'ast',
    originalUnit: 'units_per_liter',
    normalizedUnit: 'U/L',
  },
  {
    valueCol: 'total_bilirubin_value_milligram_per_deciliter',
    minCol: 'total_bilirubin_range_min_milligram_per_deciliter',
    maxCol: 'total_bilirubin_range_max_milligram_per_deciliter',
    indicator: 'total_bilirubin',
    originalUnit: 'milligram_per_deciliter',
    normalizedUnit: 'mg/dL',
  },
  {
    valueCol: 'bun_to_creatinine_ratio_value',
    minCol: 'bun_to_creatinine_ratio_range_min',
    maxCol: 'bun_to_creatinine_ratio_range_max',
    indicator: 'bun_to_creatinine_ratio',
    originalUnit: null,
    normalizedUnit: 'ratio',
  },
  {
    valueCol: 'calcium_value_milligram_per_deciliter',
    minCol: 'calcium_range_min_milligram_per_deciliter',
    maxCol: 'calcium_range_max_milligram_per_deciliter',
    indicator: 'calcium',
    originalUnit: 'milligram_per_deciliter',
    normalizedUnit: 'mg/dL',
  },
  {
    valueCol: 'carbon_dioxide_value_millimol_per_liter',
    minCol: 'carbon_dioxide_range_min_millimol_per_liter',
    maxCol: 'carbon_dioxide_range_max_millimol_per_liter',
    indicator: 'carbon_dioxide',
    originalUnit: 'millimol_per_liter',
    normalizedUnit: 'mmol/L',
  },
  {
    valueCol: 'chloride_value_millimol_per_liter',
    minCol: 'chloride_range_min_millimol_per_liter',
    maxCol: 'chloride_range_max_millimol_per_liter',
    indicator: 'chloride',
    originalUnit: 'millimol_per_liter',
    normalizedUnit: 'mmol/L',
  },
  {
    valueCol: 'creatinine_value_milligram_per_deciliter',
    minCol: 'creatinine_range_min_milligram_per_deciliter',
    maxCol: 'creatinine_range_max_milligram_per_deciliter',
    indicator: 'creatinine',
    originalUnit: 'milligram_per_deciliter',
    normalizedUnit: 'mg/dL',
  },
  {
    valueCol: 'egfr_african_american_value_milliliter_per_minute_per_1.73_meter_squared',
    minCol: 'egfr_african_american_range_min_milliliter_per_minute_per_1.73_meter_squared',
    maxCol: 'egfr_african_american_range_max_milliliter_per_minute_per_1.73_meter_squared',
    indicator: 'egfr_african_american',
    originalUnit: 'milliliter_per_minute_per_1.73_meter_squared',
    normalizedUnit: 'mL/min/1.73m^2',
  },
  {
    valueCol: 'egfr_non_african_american_value_milliliter_per_minute_per_1.73_meter_squared',
    minCol: 'egfr_non_african_american_range_min_milliliter_per_minute_per_1.73_meter_squared',
    maxCol: 'egfr_non_african_american_range_max_milliliter_per_minute_per_1.73_meter_squared',
    indicator: 'egfr_non_african_american',
    originalUnit: 'milliliter_per_minute_per_1.73_meter_squared',
    normalizedUnit: 'mL/min/1.73m^2',
  },
  {
    valueCol: 'globulin_value_gram_per_deciliter',
    minCol: 'globulin_range_min_gram_per_deciliter',
    maxCol: 'globulin_range_max_gram_per_deciliter',
    indicator: 'globulin',
    originalUnit: 'gram_per_deciliter',
    normalizedUnit: 'g/dL',
  },
  {
    valueCol: 'glucose_value_milligram_per_deciliter',
    minCol: 'glucose_range_min_milligram_per_deciliter',
    maxCol: 'glucose_range_max_milligram_per_deciliter',
    indicator: 'glucose',
    originalUnit: 'milligram_per_deciliter',
    normalizedUnit: 'mg/dL',
  },
  {
    valueCol: 'potassium_value_millimol_per_liter',
    minCol: 'potassium_range_min_millimol_per_liter',
    maxCol: 'potassium_range_max_millimol_per_liter',
    indicator: 'potassium',
    originalUnit: 'millimol_per_liter',
    normalizedUnit: 'mmol/L',
  },
  {
    valueCol: 'total_protein_value_gram_per_deciliter',
    minCol: 'total_protein_range_min_gram_per_deciliter',
    maxCol: 'total_protein_range_max_gram_per_deciliter',
    indicator: 'total_protein',
    originalUnit: 'gram_per_deciliter',
    normalizedUnit: 'g/dL',
  },
  {
    valueCol: 'sodium_value_millimol_per_liter',
    minCol: 'sodium_range_min_millimol_per_liter',
    maxCol: 'sodium_range_max_millimol_per_liter',
    indicator: 'sodium',
    originalUnit: 'millimol_per_liter',
    normalizedUnit: 'mmol/L',
  },
  {
    valueCol: 'urea_nitrogen_bun_value_milligram_per_deciliter',
    minCol: 'urea_nitrogen_bun_range_min_milligram_per_deciliter',
    maxCol: 'urea_nitrogen_bun_range_max_milligram_per_deciliter',
    indicator: 'urea_nitrogen_bun',
    originalUnit: 'milligram_per_deciliter',
    normalizedUnit: 'mg/dL',
  },
];

/**
 * Transforms raw NASA OSDR OSD-575 Comprehensive Metabolic Panel (CMP) CSV
 * into normalized `ResearchDatasetRecord` entries without inventing ISO dates.
 */
export function processCmpDataset(
  csvText: string,
  sourceFile: string = CMP_SOURCE_FILE,
): { records: ResearchDatasetRecord[]; report: EtlProcessingReport } {
  return processWidePanelCsv(csvText, {
    datasetId: 'OSD-575',
    sourceFile,
    category: 'blood',
    specimenType: 'Serum',
    assay: 'Comprehensive Metabolic Panel',
    collectionContext: 'SpaceX Inspiration4 serum chemistry (Quest Diagnostics / Beckman Coulter AU5800)',
    dataOrigin: 'SPACEFLIGHT',
    variables: CMP_VARIABLE_SPECS,
  });
}
