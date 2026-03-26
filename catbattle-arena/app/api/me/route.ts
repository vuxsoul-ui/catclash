import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';
import { evaluateAndMaybeQualifyFlame } from '../_lib/arenaFlame';
import { withTimeout } from '../_lib/timeout';
import { assignUsernameIfDefault } from '../_lib/username-autofill';
import { applyFeatureTesterBoost, isFeatureTesterId } from '../_lib/tester';
import { createServerSupabaseClient, logInvalidSupabaseKey } from '../_lib/server-supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type SchemaishError = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

function isSchemaMismatch(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();

  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("column") ||
    msg.includes("function") ||
    msg.includes("rpc") ||
    msg.includes("schema") ||
    msg.includes("not found") ||
    msg.includes("undefined table") ||
    msg.includes("could not find") ||
    msg.includes("postgres")
  );
}

function isFailSoftBackendError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return isSchemaMismatch(error) || msg.includes('invalid api key');
}

function assertNoSupabaseError(error: SchemaishError): asserts error is null | undefined {
  if (error) throw error;
}

function buildGuestSafePayload(guestId: string, testerMode: boolean) {
  return {
    success: true,
    guest_id: guestId,
    data: {
      progress: { xp: 0, level: 1, current_streak: 0, sigils: 0, whisker_tokens: 0 },
      streak: {
        current_streak: 0,
        last_claim_date: null,
        flame_state: 'expired',
        last_flame_date: null,
        fading_expires_at: null,
      },
      profile: { id: guestId, guild: null, username: null },
      prediction_streak: 0,
      best_prediction_streak: 0,
      bonus_rolls: 0,
      cat_xp_pool: 0,
      flame: {
        dayCount: 0,
        state: 'expired',
        lastFlameDate: null,
        qualifiesToday: false,
        todayProgress: { votesToday: 0, predictionsToday: 0, catsToday: 0, qualifiesToday: false },
        fadingExpiresAt: null,
        secondsRemaining: null,
        nextMilestone: { nextDay: 1, daysRemaining: 0 },
      },
      starter_cat_eligible: false,
      submitted_cat_count: 0,
      adopted_cat_count: 0,
      adopted_cat_limit: 0,
      adopted_cat_remaining: 0,
      adopt_or_upload_required: true,
      notification_preferences: { email: '', cat_photo_approved_enabled: false },
      has_credentials: false,
      tester_mode: testerMode,
      equipped_cosmetics: {},
      user: { id: guestId },
    },
  };
}

