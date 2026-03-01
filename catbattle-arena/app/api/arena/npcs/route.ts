import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { isPlaceholderLikeImage, resolveCatImageUrl, stableNpcImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

function scoreForUser(userId: string, catId: string): number {
  const key = `${userId}:${catId}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

export async function GET() {
  try {
    const userId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from('cats')
      .select('id, user_id, name, rarity, image_path, image_review_status')
      .eq('status', 'approved')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(120);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const picked = (data || [])
      .slice()
      .sort((a, b) => scoreForUser(userId, a.id) - scoreForUser(userId, b.id))
      .slice(0, 12);
    const npcs = await Promise.all(
      picked.map(async (c) => {
        let imageUrl = await resolveCatImageUrl(supabase, c.image_path, c.image_review_status || null);
        if ((!imageUrl || isPlaceholderLikeImage(imageUrl)) && c.user_id === '00000000-0000-0000-0000-000000000000') {
          imageUrl = stableNpcImageUrl(c.id, 320);
        }
        return {
          id: c.id,
          name: c.name,
          rarity: c.rarity || 'Common',
          image_url: imageUrl,
        };
      })
    );

    return NextResponse.json({ ok: true, npcs });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
