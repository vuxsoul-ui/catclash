import { expect, test } from '@playwright/test';
import {
  assertWorkflowHealthy,
  loginAsTestUser,
  logoutIfNeeded,
  openTournament,
  resolveWorkflowCreds,
  startWorkflowDiagnostics,
  voteFirstAvailableMatch,
  waitForAuthGate,
} from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

test('auth gate + resume vote workflow', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  const creds = await resolveWorkflowCreds(page);
  await logoutIfNeeded(page);
  await openTournament(page);
  await voteFirstAvailableMatch(page);
  await waitForAuthGate(page);

  const gateCta = page.getByTestId('vote-auth-gate-cta');
  await expect(gateCta).toBeVisible({ timeout: 10000 });
  const href = (await gateCta.getAttribute('href')) || '';
  expect(href).toContain('/login?next=');
  const nextDecoded = decodeURIComponent(href.split('next=')[1] || '');
  expect(nextDecoded).toContain('resume_vote_match=');
  expect(nextDecoded).toContain('resume_vote_cat=');

  await gateCta.click({ force: true });
  await loginAsTestUser(page, creds);
  await assertWorkflowHealthy(page, diagnostics);
});