export async function GET() {
  try {
    const guestId = await getGuestId();
    if (!guestId) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }
    
    const supabase = createServerSupabaseClient();

    const testerMode = isFeatureTesterId(guestId);
    
    // Bootstrap user first
    const bootstrapRes = await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    assertNoSupabaseError(bootstrapRes.error);
    if (testerMode) {
      await applyFeatureTesterBoost(supabase as any, guestId);
    }
    await assignUsernameIfDefault(supabase, guestId).catch(() => null);
    
    // Get user state
    const { data, error } = await supabase.rpc('get_user_state', { p_user_id: guestId });
    
    assertNoSupabaseError(error);
    
    const predictionStatsRes = await supabase.rpc('ensure_user_prediction_stats', { p_user_id: guestId });
    assertNoSupabaseError(predictionStatsRes.error);

    const [progressRes, profileRes, predStatsRes, userCatsRes, notifPrefRes, catXpPoolRes, authCredRes] = await Promise.all([
      supabase
      .from('user_progress')
      .select('sigils, whisker_tokens')
      .eq('user_id', guestId)
      .maybeSingle(),
      supabase
      .from('profiles')
      .select('guild, username')
      .eq('id', guestId)
      .maybeSingle(),
      supabase
      .from('user_prediction_stats')
      .select('current_streak, best_streak, bonus_rolls')
      .eq('user_id', guestId)
      .maybeSingle(),
      supabase
      .from('cats')
      .select('id, origin, ability, description, image_review_reason')
      .eq('user_id', guestId),
      supabase
      .from('notification_preferences')
      .select('email, cat_photo_approved_enabled')
      .eq('user_id', guestId)
      .maybeSingle(),
      supabase
      .from('cat_xp_pools')
      .select('pending_xp')
      .eq('user_id', guestId)
      .maybeSingle(),
      supabase
      .from('auth_credentials')
      .select('user_id')
      .eq('user_id', guestId)
      .maybeSingle(),
    ]);
    assertNoSupabaseError(progressRes.error);
    assertNoSupabaseError(profileRes.error);
    assertNoSupabaseError(predStatsRes.error);
    assertNoSupabaseError(userCatsRes.error);
    assertNoSupabaseError(notifPrefRes.error);
    assertNoSupabaseError(catXpPoolRes.error);
    assertNoSupabaseError(authCredRes.error);

    const { data: equippedRows, error: equippedError } = await supabase
      .from('equipped_cosmetics')
      .select('slot, cosmetics(slug,name,category)')
      .eq('user_id', guestId);
    assertNoSupabaseError(equippedError);
    const flame = await withTimeout(
      evaluateAndMaybeQualifyFlame(supabase, guestId, 'status', new Date()),
      2200,
      'me_flame'
    ).catch(() => null);

    const progressRow = progressRes.data;
    const profileRow = profileRes.data;
    const predStats = predStatsRes.data;
    const userCats = userCatsRes.data;
    const notifPref = notifPrefRes.data;
    const catXpPool = catXpPoolRes.data;
    const authCred = authCredRes.data;

    const mergedData = data || {};
    mergedData.progress = mergedData.progress || {};
    mergedData.progress.sigils = progressRow?.sigils || mergedData.progress.sigils || 0;
    mergedData.progress.whisker_tokens = Math.max(0, Number(progressRow?.whisker_tokens || mergedData.progress.whisker_tokens || 0));
    mergedData.profile = mergedData.profile || {};
    mergedData.profile.guild = profileRow?.guild || null;
    mergedData.profile.username = profileRow?.username || mergedData.profile.username || null;
    mergedData.prediction_streak = predStats?.current_streak || 0;
    mergedData.best_prediction_streak = predStats?.best_streak || 0;
    mergedData.bonus_rolls = predStats?.bonus_rolls || 0;
    mergedData.cat_xp_pool = Math.max(0, Number(catXpPool?.pending_xp || 0));
    const fallbackLastFlameDate = mergedData?.streak?.last_flame_date || null;
    const fallbackDayCount = fallbackLastFlameDate ? Number(mergedData?.streak?.current_streak || 0) : 0;
    mergedData.flame = flame || {
      dayCount: fallbackDayCount,
      state: String(mergedData?.streak?.flame_state || (fallbackLastFlameDate ? 'active' : 'expired')),
      lastFlameDate: fallbackLastFlameDate,
      qualifiesToday: false,
      todayProgress: { votesToday: 0, predictionsToday: 0, catsToday: 0, qualifiesToday: false },
      fadingExpiresAt: mergedData?.streak?.fading_expires_at || null,
      secondsRemaining: null,
      nextMilestone: { nextDay: 1, daysRemaining: 0 },
    };
    mergedData.streak = {
      ...(mergedData.streak || {}),
      current_streak: Number((flame?.dayCount ?? mergedData?.streak?.current_streak) || 0),
      last_claim_date: flame?.lastFlameDate ?? mergedData?.streak?.last_claim_date ?? null,
      flame_state: flame?.state ?? mergedData?.streak?.flame_state ?? 'active',
      last_flame_date: flame?.lastFlameDate ?? mergedData?.streak?.last_flame_date ?? null,
      fading_expires_at: flame?.fadingExpiresAt ?? mergedData?.streak?.fading_expires_at ?? null,
    };

    const submittedCount = (userCats || []).filter((c) => String(c.origin || 'submitted') === 'submitted').length;
    mergedData.starter_cat_eligible = false;
    mergedData.submitted_cat_count = submittedCount;
    mergedData.adopted_cat_count = 0;
    mergedData.adopted_cat_limit = 0;
    mergedData.adopted_cat_remaining = 0;
    mergedData.adopt_or_upload_required = (userCats || []).length === 0;
    mergedData.notification_preferences = {
      email: notifPref?.email || '',
      cat_photo_approved_enabled: !!notifPref?.cat_photo_approved_enabled,
    };
    mergedData.has_credentials = !!authCred?.user_id;
    mergedData.tester_mode = testerMode;
    const equipped: Record<string, { slug: string | null; name: string | null; category: string | null }> = {};
    for (const row of equippedRows || []) {
      const slot = String((row as { slot?: string }).slot || '').toLowerCase();
      const cosmetic = (row as { cosmetics?: { slug?: string | null; name?: string | null; category?: string | null } | null }).cosmetics || null;
      if (!slot || !cosmetic) continue;
      const key =
        slot === 'cat_title' || slot === 'title' || slot === 'badge' || slot === 'voter_badge'
          ? 'title'
          : slot === 'cat_border' || slot === 'border' || slot === 'frame'
            ? 'border'
            : slot === 'vote_effect' || slot === 'effect'
              ? 'vote_effect'
              : 'color';
      equipped[key] = {
        slug: cosmetic.slug || null,
        name: cosmetic.name || null,
        category: cosmetic.category || null,
      };
    }
    mergedData.equipped_cosmetics = equipped;

    return NextResponse.json({
      success: true,
      guest_id: guestId,
      data: mergedData
    }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    logInvalidSupabaseKey(e);
    console.error('[api/me] GET failed', e);
    try {
      console.error('[api/me] GET failed JSON', JSON.stringify(e, null, 2));
    } catch {}
    if (isFailSoftBackendError(e)) {
      const guestId = await getGuestId().catch(() => '');
      return NextResponse.json(buildGuestSafePayload(guestId, isFeatureTesterId(guestId)), { status: 200 });
    }
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
