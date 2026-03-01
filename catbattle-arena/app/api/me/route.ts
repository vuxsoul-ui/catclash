import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';
import { evaluateAndMaybeQualifyFlame } from '../_lib/arenaFlame';
import { withTimeout } from '../_lib/timeout';
import { assignUsernameIfDefault } from '../_lib/username-autofill';
import { applyFeatureTesterBoost, isFeatureTesterId } from '../_lib/tester';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  try {
    const guestId = await getGuestId();
    if (!guestId) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const testerMode = isFeatureTesterId(guestId);
    
    // Bootstrap user first
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    if (testerMode) {
      await applyFeatureTesterBoost(supabase as any, guestId);
    }
    await assignUsernameIfDefault(supabase, guestId).catch(() => null);
    
    // Get user state
    const { data, error } = await supabase.rpc('get_user_state', { p_user_id: guestId });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to get state: ' + error.message }, { status: 500 });
    }
    
    await supabase.rpc('ensure_user_prediction_stats', { p_user_id: guestId });

    const [{ data: progressRow }, { data: profileRow }, { data: predStats }, { data: userCats }, { data: notifPref }, { data: catXpPool }, { data: authCred }] = await Promise.all([
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
    const { data: equippedRows } = await supabase
      .from('equipped_cosmetics')
      .select('slot, cosmetics(slug,name,category)')
      .eq('user_id', guestId);
    const flame = await withTimeout(
      evaluateAndMaybeQualifyFlame(supabase, guestId, 'status', new Date()),
      2200,
      'me_flame'
    ).catch(() => null);

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
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
