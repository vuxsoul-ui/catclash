export type StarterArchetype = 'striker' | 'tank' | 'sprinter' | 'trickster';

export type StarterOption = {
  id: string;
  name: string;
  archetype: StarterArchetype;
  flavor: string;
  image_url: string;
};

const STARTER_POOL: StarterOption[] = [
  {
    id: 'ember-striker',
    name: 'Emberclaw',
    archetype: 'striker',
    flavor: 'High attack burst with chaos spikes.',
    image_url: 'https://cdn2.thecatapi.com/images/bpc.jpg',
  },
  {
    id: 'granite-guard',
    name: 'Granitepaw',
    archetype: 'tank',
    flavor: 'Defense-first bruiser built to outlast rivals.',
    image_url: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg',
  },
  {
    id: 'zephyr-sprint',
    name: 'Zephyrtail',
    archetype: 'sprinter',
    flavor: 'Speed and charisma specialist for clutch wins.',
    image_url: 'https://cdn2.thecatapi.com/images/9j5.jpg',
  },
  {
    id: 'nova-chaos',
    name: 'Novapounce',
    archetype: 'trickster',
    flavor: 'Chaos-heavy style with volatile matchups.',
    image_url: 'https://cdn2.thecatapi.com/images/6bt.jpg',
  },
  {
    id: 'aqua-sprint',
    name: 'Aquaflare',
    archetype: 'sprinter',
    flavor: 'Fast opener with clean follow-through.',
    image_url: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg',
  },
  {
    id: 'onyx-guard',
    name: 'Onyxguard',
    archetype: 'tank',
    flavor: 'Solid defense with low-variance outcomes.',
    image_url: 'https://cdn2.thecatapi.com/images/bpc.jpg',
  },
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pickUnique(seed: string, count: number): StarterOption[] {
  const pool = [...STARTER_POOL];
  const picked: StarterOption[] = [];
  let cursor = hashString(seed);
  while (pool.length > 0 && picked.length < count) {
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    const idx = cursor % pool.length;
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

export function listStarterChoices(seedKey: string, count = 3): StarterOption[] {
  return pickUnique(seedKey, Math.max(1, Math.min(6, count)));
}

export function findStarterChoice(id: string): StarterOption | null {
  const clean = String(id || '').trim().toLowerCase();
  if (!clean) return null;
  return STARTER_POOL.find((s) => s.id.toLowerCase() === clean) || null;
}

