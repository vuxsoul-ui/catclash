'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Hammer, TriangleAlert } from 'lucide-react';
import { showGlobalToast } from '../lib/global-toast';

type CatRow = {
  id: string;
  name: string;
  rarity: string;
  cat_level: number;
  image_url: string | null;
  status?: string | null;
};

const COSTS: Record<string, number> = {
  Common: 120,
  Rare: 240,
  Epic: 450,
  Legendary: 800,
  Mythic: 1400,
};

const NEXT_RARITY: Record<string, string> = {
  Common: 'Rare',
  Rare: 'Epic',
  Epic: 'Legendary',
  Legendary: 'Mythic',
};

function rarityClass(rarity: string): string {
  if (rarity === 'Mythic') return 'text-rose-300';
  if (rarity === 'Legendary') return 'text-amber-300';
  if (rarity === 'Epic') return 'text-fuchsia-300';
  if (rarity === 'Rare') return 'text-sky-300';
  return 'text-zinc-300';
}

export default function ForgePage() {
  const [cats, setCats] = useState<CatRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sigils, setSigils] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [mineRes, meRes] = await Promise.all([
      fetch('/api/cats/mine', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/me', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
    ]);
    const list = Array.isArray(mineRes?.cats) ? mineRes.cats : [];
    setCats(list.map((c: CatRow) => ({
      id: String(c.id || ''),
      name: String(c.name || 'Cat'),
      rarity: String(c.rarity || 'Common'),
      cat_level: Math.max(1, Number(c.cat_level || 1)),
      image_url: c.image_url || '/cat-placeholder.svg',
      status: c.status || null,
    })));
    setSigils(Math.max(0, Number(meRes?.data?.progress?.sigils || 0)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const selectedCats = useMemo(
    () => selected.map((id) => cats.find((c) => c.id === id)).filter(Boolean) as CatRow[],
    [selected, cats]
  );
  const baseRarity = selectedCats[0]?.rarity || null;
  const allSameRarity = selectedCats.length > 0 && selectedCats.every((c) => c.rarity === baseRarity);
  const allLevelReady = selectedCats.length > 0 && selectedCats.every((c) => Number(c.cat_level || 1) >= 5);
  const cost = baseRarity ? (COSTS[baseRarity] || 0) : 0;
  const outRarity = baseRarity ? (NEXT_RARITY[baseRarity] || null) : null;
  const canForge = selected.length === 3 && allSameRarity && allLevelReady && !!outRarity && sigils >= cost && !busy;

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  async function forge() {
    if (!canForge) return;
    setBusy(true);
    const res = await fetch('/api/cats/forge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat_ids: selected }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      showGlobalToast(data?.error || 'Forge failed');
      setBusy(false);
      return;
    }
    showGlobalToast(`Forged ${data?.forged_cat?.name || 'new cat'} (${data?.forged_cat?.rarity || ''})`);
    setSelected([]);
    await load();
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 pt-24 pb-10">

      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-300" />
            Cat Forge
          </h1>
          <p className="text-sm text-white/60 mt-1">Select 3 cats of the same rarity (Lv 5+) to forge a stronger one.</p>
          <div className="mt-2 text-xs text-white/70">Sigils: <span className="font-bold text-amber-300">{sigils}</span></div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span>Selected: {selected.length}/3</span>
            <span>Result: {outRarity ? <span className={rarityClass(outRarity)}>{outRarity}</span> : '—'}</span>
          </div>
          <div className="text-xs text-white/65">
            Cost: <span className="font-bold text-amber-300">{cost || 0}</span> sigils
          </div>
          {!allSameRarity && selected.length > 1 && (
            <div className="mt-2 text-xs text-rose-300 flex items-center gap-1">
              <TriangleAlert className="w-3.5 h-3.5" />
              All selected cats must match rarity.
            </div>
          )}
          {!allLevelReady && selected.length > 0 && (
            <div className="mt-1 text-xs text-rose-300 flex items-center gap-1">
              <TriangleAlert className="w-3.5 h-3.5" />
              Each selected cat must be at least level 5.
            </div>
          )}
          <button
            onClick={forge}
            disabled={!canForge}
            className="mt-3 h-10 w-full rounded-xl bg-amber-500/25 border border-amber-300/30 text-amber-100 font-bold disabled:opacity-45"
          >
            {busy ? 'Forging...' : 'Forge Cat'}
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/60"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading cats...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {cats.map((cat) => {
              const active = selected.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggle(cat.id)}
                  className={`text-left rounded-xl border p-2 transition ${active ? 'border-amber-300/50 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]'}`}
                >
                  <img src={cat.image_url || '/cat-placeholder.svg'} alt={cat.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                  <p className="text-sm font-semibold truncate">{cat.name}</p>
                  <p className={`text-xs ${rarityClass(cat.rarity)}`}>{cat.rarity}</p>
                  <p className="text-[11px] text-white/60">Lv {cat.cat_level}</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          <Link href="/" className="text-xs text-white/60 hover:text-white">Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
