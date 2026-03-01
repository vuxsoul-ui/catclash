import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { hashPassword, normalizeUsername, validatePassword } from '../../_lib/password';
import { markReferralSignedUp } from '../../_lib/referrals';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { trackAppEvent } from '../../_lib/telemetry';
import { LAUNCH_CONFIG } from '../../_lib/launchConfig';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function validateUsername(raw: string): { ok: boolean; value?: string; error?: string } {
  const clean = String(raw || '').trim();
  if (clean.length < 3 || clean.length > 20) return { ok: false, error: 'Username must be 3-20 characters' };
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) return { ok: false, error: 'Username can contain only letters, numbers, underscore' };
  return { ok: true, value: clean };
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

const LOYALTY_XP_BONUS = 75;
const SABOTEUR_SIGIL_BONUS = 50;
const VALID_GUILDS = new Set(['sun', 'moon']);

function isMissingTable(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('relation');
}

async function safeSocialEventInsert(payload: {
  user_id: string;
  actor_user_id: string | null;
  kind: string;
  message: string;
  reward_sigils?: number;
  meta?: Record<string, unknown>;
}) {
  const res = await supabase.from('social_feed_events').insert({
    user_id: payload.user_id,
    actor_user_id: payload.actor_user_id,
    kind: payload.kind,
    message: payload.message,
    reward_sigils: Number(payload.reward_sigils || 0),
    meta: payload.meta || {},
  });
  if (res.error && !isMissingTable(res.error.message)) throw new Error(res.error.message);
}

