import { expect, test, type Page } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');

function pushIssue(issues: string[], scope: string, detail: string) {
  issues.push(`[${scope}] ${detail}`);
}

async function dismissOnboardingIfPresent(page: Page) {
  const skipButton = page.getByRole('button', { name: /skip onboarding|skip tutorial/i }).first();
  if (await skipButton.count()) {
    await skipButton.click().catch(() => null);
    await page.waitForTimeout(250);
  }
}

async function ensurePageHealthy(page: Page, issues: string[], scope: string) {
  await page.waitForLoadState('domcontentloaded');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/application error|server error|failed to load chunk|500/i.test(bodyText)) {
    pushIssue(issues, scope, 'page rendered an application/server error state');
  }
}

async function gotoPath(page: Page, path: string, issues: string[], scope: string) {
  const res = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
  if (!res) {
    pushIssue(issues, scope, `navigation failed for ${path}`);
    return;
  }
  if (res.status() >= 400) {
    pushIssue(issues, scope, `${path} returned HTTP ${res.status()}`);
  }
  await ensurePageHealthy(page, issues, scope);
}

test('launch smoke workflow covers main CatClash user journey', async ({ page, request }) => {
  test.setTimeout(600_000);
  const issues: string[] = [];

  page.on('pageerror', (err) => {
    pushIssue(issues, 'runtime', `page error: ${String(err)}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!/favicon|Failed to load resource.*chrome-extension/i.test(text)) {
        pushIssue(issues, 'console', text);
      }
    }
  });

  await gotoPath(page, '/', issues, 'home');
  await dismissOnboardingIfPresent(page);
  const homeReady = await page.getByText(/Welcome to CatClash|Pick today'?s winner|Daily cat battles/i).first().isVisible({ timeout: 12_000 }).catch(() => false);
  const homeLoading = await page.getByText(/Gathering fighters|setting the stage/i).first().isVisible().catch(() => false);
  if (!homeReady) {
    if (homeLoading) {
      pushIssue(issues, 'home', 'homepage stayed in the loading state instead of revealing the main launch surface');
    } else {
      pushIssue(issues, 'home', 'homepage did not reveal the main launch surface');
    }
  }
  const onboardingStillBlocking = await page.getByRole('button', { name: /next|skip tutorial|skip onboarding/i }).first().isVisible().catch(() => false);
  if (onboardingStillBlocking) {
    pushIssue(issues, 'home', 'onboarding modal still visible after skip attempt');
  }

  const homeTournamentCta =
    page.getByRole('button', { name: /view tournament|open tournament|continue to tournament|follow the tournament/i }).first();
  if (await homeTournamentCta.count()) {
    await homeTournamentCta.click().catch(() => pushIssue(issues, 'home', 'main tournament CTA was visible but not clickable'));
  } else {
    pushIssue(issues, 'home', 'main tournament CTA was not found');
    await gotoPath(page, '/tournament', issues, 'tournament');
  }

  await page.waitForURL(/\/tournament(?:\/)?(?:\?.*)?$/, { timeout: 10_000 }).catch(() => {
    pushIssue(issues, 'home', 'main tournament CTA did not navigate to /tournament');
  });
  await ensurePageHealthy(page, issues, 'tournament');

  const activeRes = await request.get(`${BASE_URL}/api/tournament/active`);
  if (activeRes.status() !== 200) {
    pushIssue(issues, 'tournament', `/api/tournament/active returned ${activeRes.status()}`);
  }
  const activeJson = await activeRes.json().catch(() => null);

  const bracketCta = page.getByRole('link', { name: /view full bracket|view bracket/i }).first();
  if (await bracketCta.count()) {
    await expect(bracketCta).toBeVisible();
  } else {
    pushIssue(issues, 'tournament', 'bracket CTA was not visible on tournament page');
  }

  const voteAButton = page.getByRole('button', { name: /^Vote A$/i }).first();
  const voteBButton = page.getByRole('button', { name: /^Vote B$/i }).first();
  const anyVoteButton = await voteAButton.count() ? voteAButton : voteBButton;
  const tournamentUrlBeforeVote = page.url();

  if (await anyVoteButton.count()) {
    const enabled = await anyVoteButton.isEnabled().catch(() => false);
    if (!enabled) {
      pushIssue(issues, 'tournament', 'vote button is visible but disabled for a brand-new user');
    } else {
      const labelBefore = (await anyVoteButton.textContent().catch(() => '')) || '';
      await anyVoteButton.click().catch(() => pushIssue(issues, 'tournament', 'vote button click failed'));
      await page.waitForTimeout(1200);
      const labelAfter = (await anyVoteButton.textContent().catch(() => '')) || '';
      const voteFeedbackVisible = await page.getByText(/vote recorded|voted|already voted|thanks/i).first().isVisible().catch(() => false);
      if (!voteFeedbackVisible && labelBefore === labelAfter) {
        pushIssue(issues, 'tournament', 'vote click did not show success/duplicate feedback');
      }
      if (page.url() === tournamentUrlBeforeVote && labelBefore === labelAfter && !voteFeedbackVisible) {
        pushIssue(issues, 'tournament', 'vote did not appear to advance or update the spotlight state');
      }
    }
  } else {
    const votingPaused = await page.getByText(/Voting Paused|No open current-round matches|No votable matchups right now/i).first().isVisible().catch(() => false);
    if (!votingPaused) {
      pushIssue(issues, 'tournament', 'no vote controls found and no clear empty/paused state was shown');
    }
  }

  const candidate = (() => {
    const arenas = Array.isArray(activeJson?.arenas) ? activeJson.arenas : [];
    for (const arena of arenas) {
      const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
      for (const round of rounds) {
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        for (const match of matches) {
          const status = String(match?.status || '').toLowerCase();
          const matchId = String(match?.match_id || '');
          const catAId = String(match?.cat_a?.id || '');
          if (!matchId || !catAId) continue;
          if (status === 'complete' || status === 'completed') continue;
          return { matchId, catAId };
        }
      }
    }
    return null;
  })();

  if (candidate) {
    const firstVote = await request.post(`${BASE_URL}/api/vote`, {
      data: { match_id: candidate.matchId, voted_for: candidate.catAId },
    });
    const repeatVote = await request.post(`${BASE_URL}/api/vote`, {
      data: { match_id: candidate.matchId, voted_for: candidate.catAId },
    });
    const repeatJson = await repeatVote.json().catch(() => null);
    if (firstVote.status() !== 200) {
      pushIssue(issues, 'tournament', `initial API vote returned ${firstVote.status()}`);
    }
    if (repeatVote.status() !== 200 || !repeatJson?.alreadyVoted) {
      pushIssue(issues, 'tournament', 'repeat vote by same user was not blocked cleanly');
    }
  } else {
    pushIssue(issues, 'tournament', 'no votable match candidate found for repeat-vote smoke check');
  }

  if (await bracketCta.count()) {
    await bracketCta.click().catch(() => pushIssue(issues, 'tournament', 'bracket CTA was visible but not clickable'));
  } else {
    await gotoPath(page, '/tournament/bracket', issues, 'bracket');
  }

  await page.waitForURL(/\/tournament\/bracket(?:\/)?(?:\?.*)?$/, { timeout: 10_000 }).catch(() => {
    pushIssue(issues, 'bracket', 'did not navigate to /tournament/bracket');
  });
  await ensurePageHealthy(page, issues, 'bracket');
  const bracketLoaded = await page.getByText(/Tournament Map|Bracket Map|Back to Voting/i).first().isVisible({ timeout: 8_000 }).catch(() => false);
  const bracketUnavailable = await page.getByText(/Bracket unavailable|No bracket available yet/i).first().isVisible().catch(() => false);
  if (!bracketLoaded) {
    if (bracketUnavailable) {
      pushIssue(issues, 'bracket', 'bracket page loaded an unavailable/empty state instead of an interactive bracket');
    } else {
      pushIssue(issues, 'bracket', 'bracket page did not render its expected shell or empty-state copy');
    }
  } else {
    const bracketNode = page.locator('button.tournament-bracket-node').first();
    if (await bracketNode.count()) {
      const beforeDetail = await page.getByText(/Selected Match/i).first().innerText().catch(() => '');
      await bracketNode.click().catch(() => pushIssue(issues, 'bracket', 'bracket node click failed'));
      const detailVisible = await page.getByText(/Selected Match|Vote Split/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (!detailVisible) {
        pushIssue(issues, 'bracket', 'selected match detail did not appear after clicking a node');
      }
      const overlapOk = await bracketNode.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(x, y);
        return !!topEl && (topEl === node || node.contains(topEl));
      }).catch(() => false);
      if (!overlapOk) {
        pushIssue(issues, 'bracket', 'a bracket node appears to be overlapped or not topmost at its center point');
      }
      const afterDetail = await page.getByText(/Selected Match/i).first().innerText().catch(() => '');
      if (!beforeDetail && !afterDetail) {
        pushIssue(issues, 'bracket', 'selected-match detail did not appear after clicking a node');
      }
    } else {
      pushIssue(issues, 'bracket', 'no bracket nodes were rendered');
    }
  }

  const backToVoting = page.getByRole('link', { name: /back to voting/i }).first();
  if (await backToVoting.count()) {
    await backToVoting.click().catch(() => pushIssue(issues, 'bracket', 'Back to Voting link was visible but not clickable'));
    await page.waitForURL(/\/tournament(?:\/)?(?:\?.*)?$/, { timeout: 10_000 }).catch(() => {
      pushIssue(issues, 'bracket', 'Back to Voting did not navigate to /tournament');
    });
  }

  await gotoPath(page, '/gallery', issues, 'gallery');
  await expect(page.getByText(/Cat Gallery/i).first()).toBeVisible();
  const galleryCard = page.locator('[role="button"][aria-label^="Open "]').first();
  if (await galleryCard.count()) {
    await galleryCard.click().catch(() => pushIssue(issues, 'gallery', 'gallery card click failed'));
    await page.waitForURL(/\/cat\/.+/, { timeout: 10_000 }).catch(() => {
      pushIssue(issues, 'gallery', 'clicking a gallery card did not open a cat detail/profile route');
    });
    const helperCopyVisible = await page.getByText(/Click the cat to view more!/i).first().isVisible().catch(() => false);
    if (helperCopyVisible) {
      pushIssue(issues, 'gallery', 'helper copy still says "Click the cat to view more!" after navigation flow changed');
    }
  } else {
    const emptyGallery = await page.getByText(/no cats|Failed to load cats/i).first().isVisible().catch(() => false);
    if (!emptyGallery) {
      pushIssue(issues, 'gallery', 'gallery loaded without cards and without a clear empty/error state');
    }
  }

  await gotoPath(page, '/submit', issues, 'submit');
  await expect(page.getByText(/Upload your own cat photo|Choose a username to unlock submissions/i).first()).toBeVisible();
  const catNameInput = page.getByPlaceholder(/Sir Whiskers/i).first();
  if (await catNameInput.count()) {
    const editable = await catNameInput.isEditable().catch(() => false);
    if (!editable) {
      pushIssue(issues, 'submit', 'cat name input is present but not editable');
    }
  } else {
    pushIssue(issues, 'submit', 'cat name input was not found');
  }
  const rollStatsButton = page.getByRole('button', { name: /roll stats/i }).first();
  if (await rollStatsButton.count()) {
    const rollEnabled = await rollStatsButton.isEnabled().catch(() => false);
    if (!rollEnabled) {
      pushIssue(issues, 'submit', 'Roll Stats button is visible but disabled');
    }
  } else {
    pushIssue(issues, 'submit', 'Roll Stats button was not found');
  }

  await gotoPath(page, '/duel', issues, 'duel');
  const duelLoaded = await page.getByText(/Choose your defender cat|Challenge sent|No live duels|Failed to load Duel Arena/i).first().isVisible().catch(() => false);
  if (!duelLoaded) {
    pushIssue(issues, 'duel', 'duel page did not expose a clear primary state');
  }
  const deadDuelCta = await page.getByRole('button', { name: /create challenge/i }).first().isVisible().catch(() => false);
  if (deadDuelCta) {
    const enabled = await page.getByRole('button', { name: /create challenge/i }).first().isEnabled().catch(() => false);
    if (!enabled) {
      pushIssue(issues, 'duel', 'Create Challenge CTA is visible but disabled');
    }
  }

  await gotoPath(page, '/arena', issues, 'arena');
  await expect(page.getByText(/Whisker Arena|No snapshot configured|Choose Your Fighter/i).first()).toBeVisible();

  await gotoPath(page, '/', issues, 'nav');
  await dismissOnboardingIfPresent(page);

  const navGallery = page.getByTestId('nav-gallery').first();
  if (await navGallery.count()) {
    await navGallery.click().catch(() => pushIssue(issues, 'nav', 'Gallery nav link click failed'));
    await page.waitForURL(/\/gallery(?:\/)?(?:\?.*)?$/, { timeout: 10_000 }).catch(() => {
      pushIssue(issues, 'nav', 'Gallery nav link did not navigate to /gallery');
    });
  } else {
    pushIssue(issues, 'nav', 'gallery nav link was not found');
  }

  const navShop = page.getByTestId('nav-shop').first();
  if (await navShop.count()) {
    await navShop.click().catch(() => pushIssue(issues, 'nav', 'Shop nav link click failed'));
    await page.waitForURL(/\/shop(?:\/)?(?:\?.*)?$/, { timeout: 10_000 }).catch(() => {
      pushIssue(issues, 'nav', 'Shop nav link did not navigate to /shop');
    });
    await ensurePageHealthy(page, issues, 'shop');
    await expect(page.getByText(/Cosmetics Shop|My Profile Look/i).first()).toBeVisible();
  } else {
    pushIssue(issues, 'nav', 'shop nav link was not found');
  }

  const navProfile = page.getByTestId('nav-profile').first();
  if (await navProfile.count()) {
    await navProfile.click().catch(() => pushIssue(issues, 'nav', 'Profile nav link click failed'));
    await page.waitForURL(/\/(profile\/|login)/, { timeout: 10_000 }).catch(() => {
      pushIssue(issues, 'nav', 'Profile nav link did not navigate to /profile or /login');
    });
    await ensurePageHealthy(page, issues, 'profile');
  } else {
    pushIssue(issues, 'nav', 'profile nav link was not found');
  }

  expect(issues, issues.join('\n')).toEqual([]);
});
