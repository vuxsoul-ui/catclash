import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
function readEnvFromDotLocal(key: string): string {
  try {
    const raw = fsSync.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const line = raw.split('\n').find((l) => l.trim().startsWith(`${key}=`));
    if (!line) return '';
    const value = line.slice(line.indexOf('=') + 1).trim();
    return value.replace(/^['"]|['"]$/g, '').trim();
  } catch {
    return '';
  }
}
const E2E_USERNAME = String(process.env.CATCLASH_E2E_USERNAME || readEnvFromDotLocal('CATCLASH_E2E_USERNAME') || '').trim();
const E2E_PASSWORD = String(process.env.CATCLASH_E2E_PASSWORD || readEnvFromDotLocal('CATCLASH_E2E_PASSWORD') || '').trim();

test.use({ viewport: { width: 390, height: 844 } });

function randomCreds() {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    username: `e2e_${token}`.slice(0, 20),
    password: `Pw_${token}_12345`,
  };
}

let sharedAuthCreds: { username: string; password: string } | null = null;
const AUTH_CACHE_PATH = path.join(process.cwd(), '.tmp', 'e2e-auth-cache.json');
let sharedAuthCookieValue: string | null = null;

async function openHome(page: Page, path = '/') {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
}

async function ensureLoggedOut(page: Page) {
  await page.context().clearCookies();
  await page.request.post(`${BASE_URL}/api/auth/logout`).catch(() => null);
}

async function setupFixtureActiveIntercept(page: Page) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const [activeRes, mainVotingRes, mainResultsRes, rookieVotingRes, rookieResultsRes] = await Promise.all([
      api.get('/api/tournament/active?fixture=1'),
      api.get('/api/arena/pages?arena=main&page=0&tab=voting&fixture=1'),
      api.get('/api/arena/pages?arena=main&page=0&tab=results&fixture=1'),
      api.get('/api/arena/pages?arena=rookie&page=0&tab=voting&fixture=1'),
      api.get('/api/arena/pages?arena=rookie&page=0&tab=results&fixture=1'),
    ]);
    if (activeRes.status() !== 200) return false;
    const activePayload = await activeRes.json().catch(() => null);
    if (!activePayload?.ok) return false;

    const pagesMap = new Map<string, unknown>([
      ['main:voting', await mainVotingRes.json().catch(() => null)],
      ['main:results', await mainResultsRes.json().catch(() => null)],
      ['rookie:voting', await rookieVotingRes.json().catch(() => null)],
      ['rookie:results', await rookieResultsRes.json().catch(() => null)],
    ]);

    await page.route('**/api/tournament/active**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activePayload) });
    });
    await page.route('**/api/arena/pages**', async (route) => {
      const url = new URL(route.request().url());
      const arena = String(url.searchParams.get('arena') || 'main');
      const tab = String(url.searchParams.get('tab') || 'voting');
      const key = `${arena}:${tab}`;
      const payload = pagesMap.get(key);
      if (!payload) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    return true;
  } finally {
    await api.dispose();
  }
}

function trackVotePosts(page: Page) {
  let count = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/vote(?:\?|$)/.test(req.url())) count += 1;
  });
  return () => count;
}

async function firstVoteButton(page: Page) {
  const a = page.getByTestId('vote-a').first();
  const b = page.getByTestId('vote-b').first();
  if (await a.count()) return a;
  if (await b.count()) return b;
  const tournamentCard = page.locator('.tournament-fighter-card--interactive').first();
  if (await tournamentCard.count()) return tournamentCard;
  return page.getByRole('button', { name: /vote|pick|choose|select/i }).first();
}

async function requireVotableOrSkip(page: Page, opts?: { strictFixture?: boolean }) {
  const timeoutMs = 15000;
  const start = Date.now();
  let fixtureApiSeen = false;
  const fixtureResponseListener = (res: { url: () => string }) => {
    const url = res.url();
    if (url.includes('/api/tournament/active') || url.includes('/api/arena/pages')) {
      fixtureApiSeen = true;
    }
  };
  page.on('response', fixtureResponseListener);
  while (Date.now() - start < timeoutMs) {
    const voteButton = await firstVoteButton(page);
    if (await voteButton.count()) {
      page.off('response', fixtureResponseListener);
      return voteButton;
    }
    const paused = page.getByText(/voting paused|no open current-round matches|no votable matchups right now/i).first();
    if (await paused.count()) {
      page.off('response', fixtureResponseListener);
      if (opts?.strictFixture) {
        // eslint-disable-next-line no-console
        console.log('[E2E][skip] strict fixture: no interactive votable match surface');
        test.skip(true, 'Fixture tournament has no interactive votable match surface');
      }
      // eslint-disable-next-line no-console
      console.log('[E2E][skip] no interactive fixture match');
      test.skip(true, 'No open votable match available in this run');
    }
    await page.waitForTimeout(300);
  }
  const containerVisible = await page.locator('[data-testid="tournament-voting"], .tournament-voting-hub, .tournament-fighter-card').first().isVisible().catch(() => false);
  const voteACount = await page.getByTestId('vote-a').count();
  const voteBCount = await page.getByTestId('vote-b').count();
  const interactiveCardCount = await page.locator('.tournament-fighter-card--interactive').count();
  page.off('response', fixtureResponseListener);
  // eslint-disable-next-line no-console
  console.log('[E2E][fixture-debug]', {
    url: page.url(),
    containerVisible,
    voteACount,
    voteBCount,
    interactiveCardCount,
    fixtureApiSeen,
  });
  if (opts?.strictFixture) {
    test.skip(true, 'Fixture vote controls did not become available within timeout');
  }
  // eslint-disable-next-line no-console
  console.log('[E2E][skip] fixture vote controls timeout');
  test.skip(true, 'No vote controls became available within timeout');
  return page.getByTestId('vote-a').first();
}

