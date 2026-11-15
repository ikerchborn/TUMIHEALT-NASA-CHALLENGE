import type { HealthCategory, ScientificIndicatorMetadata } from '@/types';

/**
 * Scientific Indicator Knowledge Catalog grounded in the verified NASA
 * datasets present in `data/` (OSD-569, OSD-575, UTMB Campaign 1, Apollo AP005).
 *
 * No fictional clinical reference ranges are included.
 */
export const SCIENTIFIC_INDICATOR_CATALOG: readonly ScientificIndicatorMetadata[] = [
  {
    indicator_id: 'hemoglobin',
    name: 'Hemoglobin',
    category: 'blood',
    definition: 'Oxygen-carrying metalloprotein concentration in red blood cells.',
    measurement_unit: 'g/dL',
    measurement_method: 'Complete Blood Count (CBC) hematology analyzer',
    scientific_relevance:
      'Monitors oxygen transport capacity and spaceflight-associated plasma volume or erythropoietic shifts.',
    physiological_context: 'Whole-blood hematology biomarker; sampled intermittently.',
    potential_influencing_factors: [
      'Microgravity fluid shifts',
      'Hydration status',
      'Erythropoiesis adaptation',
    ],
    data_source: ['NASA OSDR OSD-569 (LSDS-7 CBC)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-569'],
    limitations: [
      'Intermittent sampling; OSD-569 provides relative timepoints (e.g., L-3, R+1) rather than absolute ISO timestamps.',
    ],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'hematocrit',
    name: 'Hematocrit',
    category: 'blood',
    definition: 'Volume percentage of red blood cells in whole blood.',
    measurement_unit: '%',
    measurement_method: 'Complete Blood Count (CBC)',
    scientific_relevance:
      'Reflects red cell mass relative to plasma volume during spaceflight adaptation.',
    physiological_context: 'Whole-blood hematology biomarker.',
    potential_influencing_factors: ['Plasma volume contraction', 'Hydration', 'Postflight recovery'],
    data_source: ['NASA OSDR OSD-569 (LSDS-7 CBC)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-569'],
    limitations: ['Intermittent collection; affected by hydration state.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'red_blood_cell_count',
    name: 'Red Blood Cell Count',
    category: 'blood',
    definition: 'Number of erythrocytes per microliter of whole blood.',
    measurement_unit: '10^6/uL',
    measurement_method: 'Complete Blood Count (CBC)',
    scientific_relevance: 'Tracks erythrocyte concentration across preflight and postflight phases.',
    physiological_context: 'Whole-blood cellular count.',
    potential_influencing_factors: ['Spaceflight anemia / hemolysis', 'Fluid shifts'],
    data_source: ['NASA OSDR OSD-569 (LSDS-7 CBC)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-569'],
    limitations: ['Intermittent blood draw required.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'white_blood_cell_count',
    name: 'White Blood Cell Count',
    category: 'blood',
    definition: 'Total leukocyte concentration per microliter of whole blood.',
    measurement_unit: '10^3/uL',
    measurement_method: 'Complete Blood Count (CBC)',
    scientific_relevance: 'Supports monitoring of immune system shifts during space missions.',
    physiological_context: 'Whole-blood immune cell count.',
    potential_influencing_factors: ['Mission stress', 'Immune dysregulation', 'Radiation exposure'],
    data_source: ['NASA OSDR OSD-569 (LSDS-7 CBC)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-569'],
    limitations: ['Non-specific marker; requires differential counts and clinical context.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'platelet_count',
    name: 'Platelet Count',
    category: 'blood',
    definition: 'Thrombocyte concentration per microliter of whole blood.',
    measurement_unit: '10^3/uL',
    measurement_method: 'Complete Blood Count (CBC)',
    scientific_relevance: 'Monitors hemostatic cellular component.',
    physiological_context: 'Whole-blood hematology biomarker.',
    potential_influencing_factors: ['Fluid shifts', 'Inflammatory response'],
    data_source: ['NASA OSDR OSD-569 (LSDS-7 CBC)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-569'],
    limitations: ['Intermittent sampling only.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'albumin',
    name: 'Albumin',
    category: 'blood',
    definition: 'Primary plasma protein synthesized by the liver.',
    measurement_unit: 'g/dL',
    measurement_method: 'Comprehensive Metabolic Panel (CMP), Beckman Coulter AU5800',
    scientific_relevance: 'Reflects nutritional status, hepatic synthesis, and fluid balance.',
    physiological_context: 'Serum biochemistry biomarker.',
    potential_influencing_factors: ['Nutrition', 'Hydration', 'Hepatic function'],
    data_source: ['NASA OSDR OSD-575 (LSDS-8 CMP)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-575'],
    limitations: ['Intermittent serum draw; relative timepoints in OSD-575.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'glucose',
    name: 'Glucose',
    category: 'blood',
    definition: 'Serum glucose concentration.',
    measurement_unit: 'mg/dL',
    measurement_method: 'Comprehensive Metabolic Panel (CMP)',
    scientific_relevance: 'Tracks metabolic energy regulation.',
    physiological_context: 'Serum metabolic biomarker.',
    potential_influencing_factors: ['Fasting status', 'Stress', 'Diet and exercise'],
    data_source: ['NASA OSDR OSD-575 (LSDS-8 CMP)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-575'],
    limitations: ['Requires fasting/meal context for accurate interpretation.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'creatinine',
    name: 'Creatinine',
    category: 'blood',
    definition: 'Serum breakdown product of creatine phosphate from muscle metabolism.',
    measurement_unit: 'mg/dL',
    measurement_method: 'Comprehensive Metabolic Panel (CMP)',
    scientific_relevance: 'Used in evaluating renal filtration and muscle mass changes.',
    physiological_context: 'Serum renal/metabolic biomarker.',
    potential_influencing_factors: ['Muscle mass changes', 'Hydration', 'Renal function'],
    data_source: ['NASA OSDR OSD-575 (LSDS-8 CMP)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-575'],
    limitations: ['Influenced by skeletal muscle volume in microgravity.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'calcium',
    name: 'Calcium',
    category: 'blood',
    definition: 'Total serum calcium concentration.',
    measurement_unit: 'mg/dL',
    measurement_method: 'Comprehensive Metabolic Panel (CMP)',
    scientific_relevance: 'Relevant to bone mineral resorption monitoring in microgravity.',
    physiological_context: 'Serum electrolyte/mineral biomarker.',
    potential_influencing_factors: ['Bone demineralization', 'Vitamin D', 'Hydration'],
    data_source: ['NASA OSDR OSD-575 (LSDS-8 CMP)'],
    evidence_reference: ['https://osdr.nasa.gov/bio/repo/data/studies/OSD-575'],
    limitations: ['Total serum calcium does not directly measure bone density.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'sleep_duration',
    name: 'Sleep Duration',
    category: 'sleep',
    definition: 'Total duration of a recorded sleep episode.',
    measurement_unit: 'hours',
    measurement_method: 'Wrist actigraphy / sleep log',
    scientific_relevance:
      'Monitors cumulative sleep opportunity and potential sleep restriction during missions.',
    physiological_context: 'Circadian and behavioral health indicator.',
    potential_influencing_factors: [
      'Circadian misalignment',
      'Operational workload',
      'Cabin noise and confinement',
    ],
    data_source: ['NASA NLSP UTMB Bedrest Campaign 1 (BRSMACT)'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS',
    ],
    limitations: [
      'UTMB Campaign 1 is a GROUND_ANALOG bed-rest study, not in-flight astronaut data.',
      'sleep_start and sleep_end timestamps are not available in UTMB Campaign 1.',
    ],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'sleep_efficiency',
    name: 'Sleep Efficiency',
    category: 'sleep',
    definition: 'Percentage of time in bed/rest period spent asleep.',
    measurement_unit: '%',
    measurement_method: 'Actigraphy',
    scientific_relevance: 'Quantifies sleep continuity and fragmentation.',
    physiological_context: 'Sleep quality metric.',
    potential_influencing_factors: ['Environmental disturbances', 'Stress', 'Fluid shifts'],
    data_source: ['NASA NLSP UTMB Bedrest Campaign 1 (BRSMACT)'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS',
    ],
    limitations: ['Actigraphy estimates sleep from movement; ground-analog source only.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'sleep_latency',
    name: 'Sleep Latency',
    category: 'sleep',
    definition: 'Elapsed time from rest onset to sleep onset.',
    measurement_unit: 'hours',
    measurement_method: 'Actigraphy / sleep log',
    scientific_relevance: 'Indicates difficulty initiating sleep.',
    physiological_context: 'Sleep initiation metric.',
    potential_influencing_factors: ['Circadian shift', 'Light exposure', 'Behavioral stress'],
    data_source: ['NASA NLSP UTMB Bedrest Campaign 1 (BRSMACT)'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS',
    ],
    limitations: ['Ground-analog data; some records in source contain missing values.'],
    availability_status: 'available_in_nasa_dataset',
  },
  {
    indicator_id: 'heart_rate',
    name: 'Heart Rate',
    category: 'cardiovascular',
    definition: 'Number of cardiac contractions per minute.',
    measurement_unit: 'bpm',
    measurement_method: 'ECG / wearable heart-rate sensor',
    scientific_relevance:
      'Monitors autonomic cardiovascular response, orthostatic tolerance, and exercise load.',
    physiological_context: 'Cardiovascular vital parameter; must be interpreted with activity_context.',
    potential_influencing_factors: ['Exercise', 'Orthostatic stress', 'Sleep state', 'Hydration'],
    data_source: ['NASA NLSP Apollo AP005 (grouped summaries)', 'Local manual/device entry'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS',
    ],
    limitations: [
      'Apollo AP005 contains cohort-level summary statistics (aggregated_not_individual), not individual time-series.',
    ],
    availability_status: 'partial_in_nasa_dataset',
  },
  {
    indicator_id: 'systolic_blood_pressure',
    name: 'Systolic Blood Pressure',
    category: 'cardiovascular',
    definition: 'Peak arterial pressure during ventricular systole.',
    measurement_unit: 'mmHg',
    measurement_method: 'Sphygmomanometer / LBNP protocol cuff',
    scientific_relevance: 'Evaluates arterial pressure regulation and orthostatic response.',
    physiological_context: 'Cardiovascular hemodynamic parameter.',
    potential_influencing_factors: ['Fluid redistribution', 'Postflight orthostatic stress', 'Posture'],
    data_source: ['NASA NLSP Apollo AP005 (grouped summaries)', 'Local manual/device entry'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS',
    ],
    limitations: ['Apollo AP005 values are aggregated group means across protocol conditions.'],
    availability_status: 'partial_in_nasa_dataset',
  },
  {
    indicator_id: 'diastolic_blood_pressure',
    name: 'Diastolic Blood Pressure',
    category: 'cardiovascular',
    definition: 'Minimum arterial pressure during ventricular diastole.',
    measurement_unit: 'mmHg',
    measurement_method: 'Sphygmomanometer / LBNP protocol cuff',
    scientific_relevance: 'Reflects peripheral vascular resistance and resting arterial tone.',
    physiological_context: 'Cardiovascular hemodynamic parameter.',
    potential_influencing_factors: ['Vascular tone', 'Hydration', 'Activity context'],
    data_source: ['NASA NLSP Apollo AP005 (grouped summaries)', 'Local manual/device entry'],
    evidence_reference: [
      'https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS',
    ],
    limitations: ['Apollo AP005 values are aggregated group means.'],
    availability_status: 'partial_in_nasa_dataset',
  },
  {
    indicator_id: 'cardiac_output',
    name: 'Cardiac Output',
    category: 'cardiovascular',
    definition: 'Volume of blood pumped by the heart per minute.',
    measurement_unit: 'L/min',
    measurement_method: 'Echocardiography / impedance cardiography / rebreathing',
    scientific_relevance: 'Tracks overall systemic perfusion and microgravity cardiovascular deconditioning.',
    physiological_context: 'Advanced hemodynamic parameter.',
    potential_influencing_factors: ['Stroke volume', 'Heart rate', 'Microgravity fluid shift'],
    data_source: ['Local manual/device entry (not present in local Apollo AP005 files)'],
    evidence_reference: [
      'https://humanresearchroadmap.nasa.gov/',
    ],
    limitations: [
      'Not present in the local Apollo AP005 or STS-55 files inspected; supported for manual/device entry only.',
    ],
    availability_status: 'planned_manual_or_device',
  },
];

export function getIndicatorMetadata(
  indicatorId: string,
): ScientificIndicatorMetadata | undefined {
  const normalized = indicatorId.trim().toLowerCase();
  return SCIENTIFIC_INDICATOR_CATALOG.find(
    (item) => item.indicator_id === normalized,
  );
}

export function listIndicatorsByCategory(
  category?: HealthCategory,
): ScientificIndicatorMetadata[] {
  if (!category) {
    return [...SCIENTIFIC_INDICATOR_CATALOG];
  }
  return SCIENTIFIC_INDICATOR_CATALOG.filter((item) => item.category === category);
}

export function searchIndicators(query: string): ScientificIndicatorMetadata[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SCIENTIFIC_INDICATOR_CATALOG];
  return SCIENTIFIC_INDICATOR_CATALOG.filter(
    (item) =>
      item.indicator_id.includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.definition.toLowerCase().includes(q),
  );
}
