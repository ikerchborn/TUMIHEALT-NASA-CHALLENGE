import { expect, test, type Page } from '@playwright/test';

async function createPersonalProfile(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 11 Offline');
  await page.getByLabel('Astronaut ID').fill('phase11-offline');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue with My Profile' }).click();
  await expect(page.locator('main')).toBeVisible();
}

test('local workflows stay usable offline after the app routes have loaded', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(request.url());
    }
  });
  await createPersonalProfile(page);

  const routes = [
    { link: 'Daily Check-in', title: 'How are you today?' },
    { link: 'My Measurements', title: 'My Measurements' },
    { link: 'My Health Trends', title: 'My Health Trends' },
    { link: 'Body Explorer', title: 'Body Explorer' },
    { link: 'Health Assistant', title: 'Health Assistant' },
    { link: 'Mission & Privacy', title: 'My Mission & Privacy' },
    { link: 'Health Guides', title: 'Health Guides' },
    { link: 'NASA Research', title: 'Explore NASA Research' },
  ];
  for (const route of routes) {
    await page.getByRole('link', { name: route.link, exact: true }).click();
    await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible();
  }

  await page.context().setOffline(true);
  await page.getByRole('link', { name: 'Daily Check-in', exact: true }).click();
  await page.getByLabel('A bit tired').check();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(
    page.getByText('Your daily self-report is saved on this device. You can edit it again today.'),
  ).toBeVisible();

  await page.getByRole('link', { name: 'My Measurements', exact: true }).click();
  const timestamp = new Date(Date.now() - 60_000).toISOString();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'phase11-offline.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`timestamp,indicator,value,unit\n${timestamp},glucose,95,mg/dL\n`),
  });
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
  await expect(page.getByText('Valid: 1')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import of 1 rows' }).click();
  await expect(page.getByRole('heading', { name: '5 · Imported measurements (1)' })).toBeVisible();

  await page.getByRole('link', { name: 'My Health Trends', exact: true }).click();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  await page.getByRole('link', { name: 'Body Explorer', exact: true }).click();
  await page.getByRole('list', { name: 'Keyboard-accessible body regions' })
    .getByRole('button', { name: /Heart & Circulatory System|Chest/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Heart & Circulatory System' })).toBeVisible();

  await page.getByRole('link', { name: 'Health Assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Health Assistant' })).toBeVisible();
  await page.getByRole('button', { name: 'Request medical review' }).first().click();
  await expect(page.getByRole('heading', { name: 'Request medical review' })).toBeVisible();
  await expect(page.getByText(/Your request is saved locally/)).toBeVisible();

  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Mission & Privacy', exact: true }).click();
  await page.getByRole('button', { name: 'Explore Demo Data' }).click();
  await expect(page.getByRole('button', { name: 'Exit Demo' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Exit Demo' }).first().click();
  await expect(page.getByRole('button', { name: 'Exit Demo' })).toHaveCount(0);

  expect(externalRequests).toEqual([]);
});
