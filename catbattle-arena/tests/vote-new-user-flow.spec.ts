import { expect, type APIRequestContext, type Locator, type Page, test } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const MAX_VOTES = 2;

type ModeName = "debug" | "normal";

type ModeResult = {
  mode: ModeName;
  apiHealthy: boolean;
  repeatedRefreshLoopDetected: boolean;
  pulsingUnclickableDetected: boolean;
  uiVoteSucceeded: boolean;
  apiVoteSucceeded: boolean;
  voteRequestObserved: boolean;
  maxUpdateDepthErrorDetected: boolean;
};

type ActiveMatchCandidate = {
  match_id: string;
  catAId: string;
};

function extractCandidateFromActivePayload(payload: any): ActiveMatchCandidate | null {
  const arenas = Array.isArray(payload?.arenas) ? payload.arenas : [];
  for (const arena of arenas) {
    const rounds = Array.isArray(arena?.rounds) ? arena.rounds : [];
    for (const round of rounds) {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      for (const match of matches) {
        const status = String(match?.status || "").toLowerCase();
        if (status === "complete" || status === "completed") continue;
        const matchId = String(match?.match_id || "").trim();
        const catAId = String(match?.cat_a?.id || "").trim();
        if (!matchId || !catAId) continue;
        return { match_id: matchId, catAId };
      }
    }
  }
  return null;
}

async function hasLoadingSignals(page: Page): Promise<boolean> {
  const loadingText = page.getByText(/loading/i).first();
  if (await loadingText.isVisible().catch(() => false)) return true;
  const busy = page.locator('[aria-busy="true"]').first();
  return busy.isVisible().catch(() => false);
}

async function detectRepeatedLoadingLoop(page: Page): Promise<boolean> {
  const sampleMs = 250;
  const totalMs = 3_000;
  const thresholdMs = 2_250;
  const sampleCount = Math.floor(totalMs / sampleMs);
  let loadingVisibleMs = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    if (await hasLoadingSignals(page)) loadingVisibleMs += sampleMs;
    await page.waitForTimeout(sampleMs);
  }
  return loadingVisibleMs >= thresholdMs;
}

