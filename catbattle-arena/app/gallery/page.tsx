'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Filter, Loader2, Search, ShieldCheck, Sparkles, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { showGlobalToast } from '../lib/global-toast';

type GalleryCat = {
  id: string;
  name: string;
  thumb_url: string;
  rarity: string;
  owner_username: string | null;
  created_at: string;
};

type CatDetail = {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  ability: string;
  power: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  battles_fought: number;
  owner_username: string | null;
  created_at: string;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
};

type MyCatSummary = {
  id: string;
  name: string;
  rarity: string;
  cat_level: number;
};

const PAGE_SIZE = 12;
const RARITIES = ['All', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'God-Tier'] as const;

function getRarityColor(rarity: string) {
  const c: Record<string, string> = {
    Common: 'border-gray-500/50 text-gray-300',
    Rare: 'border-blue-500/50 text-blue-300',
    Epic: 'border-purple-500/50 text-purple-300',
    Legendary: 'border-yellow-500/50 text-yellow-300',
    Mythic: 'border-red-500/50 text-red-300',
    'God-Tier': 'border-pink-500/50 text-pink-300',
  };
  return c[rarity] || c.Common;
}

function getRarityFrameClass(rarity: string) {
  const c: Record<string, string> = {
    Common: 'border-zinc-400/35 shadow-[0_0_0_1px_rgba(161,161,170,0.18)]',
    Rare: 'border-sky-400/45 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_0_22px_rgba(56,189,248,0.14)]',
    Epic: 'border-violet-400/45 shadow-[0_0_0_1px_rgba(167,139,250,0.22),0_0_24px_rgba(139,92,246,0.16)]',
    Legendary: 'border-amber-300/50 shadow-[0_0_0_1px_rgba(251,191,36,0.24),0_0_28px_rgba(251,191,36,0.2)]',
    Mythic: 'border-rose-400/50 shadow-[0_0_0_1px_rgba(244,63,94,0.24),0_0_30px_rgba(244,63,94,0.2)]',
    'God-Tier': 'border-cyan-300/55 shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_34px_rgba(34,211,238,0.24)]',
  };
  return c[rarity] || c.Common;
}

