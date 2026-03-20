export function toSafeCount(value: number | null | undefined): number {
  return Math.max(0, Number(value || 0));
}

export function calculateWinRate(
  wins: number | null | undefined,
  losses: number | null | undefined
): number | null {
  const safeWins = toSafeCount(wins);
  const safeLosses = toSafeCount(losses);
  const totalMatches = safeWins + safeLosses;
  if (totalMatches <= 0) return null;
  return Number(((safeWins / totalMatches) * 100).toFixed(1));
}
