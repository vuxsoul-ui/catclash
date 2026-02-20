import { chromium, devices } from 'playwright';

const base = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

const report = {
  voted: 0,
  duelOpened: false,
  shopPreviewOpened: false,
  errors: [],
};

try {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  for (let i = 0; i < 3; i += 1) {
    const voteButtons = page.getByRole('button', { name: /Vote/i }).first();
    const has = await voteButtons.count();
    if (!has) break;
    await voteButtons.click({ timeout: 5000 });
    report.voted += 1;
    await page.waitForTimeout(700);
  }

  await page.goto(`${base}/duel`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  const duelRow = page.locator('button:has-text("Vote"), button:has-text("View")').first();
  if (await duelRow.count()) {
    await duelRow.click({ timeout: 5000 });
  }
  report.duelOpened = true;

  await page.goto(`${base}/shop`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1400);
  const preview = page.getByRole('button', { name: /Preview/i }).first();
  if (await preview.count()) {
    await preview.click({ timeout: 5000 });
    report.shopPreviewOpened = true;
  }
} catch (e) {
  report.errors.push(String(e));
}

console.log(JSON.stringify(report, null, 2));
await context.close();
await browser.close();
