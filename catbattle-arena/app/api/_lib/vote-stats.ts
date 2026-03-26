export type VoteProbability = {
  total_votes: number;
  votes_a: number;
  votes_b: number;
  share_a: number;
  share_b: number;
  prob_a: number;
  prob_b: number;
  percent_a: number;
  percent_b: number;
  display_a: string;
  display_b: string;
};

export function computeVoteProbabilities(votesA: number, votesB: number): VoteProbability {
  const a = Math.max(0, Number(votesA || 0));
  const b = Math.max(0, Number(votesB || 0));
  const total = a + b;

  if (total <= 0) {
    return {
      total_votes: 0,
      votes_a: a,
      votes_b: b,
      share_a: 0.5,
      share_b: 0.5,
      prob_a: 0.5,
      prob_b: 0.5,
      percent_a: 50,
      percent_b: 50,
      display_a: "50.00",
      display_b: "50.00",
    };
  }

  const rawProbA = a / total;
  const rawProbB = b / total;
  const probA = Math.min(0.95, Math.max(0.05, rawProbA));
  const probB = 1 - probA;
  // UI percentages should reflect the true current vote share, while prob_a /
  // prob_b stay clamped for gameplay systems that rely on a floor/ceiling.
  const percentA = Number((rawProbA * 100).toFixed(2));
  const percentB = Number((rawProbB * 100).toFixed(2));

  return {
    total_votes: total,
    votes_a: a,
    votes_b: b,
    share_a: rawProbA,
    share_b: rawProbB,
    prob_a: probA,
    prob_b: probB,
    percent_a: percentA,
    percent_b: percentB,
    display_a: percentA.toFixed(2),
    display_b: percentB.toFixed(2),
  };
}

export function computeVoteStats(votesA: number, votesB: number): VoteProbability {
  return computeVoteProbabilities(votesA, votesB);
}

export function resolveVote(
  votesA: number,
  votesB: number,
  rng: () => number = Math.random
): "a" | "b" {
  const { prob_a } = computeVoteProbabilities(votesA, votesB);
  return rng() < prob_a ? "a" : "b";
}
