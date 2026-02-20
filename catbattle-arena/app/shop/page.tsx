'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Check, Eye } from 'lucide-react';
import SigilIcon from '../components/icons/SigilIcon';
import SigilBalanceChip from '../components/SigilBalanceChip';
import CosmeticPreview from '../components/cosmetics/CosmeticPreview';
import CosmeticPreviewSheet from '../components/cosmetics/CosmeticPreviewSheet';
import { canPurchaseCosmetic, resolveCosmeticEffect } from '../_lib/cosmetics/effectsRegistry';
import { Badge, Button, Card, Chip, SectionHeader } from '../components/ui/primitives';

type ShopItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  description: string | null;
  price_sigils: number;
  metadata: Record<string, unknown>;
  owned: boolean;
  equipped_slot: string | null;
  slot?: string;
  effect_id?: string;
  effect_implemented?: boolean;
  purchasable?: boolean;
};

type PriceTier = 'entry' | 'identity' | 'prestige' | 'elite' | 'mythic';

function displayCategory(item: ShopItem): string {
  const cosmeticType = String(item.metadata?.cosmetic_type || '');
  if (item.slug.startsWith('vote-') || cosmeticType === 'vote_effect') return 'vote_effect';
  if (item.slug.startsWith('badge-') || cosmeticType === 'voter_badge') return 'voter_badge';
  return item.category;
}

function priceTier(price: number): PriceTier {
  const p = Math.max(0, Number(price || 0));
  if (p >= 900) return 'mythic';
  if (p >= 620) return 'elite';
  if (p >= 360) return 'prestige';
  if (p >= 180) return 'identity';
  return 'entry';
}

function telemetry(event: string, payload: Record<string, unknown>) {
  fetch('/api/telemetry/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, payload }),
  }).catch(() => null);
}

