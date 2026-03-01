import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../_lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const includeAll = request.nextUrl.searchParams.get('include_all') === '1';
  const statusParam = String(request.nextUrl.searchParams.get('status') || '').toLowerCase();

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch all and filter in JS to avoid status filter inconsistencies.
  let data: Array<Record<string, unknown>> | null = null;
  let error: { message?: string } | null = null;

  const firstQuery = await supabase
    .from('cats')
    .select('id, name, image_path, rarity, status, image_review_status, image_review_reason, created_at, description')
    .order('created_at', { ascending: false });
  data = (firstQuery.data as Array<Record<string, unknown>> | null) || null;
  error = firstQuery.error;

  if (error?.message?.includes('image_review_status')) {
    const fallbackQuery = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, status, created_at, description')
      .order('created_at', { ascending: false });
    data = (fallbackQuery.data as Array<Record<string, unknown>> | null) || null;
    error = fallbackQuery.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const allCats = (data || []) as Array<{
    id: string;
    name: string;
    image_path: string | null;
    rarity: string | null;
    status: string | null;
    image_review_status?: string | null;
    image_review_reason?: string | null;
    created_at: string;
    description?: string | null;
  }>;
  const pendingCats = allCats.filter(cat => String(cat.image_review_status || 'pending_review').trim().toLowerCase() === 'pending_review');
  const approvedImages = allCats.filter(cat => String(cat.image_review_status || '').trim().toLowerCase() === 'approved');
  const disapprovedImages = allCats.filter(cat => String(cat.image_review_status || '').trim().toLowerCase() === 'disapproved');

  let filteredCats = includeAll ? allCats : pendingCats;
  if (statusParam === 'approved') filteredCats = approvedImages;
  if (statusParam === 'rejected') filteredCats = disapprovedImages;
  if (statusParam === 'pending') filteredCats = pendingCats;
  if (statusParam === 'all') filteredCats = allCats;

  const cats = filteredCats.map(cat => ({
    id: cat.id,
    name: cat.name,
    status: cat.status,
    image_review_status: cat.image_review_status || 'pending_review',
    image_review_reason: cat.image_review_reason || null,
    rarity: cat.rarity || 'Common',
    description: cat.description || null,
    created_at: cat.created_at,
    image_url: cat.image_path
      ? supabase.storage.from('cat-images').getPublicUrl(cat.image_path).data?.publicUrl
      : null,
    image_path: cat.image_path,
  }));

  return NextResponse.json(
    { ok: true, cats },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } }
  );
}
