import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const name = formData.get('name') as string;
    const bio = formData.get('bio') as string;

    if (!image || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload image to Supabase Storage
    const fileExt = image.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(fileName, image);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cat-images')
      .getPublicUrl(fileName);

    // Generate random stats
    const stats = {
      attack: Math.floor(Math.random() * 40) + 60,
      defense: Math.floor(Math.random() * 40) + 60,
      speed: Math.floor(Math.random() * 40) + 60,
      charisma: Math.floor(Math.random() * 40) + 60,
      chaos: Math.floor(Math.random() * 40) + 60,
    };

    // Determine rarity
    const rand = Math.random();
    let rarity = 'Common';
    if (rand > 0.995) rarity = 'God-Tier';
    else if (rand > 0.98) rarity = 'Mythic';
    else if (rand > 0.90) rarity = 'Legendary';
    else if (rand > 0.70) rarity = 'Epic';
    else if (rand > 0.40) rarity = 'Rare';

    // Assign random power
    const powers = ['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
    const power = powers[Math.floor(Math.random() * powers.length)];

    // Save to database
    const { error: dbError } = await supabase
      .from('submissions')
      .insert({
        name,
        bio: bio || null,
        image_url: publicUrl,
        rarity,
        stats,
        power,
        status: 'pending',
        votes: 0,
        win_rate: 50,
        xp: 0,
        max_xp: 1000,
        evolution: 'Kitten',
        level: 1,
        battles_fought: 0
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
