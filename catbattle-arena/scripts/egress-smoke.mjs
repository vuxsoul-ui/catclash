import { chromium } from "playwright";

const targetUrl = process.env.EGRESS_URL || "http://localhost:3000";
const idleMs = Number(process.env.EGRESS_IDLE_MS || 60_000);
const scrollSteps = Number(process.env.EGRESS_SCROLL_STEPS || 12);
const storageNeedle = "/storage/v1/object/public/cat-images/";

const stats = {
  totalRequests: 0,
  totalBytes: 0,
  storageRequests: 0,
  storageBytes: 0,
  storageImageRequests: 0,
  storageImageBytes: 0,
};

function headerBytes(response) {
  const h = response.headers();
  const len = Number(h["content-length"] || 0);
  return Number.isFinite(len) && len > 0 ? len : 0;
}

async function estimateBytes(response) {
  const fromHeader = headerBytes(response);
  if (fromHeader > 0) return fromHeader;
  try {
    const body = await response.body();
    return Number(body?.byteLength || 0);
  } catch {
    return 0;
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", async (response) => {
  const url = response.url();
  const status = response.status();
  if (status < 200 || status >= 400) return;
  const bytes = await estimateBytes(response);
  stats.totalRequests += 1;
  stats.totalBytes += bytes;

  if (url.includes(storageNeedle)) {
    stats.storageRequests += 1;
    stats.storageBytes += bytes;
    const ct = (response.headers()["content-type"] || "").toLowerCase();
    if (ct.startsWith("image/")) {
      stats.storageImageRequests += 1;
      stats.storageImageBytes += bytes;
    }
  }
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(2500);

for (let i = 0; i < scrollSteps; i += 1) {
  await page.evaluate(() => window.scrollBy(0, Math.max(300, Math.floor(window.innerHeight * 0.7))));
  await page.waitForTimeout(700);
}

await page.waitForTimeout(idleMs);

await browser.close();

const avgStorageImageBytes = stats.storageImageRequests > 0
  ? Math.round(stats.storageImageBytes / stats.storageImageRequests)
  : 0;

const summary = {
  targetUrl,
  idleMs,
  scrollSteps,
  totalRequests: stats.totalRequests,
  totalBytes: stats.totalBytes,
  storageRequests: stats.storageRequests,
  storageBytes: stats.storageBytes,
  storageImageRequests: stats.storageImageRequests,
  averageStorageImageBytes: avgStorageImageBytes,
};

console.log("Egress smoke summary:");
console.log(JSON.stringify(summary, null, 2));

