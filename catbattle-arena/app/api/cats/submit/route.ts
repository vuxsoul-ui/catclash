// REPLACE: app/api/cats/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const formData = await req.formData();
    const name = (formData.get("name") as string)?.trim();
    const image = formData.get("image") as File | null;
    const rarity = (formData.get("rarity") as string) || "Common";
    const attack = parseInt(formData.get("attack") as string) || 50;
    const defense = parseInt(formData.get("defense") as string) || 50;
    const speed = parseInt(formData.get("speed") as string) || 50;
    const charisma = parseInt(formData.get("charisma") as string) || 50;
    const chaos = parseInt(formData.get("chaos") as string) || 50;
    const power = (formData.get("power") as string) || "None";
    const isDraft = (formData.get("isDraft") as string) === "true";

    // MOVE THE LOG HERE - after isDraft is defined
    console.log('Creating cat with isDraft:', isDraft, 'status:', isDraft ? "draft" : "pending");

    if (!name || name.length < 1 || name.length > 30) {
      return NextResponse.json({ ok: false, error: "Name must be 1-30 characters" }, { status: 400 });
    }
    if (!image) {
      return NextResponse.json({ ok: false, error: "Image required" }, { status: 400 });
    }

    // ... rest of the code stays the same

    // Validate stats are within rarity range (prevent cheating)
    const RANGES: Record<string, [number, number]> = {
      Common: [30, 55], Rare: [45, 70], Epic: [55, 82],
      Legendary: [68, 92], Mythic: [78, 96], 'God-Tier': [88, 99],
    };
    const [min, max] = RANGES[rarity] || [30, 55];
    const clamp = (v: number) => Math.max(min, Math.min(max, v));

    // Upload image
    const ext = image.name.split(".").pop() || "jpg";
    const path = `cats/${guestId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await image.arrayBuffer());

    const { error: uploadErr } = await sb.storage.from("cat-images").upload(path, buf, {
      contentType: image.type,
      upsert: false,
    });

    if (uploadErr) {
      return NextResponse.json({ ok: false, error: "Image upload failed: " + uploadErr.message }, { status: 500 });
    }

    // Insert cat as draft or pending
    const { data: cat, error: insertErr } = await sb.from("cats").insert({
      user_id: guestId,
      name,
      image_path: path,
      rarity,
      attack: clamp(attack),
      defense: clamp(defense),
      speed: clamp(speed),
      charisma: clamp(charisma),
      chaos: clamp(chaos),
      ability: power,
      cat_level: 1,
      cat_xp: 0,
      level: 1,
      xp: 0,
      evolution: "Kitten",
      status: isDraft ? "draft" : "pending",
      battles_fought: 0,
      wins: 0,
      losses: 0,
    }).select("id").single();

    if (insertErr) {
      return NextResponse.json({ ok: false, error: "Insert failed: " + insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cat_id: cat.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}