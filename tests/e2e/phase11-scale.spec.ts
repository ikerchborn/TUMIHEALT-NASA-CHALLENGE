import { expect, test } from '@playwright/test';

test('measures Trends rendering and Assistant computation with 5,000 records and 365 check-ins', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 11 Scale');
  await page.getByLabel('Astronaut ID').fill('phase11-scale');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue with My Profile' }).click();

  await page.evaluate(async () => {
    const request = indexedDB.open('tumi_healt_local_db');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['blood_records', 'sleep_records', 'cardiovascular_records', 'daily_checkins'],
      'readwrite',
    );
    const categories = [
      {
        store: transaction.objectStore('blood_records'),
        category: 'blood',
        indicator: 'glucose',
        unit: 'mg/dL',
      },
      {
        store: transaction.objectStore('sleep_records'),
        category: 'sleep',
        indicator: 'sleep_duration',
        unit: 'hours',
      },
      {
        store: transaction.objectStore('cardiovascular_records'),
        category: 'cardiovascular',
        indicator: 'heart_rate',
        unit: 'bpm',
      },
    ];
    const now = Date.now();
    for (let index = 0; index < 5_000; index += 1) {
      const { store, category, indicator, unit } = categories[index % categories.length];
      const timestamp = new Date(now - (5_000 - index) * 5 * 60_000).toISOString();
      store.put({
        id: `scale-record-${index}`,
        astronaut_id: 'phase11-scale',
        category,
        timestamp,
        indicator,
        value: 60 + (index % 40),
        unit,
        data_origin: 'SYNTHETIC',
        ingestion_method: 'MANUAL',
        source_dataset: 'phase11-scale-fixture',
        quality_status: 'verified',
        ...(category === 'sleep'
          ? { sleep_duration: 7, sleep_efficiency: 90 }
          : {}),
        ...(category === 'cardiovascular'
          ? { heart_rate: 70, activity_context: 'resting', sleep_state: 'awake' }
          : {}),
      });
    }
    for (let index = 0; index < 365; index += 1) {
      const date = new Date(now - index * 86_400_000).toISOString().slice(0, 10);
      transaction.objectStore('daily_checkins').put({
        id: `scale-checkin-${index}`,
        profile_id: 'phase11-scale',
        checkin_date: date,
        mood: 'good',
        energy_level: 4,
        symptoms: [],
        data_origin: 'SELF_REPORTED',
        source: 'phase11-scale-fixture',
        created_at: `${date}T12:00:00.000Z`,
        updated_at: `${date}T12:00:00.000Z`,
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });

  await page.getByRole('link', { name: 'My Health Trends', exact: true }).click();
  await expect(page.getByText('Loading personal trend data…')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'Mission Home', exact: true }).click();
  await expect(page.locator('main h1').first()).toBeVisible();
  const trendsStarted = Date.now();
  await page.getByRole('link', { name: 'My Health Trends', exact: true }).click();
  await expect(page.getByText('Loading personal trend data…')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 30_000 });
  const trendsMs = Date.now() - trendsStarted;

  await page.getByRole('link', { name: 'Mission Home', exact: true }).click();
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.getByRole('link', { name: 'Health Assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What changed since my last record?' })).toBeVisible();
  await page.getByRole('link', { name: 'Mission Home', exact: true }).click();
  await expect(page.locator('main h1').first()).toBeVisible();
  const assistantStarted = Date.now();
  await page.getByRole('link', { name: 'Health Assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What changed since my last record?' })).toBeVisible();
  const assistantMs = Date.now() - assistantStarted;

  test.info().annotations.push({
    type: 'scale',
    description: `5,000 records + 365 check-ins: Trends ${trendsMs} ms; Assistant ${assistantMs} ms`,
  });
  console.log(
    `Phase 11 scale: 5,000 records + 365 check-ins; Trends ${trendsMs} ms; Assistant ${assistantMs} ms`,
  );
  expect(pageErrors).toEqual([]);
  expect(trendsMs).toBeLessThan(1_000);
  expect(assistantMs).toBeLessThan(1_000);
});
