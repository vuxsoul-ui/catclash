// REPLACE: app/api/cats/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const formData = await request.formData();
    const image = formData.get('image') as File;
    const name = formData.get('name') as string;

    if (!image || !name) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Upload image
    const fileExt = image.name.split('.').pop();
    const fileName = `cats/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(fileName, image);

    if (uploadError) {
      console.error('[CREATE] Upload error:', uploadError);
      return NextResponse.json({ ok: false, error: 'Failed to upload image', details: uploadError.message }, { status: 500 });
    }

    // Generate stats
    const attack = Math.floor(Math.random() * 40) + 60;
    const defense = Math.floor(Math.random() * 40) + 60;
    const speed = Math.floor(Math.random() * 40) + 60;
    const charisma = Math.floor(Math.random() * 40) + 60;
    const chaos = Math.floor(Math.random() * 40) + 60;
    const power = attack + defense + speed + charisma + chaos;

    // Rarity
    const rand = Math.random();
    let rarity = 'Common';
    if (rand > 0.995) rarity = 'God-Tier';
    else if (rand > 0.98) rarity = 'Mythic';
    else if (rand > 0.90) rarity = 'Legendary';
    else if (rand > 0.70) rarity = 'Epic';
    else if (rand > 0.40) rarity = 'Rare';

    // Ability
    const abilities = ['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
    const ability = abilities[Math.floor(Math.random() * abilities.length)];

    // Insert into cats table - using INDIVIDUAL columns (not jsonb stats)
    const { data: cat, error: dbError } = await supabase
      .from('cats')
      .insert({
        name,
        image_path: fileName,
        rarity,
        ability,
        attack,
        defense,
        speed,
        charisma,
        chaos,
        stats: { attack, defense, speed, charisma, chaos },
        power,
        status: 'pending',
        cat_xp: 0,
        cat_level: 1,
        xp: 0,
        level: 1,
        evolution: 'Kitten',
        battles_fought: 0,
        wins: 0,
        losses: 0,
      })
      .select('id, name, rarity')
      .single();

    if (dbError) {
      console.error('[CREATE] DB error:', dbError);
      return NextResponse.json({ ok: false, error: 'Failed to save cat', details: dbError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('cat-images').getPublicUrl(fileName);

    return NextResponse.json({
      ok: true,
      cat_id: cat.id,
      image_url: urlData?.publicUrl || '',
      rarity,
      power: String(power),
      stats: { attack, defense, speed, charisma, chaos },
    });
  } catch (error) {
    console.error('[CREATE] Exception:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}