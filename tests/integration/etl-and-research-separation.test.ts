import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTIGRAPHY_SOURCE_FILE,
  APOLLO_DEFAULT_SOURCE_FILE,
  CBC_SOURCE_FILE,
  CMP_SOURCE_FILE,
  deleteLocalDatabase,
  getRecords,
  initializeDatabase,
  processActigraphyDataset,
  processApolloDataset,
  processCbcDataset,
  processCmpDataset,
  queryResearchAggregates,
  queryResearchDatasetRecords,
  saveResearchAggregates,
  saveResearchDatasetRecords,
} from '@/services';

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('NASA Dataset ETLs & Research vs Personal Separation', () => {
  beforeEach(async () => {
    await deleteLocalDatabase();
    await initializeDatabase();
  });

  it('processes OSD-575 CMP wide CSV into ResearchDatasetRecord without inventing timestamps', async () => {
    const rawCsv = readWorkspaceFile(CMP_SOURCE_FILE);
    const { records, report } = processCmpDataset(rawCsv);

    expect(report.dataset).toBe('OSD-575');
    expect(report.total_source_rows).toBe(28);
    expect(records).toHaveLength(28 * 19);
    expect(records.every((r) => r.timestamp === null)).toBe(true);
    expect(records.every((r) => r.data_origin === 'SPACEFLIGHT')).toBe(true);
    expect(records.some((r) => r.study_timepoint === 'L-3' && r.study_phase === 'preflight')).toBe(
      true,
    );
    expect(
      records.some(
        (r) =>
          r.source_subject_id === 'C001' &&
          r.study_timepoint === 'L-44' &&
          r.indicator === 'bun_to_creatinine_ratio' &&
          r.value === null &&
          r.quality_status === 'missing_value',
      ),
    ).toBe(true);

    await saveResearchDatasetRecords(records);
    const stored = await queryResearchDatasetRecords({ source_dataset: 'OSD-575' });
    expect(stored).toHaveLength(28 * 19);

    const personalBlood = await getRecords({ category: 'blood' });
    expect(personalBlood).toHaveLength(0);
  });

  it('processes OSD-569 CBC (file labeled OSD-596) and flags ambiguous hemoglobin % unit', () => {
    const rawCsv = readWorkspaceFile(CBC_SOURCE_FILE);
    const { records, report } = processCbcDataset(rawCsv);

    expect(report.dataset).toBe('OSD-569');
    expect(report.total_source_rows).toBe(28);
    expect(records).toHaveLength(28 * 20);
    expect(report.flagged_count).toBe(28);

    const hgbRecords = records.filter((r) => r.indicator === 'hemoglobin');
    expect(hgbRecords).toHaveLength(28);
    expect(
      hgbRecords.every(
        (r) =>
          r.unit === '%' &&
          r.quality_status.includes('unit_label_requires_verification') &&
          r.provenance.source_file === CBC_SOURCE_FILE,
      ),
    ).toBe(true);
  });

  it('processes Apollo AP005 into ResearchAggregate without polluting personal cardiovascular records', async () => {
    const apolloCsv = readWorkspaceFile(APOLLO_DEFAULT_SOURCE_FILE);
    const { aggregates, report } = processApolloDataset(apolloCsv);

    expect(report.dataset).toBe('Apollo_AP005');
    expect(aggregates.length).toBeGreaterThan(100);
    expect(aggregates.every((a) => a.quality_status === 'aggregated_not_individual')).toBe(true);

    await saveResearchAggregates(aggregates);
    const stored = await queryResearchAggregates({ source_dataset: 'Apollo_AP005' });
    expect(stored).toHaveLength(aggregates.length);

    const personalCardio = await getRecords({ category: 'cardiovascular' });
    expect(personalCardio).toHaveLength(0);
  });

  it('processes UTMB Actigraphy, deduplicates identical copies, and converts dates/durations', async () => {
    const rawActigraphy = readWorkspaceFile(ACTIGRAPHY_SOURCE_FILE);
    const { researchRecords, healthRecordInputs, report } = processActigraphyDataset([
      rawActigraphy,
      rawActigraphy,
      rawActigraphy,
    ]);

    expect(report.dataset).toBe('UTMB_Campaign_1_BRSMACT');
    expect(report.total_source_rows).toBe(207 * 3);
    expect(researchRecords).toHaveLength(207 * 3);
    expect(report.deduplicated_count).toBe(207 * 3 * 2);
    expect(healthRecordInputs).toHaveLength(207 * 3);

    const firstDuration = researchRecords.find(
      (r) =>
        r.source_subject_id === 'C1G0001' &&
        r.timestamp === '2004-09-07' &&
        r.indicator === 'sleep_duration',
    );
    expect(firstDuration?.data_origin).toBe('GROUND_ANALOG');
    expect(firstDuration?.value).toBeCloseTo(7 + 44 / 60, 5);
    expect(firstDuration?.unit).toBe('hours');

    await saveResearchDatasetRecords(researchRecords);
    const storedSleepResearch = await queryResearchDatasetRecords({
      source_dataset: 'UTMB_Campaign_1_BRSMACT',
    });
    expect(storedSleepResearch).toHaveLength(207 * 3);

    const personalSleep = await getRecords({ category: 'sleep' });
    expect(personalSleep).toHaveLength(0);
  });
});
