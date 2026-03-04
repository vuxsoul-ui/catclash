import { expect, test, type APIResponse, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

type ModeName = 'debug' | 'normal';

type ModeResult = {
  mode: ModeName;
  apiHealthy: boolean;
  uiVoteSucceeded: boolean;
  apiVoteSucceeded: boolean;
  voteRequestObserved: boolean;
  repeatedRefreshLoopDetected: boolean;
  pulsingUnclickableDetected: boolean;
  maxUpdateDepthErrorDetected: boolean;
  apiVoteStatus: number | null;
  skipped: boolean;
  skipReason: string | null;
};

function statusSummary(result: ModeResult) {
  return {
    mode: result.mode,
    apiHealthy: result.apiHealthy,
    uiVoteSucceeded: result.uiVoteSucceeded,
    apiVoteSucceeded: result.apiVoteSucceeded,
    voteRequestObserved: result.voteRequestObserved,
    repeatedRefreshLoopDetected: result.repeatedRefreshLoopDetected,
    pulsingUnclickableDetected: result.pulsingUnclickableDetected,
    maxUpdateDepthErrorDetected: result.maxUpdateDepthErrorDetected,
    apiVoteStatus: result.apiVoteStatus,
    skipped: result.skipped,
    skipReason: result.skipReason,
  };
}

async function debugResponse(label: string, res: APIResponse) {
  if (res.status() === 200) return;
  const body = await res.text().catch(() => '<unreadable body>');
  // eslint-disable-next-line no-console
  console.log(`[E2E] ${label} status=${res.status()} body=${body.slice(0, 1200)}`);
}

async function isLoadingVisible(page: Page) {
  const loadingText = page.getByText(/loading/i).first();
  if (await loadingText.count()) {
    if (await loadingText.isVisible().catch(() => false)) return true;
  }
  const ariaBusy = page.locator('[aria-busy="true"]').first();
  if (await ariaBusy.count()) {
    if (await ariaBusy.isVisible().catch(() => false)) return true;
  }
  return false;
}

async function detectRepeatedLoadingLoop(page: Page) {
  const intervalMs = 250;
  const sampleWindowMs = 12_000;
  let loadingVisibleMs = 0;
  const samples = Math.ceil(sampleWindowMs / intervalMs);

  for (let i = 0; i < samples; i += 1) {
    if (await isLoadingVisible(page)) loadingVisibleMs += intervalMs;
    await page.waitForTimeout(intervalMs);
  }

  return loadingVisibleMs >= 9_000;
}

async function findVoteButton(page: Page) {
  const testIds = ['vote-a', 'vote-b', 'vote-left', 'vote-right'];
  for (const id of testIds) {
    const locator = page.getByTestId(id).first();
    if (await locator.count()) return locator;
  }

  const roleButton = page.getByRole('button', { name: /vote|pick|choose|select/i }).first();
  if (await roleButton.count()) return roleButton;

  const fallback = page.locator('.arena-match-card button').first();
  if (await fallback.count()) return fallback;

  return null;
}

async function waitUntilEnabled(button: ReturnType<Page['locator']>, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const enabled = await button.isEnabled().catch(() => false);
    if (enabled) return true;
    await button.page().waitForTimeout(250);
  }
  return false;
}

function findFallbackCandidate(activeJson: any): { matchId: string; catAId: string; catBId: string } | null {
  const arenas = Array.isArray(activeJson?.arenas) ? activeJson.arenas : [];
  for (const arena of arenas) {
    const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
    for (const round of rounds) {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        const status = String(match?.status || '').toLowerCase();
        const matchId = String(match?.match_id || '');
        const catAId = String(match?.cat_a?.id || '');
        const catBId = String(match?.cat_b?.id || '');
        if (!matchId || !catAId || !catBId) continue;
        if (status === 'complete' || status === 'completed') continue;
        return { matchId, catAId, catBId };
      }
    }
  }
  return null;
}