export default function ShopPage() {
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [sigils, setSigils] = useState(0);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [featuredItems, setFeaturedItems] = useState<ShopItem[]>([]);
  const [limitedItems, setLimitedItems] = useState<ShopItem[]>([]);
  const [featuredDayKey, setFeaturedDayKey] = useState('');
  const [refreshAtUtc, setRefreshAtUtc] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState('00:00:00');
  const [message, setMessage] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [sortMode, setSortMode] = useState<'recommended' | 'price_low' | 'price_high' | 'rarity'>('recommended');
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [previewStageItem, setPreviewStageItem] = useState<ShopItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [catalogRes, featuredRes] = await Promise.all([
        fetch('/api/shop/catalog', { cache: 'no-store' }),
        fetch('/api/shop/featured', { cache: 'no-store' }),
      ]);
      const catalogData = await catalogRes.json();
      const featuredData = await featuredRes.json().catch(() => ({ ok: false }));

      if (catalogRes.ok && catalogData.ok) {
        setSigils(catalogData.sigils || 0);
        setItems(catalogData.cosmetics || []);

        if (featuredRes.ok && featuredData.ok) {
          setFeaturedItems(featuredData.items || []);
          setLimitedItems(featuredData.limitedTime || []);
          setFeaturedDayKey(featuredData.dayKey || '');
          setRefreshAtUtc(featuredData.refreshAtUtc || null);
        } else {
          setFeaturedItems([]);
          setLimitedItems([]);
          setRefreshAtUtc(null);
        }
      } else {
        setMessage(catalogData.error || 'Failed to load shop');
      }
    } catch {
      setMessage('Failed to load shop');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const hidden = localStorage.getItem('tip_shop_v1') === '1';
    setShowTip(!hidden);
  }, []);

  useEffect(() => {
    if (!refreshAtUtc) {
      setRefreshCountdown('00:00:00');
      return;
    }
    const tick = () => {
      const ms = Math.max(0, new Date(refreshAtUtc).getTime() - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRefreshCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [refreshAtUtc]);

  async function buy(item: ShopItem) {
    if (busySlug) return;
    const purchaseAllowed = item.purchasable ?? canPurchaseCosmetic(item);
    if (!purchaseAllowed) {
      setMessage('Preview coming soon for this cosmetic');
      return;
    }

    setBusySlug(item.slug);
    setMessage(null);
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: item.slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.error || 'Purchase failed');
      } else {
        setMessage('Purchased');
        telemetry('shop_item_purchased', { slug: item.slug, category: item.category, rarity: item.rarity });
        await load();
      }
    } catch {
      setMessage('Purchase failed');
    } finally {
      setBusySlug(null);
    }
  }

  async function equip(item: ShopItem) {
    if (busySlug) return;
    setBusySlug(item.slug);
    setMessage(null);
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: item.slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.error || 'Equip failed');
      } else {
        setMessage('Equipped');
        telemetry('cosmetic_equipped', { slug: item.slug, category: item.category });
        await load();
      }
    } catch {
      setMessage('Equip failed');
    } finally {
      setBusySlug(null);
    }
  }

  const grouped = useMemo(() => {
    const rarityRank: Record<string, number> = { 'God-Tier': 6, Mythic: 5, Legendary: 4, Epic: 3, Rare: 2, Common: 1 };
    const sortItems = (arr: ShopItem[]) => {
      const copy = [...arr];
      if (sortMode === 'price_low') copy.sort((a, b) => a.price_sigils - b.price_sigils);
      if (sortMode === 'price_high') copy.sort((a, b) => b.price_sigils - a.price_sigils);
      if (sortMode === 'rarity') copy.sort((a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0) || a.price_sigils - b.price_sigils);
      if (sortMode === 'recommended') {
        copy.sort((a, b) => {
          const aScore = (a.owned ? -5 : 0) + (a.equipped_slot ? -10 : 0) + (rarityRank[a.rarity] || 0);
          const bScore = (b.owned ? -5 : 0) + (b.equipped_slot ? -10 : 0) + (rarityRank[b.rarity] || 0);
          if (bScore !== aScore) return bScore - aScore;
          return a.price_sigils - b.price_sigils;
        });
      }
      return copy;
    };

    const seed: Record<string, ShopItem[]> = {
      cat_title: [],
      cat_border: [],
      cat_color: [],
      xp_boost: [],
      voter_badge: [],
      vote_effect: [],
    };
    for (const i of items) {
      const k = displayCategory(i) || 'cat_title';
      if (!seed[k]) seed[k] = [];
      seed[k].push(i);
    }
    for (const k of Object.keys(seed)) seed[k] = sortItems(seed[k]);
    return seed;
  }, [items, sortMode]);

  function categoryLabel(category: string): string {
    if (category === 'cat_title' || category === 'title') return 'Cat Titles';
    if (category === 'cat_border' || category === 'border') return 'Cat Borders';
    if (category === 'cat_color' || category === 'color') return 'Cat Colors';
    if (category === 'xp_boost' || category === 'xp') return 'XP Boosts';
    if (category === 'voter_badge' || category === 'badge') return 'Voter Badges';
    if (category === 'vote_effect' || category === 'effect') return 'Vote Effects';
    return category.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function categoryIcon(category: string): string {
    if (category === 'cat_title' || category === 'title') return '🏷';
    if (category === 'cat_border' || category === 'border') return '🖼';
    if (category === 'cat_color' || category === 'color') return '🎨';
    if (category === 'xp_boost' || category === 'xp') return '⚡';
    if (category === 'voter_badge' || category === 'badge') return '🎖';
    if (category === 'vote_effect' || category === 'effect') return '✨';
    return '🛍';
  }

  function rarityBadgeClass(rarity: string): string {
    if (rarity === 'God-Tier') return 'text-pink-300 border-pink-400/40 bg-pink-500/15';
    if (rarity === 'Mythic') return 'text-red-300 border-red-400/40 bg-red-500/15';
    if (rarity === 'Legendary') return 'text-yellow-200 border-yellow-400/40 bg-yellow-500/15';
    if (rarity === 'Epic') return 'text-purple-200 border-purple-400/40 bg-purple-500/15';
    if (rarity === 'Rare') return 'text-blue-200 border-blue-400/40 bg-blue-500/15';
    return 'text-zinc-200 border-zinc-400/40 bg-zinc-500/15';
  }

  function rarityCardClass(rarity: string): string {
    if (rarity === 'God-Tier') return 'border-pink-400/35 shadow-[0_0_28px_rgba(236,72,153,0.24)]';
    if (rarity === 'Mythic') return 'border-red-400/35 shadow-[0_0_26px_rgba(239,68,68,0.22)]';
    if (rarity === 'Legendary') return 'border-amber-300/35 shadow-[0_0_24px_rgba(251,191,36,0.2)]';
    if (rarity === 'Epic') return 'border-purple-400/28 shadow-[0_0_20px_rgba(168,85,247,0.18)]';
    if (rarity === 'Rare') return 'border-blue-400/26 shadow-[0_0_16px_rgba(96,165,250,0.16)]';
    return 'border-white/10';
  }

  function tierMeta(price: number): { label: string; chip: string; helper?: string } {
    const tier = priceTier(price);
    if (tier === 'mythic') return { label: 'Mythic Rotation', chip: 'text-rose-200 border-rose-300/35 bg-rose-500/15', helper: 'Limited spotlight' };
    if (tier === 'elite') return { label: 'Elite Tier', chip: 'text-amber-100 border-amber-300/35 bg-amber-500/15', helper: 'Aspirational flex' };
    if (tier === 'prestige') return { label: 'Prestige Drop', chip: 'text-violet-200 border-violet-300/35 bg-violet-500/15', helper: 'Identity-defining' };
    if (tier === 'identity') return { label: 'Identity Tier', chip: 'text-cyan-200 border-cyan-300/35 bg-cyan-500/15' };
    return { label: 'Entry Flex', chip: 'text-zinc-200 border-zinc-300/35 bg-zinc-500/15' };
  }

  function openPreview(item: ShopItem) {
    setPreviewItem(item);
    setPreviewStageItem(item);
    telemetry('shop_item_preview_opened', { slug: item.slug, category: item.category, rarity: item.rarity });
  }

  function renderCard(item: ShopItem, keyPrefix = '') {
    const purchaseAllowed = item.purchasable ?? canPurchaseCosmetic(item);
    const effect = resolveCosmeticEffect(item);

    return (
      <button
        type="button"
        key={`${keyPrefix}${item.id}`}
        onClick={() => openPreview(item)}
        className={`text-left w-full rounded-xl border bg-black/30 p-3 transition hover:bg-black/45 ${rarityCardClass(item.rarity)}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-bold text-sm pr-2">{item.name}</p>
          <div className="flex items-center gap-1.5">
            {item.owned && !item.equipped_slot && <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/75">Owned</span>}
            {item.equipped_slot && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Equipped</span>}
          </div>
        </div>

        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded border ${rarityBadgeClass(item.rarity)}`}>{item.rarity}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${tierMeta(item.price_sigils).chip}`}>{tierMeta(item.price_sigils).label}</span>
          {!purchaseAllowed && <span className="text-[10px] px-2 py-0.5 rounded border border-amber-300/35 bg-amber-500/15 text-amber-200">Preview coming soon</span>}
          {effect.motion !== 'static' && <span className="text-[10px] text-cyan-200/85">Animated</span>}
        </div>

        <div className="mb-2">
          <CosmeticPreview
            cosmetic={item}
            compact
            onInteracted={() => telemetry('shop_item_preview_interacted', { slug: item.slug, category: item.category })}
          />
        </div>

        <p className="text-xs text-white/45 mb-2 line-clamp-2">{item.description || effect.description}</p>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs inline-flex items-center gap-1 ${sigils < item.price_sigils && !item.owned ? 'text-red-300' : 'text-cyan-200'}`}>
            <SigilIcon className="w-3.5 h-3.5" />
            {item.price_sigils}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewStageItem(item);
                telemetry('shop_preview_stage_applied', { slug: item.slug, category: item.category, rarity: item.rarity });
              }}
              className="h-7 px-2 rounded-lg bg-white/10 text-white/80 text-[11px] inline-flex items-center gap-1 hover:bg-white/20"
            >
              <Eye className="w-3 h-3" />Preview
            </button>
            {!item.owned ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  buy(item);
                }}
                disabled={busySlug === item.slug || sigils < item.price_sigils || !purchaseAllowed}
                className="px-3 py-1.5 rounded-lg bg-yellow-400 text-black text-xs font-bold disabled:opacity-40"
              >
                {busySlug === item.slug ? '...' : 'Buy'}
              </button>
            ) : item.category !== 'xp_boost' && item.category !== 'xp' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  equip(item);
                }}
                disabled={busySlug === item.slug || !!item.equipped_slot}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1"
              >
                {item.equipped_slot ? <><Check className="w-3 h-3" /> Equipped</> : (busySlug === item.slug ? '...' : 'Equip')}
              </button>
            ) : (
              <span className="text-[11px] text-white/40">Consumable</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-5 pb-28 sm:py-6 sm:pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <SigilBalanceChip balance={sigils} size="sm" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Cosmetics Shop</h1>
        <p className="text-white/45 text-sm mb-5">What you preview is what you equip.</p>

        <Card className="mb-5 border-cyan-300/20 bg-gradient-to-br from-cyan-500/8 via-white/0 to-indigo-500/12">
          <SectionHeader>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-cyan-200/80">Preview Stage</p>
              <p className="text-sm font-bold text-white">Try any cosmetic before buying</p>
            </div>
            {previewStageItem ? <Badge>Live Preview</Badge> : <Chip>Tap Preview on any item</Chip>}
          </SectionHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-black/35 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/55 mb-1">Fighter Card</p>
              <CosmeticPreview cosmetic={previewStageItem || ({ name: 'Sample Fighter', rarity: 'Common', slug: 'title-rookie', category: 'cat_title' } as ShopItem)} />
            </div>
            <div className="rounded-xl border border-white/15 bg-black/35 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/55 mb-1">Duel Card Accent</p>
              <CosmeticPreview cosmetic={previewStageItem || ({ name: 'Sample Duel FX', rarity: 'Rare', slug: 'vote-comet-trail', category: 'vote_effect' } as ShopItem)} />
            </div>
          </div>
        </Card>

        <section className="mb-5 rounded-2xl border border-purple-300/20 bg-gradient-to-r from-purple-500/12 to-cyan-500/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/80">Premium Crates</p>
              <p className="text-sm font-bold text-white">Epic Chaos Crate</p>
              <p className="text-[11px] text-white/65">Enhanced Legendary & Mythic odds · High-Voltage Odds</p>
            </div>
            <Link href="/crate" className="h-10 px-3 rounded-xl bg-purple-300 text-black text-xs font-bold inline-flex items-center justify-center">
              Open Crates
            </Link>
          </div>
          <details className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-white/85">View Drop Table</summary>
            <p className="mt-1 text-[11px] text-white/70">Common 30 · Rare 28 · Epic 20 · Legendary 12 · Mythic 7 · God 3</p>
          </details>
        </section>

        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-[11px] text-white/45">Tap any item card for full quick preview.</p>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="h-8 px-2 rounded-lg bg-white/10 border border-white/15 text-[11px] text-white"
          >
            <option value="recommended">Recommended</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rarity">Rarity</option>
          </select>
        </div>

        {showTip && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-white/65">Items without implemented effects are labeled and cannot be purchased yet.</p>
              <button
                onClick={() => { localStorage.setItem('tip_shop_v1', '1'); setShowTip(false); }}
                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {message && <div className="mb-4 text-sm text-cyan-300">{message}</div>}

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-white/40" /></div>
        ) : (
          <div className="space-y-6">
            <Card className="border-cyan-400/20 bg-cyan-500/[0.05]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-bold inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-300" /> Featured Today</h2>
                  <p className="text-[11px] text-white/50">Daily-seeded picks{featuredDayKey ? ` · ${featuredDayKey}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Refresh In</p>
                  <p className="text-xs font-bold text-cyan-200">{refreshCountdown}</p>
                </div>
              </div>
              {featuredItems.length ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {featuredItems.map((item) => renderCard(item, 'featured-'))}
                </div>
              ) : (
                <p className="text-xs text-white/50">No featured items available today.</p>
              )}
            </Card>

            <Card className="bg-white/[0.03]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Limited-Time</h2>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60">Soon</span>
              </div>
              {limitedItems.length ? (
                <p className="text-xs text-white/50 mt-2">{limitedItems.length} limited-time items available.</p>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-black/25 p-3">
                  <p className="text-sm font-bold text-white/90">Coming Soon</p>
                  <p className="text-xs text-white/55 mt-0.5">Unlocks at next Pulse</p>
                </div>
              )}
            </Card>

            {Object.keys(grouped).map((cat) => (
              <Card key={cat} className="bg-white/[0.03]">
                <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2">{categoryIcon(cat)} {categoryLabel(cat)}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {grouped[cat].map((item) => renderCard(item))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CosmeticPreviewSheet
        open={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.name || ''}
        subtitle={previewItem?.description || null}
        status={previewItem ? (
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded border border-white/20 bg-white/5 text-white/80">{previewItem.rarity}</span>
            <span className="px-2 py-0.5 rounded border border-cyan-300/30 bg-cyan-500/10 text-cyan-200 inline-flex items-center gap-1"><SigilIcon className="w-3 h-3" /> {previewItem.price_sigils}</span>
            {previewItem.owned ? <span className="px-2 py-0.5 rounded border border-emerald-300/30 bg-emerald-500/10 text-emerald-200">Owned</span> : null}
            {previewItem.equipped_slot ? <span className="px-2 py-0.5 rounded border border-emerald-300/30 bg-emerald-500/10 text-emerald-200">Equipped</span> : null}
            {!((previewItem.purchasable ?? canPurchaseCosmetic(previewItem))) ? <span className="px-2 py-0.5 rounded border border-amber-300/30 bg-amber-500/10 text-amber-200">Preview coming soon</span> : null}
          </div>
        ) : null}
        actions={previewItem ? (
          <>
            {!previewItem.owned ? (
              <button
                onClick={() => buy(previewItem)}
                disabled={busySlug === previewItem.slug || sigils < previewItem.price_sigils || !(previewItem.purchasable ?? canPurchaseCosmetic(previewItem))}
                className="h-10 rounded-xl bg-yellow-400 text-black text-sm font-bold disabled:opacity-40"
              >
                {busySlug === previewItem.slug ? '...' : 'Buy'}
              </button>
            ) : (
              <button
                onClick={() => equip(previewItem)}
                disabled={busySlug === previewItem.slug || !!previewItem.equipped_slot}
                className="h-10 rounded-xl bg-white/10 border border-white/15 text-sm font-bold disabled:opacity-40"
              >
                {previewItem.equipped_slot ? 'Equipped' : (busySlug === previewItem.slug ? '...' : 'Equip')}
              </button>
            )}
            <button onClick={() => setPreviewItem(null)} className="h-10 rounded-xl bg-white/10 border border-white/15 text-sm font-bold">Close</button>
          </>
        ) : null}
      >
        {previewItem ? (
          <CosmeticPreview
            cosmetic={previewItem}
            onInteracted={() => telemetry('shop_item_preview_interacted', { slug: previewItem.slug, category: previewItem.category, source: 'sheet' })}
          />
        ) : null}
      </CosmeticPreviewSheet>
    </div>
  );
}
