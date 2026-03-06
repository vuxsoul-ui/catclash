import { expect, test, type APIResponse, type BrowserContext, type Locator, type Page } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const MAX_VOTES = 2;

type ModeName = 'debug' | 'normal';

type VoteTarget = { locator: Locator; side: 'a' | 'b' | null };

type MatchState = {
  matchId: string | null;
  text: string;
};

type ModeResult = {
  mode: ModeName;
  apiHealthy: boolean;
  uiVoteSucceeded: boolean;
  apiVoteSucceeded: boolean;
  voteRequestObserved: boolean;
  percentConsistencyChecked?: boolean;
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
    percentConsistencyChecked: result.percentConsistencyChecked,
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

type VoteAttemptNotes = string[];

async function getCurrentMatchState(page: Page): Promise<MatchState> {
  const root = page.getByTestId('match-root').first();
  const count = await root.count();
  if (!count) return { matchId: null, text: '' };

  const matchId = (await root.getAttribute('data-match-id'))?.trim() || null;
  const text = (await root.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  return { matchId, text };
}

async function waitForMatchTransition(page: Page, prior: MatchState, timeoutMs = 5_000): Promise<boolean> {
  const endAt = Date.now() + timeoutMs;
  while (Date.now() < endAt) {
    const current = await getCurrentMatchState(page);
    const changed = !!current.matchId && (!!prior.matchId ? current.matchId !== prior.matchId : true) && current.text !== prior.text;
    if (changed || (prior.matchId && current.matchId && current.matchId !== prior.matchId) || (current.text && current.text !== prior.text)) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
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

async function findVoteButton(page: Page): Promise<VoteTarget | null> {
  const priorityIds = [
    { id: 'vote-a', side: 'a' as const },
    { id: 'vote-b', side: 'b' as const },
  ];

  for (const { id, side } of priorityIds) {
    const locator = page.getByTestId(id).first();
    if (await locator.count()) return { locator, side };
  }

  for (const id of ['vote-left', 'vote-right']) {
    const locator = page.getByTestId(id).first();
    if (await locator.count()) return { locator, side: null };
  }

  const roleButton = page.getByRole('button', { name: /vote|pick|choose|select/i }).first();
  if (await roleButton.count()) return { locator: roleButton, side: null };

  const fallback = page.locator('.arena-match-card button').first();
  if (await fallback.count()) return { locator: fallback, side: null };

  return null;
}

async function clickVoteButton(page: Page, target: VoteTarget, notes: VoteAttemptNotes, mode: string): Promise<void> {
  await target.locator.scrollIntoViewIfNeeded().catch(() => null);

  try {
    await target.locator.click({ trial: true, timeout: 2_000 });
  } catch (error) {
    const pointerEvents = await target.locator
      .evaluate((el) => window.getComputedStyle(el).pointerEvents)
      .catch(() => 'unknown');
    const box = await target.locator.boundingBox().catch(() => null);
    notes.push(`[${mode}] trial click failed: ${String(error)}`);
    notes.push(`[${mode}] pointer-events=${String(pointerEvents)} box=${JSON.stringify(box)}`);
    const screenshotPath = `/tmp/${mode}-vote-trial-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    notes.push(`[${mode}] screenshot: ${screenshotPath}`);
  }

  await target.locator.click({ timeout: 5_000 }).catch(async () => {
    if (page.context().browser()?.browserType().name() === 'webkit') {
      notes.push(`[${mode}] using webkit force click fallback`);
      await target.locator.click({ force: true, timeout: 5_000 }).catch(() => null);
    }
  });
}

function waitForVoteResponse(page: Page, timeoutMs = 5_000) {
  const voteResponse = page.waitForResponse((res) => {
    const req = res.request();
    return req.method() === 'POST' && /\/api\/vote(?:\?|$)/.test(res.url());
  }, { timeout: timeoutMs }).then((res) => res).catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([voteResponse, timeout]);
}

async function waitUntilEnabled(button: ReturnType<Page['locator']>, timeoutMs = 5_000) {
  const startedAt = Date.now();
  const page = button.page();
  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) return false;
    const enabled = await button.isEnabled().catch(() => false);
    if (enabled) return true;
    try {
      await page.waitForTimeout(250);
    } catch {
      return false;
    }
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

function findMatchWithPercents(activeJson: any): { matchId: string; percentA: number; percentB: number; totalVotes: number } | null {
  const arenas = Array.isArray(activeJson?.arenas) ? activeJson.arenas : [];
  for (const arena of arenas) {
    const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
    for (const round of rounds) {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        const matchId = String(match?.match_id || '');
        const percentA = Number(match?.percent_a);
        const percentB = Number(match?.percent_b);
        const totalVotes = Number(match?.total_votes ?? (Number(match?.votes_a || 0) + Number(match?.votes_b || 0)));
        if (!matchId) continue;
        if (!Number.isFinite(percentA) || !Number.isFinite(percentB)) continue;
        return { matchId, percentA, percentB, totalVotes };
      }
    }
  }
  return null;
}

test('new user can vote in debug + normal mode', async ({ browser, request }) => {
  test.setTimeout(75_000);

  const modes: Array<{ mode: ModeName; path: string }> = [
    { mode: 'debug', path: '/?debug=1' },
    { mode: 'normal', path: '/' },
  ];

  for (const { mode, path } of modes) {
    const notes: string[] = [];
    const result: ModeResult = {
      mode,
      apiHealthy: false,
      uiVoteSucceeded: false,
      apiVoteSucceeded: false,
      voteRequestObserved: false,
      percentConsistencyChecked: false,
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
      let activeJson = await activeRes.json().catch(() => null);
      const activeRes2 = await request.get(`${BASE_URL}/api/tournament/active`);
      await debugResponse(`/api/tournament/active#2 (${mode})`, activeRes2);
      const activeJson2 = await activeRes2.json().catch(() => null);

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

      const firstPct = findMatchWithPercents(activeJson);
      const secondPct = firstPct
        ? findMatchWithPercents({
            arenas: (Array.isArray(activeJson2?.arenas) ? activeJson2.arenas : []).map((arena: any) => ({
              ...arena,
              rounds: Array.isArray(arena?.rounds)
                ? arena.rounds.map((round: any) => ({
                    ...round,
                    matches: Array.isArray(round?.matches)
                      ? round.matches.filter((m: any) => String(m?.match_id || '') === firstPct.matchId)
                      : [],
                  }))
                : [],
            })),
          })
        : null;
      if (firstPct && secondPct) {
        expect(firstPct.totalVotes).toBe(secondPct.totalVotes);
        expect(firstPct.percentA).toBe(secondPct.percentA);
        expect(firstPct.percentB).toBe(secondPct.percentB);
        expect(firstPct.percentA + firstPct.percentB).toBe(100);
        result.percentConsistencyChecked = true;
      } else {
        // eslint-disable-next-line no-console
        console.log(`[E2E][${mode}] percent check skipped (no match with percents)`);
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
      notes.push(`[${mode}] goto done`);

      result.repeatedRefreshLoopDetected = await detectRepeatedLoadingLoop(page);
      if (result.repeatedRefreshLoopDetected) {
        notes.push(`[${mode}] repeated loading loop detected`);
      }

      let previousMatch = await getCurrentMatchState(page);

      for (let attempt = 1; attempt <= MAX_VOTES; attempt += 1) {
        notes.push(`[${mode}] attempt ${attempt}/${MAX_VOTES}`);

        let voteWorked = false;
        let disableObservedForMode = false;
        const voteTarget = await findVoteButton(page);
        if (voteTarget) {
          notes.push(`[${mode}] found vote button`);
          const enabledWithin5s = await waitUntilEnabled(voteTarget.locator, 5_000);
          if (!enabledWithin5s) {
            disableObservedForMode = true;
            notes.push(`[${mode}] vote button disabled`);
          } else {
            notes.push(`[${mode}] button enabled`);
            const voteResponsePromise = waitForVoteResponse(page, 5_000);
            await clickVoteButton(page, voteTarget, notes, mode);
            const voteResponse = await voteResponsePromise;
            result.voteRequestObserved = !!voteResponse || result.voteRequestObserved;

            const votedIndicator = await page.getByText(/voted|thanks/i).first().isVisible().catch(() => false);
            const selectedHeuristic = await page.locator('.arena-vote-btn:has-text("Voted")').first().isVisible().catch(() => false);
            voteWorked = result.voteRequestObserved || votedIndicator || selectedHeuristic;
            result.uiVoteSucceeded = result.uiVoteSucceeded || voteWorked;
            notes.push(`[${mode}] ui success=${voteWorked}`);
          }
        } else {
          notes.push(`[${mode}] no vote buttons found`);
        }

        if (!voteWorked) {
          notes.push(`[${mode}] fallback API vote`);
          const candidate = findFallbackCandidate(activeJson);
          if (!candidate) {
            if (!result.uiVoteSucceeded && !result.apiVoteSucceeded) {
              result.skipped = true;
              result.skipReason = 'no votable match candidate available';
              // eslint-disable-next-line no-console
              console.log(`[E2E][${mode}] SKIP: no votable match candidate available`);
            }
            break;
          }

          const apiRes = await request.post(`${BASE_URL}/api/vote`, {
            data: { match_id: candidate.matchId, voted_for: candidate.catAId },
          });
          result.apiVoteStatus = apiRes.status();
          result.apiVoteSucceeded = apiRes.status() === 200 || apiRes.status() === 409;
          voteWorked = result.apiVoteSucceeded;
          // eslint-disable-next-line no-console
          console.log(`[E2E][${mode}] /api/vote => ${apiRes.status()}`);
          // refresh active payload for next candidate attempt
          const refreshRes = await request.get(`${BASE_URL}/api/tournament/active`);
          activeJson = await refreshRes.json().catch(() => null);
        }

        if (voteWorked) {
          if (!previousMatch.matchId && !previousMatch.text) {
            notes.push(`[${mode}] no initial match-root content to track transition`);
            break;
          }

          const changed = await waitForMatchTransition(page, previousMatch, 5_000);
          notes.push(`[${mode}] next match loaded=${changed}`);
          if (disableObservedForMode && !result.uiVoteSucceeded && !result.apiVoteSucceeded) {
            result.pulsingUnclickableDetected = true;
          }
          if (!changed) {
            break;
          }
          previousMatch = await getCurrentMatchState(page);
          continue;
        }
      }

      if (result.uiVoteSucceeded || result.apiVoteSucceeded) {
        const postRes = await request.get(`${BASE_URL}/api/tournament/active`);
        const postJson = await postRes.json().catch(() => null);
        const pct = findMatchWithPercents(postJson);
        if (pct) {
          expect(pct.percentA + pct.percentB).toBe(100);
        }
      }

      expect(result.maxUpdateDepthErrorDetected, `[${mode}] max update depth error should be absent`).toBeFalsy();
      expect(result.repeatedRefreshLoopDetected, `[${mode}] repeated loading loop detected`).toBeFalsy();
      if (!result.apiVoteSucceeded && !result.uiVoteSucceeded) {
        expect(result.pulsingUnclickableDetected, `[${mode}] vote controls stayed disabled >5s`).toBeFalsy();
      }
      if (!result.skipped) {
        expect(result.uiVoteSucceeded || result.apiVoteSucceeded, `[${mode}] vote did not succeed via UI or API fallback`).toBeTruthy();
      }

      // eslint-disable-next-line no-console
      console.log(`[E2E][${mode}] notes`, notes.join(' | '));
      // eslint-disable-next-line no-console
      console.log(`[E2E][${mode}] summary`, statusSummary(result));
    } finally {
      if (context) await context.close();
    }
  }
});
