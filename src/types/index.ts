export * from './common';
export * from './blood';
export * from './sleep';
export * from './cardiovascular';
export * from './audit';
export * from './ingestion';

import type { BloodRecord, BloodRecordInput } from './blood';
import type { SleepRecord, SleepRecordInput } from './sleep';
import type { CardiovascularRecord, CardiovascularRecordInput } from './cardiovascular';
import type { DateRangeFilter, HealthCategory } from './common';

export type HealthRecord = BloodRecord | SleepRecord | CardiovascularRecord;

export type HealthRecordInput =
  | ({ category: 'blood' } & BloodRecordInput)
  | ({ category: 'sleep' } & SleepRecordInput)
  | ({ category: 'cardiovascular' } & CardiovascularRecordInput);

export interface RecordQueryFilter {
  astronaut_id?: string;
  category?: HealthCategory;
  indicator?: string;
  dateRange?: DateRangeFilter;
}
