'use client';

import type { PublicDuel } from '../d/_lib/duels';

function fmtRecord(wins: number, losses: number): string {
  return `${Math.max(0, Number(wins || 0))}-${Math.max(0, Number(losses || 0))}`;
}

function guildGlow(guild: string | null | undefined): string {
  if (guild === 'sun') return 'shadow-[0_0_30px_rgba(255,140,0,0.35)] border-orange-300/35';
  if (guild === 'moon') return 'shadow-[0_0_30px_rgba(0,191,255,0.35)] border-sky-300/35';
  return 'shadow-[0_0_18px_rgba(255,255,255,0.12)] border-white/20';
}

function rarityChip(rarity?: string | null): string {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary') return 'bg-amber-400/20 text-amber-100 border-amber-300/35';
  if (r === 'epic') return 'bg-violet-400/20 text-violet-100 border-violet-300/35';
  if (r === 'rare') return 'bg-sky-400/20 text-sky-100 border-sky-300/35';
  if (r === 'mythic' || r === 'god-tier') return 'bg-rose-400/20 text-rose-100 border-rose-300/35';
  return 'bg-zinc-400/20 text-zinc-100 border-zinc-300/35';
}

function countdownLabel(duel: PublicDuel): string | null {
  if (duel.status !== 'pending') return null;
  const ms = Math.max(0, new Date(duel.created_at).getTime() + 2 * 60_000 - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DuelShareCard({
  duel,
  predictedCatName,
  predictedResolved,
  className = '',
}: {
  duel: PublicDuel;
  predictedCatName?: string | null;
  predictedResolved?: 'won' | 'lost' | null;
  className?: string;
}) {
  const countdown = countdownLabel(duel);
  const catA = duel.challenger_cat;
  const catB = duel.challenged_cat;

  return (
    <div id="duel-share-card" className={`w-full max-w-[420px] aspect-[9/16] rounded-3xl border border-white/20 bg-[#07090f] overflow-hidden shadow-[0_22px_80px_rgba(0,0,0,0.6)] ${className}`}>
      <div className="h-full w-full bg-[radial-gradient(circle_at_20%_10%,rgba(255,140,0,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(30,144,255,0.18),transparent_42%)] p-4 flex flex-col">
        <div className="text-center">
          <p className="text-[10px] tracking-[0.2em] text-white/70 font-bold">CATCLASH ARENA</p>
          <p className="text-xs text-white/55 mt-0.5">Arena Pulse #{duel.pulse_number}</p>
          {countdown && <p className="text-[11px] mt-1 text-cyan-200/85">Next Pulse in {countdown}</p>}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="text-center">
            <div className={`rounded-2xl border p-1 ${guildGlow(duel.challenger_guild)}`}>
              <img src={catA?.image_url || '/cat-placeholder.svg'} alt={catA?.name || 'Cat A'} className="w-full h-44 rounded-xl object-cover" />
            </div>
            <p className="mt-1 text-sm font-extrabold text-white truncate">{catA?.name || 'Cat A'}</p>
            <p className="text-[10px] text-white/65">{duel.challenger_username}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className={`text-[10px] border rounded px-1.5 py-0.5 ${rarityChip(catA?.rarity)}`}>{String(catA?.rarity || 'Common')}</span>
              <span className="text-[10px] text-white/65">{fmtRecord(Number(catA?.wins || 0), Number(catA?.losses || 0))}</span>
            </div>
            {catA?.special_ability_id && (
              <span className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded border border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100">✨ Ability</span>
            )}
          </div>

          <div className="self-center">
            <div className="text-lg font-black text-white/90 text-center">VS</div>
            <div className="h-14 w-[2px] mx-auto mt-1 bg-gradient-to-b from-transparent via-white/70 to-transparent animate-pulse" />
          </div>

          <div className="text-center">
            <div className={`rounded-2xl border p-1 ${guildGlow(duel.challenged_guild)}`}>
              <img src={catB?.image_url || '/cat-placeholder.svg'} alt={catB?.name || 'Cat B'} className="w-full h-44 rounded-xl object-cover" />
            </div>
            <p className="mt-1 text-sm font-extrabold text-white truncate">{catB?.name || 'Cat B'}</p>
            <p className="text-[10px] text-white/65">{duel.challenged_username}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className={`text-[10px] border rounded px-1.5 py-0.5 ${rarityChip(catB?.rarity)}`}>{String(catB?.rarity || 'Common')}</span>
              <span className="text-[10px] text-white/65">{fmtRecord(Number(catB?.wins || 0), Number(catB?.losses || 0))}</span>
            </div>
            {catB?.special_ability_id && (
              <span className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded border border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100">✨ Ability</span>
            )}
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden flex">
          <div className="bg-gradient-to-r from-[#FF8C00] to-[#FF4500]" style={{ width: `${duel.votes.pct_a}%` }} />
          <div className="bg-gradient-to-r from-[#00BFFF] to-[#1E90FF]" style={{ width: `${duel.votes.pct_b}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-white/70 text-center">{duel.votes.cat_a} vs {duel.votes.cat_b}</p>

        {(predictedCatName || predictedResolved) && (
          <div className="mt-2 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 py-1.5 text-center">
            {predictedCatName && <p className="text-xs font-bold text-emerald-100">🎯 I Picked: {predictedCatName}</p>}
            {predictedResolved === 'won' && <p className="text-sm font-black text-emerald-200">🏆 WON</p>}
            {predictedResolved === 'lost' && <p className="text-sm font-black text-rose-200">💀 LOST</p>}
          </div>
        )}

        <div className="mt-auto space-y-1">
          <p className="text-[11px] text-white/75 text-center">{duel.social_proof_text}</p>
          <p className="text-center text-sm font-extrabold text-white">catclash.org</p>
          <p className="text-center text-[10px] text-white/40 tracking-[0.12em]">VUXSOLIA ERA</p>
        </div>
      </div>
    </div>
  );
}

