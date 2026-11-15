import * as XLSX from 'xlsx';
import { SCIENTIFIC_INDICATOR_CATALOG } from '@/services/indicators/indicatorCatalog';
import { INDICATOR_UNIT_REGISTRY } from '@/services/validation/unitRegistry';
import type { DailyCheckInMood, DailyCheckInSymptom } from '@/types';

export const SYNTHETIC_SCENARIO_XLSX_FILENAME =
  'tumi-healt-90d-synthetic-astronaut-scenario.xlsx';

export const SYNTHETIC_SCENARIO_ASTRONAUT_ID = 'astro-synthetic-90d';
export const SYNTHETIC_SCENARIO_SOURCE =
  'TUMI-HEALT 90-Day Synthetic Astronaut Scenario (SYNTHETIC)';

const DAY_MS = 24 * 60 * 60 * 1000;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isoForMissionDay(
  referenceDate: Date,
  missionDay: number,
  hourUtc = 8,
  minuteUtc = 0,
): string {
  // Mission Day 1 = 90 days ago, Mission Day 90 = 1 day ago (never future-dated)
  const daysAgo = 91 - missionDay;
  const baseUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
    hourUtc,
    minuteUtc,
    0,
  );
  return new Date(baseUtc - daysAgo * DAY_MS).toISOString();
}

function dateOnlyForMissionDay(referenceDate: Date, missionDay: number): string {
  return isoForMissionDay(referenceDate, missionDay, 8, 0).slice(0, 10);
}

function getStageLabel(missionDay: number): string {
  if (missionDay <= 30) return 'Stage 1: Stable Condition (Days 1-30)';
  if (missionDay <= 60) return 'Stage 2: Progressive Deterioration (Days 31-60)';
  return 'Stage 3: Deteriorated Condition (Days 61-90)';
}

/**
 * Returns a smooth 0..1 progression factor:
 * - Days 1-30: 0
 * - Days 31-60: smooth ramp 0 -> 0.55
 * - Days 61-90: smooth ramp 0.55 -> 1.0
 */
function deteriorationFactor(missionDay: number): number {
  if (missionDay <= 30) return 0;
  if (missionDay <= 60) return ((missionDay - 30) / 30) * 0.55;
  return 0.55 + ((missionDay - 60) / 30) * 0.45;
}

function primaryUnit(category: 'blood' | 'sleep' | 'cardiovascular', indicator: string): string {
  const units = INDICATOR_UNIT_REGISTRY[category][indicator];
  if (!units || units.length === 0) {
    throw new Error(`Missing unit definition for ${category}/${indicator}`);
  }
  return units[0];
}

interface BloodSpec {
  baseline: number;
  /** Total delta by Day 90 (0 means indicator stays near baseline even in Stage 3) */
  deltaAtDay90: number;
  amplitude: number;
  decimals: number;
  assay: string;
}

