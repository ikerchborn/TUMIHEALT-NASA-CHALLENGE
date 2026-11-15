import type { EtlProcessingReport, ResearchDatasetRecord } from '@/types';
import { processWidePanelCsv, type WidePanelVariableSpec } from './etlUtils';

/**
 * Note: The original filename says `OSD-596-...`, but NASA OSDR OSD-596 is an
 * unrelated Drosophila study. The verified study ID for this Inspiration4 CBC
 * dataset is `OSD-569`.
 */
export const CBC_SOURCE_FILE =
  'data/raw/blood/OSD-569/OSD-596-LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv';

export const CBC_VARIABLE_SPECS: readonly WidePanelVariableSpec[] = [
  {
    valueCol: 'absolute_basophils_value_cells_per_microliter',
    minCol: 'absolute_basophils_range_min_cells_per_microliter',
    maxCol: 'absolute_basophils_range_max_cells_per_microliter',
    indicator: 'absolute_basophils',
    originalUnit: 'cells_per_microliter',
    normalizedUnit: 'cells/uL',
  },
  {
    valueCol: 'absolute_eosinophils_value_cells_per_microliter',
    minCol: 'absolute_eosinophils_range_min_cells_per_microliter',
    maxCol: 'absolute_eosinophils_range_max_cells_per_microliter',
    indicator: 'absolute_eosinophils',
    originalUnit: 'cells_per_microliter',
    normalizedUnit: 'cells/uL',
  },
  {
    valueCol: 'absolute_lymphocytes_value_cells_per_microliter',
    minCol: 'absolute_lymphocytes_range_min_cells_per_microliter',
    maxCol: 'absolute_lymphocytes_range_max_cells_per_microliter',
    indicator: 'absolute_lymphocytes',
    originalUnit: 'cells_per_microliter',
    normalizedUnit: 'cells/uL',
  },
  {
    valueCol: 'absolute_monocytes_value_cells_per_microliter',
    minCol: 'absolute_monocytes_range_min_cells_per_microliter',
    maxCol: 'absolute_monocytes_range_max_cells_per_microliter',
    indicator: 'absolute_monocytes',
    originalUnit: 'cells_per_microliter',
    normalizedUnit: 'cells/uL',
  },
  {
    valueCol: 'absolute_neutrophils_value_cells_per_microliter',
    minCol: 'absolute_neutrophils_range_min_cells_per_microliter',
    maxCol: 'absolute_neutrophils_range_max_cells_per_microliter',
    indicator: 'absolute_neutrophils',
    originalUnit: 'cells_per_microliter',
    normalizedUnit: 'cells/uL',
  },
  {
    valueCol: 'basophils_value_percent',
    minCol: 'basophils_range_min_percent',
    maxCol: 'basophils_range_max_percent',
    indicator: 'basophils_percent',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'eosinophils_value_percent',
    minCol: 'eosinophils_range_min_percent',
    maxCol: 'eosinophils_range_max_percent',
    indicator: 'eosinophils_percent',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'hematocrit_value_percent',
    minCol: 'hematocrit_range_min_percent',
    maxCol: 'hematocrit_range_max_percent',
    indicator: 'hematocrit',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'hemoglobin_value_percent',
    minCol: 'hemoglobin_range_min_percent',
    maxCol: 'hemoglobin_range_max_percent',
    indicator: 'hemoglobin',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'lymphocytes_value_percent',
    minCol: 'lymphocytes_range_min_percent',
    maxCol: 'lymphocytes_range_max_percent',
    indicator: 'lymphocytes_percent',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'mch_value_picogram',
    minCol: 'mch_range_min_picogram',
    maxCol: 'mch_range_max_picogram',
    indicator: 'mch',
    originalUnit: 'picogram',
    normalizedUnit: 'pg',
  },
  {
    valueCol: 'mchc_value_grams_per_deciliter',
    minCol: 'mchc_range_min_grams_per_deciliter',
    maxCol: 'mchc_range_max_grams_per_deciliter',
    indicator: 'mchc',
    originalUnit: 'grams_per_deciliter',
    normalizedUnit: 'g/dL',
  },
  {
    valueCol: 'mcv_value_femtoliter',
    minCol: 'mcv_range_min_femtoliter',
    maxCol: 'mcv_range_max_femtoliter',
    indicator: 'mcv',
    originalUnit: 'femtoliter',
    normalizedUnit: 'fL',
  },
  {
    valueCol: 'monocytes_value_percent',
    minCol: 'monocytes_range_min_percent',
    maxCol: 'monocytes_range_max_percent',
    indicator: 'monocytes_percent',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'mpv_value_femtoliter',
    minCol: 'mpv_range_min_femtoliter',
    maxCol: 'mpv_range_max_femtoliter',
    indicator: 'mpv',
    originalUnit: 'femtoliter',
    normalizedUnit: 'fL',
  },
  {
    valueCol: 'neutrophils_value_percent',
    minCol: 'neutrophils_range_min_percent',
    maxCol: 'neutrophils_range_max_percent',
    indicator: 'neutrophils_percent',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'platelet_count_value_thousand_per_microliter',
    minCol: 'platelet_count_range_min_thousand_per_microliter',
    maxCol: 'platelet_count_range_max_thousand_per_microliter',
    indicator: 'platelet_count',
    originalUnit: 'thousand_per_microliter',
    normalizedUnit: '10^3/uL',
  },
  {
    valueCol: 'rdw_value_percent',
    minCol: 'rdw_range_min_percent',
    maxCol: 'rdw_range_max_percent',
    indicator: 'rdw',
    originalUnit: 'percent',
    normalizedUnit: '%',
  },
  {
    valueCol: 'red_blood_cell_count_value_million_per_microliter',
    minCol: 'red_blood_cell_count_range_min_million_per_microliter',
    maxCol: 'red_blood_cell_count_range_max_million_per_microliter',
    indicator: 'red_blood_cell_count',
    originalUnit: 'million_per_microliter',
    normalizedUnit: '10^6/uL',
  },
  {
    valueCol: 'white_blood_cell_count_value_thousand_per_microliter',
    minCol: 'white_blood_cell_count_range_min_thousand_per_microliter',
    maxCol: 'white_blood_cell_count_range_max_thousand_per_microliter',
    indicator: 'white_blood_cell_count',
    originalUnit: 'thousand_per_microliter',
    normalizedUnit: '10^3/uL',
  },
];

/**
 * Transforms raw NASA OSDR OSD-569 Complete Blood Count (CBC) CSV
 * into normalized `ResearchDatasetRecord` entries. Flags ambiguous "%"
 * hemoglobin units without silently converting to g/dL.
 */
export function processCbcDataset(
  csvText: string,
  sourceFile: string = CBC_SOURCE_FILE,
): { records: ResearchDatasetRecord[]; report: EtlProcessingReport } {
  return processWidePanelCsv(csvText, {
    datasetId: 'OSD-569',
    sourceFile,
    category: 'blood',
    specimenType: 'Whole Blood',
    assay: 'Complete Blood Count',
    collectionContext: 'SpaceX Inspiration4 whole-blood CBC (raw file labeled OSD-596)',
    dataOrigin: 'SPACEFLIGHT',
    variables: CBC_VARIABLE_SPECS,
  });
}
