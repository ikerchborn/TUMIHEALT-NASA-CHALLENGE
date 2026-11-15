import type {
  DailyCheckIn,
  DailyCheckInInput,
  DailyCheckInMood,
  DailyCheckInSymptom,
} from '@/types';
import { initializeDatabase } from '@/services/storage/db';

const moods = new Set<DailyCheckInMood>(['good', 'a_bit_tired', 'very_fatigued', 'unwell']);
const symptoms = new Set<DailyCheckInSymptom>(['headache', 'dizziness', 'nausea', 'other']);
const origins = new Set(['SELF_REPORTED', 'SYNTHETIC']);

export function getLocalCheckInDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  return (
    date.getUTCFullYear() === Number(yearText) &&
    date.getUTCMonth() === Number(monthText) - 1 &&
    date.getUTCDate() === Number(dayText)
  );
}

function generateCheckInId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `checkin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function validateInput(input: DailyCheckInInput, checkInDate: string): void {
  if (!input.profile_id.trim()) {
    throw new Error('profile_id is required for a daily check-in.');
  }
  if (!isValidDateKey(checkInDate)) {
    throw new Error('checkin_date must be a valid YYYY-MM-DD date.');
  }
  if (checkInDate > getLocalCheckInDate()) {
    throw new Error('A daily check-in cannot be saved for a future date.');
  }
  if (!moods.has(input.mood)) {
    throw new Error('Choose a valid daily check-in mood.');
  }
  if (!Number.isInteger(input.energy_level) || input.energy_level < 1 || input.energy_level > 5) {
    throw new Error('energy_level must be an integer from 1 to 5.');
  }
  if (
    !Array.isArray(input.symptoms) ||
    input.symptoms.some((symptom) => !symptoms.has(symptom)) ||
    new Set(input.symptoms).size !== input.symptoms.length
  ) {
    throw new Error('Choose valid, non-duplicate symptoms.');
  }
  if (!origins.has(input.data_origin) || !input.source.trim()) {
    throw new Error('A data origin and source are required for a daily check-in.');
  }
  if (input.other_symptom && !input.symptoms.includes('other')) {
    throw new Error('other_symptom can only be saved when Other is selected.');
  }
  if ((input.other_symptom?.trim().length ?? 0) > 160) {
    throw new Error('Other symptom details must be 160 characters or fewer.');
  }
  if ((input.note?.trim().length ?? 0) > 1000) {
    throw new Error('Check-in notes must be 1,000 characters or fewer.');
  }
}

export async function getDailyCheckIn(
  profileId: string,
  checkInDate = getLocalCheckInDate(),
): Promise<DailyCheckIn | undefined> {
  if (!profileId.trim()) throw new Error('profileId is required to read a daily check-in.');
  if (!isValidDateKey(checkInDate)) throw new Error('checkInDate must be a valid YYYY-MM-DD date.');

  const db = await initializeDatabase();
  return db.daily_checkins
    .where('[profile_id+checkin_date]')
    .equals([profileId.trim(), checkInDate])
    .first();
}

export async function listDailyCheckIns(
  profileId: string,
  limit = 30,
): Promise<DailyCheckIn[]> {
  if (!profileId.trim()) throw new Error('profileId is required to list daily check-ins.');
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('limit must be a positive integer.');
  }

  const db = await initializeDatabase();
  const rows = await db.daily_checkins
    .where('profile_id')
    .equals(profileId.trim())
    .toArray();
  return rows
    .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date) || b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function saveDailyCheckIn(
  input: DailyCheckInInput,
): Promise<DailyCheckIn> {
  const profileId = input.profile_id.trim();
  const checkInDate = input.checkin_date ?? getLocalCheckInDate();
  validateInput(input, checkInDate);

  const db = await initializeDatabase();
  return db.transaction('rw', db.daily_checkins, db.profiles, async () => {
    if (!(await db.profiles.get(profileId))) {
      throw new Error(`Profile "${profileId}" was not found.`);
    }

    const existing = await db.daily_checkins
      .where('[profile_id+checkin_date]')
      .equals([profileId, checkInDate])
      .first();
    const now = new Date().toISOString();
    const saved: DailyCheckIn = {
      id: existing?.id ?? generateCheckInId(),
      profile_id: profileId,
      checkin_date: checkInDate,
      mood: input.mood,
      energy_level: input.energy_level,
      symptoms: [...input.symptoms],
      other_symptom: input.symptoms.includes('other') ? input.other_symptom?.trim() || undefined : undefined,
      note: input.note?.trim() || undefined,
      data_origin: input.data_origin,
      source: input.source.trim(),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await db.daily_checkins.put(saved);
    return saved;
  });
}
