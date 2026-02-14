import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: cats, error } = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, stats, ability, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    
    const catsWithUrls = cats?.map(cat => {
      const { data: urlData } = supabase.storage.from('cat-images').getPublicUrl(cat.image_path);
      return { ...cat, image_url: urlData?.publicUrl || cat.image_path };
    }) || [];
    
    return NextResponse.json({ ok: true, cats: catsWithUrls });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
