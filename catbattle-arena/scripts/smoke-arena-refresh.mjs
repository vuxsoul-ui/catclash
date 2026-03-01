import { chromium, devices } from 'playwright';

const base = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

const out = {
  stable_after_hydration_within_3s: false,
  saw_vote_cta: false,
  saw_reload_fallback: false,
  saw_refresh_button: false,
  saw_no_active_fallback: false,
  toggled_main_rookie: false,
  notes: [],
};

try {
  await page.goto(`${base}/?fixture=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForTimeout(1800);
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  if (await continueBtn.count()) {
    await continueBtn.first().click({ timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(300);
  }

  // Start arena stability check after hydration window.
  await page.waitForTimeout(1200);
  const stableStart = Date.now();
  while (Date.now() - stableStart < 3000) {
    const voteBtn = await page.locator('button:has-text("Vote A"), button:has-text("Vote B")').count();
    const reloadFallback = await page.locator('text=Arena is reloading, text=Refilling arena...').count();
    const refreshBtn = await page.locator('button:has-text("Refresh")').count();
    const noActive = await page.locator('text=No active main arena today., text=No active rookie arena today.').count();

    if (voteBtn > 0 || reloadFallback > 0 || refreshBtn > 0 || noActive > 0) {
      out.stable_after_hydration_within_3s = true;
      out.saw_vote_cta = voteBtn > 0;
      out.saw_reload_fallback = reloadFallback > 0;
      out.saw_refresh_button = refreshBtn > 0;
      out.saw_no_active_fallback = noActive > 0;
      break;
    }
    await page.waitForTimeout(200);
  }

  await page.evaluate(() => {
    const rookie = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Rookie Arena'));
    const main = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Main Arena'));
    rookie?.click();
    main?.click();
  });
  out.toggled_main_rookie = true;
} catch (e) {
  out.notes.push(String(e));
}

console.log(JSON.stringify(out, null, 2));
await context.close();
await browser.close();
