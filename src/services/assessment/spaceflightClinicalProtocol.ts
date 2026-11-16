import type {
  AssessmentStatus,
  HealthCategory,
  PersonalBaselineResult,
} from '@/types';

export type MissionEnvironment = 'iss-microgravity' | 'lunar-base' | 'mars-transit';

export type ClinicalSeverity = 'nominal' | 'attention' | 'alert' | 'insufficient';

export interface MissionEnvironmentOption {
  id: MissionEnvironment;
  label: string;
  shortLabel: string;
  gravityLabel: string;
}

export const MISSION_ENVIRONMENTS: readonly MissionEnvironmentOption[] = [
  {
    id: 'iss-microgravity',
    label: 'ISS / Microgravity',
    shortLabel: 'ISS (0g)',
    gravityLabel: 'Microgravity · LEO',
  },
  {
    id: 'lunar-base',
    label: 'Lunar Base / 1/6g',
    shortLabel: 'Lunar (1/6g)',
    gravityLabel: 'Partial Gravity · 0.16g',
  },
  {
    id: 'mars-transit',
    label: 'Mars Transit',
    shortLabel: 'Mars Transit',
    gravityLabel: 'Deep Space · 0g Transit',
  },
] as const;

export interface IndicatorClinicalEvaluation {
  severity: ClinicalSeverity;
  badgeLabel: string;
  spaceflightContext: string;
  countermeasure: string;
  withinOneSd: boolean | null;
}

export interface MultiSystemConsensusInput {
  environment: MissionEnvironment;
  sleepHours: number | null;
  sleepPctChange: number | null;
  sleepSeverity: ClinicalSeverity;
  heartRateBpm: number | null;
  heartRatePctChange: number | null;
  heartRateSeverity: ClinicalSeverity;
  systolicMmHg: number | null;
  diastolicMmHg: number | null;
  bpPctChange: number | null;
  bpSeverity: ClinicalSeverity;
  hemoglobinGdL: number | null;
  hemoglobinPctChange: number | null;
  hemoglobinSeverity: ClinicalSeverity;
  reportedSymptoms?: boolean;
}

export interface MultiSystemConsensusResult {
  overallSeverity: ClinicalSeverity;
  overallBadgeLabel: string;
  synthesizedDiagnosis: string;
  environmentRiskNote: string;
  deviatedSystemsCount: number;
  immediateCrewSelfAction: string;
  missionRoutinePrompt: string[];
  flightSurgeonTrigger: string;
}

/**
 * Formats a percentage shift strictly to 1 decimal place (e.g. "-20.6%", "+19.4%").
 */
export function formatPercentageShift(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const rounded = Number(pct.toFixed(1));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}

/**
 * Normalizes display units (e.g. "hours" -> "hrs").
 */
export function formatClinicalUnit(unit: string | null | undefined, indicator?: string): string {
  if (!unit) {
    return indicator === 'sleep_duration' ? 'hrs' : '';
  }
  if (unit === 'hours' && (indicator === 'sleep_duration' || indicator === 'sleep_latency')) {
    return 'hrs';
  }
  return unit;
}

