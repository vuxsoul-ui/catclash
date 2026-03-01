// REPLACE: app/api/cats/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireGuestId } from "../../_lib/guest";
import { validateCatDescription, validateCatName } from "../../_lib/name-filter";
import { evaluateAndMaybeQualifyFlame } from "../../_lib/arenaFlame";
import { checkRateLimitManyPersistent, getClientIpPrefix, hashValue } from "../../_lib/rateLimit";
import { withTimeout } from "../../_lib/timeout";
import { logReferralEvent } from "../../_lib/referrals";
import { uploadCatImageDerivatives } from "../../_lib/cat-image-storage";
import { utcWeekStartIso } from "../../_lib/weeklyCaps";
import { normalizeStatsForRarity } from "../../_lib/stat-balance";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const REROLL_COST = 25; // sigils per re-roll
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SUBMIT_WEEKLY_LIMIT = Math.max(1, Number(process.env.SUBMIT_WEEKLY_LIMIT || 8));
const SUBMIT_DAILY_LIMIT = Math.max(1, Number(process.env.SUBMIT_DAILY_LIMIT || 2));

export async function POST(req: NextRequest) {
  try {
    let guestId = '';
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
    }
    const ipHash = hashValue(getClientIpPrefix(req));
    const limitResult = await checkRateLimitManyPersistent([
      { key: `rl:submit:user:${guestId}`, limit: 2, windowMs: 60 * 60 * 1000 },
      { key: `rl:submit:ip:${ipHash || "unknown"}`, limit: 5, windowMs: 60 * 60 * 1000 },
    ]);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(limitResult.retryAfterSec) } }
      );
    }

    const formData = await req.formData();
    const name = (formData.get("name") as string)?.trim();
    const image = formData.get("image") as File | null;
    const rarity = (formData.get("rarity") as string) || "Common";
    const attack = parseInt(formData.get("attack") as string) || 50;
    const defense = parseInt(formData.get("defense") as string) || 50;
    const speed = parseInt(formData.get("speed") as string) || 50;
    const charisma = parseInt(formData.get("charisma") as string) || 50;
    const chaos = parseInt(formData.get("chaos") as string) || 50;
    const abilityName = (formData.get("power") as string) || "None";
    const description = ((formData.get("description") as string) || "").trim().slice(0, 200);
    const rerollCount = parseInt(formData.get("reroll_count") as string) || 0;

    const validatedName = validateCatName(name || '');
    if (!validatedName.ok) {
      return NextResponse.json({ ok: false, error: validatedName.error }, { status: 400 });
    }
    const validatedDescription = validateCatDescription(description || '');
    if (!validatedDescription.ok) {
      return NextResponse.json({ ok: false, error: validatedDescription.error }, { status: 400 });
    }
    if (!image) {
      return NextResponse.json({ ok: false, error: "Image required" }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: "Image too large (max 5MB)" }, { status: 413 });
    }
    if (!ALLOWED_MIME.has((image.type || "").toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Unsupported image type. Use JPG, PNG, WEBP, or GIF." }, { status: 415 });
    }

    const sb = getSupabase();
    const { data: profile } = await sb
      .from('profiles')
      .select('username')
      .eq('id', guestId)
      .maybeSingle();
    const username = String(profile?.username || '').trim();
    if (!username) {
      return NextResponse.json(
        { ok: false, error: 'Set a username before submitting a cat.' },
        { status: 403 }
      );
    }

    const weekStartIso = utcWeekStartIso();
    const { data: weeklyCats, error: weeklyErr } = await sb
      .from('cats')
      .select('id, origin, ability, description, image_review_reason, created_at')
      .eq('user_id', guestId)
      .gte('created_at', weekStartIso);
    if (weeklyErr) {
      return NextResponse.json({ ok: false, error: weeklyErr.message }, { status: 500 });
    }
    const submittedThisWeek = (weeklyCats || []).filter((c) => String((c as any).origin || 'submitted') === 'submitted').length;
    if (submittedThisWeek >= SUBMIT_WEEKLY_LIMIT) {
      return NextResponse.json(
        { ok: false, error: `Weekly submit limit reached (${SUBMIT_WEEKLY_LIMIT}).`, weekly_limit: SUBMIT_WEEKLY_LIMIT, weekly_count: submittedThisWeek },
        { status: 400 }
      );
    }
    const dayStartIso = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const submittedToday = (weeklyCats || []).filter((c) => {
      const origin = String((c as any).origin || 'submitted');
      const createdAt = Date.parse(String((c as any).created_at || ''));
      return origin === 'submitted' && Number.isFinite(createdAt) && createdAt >= Date.parse(dayStartIso);
    }).length;
    if (submittedToday >= SUBMIT_DAILY_LIMIT) {
      return NextResponse.json(
        { ok: false, error: `Daily submit limit reached (${SUBMIT_DAILY_LIMIT}).`, daily_limit: SUBMIT_DAILY_LIMIT, daily_count: submittedToday },
        { status: 400 }
      );
    }

    // If rerolls were used, deduct sigils
    if (rerollCount > 0) {
      const totalCost = rerollCount * REROLL_COST;

      // Check user's sigils balance
      const { data: progress } = await sb
        .from('user_progress')
        .select('sigils')
        .eq('user_id', guestId)
        .single();

      const currentSigils = progress?.sigils || 0;
      if (currentSigils < totalCost) {
        return NextResponse.json({
          ok: false,
          error: `Not enough sigils. Need ${totalCost}, have ${currentSigils}`,
        }, { status: 400 });
      }

      // Deduct sigils
      await sb
        .from('user_progress')
        .update({ sigils: currentSigils - totalCost })
        .eq('user_id', guestId);
    }

    // Normalize within rarity bounds + total budget so builds don't cluster at maxed stats.
    const normalizedStats = normalizeStatsForRarity(rarity, {
      attack,
      defense,
      speed,
      charisma,
      chaos,
    });

    const catId = randomUUID();
    const buf = Buffer.from(await image.arrayBuffer());
    let imageSet;
    try {
      imageSet = await withTimeout(
        uploadCatImageDerivatives({
          supabase: sb,
          catId,
          source: buf,
          contentType: image.type || "image/jpeg",
          originalCacheControl: "public, max-age=604800",
        }),
        12_000,
        "submit_upload"
      );
    } catch (uploadErr: any) {
      return NextResponse.json({ ok: false, error: "Image upload failed: " + String(uploadErr?.message || uploadErr) }, { status: 500 });
    }

    // Insert cat — only use columns that definitely exist
    // "ability" = text power name (e.g. "Laser Eyes")
    // Do NOT write to "power" column (it may be integer or not exist)
    const insertData: Record<string, unknown> = {
      id: catId,
      user_id: guestId,
      name: validatedName.value,
      image_path: imageSet.original.path,
      image_url_original: imageSet.original.url,
      image_url_card: imageSet.card.url,
      image_url_thumb: imageSet.thumb.url,
      rarity,
      attack: normalizedStats.attack,
      defense: normalizedStats.defense,
      speed: normalizedStats.speed,
      charisma: normalizedStats.charisma,
      chaos: normalizedStats.chaos,
      ability: abilityName,
      description: validatedDescription.value || null,
      origin: "submitted",
      status: "pending",
      image_review_status: "pending_review",
      level: 1,
      xp: 0,
      wins: 0,
      evolution: "Kitten",
    };

    const { data: cat, error: insertErr } = await sb
      .from("cats")
      .insert(insertData)
      .select("id")
      .single();

    if (insertErr) {
      // If a column doesn't exist, try minimal insert
      console.error('[SUBMIT] Insert error:', insertErr.message);

      // Retry with fewer columns if needed
      if (insertErr.message.includes('column')) {
        const minimalData: Record<string, unknown> = {
          id: catId,
          user_id: guestId,
          name: validatedName.value,
          image_path: imageSet.original.path,
          rarity,
          attack: normalizedStats.attack,
          defense: normalizedStats.defense,
          speed: normalizedStats.speed,
          charisma: normalizedStats.charisma,
          chaos: normalizedStats.chaos,
          ability: abilityName,
          status: "pending",
        };

        const { data: cat2, error: insertErr2 } = await sb
          .from("cats")
          .insert(minimalData)
          .select("id")
          .single();

        if (insertErr2) {
          return NextResponse.json({ ok: false, error: "Insert failed: " + insertErr2.message }, { status: 500 });
        }
        await evaluateAndMaybeQualifyFlame(sb, guestId, 'submit', new Date());
        await logReferralEvent(sb, guestId, 'first_cat_minted', { source: 'submit' });

        return NextResponse.json({ ok: true, cat_id: cat2.id });
      }

      return NextResponse.json({ ok: false, error: "Insert failed: " + insertErr.message }, { status: 500 });
    }
    await evaluateAndMaybeQualifyFlame(sb, guestId, 'submit', new Date());
    await logReferralEvent(sb, guestId, 'first_cat_minted', { source: 'submit' });

    return NextResponse.json({ ok: true, cat_id: cat.id });
  } catch (e) {
    console.error('[SUBMIT] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
