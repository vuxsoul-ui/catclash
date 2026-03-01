import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeUsername } from './password';
import { pickXboxStyleUsername } from './xbox-usernames';

const DEFAULT_USERNAME_PATTERN = /^player\s+[0-9a-f]{8}$/i;

function isDefaultOrMissingUsername(value: string | null | undefined): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  return DEFAULT_USERNAME_PATTERN.test(v);
}

async function collectUsedUsernames(supabase: SupabaseClient): Promise<Set<string>> {
  const [profilesRes, credsRes] = await Promise.all([
    supabase.from('profiles').select('username'),
    supabase.from('auth_credentials').select('username_lower'),
  ]);
  const used = new Set<string>();
  for (const row of profilesRes.data || []) {
    const u = normalizeUsername(String((row as { username?: string | null }).username || ''));
    if (u) used.add(u);
  }
  for (const row of credsRes.data || []) {
    const u = normalizeUsername(String((row as { username_lower?: string | null }).username_lower || ''));
    if (u) used.add(u);
  }
  return used;
}

function nextAvailableUsername(seed: string, used: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = pickXboxStyleUsername(seed, attempt);
    const lower = normalizeUsername(candidate);
    if (!used.has(lower)) {
      used.add(lower);
      return candidate;
    }
  }
  // Last resort without numbers, still deterministic and valid.
  const fallback = `Arena${pickXboxStyleUsername(seed, 501)}`.replace(/[^a-zA-Z_]/g, '');
  const lower = normalizeUsername(fallback);
  used.add(lower);
  return fallback;
}

export async function assignUsernameIfDefault(
  supabase: SupabaseClient,
  userId: string,
  used?: Set<string>
): Promise<{ changed: boolean; username: string | null }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();

  const current = String(profile?.username || '').trim();
  if (!isDefaultOrMissingUsername(current)) return { changed: false, username: current };

  const usedSet = used || await collectUsedUsernames(supabase);
  const username = nextAvailableUsername(userId, usedSet);
  const usernameLower = normalizeUsername(username);

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId);
  if (pErr) return { changed: false, username: current || null };

  const { data: cred } = await supabase
    .from('auth_credentials')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (cred?.user_id) {
    await supabase
      .from('auth_credentials')
      .update({ username_lower: usernameLower, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  return { changed: true, username };
}

export async function backfillDefaultUsernames(
  supabase: SupabaseClient,
  limit = 10000
): Promise<{ scanned: number; changed: number }> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .limit(limit);
  const rows = (profiles || []) as Array<{ id: string; username?: string | null }>;
  const targets = rows.filter((r) => isDefaultOrMissingUsername(r.username));
  if (targets.length === 0) return { scanned: rows.length, changed: 0 };

  const used = await collectUsedUsernames(supabase);
  let changed = 0;
  for (const row of targets) {
    const res = await assignUsernameIfDefault(supabase, String(row.id || ''), used);
    if (res.changed) changed += 1;
  }
  return { scanned: rows.length, changed };
}