const BLOOD_SPECS: Record<string, BloodSpec> = {
  // Selected indicators that show coherent deterioration/change (hematology, hydration/renal, metabolic, hepatic)
  hemoglobin: { baseline: 14.8, deltaAtDay90: -2.6, amplitude: 0.18, decimals: 2, assay: 'OSD-569 CBC' },
  hematocrit: { baseline: 43.8, deltaAtDay90: -7.2, amplitude: 0.5, decimals: 1, assay: 'OSD-569 CBC' },
  red_blood_cell_count: { baseline: 4.92, deltaAtDay90: -0.78, amplitude: 0.06, decimals: 2, assay: 'OSD-569 CBC' },
  white_blood_cell_count: { baseline: 6.1, deltaAtDay90: 2.8, amplitude: 0.25, decimals: 2, assay: 'OSD-569 CBC' },
  platelet_count: { baseline: 238, deltaAtDay90: -32, amplitude: 7, decimals: 0, assay: 'OSD-569 CBC' },
  mcv: { baseline: 89.2, deltaAtDay90: -1.4, amplitude: 0.6, decimals: 1, assay: 'OSD-569 CBC' },
  mch: { baseline: 30.1, deltaAtDay90: -0.5, amplitude: 0.3, decimals: 1, assay: 'OSD-569 CBC' },
  mchc: { baseline: 33.8, deltaAtDay90: -0.4, amplitude: 0.2, decimals: 1, assay: 'OSD-569 CBC' },
  rdw: { baseline: 12.6, deltaAtDay90: 1.9, amplitude: 0.15, decimals: 1, assay: 'OSD-569 CBC' },
  mpv: { baseline: 9.8, deltaAtDay90: 0.4, amplitude: 0.15, decimals: 1, assay: 'OSD-569 CBC' },
  // Differential percentages & absolutes (selected shift in neutrophils/lymphocytes)
  neutrophils_percent: { baseline: 57.0, deltaAtDay90: 8.5, amplitude: 1.2, decimals: 1, assay: 'OSD-569 CBC' },
  lymphocytes_percent: { baseline: 32.0, deltaAtDay90: -7.0, amplitude: 1.0, decimals: 1, assay: 'OSD-569 CBC' },
  monocytes_percent: { baseline: 6.5, deltaAtDay90: 0.5, amplitude: 0.4, decimals: 1, assay: 'OSD-569 CBC' },
  eosinophils_percent: { baseline: 2.8, deltaAtDay90: -0.3, amplitude: 0.2, decimals: 1, assay: 'OSD-569 CBC' },
  basophils_percent: { baseline: 0.7, deltaAtDay90: 0.0, amplitude: 0.1, decimals: 1, assay: 'OSD-569 CBC' },
  absolute_neutrophils: { baseline: 3480, deltaAtDay90: 1850, amplitude: 140, decimals: 0, assay: 'OSD-569 CBC' },
  absolute_lymphocytes: { baseline: 1950, deltaAtDay90: -320, amplitude: 80, decimals: 0, assay: 'OSD-569 CBC' },
  absolute_monocytes: { baseline: 400, deltaAtDay90: 120, amplitude: 25, decimals: 0, assay: 'OSD-569 CBC' },
  absolute_eosinophils: { baseline: 170, deltaAtDay90: -10, amplitude: 15, decimals: 0, assay: 'OSD-569 CBC' },
  absolute_basophils: { baseline: 42, deltaAtDay90: 0, amplitude: 5, decimals: 0, assay: 'OSD-569 CBC' },
  // CMP indicators (OSD-575): selected dehydration/metabolic/hepatic shifts, others steady
  glucose: { baseline: 89, deltaAtDay90: 21, amplitude: 2.5, decimals: 1, assay: 'OSD-575 CMP' },
  urea_nitrogen_bun: { baseline: 14.0, deltaAtDay90: 8.5, amplitude: 0.7, decimals: 1, assay: 'OSD-575 CMP' },
  creatinine: { baseline: 0.88, deltaAtDay90: 0.28, amplitude: 0.03, decimals: 2, assay: 'OSD-575 CMP' },
  egfr_african_american: { baseline: 118, deltaAtDay90: -18, amplitude: 2, decimals: 0, assay: 'OSD-575 CMP' },
  egfr_non_african_american: { baseline: 104, deltaAtDay90: -16, amplitude: 2, decimals: 0, assay: 'OSD-575 CMP' },
  bun_to_creatinine_ratio: { baseline: 15.9, deltaAtDay90: 4.1, amplitude: 0.6, decimals: 1, assay: 'OSD-575 CMP' },
  sodium: { baseline: 140.0, deltaAtDay90: -4.2, amplitude: 0.6, decimals: 1, assay: 'OSD-575 CMP' },
  potassium: { baseline: 4.25, deltaAtDay90: -0.58, amplitude: 0.08, decimals: 2, assay: 'OSD-575 CMP' },
  chloride: { baseline: 102.0, deltaAtDay90: -2.0, amplitude: 0.6, decimals: 1, assay: 'OSD-575 CMP' },
  carbon_dioxide: { baseline: 25.0, deltaAtDay90: -1.8, amplitude: 0.5, decimals: 1, assay: 'OSD-575 CMP' },
  calcium: { baseline: 9.4, deltaAtDay90: 0.45, amplitude: 0.12, decimals: 2, assay: 'OSD-575 CMP' },
  total_protein: { baseline: 7.1, deltaAtDay90: -0.45, amplitude: 0.1, decimals: 2, assay: 'OSD-575 CMP' },
  albumin: { baseline: 4.35, deltaAtDay90: -0.65, amplitude: 0.08, decimals: 2, assay: 'OSD-575 CMP' },
  globulin: { baseline: 2.75, deltaAtDay90: 0.15, amplitude: 0.06, decimals: 2, assay: 'OSD-575 CMP' },
  albumin_to_globulin_ratio: { baseline: 1.58, deltaAtDay90: -0.28, amplitude: 0.05, decimals: 2, assay: 'OSD-575 CMP' },
  total_bilirubin: { baseline: 0.65, deltaAtDay90: 0.25, amplitude: 0.05, decimals: 2, assay: 'OSD-575 CMP' },
  alkaline_phosphatase: { baseline: 68, deltaAtDay90: 9, amplitude: 2.5, decimals: 0, assay: 'OSD-575 CMP' },
  ast: { baseline: 21, deltaAtDay90: 14, amplitude: 1.8, decimals: 0, assay: 'OSD-575 CMP' },
  alt: { baseline: 20, deltaAtDay90: 16, amplitude: 1.8, decimals: 0, assay: 'OSD-575 CMP' },
};

