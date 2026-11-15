import type { MissionContext, MissionContextInput } from '@/types';
import { initializeDatabase } from '@/services/storage/db';

function generateContextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Records a structured mission context entry in IndexedDB without inferring
 * unknown environmental or mission conditions.
 */
export async function saveMissionContext(
  input: MissionContextInput,
): Promise<MissionContext> {
  if (!input.astronaut_id.trim()) {
    throw new Error('astronaut_id is required for mission context.');
  }
  if (!input.mission_id.trim()) {
    throw new Error('mission_id is required for mission context.');
  }

  const db = await initializeDatabase();
  const context: MissionContext = {
    context_id: generateContextId(),
    astronaut_id: input.astronaut_id.trim(),
    mission_id: input.mission_id.trim(),
    mission_phase: input.mission_phase,
    environment_type: input.environment_type.trim() || 'unknown',
    gravity_environment: input.gravity_environment,
    mission_start_date: input.mission_start_date || undefined,
    activity_context: input.activity_context?.trim() || undefined,
    sleep_context: input.sleep_context?.trim() || undefined,
    measurement_context: input.measurement_context?.trim() || undefined,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    source: input.source?.trim() || 'local_manual_entry',
  };

  await db.mission_contexts.add(context);
  return context;
}

export async function getMissionContexts(
  astronautId: string,
): Promise<MissionContext[]> {
  const db = await initializeDatabase();
  const rows = await db.mission_contexts
    .where('astronaut_id')
    .equals(astronautId)
    .toArray();
  return rows.sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
}

export async function getLatestMissionContext(
  astronautId: string,
): Promise<MissionContext | undefined> {
  const list = await getMissionContexts(astronautId);
  return list[0];
}
