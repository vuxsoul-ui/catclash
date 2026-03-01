import { chromium, devices } from 'playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(7000);
console.log((await page.locator('body').innerText()).slice(0, 2200));
await browser.close();