function buildReadmeRows(referenceDate: Date): Array<Array<string | number>> {
  const startDate = dateOnlyForMissionDay(referenceDate, 1);
  const endDate = dateOnlyForMissionDay(referenceDate, 90);
  return [
    ['TUMI-HEALT — 90-Day Synthetic Astronaut Health Scenario (.xlsx)'],
    [''],
    ['SYNTHETIC DATA NOTICE', 'ALL records in this workbook are 100% SYNTHETIC (data_origin = SYNTHETIC). They represent a fictional astronaut scenario and MUST NOT be interpreted as official NASA medical measurements or validated clinical thresholds.'],
    ['Fictional Astronaut', 'Commander Elena Vega (fictional) — astronaut_id: astro-synthetic-90d'],
    ['Timeline Window', `${startDate} to ${endDate} (90 consecutive mission days)`],
    ['Generated At (UTC)', referenceDate.toISOString()],
    [''],
    ['THREE-STAGE PROGRESSION', ''],
    ['Stage 1 (Days 1-30)', 'Stable Condition: consistent sleep (7.5-7.9h), adequate hydration and food intake notes, stable cardiovascular vitals, baseline blood labs (Days 1, 15, 30), and normal daily check-ins.'],
    ['Stage 2 (Days 31-60)', 'Progressive Deterioration: gradual decline in sleep duration and efficiency, rising sleep latency, less consistent food/hydration notes, rising fatigue, fluctuating vitals, and early lab shifts (Days 45, 60).'],
    ['Stage 3 (Days 61-90)', 'Deteriorated Condition: short disrupted sleep, elevated latency, irregular nutrition and poor hydration reports, headaches/dizziness/nausea in check-ins, wider cardiovascular drift, and clear lab changes vs baseline (Days 75, 90).'],
    [''],
    ['WORKBOOK SHEETS & IMPORT GUIDE', ''],
    ['Cardiovascular', 'All 10 supported cardiovascular & vital indicators. Importable via TUMI-HEALT Import page (category: cardiovascular). Daily vitals (with 2 realistic missing days marked NA) + cardiac_output every 15 days.'],
    ['Sleep', 'All 3 supported sleep indicators (sleep_duration, sleep_latency, sleep_efficiency). Importable via TUMI-HEALT Import page (category: sleep). Daily for 90 days (with 2 realistic missing nights marked NA).'],
    ['Blood_Labs', 'All 39 supported CBC (OSD-569) and CMP (OSD-575) blood indicators. Importable via TUMI-HEALT Import page (category: blood). Episodic draws every 15 days (Days 1, 15, 30, 45, 60, 75, 90) — 7 collection dates, not daily.'],
    ['Daily_CheckIn', '90 daily self-assessment entries (mood, energy_level, symptoms, note). Note: TUMI-HEALT stores check-ins via the Daily Check-In workflow rather than the measurement CSV/XLSX importer.'],
    ['Data_Dictionary', 'Complete catalog of all 52 supported indicators, exact identifiers, units, frequencies, and scientific limitations.'],
    [''],
    ['DOCUMENTED LIMITATIONS', ''],
    ['Nutrition & Hydration', 'TUMI-HEALT does not currently support nutrition or hydration as quantitative time-series indicators in indicatorCatalog.ts or unitRegistry.ts. Food intake and hydration observations are recorded ONLY as clearly labeled synthetic self-reported text inside Daily_CheckIn.note.'],
    ['Missing Values', 'Missing measurements are marked as NA (never 0) with quality_status = missing_value.'],
  ];
}

