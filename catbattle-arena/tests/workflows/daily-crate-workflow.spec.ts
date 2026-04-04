import { test } from '@playwright/test';
import { assertWorkflowHealthy, openDailyCrate, startWorkflowDiagnostics } from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

test('daily crate workflow opens crate screen', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  await openDailyCrate(page);
  await assertWorkflowHealthy(page, diagnostics);
});
