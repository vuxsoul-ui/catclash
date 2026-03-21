export interface StatChange {
  catId: string;
  catName: string | null;
  changeType: 'match_recorded' | 'stat_reset' | 'manual_adjustment';
  previousWins: number;
  newWins: number;
  previousLosses: number;
  newLosses: number;
  previousBattles: number;
  newBattles: number;
  timestamp: string;
  source: string;
  matchId?: string | null;
}

export async function logStatChange(change: StatChange): Promise<void> {
  // Keep logging lightweight and server-side only for now.
  // This gives us a durable log shape we can later route into a table.
  // eslint-disable-next-line no-console
  console.info('STAT_CHANGE', JSON.stringify(change));
}