function buildCardiovascularSheet(referenceDate: Date): Array<Array<string | number>> {
  const headers = [
    'astronaut_id',
    'timestamp',
    'indicator',
    'value',
    'unit',
    'data_origin',
    'source_dataset',
    'quality_status',
    'systolic_blood_pressure',
    'diastolic_blood_pressure',
    'heart_rate',
    'cardiac_output',
    'activity_context',
    'sleep_state',
    'device_id',
    'mission_day',
    'scenario_stage',
  ];
  const rows: Array<Array<string | number>> = [headers];
  const missingDays = new Set([22, 68]);
  const cardiacOutputDays = new Set([1, 15, 30, 45, 60, 75, 90]);

  for (let day = 1; day <= 90; day += 1) {
    const p = deteriorationFactor(day);
    const wave = Math.sin(day * 0.55);
    const wave2 = Math.cos(day * 0.37);
    const jitter = day > 60 ? Math.sin(day * 1.45) * 1.8 : 0;
    const isMissing = missingDays.has(day);
    const ts = isoForMissionDay(referenceDate, day, 8, 15);
    const stage = getStageLabel(day);

    const hr = isMissing ? 'NA' : Math.round(65 + p * 21 + wave * (1.8 + p * 2.5) + jitter);
    const sbp = isMissing ? 'NA' : Math.round(117 + p * 20 + wave2 * (2.0 + p * 3.0) + jitter);
    const dbp = isMissing ? 'NA' : Math.round(75 + p * 13 + wave * (1.5 + p * 2.0) + jitter * 0.6);
    const map = isMissing ? 'NA' : Math.round((dbp as number) + ((sbp as number) - (dbp as number)) / 3);
    const temp = isMissing ? 'NA' : round(36.65 + p * 0.55 + wave2 * 0.08, 2);
    const resp = isMissing ? 'NA' : Math.round(14.5 + p * 5.5 + wave * 0.8);
    const spo2Val = isMissing ? 'NA' : round(clamp(98.6 - p * 3.1 + wave * 0.35, 93.5, 99.8), 1);
    const activity = isMissing ? 'NA' : Math.round(clamp(62 - p * 45 + wave2 * 6, 10, 80));

    const quality = isMissing ? 'missing_value' : 'verified';
    const activityCtx = day <= 30 ? 'resting_morning' : day <= 60 ? 'light_station_ops' : 'fatigue_resting';

    const dailyMetrics: Array<{ indicator: string; value: string | number }> = [
      { indicator: 'heart_rate', value: hr },
      { indicator: 'systolic_blood_pressure', value: sbp },
      { indicator: 'diastolic_blood_pressure', value: dbp },
      { indicator: 'blood_pressure', value: map },
      { indicator: 'body_temperature', value: temp },
      { indicator: 'respiratory_rate', value: resp },
      { indicator: 'blood_oxygen_saturation', value: spo2Val },
      { indicator: 'spo2', value: spo2Val },
      { indicator: 'physical_activity', value: activity },
    ];

    for (const m of dailyMetrics) {
      rows.push([
        SYNTHETIC_SCENARIO_ASTRONAUT_ID,
        ts,
        m.indicator,
        m.value,
        primaryUnit('cardiovascular', m.indicator),
        'SYNTHETIC',
        SYNTHETIC_SCENARIO_SOURCE,
        quality,
        sbp,
        dbp,
        hr,
        'NA',
        activityCtx,
        'awake',
        'wearable-sim-01',
        day,
        stage,
      ]);
    }

    if (cardiacOutputDays.has(day)) {
      const co = round(5.25 - p * 0.75 + wave * 0.1, 2);
      rows.push([
        SYNTHETIC_SCENARIO_ASTRONAUT_ID,
        isoForMissionDay(referenceDate, day, 9, 0),
        'cardiac_output',
        co,
        primaryUnit('cardiovascular', 'cardiac_output'),
        'SYNTHETIC',
        SYNTHETIC_SCENARIO_SOURCE,
        'verified',
        sbp,
        dbp,
        hr,
        co,
        'echocardiogram_sim',
        'awake',
        'echo-sim-01',
        day,
        stage,
      ]);
    }
  }

  return rows;
}

