#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SMOKE_URL || 'http://127.0.0.1:3000';

function softAssert(condition, message, failures) {
  if (condition) return;
  failures.push(message);
}

async function dumpClickFailure(page, locator, label) {
  let point = null;
  try {
    const box = await locator.boundingBox();
    if (box) point = { x: Math.floor(box.x + box.width / 2), y: Math.floor(box.y + box.height / 2) };
  } catch {
    // ignore
  }
  const probe = point
    ? await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const fixed = Array.from(document.querySelectorAll('body *')).filter((n) => {
        const s = getComputedStyle(n);
        if (s.position !== 'fixed') return false;
        if (s.pointerEvents === 'none') return false;
        const r = n.getBoundingClientRect();
        return r.width > window.innerWidth * 0.7 && r.height > 30;
      }).slice(0, 8).map((n) => {
        const s = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return {
          tag: n.tagName,
          className: String(n.className || ''),
          pointerEvents: s.pointerEvents,
          zIndex: s.zIndex,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      });
      return {
        point: { x, y },
        top: el ? {
          tag: el.tagName,
          className: String(el.className || ''),
          href: (el instanceof HTMLAnchorElement ? el.getAttribute('href') : el.closest('a')?.getAttribute('href')) || null,
        } : null,
        fixed,
      };
    }, point)
    : { point: null, top: null, fixed: [] };

  const outDir = path.join(process.cwd(), 'artifacts', 'screenshots');
  await mkdir(outDir, { recursive: true });
  const screenshotPath = path.join(outDir, `mobile-smoke-fail-${label}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  return { label, probe, screenshotPath };
}

async function clickWithRetry(page, locator, label) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await locator.scrollIntoViewIfNeeded().catch(() => null);
      await locator.click({ force: true });
      return { ok: true };
    } catch {
      if (attempt === 1) break;
      await page.waitForTimeout(300);
    }
  }
  const dump = await dumpClickFailure(page, locator, label);
  return { ok: false, dump };
}

async function swipeOnMatch(page, direction = 'left') {
  const card = page.locator('.arena-match-card').first();
  if ((await card.count()) === 0) return false;
  const box = await card.boundingBox();
  if (!box) return false;
  const startX = Math.floor(box.x + box.width * 0.65);
  const endX = direction === 'left'
    ? Math.floor(box.x + box.width * 0.2)
    : Math.floor(box.x + box.width * 0.82);
  const y = Math.floor(box.y + box.height * 0.45);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y + 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  return true;
}

async function scrollToCenter(locator) {
  await locator.evaluate((el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }).catch(() => null);
}

async function assertDuelLiveTabVisible(page, failures, contextLabel) {
  const duelTabLive = page.getByTestId('duel-tab-live').first();
  const visible = await duelTabLive.waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  softAssert(visible, `duel-tab-live is not visible after duel navigation (${contextLabel})`, failures);
}

async function diagnoseDuelRoute(page, failures, contextLabel) {
  let status = null;
  try {
    const response = await page.goto(`${baseUrl}/duel`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    status = response?.status?.() ?? null;
  } catch {
    status = null;
  }
  if (!(status && status >= 200 && status < 400)) {
    failures.push(`Direct /duel navigation failed (${contextLabel}, status=${status ?? 'no-response'})`);
    return false;
  }
  await assertDuelLiveTabVisible(page, failures, `${contextLabel}:direct-goto`);
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
  const page = await context.newPage();
  const failures = [];
  const debugDumps = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="nav-home"]', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1200);

    const navIds = [
      ['nav-home', '/'],
      ['nav-duel', '/duel'],
      ['nav-submit', '/submit'],
      ['nav-gallery', '/gallery'],
      ['nav-profile', '/profile'],
    ];

    // Nav should resolve to anchor at duel touch point.
    const navDuel = page.getByTestId('nav-duel').first();
    softAssert((await navDuel.count()) > 0, 'Missing nav-duel', failures);
    if ((await navDuel.count()) > 0) {
      await navDuel.scrollIntoViewIfNeeded();
      const box = await navDuel.boundingBox();
      if (box) {
        const duelProbe = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          return {
            tag: el.tagName,
            className: String(el.className || ''),
            href: (el instanceof HTMLAnchorElement ? el.getAttribute('href') : el.closest('a')?.getAttribute('href')) || null,
          };
        }, { x: Math.floor(box.x + box.width / 2), y: Math.floor(box.y + box.height / 2) });
        softAssert(duelProbe?.tag === 'A' || !!duelProbe?.href, `Duel probe was not anchor (${JSON.stringify(duelProbe)})`, failures);
      }
    }

    // Tap each bottom nav item 3 times.
    for (const [testId, expected] of navIds) {
      const item = page.getByTestId(String(testId)).first();
      softAssert((await item.count()) > 0, `Missing ${testId}`, failures);
      if ((await item.count()) === 0) continue;
      for (let i = 0; i < 3; i += 1) {
        await item.scrollIntoViewIfNeeded();
        const clickResult = await clickWithRetry(page, item, `nav-${testId}`);
        if (!clickResult.ok) {
          failures.push(`Click failed for ${testId}`);
          if (clickResult.dump) debugDumps.push(clickResult.dump);
          break;
        }
        await page.waitForLoadState('domcontentloaded').catch(() => null);
      }
      if (expected === '/profile') {
        const ok = await page.waitForURL((url) => url.pathname.startsWith('/profile') || url.pathname.startsWith('/login'), { timeout: 8000 }).then(() => true).catch(() => false);
        softAssert(ok, `Nav ${testId} did not navigate to profile/login (url=${page.url()})`, failures);
      } else {
        const ok = await page.waitForURL((url) => url.pathname.startsWith(expected), { timeout: 8000 }).then(() => true).catch(() => false);
        if (!ok) {
          failures.push(`Nav ${testId} did not navigate (url=${page.url()})`);
          const dump = await dumpClickFailure(page, item, `nav-${testId}-no-nav`);
          debugDumps.push(dump);
          if (testId === 'nav-duel') {
            await diagnoseDuelRoute(page, failures, 'nav-duel-failure');
          }
        }
      }
    }

    // Home then Open Duel Arena CTA.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const openDuelLive = page.getByTestId('open-duel-arena-cta-live').first();
    const openDuelArenas = page.getByTestId('open-duel-arena-cta-arenas').first();
    const liveVisible = await openDuelLive.isVisible().catch(() => false);
    const arenasVisible = await openDuelArenas.isVisible().catch(() => false);
    if (liveVisible) {
      await scrollToCenter(openDuelLive);
      try {
        const clickResult = await clickWithRetry(page, openDuelLive, 'open-duel-arena-live');
        if (!clickResult.ok) {
          failures.push('open-duel-arena-cta-live click failed');
          if (clickResult.dump) debugDumps.push(clickResult.dump);
        } else {
          const ok = await page.waitForURL('**/duel**', { timeout: 6000 }).then(() => true).catch(() => false);
          if (!ok) {
            failures.push('open-duel-arena-cta-live did not navigate to /duel');
            const dump = await dumpClickFailure(page, openDuelLive, 'open-duel-arena-live-no-nav');
            debugDumps.push(dump);
            await diagnoseDuelRoute(page, failures, 'open-duel-arena-live-failure');
          } else {
            await assertDuelLiveTabVisible(page, failures, 'live-cta');
          }
        }
      } catch {
        failures.push('open-duel-arena-cta-live did not navigate to /duel');
        const dump = await dumpClickFailure(page, openDuelLive, 'open-duel-arena-live-exception');
        debugDumps.push(dump);
        await diagnoseDuelRoute(page, failures, 'open-duel-arena-live-exception');
      }
    } else if (arenasVisible) {
      await scrollToCenter(openDuelArenas);
      try {
        const clickResult = await clickWithRetry(page, openDuelArenas, 'open-duel-arena-arenas');
        if (!clickResult.ok) {
          failures.push('open-duel-arena-cta-arenas click failed');
          if (clickResult.dump) debugDumps.push(clickResult.dump);
        } else {
          const ok = await page.waitForURL('**/duel**', { timeout: 6000 }).then(() => true).catch(() => false);
          if (!ok) {
            failures.push('open-duel-arena-cta-arenas did not navigate to /duel');
            const dump = await dumpClickFailure(page, openDuelArenas, 'open-duel-arena-arenas-no-nav');
            debugDumps.push(dump);
            await diagnoseDuelRoute(page, failures, 'open-duel-arena-arenas-failure');
          } else {
            await assertDuelLiveTabVisible(page, failures, 'arenas-cta');
          }
        }
      } catch {
        failures.push('open-duel-arena-cta-arenas did not navigate to /duel');
        const dump = await dumpClickFailure(page, openDuelArenas, 'open-duel-arena-arenas-exception');
        debugDumps.push(dump);
        await diagnoseDuelRoute(page, failures, 'open-duel-arena-arenas-exception');
      }
    } else {
      const fallbackCta = page.getByText(/Open Duel Arena/i).first();
      if ((await fallbackCta.count()) > 0) {
        await scrollToCenter(fallbackCta);
        try {
          const clickResult = await clickWithRetry(page, fallbackCta, 'open-duel-arena-fallback');
          if (!clickResult.ok) {
            failures.push('Fallback Open Duel Arena CTA click failed');
            if (clickResult.dump) debugDumps.push(clickResult.dump);
          } else {
            await page.waitForURL('**/duel**', { timeout: 6000 });
            await assertDuelLiveTabVisible(page, failures, 'fallback-cta');
          }
        } catch {
          failures.push('Fallback Open Duel Arena CTA did not navigate to /duel');
        }
      } else {
        // Optional in low-inventory/temporary loading states.
      }
    }

    // Swipe vote check (best effort; only when an active card exists).
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const preVoteCardCount = await page.locator('.arena-match-card').count();
    const didSwipe = await swipeOnMatch(page, 'left');
    if (didSwipe) {
      await page.waitForTimeout(300);
      const midVoteCardCount = await page.locator('.arena-match-card').count();
      const midVoteLabel = page.getByText(/Submitting…|Voted ✅|Voted ✓|Voted A|Voted B/i).first();
      const midVoteSignal = (await midVoteLabel.count()) > 0 || midVoteCardCount >= Math.max(1, preVoteCardCount - 1);
      softAssert(midVoteSignal, 'Vote looked instant with no visible pending/confirmed feedback at 300ms', failures);
      const votedBadge = page.getByText(/Voted ✅|Voted ✓|Voted A|Voted B/i).first();
      softAssert((await votedBadge.count()) > 0, 'No voted confirmation visible after swipe vote', failures);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const stillVoted = page.getByText(/Voted ✅|Voted ✓|Voted A|Voted B/i).first();
      softAssert((await stillVoted.count()) > 0, 'Voted state did not persist after swipe vote refresh', failures);
      const voteMapSize = await page.evaluate(() => {
        try {
          const raw = window.localStorage.getItem('catclash:voted_matches:v1');
          if (!raw) return 0;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return 0;
          return Object.keys(parsed).length;
        } catch {
          return 0;
        }
      });
      softAssert(voteMapSize > 0, 'Voted map in localStorage is empty after vote + refresh', failures);

      const remainingCards = await page.locator('.arena-match-card').count();
      if (remainingCards === 0) {
        const caughtUp = page.getByText(/You’ve voted on all matches for today|You've voted on all matches for today/i).first();
        softAssert((await caughtUp.count()) > 0, 'Expected all-caught-up message when voting feed is empty', failures);
        const wrongEmpty = page.getByText(/No active main arena today|No active rookie arena today/i).first();
        softAssert((await wrongEmpty.count()) === 0, 'Incorrect global no-active-arena empty state shown after voting out feed', failures);
      }
    }

    // Rematch smoke (best effort; requires at least one completed duel where current actor is a participant).
    await page.goto(`${baseUrl}/duel`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await assertDuelLiveTabVisible(page, failures, 'rematch-entry');

    const resultsTab = page.getByTestId('duel-tab-results').first();
    if ((await resultsTab.count()) === 0) {
      failures.push('Missing duel-tab-results on /duel');
    } else {
      await resultsTab.scrollIntoViewIfNeeded();
      const tabClick = await clickWithRetry(page, resultsTab, 'duel-tab-results');
      if (!tabClick.ok) {
        failures.push('duel-tab-results click failed');
        if (tabClick.dump) debugDumps.push(tabClick.dump);
      } else {
        await page.waitForURL((url) => url.pathname.startsWith('/duel') && url.searchParams.get('tab') === 'results', { timeout: 7000 }).catch(() => {
          failures.push(`duel-tab-results did not activate (url=${page.url()})`);
        });
      }
    }

    const openDuelAny = page.locator('[data-testid^="open-duel-link-"]').first();
    if ((await openDuelAny.count()) > 0) {
      await openDuelAny.scrollIntoViewIfNeeded();
      const clickResult = await clickWithRetry(page, openDuelAny, 'open-duel-link');
      if (!clickResult.ok) {
        failures.push('Open Duel link click failed');
        if (clickResult.dump) debugDumps.push(clickResult.dump);
      } else {
        await page.waitForURL((url) => {
          if (!url.pathname.startsWith('/duel') && !url.pathname.startsWith('/d/')) return false;
          const tab = url.searchParams.get('tab');
          const duelId = url.searchParams.get('duel');
          return !!duelId || tab === 'live' || tab === 'pending' || tab === 'results' || url.pathname.startsWith('/d/');
        }, { timeout: 7000 }).catch(() => {
          failures.push(`Open Duel link did not navigate (url=${page.url()})`);
        });
      }
    } else {
      console.log('SKIP: no completed duels available for rematch test');
    }

    const rematchButton = page.getByRole('button', { name: /^Rematch$/i }).first();
    if ((await rematchButton.count()) > 0) {
      const clickResult = await clickWithRetry(page, rematchButton, 'rematch-button');
      if (!clickResult.ok) {
        failures.push('Rematch click failed');
        if (clickResult.dump) debugDumps.push(clickResult.dump);
      }
      const rematchSignal = page.getByText(/Rematch sent|Challenge sent|pending/i).first();
      softAssert((await rematchSignal.count()) > 0, 'Rematch click did not produce a success signal', failures);
    } else {
      console.log('SKIP: no completed duels available for rematch test');
    }

    // Claim prompt (optional): verify CTA and Later are clickable when present.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const claimLater = page.getByTestId('claim-name-later').first();
    const claimCta = page.getByTestId('claim-name-cta').first();
    if ((await claimLater.count()) > 0 && (await claimLater.isVisible().catch(() => false))) {
      const clickResult = await clickWithRetry(page, claimLater, 'claim-name-later');
      if (!clickResult.ok) {
        failures.push('Claim prompt Later click failed');
        if (clickResult.dump) debugDumps.push(clickResult.dump);
      }
      await page.waitForTimeout(400);
    }
    if ((await claimCta.count()) > 0 && (await claimCta.isVisible().catch(() => false))) {
      // Do not force login flow in smoke; just validate click target responds by navigation intent.
      const href = await claimCta.getAttribute('href');
      softAssert(String(href || '').includes('/login'), `Claim CTA href unexpected (${href})`, failures);
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('Mobile smoke failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    if (debugDumps.length > 0) {
      console.error('Debug dumps:');
      for (const dump of debugDumps) {
        console.error(JSON.stringify(dump));
      }
    }
    process.exit(1);
  }
  console.log('Mobile smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