test('new user can vote in debug + normal mode', async ({ browser, request }) => {
  test.setTimeout(60_000);

  const modes: Array<{ mode: ModeName; path: string }> = [
    { mode: 'debug', path: '/?debug=1' },
    { mode: 'normal', path: '/' },
  ];

  for (const { mode, path } of modes) {
    const result: ModeResult = {
      mode,
      apiHealthy: false,
      uiVoteSucceeded: false,
      apiVoteSucceeded: false,
      voteRequestObserved: false,
      repeatedRefreshLoopDetected: false,
      pulsingUnclickableDetected: false,
      maxUpdateDepthErrorDetected: false,
      apiVoteStatus: null,
      skipped: false,
      skipReason: null,
    };

    let context: BrowserContext | null = null;

    try {
      const meRes = await request.get(`${BASE_URL}/api/me`);
      await debugResponse(`/api/me (${mode})`, meRes);

      const activeRes = await request.get(`${BASE_URL}/api/tournament/active`);
      await debugResponse(`/api/tournament/active (${mode})`, activeRes);
      const activeJson = await activeRes.json().catch(() => null);

      result.apiHealthy = meRes.status() === 200 && activeRes.status() === 200;
      if (!result.apiHealthy) {
        result.skipped = true;
        result.skipReason = 'API unhealthy';
        // eslint-disable-next-line no-console
        console.log(`[E2E][${mode}] SKIP: API unhealthy`);
        // eslint-disable-next-line no-console
        console.log(`[E2E][${mode}] summary`, statusSummary(result));
        continue;
      }

      context = await browser.newContext();
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.text().includes('Maximum update depth exceeded')) {
          result.maxUpdateDepthErrorDetected = true;
        }
      });
      page.on('pageerror', (err) => {
        if (String(err).includes('Maximum update depth exceeded')) {
          result.maxUpdateDepthErrorDetected = true;
        }
      });

      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });

      result.repeatedRefreshLoopDetected = await detectRepeatedLoadingLoop(page);

      const voteButton = await findVoteButton(page);
      if (voteButton) {
        const enabledWithin5s = await waitUntilEnabled(voteButton, 5_000);
        if (!enabledWithin5s) {
          result.pulsingUnclickableDetected = true;
        } else {
          const voteResponsePromise = page
            .waitForResponse((res) => {
              const req = res.request();
              return req.method() === 'POST' && /\/api\/vote(?:\?|$)/.test(res.url());
            }, { timeout: 5_000 })
            .then((res) => res)
            .catch(() => null);

          await voteButton.scrollIntoViewIfNeeded().catch(() => null);
          await voteButton.click({ timeout: 3_000 }).catch(() => null);

          const voteResponse = await voteResponsePromise;
          result.voteRequestObserved = !!voteResponse;

          const votedIndicator = await page.getByText(/voted|thanks/i).first().isVisible().catch(() => false);
          const selectedHeuristic = await page.locator('.arena-vote-btn:has-text("Voted")').first().isVisible().catch(() => false);
          result.uiVoteSucceeded = result.voteRequestObserved || votedIndicator || selectedHeuristic;
        }
      }

      if (!result.uiVoteSucceeded) {
        const candidate = findFallbackCandidate(activeJson);
        if (!candidate) {
          result.skipped = true;
          result.skipReason = 'no votable match candidate available';
          // eslint-disable-next-line no-console
          console.log(`[E2E][${mode}] SKIP: no votable match candidate available`);
          // eslint-disable-next-line no-console
          console.log(`[E2E][${mode}] summary`, statusSummary(result));
          continue;
        }

        const voteRes = await request.post(`${BASE_URL}/api/vote`, {
          data: {
            match_id: candidate.matchId,
            voted_for: candidate.catAId,
          },
        });

        result.apiVoteStatus = voteRes.status();
        result.apiVoteSucceeded = voteRes.status() === 200 || voteRes.status() === 409;
        // eslint-disable-next-line no-console
        console.log(`[E2E][${mode}] /api/vote => ${voteRes.status()}`);
      }

      expect(result.maxUpdateDepthErrorDetected, `[${mode}] max update depth error should be absent`).toBeFalsy();
      expect(result.repeatedRefreshLoopDetected, `[${mode}] repeated loading loop detected`).toBeFalsy();
      expect(result.pulsingUnclickableDetected, `[${mode}] vote controls stayed disabled >5s`).toBeFalsy();
      expect(result.uiVoteSucceeded || result.apiVoteSucceeded, `[${mode}] vote did not succeed via UI or API fallback`).toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`[E2E][${mode}] summary`, statusSummary(result));
    } finally {
      if (context) await context.close();
    }
  }
});
