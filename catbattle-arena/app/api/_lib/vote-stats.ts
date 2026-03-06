export function computeVoteStats(votesA: number, votesB: number): {
  total_votes: number;
  percent_a: number;
  percent_b: number;
} {
  const a = Math.max(0, Number(votesA || 0));
  const b = Math.max(0, Number(votesB || 0));
  const total = a + b;
  if (total <= 0) {
    return { total_votes: 0, percent_a: 50, percent_b: 50 };
  }
  const percentA = Math.round((a / total) * 100);
  const percentB = Math.max(0, 100 - percentA);
  return { total_votes: total, percent_a: percentA, percent_b: percentB };
}
