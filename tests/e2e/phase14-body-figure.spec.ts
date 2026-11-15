import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 14 QA');
  await page.getByLabel('Astronaut ID').fill('phase14-qa');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Explore Demo' }).click();
  await expect(page.getByRole('button', { name: 'Exit Demo' }).first()).toBeVisible();
}

async function createPersonalProfile(page: Page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Name').fill('Phase 14 Personal QA');
  await page.getByLabel('Astronaut ID').fill('phase14-personal-qa');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue with My Profile' }).click();
  await expect(page.locator('main')).toBeVisible();
}

const systems = [
  { id: 'sleep', title: 'Brain, Sleep & Circadian Health', name: 'sleep' },
  { id: 'cardiovascular', title: 'Heart & Circulatory System', name: 'heart' },
  { id: 'blood', title: 'Blood & Immune Context', name: 'blood' },
  { id: 'bones_muscles', title: 'Bones & Muscles', name: 'bones-muscles' },
];

const screenshotsDir = resolve(process.cwd(), 'docs', 'screenshots');

async function captureFigure(page: Page, path: string, width: number) {
  if (width < 640) {
    await page.locator('.body-figure-svg').screenshot({
      path,
      animations: 'disabled',
    });
    return;
  }
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
    style: 'header { position: static !important; }',
  });
}

test('default figure reads as a person at 375, 768, and 1440 pixels', async ({ page }) => {
  await enterDemo(page);
  mkdirSync(screenshotsDir, { recursive: true });

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 1400 : 900 });
    await page.goto('/body');
    const figure = page.locator('.body-figure-svg');
    await expect(figure).toBeVisible();
    await expect(figure).not.toHaveAttribute('data-selected');
    await expect(page.getByText('Dots are body areas you can select.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select a body system' })).toBeVisible();
    const firstStatus = page.locator(
      width < 640 ? '.body-figure-mobile-status' : '.body-figure-label .sub',
    ).first();
    await expect.poll(() => firstStatus.textContent()).not.toBe('Loading…');

    if (width < 640) {
      await expect(page.locator('.body-figure-mobile-label')).toHaveCount(4);
      await expect(page.locator('.body-figure-labels')).toBeHidden();
      const figureBounds = await figure.boundingBox();
      const chipBounds = await page.locator('.body-figure-mobile-label').evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        }),
      );
      expect(figureBounds).not.toBeNull();
      for (let first = 0; first < chipBounds.length; first += 1) {
        expect(chipBounds[first].top).toBeGreaterThanOrEqual(
          figureBounds!.y + figureBounds!.height,
        );
        for (let second = first + 1; second < chipBounds.length; second += 1) {
          const overlaps =
            chipBounds[first].left < chipBounds[second].right &&
            chipBounds[first].right > chipBounds[second].left &&
            chipBounds[first].top < chipBounds[second].bottom &&
            chipBounds[first].bottom > chipBounds[second].top;
          expect(overlaps, `mobile labels ${first} and ${second} overlap`).toBe(false);
        }
      }
      await page.locator('.body-figure-mobile-labels').screenshot({
        path: resolve(screenshotsDir, 'body-labels-375.png'),
        animations: 'disabled',
        style: 'nav[aria-label="Primary mobile navigation"] { display: none !important; }',
      });
    } else {
      const labels = page.locator('.body-figure-label');
      await expect(labels).toHaveCount(4);
      const bounds = await labels.locator('rect').evaluateAll((rects) =>
        rects.map((rect) => {
          const box = rect.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        }),
      );
      for (let first = 0; first < bounds.length; first += 1) {
        for (let second = first + 1; second < bounds.length; second += 1) {
          const overlaps =
            bounds[first].left < bounds[second].right &&
            bounds[first].right > bounds[second].left &&
            bounds[first].top < bounds[second].bottom &&
            bounds[first].bottom > bounds[second].top;
          expect(overlaps, `labels ${first} and ${second} overlap at ${width}px`).toBe(false);
        }
      }

      const bodyBounds = await figure.locator('path[fill="url(#skin)"]').boundingBox();
      expect(bodyBounds).not.toBeNull();
      for (const label of bounds) {
        const overlapsBody =
          label.left < bodyBounds!.x + bodyBounds!.width &&
          label.right > bodyBounds!.x &&
          label.top < bodyBounds!.y + bodyBounds!.height &&
          label.bottom > bodyBounds!.y;
        expect(overlapsBody, `label overlaps the figure at ${width}px`).toBe(false);
      }
    }

    await captureFigure(page, resolve(screenshotsDir, `body-default-${width}.png`), width);
  }
});