export async function POST(req: NextRequest) {
  try {
    let guestId = '';
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    }
    const signupIpHash = hashValue(getClientIp(req));
    const signupRate = checkRateLimitMany([
      {
        key: `rl:signup:ip:${signupIpHash || 'unknown'}`,
        limit: Number(LAUNCH_CONFIG.rateLimitSignupPerIPPerHour),
        windowMs: 60 * 60 * 1000,
      },
    ]);
    if (!signupRate.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many signup attempts from this IP. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(signupRate.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const usernameCheck = validateUsername(String(body.username || ''));
    if (!usernameCheck.ok || !usernameCheck.value) {
      return NextResponse.json({ ok: false, error: usernameCheck.error || 'Invalid username' }, { status: 400 });
    }
    const pwdCheck = validatePassword(String(body.password || ''));
    if (!pwdCheck.ok) {
      return NextResponse.json({ ok: false, error: pwdCheck.error || 'Invalid password' }, { status: 400 });
    }

    const username = usernameCheck.value;
    const usernameLower = normalizeUsername(username);
    const password = String(body.password || '');
    const referrerUserId = String(body.referrer_user_id || '').trim();
    const duelId = String(body.duel_id || '').trim();

    await supabase.rpc('bootstrap_user', { p_user_id: guestId });

    const { data: taken } = await supabase
      .from('auth_credentials')
      .select('user_id')
      .eq('username_lower', usernameLower)
      .maybeSingle();
    if (taken?.user_id && String(taken.user_id) !== guestId) {
      return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 });
    }

    const { data: existingCred } = await supabase
      .from('auth_credentials')
      .select('user_id')
      .eq('user_id', guestId)
      .maybeSingle();
    if (existingCred?.user_id) {
      return NextResponse.json({ ok: false, error: 'This account already has credentials. Use login.' }, { status: 409 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', guestId)
      .maybeSingle();
    const profileUsername = String(profile?.username || '').trim();
    if (profileUsername && normalizeUsername(profileUsername) !== usernameLower) {
      return NextResponse.json({ ok: false, error: 'This account is already linked to another username' }, { status: 409 });
    }

    const pwd = await hashPassword(password);

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', guestId);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const { error: credErr } = await supabase
      .from('auth_credentials')
      .insert({
        user_id: guestId,
        username_lower: usernameLower,
        password_hash: pwd.hash,
        password_salt: pwd.salt,
        password_algo: pwd.algo,
      });
    if (credErr) {
      if (credErr.code === '23505') return NextResponse.json({ ok: false, error: 'Username already taken' }, { status: 409 });
      return NextResponse.json({ ok: false, error: credErr.message }, { status: 500 });
    }

    let referrerNotified = false;
    let referralOutcome: 'none' | 'loyal' | 'traitor' | 'neutral' = 'none';
    let loyaltyBonusXpAwarded = 0;
    let saboteurBonusSigilsAwarded = 0;

    const normalizedReferrerId = isUuid(referrerUserId) && referrerUserId !== guestId ? referrerUserId : null;
    let referrerGuild: 'sun' | 'moon' | null = null;
    let recruitGuild: 'sun' | 'moon' | null = null;
    let referrerUsername: string | null = null;
    if (normalizedReferrerId) {
      const [{ data: refProfile }, { data: recruitProfile }] = await Promise.all([
        supabase.from('profiles').select('username, guild').eq('id', normalizedReferrerId).maybeSingle(),
        supabase.from('profiles').select('guild').eq('id', guestId).maybeSingle(),
      ]);
      referrerUsername = String(refProfile?.username || '').trim() || null;
      const refGuild = String(refProfile?.guild || '').toLowerCase();
      const meGuild = String(recruitProfile?.guild || '').toLowerCase();
      referrerGuild = VALID_GUILDS.has(refGuild) ? (refGuild as 'sun' | 'moon') : null;
      recruitGuild = VALID_GUILDS.has(meGuild) ? (meGuild as 'sun' | 'moon') : null;
    }

    if (isUuid(referrerUserId) && referrerUserId !== guestId && duelId) {
      const key = `notif:duel_recruit:${duelId}:${guestId}`;
      const ins = await supabase
        .from('user_reward_claims')
        .insert({ user_id: referrerUserId, reward_key: key, reward_sigils: 0 });
      if (!ins.error || String(ins.error.code || '') === '23505') {
        referrerNotified = true;
      }
    }

    if (normalizedReferrerId && referrerGuild && recruitGuild) {
      if (referrerGuild === recruitGuild) {
        const loyaltyKey = `ref_loyalty_bonus:${normalizedReferrerId}:${guestId}`;
        const ins = await supabase
          .from('user_reward_claims')
          .insert({ user_id: guestId, reward_key: loyaltyKey, reward_sigils: 0 });
        if (!ins.error) {
          const { data: prog } = await supabase
            .from('user_progress')
            .select('xp')
            .eq('user_id', guestId)
            .maybeSingle();
          const nextXp = Number(prog?.xp || 0) + LOYALTY_XP_BONUS;
          await supabase.from('user_progress').update({ xp: nextXp }).eq('user_id', guestId);
          await supabase.rpc('check_level_up', { p_user_id: guestId });
          loyaltyBonusXpAwarded = LOYALTY_XP_BONUS;
        }
        referralOutcome = 'loyal';
        await safeSocialEventInsert({
          user_id: normalizedReferrerId,
          actor_user_id: guestId,
          kind: 'recruit_loyal',
          message: `Recruit secured. ${username} is now fighting for ${referrerGuild === 'sun' ? 'Solar Claw' : 'Lunar Paw'}. Your influence grows.`,
          reward_sigils: 0,
          meta: {
            recruit_user_id: guestId,
            recruit_username: username,
            guild: referrerGuild,
            loyalty: true,
          },
        });
      } else {
        const saboteurKey = `ref_saboteur_bonus:${normalizedReferrerId}:${guestId}`;
        const saboteurIns = await supabase
          .from('user_reward_claims')
          .insert({ user_id: guestId, reward_key: saboteurKey, reward_sigils: SABOTEUR_SIGIL_BONUS });
        if (!saboteurIns.error) {
          const { data: prog } = await supabase
            .from('user_progress')
            .select('sigils')
            .eq('user_id', guestId)
            .maybeSingle();
          const nextSigils = Number(prog?.sigils || 0) + SABOTEUR_SIGIL_BONUS;
          await supabase.from('user_progress').update({ sigils: nextSigils }).eq('user_id', guestId);
          saboteurBonusSigilsAwarded = SABOTEUR_SIGIL_BONUS;
        }
        referralOutcome = 'traitor';
        await safeSocialEventInsert({
          user_id: normalizedReferrerId,
          actor_user_id: guestId,
          kind: 'recruit_traitor',
          message: `DEFECTED! 🐍 ${username} rejected your invitation to ${referrerGuild === 'sun' ? 'Solar Claw' : 'Lunar Paw'} and joined ${recruitGuild === 'sun' ? 'Solar Claw' : 'Lunar Paw'}. They are coming for your rank.`,
          reward_sigils: 0,
          meta: {
            recruit_user_id: guestId,
            recruit_username: username,
            from_guild: referrerGuild,
            to_guild: recruitGuild,
            action_label: 'CHALLENGE NOW',
            action_url: `/duel?target=${encodeURIComponent(guestId)}`,
          },
        });
      }
    } else if (normalizedReferrerId) {
      referralOutcome = 'neutral';
    }

    let welcomeCrateGranted = false;
    if (duelId) {
      const welcomeKey = `welcome_crate_duel:${duelId}:${guestId}`;
      const claim = await supabase
        .from('user_reward_claims')
        .insert({ user_id: guestId, reward_key: welcomeKey, reward_sigils: 0 });
      if (!claim.error || String(claim.error.code || '') === '23505') {
        if (!claim.error) {
          await supabase.rpc('ensure_user_prediction_stats', { p_user_id: guestId });
          const { data: stats } = await supabase
            .from('user_prediction_stats')
            .select('bonus_rolls')
            .eq('user_id', guestId)
            .maybeSingle();
          await supabase
            .from('user_prediction_stats')
            .update({ bonus_rolls: Number(stats?.bonus_rolls || 0) + 1 })
            .eq('user_id', guestId);
          welcomeCrateGranted = true;
        }
      }
    }

    await markReferralSignedUp(supabase, guestId, { signupIpHash });
    await trackAppEvent(supabase, 'signup_complete', { username }, guestId);

    return NextResponse.json({
      ok: true,
      user_id: guestId,
      username,
      referrer_notified: referrerNotified,
      welcome_crate_granted: welcomeCrateGranted,
      referral_outcome: referralOutcome,
      loyalty_bonus_xp_awarded: loyaltyBonusXpAwarded,
      saboteur_bonus_sigils_awarded: saboteurBonusSigilsAwarded,
      referrer_username: referrerUsername,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
