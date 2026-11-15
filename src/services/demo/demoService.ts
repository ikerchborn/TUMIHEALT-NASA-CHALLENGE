import type {
  BloodRecord,
  CardiovascularRecord,
  LocalAstronautProfile,
  SleepRecord,
} from '@/types';
import {
  createLocalProfile,
  deleteLocalProfileData,
  getRecords,
} from '../healthService';
import { getLatestMissionContext, saveMissionContext } from '../missionContext';
import { getDatabase, getProfile } from '../storage';
import { getDailyCheckIn, getLocalCheckInDate, saveDailyCheckIn } from '../checkIn';
import { buildSynthetic90DayRecords } from './syntheticDataset90d';

export const DEMO_ASTRONAUT_ID = 'demo-astronaut';

export function isDemoAstronaut(astronautId?: string | null): boolean {
  return astronautId === DEMO_ASTRONAUT_ID;
}

function dateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLocalCheckInDate(date);
}

/**
 * Ensures an isolated, deterministic 90-day synthetic demonstration profile and
 * measurements exist in IndexedDB. Never touches real user profiles.
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

  const today = getLocalCheckInDate();
  if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, dateDaysAgo(5)))) {
    await saveDailyCheckIn({
      profile_id: DEMO_ASTRONAUT_ID,
      checkin_date: dateDaysAgo(5),
      mood: 'very_fatigued',
      energy_level: 2,
      symptoms: ['headache'],
      note: 'Synthetic check-in: mild headache after long docking schedule.',
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });
  }
  if (!(await getDailyCheckIn(DEMO_ASTRONAUT_ID, dateDaysAgo(1)))) {
    await saveDailyCheckIn({
      profile_id: DEMO_ASTRONAUT_ID,
      checkin_date: dateDaysAgo(1),
      mood: 'a_bit_tired',
      energy_level: 3,
      symptoms: [],
      note: 'Synthetic check-in: shorter sleep cycle during cargo docking schedule.',
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
      note: 'Synthetic check-in: feeling rested after scheduled recovery window.',
      data_origin: 'SYNTHETIC',
      source: 'synthetic_demo_fixture',
    });
  }

  const existing = await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID });
  if (existing.length > 0) {
    return profile;
  }

  const syntheticRecords = buildSynthetic90DayRecords(DEMO_ASTRONAUT_ID);
  const bloodRecords = syntheticRecords.filter((r): r is BloodRecord => r.category === 'blood');
  const sleepRecords = syntheticRecords.filter((r): r is SleepRecord => r.category === 'sleep');
  const cvRecords = syntheticRecords.filter(
    (r): r is CardiovascularRecord => r.category === 'cardiovascular',
  );

  const db = getDatabase();
  await db.transaction(
    'rw',
    [db.blood_records, db.sleep_records, db.cardiovascular_records],
    async () => {
      await db.blood_records.bulkPut(bloodRecords);
      await db.sleep_records.bulkPut(sleepRecords);
      await db.cardiovascular_records.bulkPut(cvRecords);
    },
  );

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
