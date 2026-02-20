import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const base = 'http://127.0.0.1:3000';
const outDir = '/Users/charon/go/catbattle-arena/docs/ui-baseline';
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { slug: 'home', path: '/' },
  { slug: 'duel-arena', path: '/duel' },
  { slug: 'duel-detail', path: '/duel/1' },
  { slug: 'shop', path: '/shop' },
  { slug: 'crate', path: '/crate' },
  { slug: 'whisker', path: '/arena' },
  { slug: 'social-referrals', path: '/social' },
];

const browser = await chromium.launch({ headless: true });
for (const target of targets) {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(15000);
  const url = `${base}${target.path}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  } catch {
    // continue and capture current render
  }
  await page.screenshot({ path: `${outDir}/${target.slug}.png`, fullPage: true });
  await context.close();
  console.log(`captured ${target.slug}`);
}
await browser.close();