export function getSpaceflightProtocol(
  indicator: string,
  category: HealthCategory,
  environment: MissionEnvironment = 'iss-microgravity',
): { spaceflightContext: string; countermeasure: string } {
  const isSleep = category === 'sleep' || indicator.startsWith('sleep_');
  const isCardio =
    category === 'cardiovascular' ||
    indicator === 'heart_rate' ||
    indicator === 'systolic_blood_pressure' ||
    indicator === 'diastolic_blood_pressure' ||
    indicator === 'blood_pressure' ||
    indicator === 'cardiac_output';
  const isBlood = category === 'blood' || indicator === 'hemoglobin';

  if (isSleep) {
    const contextByEnv: Record<MissionEnvironment, string> = {
      'iss-microgravity':
        'Circadian misalignment due to 90-minute orbital sunrise/sunset cycles and cabin noise/CO2.',
      'lunar-base':
        'Circadian disruption from 29.5-day lunar photoperiods, EVA shift rotations, and habitat acoustic load.',
      'mars-transit':
        'Progressive Earth-communications delay, 24.6-hr Sol drift, and deep-space confinement sleep fragmentation.',
    };
    const countermeasureByEnv: Record<MissionEnvironment, string> = {
      'iss-microgravity':
        'Execute NASA Circadian Light Protocol (blue-enriched light exposure upon waking, blue-depleted light 2 hrs pre-sleep), restrict caffeine 6 hrs prior to sleep block, and schedule a 20-min recovery nap before EVA/critical tasks.',
      'lunar-base':
        'Execute NASA Circadian Light Protocol (blue-enriched light upon waking, blue-depleted light 2 hrs pre-sleep), restrict caffeine 6 hrs pre-sleep, and schedule a 20-min recovery nap prior to suited lunar EVA.',
      'mars-transit':
        'Execute NASA Circadian Light Protocol anchored to crew sleep schedule, restrict caffeine 6 hrs pre-sleep, verify cabin ppCO2 < 2.0 mmHg, and schedule a 20-min recovery nap before critical flight operations.',
    };
    return {
      spaceflightContext: contextByEnv[environment],
      countermeasure: countermeasureByEnv[environment],
    };
  }

  if (isCardio) {
    const contextByEnv: Record<MissionEnvironment, string> = {
      'iss-microgravity':
        'Cephalad fluid shift in microgravity, autonomic stress, and cardiovascular deconditioning.',
      'lunar-base':
        'Partial-gravity (1/6g) orthostatic transition, suited EVA workload, and autonomic fluid redistribution.',
      'mars-transit':
        'Prolonged microgravity cardiovascular deconditioning, baroreceptor blunting, and autonomic stress.',
    };
    const countermeasureByEnv: Record<MissionEnvironment, string> = {
      'iss-microgravity':
        'Complete scheduled ARED/CEVIS aerobic & resistive exercise session, verify electrolyte/fluid intake protocol, and perform a resting orthostatic tolerance check.',
      'lunar-base':
        'Complete scheduled resistive/aerobic countermeasure session, verify pre-EVA electrolyte/fluid loading protocol, and perform a standing orthostatic tolerance check.',
      'mars-transit':
        'Complete scheduled ARED/CEVIS aerobic & resistive exercise session, verify electrolyte/fluid intake protocol, and perform a resting orthostatic tolerance check.',
    };
    return {
      spaceflightContext: contextByEnv[environment],
      countermeasure: countermeasureByEnv[environment],
    };
  }

  if (isBlood) {
    const contextByEnv: Record<MissionEnvironment, string> = {
      'iss-microgravity':
        'Spaceflight-associated hemolysis and plasma volume reduction ("space anemia").',
      'lunar-base':
        'Spaceflight-associated hemolysis compounded by lunar radiation/oxidative stress and plasma volume shifts.',
      'mars-transit':
        'Chronic microgravity hemolysis ("space anemia") and galactic cosmic radiation (GCR) marrow suppression risk.',
    };
    return {
      spaceflightContext: contextByEnv[environment],
      countermeasure:
        'Maintain iron-balanced spaceflight nutrition, log fatigue/dizziness symptoms during resistive workouts, and flag for Flight Surgeon review if trend drops below 12.0 g/dL.',
    };
  }

  return {
    spaceflightContext:
      'Microgravity physiological adaptation, fluid redistribution, and mission operational workload.',
    countermeasure:
      'Maintain scheduled NASA exercise and nutrition countermeasures, repeat resting measurement, and log any subjective symptoms.',
  };
}

/**
 * Evaluates clinical severity using personal baseline ± 1 SD plus aerospace medicine thresholds.
 */
