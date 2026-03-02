import assert from "node:assert/strict";
import test from "node:test";
import { computeArenaUtcContext } from "../arena-active";

test("computeArenaUtcContext keeps UTC day key near midnight before rollover", () => {
  const now = new Date("2026-02-21T23:59:59.900Z");
  const out = computeArenaUtcContext(now);
  assert.equal(out.dayKeyUtc, "2026-02-21");
  assert.equal(out.pulseWindow.startUtc, "2026-02-21T00:00:00.000Z");
  assert.equal(out.pulseWindow.endUtc, "2026-02-22T00:00:00.000Z");
});

test("computeArenaUtcContext rolls to next UTC day immediately after midnight", () => {
  const now = new Date("2026-02-22T00:00:00.100Z");
  const out = computeArenaUtcContext(now);
  assert.equal(out.dayKeyUtc, "2026-02-22");
  assert.equal(out.pulseWindow.startUtc, "2026-02-22T00:00:00.000Z");
  assert.equal(out.pulseWindow.endUtc, "2026-02-23T00:00:00.000Z");
});
