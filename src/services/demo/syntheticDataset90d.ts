import type {
  BloodRecord,
  CardiovascularRecord,
  HealthRecord,
  SleepRecord,
} from '@/types';
import { buildSyntheticScenarioDataset } from './syntheticScenarioXlsx';

export const SYNTHETIC_DATASET_SOURCE =
  'TUMI-HEALT 90-Day Synthetic Astronaut Dataset (SYNTHETIC)';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgoFrom(baseDate: Date, daysAgo: number, hourUtc = 8, minuteUtc = 0): string {
  const baseUtc = Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hourUtc,
    minuteUtc,
    0,
  );
  return new Date(baseUtc - daysAgo * DAY_MS).toISOString();
}

function round(val: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

/**
 * Generates a coherent, deterministic 90-day synthetic astronaut health timeline.
 *
 * Scientific and structural grounding:
 * - Blood (CBC): NASA OSDR OSD-569 (LSDS-7 CBC) variable names & units
 * - Blood (CMP): NASA OSDR OSD-575 (LSDS-8 CMP) variable names & units
 * - Sleep: NASA NLSP UTMB Bedrest Campaign 1 (BRSMACT) actigraphy variables & units
 * - Cardiovascular: NASA NLSP Apollo AP005 hemodynamic variables & units +
 *   documented illustrative vital signs (body_temperature, respiratory_rate,
 *   blood_oxygen_saturation, physical_activity).
 *
 * Explicitly marked as data_origin = 'SYNTHETIC'. Never represents a real
 * human research participant or medically validated clinical reference profile.
 */
export function buildSynthetic90DayRecords(
  astronautId = 'demo-astronaut',
  referenceDate: Date = new Date(),
): HealthRecord[] {
  const records: HealthRecord[] = [];

  // 1. FREQUENT SAMPLING DAYS (45 timepoints every 2 days from Day -89 to Day -1)
  const frequentDaysAgo: number[] = [];
  for (let d = 89; d >= 1; d -= 2) {
    frequentDaysAgo.push(d);
  }

  frequentDaysAgo.forEach((daysAgo, idx) => {
    // Deterministic gentle oscillation (sin/cos based on index)
    const wave = Math.sin(idx * 0.65);
    const wave2 = Math.cos(idx * 0.45);
    const isEarlyPhase = daysAgo >= 60; // First 30 days
    const isMidPhase = daysAgo >= 41 && daysAgo < 60; // Mid-mission stability

    // --- SLEEP INDICATORS (category: 'sleep') ---
    const wakeTs = isoDaysAgoFrom(referenceDate, daysAgo, 6, 30);
    const sleepMissing = daysAgo === 49 || daysAgo === 11;

    const baseDuration = isEarlyPhase
      ? 7.6 + wave * 0.2
      : isMidPhase
        ? 7.45 + wave * 0.2
        : 5.55 + wave * 0.2; // >=24% decrease in recent half -> triggers REVIEW_REQUIRED

    const durationVal = sleepMissing ? null : round(baseDuration, 2);
    const efficiencyVal = sleepMissing
      ? null
      : round(
          isEarlyPhase
            ? 90.5 + wave2 * 1.8
            : isMidPhase
              ? 88.8 + wave2 * 2.0
              : 80.5 + wave2 * 2.2,
          1,
        );
    const latencyHoursVal = sleepMissing
      ? null
      : round(
          isEarlyPhase
            ? 0.24 + Math.abs(wave) * 0.04
            : isMidPhase
              ? 0.27 + Math.abs(wave) * 0.05
              : 0.48 + Math.abs(wave) * 0.06, // Noticeable latency increase in late phase
          2,
        );

    const sleepStartTs =
      durationVal !== null
        ? new Date(Date.parse(wakeTs) - durationVal * 3600 * 1000).toISOString()
        : null;

    const sleepQuality = sleepMissing ? 'missing_value' : 'verified';

    const sleepDurationRec: SleepRecord = {
      id: `syn-sleep-dur-d${String(daysAgo).padStart(2, '0')}`,
      category: 'sleep',
      astronaut_id: astronautId,
      timestamp: wakeTs,
      indicator: 'sleep_duration',
      value: durationVal,
      unit: 'hours',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: sleepQuality,
      sleep_start: sleepStartTs,
      sleep_end: sleepMissing ? null : wakeTs,
      sleep_duration: durationVal,
      sleep_efficiency: efficiencyVal,
      sleep_latency: latencyHoursVal,
      created_at: wakeTs,
      updated_at: wakeTs,
    };

    const sleepEfficiencyRec: SleepRecord = {
      id: `syn-sleep-eff-d${String(daysAgo).padStart(2, '0')}`,
      category: 'sleep',
      astronaut_id: astronautId,
      timestamp: wakeTs,
      indicator: 'sleep_efficiency',
      value: efficiencyVal,
      unit: '%',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: sleepQuality,
      sleep_start: sleepStartTs,
      sleep_end: sleepMissing ? null : wakeTs,
      sleep_duration: durationVal,
      sleep_efficiency: efficiencyVal,
      sleep_latency: latencyHoursVal,
      created_at: wakeTs,
      updated_at: wakeTs,
    };

    const sleepLatencyRec: SleepRecord = {
      id: `syn-sleep-lat-d${String(daysAgo).padStart(2, '0')}`,
      category: 'sleep',
      astronaut_id: astronautId,
      timestamp: wakeTs,
      indicator: 'sleep_latency',
      value: latencyHoursVal,
      unit: 'hours',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: sleepQuality,
      sleep_start: sleepStartTs,
      sleep_end: sleepMissing ? null : wakeTs,
      sleep_duration: durationVal,
      sleep_efficiency: efficiencyVal,
      sleep_latency: latencyHoursVal,
      created_at: wakeTs,
      updated_at: wakeTs,
    };

    records.push(sleepDurationRec, sleepEfficiencyRec, sleepLatencyRec);

    // --- CARDIOVASCULAR & VITAL INDICATORS (category: 'cardiovascular') ---
    const vitalsTs = isoDaysAgoFrom(referenceDate, daysAgo, 8, 15);
    const hrMissing = daysAgo === 45;

    const hrVal = hrMissing
      ? null
      : Math.round(
          isEarlyPhase
            ? 62 + wave * 2.2
            : isMidPhase
              ? 64 + wave * 2.5
              : 70 + wave * 2.8,
        );
    const sysVal = Math.round(
      isEarlyPhase
        ? 117 + wave * 2.5
        : isMidPhase
          ? 116 + wave2 * 2.5
          : 123 + wave * 3.0,
    );
    const diaVal = Math.round(
      isEarlyPhase
        ? 75 + wave * 1.8
        : isMidPhase
          ? 74 + wave2 * 1.8
          : 79 + wave * 2.0,
    );
    const tempVal = round(
      isEarlyPhase
        ? 36.68 + wave * 0.12
        : isMidPhase
          ? 36.74 + wave2 * 0.12
          : 36.85 + wave * 0.14,
      1,
    );
    const respVal = round(
      isEarlyPhase
        ? 13.8 + wave * 0.6
        : isMidPhase
          ? 14.1 + wave2 * 0.7
          : 15.4 + wave * 0.8,
      1,
    );
    const spo2Val = Math.round(
      isEarlyPhase ? 98.4 + wave * 0.5 : isMidPhase ? 98.2 + wave2 * 0.6 : 97.8 + wave * 0.6,
    );
    const activityVal = Math.round(
      isEarlyPhase
        ? 122 + wave * 8
        : isMidPhase
          ? 118 + wave2 * 9
          : 82 + wave * 8, // Decreased exercise duration during late docking workload
    );

    const hrRec: CardiovascularRecord = {
      id: `syn-cv-hr-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'heart_rate',
      value: hrVal,
      unit: 'bpm',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: hrMissing ? 'missing_value' : 'verified',
      heart_rate: hrVal,
      blood_pressure: { systolic: sysVal, diastolic: diaVal },
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'BIO-MONITOR-ISS-01',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const sysRec: CardiovascularRecord = {
      id: `syn-cv-sys-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'systolic_blood_pressure',
      value: sysVal,
      unit: 'mmHg',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      heart_rate: hrVal,
      blood_pressure: { systolic: sysVal, diastolic: diaVal },
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'CUFF-ISS-02',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const diaRec: CardiovascularRecord = {
      id: `syn-cv-dia-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'diastolic_blood_pressure',
      value: diaVal,
      unit: 'mmHg',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      heart_rate: hrVal,
      blood_pressure: { systolic: sysVal, diastolic: diaVal },
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'CUFF-ISS-02',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const tempRec: CardiovascularRecord = {
      id: `syn-cv-temp-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'body_temperature',
      value: tempVal,
      unit: '°C',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'THERM-PATCH-01',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const respRec: CardiovascularRecord = {
      id: `syn-cv-resp-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'respiratory_rate',
      value: respVal,
      unit: 'breaths/min',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'BIO-MONITOR-ISS-01',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const spo2Rec: CardiovascularRecord = {
      id: `syn-cv-spo2-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: vitalsTs,
      indicator: 'blood_oxygen_saturation',
      value: spo2Val,
      unit: '%',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'OXIMETER-ISS-01',
      created_at: vitalsTs,
      updated_at: vitalsTs,
    };

    const activityRec: CardiovascularRecord = {
      id: `syn-cv-act-d${String(daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: isoDaysAgoFrom(referenceDate, daysAgo, 17, 0),
      indicator: 'physical_activity',
      value: activityVal,
      unit: 'minutes',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      activity_context: 'countermeasure_exercise',
      sleep_state: 'awake',
      device_id: 'ARED-T2-LOG',
      created_at: isoDaysAgoFrom(referenceDate, daysAgo, 17, 0),
      updated_at: isoDaysAgoFrom(referenceDate, daysAgo, 17, 0),
    };

    records.push(hrRec, sysRec, diaRec, tempRec, respRec, spo2Rec, activityRec);
  });

  // Periodic Ultrasound / Rebreathing Cardiac Output (last recorded 19 days ago -> >14 days outdated)
  const cardiacOutputDraws = [
    { daysAgo: 83, value: 5.3 },
    { daysAgo: 67, value: 5.2 },
    { daysAgo: 51, value: 5.0 },
    { daysAgo: 35, value: 4.9 },
    { daysAgo: 19, value: 4.8 },
  ];
  for (const co of cardiacOutputDraws) {
    const ts = isoDaysAgoFrom(referenceDate, co.daysAgo, 10, 30);
    records.push({
      id: `syn-cv-co-d${String(co.daysAgo).padStart(2, '0')}`,
      category: 'cardiovascular',
      astronaut_id: astronautId,
      timestamp: ts,
      indicator: 'cardiac_output',
      value: co.value,
      unit: 'L/min',
      data_origin: 'SYNTHETIC',
      ingestion_method: 'CSV_IMPORT',
      source_dataset: SYNTHETIC_DATASET_SOURCE,
      quality_status: 'verified',
      cardiac_output: co.value,
      activity_context: 'resting',
      sleep_state: 'awake',
      device_id: 'ECHO-ULTRASOUND-ISS',
      created_at: ts,
      updated_at: ts,
    });
  }

  // 2. EPISODIC LABORATORY DRAWS (6 scheduled draws across 90 days — NOT daily)
  const labDraws = [
    {
      daysAgo: 87,
      sampleId: 'SYN-LAB-D03',
      cbc: {
        hemoglobin: 15.2,
        hematocrit: 45.1,
        red_blood_cell_count: 5.05,
        white_blood_cell_count: 6.1,
        platelet_count: 248,
        mcv: 89.3,
        mch: 30.1,
        mchc: 33.7,
        rdw: 12.4,
        mpv: 9.8, // Sample 1 of 2
      },
      cmp: {
        glucose: 89,
        creatinine: 0.96,
        urea_nitrogen_bun: 14,
        sodium: 140,
        potassium: 4.2,
        chloride: 102,
        carbon_dioxide: 25,
        calcium: 9.3,
        albumin: 4.5,
        total_protein: 7.2,
        alt: 22,
        ast: 24,
        alkaline_phosphatase: 68,
        total_bilirubin: 0.6,
      },
    },
    {
      daysAgo: 71,
      sampleId: 'SYN-LAB-D19',
      cbc: {
        hemoglobin: 15.0,
        hematocrit: 44.5,
        red_blood_cell_count: 4.98,
        white_blood_cell_count: 6.3,
        platelet_count: 244,
        mcv: 89.4,
        mch: 30.1,
        mchc: 33.7,
        rdw: 12.5,
      },
      cmp: {
        glucose: 91,
        creatinine: 0.95,
        urea_nitrogen_bun: 15,
        sodium: 141,
        potassium: 4.1,
        chloride: 103,
        carbon_dioxide: 25,
        calcium: 9.4,
        albumin: 4.5,
        total_protein: 7.1,
        alt: 24,
        ast: 26,
        alkaline_phosphatase: 71,
        total_bilirubin: 0.7,
      },
    },
    {
      daysAgo: 53,
      sampleId: 'SYN-LAB-D37',
      cbc: {
        hemoglobin: 14.5,
        hematocrit: 43.2,
        red_blood_cell_count: 4.82,
        white_blood_cell_count: 6.5,
        platelet_count: 239,
        mcv: 89.6,
        mch: 30.0,
        mchc: 33.6,
        rdw: 12.7,
        mpv: 10.1, // Sample 2 of 2 -> <3 valid records (INSUFFICIENT_DATA demo)
      },
      cmp: {
        glucose: 92,
        creatinine: 0.94,
        urea_nitrogen_bun: 15,
        sodium: 140,
        potassium: 4.2,
        chloride: 102,
        carbon_dioxide: 26,
        calcium: 9.6,
        albumin: 4.4,
        total_protein: 7.1,
        alt: 25,
        ast: 27,
        alkaline_phosphatase: 74,
        total_bilirubin: 0.7,
      },
    },
    {
      daysAgo: 35,
      sampleId: 'SYN-LAB-D55',
      cbc: {
        hemoglobin: 14.2,
        hematocrit: 42.4,
        red_blood_cell_count: 4.72,
        white_blood_cell_count: 6.4,
        platelet_count: 235,
        mcv: 89.8,
        mch: 30.1,
        mchc: 33.5,
        rdw: 12.8,
      },
      cmp: {
        glucose: null, // Explicit missing lab value (never replaced with 0)
        creatinine: 0.93,
        urea_nitrogen_bun: 16,
        sodium: 139,
        potassium: 4.1,
        chloride: 101,
        carbon_dioxide: 26,
        calcium: 9.6,
        albumin: 4.4,
        total_protein: 7.0,
        alt: 26,
        ast: 29,
        alkaline_phosphatase: 77,
        total_bilirubin: 0.8,
      },
    },
    {
      daysAgo: 17,
      sampleId: 'SYN-LAB-D73',
      cbc: {
        hemoglobin: 13.9,
        hematocrit: 41.5,
        red_blood_cell_count: 4.61,
        white_blood_cell_count: 6.8,
        platelet_count: 232,
        mcv: 90.0,
        mch: 30.2,
        mchc: 33.5,
        rdw: 12.9,
      },
      cmp: {
        glucose: 94,
        creatinine: 0.92,
        urea_nitrogen_bun: 16,
        sodium: 139,
        potassium: 4.2,
        chloride: 101,
        carbon_dioxide: 26,
        calcium: 9.7,
        albumin: 4.3,
        total_protein: 7.0,
        alt: 27,
        ast: 30,
        alkaline_phosphatase: 79,
        total_bilirubin: 0.8,
      },
    },
    {
      daysAgo: 3,
      sampleId: 'SYN-LAB-D87',
      cbc: {
        hemoglobin: 13.7,
        hematocrit: 41.0,
        red_blood_cell_count: 4.55,
        white_blood_cell_count: 6.9,
        platelet_count: 230,
        mcv: 90.1,
        mch: 30.1,
        mchc: 33.4,
        rdw: 13.0,
      },
      cmp: {
        glucose: 95,
        creatinine: 0.91,
        urea_nitrogen_bun: 17,
        sodium: 139,
        potassium: 4.1,
        chloride: 101,
        carbon_dioxide: 26,
        calcium: 9.8,
        albumin: 4.3,
        total_protein: 6.9,
        alt: 28,
        ast: 31,
        alkaline_phosphatase: 81,
        total_bilirubin: 0.8,
      },
    },
  ];

  const cbcUnits: Record<string, string> = {
    hemoglobin: 'g/dL',
    hematocrit: '%',
    red_blood_cell_count: '10^6/uL',
    white_blood_cell_count: '10^3/uL',
    platelet_count: '10^3/uL',
    mcv: 'fL',
    mch: 'pg',
    mchc: 'g/dL',
    rdw: '%',
    mpv: 'fL',
  };

  const cmpUnits: Record<string, string> = {
    glucose: 'mg/dL',
    creatinine: 'mg/dL',
    urea_nitrogen_bun: 'mg/dL',
    sodium: 'mmol/L',
    potassium: 'mmol/L',
    chloride: 'mmol/L',
    carbon_dioxide: 'mmol/L',
    calcium: 'mg/dL',
    albumin: 'g/dL',
    total_protein: 'g/dL',
    alt: 'U/L',
    ast: 'U/L',
    alkaline_phosphatase: 'U/L',
    total_bilirubin: 'mg/dL',
  };

  for (const draw of labDraws) {
    const ts = isoDaysAgoFrom(referenceDate, draw.daysAgo, 7, 15);

    for (const [indicator, val] of Object.entries(draw.cbc)) {
      if (val === undefined) continue;
      const rec: BloodRecord = {
        id: `syn-blood-${indicator}-d${String(draw.daysAgo).padStart(2, '0')}`,
        category: 'blood',
        astronaut_id: astronautId,
        timestamp: ts,
        indicator,
        value: val,
        unit: cbcUnits[indicator],
        data_origin: 'SYNTHETIC',
        ingestion_method: 'CSV_IMPORT',
        source_dataset: SYNTHETIC_DATASET_SOURCE,
        quality_status: val === null ? 'missing_value' : 'verified',
        sample_id: `${draw.sampleId}-CBC`,
        specimen_type: 'whole_blood',
        assay: 'Complete Blood Count (OSD-569 Reference Schema)',
        created_at: ts,
        updated_at: ts,
      };
      records.push(rec);
    }

    for (const [indicator, val] of Object.entries(draw.cmp)) {
      if (val === undefined) continue;
      const rec: BloodRecord = {
        id: `syn-blood-${indicator}-d${String(draw.daysAgo).padStart(2, '0')}`,
        category: 'blood',
        astronaut_id: astronautId,
        timestamp: ts,
        indicator,
        value: val,
        unit: cmpUnits[indicator],
        data_origin: 'SYNTHETIC',
        ingestion_method: 'CSV_IMPORT',
        source_dataset: SYNTHETIC_DATASET_SOURCE,
        quality_status: val === null ? 'missing_value' : 'verified',
        sample_id: `${draw.sampleId}-CMP`,
        specimen_type: 'serum',
        assay: 'Comprehensive Metabolic Panel (OSD-575 Reference Schema)',
        created_at: ts,
        updated_at: ts,
      };
      records.push(rec);
    }
  }

  return records;
}

/**
 * Generates import-ready CSV files for each health category covering all 52 supported
 * TUMI-HEALT indicators (39 blood, 3 sleep, 10 cardiovascular) across 90 days.
 */
export function buildSynthetic90DayCsvFiles(
  astronautId = 'astro-01',
  referenceDate: Date = new Date(),
): {
  cardiovascularCsv: string;
  sleepCsv: string;
  bloodCsv: string;
} {
  const dataset = buildSyntheticScenarioDataset(astronautId, referenceDate);
  return {
    bloodCsv: `${dataset.bloodCsv}\n`,
    sleepCsv: `${dataset.sleepCsv}\n`,
    cardiovascularCsv: `${dataset.cardiovascularCsv}\n`,
  };
}
