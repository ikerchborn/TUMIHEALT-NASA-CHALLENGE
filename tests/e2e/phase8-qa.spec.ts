import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 8 QA');
  await page.getByLabel('Astronaut ID').fill('phase8-qa');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Explore Demo' }).click();
  await expect(page.getByRole('button', { name: 'Exit Demo' }).first()).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
}

async function createPersonalProfile(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 8 Personal QA');
  await page.getByLabel('Astronaut ID').fill('phase8-personal-qa');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue with My Profile' }).click();
  await expect(page.locator('main')).toBeVisible();
}

test('smoke: profile, demo, every menu item, import access, and demo exit', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await enterDemo(page);

  const menuItems = [
    { name: 'Mission Home', route: '/' },
    { name: 'Daily Check-in', route: '/check-in' },
    { name: 'My Measurements', route: '/import' },
    { name: 'My Health Trends', route: '/trends' },
    { name: 'Body Explorer', route: '/body' },
    { name: 'Health Assistant', route: '/assistant' },
    { name: 'Health Guides', route: '/guides' },
    { name: 'Space Health Risks', route: '/guides?tab=risks' },
    { name: 'NASA Research', route: '/research' },
    { name: 'Mission & Privacy', route: '/profiles' },
  ];

  for (const item of menuItems) {
    await page.getByRole('link', { name: item.name, exact: true }).first().click();
    await expect(page).toHaveURL(`http://127.0.0.1:4173${item.route}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Import data/ }).first()).toBeVisible();

    if (item.route !== '/import') {
      await page.getByRole('link', { name: /Import data/ }).first().click();
      await expect(page).toHaveURL('http://127.0.0.1:4173/import');
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.goto(item.route);
      await expect(page).toHaveURL(`http://127.0.0.1:4173${item.route}`);
    }
  }

  for (const route of ['/welcome', '/blood', '/sleep', '/cardiovascular', '/hazards']) {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    if (route === '/hazards') {
      await expect(page).toHaveURL('http://127.0.0.1:4173/guides?tab=risks');
    }
  }

  await page.getByRole('button', { name: 'Exit Demo' }).first().click();
  await expect(page.getByRole('button', { name: 'Exit Demo' })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('demo mode disables personal and research file imports and profile backup actions', async ({ page }) => {
  await enterDemo(page);

  await page.goto('/import');
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await expect(page.getByText(/Personal data import is disabled in Demo Mode/)).toBeVisible();

  await page.goto('/research');
  await expect(page.getByLabel(/Source File/)).toBeDisabled();
  await expect(page.getByText(/Research file import is disabled in Demo Mode/)).toBeVisible();

  await page.goto('/profiles');
  await expect(page.getByRole('button', { name: 'Export JSON Backup' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export Personal CSV' })).toBeDisabled();
  await expect(page.getByLabel(/Restore JSON Backup/)).toBeDisabled();
  await expect(page.getByText(/Backup, restore, and export are disabled in Demo Mode/)).toBeVisible();
});

test('daily check-in saves in three actions and edits the same daily entry', async ({ page }) => {
  await createPersonalProfile(page);
  await page.goto('/check-in');

  await page.getByLabel('A bit tired').check();
  await page.getByRole('button', { name: 'Dizziness' }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Your daily self-report is saved on this device. You can edit it again today.')).toBeVisible();
  await expect(page.getByText(/Self-reported · Saved today/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  await page.getByLabel('Very fatigued').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Very fatigued · Energy 3 of 5/)).toBeVisible();
  await expect(page.getByText(/Self-reported · Edited today/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today’s check-in' })).toHaveCount(1);
});

test('personal CSV import displays the records from the confirmed batch', async ({ page }) => {
  await createPersonalProfile(page);
  await page.goto('/import');
  const timestamp = new Date(Date.now() - 60_000).toISOString();
  const csv = `timestamp,indicator,value,unit\n${timestamp},glucose,95,mg/dL\n`;

  await page.locator('input[type="file"]').setInputFiles({
    name: 'phase8-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByRole('heading', { name: /Column Mapping/ })).toBeVisible();
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByText('Valid: 1')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import of 1 rows' }).click();

  await expect(page.getByRole('heading', { name: '5 · Imported measurements (1)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'glucose' })).toBeVisible();
  await expect(page.getByText('95 mg/dL')).toBeVisible();
});

test('Body Explorer selection updates each region and shows available or educational data', async ({ page }) => {
  await enterDemo(page);
  await page.goto('/body');
  const regions = page.getByRole('list', { name: 'Keyboard-accessible body regions' }).getByRole('button');
  const cases = [
    { index: 0, heading: 'Brain, Sleep & Circadian Health' },
    { index: 1, heading: 'Heart & Circulatory System' },
    { index: 2, heading: 'Blood & Immune Context' },
    { index: 3, heading: 'Bones & Muscles' },
  ];

  for (const region of cases) {
    const button = regions.nth(region.index);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: region.heading })).toBeVisible();
  }
  await expect(page.getByText('Educational information — not currently monitored.')).toBeVisible();
});

test('axe accessibility: no critical or serious WCAG violations on app routes', async ({ page }) => {
  await enterDemo(page);
  const routes = [
    '/welcome',
    '/',
    '/check-in',
    '/blood',
    '/sleep',
    '/cardiovascular',
    '/import',
    '/trends',
    '/body',
    '/assistant',
    '/guides',
    '/guides?tab=risks',
    '/hazards',
    '/research',
    '/profiles',
  ];
  const findings: Array<{
    route: string;
    id: string;
    impact: string;
    description: string;
    nodes: Array<{ target: string; failureSummary: string }>;
  }> = [];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    findings.push(
      ...results.violations
        .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
        .map((violation) => ({
          route,
          id: violation.id,
          impact: violation.impact ?? 'unknown',
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: JSON.stringify(node.target),
            failureSummary: node.failureSummary ?? '',
          })),
        })),
    );
  }

  expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
});

test('required viewport screenshots: Home, Check-in, Trends, Body Explorer, Assistant', async ({ page }) => {
  await enterDemo(page);
  const screenshotsDir = resolve(process.cwd(), 'docs', 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });

  const screens = [
    { name: 'home', route: '/' },
    { name: 'check-in', route: '/check-in' },
    { name: 'trends', route: '/trends' },
    { name: 'body-explorer', route: '/body' },
    { name: 'assistant', route: '/assistant' },
  ];

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of screens) {
      await page.goto(screen.route);
      await expect(page.locator('main h1').first()).toBeVisible();
      if (screen.name === 'trends') {
        await expect(page.locator('.recharts-surface').first()).toBeVisible();
      }
      await page.screenshot({
        path: resolve(screenshotsDir, `${screen.name}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});
