const VOTE_STATE_KEY_PREFIX = 'catclash:voted_matches:v1';

export type VotedMatchMap = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeVotedMap(input: unknown): VotedMatchMap {
  if (!isRecord(input)) return {};
  const out: VotedMatchMap = {};
  for (const [matchId, catId] of Object.entries(input)) {
    const m = String(matchId || '').trim();
    const c = String(catId || '').trim();
    if (!m || !c) continue;
    out[m] = c;
  }
  return out;
}

export function mergeVotedMaps(a: unknown, b: unknown): VotedMatchMap {
  return { ...normalizeVotedMap(a), ...normalizeVotedMap(b) };
}

export function upsertVotedMatch(map: unknown, matchId: string, catId: string): VotedMatchMap {
  const next = normalizeVotedMap(map);
  const m = String(matchId || '').trim();
  const c = String(catId || '').trim();
  if (!m || !c) return next;
  next[m] = c;
  return next;
}

export function removeVotedMatch(map: unknown, matchId: string): VotedMatchMap {
  const next = normalizeVotedMap(map);
  delete next[String(matchId || '').trim()];
  return next;
}

function scopedVoteKey(scope?: string | null): string {
  const clean = String(scope || '').trim();
  if (!clean) return `${VOTE_STATE_KEY_PREFIX}::global`;
  return `${VOTE_STATE_KEY_PREFIX}::${clean}`;
}

export function readVotedMatchesFromStorage(scope?: string | null): VotedMatchMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(scopedVoteKey(scope));
    if (!raw) return {};
    return normalizeVotedMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeVotedMatchesToStorage(map: unknown, scope?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedVoteKey(scope), JSON.stringify(normalizeVotedMap(map)));
  } catch {
    // ignore storage errors
  }
}

let voteChecksRan = false;
export function runVoteStateChecks(): void {
  if (voteChecksRan || process.env.NODE_ENV === 'production') return;
  voteChecksRan = true;
  const one = upsertVotedMatch({}, 'm1', 'c1');
  console.assert(one.m1 === 'c1', '[DEV_CHECK] upsertVotedMatch should write match choice');
  const two = removeVotedMatch(one, 'm1');
  console.assert(!two.m1, '[DEV_CHECK] removeVotedMatch should remove prior vote');
}
