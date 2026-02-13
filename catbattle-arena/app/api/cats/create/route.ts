import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const guestId = getGuestId();
    const formData = await request.formData();
    
    const name = formData.get('name') as string;
    const image = formData.get('image') as File;
    
    if (!name || !image) {
      return NextResponse.json({ error: 'Missing name or image' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Upload image to Storage
    const fileExt = image.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `cats/${guestId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(filePath, image);
    
    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }
    
    // Generate random stats
    const stats = {
      attack: Math.floor(Math.random() * 40) + 60,
      defense: Math.floor(Math.random() * 40) + 60,
      speed: Math.floor(Math.random() * 40) + 60,
      charisma: Math.floor(Math.random() * 40) + 60,
      chaos: Math.floor(Math.random() * 40) + 60
    };
    
    // Determine rarity
    const rand = Math.random();
    const rarity = rand > 0.98 ? 'Legendary' : rand > 0.90 ? 'Epic' : rand > 0.70 ? 'Rare' : 'Common';
    
    const powers = ['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
    const power = powers[Math.floor(Math.random() * powers.length)];
    
    // Insert cat using RPC
    const { data: result, error: rpcError } = await supabase.rpc('submit_cat', {
      p_user_id: guestId,
      p_name: name,
      p_image_path: filePath,
      p_rarity: rarity,
      p_stats: stats,
      p_power: power
    });
    
    if (rpcError) {
      return NextResponse.json({ error: 'Failed to create cat: ' + rpcError.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      cat_id: result.cat_id,
      rarity,
      power,
      stats
    });
  } catch (e) {
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
