import { NextRequest, NextResponse } from 'next/server';
import { getPublicDuel } from '../../../../d/_lib/duels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function glowColor(guild: string | null | undefined): string {
  if (guild === 'sun') return '#FF8C00';
  if (guild === 'moon') return '#00BFFF';
  return '#a3a3a3';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const duelId = String(p.id || '').trim();
  if (!duelId) return NextResponse.json({ ok: false, error: 'Missing duel id' }, { status: 400 });

  const duel = await getPublicDuel(duelId);
  if (!duel) return NextResponse.json({ ok: false, error: 'Duel not found' }, { status: 404 });

  const aGlow = glowColor(duel.challenger_guild);
  const bGlow = glowColor(duel.challenged_guild);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05070d"/>
      <stop offset="100%" stop-color="#0b1020"/>
    </linearGradient>
    <linearGradient id="barA" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FF8C00"/>
      <stop offset="100%" stop-color="#FF4500"/>
    </linearGradient>
    <linearGradient id="barB" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00BFFF"/>
      <stop offset="100%" stop-color="#1E90FF"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bgA)"/>
  <circle cx="220" cy="170" r="260" fill="${aGlow}" opacity="0.15"/>
  <circle cx="860" cy="170" r="260" fill="${bGlow}" opacity="0.15"/>

  <text x="540" y="92" text-anchor="middle" font-size="44" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">CATCLASH ARENA</text>
  <text x="540" y="136" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="#9ca3af">Arena Pulse #${duel.pulse_number}</text>

  <rect x="70" y="220" width="420" height="620" rx="26" fill="#00000088" stroke="${aGlow}" stroke-opacity="0.45" stroke-width="3"/>
  <rect x="590" y="220" width="420" height="620" rx="26" fill="#00000088" stroke="${bGlow}" stroke-opacity="0.45" stroke-width="3"/>
  <image href="${esc(String(duel.challenger_cat?.image_url || '/cat-placeholder.svg'))}" x="88" y="238" width="384" height="432" preserveAspectRatio="xMidYMid slice"/>
  <image href="${esc(String(duel.challenged_cat?.image_url || '/cat-placeholder.svg'))}" x="608" y="238" width="384" height="432" preserveAspectRatio="xMidYMid slice"/>
  <rect x="88" y="620" width="384" height="120" fill="#000000aa"/>
  <rect x="608" y="620" width="384" height="120" fill="#000000aa"/>

  <text x="280" y="694" text-anchor="middle" font-size="44" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">${esc(String(duel.challenger_cat?.name || 'Cat A').slice(0, 16))}</text>
  <text x="800" y="694" text-anchor="middle" font-size="44" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">${esc(String(duel.challenged_cat?.name || 'Cat B').slice(0, 16))}</text>

  <text x="540" y="560" text-anchor="middle" font-size="90" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">VS</text>

  <rect x="120" y="908" width="840" height="28" rx="14" fill="#ffffff1f"/>
  <rect x="120" y="908" width="${Math.max(0, Math.min(840, Math.round((duel.votes.pct_a / 100) * 840)))}" height="28" rx="14" fill="url(#barA)"/>
  <rect x="${120 + Math.max(0, Math.min(840, Math.round((duel.votes.pct_a / 100) * 840)))}" y="908" width="${Math.max(0, 840 - Math.max(0, Math.min(840, Math.round((duel.votes.pct_a / 100) * 840))))}" height="28" rx="14" fill="url(#barB)"/>
  <text x="120" y="962" font-size="32" font-family="Arial, sans-serif" fill="#ffffff">${duel.votes.cat_a}</text>
  <text x="960" y="962" text-anchor="end" font-size="32" font-family="Arial, sans-serif" fill="#ffffff">${duel.votes.cat_b}</text>

  <rect x="120" y="1028" width="840" height="96" rx="18" fill="#00000088" stroke="#ffffff2f"/>
  <text x="150" y="1088" font-size="30" font-family="Arial, sans-serif" fill="#d1d5db">${esc(duel.social_proof_text)}</text>

  <text x="540" y="1810" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" font-weight="900" fill="#ffffff">catclash.org</text>
  <text x="540" y="1860" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#94a3b8">VUXSOLIA ERA</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
}