function buildSleepSheet(referenceDate: Date): Array<Array<string | number>> {
  const headers = [
    'astronaut_id',
    'timestamp',
    'indicator',
    'value',
    'unit',
    'data_origin',
    'source_dataset',
    'quality_status',
    'sleep_start',
    'sleep_end',
    'sleep_duration',
    'sleep_efficiency',
    'sleep_latency',
    'mission_day',
    'scenario_stage',
  ];
  const rows: Array<Array<string | number>> = [headers];
  const missingNights = new Set([19, 73]);

  for (let day = 1; day <= 90; day += 1) {
    const p = deteriorationFactor(day);
    const wave = Math.sin(day * 0.62);
    const wave2 = Math.cos(day * 0.41);
    const isMissing = missingNights.has(day);
    const wakeTs = isoForMissionDay(referenceDate, day, 6, 30);
    const stage = getStageLabel(day);

    const duration = isMissing ? 'NA' : round(clamp(7.7 - p * 2.5 + wave * 0.22, 4.4, 8.4), 2);
    const efficiency = isMissing ? 'NA' : round(clamp(91.5 - p * 17.0 + wave2 * 1.8, 70.0, 96.0), 1);
    const latency = isMissing ? 'NA' : round(clamp(0.24 + p * 0.40 + Math.abs(wave) * 0.05, 0.15, 0.85), 2);

    const sleepStart =
      typeof duration === 'number'
        ? new Date(Date.parse(wakeTs) - duration * 3600 * 1000).toISOString()
        : 'NA';
    const sleepEnd = typeof duration === 'number' ? wakeTs : 'NA';
    const quality = isMissing ? 'missing_value' : 'verified';

    const sleepMetrics: Array<{ indicator: string; value: string | number }> = [
      { indicator: 'sleep_duration', value: duration },
      { indicator: 'sleep_efficiency', value: efficiency },
      { indicator: 'sleep_latency', value: latency },
    ];

    for (const m of sleepMetrics) {
      rows.push([
        SYNTHETIC_SCENARIO_ASTRONAUT_ID,
        wakeTs,
        m.indicator,
        m.value,
        primaryUnit('sleep', m.indicator),
        'SYNTHETIC',
        SYNTHETIC_SCENARIO_SOURCE,
        quality,
        sleepStart,
        sleepEnd,
        duration,
        efficiency,
        latency,
        day,
        stage,
      ]);
    }
  }

  return rows;
}

