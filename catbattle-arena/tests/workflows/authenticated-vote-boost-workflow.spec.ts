import { expect, test } from '@playwright/test';
import {
  assertWorkflowHealthy,
  boostCurrentPick,
  loginAsTestUser,
  openTournament,
  resolveWorkflowCreds,
  startWorkflowDiagnostics,
  voteFirstAvailableMatch,
} from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

test('authenticated vote + boost workflow', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  const creds = await resolveWorkflowCreds(page);
  await loginAsTestUser(page, creds);
  await openTournament(page);
  await voteFirstAvailableMatch(page);
  const authGate = page.getByTestId('vote-auth-gate');
  if (await authGate.count()) {
    await expect(page.getByTestId('vote-auth-gate-cta')).toBeVisible({ timeout: 10000 });
    await loginAsTestUser(page, creds);
    await openTournament(page);
    await voteFirstAvailableMatch(page);
  }
  await expect(page.locator('[data-testid^="vote-a-"], [data-testid^="vote-b-"], [data-testid="vote-a"], [data-testid="vote-b"]').first()).toBeVisible({ timeout: 10000 });
  await boostCurrentPick(page);
  await assertWorkflowHealthy(page, diagnostics);
});
