import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side power calculation based on stats
function calculatePower(stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number }): number {
  return Math.round((stats.attack + stats.defense + stats.speed + stats.charisma + stats.chaos) / 5);
}

export async function POST(request: NextRequest) {
  try {
    const guestId = getGuestId();
    let formData: FormData;
    
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
    }
    
    const name = formData.get('name') as string;
    const image = formData.get('image') as File;
    
    if (!name || !image) {
      return NextResponse.json({ ok: false, error: 'Missing name or image' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Upload image to Storage
    const fileExt = image.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `cats/${guestId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('cat-images')
      .upload(filePath, image, { contentType: image.type });
    
    if (uploadError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'upload_failed', 
        details: uploadError.message 
      }, { status: 500 });
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('cat-images')
      .getPublicUrl(filePath);
    
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
    
    const abilities = ['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
    const ability = abilities[Math.floor(Math.random() * abilities.length)];
    
    // Calculate power server-side
    const power = calculatePower(stats);
    
    // Insert cat using submit_cat_v2 - only send ability, not power
    const { data: result, error: rpcError } = await supabase.rpc('submit_cat_v2', {
      p_user_id: guestId,
      p_name: name,
      p_image_path: filePath,
      p_rarity: rarity,
      p_stats: stats,
      p_ability: ability
    });
    
    if (rpcError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'db_failed', 
        details: rpcError.message,
        rpc_called: 'submit_cat_v2'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      ok: true,
      rpc_called: 'submit_cat_v2',
      cat_id: result.cat_id,
      image_url: publicUrlData.publicUrl,
      rarity,
      ability,
      power,
      stats
    });
  } catch (e) {
    return NextResponse.json({ 
      ok: false, 
      error: 'server_error', 
      details: String(e),
      rpc_called: 'submit_cat_v2'
    }, { status: 500 });
  }
}