function relativeDate(iso: string): string {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return '';
  const delta = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function CatDetailModal({
  catId,
  open,
  onClose,
}: {
  catId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState<CatDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !catId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCat(null);

    fetch(`/api/cats/${encodeURIComponent(catId)}`, { cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok || !data?.cat) {
          setError(String(data?.error || 'Failed to load cat details'));
          return;
        }
        setCat(data.cat as CatDetail);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load cat details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, catId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-[3px] p-3 sm:p-4 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-[linear-gradient(170deg,#07162d_0%,#061022_45%,#040913_100%)] max-h-[90vh] overflow-y-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)] sm:pb-3 shadow-[0_20px_60px_rgba(2,8,24,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#081022] z-10">
          <h3 className="text-sm font-semibold text-white">Cat Detail</h3>
          <button onClick={onClose} className="h-8 px-3 rounded-lg bg-white/10 text-white/80 text-xs">Close</button>
        </div>

        {loading && (
          <div className="p-6 text-center text-white/70 text-sm inline-flex w-full justify-center gap-2 items-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading
          </div>
        )}

        {!loading && error && <div className="p-6 text-sm text-red-200">{error}</div>}

        {!loading && cat && (
          <div className="p-3 space-y-3">
            <img
              src={cat.image_url || '/cat-placeholder.svg'}
              alt={cat.name}
              className="w-full h-64 sm:h-72 object-cover rounded-xl"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
              }}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xl font-bold text-white">{cat.name}</h4>
                <p className="text-xs text-white/65">{cat.owner_username ? `@${cat.owner_username}` : 'Unknown owner'} · {cat.rarity}</p>
              </div>
              <Link href={`/cat/${cat.id}`} className="h-8 px-3 rounded-lg bg-cyan-400/20 border border-cyan-300/30 text-cyan-100 text-xs inline-flex items-center">
                Open Profile
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-white/80">LVL {cat.level}</div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-white/80">W {cat.wins} / L {cat.losses}</div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-white/80">{cat.battles_fought} battles</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 inline-flex items-center gap-2 text-white/70">
                <Zap className="w-3.5 h-3.5 text-yellow-300/80" />
                <span className="truncate">{cat.ability || cat.power || 'No ability set'}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 inline-flex items-center gap-2 text-white/70">
                <CalendarClock className="w-3.5 h-3.5 text-cyan-300/80" />
                <span>{relativeDate(cat.created_at)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5">
              <p className="text-[11px] text-white/55">Core Stats</p>
              {[
                ['ATK', cat.stats.attack, 'bg-red-400'],
                ['DEF', cat.stats.defense, 'bg-blue-400'],
                ['SPD', cat.stats.speed, 'bg-emerald-400'],
                ['CHA', cat.stats.charisma, 'bg-pink-400'],
                ['CHS', cat.stats.chaos, 'bg-orange-400'],
              ].map(([label, value, cls]) => (
                <div key={String(label)} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/60 w-7">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
                  </div>
                  <span className="text-[10px] text-white/60 w-7 text-right">{Number(value || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryCard({
  cat,
  canDelete,
  deleting,
  onDelete,
  onOpen,
}: {
  cat: GalleryCat;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (catId: string) => void;
  onOpen: (catId: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${cat.name}`}
      onClick={() => onOpen(cat.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(cat.id);
        }
      }}
      className={`group card-lift relative w-full text-left rounded-2xl overflow-hidden border bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] hover:border-cyan-300/40 ${getRarityFrameClass(cat.rarity)}`}
    >
      <div className="relative h-44 bg-white/5">
        <img
          src={cat.thumb_url || '/cat-placeholder.svg'}
          alt={cat.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] border ${getRarityColor(cat.rarity)} bg-black/50`}>
          {cat.rarity}
        </span>

        {canDelete && (
          <button
            type="button"
            aria-label={`Delete ${cat.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(cat.id);
            }}
            disabled={deleting}
            className="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/75 hover:bg-red-500 text-white disabled:opacity-60"
            title="Delete my cat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <h3 className="text-sm font-semibold text-white truncate">{cat.name}</h3>
          <p className="text-[11px] text-white/70 truncate">{cat.owner_username ? `@${cat.owner_username}` : 'Unknown owner'} · {relativeDate(cat.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const router = useRouter();
  const [cats, setCats] = useState<GalleryCat[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myCats, setMyCats] = useState<MyCatSummary[]>([]);
  const [selectedCatForXp, setSelectedCatForXp] = useState('');
  const [xpAmount, setXpAmount] = useState(0);
  const [catXpPool, setCatXpPool] = useState(0);
  const [allocatingXp, setAllocatingXp] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [rarityFilter, setRarityFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'rarity'>('newest');

  useEffect(() => {
    void loadCats({ reset: true });
    void loadMyCats();
  }, []);

  async function loadCats({ reset }: { reset: boolean }) {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const nextOffset = reset ? 0 : cats.length;
      const res = await fetch(`/api/cats/approved?limit=${PAGE_SIZE}&offset=${nextOffset}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(String(data?.error || 'Failed to load cats'));
        return;
      }

      const incoming = (Array.isArray(data.cats) ? data.cats : []) as GalleryCat[];
      setCats((prev) => {
        if (reset) return incoming;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
      });
      setHasMore(Boolean(data.hasMore) && incoming.length >= PAGE_SIZE);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function loadMyCats() {
    try {
      const [mineRes, meRes] = await Promise.all([
        fetch('/api/cats/mine', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
        fetch('/api/me', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
      ]);
      const list = Array.isArray(mineRes?.cats) ? mineRes.cats : [];
      const owned = list.map((c: Record<string, unknown>) => ({
        id: String(c.id || ''),
        name: String(c.name || 'Cat'),
        rarity: String(c.rarity || 'Common'),
        cat_level: Math.max(1, Number(c.cat_level || 1)),
      }));
      setMyCats(owned);
      const pool = Math.max(0, Number(meRes?.data?.cat_xp_pool || 0));
      setCatXpPool(pool);
      setXpAmount((prev) => (prev > 0 ? Math.min(prev, pool) : pool));
      if (owned.length > 0 && !owned.some((c: MyCatSummary) => c.id === selectedCatForXp)) {
        setSelectedCatForXp(owned[0].id);
      }
    } catch {
      // no-op
    }
  }

  async function allocateCatXp() {
    const amountToApply = Math.max(0, Math.floor(Number(xpAmount || 0)));
    if (!selectedCatForXp || allocatingXp || catXpPool <= 0 || amountToApply <= 0) return;
    setAllocatingXp(true);
    try {
      const res = await fetch('/api/cats/xp-allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: selectedCatForXp, amount: amountToApply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showGlobalToast(data?.error || 'Failed to apply XP');
      } else {
        const nextPool = Math.max(0, Number(data?.remaining_pool || 0));
        setCatXpPool(nextPool);
        setXpAmount(Math.min(nextPool, amountToApply));
        const target = myCats.find((c) => c.id === selectedCatForXp);
        showGlobalToast(`${target?.name || 'Cat'} gained +${Number(data?.applied_xp || 0)} XP`);
        await loadMyCats();
      }
    } catch {
      showGlobalToast('Failed to apply XP');
    } finally {
      setAllocatingXp(false);
    }
  }

  async function deleteMyCat(catId: string) {
    if (deletingCatId) return;
    const target = cats.find((c) => c.id === catId);
    const ok = window.confirm(`Delete ${target?.name || 'this cat'}? This cannot be undone.`);
    if (!ok) return;

    setDeletingCatId(catId);
    try {
      const res = await fetch(`/api/cats/${encodeURIComponent(catId)}/delete`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showGlobalToast(data?.error || 'Delete failed');
      } else {
        showGlobalToast('Cat deleted');
        setCats((prev) => prev.filter((c) => c.id !== catId));
        setMyCats((prev) => prev.filter((c) => c.id !== catId));
        if (selectedCatForXp === catId) setSelectedCatForXp('');
      }
    } catch {
      showGlobalToast('Delete failed');
    } finally {
      setDeletingCatId(null);
    }
  }

  const filtered = useMemo(() => {
    let result = cats;
    const myIds = new Set(myCats.map((c) => c.id));

    if (viewMode === 'mine') {
      result = result.filter((c) => myIds.has(c.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || String(c.owner_username || '').toLowerCase().includes(q));
    }

    if (rarityFilter !== 'All') {
      result = result.filter((c) => c.rarity === rarityFilter);
    }

    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'rarity') {
      result = [...result].sort((a, b) => a.rarity.localeCompare(b.rarity));
    }

    return result;
  }, [cats, myCats, viewMode, search, rarityFilter, sortBy]);

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { All: cats.length };
    cats.forEach((c) => {
      counts[c.rarity] = (counts[c.rarity] || 0) + 1;
    });
    return counts;
  }, [cats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(34,211,238,0.12),rgba(2,8,24,0.75)_55%,rgba(0,0,0,0.9)_100%)] p-4">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="text-white/45 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Cat Gallery</h1>
              <p className="text-sm text-white/55">Thumb-first cards, full detail only on open.</p>
            </div>
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100/90">
            <ShieldCheck className="w-3.5 h-3.5" />
            Lower egress mode active
          </div>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>}

        <div id="my-cats" className="mb-6 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(170deg,rgba(8,72,88,0.28),rgba(2,18,28,0.72))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-cyan-100">My Cats</h2>
              <p className="text-xs text-cyan-100/75">Apply your Cat XP bank to a specific cat.</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-cyan-300/20 border border-cyan-200/30 text-cyan-100">
              <Sparkles className="w-3 h-3" /> XP Bank: {catXpPool}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <select
              value={selectedCatForXp}
              onChange={(e) => setSelectedCatForXp(e.target.value)}
              className="h-10 rounded-xl bg-black/30 border border-white/15 px-3 text-sm"
            >
              {myCats.length === 0 && <option value="">No cats yet</option>}
              {myCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.rarity} · Lv {c.cat_level}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[120px_auto]">
              <input
                type="number"
                min={0}
                max={catXpPool}
                value={xpAmount}
                onChange={(e) => setXpAmount(Math.min(Math.max(0, Math.floor(Number(e.target.value || 0))), catXpPool))}
                className="h-10 rounded-xl bg-black/30 border border-white/15 px-3 text-sm"
                placeholder="XP"
              />
              <button
                onClick={allocateCatXp}
                disabled={allocatingXp || !selectedCatForXp || catXpPool <= 0 || xpAmount <= 0}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 text-black text-sm font-bold disabled:opacity-50"
              >
                {allocatingXp ? 'Applying...' : `Apply ${Math.max(0, Math.floor(Number(xpAmount || 0)))} XP`}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('all')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold ${viewMode === 'all' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              All Cats ({cats.length})
            </button>
            <button
              onClick={() => setViewMode('mine')}
              className={`h-9 px-3 rounded-lg text-xs font-semibold ${viewMode === 'mine' ? 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/30' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              My Cats ({myCats.length})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cats..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-white/20 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {RARITIES.map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  rarityFilter === r ? 'bg-white/15 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {r} {rarityCounts[r] ? `(${rarityCounts[r]})` : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-white/20" />
            <div className="flex gap-1">
              {(['newest', 'name', 'rarity'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-colors ${sortBy === s ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            {cats.length === 0 ? (
              <>
                <p className="text-white/50 mb-4">No approved cats yet.</p>
                <Link href="/submit" className="inline-block px-6 py-3 bg-white text-black rounded-xl font-bold">Submit a cat</Link>
              </>
            ) : (
              <p className="text-white/50">No cats match your filters</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((cat) => (
                <GalleryCard
                  key={cat.id}
                  cat={cat}
                  canDelete={myCats.some((m) => m.id === cat.id)}
                  deleting={deletingCatId === cat.id}
                  onDelete={deleteMyCat}
                  onOpen={(catId) => router.push(`/cat/${encodeURIComponent(catId)}?from=gallery`)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadCats({ reset: false })}
                  disabled={loadingMore}
                  className="h-10 px-5 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />} Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
