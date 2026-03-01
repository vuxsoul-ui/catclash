import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovalNotificationPreference, sendCatPhotoApprovedEmail } from '../../../_lib/notifications';
import { isAdmin } from '../../_lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function POST(request: NextRequest) {
  try {
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

    // Step 1: Read current status
    const { data: before, error: readErr } = await supabase
      .from('cats')
      .select('id, name, status, image_review_status, user_id')
      .eq('id', catId)
      .single();

    if (readErr || !before) {
      return NextResponse.json({ ok: false, error: 'Cat not found: ' + (readErr?.message || 'null') }, { status: 404 });
    }

    console.log(`[APPROVE] Cat ${catId} current status: "${before.status}"`);

    const alreadyApproved =
      String(before.status || '').toLowerCase() === 'approved' &&
      String(before.image_review_status || '').toLowerCase() === 'approved';
    if (alreadyApproved) {
      return NextResponse.json({ ok: true, message: 'Already approved' });
    }

    // Step 2: Update
    let { data: updated, error: updateErr } = await supabase
      .from('cats')
      .update({
        status: 'approved',
        image_review_status: 'approved',
        image_review_reason: null,
        image_reviewed_at: new Date().toISOString(),
      })
      .eq('id', catId)
      .select('id, status, image_review_status')
      .maybeSingle();

    if (updateErr?.message?.includes('image_review_status')) {
      ({ data: updated, error: updateErr } = await supabase
        .from('cats')
        .update({ status: 'approved' })
        .eq('id', catId)
        .select('id, status')
        .maybeSingle());
      if (!updateErr && updated) {
        return NextResponse.json({ ok: true, message: 'Cat approved', catId, email_sent: false });
      }
    }

    console.log(`[APPROVE] Update result: error=${updateErr?.message || 'none'}, status="${updated?.status || 'null'}"`);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: 'Update failed: ' + updateErr.message }, { status: 500 });
    }

    // Step 3: Verify it actually changed
    const { data: after, error: verifyErr } = await supabase
      .from('cats')
      .select('id, status, image_review_status')
      .eq('id', catId)
      .maybeSingle();

    console.log(`[APPROVE] After update: status="${after?.status}", verifyErr=${verifyErr?.message || 'none'}`);

    if (
      verifyErr ||
      !after ||
      String(after.status || '').trim().toLowerCase() !== 'approved' ||
      String(after.image_review_status || '').trim().toLowerCase() !== 'approved'
    ) {
      return NextResponse.json(
        { ok: false, error: `Approve did not persist. Current status="${after?.status || 'unknown'}"` },
        { status: 500 }
      );
    }

    let emailSent = false;
    const pref = await getApprovalNotificationPreference(supabase, before.user_id);
    if (pref?.cat_photo_approved_enabled && pref.email) {
      const { data: existingNotice } = await supabase
        .from('cat_approval_notifications')
        .select('cat_id')
        .eq('cat_id', catId)
        .maybeSingle();
      if (!existingNotice) {
        const sent = await sendCatPhotoApprovedEmail({
          to: pref.email,
          catName: before.name || 'Your cat',
          catId,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
        });
        if (sent.ok) {
          emailSent = !sent.skipped;
          await supabase.from('cat_approval_notifications').insert({
            cat_id: catId,
            user_id: before.user_id,
            approved_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ ok: true, message: 'Cat photo approved', catId, email_sent: emailSent });
  } catch (e) {
    console.error('[APPROVE] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
