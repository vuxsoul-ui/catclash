import { expect, test } from '@playwright/test';
import { assertWorkflowHealthy, openTournament, startWorkflowDiagnostics } from '../helpers/workflows';

test.use({ viewport: { width: 390, height: 844 } });

test('tournament count accuracy workflow', async ({ page }) => {
  const diagnostics = startWorkflowDiagnostics(page);
  // eslint-disable-next-line no-console
  console.log('[E2E][workflow-step] tournament-count-accuracy:start');

  await openTournament(page, '?fixture=1&debug=1');

  const debugNode = page.getByTestId('tournament-count-debug');
  await expect(debugNode).toBeVisible({ timeout: 10000 });

  const debugText = await debugNode.innerText();
  const votedUi = Number((debugText.match(/voted=(\d+)/)?.[1] || '0').trim());
  const openUi = Number((debugText.match(/open=(\d+)/)?.[1] || '0').trim());

  const debugSnapshot = await page.evaluate(() => {
    const payload = (window as any).__catclashTournamentDebug;
    if (!payload) return null;
    return {
      currentRoundTotal: Number(payload.currentRoundTotal || 0),
      votedCount: Number(payload.votedCount || 0),
      openCount: Number(payload.openCount || 0),
      resolvedCount: Number(payload.resolvedCount || 0),
      lockedRemainingCount: Number(payload.lockedRemainingCount || 0),
      countdownTarget: payload.countdownTarget || null,
      countdownMsRemaining: Number(payload.countdownMsRemaining || 0),
      countdownEndsAt: payload.countdownEndsAt || null,
      countFormulaValid: Boolean(payload.countFormulaValid),
      pulseState: String(payload.pulseState || ''),
      resultRevealVisible: Boolean(payload.resultRevealVisible),
      matchResultRevealVisible: Boolean(payload.matchResultRevealVisible),
    };
  });

  expect(debugSnapshot, 'missing window.__catclashTournamentDebug snapshot').toBeTruthy();
  expect(votedUi).toBe(debugSnapshot!.votedCount);
  expect(openUi).toBe(debugSnapshot!.openCount);

  const expectedTotal = debugSnapshot!.votedCount + debugSnapshot!.openCount + debugSnapshot!.lockedRemainingCount;
  expect(debugSnapshot!.currentRoundTotal).toBe(expectedTotal);
  expect(debugSnapshot!.countFormulaValid).toBe(true);
  expect(debugSnapshot!.resolvedCount).toBeGreaterThanOrEqual(0);

  expect(debugSnapshot!.countdownMsRemaining).toBeGreaterThanOrEqual(0);
  expect(debugSnapshot!.countdownEndsAt, 'countdownEndsAt should exist').toBeTruthy();

  if (debugSnapshot!.pulseState !== 'resolving') {
    expect(debugSnapshot!.countdownTarget, 'countdown target should exist outside resolving state').toBeTruthy();
  }
  if (debugSnapshot!.pulseState === 'resolving') {
    expect(typeof debugSnapshot!.resultRevealVisible).toBe('boolean');
    expect(typeof debugSnapshot!.matchResultRevealVisible).toBe('boolean');
  }

  await assertWorkflowHealthy(page, diagnostics);
  // eslint-disable-next-line no-console
  console.log('[E2E][workflow-step] tournament-count-accuracy:done', debugSnapshot);
});
