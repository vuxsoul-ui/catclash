'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Loader2, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingState } from '../components/LoadingState';
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
  status: string;
  image_url: string | null;
  owner_username: string | null;
};

type DisplayCat = GalleryCat & {
  status?: string;
  pending?: boolean;
};

const PAGE_SIZE = 12;
const RARITIES = ['All', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'God-Tier'] as const;

function getRarityColor(rarity: string) {
  const c: Record<string, string> = {
    Common: 'text-zinc-200',
    Rare: 'text-sky-200',
    Epic: 'text-violet-200',
    Legendary: 'text-amber-100',
    Mythic: 'text-rose-100',
    'God-Tier': 'text-fuchsia-100',
  };
  return c[rarity] || c.Common;
}

function getRarityBadgeTone(rarity: string) {
  const c: Record<string, string> = {
    Common: 'bg-white/10 text-white/70 border-white/20',
    Rare: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/25 ring-1 ring-cyan-400/25',
    Epic: 'bg-purple-500/15 text-purple-200 border-purple-400/25 ring-1 ring-purple-400/25',
    Legendary: 'bg-amber-400/15 text-amber-200 border-amber-300/30 ring-1 ring-amber-300/30 shadow-[0_0_12px_rgba(251,191,36,0.25)]',
    Mythic: 'bg-pink-500/15 text-pink-200 border-pink-400/30 ring-1 ring-pink-400/30',
    'God-Tier': 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-300/40 ring-1 ring-fuchsia-300/40 shadow-[0_0_16px_rgba(217,70,239,0.35)]',
  };
  return c[rarity] || c.Common;
}

function getRarityCardAccent(rarity: string) {
  const c: Record<string, string> = {
    Legendary: 'shadow-[inset_0_1px_0_rgba(253,230,138,0.1),0_18px_38px_rgba(120,53,15,0.28)]',
    Mythic: 'shadow-[inset_0_1px_0_rgba(254,205,211,0.1),0_18px_38px_rgba(127,29,29,0.28)]',
    'God-Tier': 'shadow-[inset_0_1px_0_rgba(250,232,255,0.12),0_18px_40px_rgba(112,26,117,0.3)]',
  };
  return c[rarity] || 'shadow-[0_16px_34px_rgba(0,0,0,0.34)]';
}

function getRarityCardRing(rarity: string) {
  const c: Record<string, string> = {
    Legendary: 'ring-1 ring-inset ring-amber-200/10',
    Mythic: 'ring-1 ring-inset ring-rose-200/10',
    'God-Tier': 'ring-1 ring-inset ring-fuchsia-200/12',
  };
  return c[rarity] || '';
}

function getRarityFilterActiveClass(rarity: string) {
  const c: Record<string, string> = {
    All: 'text-white',
    Common: 'text-gray-200',
    Rare: 'text-blue-200',
    Epic: 'text-purple-200',
    Legendary: 'text-amber-200',
    Mythic: 'text-rose-200',
    'God-Tier': 'text-fuchsia-200',
  };
  return c[rarity] || c.All;
}

