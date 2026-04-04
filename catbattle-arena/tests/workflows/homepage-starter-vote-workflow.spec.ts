import { expect, test } from '@playwright/test';
import { assertWorkflowHealthy, loginAsTestUser, logoutIfNeeded, resolveWorkflowCreds, startWorkflowDiagnostics } from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

function parseDebugLine(line: string) {
  const take = (key: string) => {
    const m = line.match(new RegExp(`${key}=([^\\s]+)`));
    return m ? m[1] : '';
  };
  return {
    source: take('source'),
    match: take('match'),
    active: Number(take('active') || 0),
    votable: Number(take('votable') || 0),
    unlocked: Number(take('unlocked') || 0),
    exhausted: take('exhausted'),
    empty: take('empty'),
  };
}

test('homepage starter vote renders live match when available or proves exhausted-empty', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  await logoutIfNeeded(page);

  await page.goto('http://localhost:3000/?fixture=1&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  const debug = page.getByTestId('homepage-starter-vote-debug');
  await expect(debug).toBeVisible({ timeout: 10000 });
  const raw = (await debug.textContent()) || '';
  const state = parseDebugLine(raw);
  // eslint-disable-next-line no-console
  console.log('[E2E][homepage-starter-debug]', state);

  const hasAnyCandidate = state.active > 0 || state.unlocked > 0 || state.votable > 0;
  const hasSelectedMatch = state.match && state.match !== 'none';
  const emptyCopy = page.getByText(/next battle loading/i);
  const voteButtons = page.locator('[data-testid="vote-a"], [data-testid="vote-b"]');

  if (hasAnyCandidate) {
    expect(hasSelectedMatch, `expected selected match when candidates exist: ${raw}`).toBeTruthy();
    await expect(voteButtons.first()).toBeVisible({ timeout: 10000 });
    await expect(emptyCopy).toHaveCount(0);
  } else {
    expect(state.exhausted === 'yes' || state.empty !== 'none', `empty requires proof from diagnostics: ${raw}`).toBeTruthy();
    await expect(emptyCopy).toBeVisible({ timeout: 10000 });
  }

  await assertWorkflowHealthy(page, diagnostics);
});

test('homepage first-vote hint appears once and clears after a successful homepage vote', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  const creds = await resolveWorkflowCreds(page);
  await logoutIfNeeded(page);
  await loginAsTestUser(page, creds);

  await page.goto('http://localhost:3000/?fixture=1&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.request.post('http://localhost:3000/api/dev/reset-votes').catch(() => null);
  await page.evaluate(() => {
    window.localStorage.removeItem('catclash_homepage_vote_hint_complete_v1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  const debug = page.getByTestId('homepage-starter-vote-debug');
  await expect(debug).toBeVisible({ timeout: 10000 });
  const state = parseDebugLine((await debug.textContent()) || '');
  expect(state.active > 0 || state.votable > 0 || state.unlocked > 0).toBeTruthy();

  const hint = page.getByTestId('homepage-vote-hint');
  await expect(hint).toBeVisible({ timeout: 10000 });

  const voteButton = page.locator('[data-testid="vote-a"], [data-testid="vote-b"]').first();
  await expect(voteButton).toBeVisible({ timeout: 10000 });
  await voteButton.click();

  await expect(page.getByText(/\+1 vote • streak started/i)).toBeVisible({ timeout: 10000 });
  await expect(hint).toBeHidden({ timeout: 10000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expect(page.getByTestId('homepage-vote-hint')).toHaveCount(0);

  await assertWorkflowHealthy(page, diagnostics);
});
