export type TournamentMatchState = 'votable' | 'voted' | 'locked' | 'resolved';

export type TournamentMatchStateInput = {
  matchId: string;
  status: string;
  round: number;
  currentRound: number;
  voted: boolean;
  pulseLocked?: boolean;
  spotlightMatchId?: string | null;
};

export type TournamentMatchStateOutput = {
  matchId: string;
  state: TournamentMatchState;
  label: string;
  isSpotlight: boolean;
  isCurrentRound: boolean;
  isResolved: boolean;
  isVotable: boolean;
  isLocked: boolean;
};

export type TournamentPlayableSummary = {
  playableCount: number;
  votedCount: number;
  remainingCount: number;
  openCount: number;
  lockedRemainingCount: number;
  allRemainingLocked: boolean;
};

function normalizeStatus(status: string) {
  return String(status || '').toLowerCase();
}

export function deriveTournamentMatchState(input: TournamentMatchStateInput): TournamentMatchStateOutput {
  const normalized = normalizeStatus(input.status);
  const isSpotlight = String(input.matchId || '').trim() === String(input.spotlightMatchId || '').trim();
  const isCurrentRound = Number(input.round || 0) > 0 && Number(input.round || 0) === Number(input.currentRound || 0);
  const isResolved = normalized === 'complete' || normalized === 'completed';
  const isVotable = !isResolved && isCurrentRound && !input.voted && (
    normalized === 'active' ||
    normalized === 'in_progress' ||
    normalized === 'locked'
  );
  const isLocked = !isResolved && !isVotable;
  const state: TournamentMatchState = isResolved ? 'resolved' : input.voted ? 'voted' : isVotable ? 'votable' : 'locked';
  return {
    matchId: input.matchId,
    state,
    label: state === 'resolved' ? 'Resolved' : state === 'voted' ? 'Voted' : state === 'votable' ? 'Votable' : 'Locked',
    isSpotlight,
    isCurrentRound,
    isResolved,
    isVotable,
    isLocked,
  };
}

export function summarizeTournamentPlayable(states: TournamentMatchStateOutput[]): TournamentPlayableSummary {
  const playableStates = states.filter((state) => state.isCurrentRound && !state.isResolved);
  const votedCount = playableStates.filter((state) => state.state === 'voted').length;
  const remainingStates = playableStates.filter((state) => state.state !== 'voted');
  const lockedRemainingCount = remainingStates.filter((state) => state.state === 'locked').length;

  return {
    playableCount: playableStates.length,
    votedCount,
    remainingCount: remainingStates.length,
    openCount: remainingStates.filter((state) => state.state === 'votable').length,
    lockedRemainingCount,
    allRemainingLocked: remainingStates.length > 0 && lockedRemainingCount === remainingStates.length,
  };
}
