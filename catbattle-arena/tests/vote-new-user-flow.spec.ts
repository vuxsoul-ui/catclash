import { expect, test } from 'playwright/test';

// BASE_URL must be set by the runner (e.g., http://localhost:3000)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MODES = [
  { name: 'debug', path: '/?debug=1' },
  { name: 'normal', path: '/' },
] as const;

type ModeSummary = {
  mode: string;
  apiHealthy: boolean;
  apiVoteFallbackUsed: boolean;
  apiVoteSucceeded: boolean;
  uiVoteAttempted: boolean;
  uiVoteSucceeded: boolean;
  maxUpdateDepthError: boolean;
  initialBacksideDetected: boolean;
  pulsingUnclickableDetected: boolean;
  repeatedRefreshLoopDetected: boolean;
  notes: string[];
};

async function checkApiHealth(request: { get: Function }, notes: string[]) {
  const me = await request.get(`${BASE_URL}/api/me`);
  const active = await request.get(`${BASE_URL}/api/tournament/active`);
  notes.push(`/api/me => ${me.status()}`);
  notes.push(`/api/tournament/active => ${active.status()}`);
  return {
    apiHealthy: me.ok() && active.ok(),
    activeJson: active.ok() ? await active.json().catch(() => null) : null,
  };
}

function pickFirstVotableMatch(activeJson: any) {
  const arenas = Array.isArray(activeJson?.arenas) ? activeJson.arenas : [];
  for (const arena of arenas) {
    const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
    for (const round of rounds) {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        const status = String(match?.status || '').toLowerCase();
        if (status === 'complete' || status === 'completed') continue;
        const matchId = match?.match_id;
        const catA = match?.cat_a?.id;
        const catB = match?.cat_b?.id;
        if (matchId && catA && catB) return { matchId, catA, catB };
      }
    }
  }
  return null;
}

function summarizeMatchStatuses(activeJson: any) {
  const counts: Record<string, number> = {};
  const arenas = Array.isArray(activeJson?.arenas) ? activeJson.arenas : [];
  for (const arena of arenas) {
    const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
    for (const round of rounds) {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        const status = String(match?.status || 'unknown');
        counts[status] = (counts[status] || 0) + 1;
      }
    }
  }
  return counts;
}

async function castFallbackVote(
  request: { post: Function },
  activeJson: any,
  notes: string[],
): Promise<{ attempted: boolean; succeeded: boolean; skippedNoMatches: boolean }> {
  const pick = pickFirstVotableMatch(activeJson);
  if (!pick) {
    notes.push('Fallback API vote skipped: no votable matches found (all complete or missing ids).');
    notes.push(`Match status distribution: ${JSON.stringify(summarizeMatchStatuses(activeJson))}`);
    return { attempted: true, succeeded: false, skippedNoMatches: true };
  }
  const res = await request.post(`${BASE_URL}/api/vote`, {
    data: { match_id: String(pick.matchId), voted_for: String(pick.catA) },
    headers: { 'Content-Type': 'application/json' },
  });
  notes.push(`/api/vote => ${res.status()}`);
  const ok = res.status() === 200 || res.status() === 409;
  if (!ok) {
    const txt = await res.text().catch(() => '');
    notes.push(`Unexpected /api/vote response body (first 200 chars): ${txt.slice(0, 200)}`);
  }
  return { attempted: true, succeeded: ok, skippedNoMatches: false };
}

