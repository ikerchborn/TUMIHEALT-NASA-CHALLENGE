import type {
  HealthCategory,
  ResearchAggregate,
  ResearchDatasetRecord,
} from '@/types';
import { initializeDatabase } from '@/services/storage/db';

/**
 * Persists normalized NASA research observations (`ResearchDatasetRecord`) into
 * the dedicated `research_records` IndexedDB store, keeping them strictly
 * separate from personal astronaut records.
 */
export async function saveResearchDatasetRecords(
  records: readonly ResearchDatasetRecord[],
): Promise<number> {
  if (records.length === 0) return 0;
  const db = await initializeDatabase();
  await db.research_records.bulkPut([...records]);
  return records.length;
}

/**
 * Queries research observations by optional dataset, category, subject, or indicator.
 */
export async function queryResearchDatasetRecords(filter?: {
  source_dataset?: string;
  category?: HealthCategory;
  source_subject_id?: string;
  indicator?: string;
}): Promise<ResearchDatasetRecord[]> {
  const db = await initializeDatabase();
  const all = await db.research_records.toArray();
  return all.filter((r) => {
    if (filter?.source_dataset && r.source_dataset !== filter.source_dataset) return false;
    if (filter?.category && r.category !== filter.category) return false;
    if (filter?.source_subject_id && r.source_subject_id !== filter.source_subject_id)
      return false;
    if (filter?.indicator && r.indicator !== filter.indicator) return false;
    return true;
  });
}

/**
 * Persists cohort-level scientific summaries (`ResearchAggregate`, e.g. Apollo AP005)
 * into the dedicated `research_aggregates` IndexedDB store.
 */
export async function saveResearchAggregates(
  aggregates: readonly ResearchAggregate[],
): Promise<number> {
  if (aggregates.length === 0) return 0;
  const db = await initializeDatabase();
  await db.research_aggregates.bulkPut([...aggregates]);
  return aggregates.length;
}

/**
 * Queries cohort-level scientific aggregates by optional dataset, indicator, or group.
 */
export async function queryResearchAggregates(filter?: {
  source_dataset?: string;
  indicator?: string;
  group_label?: string;
}): Promise<ResearchAggregate[]> {
  const db = await initializeDatabase();
  const all = await db.research_aggregates.toArray();
  return all.filter((a) => {
    if (filter?.source_dataset && a.source_dataset !== filter.source_dataset) return false;
    if (filter?.indicator && a.indicator !== filter.indicator) return false;
    if (filter?.group_label && a.group_label !== filter.group_label) return false;
    return true;
  });
}
