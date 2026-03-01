'use client';

import { useState } from 'react';
import { Shield, Swords, Zap, Crown } from 'lucide-react';
import DuelVsLayout from './DuelVsLayout';
import { cosmeticBorderClassFromSlug } from '../_lib/cosmetics/effectsRegistry';
import VoteEffectLayer from './cosmetics/VoteEffectLayer';
import { computePowerRating, getMoveMeaning } from '../_lib/combat';

export type DuelVoteSummary = { cat_a: number; cat_b: number; total: number; user_vote_cat_id: string | null };
export type DuelCatLite = {
  id: string;
  name: string;
  image_url: string | null;
  ability?: string | null;
  special_ability_id?: string | null;
  rarity?: string | null;
  level?: number | null;
  stats?: { atk: number; def: number; spd: number; cha: number; chs: number } | null;
};

export type DuelVSRow = {
  id: string;
  challenger_user_id: string;
  challenged_user_id: string;
  challenger_username: string;
  challenged_username: string;
  challenger_guild?: string | null;
  challenged_guild?: string | null;
  challenger_cat: DuelCatLite | null;
  challenged_cat: DuelCatLite | null;
  challenger_cosmetics?: {
    border_slug: string | null;
    title_slug: string | null;
    title_name: string | null;
    title_rarity: string | null;
    vote_effect_slug: string | null;
    badge_slug: string | null;
    badge_name: string | null;
  } | null;
  challenged_cosmetics?: {
    border_slug: string | null;
    title_slug: string | null;
    title_name: string | null;
    title_rarity: string | null;
    vote_effect_slug: string | null;
    badge_slug: string | null;
    badge_name: string | null;
  } | null;
  winner_cat?: DuelCatLite | null;
  winner_cat_id?: string | null;
  status?: 'pending' | 'voting' | 'declined' | 'completed' | 'canceled' | string;
  votes?: DuelVoteSummary;
};

