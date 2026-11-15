import type { EntityTable } from 'dexie';
import type {
  BloodRecord,
  CardiovascularRecord,
  DateRangeFilter,
  HealthCategory,
  HealthRecord,
  HealthRecordInput,
  RecordQueryFilter,
  SleepRecord,
} from '@/types';
import { initializeDatabase, type TumiHealthDatabase } from './db';

function generateRecordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getCategoryTable(
  db: TumiHealthDatabase,
  category: HealthCategory,
): EntityTable<HealthRecord, 'id'> {
  switch (category) {
    case 'blood':
      return db.blood_records as unknown as EntityTable<HealthRecord, 'id'>;
    case 'sleep':
      return db.sleep_records as unknown as EntityTable<HealthRecord, 'id'>;
    case 'cardiovascular':
      return db.cardiovascular_records as unknown as EntityTable<HealthRecord, 'id'>;
  }
}

function matchesDateRange(timestamp: string, dateRange?: DateRangeFilter): boolean {
  if (!dateRange) {
    return true;
  }
  const timeMs = Date.parse(timestamp);
  if (Number.isNaN(timeMs)) {
    return false;
  }
  if (dateRange.from) {
    const fromMs = Date.parse(dateRange.from);
    if (!Number.isNaN(fromMs) && timeMs < fromMs) {
      return false;
    }
  }
  if (dateRange.to) {
    const toMs = Date.parse(dateRange.to);
    if (!Number.isNaN(toMs) && timeMs > toMs) {
      return false;
    }
  }
  return true;
}

/**
 * Inserts a new health record into the appropriate category table in IndexedDB.
 */
export async function insertRecord<T extends HealthRecordInput>(
  input: T,
): Promise<
  T['category'] extends 'blood'
    ? BloodRecord
    : T['category'] extends 'sleep'
      ? SleepRecord
      : CardiovascularRecord
> {
  const db = await initializeDatabase();
  const now = new Date().toISOString();
  const id = generateRecordId();

  const record: HealthRecord = {
    ...input,
    id,
    ingestion_method: input.ingestion_method ?? 'MANUAL',
    source_dataset: input.source_dataset ?? 'local_manual_entry',
    quality_status: input.quality_status ?? (input.value === null ? 'missing_value' : 'verified'),
    created_at: now,
    updated_at: now,
  } as HealthRecord;

  const table = getCategoryTable(db, record.category);
  await table.add(record);
  return record as never;
}

/**
 * Retrieves a single record by ID. Searches the specified category, or all categories
 * if `category` is omitted.
 */
export async function getRecordById(
  id: string,
  category?: HealthCategory,
): Promise<HealthRecord | undefined> {
  const db = await initializeDatabase();
  if (category) {
    return getCategoryTable(db, category).get(id);
  }

  const categories: HealthCategory[] = ['blood', 'sleep', 'cardiovascular'];
  for (const cat of categories) {
    const found = await getCategoryTable(db, cat).get(id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Queries records across one or all categories, supporting filtering by
 * `astronaut_id`, `category`, `indicator`, and `dateRange`, sorted chronologically.
 */
export async function queryRecords(
  filter: RecordQueryFilter = {},
): Promise<HealthRecord[]> {
  const db = await initializeDatabase();
  const categories: HealthCategory[] = filter.category
    ? [filter.category]
    : ['blood', 'sleep', 'cardiovascular'];

  const results: HealthRecord[] = [];

  for (const cat of categories) {
    const table = getCategoryTable(db, cat);
    let rows: HealthRecord[];

    if (filter.astronaut_id && filter.indicator) {
      rows = await table
        .where('[astronaut_id+indicator]')
        .equals([filter.astronaut_id, filter.indicator])
        .toArray();
    } else if (filter.astronaut_id) {
      rows = await table
        .where('astronaut_id')
        .equals(filter.astronaut_id)
        .toArray();
    } else if (filter.indicator) {
      rows = await table.where('indicator').equals(filter.indicator).toArray();
    } else {
      rows = await table.toArray();
    }

    for (const row of rows) {
      if (matchesDateRange(row.timestamp, filter.dateRange)) {
        results.push(row);
      }
    }
  }

  results.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return results;
}

/**
 * Updates an existing record by ID and category.
 */
export async function updateRecordById(
  id: string,
  category: HealthCategory,
  updates: Partial<Omit<HealthRecord, 'id' | 'category' | 'created_at'>>,
): Promise<HealthRecord> {
  const db = await initializeDatabase();
  const table = getCategoryTable(db, category);
  const existing = await table.get(id);
  if (!existing) {
    throw new Error(`Record "${id}" not found in category "${category}".`);
  }

  const updated: HealthRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    category: existing.category,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  } as HealthRecord;

  await table.put(updated);
  return updated;
}

/**
 * Deletes a single record by ID. If `category` is omitted, searches across all
 * category tables and deletes the matching record.
 */
export async function deleteRecordById(
  id: string,
  category?: HealthCategory,
): Promise<boolean> {
  const db = await initializeDatabase();
  if (category) {
    const table = getCategoryTable(db, category);
    const existing = await table.get(id);
    if (!existing) {
      return false;
    }
    await table.delete(id);
    return true;
  }

  const categories: HealthCategory[] = ['blood', 'sleep', 'cardiovascular'];
  for (const cat of categories) {
    const table = getCategoryTable(db, cat);
    const existing = await table.get(id);
    if (existing) {
      await table.delete(id);
      return true;
    }
  }
  return false;
}

/**
 * Deletes all records belonging to a specific astronaut profile (optionally
 * scoped to a single category).
 */
export async function deleteRecordsByAstronaut(
  astronautId: string,
  category?: HealthCategory,
): Promise<number> {
  const db = await initializeDatabase();
  const categories: HealthCategory[] = category
    ? [category]
    : ['blood', 'sleep', 'cardiovascular'];

  let deletedCount = 0;
  for (const cat of categories) {
    const table = getCategoryTable(db, cat);
    deletedCount += await table.where('astronaut_id').equals(astronautId).delete();
  }
  return deletedCount;
}
