import { expect, test } from '@playwright/test';
import {
  assertWorkflowHealthy,
  dismissAuthGate,
  logoutIfNeeded,
  openTournament,
  startWorkflowDiagnostics,
  voteFirstAvailableMatch,
  waitForAuthGate,
} from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

test('new user onboarding workflow: guest vote opens and dismisses auth gate', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  await logoutIfNeeded(page);
  await openTournament(page);
  await voteFirstAvailableMatch(page);
  const gate = await waitForAuthGate(page);
  await expect(gate).toContainText(/save votes/i);
  await expect(gate).toContainText(/earn sigils/i);
  await expect(gate).toContainText(/build your flame/i);
  await dismissAuthGate(page);
  await assertWorkflowHealthy(page, diagnostics);
});
