import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { expect, test, type Page } from '@playwright/test';

const fixturesDir = resolve(process.cwd(), 'tests', 'e2e', 'fixtures', 'import');

async function createPersonalProfile(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 10 Import QA');
  await page.getByLabel('Astronaut ID').fill('phase10-import-qa');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue with My Profile' }).click();
  await expect(page.locator('main')).toBeVisible();
  await page.goto('/import');
}

async function uploadBuffer(
  page: Page,
  name: string,
  buffer: Buffer,
  mimeType = 'text/csv',
) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
}

async function uploadFixture(page: Page, name: string) {
  await page.locator('input[type="file"]').setInputFiles(resolve(fixturesDir, name));
}

async function expectFileFailure(page: Page, content: RegExp) {
  await expect(page.getByRole('heading', { name: 'Import could not continue' })).toBeVisible();
  const pageText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(pageText).toMatch(content);
  await expect(page.getByText(/No health records were saved/)).toBeVisible();
}

async function validatePreview(page: Page) {
  await expect(page.getByRole('heading', { name: /Column Mapping/ })).toBeVisible();
  await page.getByRole('button', { name: 'Validate & Preview' }).click();
}

function xlsxBuffer(sheets: Array<{ name: string; sheet: XLSX.WorkSheet }>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const { name, sheet } of sheets) {
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

test('unsupported extension reports file location and supported upload formats', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'unsupported.txt');
  await expectFileFailure(page, /File "unsupported\.txt".*file-level.*not supported.*CSV.*XML.*XLSX/i);
});

test('zero-byte file reports the file and a non-empty upload recommendation', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadBuffer(page, 'empty.csv', Buffer.alloc(0));
  await expectFileFailure(page, /File "empty\.csv".*file-level.*empty.*non-empty/i);
});

test('file above 5 MiB is rejected before parsing', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadBuffer(page, 'oversized.csv', Buffer.alloc(5 * 1024 * 1024 + 1));
  await expectFileFailure(page, /File "oversized\.csv".*file-level.*5 MiB.*smaller/i);
});

test('invalid UTF-8 bytes identify the unreadable file and supported text formats', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadBuffer(page, 'invalid-encoding.csv', Buffer.from([0xc3, 0x28]));
  await expectFileFailure(page, /invalid-encoding\.csv.*file-level.*invalid UTF-8.*UTF-8 CSV\/XML.*XLSX/i);
});

test('alternate CSV delimiter points to the header row and requests comma-separated CSV', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'semicolon.csv');
  await expectFileFailure(page, /semicolon\.csv.*CSV header row 1.*delimiter.*comma-separated CSV/i);
});

test('malformed XML reports the parser line and asks for a corrected XML template', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'malformed.xml');
  await expectFileFailure(page, /malformed\.xml.*XML line \d+.*not well formed.*XML template/i);
});

test('external-entity XML is rejected in Chromium without making its external request', async ({ page }) => {
  await createPersonalProfile(page);
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('127.0.0.1:9999')) externalRequests.push(request.url());
  });

  await uploadFixture(page, 'xxe.xml');
  await expectFileFailure(page, /xxe\.xml.*XML line 2.*DTD and entity declarations.*XML template/i);
  expect(externalRequests).toEqual([]);
  expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'))).toBe(false);
});

test('deeply nested XML is rejected by the depth limit in Chromium', async ({ page }) => {
  await createPersonalProfile(page);
  const nested = `<TUMIMeasurements>\n  <Measurement>${'<a>'.repeat(40)}x${'</a>'.repeat(40)}</Measurement>\n</TUMIMeasurements>`;
  await uploadBuffer(page, 'nested-bomb.xml', Buffer.from(nested), 'application/xml');
  await expectFileFailure(page, /nested-bomb\.xml.*XML line 2.*nesting exceeds 32 levels.*XML template/i);
});

test('missing CSV columns identify the header and recommend a TUMI-HEALT template', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'missing-columns.csv');
  await validatePreview(page);
  await expectFileFailure(page, /missing-columns\.csv.*CSV header row 1.*missing required column mapping.*template/i);
});

