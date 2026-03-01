import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeRecruitRank } from '../../../_lib/referrals';
import { resolveCatImageUrl } from '../../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(_: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const uname = String(username || '').trim();
    if (!uname) return NextResponse.json({ ok: false, error: 'Missing username' }, { status: 400 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id,username,guild')
      .ilike('username', uname)
      .maybeSingle();
    if (!profile?.id) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const [catsRes, refsRes] = await Promise.all([
      supabase
        .from('cats')
        .select('id,name,rarity,image_path')
        .eq('user_id', String(profile.id))
        .order('wins', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('social_referrals')
        .select('id,status,referrer_user_id,recruit_user_id')
        .eq('referrer_user_id', String(profile.id)),
    ]);

    const directQualified = (refsRes.data || []).filter((r) => String((r as any).status || '') === 'qualified').length;
    const rank = computeRecruitRank(directQualified);
    const hero = catsRes.data
      ? {
          id: String((catsRes.data as any).id || ''),
          name: String((catsRes.data as any).name || 'Champion'),
          rarity: String((catsRes.data as any).rarity || 'Common'),
          image_url: await resolveCatImageUrl(supabase, String((catsRes.data as any).image_path || '')),
        }
      : null;

    return NextResponse.json({
      ok: true,
      recruiter: {
        id: String(profile.id),
        username: String(profile.username || uname),
        guild: profile.guild || null,
        rank: rank.rank,
        next_rank: rank.nextRank,
        direct_qualified: directQualified,
      },
      hero_cat: hero,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
