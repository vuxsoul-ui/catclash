import { chromium, devices } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(7000);
await page.screenshot({ path: '/Users/charon/go/catbattle-arena/docs/ui-after/home-refresh-debug.png', fullPage: true });
console.log('main count', await page.locator('main').count());
console.log('body len', (await page.locator('body').innerText()).length);
await context.close();
await browser.close();
