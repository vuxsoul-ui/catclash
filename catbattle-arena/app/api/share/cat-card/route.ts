import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'Rare': return '#60a5fa';
    case 'Epic': return '#c084fc';
    case 'Legendary': return '#facc15';
    case 'Mythic': return '#f87171';
    case 'God-Tier': return '#f472b6';
    default: return '#9ca3af';
  }
}

export async function GET(request: NextRequest) {
  try {
    const catId = String(request.nextUrl.searchParams.get('cat_id') || '').trim();
    const ref = String(request.nextUrl.searchParams.get('ref') || '').trim();
    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cat, error } = await supabase
      .from('cats')
      .select('id, user_id, name, rarity, ability, attack, defense, speed, charisma, chaos, image_path, image_review_status')
      .eq('id', catId)
      .maybeSingle();
    if (error || !cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });

    const { data: owner } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', cat.user_id)
      .maybeSingle();

    const img = await resolveCatImageUrl(supabase, cat.image_path, cat.image_review_status || null, 'card');
    const ownerName = owner?.username ? `@${owner.username}` : 'Arena Challenger';
    const color = rarityColor(String(cat.rarity || 'Common'));
    const total = Number(cat.attack || 0) + Number(cat.defense || 0) + Number(cat.speed || 0) + Number(cat.charisma || 0) + Number(cat.chaos || 0);
    const inviteTag = ref ? `Invite: ${ref.slice(0, 8)}` : 'Join CatClash Arena';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08090c"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#accent)"/>
  <rect x="52" y="52" width="500" height="526" rx="24" fill="#00000055" stroke="#ffffff22"/>
  <image href="${esc(img || '/cat-placeholder.svg')}" x="64" y="64" width="476" height="426" preserveAspectRatio="xMidYMid slice"/>
  <rect x="64" y="430" width="476" height="60" fill="#00000099"/>
  <text x="78" y="468" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${esc(String(cat.name || 'Unnamed Cat').slice(0, 26))}</text>

  <text x="600" y="120" font-size="56" font-family="Arial, sans-serif" font-weight="800" fill="#ffffff">CatClash Arena</text>
  <text x="600" y="172" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="${color}">${esc(String(cat.rarity || 'Common'))}</text>
  <text x="600" y="214" font-size="24" font-family="Arial, sans-serif" fill="#cbd5e1">Owner ${esc(ownerName)}</text>
  <text x="600" y="252" font-size="22" font-family="Arial, sans-serif" fill="#94a3b8">Ability: ${esc(String(cat.ability || 'Unknown'))}</text>
  <text x="600" y="294" font-size="22" font-family="Arial, sans-serif" fill="#f8fafc">Total Stats: ${total}</text>

  <text x="600" y="352" font-size="20" font-family="Arial, sans-serif" fill="#e2e8f0">ATK ${Number(cat.attack || 0)}  DEF ${Number(cat.defense || 0)}  SPD ${Number(cat.speed || 0)}</text>
  <text x="600" y="388" font-size="20" font-family="Arial, sans-serif" fill="#e2e8f0">CHA ${Number(cat.charisma || 0)}  CHS ${Number(cat.chaos || 0)}</text>

  <rect x="600" y="454" width="548" height="58" rx="14" fill="#10b98122" stroke="#10b98155"/>
  <text x="624" y="492" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="#6ee7b7">${esc(inviteTag)}</text>

  <text x="600" y="558" font-size="22" font-family="Arial, sans-serif" fill="#f8fafc">catclash.org</text>
</svg>`;

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
