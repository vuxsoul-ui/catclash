// REPLACE: app/api/admin/cats/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-admin-secret');
    if (authHeader !== ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const catId = body.catId;

    if (!catId) {
      return NextResponse.json({ ok: false, error: 'Missing catId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify cat exists and is pending
    const { data: existing, error: fetchError } = await supabase
      .from('cats')
      .select('id, name, status')
      .eq('id', catId)
      .single();

    if (fetchError) {
      return NextResponse.json({ ok: false, error: 'Cat not found: ' + fetchError.message }, { status: 404 });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    }

    if (existing.status === 'approved') {
      return NextResponse.json({ ok: true, message: 'Already approved', catId });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'Status is "' + existing.status + '", expected "pending"' }, { status: 400 });
    }

    // Update
    const { data: updated, error: updateError } = await supabase
      .from('cats')
      .update({ status: 'approved' })
      .eq('id', catId)
      .select('id, name, status')
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: 'Update failed: ' + updateError.message }, { status: 500 });
    }

    if (!updated || updated.status !== 'approved') {
      return NextResponse.json({ ok: false, error: 'Update did not persist' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Cat approved', catId: updated.id, verified: true });
  } catch (e) {
    console.error('[APPROVE] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}