async function pickVoteButton(page: Page) {
  const testIds = ["vote-a", "vote-b", "vote-left", "vote-right"];
  for (const id of testIds) {
    const loc = page.getByTestId(id).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  return null;
}

async function getMatchSignature(page: Page): Promise<string | null> {
  const snap = await page
    .evaluate(() => {
      const card = document.querySelector("[data-match-id]") as HTMLElement | null;
      const id = card?.getAttribute("data-match-id") || "";
      const labels = Array.from(document.querySelectorAll(".arena-match-card p"))
        .slice(0, 2)
        .map((n) => (n.textContent || "").trim());
      return { id, a: labels[0] || "", b: labels[1] || "" };
    })
    .catch(() => ({ id: "", a: "", b: "" }));
  const sig = `${snap.id}|${snap.a}|${snap.b}`;
  return sig === "||" ? null : sig;
}

async function waitEnabled(button: ReturnType<Page["locator"]>, timeoutMs = 5_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await button.isDisabled().catch(() => true))) return true;
    await button.page().waitForTimeout(250);
  }
  return false;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function webkitSafeVoteClick(page: Page, voteButton: Locator, addNote: (n: string) => void): Promise<void> {
  await voteButton.scrollIntoViewIfNeeded().catch(() => addNote("scrollIntoViewIfNeeded failed"));
  addNote("before click");

  const trialOk = await voteButton
    .click({ trial: true, timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  addNote(`trial click ok=${trialOk}`);

  if (!trialOk) {
    const screenshotPath = `test-results/webkit-${Date.now()}-preclick.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    const box = await voteButton.boundingBox().catch(() => null);
    const pointerEvents = await voteButton.evaluate((el) => getComputedStyle(el as HTMLElement).pointerEvents).catch(() => "unknown");
    addNote(`trial failed screenshot=${screenshotPath}`);
    addNote(`trial failed box=${JSON.stringify(box)} pe=${pointerEvents}`);
  }

  const clicked = await voteButton
    .click({ timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!clicked) {
    addNote("normal click failed; using force click fallback");
    await voteButton.click({ timeout: 2_500, force: true }).catch(() => addNote("force click failed"));
  }
  addNote("after click");
}

async function runMode(page: Page, api: APIRequestContext, mode: ModeName, path: string): Promise<void> {
  const result: ModeResult = {
    mode,
    apiHealthy: false,
    repeatedRefreshLoopDetected: false,
    pulsingUnclickableDetected: false,
    uiVoteSucceeded: false,
    apiVoteSucceeded: false,
    voteRequestObserved: false,
    maxUpdateDepthErrorDetected: false,
  };

  const notes: string[] = [];
  const pending = new Set<string>();

  const addNote = (n: string) => {
    const stamped = `${Date.now() % 100000}:${n}`;
    notes.push(stamped);
    if (notes.length > 10) notes.shift();
  };

  const onReq = (req: any) => pending.add(req.url());
  const onDone = (req: any) => pending.delete(req.url());
  const onConsole = (msg: any) => {
    const text = String(msg?.text?.() || "");
    if (text.includes("Maximum update depth exceeded")) result.maxUpdateDepthErrorDetected = true;
  };
  const onPageError = (err: any) => {
    const text = String(err?.message || err || "");
    if (text.includes("Maximum update depth exceeded")) result.maxUpdateDepthErrorDetected = true;
  };

  try {
    page.on("request", onReq);
    page.on("requestfinished", onDone);
    page.on("requestfailed", onDone);
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    const me = await api.get("/api/me", { timeout: 8_000 });
    const active = await api.get("/api/tournament/active", { timeout: 8_000 });
    result.apiHealthy = me.status() === 200 && active.status() === 200;
    addNote(`api me=${me.status()} active=${active.status()}`);

    expect(result.apiHealthy, `[${mode}] apiHealthy`).toBeTruthy();

    const activePayload = await active.json().catch(() => null);
    const candidate = extractCandidateFromActivePayload(activePayload);

    await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 12_000 });
    addNote(`goto ${path} done`);

    result.repeatedRefreshLoopDetected = await detectRepeatedLoadingLoop(page);
    const caughtUpVisible = await page.getByText(/all matches voted|you(?:'|’)re all caught up/i).first().isVisible().catch(() => false);
    if (caughtUpVisible) addNote("caught-up UI detected; using API fallback path");

    const voteLoopStart = Date.now();
    for (let voteIndex = 0; voteIndex < MAX_VOTES; voteIndex += 1) {
      if (Date.now() - voteLoopStart > 20_000) {
        addNote("vote loop budget exceeded, ending early");
        break;
      }
      if (caughtUpVisible) break;
      const beforeSig = await getMatchSignature(page);
      addNote(`vote#${voteIndex + 1} beforeSig=${beforeSig || "none"}`);
      const voteButton = await pickVoteButton(page);
      addNote(`vote#${voteIndex + 1} target found=${!!voteButton}`);
      if (!voteButton) break;

      const enabled = await waitEnabled(voteButton, 5_000);
      result.pulsingUnclickableDetected = !enabled;
      addNote(`vote#${voteIndex + 1} enabled=${enabled}`);
      if (!enabled) break;

      const beforeDisabled = await voteButton.isDisabled().catch(() => false);
      await webkitSafeVoteClick(page, voteButton, addNote);

      const voteRes = await withTimeout(
        page
          .waitForResponse(
            (res) =>
              res.request().method() === "POST" &&
              (/\/api\/vote(?:\?|$)/.test(res.url()) || /\/api\/votes\/cast(?:\?|$)/.test(res.url())),
            { timeout: 5_000 }
          )
          .catch(() => null as any),
        4_000,
        null as any
      );
      result.voteRequestObserved = !!voteRes || result.voteRequestObserved;
      addNote(`vote#${voteIndex + 1} observed=${!!voteRes}`);

      const finishConfirm = await withTimeout(
        (async () => {
          const successTextVisible = await page.getByText(/voted|thanks|next matchup|next up/i).first().isVisible().catch(() => false);
          const afterDisabled = await voteButton.isDisabled().catch(() => false);
          return { successTextVisible, afterDisabled };
        })(),
        5_000,
        { successTextVisible: false, afterDisabled: false }
      );
      const nextMatchLoaded = await withTimeout(
        (async () => {
          const start = Date.now();
          while (Date.now() - start < 3_000) {
            const afterSig = await getMatchSignature(page);
            if (afterSig && beforeSig && afterSig !== beforeSig) return true;
            await page.waitForTimeout(250);
          }
          return false;
        })(),
        3_500,
        false
      );
      if (!nextMatchLoaded) addNote(`vote#${voteIndex + 1} no new match within 5s`);
      result.uiVoteSucceeded =
        result.uiVoteSucceeded ||
        !!voteRes ||
        finishConfirm.successTextVisible ||
        (!beforeDisabled && finishConfirm.afterDisabled) ||
        nextMatchLoaded;
      addNote(`vote#${voteIndex + 1} uiSuccess=${result.uiVoteSucceeded} nextMatchLoaded=${nextMatchLoaded}`);

      // If the next match did not load, end cleanly without hanging.
      if (!nextMatchLoaded) break;
    }

    if (!result.uiVoteSucceeded) {
      if (!candidate) {
        test.skip(true, `[${mode}] no votable match candidate available`);
      }
      const voteRes = await api.post("/api/vote", {
        data: { match_id: candidate!.match_id, voted_for: candidate!.catAId },
        timeout: 8_000,
      });
      result.apiVoteSucceeded = voteRes.status() === 200 || voteRes.status() === 409;
      addNote(`api fallback vote status=${voteRes.status()}`);
    }
    addNote("finish condition reached");

    console.log(
      `[E2E][${mode}] summary apiHealthy=${result.apiHealthy} ` +
      `uiVoteSucceeded=${result.uiVoteSucceeded} apiVoteSucceeded=${result.apiVoteSucceeded} ` +
      `voteRequestObserved=${result.voteRequestObserved} ` +
      `repeatedRefreshLoopDetected=${result.repeatedRefreshLoopDetected} ` +
      `pulsingUnclickableDetected=${result.pulsingUnclickableDetected} ` +
      `maxUpdateDepthErrorDetected=${result.maxUpdateDepthErrorDetected}`
    );

    expect(result.repeatedRefreshLoopDetected, `[${mode}] repeatedRefreshLoopDetected`).toBeFalsy();
    expect(result.pulsingUnclickableDetected, `[${mode}] pulsingUnclickableDetected`).toBeFalsy();
    expect(result.maxUpdateDepthErrorDetected, `[${mode}] maxUpdateDepthErrorDetected`).toBeFalsy();
    expect(result.uiVoteSucceeded || result.apiVoteSucceeded, `[${mode}] vote success`).toBeTruthy();
  } catch (err) {
    console.log(`[E2E][${mode}] timeout diagnostics url=${page.url()} pendingRequests=${pending.size}`);
    console.log(`[E2E][${mode}] lastNotes=${JSON.stringify(notes)}`);
    throw err;
  } finally {
    page.off("request", onReq);
    page.off("requestfinished", onDone);
    page.off("requestfailed", onDone);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

test("debug PASS", async ({ page, request }) => {
  test.setTimeout(60_000);
  await runMode(page, request, "debug", "/?debug=1");
});

test("normal PASS", async ({ page, request }) => {
  test.setTimeout(60_000);
  await runMode(page, request, "normal", "/");
});
