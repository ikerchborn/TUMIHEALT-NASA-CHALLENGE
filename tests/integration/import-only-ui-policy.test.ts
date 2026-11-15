import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('measurement entry UI policy', () => {
  it('keeps health detail screens read-only and directs users to file import', () => {
    const files = [
      'src/app/pages/BloodPage.tsx',
      'src/app/pages/SleepPage.tsx',
      'src/app/pages/HeartPage.tsx',
      'src/app/pages/CategoryPage.tsx',
    ];

    for (const file of files) {
      const source = readSource(file);
      expect(source).not.toContain('<form');
      expect(source).not.toMatch(/save(Blood|Sleep|Cardiovascular)Measurement/);
    }

    expect(readSource('src/app/pages/BloodPage.tsx')).toContain('CategoryHistoryPage');
    expect(readSource('src/app/pages/SleepPage.tsx')).toContain('CategoryHistoryPage');
    expect(readSource('src/app/pages/HeartPage.tsx')).toContain('Import data');
  });

  it('directs the dashboard to import and keeps the welcome page free of the 3D model', () => {
    const dashboard = readSource('src/app/pages/DashboardPage.tsx');
    const welcome = readSource('src/app/pages/WelcomePage.tsx');

    expect(dashboard).toContain('Import data');
    expect(dashboard).not.toContain('Record a Measurement');
    expect(dashboard).not.toContain('Enter a reading manually');
    expect(welcome).not.toContain('AstronautBody3D');
  });

  it('disables import, restore, and export in demo mode and lists batch records after import', () => {
    const importPage = readSource('src/app/pages/ImportPage.tsx');
    const profilesPage = readSource('src/app/pages/ProfilesPage.tsx');

    expect(importPage).toContain('disabled={isDemoMode}');
    expect(importPage).toContain('if (isDemoMode)');
    expect(importPage).toContain('record.import_batch_id === res.batch.batch_id');
    expect(profilesPage).toContain('disabled={isDemoMode}');
    expect(profilesPage).toContain('if (isDemoMode)');
    expect(profilesPage).toContain('Backup, restore, and export are disabled in Demo Mode');
  });

  it('consolidates space risks under Health Guides and keeps research separate in Demo Mode', () => {
    const app = readSource('src/app/App.tsx');
    const guides = readSource('src/app/pages/HealthGuidesPage.tsx');
    const research = readSource('src/app/pages/ResearchPage.tsx');

    expect(app).toContain('to="/guides?tab=risks"');
    expect(app).toContain('path="hazards" element={<Navigate to="/guides?tab=risks" replace />}');
    expect(guides).toContain('SpaceHealthRisksPanel');
    expect(guides).not.toContain('Record your first reading');
    expect(guides).toContain('to="/import"');
    expect(research).toContain('Scientific research, not your personal health records.');
    expect(research).toContain('disabled={isDemoMode}');
    expect(research).toContain('if (isDemoMode)');
  });
});
