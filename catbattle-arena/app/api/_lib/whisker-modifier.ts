import type { WeeklyModifierKey } from './arena-engine';

const ORDER: WeeklyModifierKey[] = ['speed_week', 'chaos_week', 'control_week', 'shields_week'];

function utcWeekAnchor(input?: Date): Date {
  const now = input || new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayDelta);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function seedFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getActiveWhiskerModifier(input?: Date): {
  key: WeeklyModifierKey;
  label: string;
  description: string;
  weekKey: string;
  startsAtUtc: string;
  endsAtUtc: string;
} {
  const start = utcWeekAnchor(input);
  const end = new Date(start.getTime() + (7 * 86400000));
  const weekKey = start.toISOString().slice(0, 10);
  const idx = seedFromKey(`whisker:${weekKey}`) % ORDER.length;
  const key = ORDER[idx];

  if (key === 'speed_week') {
    return {
      key,
      label: 'Week of Speed',
      description: 'First action grants +1 Momentum to the faster cat.',
      weekKey,
      startsAtUtc: start.toISOString(),
      endsAtUtc: end.toISOString(),
    };
  }
  if (key === 'chaos_week') {
    return {
      key,
      label: 'Week of Chaos',
      description: 'Chaos proc chance +3% (hard-capped at 15%).',
      weekKey,
      startsAtUtc: start.toISOString(),
      endsAtUtc: end.toISOString(),
    };
  }
  if (key === 'control_week') {
    return {
      key,
      label: 'Week of Control',
      description: 'First Control action costs 1 less energy.',
      weekKey,
      startsAtUtc: start.toISOString(),
      endsAtUtc: end.toISOString(),
    };
  }
  return {
    key,
    label: 'Week of Shields',
    description: 'First large hit per cat is reduced by 20%.',
    weekKey,
    startsAtUtc: start.toISOString(),
    endsAtUtc: end.toISOString(),
  };
}