export function evaluateIndicatorClinicalSeverity(params: {
  indicator: string;
  category: HealthCategory;
  latestValue: number | null;
  diastolicValue?: number | null;
  baseline?: PersonalBaselineResult;
  assessmentStatus?: AssessmentStatus;
  environment?: MissionEnvironment;
}): IndicatorClinicalEvaluation {
  const {
    indicator,
    category,
    latestValue,
    diastolicValue = null,
    baseline,
    assessmentStatus,
    environment = 'iss-microgravity',
  } = params;

  const protocol = getSpaceflightProtocol(indicator, category, environment);

  if (
    latestValue === null ||
    !Number.isFinite(latestValue) ||
    !baseline ||
    baseline.status === 'insufficient_data'
  ) {
    return {
      severity: 'insufficient',
      badgeLabel: 'Not enough data',
      spaceflightContext: protocol.spaceflightContext,
      countermeasure: protocol.countermeasure,
      withinOneSd: null,
    };
  }

  const mean = baseline.mean;
  const sd = baseline.standard_deviation;
  const withinOneSd =
    mean !== null && sd !== null && sd > 0
      ? latestValue >= mean - sd && latestValue <= mean + sd
      : true;
  const pct = baseline.period_comparison.percentage_change;
  const absPct = pct !== null ? Math.abs(pct) : 0;

  if (assessmentStatus === 'MEDICAL_ESCALATION') {
    return {
      severity: 'alert',
      badgeLabel: 'Action / Flight Surgeon Alert',
      ...protocol,
      withinOneSd,
    };
  }

  if (indicator === 'sleep_duration') {
    if (latestValue < 4.5) {
      return {
        severity: 'alert',
        badgeLabel: 'Action / Flight Surgeon Alert',
        ...protocol,
        withinOneSd,
      };
    }
    if (
      latestValue < 6.0 ||
      absPct >= 15 ||
      !withinOneSd ||
      assessmentStatus === 'REVIEW_REQUIRED'
    ) {
      return {
        severity: 'attention',
        badgeLabel: 'Attention / Deviation',
        ...protocol,
        withinOneSd,
      };
    }
    return {
      severity: 'nominal',
      badgeLabel: 'Nominal',
      ...protocol,
      withinOneSd,
    };
  }

  if (indicator === 'heart_rate') {
    if (latestValue > 100 || latestValue < 40) {
      return {
        severity: 'alert',
        badgeLabel: 'Action / Flight Surgeon Alert',
        ...protocol,
        withinOneSd,
      };
    }
    if (
      absPct >= 15 ||
      !withinOneSd ||
      (pct !== null && pct >= 10 && latestValue >= 78) ||
      assessmentStatus === 'REVIEW_REQUIRED'
    ) {
      return {
        severity: 'attention',
        badgeLabel: 'Attention / Deviation',
        ...protocol,
        withinOneSd,
      };
    }
    return {
      severity: 'nominal',
      badgeLabel: 'Nominal',
      ...protocol,
      withinOneSd,
    };
  }

  if (
    indicator === 'systolic_blood_pressure' ||
    indicator === 'blood_pressure'
  ) {
    if (latestValue >= 140 || (diastolicValue !== null && diastolicValue >= 90)) {
      return {
        severity: 'alert',
        badgeLabel: 'Action / Flight Surgeon Alert',
        ...protocol,
        withinOneSd,
      };
    }
    if (
      latestValue >= 130 ||
      (diastolicValue !== null && diastolicValue >= 80) ||
      !withinOneSd ||
      assessmentStatus === 'REVIEW_REQUIRED'
    ) {
      return {
        severity: 'attention',
        badgeLabel: 'Elevated / Monitor',
        ...protocol,
        withinOneSd,
      };
    }
    return {
      severity: 'nominal',
      badgeLabel: 'Nominal',
      ...protocol,
      withinOneSd,
    };
  }

  if (indicator === 'hemoglobin') {
    if (latestValue < 12.0) {
      return {
        severity: 'alert',
        badgeLabel: 'Action / Flight Surgeon Alert',
        ...protocol,
        withinOneSd,
      };
    }
    if (
      absPct >= 15 ||
      assessmentStatus === 'REVIEW_REQUIRED'
    ) {
      return {
        severity: 'attention',
        badgeLabel: 'Attention / Deviation',
        ...protocol,
        withinOneSd,
      };
    }
    return {
      severity: 'nominal',
      badgeLabel: 'Nominal',
      ...protocol,
      withinOneSd,
    };
  }

  if (
    assessmentStatus === 'REVIEW_REQUIRED' ||
    absPct >= 15 ||
    !withinOneSd
  ) {
    return {
      severity: 'attention',
      badgeLabel: 'Attention / Deviation',
      ...protocol,
      withinOneSd,
    };
  }

  return {
    severity: 'nominal',
    badgeLabel: 'Nominal',
    ...protocol,
    withinOneSd,
  };
}

