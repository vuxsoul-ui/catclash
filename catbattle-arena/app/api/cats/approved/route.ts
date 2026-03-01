import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET(request: NextRequest) {
  try {
    const limit = Math.max(1, Math.min(48, Number(request.nextUrl.searchParams.get('limit') || 12)));
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || 0));
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let data: Array<Record<string, unknown>> | null = null;
    let error: { message?: string } | null = null;

    const primaryQuery = await supabase
      .from('cats')
      .select('id, user_id, name, image_path, image_url_thumb, image_review_status, rarity, status, origin, created_at')
      .eq('status', 'approved')
      .eq('origin', 'submitted')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    data = (primaryQuery.data as Array<Record<string, unknown>> | null) || null;
    error = primaryQuery.error;

    if (error?.message?.includes('origin')) {
      const noOriginQuery = await supabase
        .from('cats')
        .select('id, user_id, name, image_path, image_url_thumb, image_review_status, rarity, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      data = (noOriginQuery.data as Array<Record<string, unknown>> | null) || null;
      error = noOriginQuery.error;
    }

    if (error?.message?.includes('image_url_thumb')) {
      const fallbackQuery = await supabase
        .from('cats')
        .select('id, user_id, name, image_path, image_review_status, rarity, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      data = (fallbackQuery.data as Array<Record<string, unknown>> | null) || null;
      error = fallbackQuery.error;
    }

    if (error?.message?.includes('image_review_status')) {
      const fallbackQuery = await supabase
        .from('cats')
        .select('id, user_id, name, image_path, rarity, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      data = (fallbackQuery.data as Array<Record<string, unknown>> | null) || null;
      error = fallbackQuery.error;
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []) as Array<{
      id: string;
      user_id?: string | null;
      name: string;
      image_path: string | null;
      image_url_thumb?: string | null;
      image_review_status?: string | null;
      rarity: string | null;
      status: string | null;
      origin?: string | null;
      created_at: string;
    }>;

    const userIds = Array.from(new Set(rows.map((cat) => String(cat.user_id || '')).filter(Boolean)));
    const { data: profileRows } = userIds.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', userIds)
      : { data: [] as Array<{ id: string; username: string | null }> };
    const usernameById = new Map<string, string>();
    for (const p of profileRows || []) {
      const username = String(p.username || '').trim();
      if (username) usernameById.set(String(p.id), username);
    }

    const cats = rows
      .filter((cat) => {
        const status = String(cat.status || '').trim().toLowerCase();
        const origin = String(cat.origin || 'submitted').trim().toLowerCase();
        return status === 'approved' && origin === 'submitted';
      })
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        thumb_url: normalizeCatImageUrl({ id: String(cat.id), image_url: cat.image_url_thumb || cat.image_path || null }),
        rarity: cat.rarity || 'Common',
        owner_username: usernameById.get(String(cat.user_id || '')) || null,
        created_at: String(cat.created_at || ''),
      }));

    const hasMore = rows.length >= limit;

    return NextResponse.json(
      { ok: true, cats, limit, offset, hasMore },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