function votePct(a: number, b: number): [number, number] {
  const total = a + b;
  if (!total) return [50, 50];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

function guildGlyph(guild?: string | null): string {
  if (guild === 'sun') return '☀';
  if (guild === 'moon') return '☾';
  return '◌';
}

function rarityBadgeClass(rarity: string): string {
  if (rarity === 'Rare') return 'text-blue-100 border-blue-300/45 bg-blue-500/20';
  if (rarity === 'Epic') return 'text-purple-100 border-purple-300/45 bg-purple-500/20';
  if (rarity === 'Legendary') return 'text-amber-100 border-amber-300/45 bg-amber-500/20';
  if (rarity === 'Mythic') return 'text-fuchsia-100 border-fuchsia-300/45 bg-fuchsia-500/20';
  if (rarity === 'God-Tier') return 'text-cyan-100 border-cyan-300/45 bg-cyan-500/20';
  return 'text-zinc-100 border-zinc-300/35 bg-zinc-500/20';
}

function rarityBaseBorderClass(rarity: string): string {
  if (rarity === 'Rare') return 'duel-rarity-rare';
  if (rarity === 'Epic') return 'duel-rarity-epic';
  if (rarity === 'Legendary') return 'duel-rarity-legendary';
  if (rarity === 'Mythic' || rarity === 'God-Tier') return 'duel-rarity-mythic';
  return 'duel-rarity-common';
}

function borderSlugFromRarity(rarity: string): string {
  if (rarity === 'Legendary') return 'border-flame';
  if (rarity === 'Mythic' || rarity === 'Epic') return 'border-void-drift';
  if (rarity === 'Rare') return 'border-neon-cyan';
  return 'border-obsidian';
}

function powerFromStats(cat: DuelCatLite | null): number {
  const s = cat?.stats;
  if (!s) return 0;
  return computePowerRating({
    attack: s.atk,
    defense: s.def,
    speed: s.spd,
    charisma: s.cha,
    chaos: s.chs,
    rarity: cat?.rarity || null,
    ability: cat?.ability || null,
    level: Number(cat?.level || 1),
  });
}

function DuelFighterCard({
  side,
  cat,
  owner,
  guild,
  status,
  votes,
  votePctValue,
  isWinner,
  isLoser,
  isActiveAttacker,
  cosmetics,
  isOwnerView,
  voteTriggerKey,
}: {
  side: 'a' | 'b';
  cat: DuelCatLite | null;
  owner: string;
  guild?: string | null;
  status: string;
  votes: DuelVoteSummary;
  votePctValue: number;
  isWinner: boolean;
  isLoser: boolean;
  isActiveAttacker: boolean;
  cosmetics?: {
    border_slug: string | null;
    title_slug: string | null;
    title_name: string | null;
    title_rarity: string | null;
    vote_effect_slug: string | null;
    badge_slug: string | null;
    badge_name: string | null;
  } | null;
  isOwnerView: boolean;
  voteTriggerKey: string;
}) {
  const rarity = String(cat?.rarity || 'Common');
  const level = Number(cat?.level || 1);
  const power = powerFromStats(cat);
  const move = getMoveMeaning(cat?.ability || null);
  const borderClass = cosmeticBorderClassFromSlug(cosmetics?.border_slug || borderSlugFromRarity(rarity));
  const titleName = cosmetics?.title_name || null;
  const badgeName = cosmetics?.badge_name || null;
  const voteEffectSlug = cosmetics?.vote_effect_slug || null;
  const hasCosmetic = !!(cosmetics?.border_slug || cosmetics?.title_slug || cosmetics?.vote_effect_slug || cosmetics?.badge_slug);
  const role = side === 'a' ? 'Arena Challenger' : 'Arena Defender';
  const hp = status === 'voting' ? Math.max(8, votePctValue) : 100;
  const advantage = status === 'voting' ? Math.abs(votes.cat_a - votes.cat_b) : 0;

  return (
    <article className={`duel-fighter ${rarityBaseBorderClass(rarity)} ${borderClass} ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''} ${isActiveAttacker ? 'attacker' : ''}`}>
      <VoteEffectLayer effectSlug={voteEffectSlug} triggerKey={voteTriggerKey} />
      <header className="duel-header-strip">
        <span className={`duel-rarity-badge ${rarityBadgeClass(rarity)}`}>{rarity}</span>
        <div className="duel-header-right">
          <span className="duel-lvl-badge">LVL {level}</span>
          <span className="duel-guild-badge" title={guild || 'neutral'}>{guildGlyph(guild)}</span>
        </div>
      </header>

        <div className="duel-hero">
          <img src={cat?.image_url || '/cat-placeholder.svg'} alt={cat?.name || 'Cat'} className="duel-hero-image" />
          <div className="duel-hero-overlay" />
          {badgeName ? <span className="duel-badge-overlay">{badgeName}</span> : null}
          <div className="duel-hero-text">
            <p className="duel-name">{cat?.name || 'Unknown Cat'}</p>
            <p className="duel-owner">{owner}</p>
            <p className="duel-role">{role}</p>
            {titleName ? <p className={`duel-title ${cosmetics?.title_rarity === 'Legendary' || cosmetics?.title_rarity === 'Mythic' || cosmetics?.title_rarity === 'God-Tier' ? 'legendary' : ''}`}>{titleName}</p> : null}
          </div>
        </div>

      <div className="duel-power-row">
        <div>
          <p className="duel-power-label">Power Rating</p>
          <p className="duel-power-value">{power}</p>
        </div>
        {advantage > 0 ? <span className="duel-adv-chip">Advantage +{Math.min(99, advantage)}%</span> : null}
      </div>
      <div className="duel-power-glow" />

      <div className="duel-move-row">
        <p className="duel-move-label">Move</p>
        <p className="duel-move-name">{move.name}</p>
        <p className="duel-move-effect">{move.effect}</p>
      </div>

      <footer className="duel-footer-strip">
        {status === 'completed' ? (
          <p className={`duel-result ${isWinner ? 'victory' : isLoser ? 'defeat' : ''}`}>
            {isWinner ? <><Crown className="w-3.5 h-3.5" /> Victory</> : isLoser ? 'Defeat' : 'Result Pending'}
          </p>
        ) : status === 'voting' ? (
          <div className="duel-hp-wrap">
            <span className="duel-hp-label"><Shield className="w-3 h-3" /> HP</span>
            <div className="duel-hp-track"><div className="duel-hp-fill" style={{ width: `${hp}%` }} /></div>
          </div>
        ) : (
          <p className="duel-ready"><Swords className="w-3.5 h-3.5" /> Ready to Clash</p>
        )}
        {isOwnerView && hasCosmetic ? <span className="duel-equipped-pill">Equipped</span> : null}
      </footer>
    </article>
  );
}

export default function DuelVSCard({
  duel,
  meId,
  busy,
  onVote,
  compact = true,
  showCopyLink = false,
  onCopyLink,
}: {
  duel: DuelVSRow;
  meId: string;
  busy: boolean;
  onVote?: (duelId: string, catId: string) => void;
  compact?: boolean;
  showCopyLink?: boolean;
  onCopyLink?: (duelId: string) => void;
}) {
  const [leftVoteTriggerKey, setLeftVoteTriggerKey] = useState('');
  const [rightVoteTriggerKey, setRightVoteTriggerKey] = useState('');
  const canVote =
    !!onVote &&
    !!duel.challenger_cat?.id &&
    !!duel.challenged_cat?.id &&
    meId !== duel.challenger_user_id &&
    meId !== duel.challenged_user_id &&
    !duel.votes?.user_vote_cat_id &&
    duel.status !== 'completed';

  const votes = duel.votes || { cat_a: 0, cat_b: 0, total: 0, user_vote_cat_id: null };
  const [leftPct, rightPct] = votePct(Number(votes.cat_a || 0), Number(votes.cat_b || 0));
  const winnerId = String(duel.winner_cat_id || duel.winner_cat?.id || '');
  const leftWinner = winnerId && winnerId === String(duel.challenger_cat?.id || '');
  const rightWinner = winnerId && winnerId === String(duel.challenged_cat?.id || '');
  const leftActive = duel.status === 'voting' && (votes.total % 2 === 0 ? leftPct >= rightPct : leftPct > rightPct);
  const rightActive = duel.status === 'voting' && !leftActive;
  const cardClass = compact ? 'duel-vs-compact' : '';

  const leftNode = (
    <DuelFighterCard
      side="a"
      cat={duel.challenger_cat}
      owner={duel.challenger_username}
      guild={duel.challenger_guild}
      status={String(duel.status || 'pending')}
      votes={votes}
      votePctValue={leftPct}
      isWinner={!!leftWinner}
      isLoser={!!winnerId && !leftWinner}
      isActiveAttacker={leftActive}
      cosmetics={duel.challenger_cosmetics || null}
      isOwnerView={meId === duel.challenger_user_id}
      voteTriggerKey={leftVoteTriggerKey}
    />
  );

  const rightNode = (
    <DuelFighterCard
      side="b"
      cat={duel.challenged_cat}
      owner={duel.challenged_username}
      guild={duel.challenged_guild}
      status={String(duel.status || 'pending')}
      votes={votes}
      votePctValue={rightPct}
      isWinner={!!rightWinner}
      isLoser={!!winnerId && !rightWinner}
      isActiveAttacker={rightActive}
      cosmetics={duel.challenged_cosmetics || null}
      isOwnerView={meId === duel.challenged_user_id}
      voteTriggerKey={rightVoteTriggerKey}
    />
  );

  return (
    <div className={`duel-vs-shell rounded-2xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-3 ${cardClass}`}>
      <DuelVsLayout left={leftNode} right={rightNode} />

      <div className="duel-vote-strip">
        <span>{votes.cat_a}</span>
        <span>{votes.total} votes</span>
        <span>{votes.cat_b}</span>
      </div>
      <div className="duel-vote-bar">
        <div className="duel-vote-fill left" style={{ width: `${leftPct}%` }} />
        <div className="duel-vote-fill right" style={{ width: `${rightPct}%` }} />
      </div>

      {!!onVote && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            disabled={!canVote || busy}
            onClick={() => {
              if (!duel.challenger_cat?.id) return;
              setLeftVoteTriggerKey(`${duel.id}:a:${Date.now()}`);
              onVote(duel.id, duel.challenger_cat.id);
            }}
            className="duel-vote-btn h-8 rounded-xl bg-orange-500/20 text-orange-100 text-[10px] font-bold disabled:opacity-45"
          >
            Vote {duel.challenger_cat?.name || 'Left'}
          </button>
          <button
            disabled={!canVote || busy}
            onClick={() => {
              if (!duel.challenged_cat?.id) return;
              setRightVoteTriggerKey(`${duel.id}:b:${Date.now()}`);
              onVote(duel.id, duel.challenged_cat.id);
            }}
            className="duel-vote-btn h-8 rounded-xl bg-sky-500/20 text-sky-100 text-[10px] font-bold disabled:opacity-45"
          >
            Vote {duel.challenged_cat?.name || 'Right'}
          </button>
        </div>
      )}

      {showCopyLink && (
        <div className="mt-2 flex items-center justify-end">
          <button
            onClick={() => onCopyLink?.(duel.id)}
            className="h-8 px-3 rounded-lg bg-white/10 text-[11px] text-white/80 inline-flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> Copy Vote Link
          </button>
        </div>
      )}

      <style jsx>{`
        .duel-vs-shell {
          animation: duelCardMount 150ms ease-out;
        }
        .duel-vs-compact {
          padding: 0.55rem;
        }
        .duel-vs-compact :global(.duel-fighter) {
          max-height: 320px;
          border-radius: 15px;
        }
        .duel-vs-shell :global(.duel-fighter) {
          position: relative;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: linear-gradient(165deg, rgba(3, 22, 27, 0.92), rgba(2, 10, 16, 0.94));
          overflow: hidden;
          max-height: 360px;
          transform: translateZ(0);
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .duel-vs-shell :global(.duel-fighter.duel-rarity-common) {
          border-color: rgba(148, 163, 184, 0.34);
          box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.08);
        }
        .duel-vs-shell :global(.duel-fighter.duel-rarity-rare) {
          border-color: rgba(96, 165, 250, 0.45);
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.12), 0 0 14px rgba(59,130,246,0.16);
        }
        .duel-vs-shell :global(.duel-fighter.duel-rarity-epic) {
          border-color: rgba(168, 85, 247, 0.44);
          box-shadow: inset 0 0 0 1px rgba(168,85,247,0.12), 0 0 14px rgba(168,85,247,0.16);
        }
        .duel-vs-shell :global(.duel-fighter.duel-rarity-legendary) {
          border-color: rgba(251, 191, 36, 0.52);
          background-image: linear-gradient(160deg, rgba(55, 34, 8, 0.25), rgba(0,0,0,0));
          box-shadow: inset 0 0 0 1px rgba(251,191,36,0.14), 0 0 16px rgba(251,191,36,0.16);
        }
        .duel-vs-shell :global(.duel-fighter.duel-rarity-mythic) {
          border-color: rgba(217, 70, 239, 0.45);
          background-image: linear-gradient(160deg, rgba(34, 211, 238, 0.07), rgba(217, 70, 239, 0.07));
          box-shadow: inset 0 0 0 1px rgba(217,70,239,0.14), 0 0 16px rgba(217,70,239,0.14);
        }
        .duel-vs-shell :global(.duel-fighter:hover) {
          transform: perspective(500px) rotateX(2deg) translateY(-1px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
        }
        .duel-vs-shell :global(.duel-fighter::after) {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 30% -20%, rgba(56,189,248,0.12), transparent 45%);
        }
        .duel-vs-shell :global(.duel-fighter.winner) {
          box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.35), 0 0 20px rgba(34, 197, 94, 0.2);
        }
        .duel-vs-shell :global(.duel-fighter.loser) {
          opacity: 0.85;
        }
        .duel-vs-shell :global(.duel-fighter.attacker) {
          box-shadow: 0 0 0 1px rgba(56,189,248,0.4), 0 0 18px rgba(56,189,248,0.22);
        }
        .duel-vs-shell :global(.duel-header-strip) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 9px 0;
        }
        .duel-vs-compact :global(.duel-header-strip) {
          padding: 5px 7px 0;
          gap: 6px;
        }
        .duel-vs-shell :global(.duel-rarity-badge) {
          display: inline-flex;
          border-radius: 999px;
          border: 1px solid;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 2px 7px;
        }
        .duel-vs-shell :global(.duel-header-right) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .duel-vs-shell :global(.duel-lvl-badge) {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(6px);
        }
        .duel-vs-shell :global(.duel-guild-badge) {
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          font-size: 10px;
          color: rgba(255,255,255,0.85);
        }
        .duel-vs-shell :global(.duel-hero) {
          position: relative;
          margin: 7px 9px 0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.15);
          height: 104px;
        }
        .duel-vs-compact :global(.duel-hero) {
          margin: 6px 7px 0;
          border-radius: 12px;
          height: 82px;
        }
        .duel-vs-shell :global(.duel-hero-image) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .duel-vs-shell :global(.duel-hero-overlay) {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 35%, rgba(2, 6, 23, 0.88) 100%);
        }
        .duel-vs-shell :global(.duel-hero-text) {
          position: absolute;
          left: 9px;
          right: 9px;
          bottom: 8px;
          z-index: 1;
        }
        .duel-vs-compact :global(.duel-hero-text) {
          left: 7px;
          right: 7px;
          bottom: 6px;
        }
        .duel-vs-shell :global(.duel-badge-overlay) {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(2, 6, 23, 0.7);
          padding: 2px 7px;
          font-size: 9px;
          color: rgba(255,255,255,0.86);
          max-width: 54%;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .duel-vs-shell :global(.duel-name) {
          font-size: 15px;
          line-height: 1;
          font-weight: 900;
          color: #fff;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .duel-vs-compact :global(.duel-name) { font-size: 13px; }
        .duel-vs-shell :global(.duel-owner) {
          margin-top: 2px;
          font-size: 10px;
          color: rgba(255,255,255,0.75);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .duel-vs-compact :global(.duel-owner) { font-size: 9px; margin-top: 1px; }
        .duel-vs-shell :global(.duel-role) {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.5);
        }
        .duel-vs-compact :global(.duel-role) { font-size: 8px; }
        .duel-vs-shell :global(.duel-title) {
          margin-top: 2px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(224, 242, 254, 0.95);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .duel-vs-compact :global(.duel-title) { font-size: 9px; margin-top: 1px; }
        .duel-vs-shell :global(.duel-title.legendary)::after {
          content: ' ★';
          color: rgba(251, 191, 36, 0.95);
        }
        .duel-vs-shell :global(.duel-power-row) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 9px 0;
        }
        .duel-vs-compact :global(.duel-power-row) {
          padding: 6px 7px 0;
          gap: 6px;
        }
        .duel-vs-shell :global(.duel-power-label) {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.55);
        }
        .duel-vs-shell :global(.duel-power-value) {
          font-size: 18px;
          line-height: 1;
          font-weight: 900;
          color: #dff6ff;
        }
        .duel-vs-compact :global(.duel-power-value) { font-size: 15px; }
        .duel-vs-shell :global(.duel-adv-chip) {
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.16);
          color: rgba(187,247,208,1);
          font-size: 9px;
          font-weight: 700;
          padding: 2px 8px;
        }
        .duel-vs-shell :global(.duel-power-glow) {
          margin: 4px 9px 0;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(56,189,248,0.15), rgba(56,189,248,0.85), rgba(56,189,248,0.15));
        }
        .duel-vs-compact :global(.duel-power-glow) { margin: 3px 7px 0; }
        .duel-vs-shell :global(.duel-move-row) {
          margin: 6px 9px 0;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          padding: 6px 8px;
        }
        .duel-vs-compact :global(.duel-move-row) {
          margin: 4px 7px 0;
          padding: 4px 6px;
          border-radius: 9px;
        }
        .duel-vs-shell :global(.duel-move-label) {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.5);
        }
        .duel-vs-shell :global(.duel-move-name) {
          margin-top: 1px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .duel-vs-compact :global(.duel-move-name) { font-size: 10px; }
        .duel-vs-shell :global(.duel-move-effect) {
          margin-top: 1px;
          font-size: 9px;
          color: rgba(125,211,252,0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .duel-vs-compact :global(.duel-move-effect) { font-size: 8px; }
        .duel-vs-shell :global(.duel-footer-strip) {
          margin: 6px 9px 8px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          min-height: 26px;
          display: grid;
          align-items: center;
          padding: 0 10px;
        }
        .duel-vs-compact :global(.duel-footer-strip) {
          margin: 4px 7px 6px;
          min-height: 22px;
          padding: 0 8px;
          border-radius: 10px;
        }
        .duel-vs-shell :global(.duel-equipped-pill) {
          margin-left: auto;
          border-radius: 999px;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.15);
          padding: 2px 8px;
          font-size: 9px;
          color: rgba(187,247,208,1);
          font-weight: 700;
        }
        .duel-vs-shell :global(.duel-ready),
        .duel-vs-shell :global(.duel-result) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(224,242,254,0.95);
        }
        .duel-vs-shell :global(.duel-result.victory){ color: #86efac; }
        .duel-vs-shell :global(.duel-result.defeat){ color: #fca5a5; }
        .duel-vs-shell :global(.duel-hp-wrap) {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 8px;
        }
        .duel-vs-shell :global(.duel-hp-label) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          color: rgba(255,255,255,0.66);
        }
        .duel-vs-shell :global(.duel-hp-track) {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
        }
        .duel-vs-shell :global(.duel-hp-fill) {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #22c55e, #86efac);
          transition: width 220ms ease;
        }

        .duel-vote-strip {
          margin-top: 5px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: rgba(255,255,255,0.72);
        }
        .duel-vote-bar {
          margin-top: 2px;
          height: 6px;
          display: flex;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.07);
        }
        .duel-vote-fill {
          transition: width 180ms ease;
        }
        .duel-vote-fill.left {
          background: linear-gradient(90deg, rgba(251,146,60,0.95), rgba(251,146,60,0.5));
        }
        .duel-vote-fill.right {
          background: linear-gradient(90deg, rgba(56,189,248,0.5), rgba(56,189,248,0.95));
        }
        .duel-vs-compact .duel-vote-btn {
          height: 30px;
          font-size: 9px;
          border-radius: 10px;
        }

        @keyframes duelCardMount {
          from { opacity: 0.84; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 420px) {
          .duel-vs-shell :global(.duel-hero) { height: 96px; }
          .duel-vs-shell :global(.duel-name) { font-size: 14px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .duel-vs-shell,
          .duel-vs-shell :global(.duel-fighter),
          .duel-vs-shell :global(.duel-hp-fill),
          .duel-vote-fill {
            animation: none !important;
            transition: none !important;
          }
        }

        /* Duel cards use static border cosmetics; no auto-looping border fx */
        .duel-vs-shell :global(.duel-fighter.cosm-border-lightning),
        .duel-vs-shell :global(.duel-fighter.cosm-border-neon-cyan),
        .duel-vs-shell :global(.duel-fighter.cosm-border-flame),
        .duel-vs-shell :global(.duel-fighter.cosm-border-void),
        .duel-vs-shell :global(.duel-fighter.cosm-border-galaxy),
        .duel-vs-shell :global(.duel-fighter.cosm-border-royal-violet),
        .duel-vs-shell :global(.duel-fighter.fx-border-lightning),
        .duel-vs-shell :global(.duel-fighter.fx-border-flame),
        .duel-vs-shell :global(.duel-fighter.fx-border-shadow) {
          animation: none !important;
        }
        .duel-vs-shell :global(.duel-fighter.cosm-border-lightning::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-lightning::after),
        .duel-vs-shell :global(.duel-fighter.cosm-border-neon-cyan::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-neon-cyan::after),
        .duel-vs-shell :global(.duel-fighter.cosm-border-flame::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-flame::after),
        .duel-vs-shell :global(.duel-fighter.cosm-border-void::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-void::after),
        .duel-vs-shell :global(.duel-fighter.cosm-border-galaxy::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-galaxy::after),
        .duel-vs-shell :global(.duel-fighter.cosm-border-royal-violet::before),
        .duel-vs-shell :global(.duel-fighter.cosm-border-royal-violet::after),
        .duel-vs-shell :global(.duel-fighter.fx-border-lightning::before),
        .duel-vs-shell :global(.duel-fighter.fx-border-lightning::after),
        .duel-vs-shell :global(.duel-fighter.fx-border-flame::before),
        .duel-vs-shell :global(.duel-fighter.fx-border-flame::after),
        .duel-vs-shell :global(.duel-fighter.fx-border-shadow::before),
        .duel-vs-shell :global(.duel-fighter.fx-border-shadow::after) {
          animation: none !important;
        }
      `}</style>
    </div>
  );
}
