import type {
  AnalyticsSummary,
  AuditEvent,
  AuditQueryFilter,
  BloodRecord,
  BloodRecordInput,
  CardiovascularRecord,
  CardiovascularRecordInput,
  DateRangeFilter,
  HealthCategory,
  HealthRecord,
  HealthRecordInput,
  LocalAstronautProfile,
  LocalAstronautProfileInput,
  RecordQueryFilter,
  SleepRecord,
  SleepRecordInput,
} from '@/types';
import {
  analyzeCategorySummary,
  analyzeIndicatorTrends,
  summarizeDataQuality,
  type CategoryAnalyticsResult,
  type DataQualitySummary,
} from '@/services/analytics';
import {
  getProfileAuditHistory,
  getRecordAuditHistory,
  queryAuditEvents,
  recordAuditEvent,
} from '@/services/audit';
import {
  cancelCsvImport,
  confirmCsvImport,
  inspectCsvFile,
  listImportBatches,
  prepareCsvImportPreview,
} from '@/services/ingestion';
import {
  createProfile,
  deleteProfile,
  deleteRecordById,
  getProfile,
  getRecordById,
  initializeDatabase,
  listProfiles,
  queryRecords,
  insertRecord,
  updateProfile,
  updateRecordById,
} from '@/services/storage';
import { validateHealthRecordInput } from '@/services/validation';

function assertValidInput(input: HealthRecordInput): void {
  const result = validateHealthRecordInput(input);
  if (!result.valid) {
    const details = result.errors.map((e) => `[${e.field}] ${e.message}`).join('; ');
    throw new Error(`Validation failed: ${details}`);
  }
}

/**
 * Saves a manually entered blood biomarker measurement after validation and
 * records a `RECORD_CREATED` audit event.
 */
export async function saveBloodMeasurement(
  input: BloodRecordInput,
  actorId?: string,
): Promise<BloodRecord> {
  const fullInput: HealthRecordInput = {
    ...input,
    category: 'blood',
    ingestion_method: input.ingestion_method ?? 'MANUAL',
  };
  assertValidInput(fullInput);

  const saved = await insertRecord(fullInput);
  await recordAuditEvent({
    record_id: saved.id,
    profile_id: saved.astronaut_id,
    actor_id: actorId ?? saved.astronaut_id,
    action: 'RECORD_CREATED',
    data_origin: saved.data_origin,
    category: 'blood',
    status: 'success',
    details: {
      ingestion_method: saved.ingestion_method,
      indicator: saved.indicator,
      value: saved.value,
      unit: saved.unit,
    },
  });
  return saved;
}

/**
 * Saves a manually entered sleep monitoring measurement after validation and
 * records a `RECORD_CREATED` audit event.
 */
export async function saveSleepMeasurement(
  input: SleepRecordInput,
  actorId?: string,
): Promise<SleepRecord> {
  const fullInput: HealthRecordInput = {
    ...input,
    category: 'sleep',
    ingestion_method: input.ingestion_method ?? 'MANUAL',
  };
  assertValidInput(fullInput);

  const saved = await insertRecord(fullInput);
  await recordAuditEvent({
    record_id: saved.id,
    profile_id: saved.astronaut_id,
    actor_id: actorId ?? saved.astronaut_id,
    action: 'RECORD_CREATED',
    data_origin: saved.data_origin,
    category: 'sleep',
    status: 'success',
    details: {
      ingestion_method: saved.ingestion_method,
      indicator: saved.indicator,
      value: saved.value,
      unit: saved.unit,
    },
  });
  return saved;
}

/**
 * Saves a manually entered cardiovascular monitoring measurement after validation
 * and records a `RECORD_CREATED` audit event.
 */
export async function saveCardiovascularMeasurement(
  input: CardiovascularRecordInput,
  actorId?: string,
): Promise<CardiovascularRecord> {
  const fullInput: HealthRecordInput = {
    ...input,
    category: 'cardiovascular',
    ingestion_method: input.ingestion_method ?? 'MANUAL',
  };
  assertValidInput(fullInput);

  const saved = await insertRecord(fullInput);
  await recordAuditEvent({
    record_id: saved.id,
    profile_id: saved.astronaut_id,
    actor_id: actorId ?? saved.astronaut_id,
    action: 'RECORD_CREATED',
    data_origin: saved.data_origin,
    category: 'cardiovascular',
    status: 'success',
    details: {
      ingestion_method: saved.ingestion_method,
      indicator: saved.indicator,
      value: saved.value,
      unit: saved.unit,
    },
  });
  return saved;
}

/**
 * Retrieves health records filtered by astronaut profile, category, indicator,
 * and/or date range.
 */
export async function getRecords(
  filter: RecordQueryFilter = {},
): Promise<HealthRecord[]> {
  return queryRecords(filter);
}

/**
 * Retrieves historical trends and statistical summary for a specific indicator.
 */
export async function getHistoricalTrends(params: {
  astronaut_id: string;
  category: HealthCategory;
  indicator: string;
  dateRange?: DateRangeFilter;
}): Promise<AnalyticsSummary> {
  return analyzeIndicatorTrends(params);
}

