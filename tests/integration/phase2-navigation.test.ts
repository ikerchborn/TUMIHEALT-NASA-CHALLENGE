import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('phase 2 information architecture', () => {
  it('provides the five primary destinations and persistent import action', () => {
    const layout = readSource('src/app/layout/AppLayout.tsx');
    const app = readSource('src/app/App.tsx');

    for (const label of [
      'Mission Home',
      'Daily Check-in',
      'My Measurements',
      'My Health Trends',
      'Body Explorer',
    ]) {
      expect(layout).toContain(`label: '${label}'`);
    }

    expect(layout).toContain('aria-label="Primary mobile navigation"');
    expect(layout).toContain('aria-label="Secondary navigation"');
    expect(layout).toContain('+ Import data');
    expect(layout).toContain('to="/import"');
    for (const path of ['check-in', 'trends', 'body', 'assistant']) {
      expect(app).toContain(`path="${path}"`);
    }
  });

  it('defines reusable visual tokens and shared design system components', () => {
    const styles = readSource('src/index.css');
    const components = readSource('src/app/components/ui.tsx');

    for (const token of ['--color-mission-canvas', '--spacing-section', '--radius-panel', '--text-body', '--shadow-panel']) {
      expect(styles).toContain(token);
    }
    for (const component of ['StatTile', 'StatusBadge', 'RangeTabs', 'ChartPanel', 'Drawer', 'DemoBanner']) {
      expect(components).toContain(`function ${component}`);
    }
  });
});
