/**
 * One-time launch seeding script.
 *
 * Run:
 * ARE_YOU_SURE=true SEED_OWNER_USER_ID=<uuid> CAT_API_KEY=<optional> node scripts/seedArena.ts
 * ARE_YOU_SURE=true SEED_NPC_MODE=true CAT_API_KEY=<optional> node scripts/seedArena.ts
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { pickRandomCatUsername } from '../app/api/_lib/cat-usernames';

type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
const NPC_USER_ID = '00000000-0000-0000-0000-000000000000';

const RARITY_PLAN: Rarity[] = [
  ...Array(14).fill('Common'),
  ...Array(8).fill('Rare'),
  ...Array(4).fill('Epic'),
  ...Array(3).fill('Legendary'),
  ...Array(1).fill('Mythic'),
];

const STAT_RANGES: Record<Rarity, [number, number]> = {
  Common: [30, 55],
  Rare: [45, 70],
  Epic: [55, 82],
  Legendary: [68, 92],
  Mythic: [78, 96],
};

const ABILITIES = [
  'Starter Instinct',
  'Chaos Mode',
  'Royal Aura',
  'Laser Eyes',
  'Nine Lives',
  'Underdog Boost',
  'Thunder Paws',
  'Shadow Step',
];

const SEED_TAG = 'seed_launch_30_v1';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIsoWithinLastDays(minDaysAgo: number, maxDaysAgo: number): string {
  const now = Date.now();
  const min = now - maxDaysAgo * 24 * 60 * 60 * 1000;
  const max = now - minDaysAgo * 24 * 60 * 60 * 1000;
  const ts = randInt(min, max);
  return new Date(ts).toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRandomCatUrl(
  apiKey: string | null,
  seen: Set<string>
): Promise<{ url: string | null; retries: number; skipped: number }> {
  const endpoint = apiKey
    ? `https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png,webp&api_key=${encodeURIComponent(apiKey)}`
    : 'https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png,webp';

  let skipped = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(endpoint, {
        headers: apiKey ? { 'x-api-key': apiKey } : undefined,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`catapi_http_${res.status}`);
      const data = (await res.json()) as Array<{ url?: string }>;
      const url = String(data?.[0]?.url || '').trim();
      if (!/^https?:\/\//i.test(url)) throw new Error('invalid_catapi_url');
      if (seen.has(url)) {
        skipped += 1;
        await sleep(120);
        continue;
      }

      const lower = url.toLowerCase();
      if (!lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/)) {
        skipped += 1;
        await sleep(120);
        continue;
      }

      // Lightweight size/type validation.
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
      if (head) {
        const ct = (head.headers.get('content-type') || '').toLowerCase();
        if (ct && !ct.startsWith('image/')) {
          skipped += 1;
          continue;
        }
        const len = Number(head.headers.get('content-length') || 0);
        if (Number.isFinite(len) && len > 5 * 1024 * 1024) {
          skipped += 1;
          continue;
        }
      }

      seen.add(url);
      return { url, retries: attempt, skipped };
    } catch {
      if (attempt < 2) await sleep(250 * (attempt + 1));
    }
  }
  return { url: null, retries: 3, skipped };
}

async function main() {
  if (process.env.ARE_YOU_SURE !== 'true') {
    console.error('Refusing to run. Set ARE_YOU_SURE=true');
    process.exit(1);
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ownerId = (process.env.SEED_OWNER_USER_ID || '').trim();
  const catApiKey = (process.env.CAT_API_KEY || process.env.THECATAPI_API_KEY || '').trim() || null;
  const npcMode = String(process.env.SEED_NPC_MODE || '').toLowerCase() === 'true';
  const effectiveOwnerId = npcMode ? NPC_USER_ID : ownerId;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!effectiveOwnerId) {
    console.error('Missing SEED_OWNER_USER_ID');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await sb.rpc('bootstrap_user', { p_user_id: effectiveOwnerId });
  } catch {
    // non-fatal for seed
  }
  if (npcMode) {
    await sb
      .from('profiles')
      .upsert({ id: NPC_USER_ID, username: 'Arena NPC' }, { onConflict: 'id' });
  }

  let catColsData: Array<Record<string, unknown>> | null = null;
  let catColsErr: { message?: string } | null = null;
  try {
    const res = await sb.rpc('execute_sql', {
      query: "select column_name from information_schema.columns where table_schema='public' and table_name='cats'",
    });
    catColsData = Array.isArray((res as { data?: unknown }).data)
      ? ((res as { data?: Array<Record<string, unknown>> }).data || null)
      : null;
    catColsErr = (res as { error?: { message?: string } | null }).error || null;
  } catch {
    catColsErr = { message: 'execute_sql unavailable' };
  }

  let catColumns = new Set<string>();
  if (!catColsErr && Array.isArray(catColsData)) {
    catColumns = new Set(
      catColsData
        .map((r: Record<string, unknown>) => String(r.column_name || ''))
        .filter(Boolean)
    );
  } else {
    // Fallback static superset of known columns in repo migrations.
    catColumns = new Set([
      'user_id', 'name', 'image_path', 'rarity', 'attack', 'defense', 'speed', 'charisma', 'chaos',
      'ability', 'description', 'status', 'image_review_status', 'image_review_reason', 'image_reviewed_at',
      'xp', 'level', 'cat_level', 'evolution', 'wins', 'losses', 'battles_fought', 'power', 'origin', 'prestige_weight',
      'created_at',
    ]);
  }

  const pickedNames = new Set<string>();
  const pickedImages = new Set<string>();
  const created: Array<{ id: string; name: string; rarity: string; wins: number; losses: number }> = [];
  let imageRetries = 0;
  let imageSkips = 0;

  // Shuffle rarity order so seeded list looks organic.
  const rarityQueue = [...RARITY_PLAN].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 30; i += 1) {
    const rarity = rarityQueue[i];
    const [min, max] = STAT_RANGES[rarity];

    let finalName = '';
    for (let n = 0; n < 50; n += 1) {
      const candidate = pickRandomCatUsername(`seed:${i}:${n}:${Date.now()}`).slice(0, 24);
      if (!pickedNames.has(candidate.toLowerCase())) {
        pickedNames.add(candidate.toLowerCase());
        finalName = candidate;
        break;
      }
    }
    if (!finalName) {
      finalName = `seedcat_${i + 1}`;
    }

    let imageUrl: string | null = null;
    let imageAttempts = 0;
    while (!imageUrl && imageAttempts < 8) {
      const fetched = await fetchRandomCatUrl(catApiKey, pickedImages);
      imageRetries += fetched.retries;
      imageSkips += fetched.skipped;
      imageUrl = fetched.url;
      imageAttempts += 1;
      if (!imageUrl) await sleep(180);
    }
    if (!imageUrl) {
      console.warn(`Skipping index ${i}: could not fetch valid image after retries`);
      i -= 1;
      continue;
    }

    const wins = randInt(0, 6);
    const losses = randInt(0, 6);
    const battles = wins + losses;
    const createdAt = randomIsoWithinLastDays(5, 10);

    const candidate: Record<string, unknown> = {
      user_id: ownerId,
      name: finalName,
      image_path: imageUrl,
      rarity,
      attack: randInt(min, max),
      defense: randInt(min, max),
      speed: randInt(min, max),
      charisma: randInt(min, max),
      chaos: randInt(min, max),
      ability: ABILITIES[randInt(0, ABILITIES.length - 1)],
      description: npcMode ? `Arena NPC challenger [${SEED_TAG}]` : `Seeded for launch [${SEED_TAG}]`,
      status: 'approved',
      image_review_status: 'approved',
      image_review_reason: 'trusted_thecatapi_seed',
      image_reviewed_at: new Date().toISOString(),
      xp: 0,
      level: randInt(1, 5),
      cat_level: randInt(1, 5),
      evolution: 'Kitten',
      wins,
      losses,
      battles_fought: battles,
      power: 0,
      origin: npcMode ? 'npc' : 'submitted',
      prestige_weight: 1.0,
      created_at: createdAt,
    };
    candidate.power = Math.round(
      Number(candidate.attack || 0) * 0.24 +
      Number(candidate.defense || 0) * 0.24 +
      Number(candidate.speed || 0) * 0.2 +
      Number(candidate.charisma || 0) * 0.16 +
      Number(candidate.chaos || 0) * 0.16
    );
    candidate.user_id = effectiveOwnerId;

    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(candidate)) {
      if (catColumns.has(k)) row[k] = v;
    }

    const { data: inserted, error: insErr } = await sb
      .from('cats')
      .insert(row)
      .select('id, name, rarity, wins, losses')
      .single();

    if (insErr || !inserted) {
      console.error(`Insert failed at #${i + 1}:`, insErr?.message || 'unknown');
      i -= 1;
      await sleep(150);
      continue;
    }

    created.push({
      id: String((inserted as Record<string, unknown>).id || ''),
      name: String((inserted as Record<string, unknown>).name || finalName),
      rarity: String((inserted as Record<string, unknown>).rarity || rarity),
      wins: Number((inserted as Record<string, unknown>).wins || wins),
      losses: Number((inserted as Record<string, unknown>).losses || losses),
    });
  }

  // Organic vote history: small, spread timestamps.
  const { data: matches } = await sb
    .from('tournament_matches')
    .select('id')
    .limit(20);
  const matchIds = (matches || []).map((m: Record<string, unknown>) => String(m.id || '')).filter(Boolean);

  let seededVotes = 0;
  for (const cat of created) {
    if (cat.wins <= 0) continue;
    const votesTarget = randInt(5, 30);
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < votesTarget; i += 1) {
      rows.push({
        battle_id: matchIds.length ? matchIds[randInt(0, matchIds.length - 1)] : null,
        voter_user_id: null,
        ip_hash: crypto.createHash('sha256').update(`seed:${cat.id}:${i}:${Date.now()}`).digest('hex'),
        user_agent: 'seed-script',
        voted_for: cat.id,
        created_at: randomIsoWithinLastDays(1, 10),
      });
    }
    const { error: voteErr } = await sb.from('votes').insert(rows);
    if (!voteErr) seededVotes += rows.length;
  }

  const byRarity = created.reduce<Record<string, number>>((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] || 0) + 1;
    return acc;
  }, {});

  const top5 = [...created].sort((a, b) => b.wins - a.wins).slice(0, 5);

  console.log('--- Seed Summary ---');
  console.log(`Mode: ${npcMode ? 'NPC' : 'Owner/Submited'}`);
  console.log(`Owner user id: ${effectiveOwnerId}`);
  console.log(`Total cats created: ${created.length}`);
  console.log('Rarity breakdown:', byRarity);
  console.log('Top 5 by wins:', top5.map((c) => `${c.name}(${c.wins})`).join(', '));
  console.log(`Organic votes inserted: ${seededVotes}`);
  console.log(`Image retries: ${imageRetries}`);
  console.log(`Image skips (dup/type/size): ${imageSkips}`);
  console.log(`Cleanup hint: delete from cats where user_id='${effectiveOwnerId}' and description ilike '%[${SEED_TAG}]%'`);
}

main().catch((e) => {
  console.error('seedArena failed:', e);
  process.exit(1);
});
