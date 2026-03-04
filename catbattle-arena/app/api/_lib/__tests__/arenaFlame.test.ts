import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFlameTransition, getUtcDayKey, type FlameProgress, type FlameRow } from '../arenaFlame';

const qualifies: FlameProgress = {
  votesToday: 5,
  predictionsToday: 0,
  catsToday: 0,
  qualifiesToday: true,
};

test('first qualification sets dayCount=1 and state=active', () => {
  const now = new Date('2026-02-18T10:00:00.000Z');
  const row: FlameRow = {
    current_streak: 0,
    last_claim_date: null,
    flame_state: 'active',
    last_flame_date: null,
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.dayCount, 1);
  assert.equal(out.state, 'active');
  assert.equal(out.lastFlameDate, getUtcDayKey(now));
});

test('same-day repeated calls do not increment', () => {
  const now = new Date('2026-02-18T12:00:00.000Z');
  const row: FlameRow = {
    current_streak: 3,
    last_claim_date: '2026-02-18',
    flame_state: 'active',
    last_flame_date: '2026-02-18',
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.dayCount, 3);
  assert.equal(out.changed, false);
});

test('next-day qualification increments', () => {
  const now = new Date('2026-02-19T01:00:00.000Z');
  const row: FlameRow = {
    current_streak: 3,
    last_claim_date: '2026-02-18',
    flame_state: 'active',
    last_flame_date: '2026-02-18',
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.dayCount, 4);
  assert.equal(out.state, 'active');
  assert.equal(out.lastFlameDate, '2026-02-19');
});

test('miss a day enters fading and sets expires_at', () => {
  const now = new Date('2026-02-20T10:00:00.000Z');
  const row: FlameRow = {
    current_streak: 4,
    last_claim_date: '2026-02-18',
    flame_state: 'active',
    last_flame_date: '2026-02-18',
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.state, 'fading');
  assert.ok(out.fadingExpiresAt);
  assert.equal(out.dayCount, 4);
});

test('qualifying within fading window recovers active without resetting count', () => {
  const now = new Date('2026-02-20T12:00:00.000Z');
  const row: FlameRow = {
    current_streak: 4,
    last_claim_date: '2026-02-18',
    flame_state: 'fading',
    last_flame_date: '2026-02-18',
    fading_expires_at: '2026-02-20T18:00:00.000Z',
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.state, 'active');
  assert.equal(out.dayCount, 4);
  assert.equal(out.lastFlameDate, '2026-02-20');
  assert.equal(out.fadingExpiresAt, null);
});

test('fading expiry without qualification sets expired', () => {
  const now = new Date('2026-02-20T19:00:00.000Z');
  const row: FlameRow = {
    current_streak: 4,
    last_claim_date: '2026-02-18',
    flame_state: 'fading',
    last_flame_date: '2026-02-18',
    fading_expires_at: '2026-02-20T18:00:00.000Z',
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, {
    votesToday: 0,
    predictionsToday: 0,
    catsToday: 0,
    qualifiesToday: false,
  });
  assert.equal(out.state, 'expired');
});

test('qualifying after expired resets dayCount to 1', () => {
  const now = new Date('2026-02-21T09:00:00.000Z');
  const row: FlameRow = {
    current_streak: 9,
    last_claim_date: '2026-02-18',
    flame_state: 'expired',
    last_flame_date: '2026-02-18',
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.state, 'active');
  assert.equal(out.dayCount, 1);
  assert.equal(out.lastFlameDate, '2026-02-21');
});

test('legacy check-in streak does not carry over into Arena Flame day count', () => {
  const now = new Date('2026-02-21T09:00:00.000Z');
  const row: FlameRow = {
    current_streak: 6,
    last_claim_date: '2026-02-20',
    flame_state: 'active',
    last_flame_date: null,
    fading_expires_at: null,
    flame_heat: 0,
  };
  const out = computeFlameTransition(row, now, qualifies);
  assert.equal(out.state, 'active');
  assert.equal(out.dayCount, 1);
  assert.equal(out.lastFlameDate, '2026-02-21');
});

