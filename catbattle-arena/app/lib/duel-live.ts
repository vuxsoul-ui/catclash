export type LiveDuelRow = {
  status?: string | null;
  challenger_cat?: { id?: string | null } | null;
  challenged_cat?: { id?: string | null } | null;
};

export function normalizeLiveStatus(status: string | null | undefined): string {
  const value = String(status || '').trim().toLowerCase();
  // Current persisted duel rows still use "voting" for live/open duels.
  return value === 'voting' ? 'open' : value;
}

function hasLinkedCats(duel: LiveDuelRow | null | undefined): boolean {
  return !!duel?.challenger_cat?.id && !!duel?.challenged_cat?.id;
}

export function isLiveDuel(duel: LiveDuelRow | null | undefined): boolean {
  if (!duel || typeof duel !== 'object') return false;
  return (
    normalizeLiveStatus(duel.status) === 'open' &&
    hasLinkedCats(duel)
  );
}

export function countLiveDuels(rows: LiveDuelRow[] | null | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter(isLiveDuel).length;
}

export function pickLiveDuels<T extends LiveDuelRow>(rows: T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isLiveDuel);
}
