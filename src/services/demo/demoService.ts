import type { LocalAstronautProfile } from '@/types';
import {
  createLocalProfile,
  deleteLocalProfileData,
  getRecords,
  saveBloodMeasurement,
  saveCardiovascularMeasurement,
  saveSleepMeasurement,
} from '../healthService';
import { getLatestMissionContext, saveMissionContext } from '../missionContext';
import { getProfile } from '../storage';
import { getDailyCheckIn, getLocalCheckInDate, saveDailyCheckIn } from '../checkIn';

export const DEMO_ASTRONAUT_ID = 'demo-astronaut';

export function isDemoAstronaut(astronautId?: string | null): boolean {
  return astronautId === DEMO_ASTRONAUT_ID;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(daysAgo: number, hourUtc = 8): string {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0);
  return new Date(base - daysAgo * DAY_MS).toISOString();
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLocalCheckInDate(date);
}

/**
 * Ensures an isolated, deterministic synthetic demonstration profile and
 * sample measurements exist in IndexedDB. Never touches real user profiles.
 */
export async function ensureDemoProfileAndData(): Promise<LocalAstronautProfile> {
  let profile = await getProfile(DEMO_ASTRONAUT_ID);
  if (!profile) {
    profile = await createLocalProfile({
      astronaut_id: DEMO_ASTRONAUT_ID,
      display_name: 'Cmdr. Alex Rivera (Demo)',
      mission_role: 'Mission Specialist (Demo)',
    });
  }

  if (!(await getLatestMissionContext(DEMO_ASTRONAUT_ID))) {
    await saveMissionContext({
      astronaut_id: DEMO_ASTRONAUT_ID,
      mission_id: 'DEMO-EXP-01',
      mission_phase: 'inflight',
      environment_type: 'ISS / Orbital (Demo)',
      gravity_environment: 'microgravity',
      mission_start_date: dateDaysAgo(20),
      source: 'synthetic_demo_fixture',
    });
  }

  const today = getLocalCheckInDate();
  if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, dateDaysAgo(1)))) {
    await saveDailyCheckIn({
      profile_id: DEMO_ASTRONAUT_ID,
      checkin_date: dateDaysAgo(1),
      mood: 'a_bit_tired',
      energy_level: 3,
      symptoms: [],
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });
  }
  if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, today))) {
    await saveDailyCheckIn({
      profile_id: DEMO_ASTRONAUT_ID,
      checkin_date: today,
      mood: 'good',
      energy_level: 4,
      symptoms: [],
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });
  }

  const existing = await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID });
  if (existing.length > 0) {
    return profile;
  }

  // Deterministic synthetic blood measurements
  const bloodSamples = [
    { daysAgo: 12, indicator: 'hemoglobin', value: 14.6, unit: 'g/dL', specimen: 'Whole Blood', assay: 'Complete Blood Count' },
    { daysAgo: 8, indicator: 'hemoglobin', value: 14.3, unit: 'g/dL', specimen: 'Whole Blood', assay: 'Complete Blood Count' },
    { daysAgo: 4, indicator: 'hemoglobin', value: 14.1, unit: 'g/dL', specimen: 'Whole Blood', assay: 'Complete Blood Count' },
    { daysAgo: 1, indicator: 'hemoglobin', value: 14.0, unit: 'g/dL', specimen: 'Whole Blood', assay: 'Complete Blood Count' },
    { daysAgo: 8, indicator: 'glucose', value: 92, unit: 'mg/dL', specimen: 'Serum', assay: 'Comprehensive Metabolic Panel' },
    { daysAgo: 1, indicator: 'glucose', value: 95, unit: 'mg/dL', specimen: 'Serum', assay: 'Comprehensive Metabolic Panel' },
    { daysAgo: 1, indicator: 'white_blood_cell_count', value: 6.4, unit: '10^3/uL', specimen: 'Whole Blood', assay: 'Complete Blood Count' },
  ];

  for (const s of bloodSamples) {
    await saveBloodMeasurement(
      {
        astronaut_id: DEMO_ASTRONAUT_ID,
        timestamp: isoDaysAgo(s.daysAgo, 7),
        indicator: s.indicator,
        value: s.value,
        unit: s.unit,
        data_origin: 'SYNTHETIC',
        source_dataset: 'TUMI-HEALT Demo Synthetic Fixture',
        specimen_type: s.specimen,
        assay: s.assay,
      },
      DEMO_ASTRONAUT_ID,
    );
  }

  // Deterministic synthetic sleep measurements
  const sleepSamples = [
    { daysAgo: 6, duration: 7.2, latency: 18, efficiency: 89 },
    { daysAgo: 5, duration: 6.8, latency: 22, efficiency: 86 },
    { daysAgo: 4, duration: 6.4, latency: 26, efficiency: 84 },
    { daysAgo: 3, duration: 7.0, latency: 16, efficiency: 88 },
    { daysAgo: 2, duration: 6.6, latency: 20, efficiency: 85 },
    { daysAgo: 1, duration: 7.1, latency: 15, efficiency: 90 },
  ];

  for (const s of sleepSamples) {
    const wakeTs = isoDaysAgo(s.daysAgo, 6);
    const startMs = Date.parse(wakeTs) - s.duration * 60 * 60 * 1000;
    await saveSleepMeasurement(
      {
        astronaut_id: DEMO_ASTRONAUT_ID,
        timestamp: wakeTs,
        indicator: 'sleep_duration',
        value: s.duration,
        unit: 'hours',
        data_origin: 'SYNTHETIC',
        source_dataset: 'TUMI-HEALT Demo Synthetic Fixture',
        sleep_start: new Date(startMs).toISOString(),
        sleep_end: wakeTs,
        sleep_duration: s.duration,
        sleep_latency: s.latency,
        sleep_efficiency: s.efficiency,
      },
      DEMO_ASTRONAUT_ID,
    );
  }

  // Deterministic synthetic cardiovascular measurements
  const heartSamples = [
    { daysAgo: 6, hr: 64, sys: 118, dia: 76, context: 'resting' },
    { daysAgo: 5, hr: 66, sys: 120, dia: 78, context: 'resting' },
    { daysAgo: 4, hr: 68, sys: 121, dia: 79, context: 'resting' },
    { daysAgo: 3, hr: 65, sys: 117, dia: 75, context: 'resting' },
    { daysAgo: 2, hr: 69, sys: 122, dia: 80, context: 'resting' },
    { daysAgo: 1, hr: 67, sys: 119, dia: 77, context: 'resting' },
  ];

  for (const h of heartSamples) {
    await saveCardiovascularMeasurement(
      {
        astronaut_id: DEMO_ASTRONAUT_ID,
        timestamp: isoDaysAgo(h.daysAgo, 9),
        indicator: 'heart_rate',
        value: h.hr,
        unit: 'bpm',
        data_origin: 'SYNTHETIC',
        source_dataset: 'TUMI-HEALT Demo Synthetic Fixture',
        heart_rate: h.hr,
        blood_pressure: { systolic: h.sys, diastolic: h.dia },
        activity_context: h.context,
        sleep_state: 'awake',
      },
      DEMO_ASTRONAUT_ID,
    );
  }

  return profile;
}

/**
 * Deletes the isolated demonstration profile and all its synthetic records.
 */
export async function clearDemoProfileAndData(): Promise<void> {
  const existing = await getProfile(DEMO_ASTRONAUT_ID);
  if (existing) {
    await deleteLocalProfileData(DEMO_ASTRONAUT_ID);
  }
}