test('missing XML elements identify the row and source line', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'missing-element.xml');
  await validatePreview(page);
  await expect(page.getByText(/Row 2 · XML line 2/)).toBeVisible();
  await expect(page.getByText(/Missing required XML element\(s\): <unit>/)).toBeVisible();
  await expect(page.getByText(/upload a TUMI-HEALT XML template/i)).toBeVisible();
});

test('unknown indicator identifies its row and lists supported indicators', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'unknown-indicator.csv');
  await validatePreview(page);
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/UNKNOWN_INDICATOR.*not supported/i)).toBeVisible();
  await expect(page.getByText(/Supported blood indicators:/)).toBeVisible();
  await expect(page.getByText(/upload a TUMI-HEALT CSV template/i)).toBeVisible();
});

test('unit errors identify their row and list accepted units', async ({ page }) => {
  await createPersonalProfile(page);
  await page.getByLabel('Category').selectOption('cardiovascular');
  await uploadFixture(page, 'unsupported-unit.csv');
  await validatePreview(page);
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/INCOMPATIBLE_UNIT.*Expected one of: bpm/i)).toBeVisible();
  await expect(page.locator('main')).toContainText(/Use one of these units: bpm/i);
  await expect(page.getByText(/upload a TUMI-HEALT CSV template/i)).toBeVisible();
});

test('invalid numeric value identifies its row and corrected upload format', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'invalid-value.csv');
  await validatePreview(page);
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/not a valid number/i)).toBeVisible();
  await expect(page.getByText(/upload a TUMI-HEALT CSV template/i)).toBeVisible();
});

test('invalid date identifies its row and corrected upload format', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'invalid-date.csv');
  await validatePreview(page);
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/timestamp must be a valid ISO 8601/i)).toBeVisible();
  await expect(page.getByText(/upload a TUMI-HEALT CSV template/i)).toBeVisible();
});

test('future date identifies its row and corrected upload format', async ({ page }) => {
  await createPersonalProfile(page);
  await uploadFixture(page, 'future-date.csv');
  await validatePreview(page);
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/Future measurement dates are not accepted/i)).toBeVisible();
  await expect(page.getByText(/upload a TUMI-HEALT CSV template/i)).toBeVisible();
});