function getRarityStatFillClass(rarity: string) {
  const c: Record<string, string> = {
    Common: 'bg-gray-400',
    Rare: 'bg-blue-400',
    Epic: 'bg-purple-400',
    Legendary: 'bg-yellow-400',
    Mythic: 'bg-red-400',
    'God-Tier': 'bg-pink-400',
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
    <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-xl p-3 sm:p-4 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[1.75rem] border border-white/16 bg-[linear-gradient(180deg,rgba(18,24,38,0.98),rgba(8,10,18,0.99))] max-h-[90vh] overflow-y-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)] sm:pb-3 shadow-[0_32px_80px_rgba(2,8,24,0.82)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[rgba(9,13,24,0.92)] backdrop-blur-xl z-10">
          <h3 className="text-sm font-semibold text-white">Cat Detail</h3>
          <button onClick={onClose} className="h-8 px-3 rounded-lg text-white/50 hover:text-white text-xs">Close</button>
        </div>

        {loading && (
          <LoadingState
            compact
            icon="✨"
            message="Polishing portraits..."
            className="m-3 border-white/10 bg-white/[0.03] px-4 py-8 shadow-none"
          />
        )}

        {!loading && error && <div className="p-6 text-sm text-red-200">{error}</div>}

        {!loading && cat && (
          <div className="p-4 space-y-4">
            <div className={`relative overflow-hidden rounded-[1.4rem] border border-white/12 ${getRarityCardRing(cat.rarity)}`}>
              <img
                src={cat.image_url || '/cat-placeholder.svg'}
                alt={cat.name}
                className="w-full h-72 sm:h-80 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
                }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <h4 className="text-[1.5rem] sm:text-[1.7rem] font-black tracking-tight text-white leading-none">{cat.name}</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getRarityColor(cat.rarity)} ${getRarityBadgeTone(cat.rarity)}`}>
                    {cat.rarity}
                  </span>
                  <p className="text-xs text-white/50">{cat.owner_username ? `@${cat.owner_username}` : 'Unknown owner'} · {relativeDate(cat.created_at)}</p>
                </div>
              </div>
              <Link href={`/cat/${cat.id}`} className="h-9 px-3.5 rounded-xl bg-cyan-500/20 border border-cyan-300/30 text-cyan-100 text-xs font-semibold inline-flex items-center hover:bg-cyan-500/25 transition-all">
                Profile
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-white/80">LVL {cat.level}</div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-white/80">W {cat.wins} / L {cat.losses}</div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-white/80">{cat.battles_fought} battles</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 inline-flex items-center gap-2 text-white/60">
                <Zap className="w-3.5 h-3.5 text-yellow-300/80" />
                <span className="truncate">{cat.ability || cat.power || 'No ability set'}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 inline-flex items-center gap-2 text-white/60">
                <CalendarClock className="w-3.5 h-3.5 text-cyan-300/80" />
                <span>{relativeDate(cat.created_at)}</span>
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3.5 space-y-3.5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Core Stats</p>
              {[
                ['ATK', cat.stats.attack],
                ['DEF', cat.stats.defense],
                ['SPD', cat.stats.speed],
                ['CHA', cat.stats.charisma],
                ['CHS', cat.stats.chaos],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-7">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full ${getRarityStatFillClass(cat.rarity)}`} style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
                  </div>
                  <span className="text-[10px] text-white/50 w-7 text-right">{Number(value || 0)}</span>
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
  cat: DisplayCat;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (catId: string) => void;
  onOpen: (catId: string) => void;
}) {
  const isPending = cat.pending || String(cat.status || '').toLowerCase() === 'pending';
  const subtitle = isPending
    ? `${cat.owner_username ? `@${cat.owner_username}` : 'Your cat'} · Pending approval`
    : `${cat.owner_username ? `@${cat.owner_username}` : 'Unknown owner'}${relativeDate(cat.created_at) ? ` · ${relativeDate(cat.created_at)}` : ''}`;

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
      className={`focus-ring group relative w-full text-left rounded-2xl overflow-hidden bg-white/[0.03] ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all duration-150 active:scale-[0.985] ${isPending ? 'opacity-75' : ''}`}
    >
      <div className="relative h-52 sm:h-56">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <span className={`absolute left-2.5 top-2.5 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getRarityColor(cat.rarity)} ${getRarityBadgeTone(cat.rarity)} backdrop-blur-md`}>
          {cat.rarity}
        </span>

        {isPending ? (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-100 backdrop-blur-md">
            <span aria-hidden="true">⏳</span> Pending
          </span>
        ) : canDelete ? (
          <button
            type="button"
            aria-label={`Delete ${cat.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(cat.id);
            }}
            disabled={deleting}
            className="absolute top-2.5 right-2.5 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-white/10 bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-md disabled:opacity-60 transition-colors"
            title="Delete my cat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="space-y-0.5">
            <h3 className="block min-w-0 truncate text-[14px] font-semibold text-white leading-tight line-clamp-2 drop-shadow-md">{cat.name}</h3>
            <p className="block min-w-0 truncate text-[11px] text-white/60">{subtitle}</p>
          </div>
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('view') === 'mine') {
      setViewMode('mine');
    }
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
      const ownerUsername = String(meRes?.data?.profile?.username || '').trim() || null;
      const owned = list.map((c: Record<string, unknown>) => ({
        id: String(c.id || ''),
        name: String(c.name || 'Cat'),
        rarity: String(c.rarity || 'Common'),
        cat_level: Math.max(1, Number(c.cat_level || 1)),
        status: String(c.status || 'approved'),
        image_url: typeof c.image_url === 'string' ? c.image_url : null,
        owner_username: ownerUsername,
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

  const displayCats = useMemo<DisplayCat[]>(() => {
    if (viewMode !== 'mine') return cats;
    const approvedById = new Map(cats.map((c) => [c.id, { ...c, status: 'approved', pending: false } satisfies DisplayCat]));
    const pendingMine = myCats
      .filter((cat) => !approvedById.has(cat.id))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        thumb_url: cat.image_url || '/cat-placeholder.svg',
        rarity: cat.rarity,
        owner_username: cat.owner_username,
        created_at: '',
        status: cat.status,
        pending: String(cat.status || '').toLowerCase() !== 'approved',
      }));
    return [...pendingMine, ...cats];
  }, [cats, myCats, viewMode]);

  const filtered = useMemo(() => {
    let result = displayCats;

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
  }, [displayCats, search, rarityFilter, sortBy]);

  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { All: displayCats.length };
    displayCats.forEach((c) => {
      counts[c.rarity] = (counts[c.rarity] || 0) + 1;
    });
    return counts;
  }, [displayCats]);

  const pendingCats = useMemo(
    () => myCats.filter((cat) => String(cat.status || '').toLowerCase() !== 'approved'),
    [myCats]
  );

  if (loading) {
    return <LoadingState fullPage icon="📜" message="Unfurling the scroll..." />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="group inline-flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <div>
              <h1 className="text-[1.75rem] sm:text-[2rem] font-bold tracking-tight text-white">Cat Gallery</h1>
              <p className="text-xs sm:text-sm text-white/40">Browse every cat in the arena.</p>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>}

        <div id="my-cats" className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-white/10 sm:mb-8 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">My Cats</h2>
              <p className="text-xs sm:text-sm text-white/45">Apply XP from your bank to level up.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-500/12 px-2.5 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_8px_20px_rgba(120,53,15,0.15)]">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              {catXpPool} XP
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <select
              value={selectedCatForXp}
              onChange={(e) => setSelectedCatForXp(e.target.value)}
              className="input-focus h-10 rounded-xl bg-black/50 border border-white/10 px-3 text-sm text-white focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
            >
              {myCats.length === 0 && <option value="">No cats yet</option>}
              {myCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.rarity} · Lv {c.cat_level}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[100px_auto]">
              <input
                type="number"
                min={0}
                max={catXpPool}
                value={xpAmount}
                onChange={(e) => setXpAmount(Math.min(Math.max(0, Math.floor(Number(e.target.value || 0))), catXpPool))}
                className="input-focus h-10 rounded-xl bg-black/50 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
                placeholder="XP"
              />
              <button
                onClick={allocateCatXp}
                disabled={allocatingXp || !selectedCatForXp || catXpPool <= 0 || xpAmount <= 0}
                className="h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-black text-sm font-bold px-4 shadow-[0_12px_24px_rgba(34,211,238,0.2)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {allocatingXp ? 'Applying...' : `+${Math.max(0, Math.floor(Number(xpAmount || 0)))}`}
              </button>
            </div>
          </div>

          {viewMode === 'mine' && pendingCats.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-500/8 px-2.5 py-2 text-xs leading-relaxed text-amber-100/90">
              Pending cats will appear once approved. You can still equip skills and earn XP.
            </div>
          )}
        </div>

        <div className="mb-6 space-y-2.5 sm:mb-8 sm:space-y-3">
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1">
            <button
              onClick={() => setViewMode('all')}
              className={`flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${viewMode === 'all' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white/80'}`}
            >
              All <span className="hidden sm:inline">Cats</span> ({viewMode === 'all' ? displayCats.length : cats.length})
            </button>
            <button
              onClick={() => setViewMode('mine')}
              className={`flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${viewMode === 'mine' ? 'bg-cyan-400 text-black shadow' : 'text-white/50 hover:text-white/80'}`}
            >
              My Cats ({myCats.length})
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or owner..."
              className="input-focus w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 px-3.5 text-sm text-white placeholder:text-white/40 ring-1 ring-white/10 focus:border-white/20 focus:ring-white/20"
            />
          </div>

          <div className="flex max-w-full flex-wrap gap-1.5 overflow-x-auto pb-0.5">
            {RARITIES.map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`flex-shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                  rarityFilter === r
                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                    : 'bg-white/[0.03] text-white/60 hover:text-white/80 hover:bg-white/[0.05]'
                }`}
              >
                {r} <span className="text-white/70">({rarityCounts[r] || 0})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/35">Sort</span>
            <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
              {(['newest', 'name', 'rarity'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-all ${sortBy === s ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/65'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-white/5 bg-white/[0.02]">
            {displayCats.length === 0 ? (
              <>
                <p className="mb-5 text-sm text-white/50">No approved cats yet.</p>
                <Link href="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-cyan-400 to-cyan-500 text-black text-sm font-bold rounded-xl shadow-[0_12px_24px_rgba(34,211,238,0.2)] hover:brightness-110 transition-all">
                  Submit a cat
                </Link>
              </>
            ) : (
              <p className="text-sm text-white/50">No cats match your filters.</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 pb-32 sm:grid-cols-3 lg:grid-cols-4">
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
                  className="h-10 px-5 rounded-xl border border-white/15 bg-white/[0.06] text-white text-sm font-semibold hover:border-white/25 hover:bg-white/[0.1] disabled:opacity-50 inline-flex items-center gap-2 transition-all"
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
