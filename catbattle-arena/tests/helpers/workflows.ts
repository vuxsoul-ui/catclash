import { expect, type Locator, type Page } from '@playwright/test';
import fsSync from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const WORKFLOW_CREDS_CACHE = path.join(process.cwd(), '.tmp', 'playwright-workflow-creds.json');

function readEnvFromDotLocal(key: string): string {
  try {
    const raw = fsSync.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const line = raw.split('\n').find((l) => l.trim().startsWith(`${key}=`));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '').trim();
  } catch {
    return '';
  }
}

function logStep(step: string, detail?: unknown) {
  // eslint-disable-next-line no-console
  console.log(`[E2E][workflow-step] ${step}`, detail ?? '');
}

type WorkflowDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  hydrationWarnings: string[];
  route404s: string[];
  stop: () => void;
};

export function startWorkflowDiagnostics(page: Page): WorkflowDiagnostics {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const hydrationWarnings: string[] = [];
  const route404s: string[] = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const isHydration =
      text.includes('Hydration failed') ||
      text.includes("didn't match") ||
      text.includes('A tree hydrated but some attributes');
    if (isHydration) {
      if (text.includes('SpotlightMatchCard') && text.includes('Results in')) return;
      hydrationWarnings.push(text);
      return;
    }
    if (text.includes('Failed to load resource')) return;
    consoleErrors.push(text);
  };

  const onPageError = (err: Error) => {
    const text = String(err?.message || err || '');
    const isHydration =
      text.includes('Hydration failed') ||
      text.includes("didn't match") ||
      text.includes('A tree hydrated but some attributes');
    if (isHydration) {
      if (text.includes('SpotlightMatchCard') && text.includes('Results in')) return;
      hydrationWarnings.push(text);
      return;
    }
    pageErrors.push(text);
  };

  const onResponse = (res: { status: () => number; url: () => string }) => {
    if (res.status() === 404) route404s.push(res.url());
  };

  page.on('console', onConsole as never);
  page.on('pageerror', onPageError as never);
  page.on('response', onResponse as never);

  return {
    consoleErrors,
    pageErrors,
    hydrationWarnings,
    route404s,
    stop: () => {
      page.off('console', onConsole as never);
      page.off('pageerror', onPageError as never);
      page.off('response', onResponse as never);
    },
  };
}

export async function assertWorkflowHealthy(page: Page, d: WorkflowDiagnostics) {
  d.stop();
  expect(d.route404s, `unexpected 404 routes: ${d.route404s.join(', ')}`).toEqual([]);
  if (d.hydrationWarnings.length) {
    logStep('workflow-hydration-warning', { count: d.hydrationWarnings.length });
  }
  expect(d.pageErrors, `page errors: ${d.pageErrors.join(' | ')}`).toEqual([]);
  expect(d.consoleErrors, `console errors: ${d.consoleErrors.join(' | ')}`).toEqual([]);
  await expect(page).not.toHaveURL(/\/404(?:\/|$|\?)/);
}

export function getSeededCreds() {
  const username = String(process.env.CATCLASH_E2E_USERNAME || readEnvFromDotLocal('CATCLASH_E2E_USERNAME') || '').trim();
  const password = String(process.env.CATCLASH_E2E_PASSWORD || readEnvFromDotLocal('CATCLASH_E2E_PASSWORD') || '').trim();
  return username && password ? { username, password } : null;
}

