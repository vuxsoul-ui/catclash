// REPLACE: app/api/admin/cats/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const catId = body.catId;
  if (!catId) {
    return NextResponse.json({ ok: false, error: 'Missing catId' }, { status: 400 });
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let { data: updated, error } = await supabase
    .from('cats')
    .update({
      status: 'approved',
      image_review_status: 'disapproved',
      image_reviewed_at: new Date().toISOString(),
      image_review_reason: 'Photo disapproved by admin review',
    })
    .eq('id', catId)
    .select('id, status, image_review_status')
    .maybeSingle();

  if (error?.message?.includes('image_review_status')) {
    ({ data: updated, error } = await supabase
      .from('cats')
      .update({ status: 'rejected' })
      .eq('id', catId)
      .select('id, status')
      .maybeSingle());
    if (!error && updated) {
      return NextResponse.json({ ok: true, message: 'Cat rejected' });
    }
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!updated || String(updated.image_review_status || '').trim().toLowerCase() !== 'disapproved') {
    return NextResponse.json(
      { ok: false, error: 'Disapprove did not persist. Check RLS/service-role configuration.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: 'Cat photo disapproved' });
}
