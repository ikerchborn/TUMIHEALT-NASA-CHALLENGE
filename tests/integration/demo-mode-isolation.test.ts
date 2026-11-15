import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEMO_ASTRONAUT_ID,
  clearDemoProfileAndData,
  createLocalProfile,
  ensureDemoProfileAndData,
  getDailyCheckIn,
  getProfile,
  getRecords,
  getLocalCheckInDate,
  initializeDatabase,
  listLocalProfiles,
  saveBloodMeasurement,
  saveDailyCheckIn,
} from '@/services';

describe('demo mode isolation', () => {
  beforeEach(async () => {
    const db = await initializeDatabase();
    await db.delete();
    await initializeDatabase();
  });

  it('creates deterministic synthetic demo data without modifying real profiles or records', async () => {
    await createLocalProfile({
      astronaut_id: 'real-astro-1',
      display_name: 'Maya Lin',
      mission_role: 'Commander',
    });

    await saveBloodMeasurement({
      astronaut_id: 'real-astro-1',
      timestamp: '2026-10-01T08:00:00Z',
      indicator: 'hemoglobin',
      value: 15.1,
      unit: 'g/dL',
      data_origin: 'GROUND_ANALOG',
    });
    const realCheckIn = await saveDailyCheckIn({
      profile_id: 'real-astro-1',
      mood: 'good',
      energy_level: 4,
      symptoms: [],
      data_origin: 'SELF_REPORTED',
      source: 'daily_check_in',
    });

    const demoProfile = await ensureDemoProfileAndData();
    expect(demoProfile.astronaut_id).toBe(DEMO_ASTRONAUT_ID);

    const demoRecords = await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID });
    expect(demoRecords.length).toBeGreaterThan(0);
    expect(demoRecords.every((r) => r.data_origin === 'SYNTHETIC')).toBe(true);
    expect(demoRecords.some((r) => r.category === 'blood')).toBe(true);
    expect(demoRecords.some((r) => r.category === 'sleep')).toBe(true);
    expect(demoRecords.some((r) => r.category === 'cardiovascular')).toBe(true);
    const demoCheckIn = await getDailyCheckIn(DEMO_ASTRONAUT_ID, getLocalCheckInDate());
    expect(demoCheckIn?.data_origin).toBe('SYNTHETIC');
    expect(demoCheckIn?.source).toBe('synthetic_demo_fixture');

    const db = await initializeDatabase();
    await db.daily_checkins.where('profile_id').equals(DEMO_ASTRONAUT_ID).delete();
    await ensureDemoProfileAndData();
    expect(await getDailyCheckIn(DEMO_ASTRONAUT_ID, getLocalCheckInDate())).toBeDefined();

    // Real profile and records remain untouched
    const realRecords = await getRecords({ astronaut_id: 'real-astro-1' });
    expect(realRecords).toHaveLength(1);
    expect(realRecords[0].value).toBe(15.1);

    // Exiting demo clears demo profile and data but keeps real profile intact
    await clearDemoProfileAndData();
    expect(await getProfile(DEMO_ASTRONAUT_ID)).toBeUndefined();
    expect(await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID })).toHaveLength(0);

    const profiles = await listLocalProfiles();
    expect(profiles.map((p) => p.astronaut_id)).toEqual(['real-astro-1']);
    expect(await getRecords({ astronaut_id: 'real-astro-1' })).toHaveLength(1);
    expect(await getDailyCheckIn('real-astro-1', realCheckIn.checkin_date)).toEqual(realCheckIn);
    expect(await getDailyCheckIn(DEMO_ASTRONAUT_ID, getLocalCheckInDate())).toBeUndefined();
  });
});
