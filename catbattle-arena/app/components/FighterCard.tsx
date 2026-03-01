import React from 'react';

export type FighterCardView = {
  slug: string;
  catId?: string | null;
  ownerUserId?: string | null;
  name: string;
  rarity: string;
  level: number;
  powerRating: number;
  stats: { atk: number; def: number; spd: number; cha: number; chs: number };
  ownerName: string;
  imageUrl: string;
  fallbackImageUrl?: string | null;
  description?: string | null;
};

function rarityClasses(rarity: string): { badge: string; border: string; bg: string } {
  if (rarity === 'Rare') return { badge: 'text-blue-200 bg-blue-500/20 border-blue-300/35', border: 'border-blue-400/45', bg: 'from-blue-950/45 to-cyan-900/35' };
  if (rarity === 'Epic') return { badge: 'text-purple-200 bg-purple-500/20 border-purple-300/35', border: 'border-purple-400/45', bg: 'from-purple-950/45 to-fuchsia-900/35' };
  if (rarity === 'Legendary') return { badge: 'text-yellow-100 bg-yellow-500/20 border-yellow-300/45', border: 'border-yellow-300/55', bg: 'from-yellow-950/50 to-amber-900/40' };
  if (rarity === 'Mythic') return { badge: 'text-rose-100 bg-rose-500/20 border-rose-300/45', border: 'border-rose-300/55', bg: 'from-rose-950/50 to-fuchsia-900/35' };
  if (rarity === 'God-Tier') return { badge: 'text-cyan-100 bg-cyan-500/20 border-cyan-300/45', border: 'border-cyan-300/60', bg: 'from-indigo-950/60 via-fuchsia-900/35 to-cyan-900/35' };
  return { badge: 'text-zinc-200 bg-zinc-500/20 border-zinc-300/35', border: 'border-zinc-400/40', bg: 'from-zinc-900/50 to-zinc-800/30' };
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-black/35 border border-white/10 px-2 py-1">
      <p className={`text-[10px] font-bold ${tone}`}>{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export default function FighterCard({ card, id = 'fighter-card' }: { card: FighterCardView; id?: string }) {
  const c = rarityClasses(card.rarity);
  const fallbackImageUrl = String(card.fallbackImageUrl || '').trim();
  return (
    <div id={id} className={`rounded-3xl border ${c.border} bg-gradient-to-br ${c.bg} p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]`}>
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/45">
        <div className="relative h-72 sm:h-80">
          <img
            src={card.imageUrl || '/cat-placeholder.svg'}
            alt={card.name}
            className="w-full h-full object-cover"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (fallbackImageUrl && img.dataset.fallbackTried !== '1') {
                img.dataset.fallbackTried = '1';
                img.src = fallbackImageUrl;
                return;
              }
              if (img.dataset.placeholderTried === '1') return;
              img.dataset.placeholderTried = '1';
              img.src = '/cat-placeholder.svg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.badge}`}>{card.rarity.toUpperCase()}</span>
          </div>
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-xs font-bold text-white">LVL {card.level}</div>
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-2xl font-black text-white truncate">{card.name}</p>
            <p className="text-[11px] text-white/70">{card.ownerName}</p>
          </div>
        </div>

        <div className="p-3">
          {!!String(card.description || '').trim() && (
            <p className="mb-3 text-[11px] text-white/75 italic line-clamp-2">&ldquo;{String(card.description || '').trim()}&rdquo;</p>
          )}
          <div className="rounded-xl border border-white/15 bg-cyan-950/45 px-3 py-2 mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-white/90">Power Rating</p>
            <p className="text-2xl font-black text-cyan-200">{card.powerRating}</p>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            <StatChip label="ATK" value={card.stats.atk} tone="text-red-300" />
            <StatChip label="DEF" value={card.stats.def} tone="text-blue-300" />
            <StatChip label="SPD" value={card.stats.spd} tone="text-emerald-300" />
            <StatChip label="CHA" value={card.stats.cha} tone="text-pink-300" />
            <StatChip label="CHS" value={card.stats.chs} tone="text-orange-300" />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-white/65">
            <span>catclash.org</span>
            <span>{card.slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