/**
 * Retrieves category-level analytics and data quality summary for an astronaut.
 */
export async function getCategoryAnalytics(params: {
  astronaut_id: string;
  category: HealthCategory;
  dateRange?: DateRangeFilter;
}): Promise<CategoryAnalyticsResult> {
  return analyzeCategorySummary(params);
}

/**
 * Computes a data quality summary across records matching the given filter.
 */
export async function getDataQualitySummary(
  filter: RecordQueryFilter = {},
): Promise<DataQualitySummary> {
  const records = await queryRecords(filter);
  return summarizeDataQuality(records);
}

/**
 * Updates an existing health record after validating the resulting state.
 * Preserves previous and new values in a `RECORD_UPDATED` audit event.
 */
export async function updateRecord(
  id: string,
  category: HealthCategory,
  updates: Partial<Omit<HealthRecord, 'id' | 'category' | 'created_at'>>,
  actorId?: string,
): Promise<HealthRecord> {
  const existing = await getRecordById(id, category);
  if (!existing) {
    throw new Error(`Record "${id}" not found in category "${category}".`);
  }

  const mergedCandidate = {
    ...existing,
    ...updates,
    category: existing.category,
  } as HealthRecordInput;

  assertValidInput(mergedCandidate);

  const updated = await updateRecordById(id, category, updates);
  await recordAuditEvent({
    record_id: updated.id,
    profile_id: updated.astronaut_id,
    actor_id: actorId ?? updated.astronaut_id,
    action: 'RECORD_UPDATED',
    data_origin: updated.data_origin,
    category: updated.category,
    status: 'success',
    details: {
      previous_values: existing,
      new_values: updated,
    },
  });

  return updated;
}

/**
 * Deletes a single health record.
 * Records the `RECORD_DELETED` audit event BEFORE removing the record from IndexedDB.
 */
export async function deleteRecord(
  id: string,
  category?: HealthCategory,
  actorId?: string,
): Promise<boolean> {
  const existing = await getRecordById(id, category);
  if (!existing) {
    return false;
  }

  await recordAuditEvent({
    record_id: existing.id,
    profile_id: existing.astronaut_id,
    actor_id: actorId ?? existing.astronaut_id,
    action: 'RECORD_DELETED',
    data_origin: existing.data_origin,
    category: existing.category,
    status: 'success',
    details: {
      deleted_record_snapshot: {
        indicator: existing.indicator,
        value: existing.value,
        unit: existing.unit,
        timestamp: existing.timestamp,
      },
    },
  });

  return deleteRecordById(existing.id, existing.category);
}

export async function createLocalProfile(
  input: LocalAstronautProfileInput,
  actorId?: string,
): Promise<LocalAstronautProfile> {
  const profile = await createProfile(input);
  await recordAuditEvent({
    profile_id: profile.astronaut_id,
    actor_id: actorId ?? profile.astronaut_id,
    action: 'PROFILE_CREATED',
    status: 'success',
    details: {
      display_name: profile.display_name,
      mission_role: profile.mission_role ?? null,
    },
  });
  return profile;
}

export async function getLocalProfileData(astronautId: string): Promise<{
  profile: LocalAstronautProfile | undefined;
  records: HealthRecord[];
  auditHistory: AuditEvent[];
}> {
  const [profile, records, auditHistory] = await Promise.all([
    getProfile(astronautId),
    queryRecords({ astronaut_id: astronautId }),
    getProfileAuditHistory(astronautId),
  ]);
  return { profile, records, auditHistory };
}

export async function listLocalProfiles(): Promise<LocalAstronautProfile[]> {
  return listProfiles();
}

export async function updateLocalProfile(
  astronautId: string,
  updates: Partial<Pick<LocalAstronautProfileInput, 'display_name' | 'mission_role'>>,
  actorId?: string,
): Promise<LocalAstronautProfile> {
  const previous = await getProfile(astronautId);
  const updated = await updateProfile(astronautId, updates);
  await recordAuditEvent({
    profile_id: astronautId,
    actor_id: actorId ?? astronautId,
    action: 'PROFILE_UPDATED',
    status: 'success',
    details: {
      previous_values: previous ?? null,
      new_values: updated,
    },
  });
  return updated;
}

/**
 * Deletes a local astronaut profile and all its health records.
 * Logs `PROFILE_DELETED` before deleting the profile and records.
 */
export async function deleteLocalProfileData(
  astronautId: string,
  actorId?: string,
): Promise<{ deletedProfile: boolean; deletedRecordsCount: number }> {
  await recordAuditEvent({
    profile_id: astronautId,
    actor_id: actorId ?? astronautId,
    action: 'PROFILE_DELETED',
    status: 'success',
    details: { reason: 'User-initiated local profile deletion' },
  });
  return deleteProfile(astronautId);
}

export {
  initializeDatabase,
  inspectCsvFile,
  prepareCsvImportPreview,
  confirmCsvImport,
  cancelCsvImport,
  listImportBatches,
  queryAuditEvents,
  getRecordAuditHistory,
  getProfileAuditHistory,
  type AuditQueryFilter,
};
