import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEMO_ASTRONAUT_ID,
  buildSynthetic90DayCsvFiles,
  buildSynthetic90DayRecords,
  calculatePersonalBaselineFromRecords,
  clearDemoProfileAndData,
  createLocalProfile,
  ensureDemoProfileAndData,
  evaluateSelfAssessmentFromRecords,
  getDailyCheckIn,
  getProfile,
  getRecords,
  getLocalCheckInDate,
  initializeDatabase,
  listLocalProfiles,
  prepareCsvImportPreview,
  saveBloodMeasurement,
  saveDailyCheckIn,
  validateHealthRecordInput,
} from '@/services';
import { TEAM_MEMBERS } from '@/app/pages/WelcomePage';

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
    expect(new Set(demoRecords.map((r) => r.indicator)).size).toBe(52);

    // Repeated call must not duplicate records
    await ensureDemoProfileAndData();
    const afterSecondCall = await getRecords({ astronaut_id: DEMO_ASTRONAUT_ID });
    expect(afterSecondCall).toHaveLength(demoRecords.length);

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

  it('generates a coherent 90-day synthetic dataset that validates and imports cleanly', async () => {
    const records = buildSynthetic90DayRecords('astro-syn-90');
    expect(records.length).toBeGreaterThanOrEqual(500);
    expect(records.every((r) => r.data_origin === 'SYNTHETIC')).toBe(true);

    // Every generated record passes strict record validation
    for (const r of records) {
      const check = validateHealthRecordInput(r);
      expect(check.valid).toBe(true);
    }

    // Verify 90-day span
    const timestamps = records.map((r) => Date.parse(r.timestamp)).sort((a, b) => a - b);
    const spanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 3600 * 1000);
    expect(spanDays).toBeGreaterThanOrEqual(85);

    // Verify explicit missing values (null) are preserved and never replaced with 0
    expect(records.some((r) => r.value === null && r.quality_status === 'missing_value')).toBe(true);

    // Verify REVIEW_REQUIRED on sleep_duration (>=20% decrease in recent period)
    const sleepAssess = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-syn-90',
      category: 'sleep',
      indicator: 'sleep_duration',
    });
    expect(sleepAssess.assessment_status).toBe('REVIEW_REQUIRED');

    // Verify INSUFFICIENT_DATA on mpv (<3 valid samples)
    const mpvBase = calculatePersonalBaselineFromRecords(records, {
      astronaut_id: 'astro-syn-90',
      category: 'blood',
      indicator: 'mpv',
    });
    expect(mpvBase.status).toBe('insufficient_data');
    expect(mpvBase.valid_count).toBe(2);

    // Verify MONITOR on cardiac_output (outdated >14 days)
    const coAssess = evaluateSelfAssessmentFromRecords(records, {
      astronaut_id: 'astro-syn-90',
      category: 'cardiovascular',
      indicator: 'cardiac_output',
    });
    expect(coAssess.assessment_status).toBe('MONITOR');

    // Verify CSV files are import-ready with 0 invalid rows
    await createLocalProfile({ astronaut_id: 'astro-csv-test', display_name: 'CSV Tester' });
    const csvFiles = buildSynthetic90DayCsvFiles('astro-csv-test');
    const bloodPreview = await prepareCsvImportPreview({
      csvText: csvFiles.bloodCsv,
      fileName: 'tumi_synthetic_90d_blood.csv',
      profileId: 'astro-csv-test',
      category: 'blood',
      dataOrigin: 'SYNTHETIC',
      sourceDataset: 'TUMI-HEALT Synthetic 90d',
      mapping: {
        timestamp: 'timestamp',
        indicator: 'indicator',
        value: 'value',
        unit: 'unit',
        sample_id: 'sample_id',
        specimen_type: 'specimen_type',
        assay: 'assay',
        quality_status: 'quality_status',
      },
    });
    expect(bloodPreview.invalid_rows).toHaveLength(0);
    expect(bloodPreview.valid_records.length).toBe(140);

    // Verify 6 team member cards config
    expect(TEAM_MEMBERS).toHaveLength(6);
  });
});
