import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { preferCardImage } from '../../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rarityTheme(rarity: string): { color: string; bgA: string; bgB: string; frame: string } {
  if (rarity === 'Rare') return { color: '#60a5fa', bgA: '#09121e', bgB: '#0b2037', frame: 'rgba(96,165,250,0.35)' };
  if (rarity === 'Epic') return { color: '#c084fc', bgA: '#140b20', bgB: '#22113b', frame: 'rgba(192,132,252,0.4)' };
  if (rarity === 'Legendary') return { color: '#facc15', bgA: '#1e1502', bgB: '#322105', frame: 'rgba(250,204,21,0.45)' };
  if (rarity === 'Mythic') return { color: '#fb7185', bgA: '#1f0a13', bgB: '#360d1f', frame: 'rgba(251,113,133,0.45)' };
  if (rarity === 'God-Tier') return { color: '#22d3ee', bgA: '#090b1f', bgB: '#241047', frame: 'rgba(34,211,238,0.5)' };
  return { color: '#9ca3af', bgA: '#111111', bgB: '#1c1c1c', frame: 'rgba(156,163,175,0.35)' };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const id = String(p.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

    const { data: card } = await sb
      .from('share_cards')
      .select('public_slug, cat_id, name, rarity, level, power_rating, stats, image_original_url, owner_display_name, is_public')
      .eq('public_slug', id)
      .maybeSingle();

    if (!card || !card.is_public) {
      return NextResponse.json({ ok: false, error: 'Card not found' }, { status: 404 });
    }
    const originalImageUrl = String(card.image_original_url || '').trim();
    const preferredCardUrl = preferCardImage(originalImageUrl);
    const finalImageUrl = preferredCardUrl || originalImageUrl || '/cat-placeholder.svg';
    if (process.env.NODE_ENV !== 'production' && /\/original\.(?:jpg|jpeg|png|webp|avif|gif)(?:$|[?#])/i.test(finalImageUrl)) {
      // eslint-disable-next-line no-console
      console.warn(`[DEV WARNING] ShareCard using ORIGINAL fallback: ${finalImageUrl}`);
    }

    const s = (card.stats || {}) as Record<string, number>;
    const atk = Number(s.atk || 0);
    const def = Number(s.def || 0);
    const spd = Number(s.spd || 0);
    const cha = Number(s.cha || 0);
    const chs = Number(s.chs || 0);
    let description = '';
    if (card?.cat_id) {
      const { data: cat } = await sb
        .from('cats')
        .select('description')
        .eq('id', card.cat_id)
        .maybeSingle();
      description = String(cat?.description || '').trim().slice(0, 120);
    }
    const t = rarityTheme(String(card.rarity || 'Common'));

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bgA}"/>
      <stop offset="100%" stop-color="${t.bgB}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.color}"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="36" y="36" width="1008" height="1278" rx="34" fill="#00000044" stroke="${t.frame}" stroke-width="4"/>

  <image href="${esc(finalImageUrl)}" x="72" y="90" width="936" height="700" preserveAspectRatio="xMidYMid slice"/>
  <rect x="72" y="670" width="936" height="120" fill="#000000aa"/>
  <text x="96" y="746" font-size="62" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">${esc(String(card.name || 'Unnamed Cat').slice(0, 24))}</text>

  <rect x="96" y="60" rx="14" ry="14" width="180" height="52" fill="#00000088" stroke="${t.frame}"/>
  <text x="116" y="95" font-size="28" font-family="Arial, sans-serif" font-weight="800" fill="${t.color}">${esc(String(card.rarity || 'Common').toUpperCase())}</text>

  <rect x="840" y="60" rx="16" ry="16" width="164" height="56" fill="#00000088" stroke="#ffffff33"/>
  <text x="872" y="97" font-size="30" font-family="Arial, sans-serif" font-weight="800" fill="#ffffff">LV ${Number(card.level || 1)}</text>

  <text x="96" y="860" font-size="36" font-family="Arial, sans-serif" font-weight="700" fill="#e2e8f0">Power Rating</text>
  <text x="952" y="860" text-anchor="end" font-size="50" font-family="Arial, sans-serif" font-weight="900" fill="${t.color}">${Number(card.power_rating || 0)}</text>

  <text x="96" y="930" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#f87171">ATK ${atk}</text>
  <text x="300" y="930" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#60a5fa">DEF ${def}</text>
  <text x="500" y="930" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#4ade80">SPD ${spd}</text>
  <text x="700" y="930" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#f472b6">CHA ${cha}</text>
  <text x="900" y="930" text-anchor="end" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#fb923c">CHS ${chs}</text>
  ${description ? `<text x="96" y="970" font-size="22" font-family="Arial, sans-serif" fill="#cbd5e1" font-style="italic">&quot;${esc(description)}&quot;</text>` : ''}

  <rect x="96" y="992" width="888" height="92" rx="20" fill="#0b1d2e" stroke="${t.frame}"/>
  <text x="128" y="1048" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#d1fae5">CAT WARS • ${esc(String(card.owner_display_name || 'Arena Challenger'))}</text>

  <text x="96" y="1200" font-size="30" font-family="Arial, sans-serif" font-weight="800" fill="#ffffff">Share: catclash.org</text>
  <text x="96" y="1240" font-size="22" font-family="Arial, sans-serif" fill="#94a3b8">${esc(String(id))}</text>
</svg>`;

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