test('each system highlights its layer at desktop and mobile widths', async ({ page }) => {
  await enterDemo(page);
  mkdirSync(screenshotsDir, { recursive: true });

  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width < 640 ? 1400 : 900 });
    for (const system of systems) {
      await page.goto('/body');
      const figure = page.locator('.body-figure-svg');
      await page.locator(`.body-figure-hotspot[data-system="${system.id}"]`).click();

      await expect(figure).toHaveAttribute('data-selected', system.id);
      await expect(page.getByRole('heading', { name: system.title })).toBeVisible();
      await expect(
        page.locator(`.body-figure-leaders [data-system="${system.id}"]`),
      ).toHaveClass(/is-selected/);
      await expect(
        page.locator(`.body-figure-label[data-system="${system.id}"]`),
      ).toHaveAttribute('aria-pressed', 'true');

      const highlightedLayerId =
        system.id === 'cardiovascular'
          ? 'heart'
          : system.id === 'bones_muscles'
            ? 'musculo'
            : system.id;
      await expect
        .poll(() =>
          figure.locator(`#L-${highlightedLayerId}`).evaluate(
            (layer) => Number(getComputedStyle(layer).opacity),
          ),
        )
        .toBe(1);

      for (const other of systems.filter(({ id }) => id !== system.id)) {
        const layerId =
          other.id === 'cardiovascular'
            ? 'heart'
            : other.id === 'bones_muscles'
              ? 'musculo'
              : other.id;
        const opacity = await figure.locator(`#L-${layerId}`).evaluate(
          (layer) => getComputedStyle(layer).opacity,
        );
        expect(Number(opacity)).toBeLessThan(0.2);
      }

      if (width < 640) {
        await expect(
          page.locator(`.body-figure-mobile-label[data-system="${system.id}"]`),
        ).toHaveAttribute('aria-pressed', 'true');
      }

      await captureFigure(
        page,
        resolve(screenshotsDir, `body-${system.name}-${width}.png`),
        width,
      );
    }
  }
});

test('empty profiles show service-backed statuses and controls work with keyboard', async ({ page }) => {
  await createPersonalProfile(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/body');

  await expect(page.locator('.body-figure-label[data-system="sleep"]')).toContainText('No data yet');
  await expect(page.locator('.body-figure-label[data-system="cardiovascular"]')).toContainText('No data yet');
  await expect(page.locator('.body-figure-label[data-system="blood"]')).toContainText('No data yet');
  await expect(page.locator('.body-figure-label[data-system="bones_muscles"]')).toContainText('Educational');

  const controls = page.locator('.body-figure-hotspot, .body-figure-label');
  await expect(controls).toHaveCount(8);
  await controls.first().focus();
  await expect(controls.first()).toBeFocused();
  for (let index = 1; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    await expect(controls.nth(index)).toBeFocused();
  }

  await page.locator('.body-figure-hotspot[data-system="sleep"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.body-figure-svg')).toHaveAttribute('data-selected', 'sleep');
  await expect(page.getByRole('heading', { name: 'Brain, Sleep & Circadian Health' })).toBeVisible();

  await page.locator('.body-figure-label[data-system="blood"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.body-figure-svg')).toHaveAttribute('data-selected', 'blood');
  await expect(page.getByRole('heading', { name: 'Blood & Immune Context' })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 900 });
  const mobileButtons = page.locator('.body-figure-mobile-label');
  await expect(mobileButtons).toHaveCount(4);
  for (const button of await mobileButtons.all()) {
    const dimensions = await button.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const status = element.querySelector('.body-figure-mobile-status');
      return {
        height: box.height,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        statusFontSize: status ? Number.parseFloat(getComputedStyle(status).fontSize) : 0,
      };
    });
    expect(dimensions.height).toBeGreaterThanOrEqual(44);
    expect(dimensions.fontSize).toBeGreaterThanOrEqual(14);
    expect(dimensions.statusFontSize).toBeGreaterThanOrEqual(14);
  }
  for (const target of await page.locator('.body-figure-hotspot .hit-area').all()) {
    const box = await target.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator('.body-figure-mobile-label').filter({ hasText: 'Heart' }).press('Space');
  await expect(page.locator('.body-figure-svg')).toHaveAttribute('data-selected', 'cardiovascular');
  await expect(page.getByRole('heading', { name: 'Heart & Circulatory System' })).toBeVisible();
});

test('Welcome is non-interactive and body and welcome have no serious or critical axe findings', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Get Started' })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Stylized anatomical illustration' })).toBeVisible();
  await expect(page.locator('.body-figure-hotspot, .body-figure-label')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);

  mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotsDir, 'body-welcome-1440.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await enterDemo(page);
  await page.goto('/body');
  for (const route of ['/body', '/welcome']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const seriousOrCritical = results.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    );
    expect(seriousOrCritical, `${route}: ${JSON.stringify(seriousOrCritical)}`).toEqual([]);
  }

  expect(errors).toEqual([]);
});

test('reduced motion disables the hotspot pulse and layer transitions', async ({ page }) => {
  await enterDemo(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/body');

  await expect
    .poll(() =>
      page.locator('.body-figure-hotspot .ring').first().evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    )
    .toBe('none');
  await expect
    .poll(() =>
      page.locator('#L-heart').evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    )
    .toBe('0s');
});
