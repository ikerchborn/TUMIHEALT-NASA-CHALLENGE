import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { launch as launchChrome } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(
  process.execPath,
  [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/welcome`);
      if (response.ok) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Preview server did not become ready at ${origin}`);
}

try {
  await waitForServer();
  const chrome = await launchChrome({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const result = await lighthouse(`${origin}/welcome`, {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['accessibility'],
      port: chrome.port,
    });
    if (!result) throw new Error('Lighthouse returned no report');

    const category = result.lhr.categories.accessibility;
    console.log(`Lighthouse accessibility score (/welcome): ${Math.round((category.score ?? 0) * 100)}/100`);
    for (const auditRef of category.auditRefs) {
      const audit = result.lhr.audits[auditRef.id];
      if (audit.score !== 1 && audit.score !== null) {
        console.log(`${audit.scoreDisplayMode === 'numeric' ? audit.score : audit.scoreDisplayMode} | ${audit.title}: ${audit.displayValue ?? audit.description}`);
      }
    }
  } finally {
    await chrome.kill();
  }
} finally {
  server.kill();
}
