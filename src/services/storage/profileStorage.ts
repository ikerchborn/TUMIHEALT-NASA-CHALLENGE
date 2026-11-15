import type {
  LocalAstronautProfile,
  LocalAstronautProfileInput,
} from '@/types';
import { initializeDatabase } from './db';

/**
 * Creates a new local astronaut profile in IndexedDB.
 * Throws if `astronaut_id` is empty or already exists.
 */
export async function createProfile(
  input: LocalAstronautProfileInput,
): Promise<LocalAstronautProfile> {
  const astronautId = input.astronaut_id.trim();
  const displayName = input.display_name.trim();

  if (!astronautId) {
    throw new Error('astronaut_id is required to create a local profile.');
  }
  if (!displayName) {
    throw new Error('display_name is required to create a local profile.');
  }

  const db = await initializeDatabase();
  const existing = await db.profiles.get(astronautId);
  if (existing) {
    throw new Error(`Local profile "${astronautId}" already exists.`);
  }

  const now = new Date().toISOString();
  const profile: LocalAstronautProfile = {
    astronaut_id: astronautId,
    display_name: displayName,
    mission_role: input.mission_role?.trim() || undefined,
    created_at: now,
    updated_at: now,
  };

  await db.profiles.add(profile);
  return profile;
}

/**
 * Retrieves a local astronaut profile by `astronaut_id`, or `undefined` if not found.
 */
export async function getProfile(
  astronautId: string,
): Promise<LocalAstronautProfile | undefined> {
  const db = await initializeDatabase();
  return db.profiles.get(astronautId);
}

/**
 * Lists all local astronaut profiles stored in this browser.
 */
export async function listProfiles(): Promise<LocalAstronautProfile[]> {
  const db = await initializeDatabase();
  return db.profiles.orderBy('created_at').toArray();
}

/**
 * Updates an existing local astronaut profile.
 */
export async function updateProfile(
  astronautId: string,
  updates: Partial<Pick<LocalAstronautProfileInput, 'display_name' | 'mission_role'>>,
): Promise<LocalAstronautProfile> {
  const db = await initializeDatabase();
  const existing = await db.profiles.get(astronautId);
  if (!existing) {
    throw new Error(`Local profile "${astronautId}" was not found.`);
  }

  const updated: LocalAstronautProfile = {
    ...existing,
    display_name:
      updates.display_name !== undefined
        ? updates.display_name.trim()
        : existing.display_name,
    mission_role:
      updates.mission_role !== undefined
        ? updates.mission_role.trim() || undefined
        : existing.mission_role,
    updated_at: new Date().toISOString(),
  };

  if (!updated.display_name) {
    throw new Error('display_name cannot be empty.');
  }

  await db.profiles.put(updated);
  return updated;
}

/**
 * Deletes a local astronaut profile and all health records associated with it
 * across health and daily check-in tables in a single transaction.
 */
export async function deleteProfile(astronautId: string): Promise<{
  deletedProfile: boolean;
  deletedRecordsCount: number;
}> {
  const db = await initializeDatabase();

  return db.transaction(
    'rw',
    [
      db.profiles,
      db.blood_records,
      db.sleep_records,
      db.cardiovascular_records,
      db.mission_contexts,
      db.daily_checkins,
      db.medical_review_requests,
    ],
    async () => {
      const existing = await db.profiles.get(astronautId);
      const bloodCount = await db.blood_records
        .where('astronaut_id')
        .equals(astronautId)
        .delete();
      const sleepCount = await db.sleep_records
        .where('astronaut_id')
        .equals(astronautId)
        .delete();
      const cardioCount = await db.cardiovascular_records
        .where('astronaut_id')
        .equals(astronautId)
        .delete();
      const checkInCount = await db.daily_checkins
        .where('profile_id')
        .equals(astronautId)
        .delete();
      const reviewRequestCount = await db.medical_review_requests
        .where('profile_id')
        .equals(astronautId)
        .delete();
      await db.mission_contexts.where('astronaut_id').equals(astronautId).delete();

      if (existing) {
        await db.profiles.delete(astronautId);
      }

      return {
        deletedProfile: Boolean(existing),
        deletedRecordsCount:
          bloodCount + sleepCount + cardioCount + checkInCount + reviewRequestCount,
      };
    },
  );
}