test('duplicate import identifies the file and directs the user to history', async ({ page }) => {
  await createPersonalProfile(page);
  const content = readFileSync(resolve(fixturesDir, 'duplicate.csv'));
  await uploadBuffer(page, 'duplicate.csv', content);
  await validatePreview(page);
  await page.getByRole('button', { name: 'Confirm import of 1 rows' }).click();
  await expect(page.getByRole('heading', { name: /Imported measurements/ })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles([]);
  await uploadBuffer(page, 'duplicate.csv', content);
  await validatePreview(page);
  await expectFileFailure(page, /duplicate\.csv.*file-level.*Duplicate import blocked.*different file or review.*History/i);
});

test('XLSX workbook without a data sheet reports the workbook location and alternative', async ({ page }) => {
  await createPersonalProfile(page);
  const buffer = xlsxBuffer([{ name: 'Empty', sheet: XLSX.utils.aoa_to_sheet([]) }]);
  await uploadBuffer(page, 'empty-workbook.xlsx', buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await expectFileFailure(page, /empty-workbook\.xlsx.*workbook.*0 readable data sheets.*CSV\/XML template/i);
});

test('XLSX merged cells report worksheet range and remediation', async ({ page }) => {
  await createPersonalProfile(page);
  const sheet = XLSX.utils.aoa_to_sheet([
    ['timestamp', 'indicator', 'value', 'unit'],
    ['2026-10-10T08:00:00Z', 'glucose', 95, 'mg/dL'],
  ]);
  sheet['!merges'] = [XLSX.utils.decode_range('A1:B1')];
  await uploadBuffer(
    page,
    'merged-cells.xlsx',
    xlsxBuffer([{ name: 'Measurements', sheet }]),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  await expectFileFailure(page, /merged-cells\.xlsx.*worksheet "Measurements" range A1:B1.*merged cell.*Unmerge/i);
});

test('XLSX formula without a cached value reports worksheet cell and remediation', async ({ page }) => {
  await createPersonalProfile(page);
  const sheet: XLSX.WorkSheet = {
    A1: { t: 's', v: 'timestamp' },
    B1: { t: 's', v: 'indicator' },
    C1: { t: 's', v: 'value' },
    D1: { t: 's', v: 'unit' },
    A2: { t: 's', v: '2026-10-10T08:00:00Z' },
    B2: { t: 's', v: 'glucose' },
    C2: { t: 'n', f: '90+5' },
    D2: { t: 's', v: 'mg/dL' },
    '!ref': 'A1:D2',
  };
  await uploadBuffer(
    page,
    'formula-no-cache.xlsx',
    xlsxBuffer([{ name: 'Measurements', sheet }]),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  await expectFileFailure(page, /formula-no-cache\.xlsx.*worksheet "Measurements" range C2.*formula.*calculated values/i);
});

test('hostile XML element names are rejected in Chromium without changing Object.prototype', async ({ page }) => {
  await createPersonalProfile(page);
  for (const name of ['__proto__', 'constructor', 'prototype']) {
    const xml = `<TUMIMeasurements>\n  <Measurement>\n    <${name}>x</${name}>\n  </Measurement>\n</TUMIMeasurements>`;
    await uploadBuffer(page, `hostile-${name}.xml`, Buffer.from(xml), 'application/xml');
    await expectFileFailure(page, new RegExp(`hostile-${name}\\.xml.*XML line 3.*Unsupported XML element.*${name}.*XML template`, 'i'));
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'))).toBe(false);
    await page.locator('input[type="file"]').setInputFiles([]);
  }
});

test('hostile CSV headers are rejected in Chromium without changing Object.prototype', async ({ page }) => {
  await createPersonalProfile(page);
  for (const name of ['__proto__', 'constructor', 'prototype']) {
    const csv = `${name},timestamp,indicator,value,unit\nx,2026-10-10T08:00:00Z,glucose,95,mg/dL`;
    await uploadBuffer(page, `hostile-${name}.csv`, Buffer.from(csv));
    await expectFileFailure(page, new RegExp(`hostile-${name}\\.csv.*CSV header row 1.*${name}.*template`, 'i'));
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'))).toBe(false);
    await page.locator('input[type="file"]').setInputFiles([]);
  }
});

test('hostile XLSX headers are rejected in Chromium without changing Object.prototype', async ({ page }) => {
  await createPersonalProfile(page);
  for (const name of ['__proto__', 'constructor', 'prototype']) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [name, 'timestamp', 'indicator', 'value', 'unit'],
      ['x', '2026-10-10T08:00:00Z', 'glucose', 95, 'mg/dL'],
    ]);
    await uploadBuffer(
      page,
      `hostile-${name}.xlsx`,
      xlsxBuffer([{ name: 'Measurements', sheet }]),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    await expectFileFailure(page, new RegExp(`hostile-${name}\\.xlsx.*CSV header row 1.*${name}.*template`, 'i'));
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'))).toBe(false);
    await page.locator('input[type="file"]').setInputFiles([]);
  }
});

test('CSV, XML, and XLSX templates downloaded from the app complete the browser import flow', async ({ page }) => {
  await createPersonalProfile(page);

  for (const format of ['CSV', 'XML', 'XLSX'] as const) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format} template`, exact: true }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    if (!downloadedPath) throw new Error(`The ${format} template download has no local path.`);
    const buffer = readFileSync(downloadedPath);
    await uploadBuffer(
      page,
      download.suggestedFilename(),
      buffer,
      format === 'XML'
        ? 'application/xml'
        : format === 'XLSX'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
    );
    await validatePreview(page);
    await expect(page.getByText('Valid: 1')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm import of 1 rows' }).click();
    await expect(page.getByRole('heading', { name: /Imported measurements \(1\)/ })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles([]);
  }
});