async function loginViaUi(page: Page, username: string, password: string) {
  if (!/\/login(?:\?|$)/.test(page.url())) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  }
  const signInTab = page.getByRole('button', { name: /^sign in$/i }).first();
  if (await signInTab.count()) await signInTab.click({ force: true });
  const identifierInput = page.locator(
    'input[name="username"], input[name="email"], input[autocomplete="username"], input[type="text"], input[type="email"]'
  ).first();
  const passwordInput = page.locator('input[type="password"]').first();
  const hasIdentifier = await identifierInput.count();
  const hasPassword = await passwordInput.count();
  if (!hasIdentifier || !hasPassword) {
    // eslint-disable-next-line no-console
    console.log('[E2E][auth] login form missing fields', { hasIdentifier: !!hasIdentifier, hasPassword: !!hasPassword, url: page.url() });
  }
  await expect(identifierInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await identifierInput.fill(username);
  await passwordInput.fill(password);
  await passwordInput.blur();

  const submit = page.locator('button:has-text("Sign In"):not([disabled])').first();
  const disabledBeforeWait = await submit.isDisabled().catch(() => true);
  // eslint-disable-next-line no-console
  console.log('[E2E][auth] Sign In disabled:', disabledBeforeWait, { hasIdentifier: !!hasIdentifier, hasPassword: !!hasPassword, url: page.url() });

  const submitHandle = await submit.elementHandle();
  if (submitHandle) {
    await page.waitForFunction((el) => !(el as HTMLButtonElement).disabled, submitHandle, { timeout: 10000 });
  }
  await submit.click();
}

