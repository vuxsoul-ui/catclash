import { expect, test, type Page } from '@playwright/test';
import {
  assertWorkflowHealthy,
  loginAsTestUser,
  openTournament,
  resolveWorkflowCreds,
  startWorkflowDiagnostics,
} from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

type RevealCase = {
  name: string;
  boosted: boolean;
  win: boolean;
  bet: number;
};

function buildResolvedMatchPayload(opts: RevealCase) {
  const matchId = `pw-result-${opts.name.replace(/\s+/g, '-').toLowerCase()}`;
  const tournamentId = 'pw-result-reveal-tournament';
  const catAId = `${matchId}-cat-a`;
  const catBId = `${matchId}-cat-b`;
  const votedCatId = opts.win ? catAId : catBId;
  const winningCatId = opts.win ? votedCatId : votedCatId === catAId ? catBId : catAId;

  const baseMatch = {
    match_id: matchId,
    status: 'complete',
    votes_a: 29,
    votes_b: 25,
    winner_id: winningCatId,
    is_close_match: true,
    user_voted_cat_id: votedCatId,
    user_prediction: opts.boosted
      ? { predicted_cat_id: votedCatId, bet_sigils: opts.bet }
      : null,
    cat_a: {
      id: catAId,
      name: 'Reveal Alpha',
      image_url: '/cat-placeholder.svg',
      rarity: 'Rare',
      owner_username: 'fixture',
      owner_guild: 'moon',
      stats: { attack: 12, defense: 10, speed: 11, charisma: 9, chaos: 8 },
    },
    cat_b: {
      id: catBId,
      name: 'Reveal Beta',
      image_url: '/cat-placeholder.svg',
      rarity: 'Epic',
      owner_username: 'fixture',
      owner_guild: 'sun',
      stats: { attack: 11, defense: 12, speed: 9, charisma: 10, chaos: 9 },
    },
  };

  return {
    matchId,
    votedCatId,
    winningCatId,
    tournamentId,
    arenaPayload: {
      ok: true,
      arenas: [
        {
          tournament_id: tournamentId,
          type: 'main',
          date: new Date().toISOString().slice(0, 10),
          current_round: 1,
          status: 'active',
          champion: null,
          rounds: [{ round: 1, matches: [baseMatch] }],
        },
      ],
      voted_matches: { [matchId]: votedCatId },
      prediction_meta: {
        current_streak: 2,
        best_streak: 4,
        bonus_rolls: 0,
        streak_bonus_pct: 5,
      },
    },
    bracketPayload: {
      ok: true,
      tournament: { id: tournamentId, round: 1 },
      matches: [baseMatch],
    },
  };
}

async function installResultFixture(page: Page, opts: RevealCase) {
  const payload = buildResolvedMatchPayload(opts);

  await page.route('**/api/tournament/active*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload.arenaPayload),
    });
  });

  await page.route(`**/api/tournament/${payload.tournamentId}/bracket*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload.bracketPayload),
    });
  });

  // Keep hydration deterministic for queue-scoped vote hydration.
  await page.route('**/api/tournament/votes-for-matches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, votes: { [payload.matchId]: payload.votedCatId } }),
    });
  });
}

const CASES: RevealCase[] = [
  { name: 'vote-only win', boosted: false, win: true, bet: 0 },
  { name: 'vote-only loss', boosted: false, win: false, bet: 0 },
  { name: 'boosted win', boosted: true, win: true, bet: 12 },
  { name: 'boosted loss', boosted: true, win: false, bet: 12 },
];

for (const scenario of CASES) {
  test(`result reveal workflow: ${scenario.name}`, async ({ page }) => {
    // eslint-disable-next-line no-console
    console.log('[E2E][workflow-step] result-reveal-case:start', scenario);
    const diagnostics = startWorkflowDiagnostics(page);
    const creds = await resolveWorkflowCreds(page);
    await loginAsTestUser(page, creds);
    await installResultFixture(page, scenario);

    await openTournament(page, '');

    await expect(page.getByText(/Match Result:/i)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(scenario.win ? /Match Result: Win/i : /Match Result: Loss/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(scenario.boosted ? /Boost resolved/i : /Vote resolved/i)
    ).toBeVisible({ timeout: 10000 });

    if (scenario.boosted) {
      const expectedDelta = scenario.win ? `+${scenario.bet}` : `-${scenario.bet}`;
      await expect(page.getByText(`Sigils ${expectedDelta}`)).toBeVisible({ timeout: 10000 });
    }

    const continueCta = page.getByRole('button', { name: /continue/i }).first();
    await expect(continueCta).toBeVisible({ timeout: 10000 });
    await continueCta.click();

    await expect(page.getByText(/Match Result:/i)).toBeHidden({ timeout: 10000 });

    // refresh should not re-show same reveal (seen-guard)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);
    await expect(page.getByText(/Match Result:/i)).toBeHidden({ timeout: 10000 });

    await assertWorkflowHealthy(page, diagnostics);
    // eslint-disable-next-line no-console
    console.log('[E2E][workflow-step] result-reveal-case:done', scenario.name);
  });
}