for (const mode of MODES) {
  test(`new user voting flow (${mode.name})`, async ({ page, request }) => {
    test.setTimeout(45_000);

    const summary: ModeSummary = {
      mode: mode.name,
      apiHealthy: false,
      apiVoteFallbackUsed: false,
      apiVoteSucceeded: false,
      uiVoteAttempted: false,
      uiVoteSucceeded: false,
      maxUpdateDepthError: false,
      initialBacksideDetected: false,
      pulsingUnclickableDetected: false,
      repeatedRefreshLoopDetected: false,
      notes: [],
    };

    page.on('console', (msg) => {
      const t = msg.text();
      if (/Maximum update depth exceeded/i.test(t)) summary.maxUpdateDepthError = true;
    });
    page.on('pageerror', (err) => {
      if (/Maximum update depth exceeded/i.test(String(err?.message || err))) {
        summary.maxUpdateDepthError = true;
      }
    });

    const health = await checkApiHealth(request, summary.notes);
    summary.apiHealthy = health.apiHealthy;
    expect(summary.apiHealthy, `${mode.name}: API health failed`).toBeTruthy();

    await page.goto(`${BASE_URL}${mode.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const voteAButton = page.getByRole('button', { name: /vote a/i }).first();
    const voteBButton = page.getByRole('button', { name: /vote b/i }).first();
    const anyVoteButton = (await voteAButton.count()) > 0 ? voteAButton : voteBButton;

    const hasVoteButton = (await voteAButton.count()) > 0 || (await voteBButton.count()) > 0;
    if (!hasVoteButton) {
      const closeButtons = page.getByRole('button', { name: /^close$/i });
      if ((await closeButtons.count()) >= 1) {
        summary.initialBacksideDetected = true;
        summary.notes.push('Initial render looks like card backside (Close visible, no Vote A/B)');
      }
    }

    let loadingSeen = 0;
    let loadingChanges = 0;
    let prevLoading = false;
    for (let i = 0; i < 12; i += 1) {
      const isLoading = await page.getByText(/loading next fights|arena is reloading|loading\.\.\./i).first().isVisible().catch(() => false);
      if (isLoading) loadingSeen += 1;
      if (isLoading !== prevLoading) loadingChanges += 1;
      prevLoading = isLoading;
      await page.waitForTimeout(500);
    }
    if (loadingSeen >= 10 || loadingChanges >= 8) {
      summary.repeatedRefreshLoopDetected = true;
      summary.notes.push(`Loading loop suspected (seen=${loadingSeen}, changes=${loadingChanges})`);
    }

    if (hasVoteButton) {
      summary.uiVoteAttempted = true;
      await expect(anyVoteButton).toBeVisible({ timeout: 10_000 });
      const clickable = await anyVoteButton.isEnabled();
      if (!clickable) {
        summary.pulsingUnclickableDetected = true;
        summary.notes.push('Vote button rendered but disabled/not clickable');
      } else {
        await anyVoteButton.click({ timeout: 6_000 });
        const votedBadge = page.getByText(/voted/i).first();
        summary.uiVoteSucceeded = await votedBadge.isVisible().catch(() => false);
      }
    } else {
      summary.notes.push('UI vote buttons not found; falling back to API vote');
      summary.apiVoteFallbackUsed = true;
      const result = await castFallbackVote(request, health.activeJson, summary.notes);
      summary.apiVoteSucceeded = result.succeeded;
      if (result.skippedNoMatches) {
        // eslint-disable-next-line no-console
        console.log(`\n[E2E][${summary.mode}] vote-new-user-flow\n  apiHealthy=${summary.apiHealthy}\n  note: no votable matches available; skipping vote assertion\n  note: ${summary.notes.join('\n  note: ')}`);
        test.skip(true, 'No votable matches available (all complete).');
      }
    }

    const reportLines = [
      `\n[E2E][${summary.mode}] vote-new-user-flow`,
      `  apiHealthy=${summary.apiHealthy}`,
      `  uiVoteAttempted=${summary.uiVoteAttempted}`,
      `  uiVoteSucceeded=${summary.uiVoteSucceeded}`,
      `  apiVoteFallbackUsed=${summary.apiVoteFallbackUsed}`,
      `  apiVoteSucceeded=${summary.apiVoteSucceeded}`,
      `  initialBacksideDetected=${summary.initialBacksideDetected}`,
      `  pulsingUnclickableDetected=${summary.pulsingUnclickableDetected}`,
      `  repeatedRefreshLoopDetected=${summary.repeatedRefreshLoopDetected}`,
      `  maxUpdateDepthError=${summary.maxUpdateDepthError}`,
      ...summary.notes.map((n) => `  note: ${n}`),
    ];
    // eslint-disable-next-line no-console
    console.log(reportLines.join('\n'));

    expect(summary.maxUpdateDepthError, `${mode.name}: Maximum update depth error detected`).toBeFalsy();
    expect(summary.repeatedRefreshLoopDetected, `${mode.name}: repeated loading loop detected`).toBeFalsy();
    expect(summary.pulsingUnclickableDetected, `${mode.name}: pulsing/unclickable regression detected`).toBeFalsy();
    expect(
      summary.uiVoteSucceeded || summary.apiVoteSucceeded,
      `${mode.name}: vote did not succeed via UI or API fallback`,
    ).toBeTruthy();
  });
}