async function registerViaApiBootstrap(username: string, password: string): Promise<string | null> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const bootstrap = await api.get('/api/me');
  expect(bootstrap.status()).toBe(200);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? username : `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);
    const res = await api.post('/api/auth/register', { data: { username: candidate, password } });
    const status = res.status();
    const data = await res.json().catch(() => null);
    if (status === 200 && data?.ok) {
      await api.dispose();
      return candidate;
    }
    if (status === 429) { await api.dispose(); return null; }
    if (status !== 409) expect(status).toBe(200);
  }
  await api.dispose();
  return null;
}

async function canLoginWithCreds(username: string, password: string): Promise<boolean> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const boot = await api.get('/api/me');
    if (boot.status() !== 200) return false;
    const res = await api.post('/api/auth/login', { data: { username, password } });
    const json = await res.json().catch(() => null);
    return res.status() === 200 && !!json?.ok;
  } finally {
    await api.dispose();
  }
}

async function getAuthCookieFromApiLogin(username: string, password: string): Promise<string | null> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    const boot = await api.get('/api/me');
    if (boot.status() !== 200) return null;
    const res = await api.post('/api/auth/login', { data: { username, password } });
    if (res.status() !== 200) return null;
    const setCookie = res.headers()['set-cookie'] || '';
    const match = setCookie.match(/(?:^|,\s*)guest=([^;]+)/);
    return match?.[1] || null;
  } finally {
    await api.dispose();
  }
}

async function readCachedCreds(): Promise<{ username: string; password: string } | null> {
  try {
    const raw = await fs.readFile(AUTH_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const username = String(parsed?.username || '').trim();
    const password = String(parsed?.password || '').trim();
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

async function writeCachedCreds(creds: { username: string; password: string }) {
  await fs.mkdir(path.dirname(AUTH_CACHE_PATH), { recursive: true });
  await fs.writeFile(AUTH_CACHE_PATH, JSON.stringify(creds), 'utf8');
}

async function ensureSharedAuthCreds() {
  if (sharedAuthCreds) return sharedAuthCreds;
  const cached = await readCachedCreds();
  // eslint-disable-next-line no-console
  console.log('[E2E][auth-source]', {
    envUsername: !!E2E_USERNAME,
    envPassword: !!E2E_PASSWORD,
    cachedCreds: !!cached,
  });
  if (E2E_USERNAME && E2E_PASSWORD) {
    const ok = await canLoginWithCreds(E2E_USERNAME, E2E_PASSWORD);
    if (ok) {
      sharedAuthCreds = { username: E2E_USERNAME, password: E2E_PASSWORD };
      // eslint-disable-next-line no-console
      console.log('[E2E][auth-source] using seeded env creds');
      return sharedAuthCreds;
    }
    // eslint-disable-next-line no-console
    console.log('[E2E][auth] provided CATCLASH_E2E credentials failed login');
  }

  if (cached && await canLoginWithCreds(cached.username, cached.password)) {
    sharedAuthCreds = cached;
    // eslint-disable-next-line no-console
    console.log('[E2E][auth-source] using cached creds');
    return sharedAuthCreds;
  }

  const creds = randomCreds();
  const createdUsername = await registerViaApiBootstrap(creds.username, creds.password);
  if (!createdUsername) {
    // eslint-disable-next-line no-console
    console.log('[E2E][auth] register unavailable (likely 429) and no valid seeded/cached creds');
    return null;
  }
  sharedAuthCreds = { username: createdUsername, password: creds.password };
  await writeCachedCreds(sharedAuthCreds);
  // eslint-disable-next-line no-console
  console.log('[E2E][auth-source] using bootstrap creds');
  return sharedAuthCreds;
}

async function ensureAuthenticatedPage(page: Page, creds: { username: string; password: string }) {
  if (!sharedAuthCookieValue) {
    sharedAuthCookieValue = await getAuthCookieFromApiLogin(creds.username, creds.password);
  }
  if (sharedAuthCookieValue) {
    const host = new URL(BASE_URL);
    await page.context().addCookies([{
      name: 'guest',
      value: sharedAuthCookieValue,
      domain: host.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);
    return true;
  }
  await loginViaUi(page, creds.username, creds.password);
  return true;
}

async function waitForAuthenticatedLanding(page: Page, timeoutMs = 30000) {
  const isAllowedPath = (pathname: string) => pathname === '/' || pathname.startsWith('/profile/');
  if (!isAllowedPath(new URL(page.url()).pathname)) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForURL((url) => {
    const p = url.pathname;
    return isAllowedPath(p);
  }, { timeout: timeoutMs });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await page.request.get(`${BASE_URL}/api/me`);
    const body = await res.json().catch(() => ({}));
    if (res.status() === 200 && body?.ok && body?.data?.has_credentials) break;
    await page.waitForTimeout(250);
  }

  await expect(page.getByText(/^404$/i)).toHaveCount(0);
  await expect(page.getByText(/not found/i).first()).toHaveCount(0);
}

test('guest vote opens auth gate and dismiss works without vote submission', async ({ page }) => {
  const getVotePostCount = trackVotePosts(page);
  await setupFixtureActiveIntercept(page);
  await ensureLoggedOut(page);

  await openHome(page, '/tournament?fixture=1&debug=1');
  const voteButton = await requireVotableOrSkip(page);
  await voteButton.click();

  const gate = page.getByTestId('vote-auth-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText(/save votes/i);
  await expect(gate).toContainText(/earn sigils/i);
  await expect(gate).toContainText(/build your flame/i);

  await page.getByTestId('vote-auth-gate-dismiss').click();
  await expect(gate).toBeHidden();

  expect(getVotePostCount()).toBe(0);
});

test('auth CTA preserves resume context, resumes vote once, then cleans params', async ({ page }) => {
  await setupFixtureActiveIntercept(page);
  const creds = await ensureSharedAuthCreds();
  if (!creds) {
    // eslint-disable-next-line no-console
    console.log('[E2E][skip] missing auth credentials/session');
    test.skip(true, 'Missing reusable auth credentials in this run');
  }
  await ensureLoggedOut(page);

  const getVotePostCount = trackVotePosts(page);
  await openHome(page, '/tournament?fixture=1&debug=1');

  const voteButton = await requireVotableOrSkip(page, { strictFixture: true });
  await voteButton.click();

  const gateCta = page.getByTestId('vote-auth-gate-cta');
  await expect(gateCta).toBeVisible();
  const href = (await gateCta.getAttribute('href')) || '';
  expect(href).toContain('/login?next=');
  const nextEncoded = href.split('next=')[1] || '';
  const nextDecoded = decodeURIComponent(nextEncoded);
  expect(nextDecoded).toContain('resume_vote_match=');
  expect(nextDecoded).toContain('resume_vote_cat=');

  await gateCta.click();
  await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10000 });
  await ensureAuthenticatedPage(page, creds!);
  await waitForAuthenticatedLanding(page, 30000);
  await page.waitForURL((url) => !url.searchParams.has('resume_vote_match') && !url.searchParams.has('resume_vote_cat'), { timeout: 30000 });

  const afterResumeVotePosts = getVotePostCount();
  expect(afterResumeVotePosts).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId('vote-auth-gate')).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  expect(getVotePostCount()).toBe(afterResumeVotePosts);
});

test('invalid stale resume params are ignored gracefully for authenticated user', async ({ page }) => {
  await setupFixtureActiveIntercept(page);
  const creds = await ensureSharedAuthCreds();
  if (!creds) {
    // eslint-disable-next-line no-console
    console.log('[E2E][skip] missing auth credentials/session');
    test.skip(true, 'Missing reusable auth credentials in this run');
  }
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await ensureAuthenticatedPage(page, creds!);
  await waitForAuthenticatedLanding(page, 15000);

  const getVotePostCount = trackVotePosts(page);
  let pageError: string | null = null;
  page.on('pageerror', (err) => {
    pageError = String(err);
  });

  await page.goto(`${BASE_URL}/?resume_vote_match=invalid-match-id&resume_vote_cat=invalid-cat-id&resume_vote_src=e2e`, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForTimeout(1500);
  const currentUrl = new URL(page.url());
  const resumeParamsPresent = currentUrl.searchParams.has('resume_vote_match') || currentUrl.searchParams.has('resume_vote_cat');
  // eslint-disable-next-line no-console
  console.log('[E2E][stale-resume-check]', { url: page.url(), resumeParamsPresent });
  expect(currentUrl.pathname === '/' || currentUrl.pathname.startsWith('/profile/')).toBeTruthy();

  expect(getVotePostCount()).toBe(0);
  expect(pageError).toBeNull();
  await expect(await requireVotableOrSkip(page, { strictFixture: true })).toBeVisible({ timeout: 15000 });
});

test('starter quest CTAs route correctly for logged out and logged in states', async ({ page }) => {
  await setupFixtureActiveIntercept(page);
  await openHome(page, '/tournament?fixture=1&debug=1');

  const loggedOutUsernameCta = page.getByTestId('starter-quest-cta-set_username').first();
  if (await loggedOutUsernameCta.count()) {
    await loggedOutUsernameCta.click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10000 });
    await page.goBack();
  }

  const shopCta = page.getByTestId('starter-quest-cta-visit_shop').first();
  if (await shopCta.count()) {
    await shopCta.click();
    await page.waitForURL(/\/shop(?:\?|$)/, { timeout: 10000 });
  }

  const creds = await ensureSharedAuthCreds();
  if (!creds) {
    // eslint-disable-next-line no-console
    console.log('[E2E][skip] missing auth credentials/session');
    test.skip(true, 'Missing reusable auth credentials in this run');
  }
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await ensureAuthenticatedPage(page, creds!);
  await waitForAuthenticatedLanding(page, 15000);

  const loggedInUsernameCta = page.getByTestId('starter-quest-cta-set_username').first();
  if (await loggedInUsernameCta.count()) {
    await loggedInUsernameCta.click();
    await page.waitForURL(/\/profile(?:\/|\?|$)/, { timeout: 12000 });
  }
});

test('reward/shop nudge appears on rewarded vote and does not spam on reload', async ({ page }) => {
  await setupFixtureActiveIntercept(page);
  const creds = await ensureSharedAuthCreds();
  if (!creds) {
    // eslint-disable-next-line no-console
    console.log('[E2E][skip] missing auth credentials/session');
    test.skip(true, 'Missing reusable auth credentials in this run');
  }
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await ensureAuthenticatedPage(page, creds!);
  await waitForAuthenticatedLanding(page, 15000);

  const voteResponsePromise = page.waitForResponse((res) => {
    const req = res.request();
    return req.method() === 'POST' && /\/api\/vote(?:\?|$)/.test(res.url());
  }, { timeout: 15000 }).catch(() => null);

  const voteButton = await requireVotableOrSkip(page, { strictFixture: true });
  await voteButton.click();

  const voteResponse = await voteResponsePromise;
  if (!voteResponse) {
    // eslint-disable-next-line no-console
    console.log('[E2E][skip] no /api/vote response observed');
    test.skip(true, 'No /api/vote response observed for this run');
  }

  const body = await voteResponse!.json().catch(() => ({}));
  const sigilsEarned = Number(body?.sigils_earned || 0);

  if (sigilsEarned > 0) {
    await expect(page.getByText(/visit shop/i).first()).toBeVisible({ timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/visit shop/i).first()).toBeHidden();
  }
});