function buildBloodLabsSheet(referenceDate: Date): Array<Array<string | number>> {
  const headers = [
    'astronaut_id',
    'timestamp',
    'indicator',
    'value',
    'unit',
    'data_origin',
    'source_dataset',
    'quality_status',
    'sample_id',
    'specimen_type',
    'assay',
    'mission_day',
    'scenario_stage',
  ];
  const rows: Array<Array<string | number>> = [headers];
  const drawDays = [1, 15, 30, 45, 60, 75, 90];
  const bloodIndicators = Object.keys(INDICATOR_UNIT_REGISTRY.blood);

  drawDays.forEach((day, drawIdx) => {
    const p = deteriorationFactor(day);
    const ts = isoForMissionDay(referenceDate, day, 7, 30);
    const stage = getStageLabel(day);
    const sampleId = `SYNTH-LAB-D${String(day).padStart(2, '0')}`;

    bloodIndicators.forEach((indicator, indIdx) => {
      const spec = BLOOD_SPECS[indicator];
      if (!spec) {
        throw new Error(`Missing blood spec for indicator: ${indicator}`);
      }
      const wave = Math.sin((drawIdx + 1) * 0.7 + indIdx * 0.35);
      const val = round(spec.baseline + p * spec.deltaAtDay90 + wave * spec.amplitude, spec.decimals);
      rows.push([
        SYNTHETIC_SCENARIO_ASTRONAUT_ID,
        ts,
        indicator,
        val,
        primaryUnit('blood', indicator),
        'SYNTHETIC',
        SYNTHETIC_SCENARIO_SOURCE,
        'verified',
        sampleId,
        'venous_blood',
        spec.assay,
        day,
        stage,
      ]);
    });
  });

  return rows;
}

function buildDailyCheckInSheet(referenceDate: Date): Array<Array<string | number>> {
  const headers = [
    'id',
    'astronaut_id',
    'date',
    'mood',
    'energy_level',
    'symptoms',
    'other_symptom',
    'note',
    'created_at',
    'data_origin',
    'mission_day',
    'scenario_stage',
  ];
  const rows: Array<Array<string | number>> = [headers];

  for (let day = 1; day <= 90; day += 1) {
    const p = deteriorationFactor(day);
    const date = dateOnlyForMissionDay(referenceDate, day);
    const createdAt = isoForMissionDay(referenceDate, day, 20, 0);
    const stage = getStageLabel(day);

    let mood: DailyCheckInMood = 'good';
    if (day > 30 && day <= 52) mood = day % 3 === 0 ? 'a_bit_tired' : 'good';
    else if (day > 52 && day <= 68) mood = 'a_bit_tired';
    else if (day > 68 && day <= 80) mood = day % 4 === 0 ? 'unwell' : 'very_fatigued';
    else if (day > 80) mood = day % 2 === 0 ? 'unwell' : 'very_fatigued';

    const energy = Math.round(clamp(8.8 - p * 6.4 + Math.sin(day * 0.5) * 0.5, 1, 10));

    const symptoms: DailyCheckInSymptom[] = [];
    if (day >= 42 && day <= 60 && day % 5 === 0) {
      symptoms.push('headache');
    } else if (day > 60) {
      if (day % 2 === 0) symptoms.push('headache');
      if (day % 3 === 0) symptoms.push('dizziness');
      if (day >= 72 && day % 4 === 0) symptoms.push('nausea');
    }

    const hydrationAndFoodNote =
      day <= 30
        ? 'SYNTHETIC self-report: Adequate hydration (~2.4 L/day) and full scheduled meal intake.'
        : day <= 60
          ? 'SYNTHETIC self-report: Slightly reduced appetite; skipped snack and moderate hydration (~1.8 L/day).'
          : 'SYNTHETIC self-report: Irregular food intake (<65% planned rations) and low hydration (~1.3 L/day); persistent fatigue.';

    rows.push([
      `checkin-synth-d${String(day).padStart(2, '0')}`,
      SYNTHETIC_SCENARIO_ASTRONAUT_ID,
      date,
      mood,
      energy,
      symptoms.join(', '),
      '',
      hydrationAndFoodNote,
      createdAt,
      'SYNTHETIC',
      day,
      stage,
    ]);
  }

  return rows;
}

