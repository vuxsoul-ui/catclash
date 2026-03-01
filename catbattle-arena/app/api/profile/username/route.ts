import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nigger', 'faggot', 'cunt', 'whore', 'slut', 'rape', 'naz',
];

function normalizeForProfanity(input: string): string {
  return input
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9_]/g, '');
}

function containsBlockedWord(input: string): boolean {
  const lowered = input.toLowerCase();
  const compact = lowered.replace(/[^a-z0-9_]/g, '');
  const normalizedA = normalizeForProfanity(input);
  const normalizedU = compact
    .replace(/[@]/g, 'a')
    .replace(/[4]/g, 'u')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');

  return BLOCKED_WORDS.some(
    (word) =>
      lowered.includes(word) ||
      compact.includes(word) ||
      normalizedA.includes(word) ||
      normalizedU.includes(word)
  );
}

function validateUsername(raw: string): string | null {
  const cleaned = raw.trim();
  if (cleaned.length < 3 || cleaned.length > 20) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) return null;
  if (containsBlockedWord(cleaned)) return null;
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const body = await request.json().catch(() => ({}));
    const username = validateUsername(String(body.username || ''));
    if (!username) {
      return NextResponse.json(
        { ok: false, error: 'Username invalid or contains blocked words' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.rpc('bootstrap_user', { p_user_id: userId });

    const { data: existingByUsername } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (existingByUsername?.id && existingByUsername.id !== userId) {
      return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 });
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();
    if (existingProfile?.username === username) {
      return NextResponse.json({ ok: true, username });
    }

    const rateKey = `username_change:${userId}`;
    const now = new Date();
    const cooldownMs = 24 * 60 * 60 * 1000;

    const { data: cooldownRow } = await supabase
      .from('rate_limits')
      .select('window_start')
      .eq('key', rateKey)
      .maybeSingle();

    if (cooldownRow?.window_start) {
      const last = new Date(cooldownRow.window_start).getTime();
      if (!Number.isNaN(last) && now.getTime() - last < cooldownMs) {
        const remainingMs = cooldownMs - (now.getTime() - last);
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return NextResponse.json(
          { ok: false, error: `Username can be changed once every 24h. Try again in ~${remainingHours}h.` },
          { status: 429 }
        );
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', userId)
      .select('id, username')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    await supabase.from('rate_limits').upsert(
      { key: rateKey, count: 1, window_start: now.toISOString() },
      { onConflict: 'key' }
    );

    return NextResponse.json({ ok: true, username: data.username });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
