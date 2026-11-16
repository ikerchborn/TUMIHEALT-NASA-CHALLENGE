import type {
  CsvColumnMapping,
  HealthCategory,
  LocalAstronautProfile,
} from '@/types';
import {
  createLocalProfile,
  deleteLocalProfileData,
  getRecords,
} from '../healthService';
import { getLatestMissionContext, saveMissionContext } from '../missionContext';
import { getDatabase, getProfile } from '../storage';
import { getDailyCheckIn, getLocalCheckInDate, saveDailyCheckIn } from '../checkIn';
import {
  confirmCsvImport,
  inspectCsvFile,
  prepareCsvImportPreview,
} from '../ingestion/csvImportService';
import {
  SYNTHETIC_SCENARIO_SOURCE,
  buildSyntheticScenarioDataset,
} from './syntheticScenarioXlsx';

export const DEMO_ASTRONAUT_ID = 'demo-astronaut';

export function isDemoAstronaut(astronautId?: string | null): boolean {
  return astronautId === DEMO_ASTRONAUT_ID;
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLocalCheckInDate(date);
}

function buildCanonicalMapping(headers: string[]): CsvColumnMapping {
  return {
    ...Object.fromEntries(headers.map((h) => [h, h])),
    timestamp: 'timestamp',
    indicator: 'indicator',
    value: 'value',
    unit: 'unit',
  };
}

/**
 * Ensures an isolated, deterministic 90-day 3-stage synthetic demonstration profile and
 * measurements exist in IndexedDB by running the dataset through the real ingestion and
 * validation services. Never touches real user profiles.
 */
export async function ensureDemoProfileAndData(): Promise<LocalAstronautProfile> {
  let profile = await getProfile(DEMO_ASTRONAUT_ID);
  if (!profile) {
    profile = await createLocalProfile({
      astronaut_id: DEMO_ASTRONAUT_ID,
      display_name: 'Cmdr. Alex Rivera (Demo)',
      mission_role: 'Mission Specialist · 90-Day Synthetic Demo',
    });
  }

  if (!(await getLatestMissionContext(DEMO_ASTRONAUT_ID))) {
    await saveMissionContext({
      astronaut_id: DEMO_ASTRONAUT_ID,
      mission_id: 'DEMO-EXP-90D',
      mission_phase: 'inflight',
      environment_type: 'Space Station (Orbital Habitat Demo)',
      gravity_environment: 'microgravity',
      mission_start_date: dateDaysAgo(89),
      source: 'synthetic_demo_fixture',
    });
  }

  const dataset = buildSyntheticScenarioDataset(DEMO_ASTRONAUT_ID);

  // Seed daily check-ins (Days 1-90 + today) without duplicating existing dates
  for (const entry of dataset.dailyCheckIns) {
    if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, entry.checkin_date))) {
      await saveDailyCheckIn({
        profile_id: DEMO_ASTRONAUT_ID,
        checkin_date: entry.checkin_date,
        mood: entry.mood,
        energy_level: entry.energy_level,
        symptoms: entry.symptoms,
        note: entry.note,
        data_origin: 'SYNTHETIC',
        source: 'synthetic_demo_fixture',
      });
    }
  }

  const today = getLocalCheckInDate();
  if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, today))) {
    await saveDailyCheckIn({
      profile_id: DEMO_ASTRONAUT_ID,
      checkin_date: today,
      mood: 'very_fatigued',
      energy_level: 2,
      symptoms: ['headache', 'dizziness'],
      note: 'SYNTHETIC self-report: Continued fatigue and irregular hydration following 90-day deterioration scenario.',
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });
  }

  const existing = await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID });
  if (
    existing.length > 0 &&
    existing.some((r) => r.source_dataset === SYNTHETIC_SCENARIO_SOURCE)
  ) {
    return profile;
  }

  // Safely reset only demo records if an older/partial demo dataset was present
  if (existing.length > 0) {
    const db = getDatabase();
    await db.transaction(
      'rw',
      [db.blood_records, db.sleep_records, db.cardiovascular_records],
      async () => {
        await db.blood_records.where('astronaut_id').equals(DEMO_ASTRONAUT_ID).delete();
        await db.sleep_records.where('astronaut_id').equals(DEMO_ASTRONAUT_ID).delete();
        await db.cardiovascular_records.where('astronaut_id').equals(DEMO_ASTRONAUT_ID).delete();
      },
    );
  }

  const imports: Array<{ category: HealthCategory; fileName: string; csvText: string }> = [
    { category: 'sleep', fileName: 'demo-90d-sleep.csv', csvText: dataset.sleepCsv },
    {
      category: 'cardiovascular',
      fileName: 'demo-90d-cardiovascular.csv',
      csvText: dataset.cardiovascularCsv,
    },
    { category: 'blood', fileName: 'demo-90d-blood-labs.csv', csvText: dataset.bloodCsv },
  ];

  try {
    for (const item of imports) {
      const inspection = inspectCsvFile(item.csvText, item.fileName);
      const preview = await prepareCsvImportPreview({
        profileId: DEMO_ASTRONAUT_ID,
        actorId: DEMO_ASTRONAUT_ID,
        category: item.category,
        fileName: item.fileName,
        fileFormat: 'csv',
        csvText: item.csvText,
        dataOrigin: 'SYNTHETIC',
        sourceDataset: SYNTHETIC_SCENARIO_SOURCE,
        mapping: buildCanonicalMapping(inspection.headers),
        allowDuplicate: true,
      });

      if (preview.invalid_rows.length > 0) {
        throw new Error(
          `Demo dataset validation failed for ${item.category}: ${preview.invalid_rows.length} invalid row(s).`,
        );
      }

      await confirmCsvImport(preview);
    }
  } catch (err) {
    // Roll back only the isolated demo profile so no partial records remain
    await clearDemoProfileAndData();
    throw err;
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
