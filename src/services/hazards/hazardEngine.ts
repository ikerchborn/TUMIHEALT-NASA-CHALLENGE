import type { HazardId, SpaceHazard } from '@/types';

/**
 * Spaceflight Hazard Knowledge Engine based on NASA Human Research Program
 * five core spaceflight hazards.
 *
 * Documents scientific relationships for contextual education; never infers
 * individual exposure or claims causality from correlation.
 */
export const SPACE_HAZARDS_CATALOG: readonly SpaceHazard[] = [
  {
    hazard_id: 'space_radiation',
    name: 'Space Radiation',
    description:
      'Exposure to galactic cosmic rays and solar particle events beyond Earth’s protective magnetosphere.',
    physiological_mechanism:
      'Ionizing radiation can induce DNA damage, oxidative stress, and hematopoietic/cellular stress.',
    potential_health_effects: [
      'Hematopoietic and immune cell alterations',
      'Long-term cellular and cardiovascular tissue stress',
    ],
    related_indicators: [
      'white_blood_cell_count',
      'red_blood_cell_count',
      'platelet_count',
      'hemoglobin',
    ],
    evidence_strength: 'established',
    scientific_references: [
      'https://www.nasa.gov/hrp/hazards',
      'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569',
    ],
    limitations: [
      'Personal radiation dosimetry is not measured by blood biomarkers alone.',
      'Observed blood count shifts do not prove radiation exposure.',
    ],
    mitigation_information: [
      'Spacecraft shielding, solar particle event storm shelters, and dosimetry monitoring.',
    ],
  },
  {
    hazard_id: 'isolation_confinement',
    name: 'Isolation and Confinement',
    description:
      'Extended living in small, enclosed habitats with limited social contact and altered light-dark cues.',
    physiological_mechanism:
      'Circadian disruption and chronic psychosocial stress can alter neuroendocrine and sleep-wake regulation.',
    potential_health_effects: [
      'Sleep duration reduction and sleep fragmentation',
      'Elevated sleep latency and circadian misalignment',
      'Behavioral health and autonomic stress responses',
    ],
    related_indicators: [
      'sleep_duration',
      'sleep_efficiency',
      'sleep_latency',
      'heart_rate',
    ],
    evidence_strength: 'established',
    scientific_references: [
      'https://www.nasa.gov/hrp/hazards',
      'https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS',
    ],
    limitations: [
      'Ground-analog bed-rest studies (e.g., UTMB Campaign 1) simulate confinement and unloading, not true orbital microgravity.',
    ],
    mitigation_information: [
      'Scheduled sleep-wake hygiene, circadian lighting protocols, and behavioral health support.',
    ],
  },
  {
    hazard_id: 'distance_from_earth',
    name: 'Distance from Earth',
    description:
      'Communication latency and limited resupply or medical evacuation capability on deep-space missions.',
    physiological_mechanism:
      'Operational autonomy requirements increase reliance on crew self-assessment and preventive monitoring.',
    potential_health_effects: [
      'Delayed clinical consultation and laboratory confirmation',
      'Increased importance of longitudinal self-monitoring',
    ],
    related_indicators: [
      'heart_rate',
      'systolic_blood_pressure',
      'diastolic_blood_pressure',
      'sleep_duration',
      'glucose',
    ],
    evidence_strength: 'established',
    scientific_references: [
      'https://www.nasa.gov/hrp/hazards',
      'https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/',
    ],
    limitations: [
      'Software self-assessment tools support awareness and documentation but do not replace flight surgeons.',
    ],
    mitigation_information: [
      'Autonomous onboard health tracking, validated escalation protocols, and crew medical training.',
    ],
  },
  {
    hazard_id: 'gravity_fields',
    name: 'Gravity Fields and Microgravity',
    description:
      'Transitions between Earth gravity, microgravity, and partial-gravity planetary environments.',
    physiological_mechanism:
      'Cephalad fluid shifts, reduced mechanical loading, and cardiovascular deconditioning.',
    potential_health_effects: [
      'Plasma volume contraction and hematocrit shifts',
      'Orthostatic intolerance and blood pressure / heart rate changes',
      'Bone mineral resorption (reflected in calcium metabolism)',
      'Cardiac output and vascular tone adaptation',
    ],
    related_indicators: [
      'heart_rate',
      'systolic_blood_pressure',
      'diastolic_blood_pressure',
      'cardiac_output',
      'hematocrit',
      'calcium',
      'creatinine',
    ],
    evidence_strength: 'established',
    scientific_references: [
      'https://www.nasa.gov/hrp/hazards',
      'https://nlsp.nasa.gov/search/data/details/e1fa5c55-ddfe-5548-91ba-864080319f44?dataType=EXPERIMENTS',
    ],
    limitations: [
      'Apollo AP005 datasets provide grouped crew summaries rather than individual longitudinal records.',
    ],
    mitigation_information: [
      'Resistive and aerobic exercise countermeasures, fluid loading protocols, and lower-body negative pressure.',
    ],
  },
  {
    hazard_id: 'hostile_closed_environments',
    name: 'Hostile or Closed Environments',
    description:
      'Closed-loop spacecraft life support with recycled air/water, elevated CO2, and microbial ecology.',
    physiological_mechanism:
      'Environmental stressors (CO2, particulates, cabin noise) can affect metabolic, immune, and sleep parameters.',
    potential_health_effects: [
      'Sleep disturbance from cabin noise or CO2',
      'Immune and inflammatory biomarker shifts',
    ],
    related_indicators: [
      'sleep_efficiency',
      'white_blood_cell_count',
      'albumin',
      'heart_rate',
    ],
    evidence_strength: 'moderate',
    scientific_references: [
      'https://www.nasa.gov/hrp/hazards',
      'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575',
    ],
    limitations: [
      'Cabin environmental telemetry (e.g., CO2 ppm, noise dB) must be recorded separately to correlate exposure.',
    ],
    mitigation_information: [
      'Environmental Control and Life Support System (ECLSS) air/water monitoring and acoustic dampening.',
    ],
  },
];

export function getHazardById(hazardId: HazardId): SpaceHazard | undefined {
  return SPACE_HAZARDS_CATALOG.find((h) => h.hazard_id === hazardId);
}

export function listAllHazards(): SpaceHazard[] {
  return [...SPACE_HAZARDS_CATALOG];
}

export function getHazardsForIndicator(indicatorId: string): SpaceHazard[] {
  const normalized = indicatorId.trim().toLowerCase();
  return SPACE_HAZARDS_CATALOG.filter((h) =>
    h.related_indicators.includes(normalized),
  );
}

export function getIndicatorsForHazard(hazardId: HazardId): string[] {
  const hazard = getHazardById(hazardId);
  return hazard ? [...hazard.related_indicators] : [];
}
