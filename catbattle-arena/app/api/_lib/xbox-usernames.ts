const XBOX_STYLE_USERNAMES = [
  'ShadowWolf',
  'NovaKnight',
  'FrostViper',
  'PhantomClaw',
  'CrimsonEcho',
  'SolarRogue',
  'NightFalcon',
  'IronMantis',
  'SilentRaven',
  'GhostProwler',
  'ThunderDrift',
  'WildComet',
  'ZeroGravity',
  'DarkOrbit',
  'NeonHunter',
  'LunarStrike',
  'VortexBlade',
  'BlazeWarden',
  'StormCipher',
  'ApexNomad',
  'OnyxTitan',
  'RapidEmber',
  'GoldenGlitch',
  'PixelRaider',
  'ArcticShade',
  'TurboSpecter',
  'CobaltFang',
  'RogueTempest',
  'ChaosPilot',
  'EchoSamurai',
  'FlareSentinel',
  'MeteorSage',
  'ObsidianAce',
  'SkylineBandit',
  'VenomArc',
  'QuantumFox',
  'MythicScout',
  'RadiantHowl',
  'CipherCobra',
  'PulseRonin',
  'TitanDrake',
  'StealthBison',
  'InfernoMuse',
  'DuskRider',
  'GlacierNinja',
  'WarpCoyote',
  'CosmicLynx',
  'RuneVoyager',
  'HexGuardian',
  'VoltShogun',
];

export function getXboxStyleUsernames(): string[] {
  return XBOX_STYLE_USERNAMES;
}

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickXboxStyleUsername(seed: string, attempt = 0): string {
  const pool = XBOX_STYLE_USERNAMES;
  const base = hashSeed(`${seed}:${attempt}`);
  const a = pool[base % pool.length];
  if (attempt === 0) return a;
  const b = pool[(base >>> 8) % pool.length];
  if (a !== b) return `${a}${b}`;
  const c = pool[(base >>> 16) % pool.length];
  if (a !== c) return `${a}${c}`;
  return `${a}${pool[(base + 7) % pool.length]}`;
}