function getCachedWorkflowCreds() {
  try {
    const raw = fsSync.readFileSync(WORKFLOW_CREDS_CACHE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const username = String(parsed?.username || '').trim();
    const password = String(parsed?.password || '').trim();
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
}

function setCachedWorkflowCreds(creds: { username: string; password: string }) {
  try {
    fsSync.mkdirSync(path.dirname(WORKFLOW_CREDS_CACHE), { recursive: true });
    fsSync.writeFileSync(WORKFLOW_CREDS_CACHE, JSON.stringify(creds), 'utf8');
  } catch {}
}

export async function resolveWorkflowCreds(page: Page) {
  const seeded = getSeededCreds();
  if (seeded) {
    logStep('resolveWorkflowCreds:seeded', { username: seeded.username });
    return seeded;
  }
  const cached = getCachedWorkflowCreds();
  if (cached) {
    logStep('resolveWorkflowCreds:cached', { username: cached.username });
    return cached;
  }

  const fallbackCreds = {
    username: `wf_${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`,
    password: 'CatClashE2E!234',
  };
  logStep('resolveWorkflowCreds:bootstrap-register', { username: fallbackCreds.username });
  await page.request.get(`${BASE_URL}/api/me`).catch(() => null);
  const res = await page.request.post(`${BASE_URL}/api/auth/register`, {
    data: {
      username: fallbackCreds.username,
      password: fallbackCreds.password,
    },
  });
  const ok = res.status() === 200 || res.status() === 409;
  if (!ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Unable to bootstrap workflow creds (${res.status()}): ${text}`);
  }
  setCachedWorkflowCreds(fallbackCreds);
  return fallbackCreds;
}

export async function openHomepage(page: Page) {
  logStep('openHomepage', { url: `${BASE_URL}/` });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
}

export async function openTournament(page: Page, query = '?fixture=1&debug=1') {
  const url = `${BASE_URL}/tournament${query}`;
  logStep('openTournament', { url });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
}

export async function logoutIfNeeded(page: Page) {
  logStep('logoutIfNeeded');
  await page.context().clearCookies();
  await page.request.post(`${BASE_URL}/api/auth/logout`).catch(() => null);
}

export async function loginAsTestUser(page: Page, creds?: { username: string; password: string } | null) {
  const selected = creds || getSeededCreds();
  if (!selected) {
    throw new Error('Missing CATCLASH_E2E_USERNAME/CATCLASH_E2E_PASSWORD');
  }
  logStep('loginAsTestUser:start', { username: selected.username });

  const apiLogin = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: selected.username, password: selected.password },
  }).catch(() => null);
  if (apiLogin && apiLogin.status() === 200) {
    logStep('loginAsTestUser:api-success', { username: selected.username });
    await page.waitForTimeout(50);
    return;
  }

  if (!/\/login(?:\?|$)/.test(page.url())) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForLoadState('networkidle').catch(() => null);
  const signInTab = page.getByRole('button', { name: /^sign in$/i }).first();
  if (await signInTab.count()) await signInTab.click({ force: true });
  const identifierInput = page
    .locator('input[placeholder="harry"], input[name="username"], input[name="email"], input[autocomplete="username"], input[type="text"], input[type="email"]')
    .first();
  const passwordInput = page.locator('input[type="password"]').first();
  if (!await identifierInput.isVisible().catch(() => false) || !await passwordInput.isVisible().catch(() => false)) {
    logStep('loginAsTestUser:surface-fallback', { url: page.url() });
    const navLogin = page.getByTestId('nav-profile-mobile').first();
    if (await navLogin.count()) {
      await navLogin.click({ force: true });
    } else {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    }
  }
  await expect(identifierInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await identifierInput.fill(selected.username);
  await passwordInput.fill(selected.password);
  await passwordInput.blur();
  const submit = page.locator('button:has-text("Sign In"):not([disabled])').first();
  await expect(submit).toBeEnabled({ timeout: 10000 });
  await submit.click();
  let landed = false;
  try {
    await page.waitForURL((url) => {
      const p = url.pathname;
      return p === '/' || p.startsWith('/profile/');
    }, { timeout: 12000 });
    landed = true;
  } catch {}
  if (!landed) {
    const meRes = await page.request.get(`${BASE_URL}/api/me`).catch(() => null);
    const meData = meRes ? await meRes.json().catch(() => null) : null;
    const hasCredentials = Boolean(meData?.data?.has_credentials);
    if (!hasCredentials) {
      throw new Error('loginAsTestUser: sign in did not establish authenticated credentials');
    }
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  }
  logStep('loginAsTestUser:done', { landed: page.url() });
}

export async function waitForAuthGate(page: Page) {
  logStep('waitForAuthGate');
  const gate = page.getByTestId('vote-auth-gate');
  await expect(gate).toBeVisible({ timeout: 10000 });
  return gate;
}

export async function dismissAuthGate(page: Page) {
  logStep('dismissAuthGate');
  await page.getByTestId('vote-auth-gate-dismiss').click({ force: true });
  await expect(page.getByTestId('vote-auth-gate')).toBeHidden({ timeout: 10000 });
}

export async function voteFirstAvailableMatch(page: Page): Promise<Locator> {
  logStep('voteFirstAvailableMatch:find');
  const debugCandidates = [
    page.locator('button:visible', { hasText: 'Vote A (Debug)' }).first(),
    page.locator('button:visible', { hasText: 'Vote B (Debug)' }).first(),
  ];
  for (const candidate of debugCandidates) {
    if (await candidate.count()) {
      logStep('voteFirstAvailableMatch:click-debug');
      await candidate.click();
      return candidate;
    }
  }
  const candidates = [
    page.locator('[data-testid^="vote-a-"]:not([data-testid="vote-a-debug"]):visible').first(),
    page.locator('[data-testid^="vote-b-"]:not([data-testid="vote-b-debug"]):visible').first(),
    page.locator('[data-testid="vote-a"]:visible').first(),
    page.locator('[data-testid="vote-b"]:visible').first(),
  ];
  const start = Date.now();
  while (Date.now() - start < 15000) {
    for (const candidate of candidates) {
      if (await candidate.count()) {
        logStep('voteFirstAvailableMatch:click');
        await candidate.click();
        return candidate;
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error('No vote-a/vote-b target found');
}

export async function boostCurrentPick(page: Page) {
  logStep('boostCurrentPick:find');
  const boostButton = page.getByRole('button', { name: /boost|predict/i }).first();
  if (!await boostButton.count()) {
    logStep('boostCurrentPick:missing');
    return false;
  }
  await boostButton.click();
  logStep('boostCurrentPick:clicked');
  return true;
}

export async function openDailyCrate(page: Page) {
  logStep('openDailyCrate');
  await page.goto(`${BASE_URL}/crate`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expect(page.getByText(/Daily Crate/i).first()).toBeVisible({ timeout: 10000 });
}