/**
 * Synthesizes a multi-system clinical consensus across sleep, cardiovascular, and hematologic markers.
 */
export function evaluateMultiSystemConsensus(
  input: MultiSystemConsensusInput,
): MultiSystemConsensusResult {
  const findings: string[] = [];
  let deviatedSystemsCount = 0;

  const sleepDeviated = input.sleepSeverity === 'attention' || input.sleepSeverity === 'alert';
  const hrDeviated = input.heartRateSeverity === 'attention' || input.heartRateSeverity === 'alert';
  const bpDeviated = input.bpSeverity === 'attention' || input.bpSeverity === 'alert';
  const hgbDeviated = input.hemoglobinSeverity === 'attention' || input.hemoglobinSeverity === 'alert';

  if (sleepDeviated && input.sleepHours !== null) {
    deviatedSystemsCount += 1;
    const pctText = formatPercentageShift(input.sleepPctChange);
    findings.push(
      `acute sleep restriction (${input.sleepHours} hrs${pctText ? `, ${pctText}` : ''})`,
    );
  }
  if (hrDeviated && input.heartRateBpm !== null) {
    deviatedSystemsCount += 1;
    const pctText = formatPercentageShift(input.heartRatePctChange);
    findings.push(
      `elevated resting HR (${input.heartRateBpm} bpm${pctText ? `, ${pctText}` : ''})`,
    );
  }
  if (bpDeviated && input.systolicMmHg !== null) {
    deviatedSystemsCount += 1;
    const bpText =
      input.diastolicMmHg !== null
        ? `${input.systolicMmHg}/${input.diastolicMmHg} mmHg`
        : `${input.systolicMmHg} mmHg`;
    findings.push(`mild systolic/diastolic elevation (${bpText})`);
  }
  if (hgbDeviated && input.hemoglobinGdL !== null) {
    deviatedSystemsCount += 1;
    const pctText = formatPercentageShift(input.hemoglobinPctChange);
    findings.push(
      `hemoglobin decline (${input.hemoglobinGdL} g/dL${pctText ? `, ${pctText}` : ''})`,
    );
  }

  const anyAlert =
    input.reportedSymptoms ||
    input.sleepSeverity === 'alert' ||
    input.heartRateSeverity === 'alert' ||
    input.bpSeverity === 'alert' ||
    input.hemoglobinSeverity === 'alert';

  let overallSeverity: ClinicalSeverity = 'nominal';
  let overallBadgeLabel = 'Nominal';

  if (anyAlert || deviatedSystemsCount >= 3) {
    overallSeverity = 'alert';
    overallBadgeLabel = 'Action / Flight Surgeon Alert';
  } else if (deviatedSystemsCount >= 1) {
    overallSeverity = 'attention';
    overallBadgeLabel = 'Attention / Deviation';
  } else if (
    input.sleepSeverity === 'insufficient' &&
    input.heartRateSeverity === 'insufficient' &&
    input.bpSeverity === 'insufficient' &&
    input.hemoglobinSeverity === 'insufficient'
  ) {
    overallSeverity = 'insufficient';
    overallBadgeLabel = 'Not enough data';
  }

  const environmentRiskNoteByEnv: Record<MissionEnvironment, string> = {
    'iss-microgravity':
      'ISS / Microgravity (0g): Cephalad fluid shifts, 90-min orbital light/dark cycles, and cabin CO2 amplify autonomic and circadian strain.',
    'lunar-base':
      'Lunar Base (1/6g): Partial-gravity orthostatic load, suited EVA exertion, and extended lunar photoperiods elevate fatigue and cardiovascular risk.',
    'mars-transit':
      'Mars Transit (Deep Space): Delayed ground communication requires autonomous crew triage for cumulative deconditioning, radiation marrow stress, and circadian drift.',
  };

  let synthesizedDiagnosis: string;
  if (overallSeverity === 'insufficient') {
    synthesizedDiagnosis =
      'Insufficient multi-system baseline data. Import at least 3 consistent measurements per indicator to enable cross-system correlation.';
  } else if (findings.length === 0) {
    synthesizedDiagnosis =
      'Pattern Detected: All monitored biomarkers (Sleep, Heart Rate, Blood Pressure, Hemoglobin) remain within personal baseline (± 1 SD) with no multi-system fatigue or autonomic stress signature.';
  } else {
    const joined = findings.join(' + ');
    const interpretation =
      sleepDeviated && (hrDeviated || bpDeviated)
        ? 'indicates cumulative fatigue and autonomic stress'
        : hgbDeviated
          ? 'suggests spaceflight-associated hematologic adaptation alongside operational strain'
          : 'warrants targeted countermeasure adherence and follow-up monitoring';
    synthesizedDiagnosis = `Pattern Detected: ${joined.charAt(0).toUpperCase() + joined.slice(1)} ${interpretation}${
      hgbDeviated && (sleepDeviated || hrDeviated || bpDeviated)
        ? ', compounded by spaceflight-associated hemoglobin reduction'
        : ''
    }.`;
  }

  const immediateCrewSelfAction =
    overallSeverity === 'nominal'
      ? 'Continue standard mission schedule, maintain hydration/electrolyte intake, and adhere to scheduled ARED/CEVIS and sleep-block hygiene.'
      : overallSeverity === 'insufficient'
        ? 'Complete baseline wearable, cuff BP, and lab imports to establish your personal ± 1 SD reference.'
        : 'Initiate NASA Circadian Light Protocol immediately (blue-depleted lighting 2 hrs pre-sleep, caffeine cutoff 6 hrs prior), hydrate with 500 mL electrolyte solution, and avoid strenuous unscheduled tasks until resting vitals are re-checked.';

  const missionRoutinePrompt =
    overallSeverity === 'nominal'
      ? [
          '1. Log daily wearable sleep duration upon waking.',
          '2. Record resting morning HR and BP cuff reading prior to CEVIS/ARED.',
          '3. Complete daily subjective check-in for fatigue or dizziness.',
        ]
      : [
          '1. Perform a 5-minute quiet seated/supine rest, then repeat BP cuff and resting HR measurement.',
          '2. Verify cabin ppCO2 (< 2.0 mmHg) and set sleep-quarters lighting to blue-depleted mode 2 hrs before sleep.',
          '3. Complete scheduled ARED/CEVIS session at controlled intensity and log any fatigue or orthostatic dizziness.',
        ];

  const flightSurgeonTrigger =
    'Contact Houston / Flight Surgeon immediately if: Hemoglobin drops below 12.0 g/dL, repeat resting BP ≥ 140/90 mmHg, resting HR > 100 bpm, sleep duration < 4.5 hrs (or < 6.0 hrs for 3+ consecutive cycles), or crew reports dizziness, presyncope, or chest discomfort.';

  return {
    overallSeverity,
    overallBadgeLabel,
    synthesizedDiagnosis,
    environmentRiskNote: environmentRiskNoteByEnv[input.environment],
    deviatedSystemsCount,
    immediateCrewSelfAction,
    missionRoutinePrompt,
    flightSurgeonTrigger,
  };
}
