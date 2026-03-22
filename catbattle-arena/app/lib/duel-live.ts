export type DuelBadgeRow = {
  status?: string | null;
  challenger_cat?: { id?: string | null } | null;
  challenged_cat?: { id?: string | null } | null;
};

export function countLiveVotableDuels(rows: DuelBadgeRow[] | null | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => (
    String(row?.status || '').toLowerCase() === 'voting' &&
    !!row?.challenger_cat?.id &&
    !!row?.challenged_cat?.id
  )).length;
}
