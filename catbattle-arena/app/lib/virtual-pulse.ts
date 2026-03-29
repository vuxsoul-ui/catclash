export type VirtualPulseState = 'upcoming' | 'live' | 'resolving';

const CYCLE_MS = 15 * 60 * 1000;
const LIVE_MS = 10 * 60 * 1000;
const RESOLVING_MS = 60 * 1000;

export type VirtualPulse = {
  pulseId: string;
  state: VirtualPulseState;
  msRemaining: number;
  secondsRemaining: number;
  label: string;
  nextPulseAt: string;
};

function pad2(v: number) {
  return String(v).padStart(2, '0');
}

export function formatPulseCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function getVirtualPulse(nowMs = Date.now()): VirtualPulse {
  const cycleStartMs = nowMs - (nowMs % CYCLE_MS);
  const cycleOffset = nowMs - cycleStartMs;
  const liveEndMs = LIVE_MS;
  const resolvingEndMs = LIVE_MS + RESOLVING_MS;
  const nextPulseAtMs = cycleStartMs + CYCLE_MS;

  let state: VirtualPulseState = 'upcoming';
  let msRemaining = nextPulseAtMs - nowMs;

  if (cycleOffset < liveEndMs) {
    state = 'live';
    msRemaining = liveEndMs - cycleOffset;
  } else if (cycleOffset < resolvingEndMs) {
    state = 'resolving';
    msRemaining = resolvingEndMs - cycleOffset;
  }

  const pulseId = `pulse-${Math.floor(cycleStartMs / CYCLE_MS)}`;
  const label = state === 'live'
    ? 'Pulse Live'
    : state === 'resolving'
      ? 'Calculating Results...'
      : 'Next Pulse';

  return {
    pulseId,
    state,
    msRemaining: Math.max(0, msRemaining),
    secondsRemaining: Math.max(0, Math.floor(msRemaining / 1000)),
    label,
    nextPulseAt: new Date(nextPulseAtMs).toISOString(),
  };
}
