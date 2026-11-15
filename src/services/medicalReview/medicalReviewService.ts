import type {
  HealthRecord,
  MedicalReviewRequest,
  MedicalReviewRequestInput,
} from '@/types';
import { initializeDatabase } from '@/services/storage/db';

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueIds(ids: string[], label: string): void {
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error(`${label} must contain unique, non-empty identifiers.`);
  }
}

function validateDateRange(range: MedicalReviewRequestInput['date_range']): void {
  if (range.from && Number.isNaN(Date.parse(range.from))) {
    throw new Error('The review start date is invalid.');
  }
  if (range.to && Number.isNaN(Date.parse(range.to))) {
    throw new Error('The review end date is invalid.');
  }
  if (range.from && range.to && Date.parse(range.from) > Date.parse(range.to)) {
    throw new Error('The review start date must be on or before the end date.');
  }
}

function dateIsInRange(date: string, range: MedicalReviewRequestInput['date_range']): boolean {
  return (!range.from || date >= range.from.slice(0, 10)) &&
    (!range.to || date <= range.to.slice(0, 10));
}

export async function listMedicalReviewRequests(
  profileId: string,
): Promise<MedicalReviewRequest[]> {
  if (!profileId.trim()) throw new Error('profileId is required to list review requests.');
  const db = await initializeDatabase();
  const rows = await db.medical_review_requests
    .where('profile_id')
    .equals(profileId.trim())
    .toArray();
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveMedicalReviewRequest(
  input: MedicalReviewRequestInput,
): Promise<MedicalReviewRequest> {
  const profileId = input.profile_id.trim();
  if (!profileId) throw new Error('profile_id is required for a review request.');
  if (input.observations && input.observations.trim().length > 1000) {
    throw new Error('Review observations must be 1,000 characters or fewer.');
  }
  if (
    input.record_ids.length === 0 &&
    input.checkin_ids.length === 0 &&
    !input.observations?.trim()
  ) {
    throw new Error('Select at least one measurement or check-in, or add an observation.');
  }
  uniqueIds(input.record_ids, 'record_ids');
  uniqueIds(input.checkin_ids, 'checkin_ids');
  validateDateRange(input.date_range);
  if (!['DRAFT', 'PENDING_LOCAL', 'EXPORTED'].includes(input.status)) {
    throw new Error('Choose a valid medical review request status.');
  }
  if (!['SELF_REPORTED', 'SYNTHETIC'].includes(input.data_origin)) {
    throw new Error('Choose a valid medical review request data origin.');
  }

  const db = await initializeDatabase();
  return db.transaction(
    'rw',
    [
      db.profiles,
      db.blood_records,
      db.sleep_records,
      db.cardiovascular_records,
      db.daily_checkins,
      db.medical_review_requests,
    ],
    async () => {
      if (!(await db.profiles.get(profileId))) {
        throw new Error(`Profile "${profileId}" was not found.`);
      }

      const [bloodRecords, sleepRecords, cardiovascularRecords, checkins] =
        await Promise.all([
          db.blood_records.where('astronaut_id').equals(profileId).toArray(),
          db.sleep_records.where('astronaut_id').equals(profileId).toArray(),
          db.cardiovascular_records.where('astronaut_id').equals(profileId).toArray(),
          db.daily_checkins.where('profile_id').equals(profileId).toArray(),
        ]);
      const records: HealthRecord[] = [
        ...bloodRecords,
        ...sleepRecords,
        ...cardiovascularRecords,
      ];
      const validRecordIds = new Set(records.map((record) => record.id));
      const validCheckinIds = new Set(checkins.map((checkin) => checkin.id));
      if (input.record_ids.some((id) => !validRecordIds.has(id))) {
        throw new Error('A selected measurement was not found for this profile.');
      }
      if (input.checkin_ids.some((id) => !validCheckinIds.has(id))) {
        throw new Error('A selected check-in was not found for this profile.');
      }
      if (records.some((record) =>
        input.record_ids.includes(record.id) &&
        !dateIsInRange(record.timestamp, input.date_range),
      )) {
        throw new Error('A selected measurement is outside the chosen review date range.');
      }
      if (checkins.some((checkin) =>
        input.checkin_ids.includes(checkin.id) &&
        !dateIsInRange(checkin.checkin_date, input.date_range),
      )) {
        throw new Error('A selected check-in is outside the chosen review date range.');
      }

      const existing = input.id
        ? await db.medical_review_requests.get(input.id)
        : undefined;
      if (input.id && (!existing || existing.profile_id !== profileId)) {
        throw new Error('The review request was not found for this profile.');
      }
      const now = new Date().toISOString();
      const request: MedicalReviewRequest = {
        ...input,
        id: existing?.id ?? createRequestId(),
        profile_id: profileId,
        date_range: { ...input.date_range },
        record_ids: [...input.record_ids],
        checkin_ids: [...input.checkin_ids],
        observations: input.observations?.trim() || undefined,
        source: input.source.trim() || 'medical_review_drawer',
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      await db.medical_review_requests.put(request);
      return request;
    },
  );
}