function buildDataDictionarySheet(): Array<Array<string | number>> {
  const headers = [
    'sheet_name',
    'indicator_id',
    'display_name',
    'category',
    'measurement_unit',
    'information_type',
    'sampling_frequency',
    'data_origin',
    'definition',
    'limitations',
  ];
  const rows: Array<Array<string | number>> = [headers];

  for (const meta of SCIENTIFIC_INDICATOR_CATALOG) {
    const sheetName =
      meta.category === 'blood'
        ? 'Blood_Labs'
        : meta.category === 'sleep'
          ? 'Sleep'
          : 'Cardiovascular';
    const frequency =
      meta.category === 'blood'
        ? 'Periodic (every 15 days: Days 1, 15, 30, 45, 60, 75, 90)'
        : meta.indicator_id === 'cardiac_output'
          ? 'Periodic (every 15 days: Days 1, 15, 30, 45, 60, 75, 90)'
          : 'Daily (90 days, with 2 realistic NA missing days)';

    rows.push([
      sheetName,
      meta.indicator_id,
      meta.name,
      meta.category,
      meta.measurement_unit,
      meta.information_type ?? 'trend_capable',
      frequency,
      'SYNTHETIC',
      meta.definition,
      meta.limitations.join(' '),
    ]);
  }

  rows.push([
    'Daily_CheckIn',
    'daily_check_in (mood, energy_level, symptoms, note)',
    'Daily Self-Assessment & Nutrition/Hydration Notes',
    'self_assessment',
    'categorical / 1-10 scale / text',
    'contextual_self_report',
    'Daily (Days 1-90)',
    'SYNTHETIC',
    'Structured astronaut daily self-report (mood, energy_level 1-10, symptoms) plus synthetic self-reported food intake and hydration observations in note.',
    'Nutrition and hydration are not supported as quantitative indicators in TUMI-HEALT and are not imported via the measurement CSV/XLSX importer.',
  ]);

  return rows;
}

export interface GeneratedSyntheticScenarioXlsx {
  fileName: string;
  mimeType: string;
  content: ArrayBuffer;
  sheetNames: string[];
}

/**
 * Builds a complete, import-ready 90-day synthetic astronaut health scenario workbook (.xlsx)
 * covering all 52 supported TUMI-HEALT indicators across 3 progressive deterioration stages.
 */
export function buildSyntheticScenarioXlsx(
  referenceDate: Date = new Date(),
): GeneratedSyntheticScenarioXlsx {
  const workbook = XLSX.utils.book_new();

  const sheets: Array<{ name: string; rows: Array<Array<string | number>> }> = [
    { name: 'README', rows: buildReadmeRows(referenceDate) },
    { name: 'Cardiovascular', rows: buildCardiovascularSheet(referenceDate) },
    { name: 'Sleep', rows: buildSleepSheet(referenceDate) },
    { name: 'Blood_Labs', rows: buildBloodLabsSheet(referenceDate) },
    { name: 'Daily_CheckIn', rows: buildDailyCheckInSheet(referenceDate) },
    { name: 'Data_Dictionary', rows: buildDataDictionarySheet() },
  ];

  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(workbook, ws, s.name);
  }

  const content = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;

  return {
    fileName: SYNTHETIC_SCENARIO_XLSX_FILENAME,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content,
    sheetNames: sheets.map((s) => s.name),
  };
}
