import assert from "node:assert/strict";
import test from "node:test";
import { computeArenaUtcContext } from "../arena-active";

test("computeArenaUtcContext falls back to the weekly pulse key before rollover", async () => {
  const now = new Date("2026-02-21T23:59:59.900Z");
  const out = await computeArenaUtcContext(now);
  assert.equal(out.dayKeyUtc, "2026-02-23");
  assert.equal(out.pulseWindow.startUtc, "2026-02-16T00:00:00.000Z");
  assert.equal(out.pulseWindow.endUtc, "2026-02-23T00:00:00.000Z");
});

test("computeArenaUtcContext keeps the same weekly pulse key after midnight until resolve", async () => {
  const now = new Date("2026-02-22T00:00:00.100Z");
  const out = await computeArenaUtcContext(now);
  assert.equal(out.dayKeyUtc, "2026-02-23");
  assert.equal(out.pulseWindow.startUtc, "2026-02-16T00:00:00.000Z");
  assert.equal(out.pulseWindow.endUtc, "2026-02-23T00:00:00.000Z");
});
