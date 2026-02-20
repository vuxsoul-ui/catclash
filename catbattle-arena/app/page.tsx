// REPLACE: app/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Sparkles, Flame, Target, Zap, Loader2, Check, Crosshair,
  ArrowRight, Crown, Swords, Star, MessageCircle, Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SigilIcon from "./components/icons/SigilIcon";
import ArenaFlameCard, { type ArenaFlame } from "./components/ArenaFlameCard";
import DuelCardMini from "./components/duel/DuelCardMini";
import type { DuelRowData } from "./components/duel/types";
import { showGlobalToast } from "./lib/global-toast";
import VoteEffectLayer from "./components/cosmetics/VoteEffectLayer";
import { cosmeticBorderClassFromSlug, cosmeticTextClassFromSlug } from "./_lib/cosmetics/effectsRegistry";
import { computePowerRating, getMoveMeaning } from "./_lib/combat";
import { Button, Card, SectionHeader } from "./components/ui/primitives";
import { useArenaMatches } from "./hooks/useArenaMatches";

// Types
interface UserProgress {
  xp: number;
  level: number;
  currentStreak: number;
  sigils: number;
  predictionStreak: number;
  catXpPool: number;
}

interface ArenaCat {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  ability?: string | null;
  owner_username?: string | null;
  owner_guild?: 'sun' | 'moon' | null;
  stats?: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
}

interface ArenaMatch {
  match_id: string;
  cat_a: ArenaCat;
  cat_b: ArenaCat;
  votes_a: number;
  votes_b: number;
  status: string;
  winner_id?: string | null;
  is_close_match?: boolean;
  user_prediction?: { predicted_cat_id: string; bet_sigils: number } | null;
}

interface MatchComment {
  id: string;
  match_id: string;
  user_id: string;
  username: string;
  commenter_cosmetics?: {
    title: string | null;
    border_slug: string | null;
    color_slug: string | null;
    color_name: string | null;
  };
  body: string;
  created_at: string;
}

interface ArenaRound {
  round: number;
  matches: ArenaMatch[];
}

interface Arena {
  tournament_id: string;
  type: string;
  date: string;
  current_round: number;
  status: string;
  champion: ArenaCat | null;
  rounds: ArenaRound[];
}

interface GlobalArenaPageInfo {
  dayKey: string;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  activeVoters10m: number;
  livePulseAt: number | null;
}

interface StarterMission {
  key: string;
  title: string;
  description: string;
  reward_xp: number;
  cta: string;
  cta_href: string;
  status: 'locked' | 'active' | 'complete';
}

type DuelRow = DuelRowData;
type ArenaRefreshResult = { ok: boolean; count: number; status?: string | null };

// Config
const ARENA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; accent: string; description: string }> = {
  main: {
    label: "Main Arena",
    icon: <Swords className="w-4 h-4" />,
    color: "border-yellow-500/30 bg-yellow-500/5",
    accent: "text-yellow-400",
    description: "The premier daily tournament. 8 cats enter, 1 champion emerges.",
  },
  rookie: {
    label: "Rookie Arena",
    icon: <Star className="w-4 h-4" />,
    color: "border-green-500/30 bg-green-500/5",
    accent: "text-green-400",
    description: "Fresh faces battle for glory. Every champion starts here.",
  },
};


function getArenaConfig(type: string) {
  return ARENA_CONFIG[type] || {
    label: type.charAt(0).toUpperCase() + type.slice(1) + " Arena",
    icon: <Target className="w-4 h-4" />,
    color: "border-purple-500/30 bg-purple-500/5",
    accent: "text-purple-400",
    description: "A special tournament bracket.",
  };
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    Common: "text-gray-400", Rare: "text-blue-400", Epic: "text-purple-400",
    Legendary: "text-yellow-400", Mythic: "text-red-400", "God-Tier": "text-pink-400",
  };
  return colors[rarity] || "text-gray-400";
}

function guildBadge(guild: string | null | undefined): { label: string; cls: string } | null {
  if (guild === 'sun') return { label: '☀ Solar', cls: 'bg-gradient-to-r from-amber-500/35 to-orange-400/25 text-amber-50 border border-amber-200/45 shadow-[0_0_12px_rgba(251,191,36,0.28)]' };
  if (guild === 'moon') return { label: '☾ Lunar', cls: 'bg-gradient-to-r from-cyan-500/35 to-blue-400/25 text-cyan-50 border border-cyan-200/45 shadow-[0_0_12px_rgba(34,211,238,0.25)]' };
  return null;
}

function getCatImage(cat: ArenaCat): string {
  return cat.image_url || "/cat-placeholder.svg";
}

function getVotePercent(a: number, b: number): [number, number] {
  const total = a + b;
  if (total === 0) return [50, 50];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

function arrangeWithCatSpacing(matches: ArenaMatch[], minGap = 10): ArenaMatch[] {
  if (matches.length <= 2) return matches;
  const out: ArenaMatch[] = [];
  const remaining = [...matches];
  const recentCats: string[] = [];
  while (remaining.length > 0) {
    let idx = remaining.findIndex((m) => {
      const a = String(m.cat_a?.id || '');
      const b = String(m.cat_b?.id || '');
      return !recentCats.includes(a) && !recentCats.includes(b);
    });
    if (idx < 0) idx = 0;
    const [picked] = remaining.splice(idx, 1);
    out.push(picked);
    recentCats.push(String(picked.cat_a?.id || ''), String(picked.cat_b?.id || ''));
    while (recentCats.length > minGap * 2) recentCats.shift();
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function computeMatchEnergy(match: ArenaMatch, leadFlipCount = 0): number {
  const total = Math.max(0, Number(match.votes_a || 0) + Number(match.votes_b || 0));
  const [pctA, pctB] = getVotePercent(match.votes_a, match.votes_b);
  const margin = Math.abs(pctA - pctB);
  const closeness = clamp(40 - margin, 0, 40);
  const voteVolume = clamp(Math.round(total * 1.25), 0, 35);
  const closeMatchBonus = match.is_close_match ? 10 : 0;
  const flipBonus = clamp(leadFlipCount * 8, 0, 16);
  return clamp(closeness + voteVolume + closeMatchBonus + flipBonus, 0, 100);
}

function statPower(c: ArenaCat): number {
  const s = c.stats || { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 };
  return computePowerRating({
    attack: s.attack,
    defense: s.defense,
    speed: s.speed,
    charisma: s.charisma,
    chaos: s.chaos,
    rarity: c.rarity,
    ability: c.ability || null,
    level: 1,
  });
}

function isByeMatch(match: ArenaMatch): boolean {
  return match.cat_a.id === match.cat_b.id;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const delta = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (delta < 60) return `${delta}s`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  return `${Math.floor(delta / 86400)}d`;
}

function commentTextClassFromColorSlug(slug: string | null | undefined): string {
  return cosmeticTextClassFromSlug(slug);
}

function commentBorderClassFromBorderSlug(slug: string | null | undefined): string {
  return cosmeticBorderClassFromSlug(slug);
}

function LiveDuelsModule({
  duels,
  pendingDuelCount,
  liveDuelVotes2m,
  compact = false,
}: {
  duels: DuelRow[];
  pendingDuelCount: number;
  liveDuelVotes2m: number;
  compact?: boolean;
}) {
  return (
    <Card className={`border-cyan-300/20 bg-cyan-500/8 ${compact ? 'p-2' : 'p-2.5'}`}>
      <SectionHeader className="mb-1.5">
        <h3 className="text-[12px] font-semibold text-cyan-100 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          Live Duels
        </h3>
        <Link href="/duel" className="relative text-[10px] text-cyan-200 inline-flex items-center gap-1">
          Open Duel Arena <ArrowRight className="w-3 h-3" />
          {pendingDuelCount > 0 && (
            <span className="absolute -top-2 -right-4 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold inline-flex items-center justify-center border border-red-300/40">
              {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
            </span>
          )}
        </Link>
      </SectionHeader>
      {duels.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5">
          {duels.slice(0, compact ? 6 : 10).map((duel) => (
            <div key={`live-duel-${duel.id}`} className="snap-start w-[38vw] min-w-[140px] max-w-[170px]">
              <DuelCardMini duel={duel} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/60">No live duels yet.</p>
      )}
      {liveDuelVotes2m > 0 && (
        <p className="text-[10px] text-cyan-100/70 mt-1.5">+{liveDuelVotes2m} duel votes in last 2m</p>
      )}
    </Card>
  );
}

// ── Match Card ── Images link to profile, vote buttons below
function MatchCard({
  match, voted, isVoting, predictBusy, calloutBusy, socialEnabled, availableSigils, voteStreak, isExiting, onVote, onPredict, onCreateCallout,
  voteEffectSlug,
}: {
  match: ArenaMatch; voted: string | null; isVoting: boolean;
  predictBusy: boolean;
  calloutBusy: boolean;
  socialEnabled: boolean;
  availableSigils: number;
  voteStreak: number;
  isExiting?: boolean;
  voteEffectSlug?: string | null;
  onVote: (matchId: string, catId: string) => void;
  onPredict: (matchId: string, catId: string, bet: number) => void;
  onCreateCallout: (matchId: string, catId: string) => void;
}) {
  const [pctA, pctB] = getVotePercent(match.votes_a, match.votes_b);
  const isComplete = match.status === "complete";
  const hasVoted = !!voted;
  const canVote = !hasVoted && !isVoting && !isComplete;
  const predictedCatId = match.user_prediction?.predicted_cat_id || null;
  const [bet, setBet] = useState(10);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [displayPct, setDisplayPct] = useState<{ a: number; b: number }>({ a: pctA, b: pctB });
  const [pressedSide, setPressedSide] = useState<'a' | 'b' | null>(null);
  const [voteEffectTriggerKey, setVoteEffectTriggerKey] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const guildA = guildBadge(match.cat_a.owner_guild || null);
  const guildB = guildBadge(match.cat_b.owner_guild || null);
  const aPower = statPower(match.cat_a);
  const bPower = statPower(match.cat_b);
  const strongerA = aPower >= bPower;
  const edgePct = Math.min(35, Math.round((Math.abs(aPower - bPower) / Math.max(1, Math.max(aPower, bPower))) * 100));
  const statusLine = isComplete ? 'Decided' : (match.is_close_match ? 'Close Match' : 'Prediction Open');

  const moveA = getMoveMeaning(match.cat_a.ability || null);
  const moveB = getMoveMeaning(match.cat_b.ability || null);
  const borderA = cosmeticBorderClassFromSlug(
    match.cat_a.rarity === 'Legendary' ? 'border-flame'
      : match.cat_a.rarity === 'Mythic' || match.cat_a.rarity === 'Epic' ? 'border-void-drift'
      : match.cat_a.rarity === 'Rare' ? 'border-neon-cyan'
      : 'border-obsidian'
  );
  const borderB = cosmeticBorderClassFromSlug(
    match.cat_b.rarity === 'Legendary' ? 'border-flame'
      : match.cat_b.rarity === 'Mythic' || match.cat_b.rarity === 'Epic' ? 'border-void-drift'
      : match.cat_b.rarity === 'Rare' ? 'border-neon-cyan'
      : 'border-obsidian'
  );

  useEffect(() => {
    setDisplayPct((prev) => {
      if (prev.a === pctA && prev.b === pctB) return prev;
      return { a: pctA, b: pctB };
    });
  }, [pctA, pctB]);

  async function loadComments() {
    setCommentsBusy(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/tournament/comments?match_id=${encodeURIComponent(match.match_id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCommentError(data?.error || 'Failed to load comments');
        return;
      }
      setCommentsDisabled(!!data?.disabled);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      setCommentsLoaded(true);
    } catch {
      setCommentError('Failed to load comments');
    } finally {
      setCommentsBusy(false);
    }
  }

  async function handlePostComment() {
    const body = commentText.trim();
    if (!body || commentPosting) return;
    setCommentPosting(true);
    setCommentError(null);
    try {
      const res = await fetch('/api/tournament/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.match_id, comment: body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCommentError(data?.error || 'Failed to post comment');
        return;
      }
      setCommentText('');
      const next = data?.comment ? [data.comment as MatchComment, ...comments] : comments;
      setComments(next.slice(0, 40));
      setCommentsLoaded(true);
    } catch {
      setCommentError('Failed to post comment');
    } finally {
      setCommentPosting(false);
    }
  }

  return (
    <div className={`arena-match-card relative mx-auto w-full rounded-2xl p-2.5 active:scale-[0.995] transition-all duration-150 ${hasVoted || isComplete ? "opacity-65" : ""} ${isExiting ? 'opacity-0 -translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
      <VoteEffectLayer
        effectSlug={voteEffectSlug || null}
        triggerKey={voteEffectTriggerKey}
        onTriggered={() => {
          fetch('/api/telemetry/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'cosmetic_effect_triggered', payload: { effect: voteEffectSlug || 'default_vote' } }),
          }).catch(() => null);
        }}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-stretch gap-2">
        <div className="min-w-0 flex h-full flex-col">
          <div className={`arena-fighter-pane h-full rounded-2xl border border-white/15 p-1.5 flex flex-col ${borderA}`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${match.cat_a.rarity === 'Rare' ? 'text-blue-100 border-blue-300/45 bg-blue-500/20' : match.cat_a.rarity === 'Epic' ? 'text-purple-100 border-purple-300/45 bg-purple-500/20' : match.cat_a.rarity === 'Legendary' ? 'text-amber-100 border-amber-300/45 bg-amber-500/20' : match.cat_a.rarity === 'Mythic' ? 'text-fuchsia-100 border-fuchsia-300/45 bg-fuchsia-500/20' : 'text-zinc-100 border-zinc-300/35 bg-zinc-500/20'}`}>
                {match.cat_a.rarity}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-[9px] text-white/85">LVL 1</span>
            </div>
            <Link href={`/cat/${match.cat_a.id}`} className="block">
              <div className="relative h-24 rounded-xl overflow-hidden border border-white/15">
                <img src={getCatImage(match.cat_a)} alt={match.cat_a.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute left-2 right-2 bottom-1">
                  <p className="text-[14px] leading-none font-bold truncate hover:underline">{match.cat_a.name}</p>
                  <p className="text-[9px] text-white/70 truncate">by {match.cat_a.owner_username || "Unknown"} · Arena Challenger</p>
                </div>
              </div>
            </Link>
            {detailsOpen && (
            <div className="arena-power-chip mt-1 rounded-lg border border-cyan-300/20 px-2 py-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wide text-white/60">Power</span>
                <span className="text-sm font-black text-cyan-100">{Math.round(aPower)}</span>
              </div>
              <div className="h-1 mt-1 rounded-full bg-cyan-200/15 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/35 via-cyan-300/80 to-cyan-300/35" style={{ width: `${Math.max(18, Math.min(100, Math.round((aPower / Math.max(1, Math.max(aPower, bPower))) * 100)))}%` }} />
              </div>
            </div>
            )}
            {detailsOpen && (
            <div className="arena-move-chip mt-1 rounded-lg border border-white/10 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.08em] text-white/55">Move</p>
              <p className="text-[11px] font-semibold text-white/90 truncate">{moveA.name}</p>
              <p className="text-[9px] text-cyan-200/85 truncate">{moveA.short}</p>
            </div>
            )}
            <div className="mt-1 min-h-[16px] text-[9px]">
              {guildA && <span className={`px-1.5 py-0.5 rounded-full ${guildA.cls}`}>{guildA.label}</span>}
            </div>
          </div>
          {canVote && (
            <button
              onClick={() => {
                setPressedSide('a');
                setVoteEffectTriggerKey(`${match.match_id}:a:${Date.now()}`);
                onVote(match.match_id, match.cat_a.id);
                window.setTimeout(() => setPressedSide(null), 220);
              }}
              aria-label={`Vote for ${match.cat_a.name}`}
              className={`mt-1.5 h-9 w-full rounded-lg border border-white/20 bg-white/8 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-transform duration-100 hover:bg-white/12 ${pressedSide === 'a' ? 'scale-[0.98]' : ''}`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-300" />
              {isVoting ? "Voting..." : "Vote A"}
            </button>
          )}
          {voted === match.cat_a.id && (
            <div className="mt-1.5 h-8 w-full rounded-lg border border-white/15 bg-white/6 text-white/85 text-[11px] font-semibold flex items-center justify-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-300" />
              <Check className="w-3 h-3" /> Voted
            </div>
          )}
        </div>

        <div className="pt-12 flex flex-col items-center justify-center gap-1">
          <span className="w-10 h-[2px] rounded-full bg-gradient-to-r from-cyan-300/20 via-cyan-300 to-orange-300/20" />
          <div className="text-[10px] text-white/70 font-extrabold tracking-[0.15em]">VS</div>
          <span className="w-10 h-[2px] rounded-full bg-gradient-to-r from-orange-300/20 via-orange-300 to-cyan-300/20" />
        </div>

        <div className="min-w-0 flex h-full flex-col">
          <div className={`arena-fighter-pane h-full rounded-2xl border border-white/15 p-1.5 flex flex-col ${borderB}`}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${match.cat_b.rarity === 'Rare' ? 'text-blue-100 border-blue-300/45 bg-blue-500/20' : match.cat_b.rarity === 'Epic' ? 'text-purple-100 border-purple-300/45 bg-purple-500/20' : match.cat_b.rarity === 'Legendary' ? 'text-amber-100 border-amber-300/45 bg-amber-500/20' : match.cat_b.rarity === 'Mythic' ? 'text-fuchsia-100 border-fuchsia-300/45 bg-fuchsia-500/20' : 'text-zinc-100 border-zinc-300/35 bg-zinc-500/20'}`}>
                {match.cat_b.rarity}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-[9px] text-white/85">LVL 1</span>
            </div>
            <Link href={`/cat/${match.cat_b.id}`} className="block">
              <div className="relative h-24 rounded-xl overflow-hidden border border-white/15">
                <img src={getCatImage(match.cat_b)} alt={match.cat_b.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute left-2 right-2 bottom-1">
                  <p className="text-[14px] leading-none font-bold truncate hover:underline">{match.cat_b.name}</p>
                  <p className="text-[9px] text-white/70 truncate">by {match.cat_b.owner_username || "Unknown"} · Arena Defender</p>
                </div>
              </div>
            </Link>
            {detailsOpen && (
            <div className="arena-power-chip mt-1 rounded-lg border border-cyan-300/20 px-2 py-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wide text-white/60">Power</span>
                <span className="text-sm font-black text-cyan-100">{Math.round(bPower)}</span>
              </div>
              <div className="h-1 mt-1 rounded-full bg-cyan-200/15 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/35 via-cyan-300/80 to-cyan-300/35" style={{ width: `${Math.max(18, Math.min(100, Math.round((bPower / Math.max(1, Math.max(aPower, bPower))) * 100)))}%` }} />
              </div>
            </div>
            )}
            {detailsOpen && (
            <div className="arena-move-chip mt-1 rounded-lg border border-white/10 px-2 py-1">
              <p className="text-[8px] uppercase tracking-[0.08em] text-white/55">Move</p>
              <p className="text-[11px] font-semibold text-white/90 truncate">{moveB.name}</p>
              <p className="text-[9px] text-cyan-200/85 truncate">{moveB.short}</p>
            </div>
            )}
            <div className="mt-1 min-h-[16px] text-[9px]">
              {guildB && <span className={`px-1.5 py-0.5 rounded-full ${guildB.cls}`}>{guildB.label}</span>}
            </div>
          </div>
          {canVote && (
            <button
              onClick={() => {
                setPressedSide('b');
                setVoteEffectTriggerKey(`${match.match_id}:b:${Date.now()}`);
                onVote(match.match_id, match.cat_b.id);
                window.setTimeout(() => setPressedSide(null), 220);
              }}
              aria-label={`Vote for ${match.cat_b.name}`}
              className={`mt-1.5 h-9 w-full rounded-lg border border-white/20 bg-white/8 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-transform duration-100 hover:bg-white/12 ${pressedSide === 'b' ? 'scale-[0.98]' : ''}`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-300" />
              {isVoting ? "Voting..." : "Vote B"}
            </button>
          )}
          {voted === match.cat_b.id && (
            <div className="mt-1.5 h-8 w-full rounded-lg border border-white/15 bg-white/6 text-white/85 text-[11px] font-semibold flex items-center justify-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-300" />
              <Check className="w-3 h-3" /> Voted
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
        <span>{statusLine}</span>
        <span className="tabular-nums">{displayPct.a}% · {displayPct.b}%</span>
      </div>
      <div className="mt-1">
        {edgePct <= 3 ? (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/75">Stat Edge: Balanced</span>
        ) : (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${strongerA ? 'bg-blue-500/20 text-blue-200' : 'bg-red-500/20 text-red-200'}`}>
            Stat Edge: {strongerA ? 'A' : 'B'} +{edgePct}%
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="text-[10px] px-2 py-1 rounded-full border border-white/15 bg-white/6 text-white/75"
        >
          {detailsOpen ? 'Hide details' : 'Expand details'}
        </button>
        {!isComplete && match.is_close_match && (
          <span className="text-[10px] px-2 py-1 rounded-full border border-amber-300/35 bg-amber-500/15 text-amber-100">Close match</span>
        )}
        {!isComplete && !match.is_close_match && (
          <span className="text-[10px] px-2 py-1 rounded-full border border-cyan-300/35 bg-cyan-500/12 text-cyan-100">Upset potential</span>
        )}
      </div>
      <div className="mt-1 h-1.5 rounded-full overflow-hidden flex bg-white/5">
        <div className={`bg-blue-500 transition-all duration-300 ${voted === match.cat_a.id ? 'shadow-[0_0_10px_rgba(59,130,246,0.55)]' : ''}`} style={{ width: `${displayPct.a}%` }} />
        <div className={`bg-red-500 transition-all duration-300 ${voted === match.cat_b.id ? 'shadow-[0_0_10px_rgba(239,68,68,0.55)]' : ''}`} style={{ width: `${displayPct.b}%` }} />
      </div>

      {!isComplete && (
        <div className="mt-2">
          <div className="flex gap-1.5 mb-1.5">
            {[5, 10, 15, 20].map((chip) => (
              <button
                key={`${match.match_id}-${chip}`}
                disabled={chip > availableSigils || !!predictedCatId}
                onClick={() => setBet(chip)}
                className={`h-7 px-2 rounded-full text-[10px] border inline-flex items-center justify-center ${bet === chip ? 'border-amber-300 text-amber-200 bg-amber-500/15' : 'border-white/15 text-white/70 bg-white/5'} disabled:opacity-40`}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!!predictedCatId || predictBusy || bet > availableSigils}
              onClick={() => onPredict(match.match_id, match.cat_a.id, bet)}
              aria-label={`Predict ${match.cat_a.name} for ${bet} sigils`}
              className="h-8 rounded-lg bg-blue-500/15 text-blue-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-40"
            >
              {predictedCatId === match.cat_a.id ? (
                <span className="inline-flex items-center justify-center gap-1">
                  Predicted
                  <span className="inline-flex items-center gap-0.5">
                    +
                    <SigilIcon className="w-3 h-3" />
                    {match.user_prediction?.bet_sigils || bet}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1">
                  Predict A
                  <span className="inline-flex items-center gap-0.5">
                    (
                    +
                    <SigilIcon className="w-3 h-3" />
                    {bet}
                    )
                  </span>
                </span>
              )}
            </button>
            <button
              disabled={!!predictedCatId || predictBusy || bet > availableSigils}
              onClick={() => onPredict(match.match_id, match.cat_b.id, bet)}
              aria-label={`Predict ${match.cat_b.name} for ${bet} sigils`}
              className="h-8 rounded-lg bg-red-500/15 text-red-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-40"
            >
              {predictedCatId === match.cat_b.id ? (
                <span className="inline-flex items-center justify-center gap-1">
                  Predicted
                  <span className="inline-flex items-center gap-0.5">
                    +
                    <SigilIcon className="w-3 h-3" />
                    {match.user_prediction?.bet_sigils || bet}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1">
                  Predict B
                  <span className="inline-flex items-center gap-0.5">
                    (
                    +
                    <SigilIcon className="w-3 h-3" />
                    {bet}
                    )
                  </span>
                </span>
              )}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span className="text-orange-200/85">{voteStreak > 1 ? `🔥 x${voteStreak}` : '🔥 x1'}</span>
            <span className="text-white/45">{match.votes_a}-{match.votes_b} votes</span>
          </div>
          {predictedCatId && (
            <div className="mt-1 text-[10px]">
              <span className="inline-flex px-2 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-100">Return at next Pulse</span>
            </div>
          )}
        </div>
      )}
      {hasVoted && socialEnabled && (
        <div className="mt-2">
          <button
            disabled={calloutBusy}
            onClick={() => {
              if (!voted) return;
              onCreateCallout(match.match_id, voted);
            }}
            className="h-8 px-3 rounded-lg bg-cyan-500/15 text-cyan-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-50"
          >
            {calloutBusy ? 'Creating...' : 'Create Callout'}
          </button>
        </div>
      )}

      <div className="mt-2.5">
        <button
          onClick={() => {
            const nextOpen = !commentsOpen;
            setCommentsOpen(nextOpen);
            if (nextOpen && !commentsLoaded && !commentsBusy) {
              loadComments();
            }
          }}
          className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/85 text-[11px] font-semibold inline-flex items-center gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Comments {comments.length > 0 ? `(${comments.length})` : ''}
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2.5">
          {commentsDisabled ? (
            <p className="text-[11px] text-white/50">Comments are not enabled yet on this deployment.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={240}
                  placeholder="Say something..."
                  className="flex-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                />
                <button
                  disabled={commentPosting || !commentText.trim()}
                  onClick={handlePostComment}
                  className="h-8 px-3 rounded-lg bg-cyan-500/20 border border-cyan-300/30 text-cyan-200 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {commentPosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Send
                </button>
              </div>
              {commentError && <p className="text-[11px] text-red-300 mt-1.5">{commentError}</p>}
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {commentsBusy && <p className="text-[11px] text-white/50">Loading comments...</p>}
                {!commentsBusy && comments.length === 0 && (
                  <p className="text-[11px] text-white/45">No comments yet. Start the thread.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className={`rounded-lg bg-white/[0.04] border p-2 ${commentBorderClassFromBorderSlug(c.commenter_cosmetics?.border_slug)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <p className={`text-[11px] font-semibold truncate ${commentTextClassFromColorSlug(c.commenter_cosmetics?.color_slug)}`}>{c.username || 'Guest'}</p>
                        {c.commenter_cosmetics?.title && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-yellow-400/35 bg-yellow-500/15 text-yellow-200 shrink-0">
                            {c.commenter_cosmetics.title}
                          </span>
                        )}
                        {String(c.commenter_cosmetics?.color_slug || '').startsWith('vote-') && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-cyan-300/35 bg-cyan-500/15 text-cyan-200 shrink-0">
                            ✨ Effect
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/45 shrink-0">{relativeTime(c.created_at)}</p>
                    </div>
                    <p className="text-[11px] text-white/75 mt-0.5 break-words">{c.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {isExiting && (
        <div className="mt-1 text-[10px] text-cyan-200/90 animate-pulse">Next matchup loading...</div>
      )}
    </div>
  );
}

// ── Arena Section ──
function ArenaSection({
  arena, votedMatches, votingMatch, predictBusyMatch, calloutBusyMatch, socialEnabled, availableSigils, voteStreak, hotMatchBiasEnabled, voteEffectSlug, onVote, onPredict, onCreateCallout, onRequestMore, globalPageInfo, pulseCountdown,
}: {
  arena: Arena; votedMatches: Record<string, string>;
  votingMatch: string | null;
  predictBusyMatch: string | null;
  calloutBusyMatch: string | null;
  socialEnabled: boolean;
  availableSigils: number;
  voteStreak: number;
  hotMatchBiasEnabled?: boolean;
  voteEffectSlug?: string | null;
  globalPageInfo?: GlobalArenaPageInfo | null;
  pulseCountdown?: string;
  onVote: (matchId: string, catId: string) => void;
  onPredict: (matchId: string, catId: string, bet: number) => void;
  onCreateCallout: (matchId: string, catId: string) => void;
  onRequestMore?: () => Promise<ArenaRefreshResult>;
}) {
  const config = getArenaConfig(arena.type);
  const [segment, setSegment] = useState<"voting" | "results">("voting");
  const [stackIds, setStackIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [stackReady, setStackReady] = useState(false);
  const processedVotedRef = useRef<Set<string>>(new Set());
  const firstPageIdsRef = useRef<string[]>([]);
  const cursorRef = useRef(0);
  const MAX_VISIBLE = 4;
  const currentRound = arena.rounds.find((r) => r.round === arena.current_round);
  const voting = (currentRound?.matches || []).filter((m) => !isByeMatch(m) && m.status === "active");
  const [globalResults, setGlobalResults] = useState<ArenaMatch[]>([]);
  const results = globalResults.length > 0
    ? globalResults
    : [...arena.rounds].reverse().flatMap((r) => r.matches || []).filter((m) => !isByeMatch(m) && m.status === "complete");
  const orderedVoting = useMemo(() => {
    if (globalPageInfo) return voting;
    const arranged = arrangeWithCatSpacing(voting, 10);
    if (arranged.length <= 1) return arranged;

    const scored = arranged.map((m) => {
      const [aPct, bPct] = getVotePercent(m.votes_a, m.votes_b);
      const margin = Math.abs(aPct - bPct);
      const energy = computeMatchEnergy(m, 0);
      const tension = margin < 15 || energy >= 45 || !!m.is_close_match;
      return { m, margin, energy, tension };
    });

    // Main arena favors tension-heavy close matches at the top.
    if ((arena.type === 'main' || hotMatchBiasEnabled) && arena.type !== 'rookie') {
      const tense = scored.filter((x) => x.tension).sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin));
      const rest = scored.filter((x) => !x.tension).sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin));
      return [...tense, ...rest].map((x) => x.m);
    }

    // Rookie arena leans lower tension/wider margins so it feels distinct.
    if (arena.type === 'rookie') {
      return scored.sort((a, b) => (b.margin - a.margin) || (a.energy - b.energy)).map((x) => x.m);
    }

    return scored.sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin)).map((x) => x.m);
  }, [arena.type, globalPageInfo, hotMatchBiasEnabled, voting]);

  const votingById = useMemo(() => new Map(orderedVoting.map((m) => [m.match_id, m])), [orderedVoting]);
  const resultsList = useMemo(() => results.slice(0, MAX_VISIBLE), [results]);
  const activeVoting = useMemo(
    () =>
      stackIds
        .map((id) => votingById.get(id))
        .filter((m): m is ArenaMatch => !!m)
        .filter((m) => !votedMatches[m.match_id]),
    [stackIds, votingById, votedMatches]
  );
  const activeList = segment === "voting" ? activeVoting : resultsList;

  function pullNextMatchId(excluded: Set<string>): string | null {
    for (let i = cursorRef.current; i < orderedVoting.length; i += 1) {
      const id = orderedVoting[i]?.match_id;
      if (!id) continue;
      if (excluded.has(id)) continue;
      if (votedMatches[id]) continue;
      cursorRef.current = i + 1;
      setCursor(i + 1);
      return id;
    }
    return null;
  }

  function fillStackToFour(seed: string[]): string[] {
    const next = [...seed];
    const excluded = new Set(next);
    Object.keys(votedMatches).forEach((id) => excluded.add(id));
    while (next.length < MAX_VISIBLE) {
      const id = pullNextMatchId(excluded);
      if (!id) break;
      next.push(id);
      excluded.add(id);
    }
    return next;
  }

  function replaceCard(matchId: string) {
    setStackIds((prev) => {
      const index = prev.indexOf(matchId);
      if (index < 0) return fillStackToFour(prev);
      const next = [...prev];
      next.splice(index, 1);
      return fillStackToFour(next);
    });
  }

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (segment !== 'voting') {
      setStackReady(false);
      return;
    }
  }, [segment]);

  useEffect(() => {
    if (segment !== 'voting') return;
    const votedSet = new Set(Object.keys(votedMatches));
    const initial: string[] = [];
    let i = 0;
    for (; i < orderedVoting.length && initial.length < MAX_VISIBLE; i += 1) {
      const id = orderedVoting[i]?.match_id;
      if (!id || votedSet.has(id)) continue;
      initial.push(id);
    }
    cursorRef.current = i;
    setCursor(i);
    setExitingId(null);
    setStackIds(initial);
    setStackReady(true);
    firstPageIdsRef.current = initial;
    processedVotedRef.current = new Set(
      orderedVoting.map((m) => m.match_id).filter((id) => votedSet.has(id))
    );
  }, [arena.tournament_id, orderedVoting, segment, votedMatches]);

  useEffect(() => {
    if (segment !== 'voting') return;
    if (exitingId) return;
    const newlyVotedVisible = stackIds.find((id) => votedMatches[id] && !processedVotedRef.current.has(id));
    if (!newlyVotedVisible) return;
    processedVotedRef.current.add(newlyVotedVisible);
    setExitingId(newlyVotedVisible);
    window.setTimeout(() => {
      replaceCard(newlyVotedVisible);
      setExitingId((current) => (current === newlyVotedVisible ? null : current));
    }, 150);
  }, [exitingId, segment, stackIds, votedMatches]);

  useEffect(() => {
    if (!globalPageInfo) return;
    if (segment !== 'results') return;
    let alive = true;
    fetch(`/api/arena/pages?arena=${encodeURIComponent(String(arena.type || 'main'))}&tab=results&page=${globalPageInfo.pageIndex}`, { cache: 'no-store' })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (!alive) return;
        if (data?.ok && Array.isArray(data.matches)) {
          setGlobalResults(data.matches as ArenaMatch[]);
        } else {
          setGlobalResults([]);
        }
      })
      .catch(() => {
        if (alive) setGlobalResults([]);
      });
    return () => {
      alive = false;
    };
  }, [arena.type, globalPageInfo?.pageIndex, segment]);

  useEffect(() => {
    if (segment !== 'voting') return;
    if (exitingId) return;
    const hasVotedCardsInStack = stackIds.some((id) => !!votedMatches[id]);
    if (!hasVotedCardsInStack) return;
    setStackIds((prev) => fillStackToFour(prev.filter((id) => !votedMatches[id])));
  }, [exitingId, segment, stackIds, votedMatches]);

  useEffect(() => {
    if (segment !== 'voting') return;
    const topped = fillStackToFour(stackIds);
    if (topped.length !== stackIds.length) {
      setStackIds(topped);
    }
  }, [segment, stackIds, votedMatches, orderedVoting]);

  const arenaFeed = useArenaMatches({
    arenaType: String(arena.type || 'main'),
    viewMode: segment,
    pageIndex: Number(globalPageInfo?.pageIndex || 0),
    round: Number(arena.current_round || 1),
    matches: activeVoting,
    enabled: segment === 'voting' && stackReady && !votingMatch && !exitingId && activeVoting.length === 0,
    onRefresh: onRequestMore,
  });

  const stackLead = activeVoting[0];
  const stackSecond = activeVoting[1];
  const stackVelocity = useMemo(() => {
    const base = [stackLead, stackSecond].filter((m): m is ArenaMatch => !!m);
    if (!base.length) return null;
    const total = base.reduce((sum, m) => sum + Number(m.votes_a || 0) + Number(m.votes_b || 0), 0);
    return `+${Math.max(0, Math.round(total / 2))} votes in this cycle`;
  }, [stackLead, stackSecond]);

  return (
    <div className="rounded-3xl bg-white/[0.03] shadow-[0_10px_25px_rgba(0,0,0,0.25)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={config.accent}>{config.icon}</span>
          <h3 className="text-base font-semibold">{config.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {globalPageInfo && (
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-white/85">
              Global Page {globalPageInfo.pageIndex + 1}/{Math.max(1, globalPageInfo.totalPages)}
            </span>
          )}
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-white/80">Round {arena.current_round}</span>
        </div>
      </div>
      {globalPageInfo && (
        <div className="mb-2 flex items-center justify-between text-[10px] text-white/60">
          <span>{Math.max(0, Number(globalPageInfo.activeVoters10m || 0))} Vuxsolians voting here</span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${globalPageInfo.livePulseAt && Date.now() - globalPageInfo.livePulseAt < 3500 ? 'bg-emerald-300' : 'bg-white/30'}`} />
            Live updates
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["voting", "results"] as const).map((s) => (
          <button
            key={`${arena.tournament_id}-${s}`}
            onClick={() => setSegment(s)}
            className={`h-10 rounded-full text-xs font-semibold capitalize ${segment === s ? "bg-white text-black" : "bg-white/8 text-white/80"}`}
          >
            {s === "voting" ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Voting Now
              </span>
            ) : s}
          </button>
        ))}
      </div>

      {segment === 'voting' && stackVelocity && (
        <p className="text-[10px] text-white/50 mb-2">{stackVelocity}</p>
      )}
      {segment === 'voting' && arenaFeed.isRefilling && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-cyan-200/80 animate-pulse">
            Refilling arena... {arenaFeed.retryAttempt > 0 ? `(retry ${arenaFeed.retryAttempt}/3)` : ''}
          </p>
          {arenaFeed.showManualRefresh && (
            <button
              onClick={() => void arenaFeed.refresh()}
              className="h-7 px-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 text-[10px] font-semibold text-cyan-100"
            >
              Refresh
            </button>
          )}
        </div>
      )}
      {segment === 'voting' && voteStreak >= 5 && (
        <p className="text-[10px] text-amber-200/90 mb-2">
          {voteStreak >= 10 ? '⚡ Chaos Agent unlocked' : `🔥 You're on a roll (${voteStreak} votes)`}
        </p>
      )}

      {activeList.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] p-6 text-center">
          <Target className="w-7 h-7 text-white/40 mx-auto mb-2" />
          {segment === 'voting' ? (
            <>
              <p className="text-sm text-cyan-200/85">
                {arenaFeed.isLoading ? 'Loading arena...' : arenaFeed.error ? 'Arena is reloading' : 'Refilling arena...'}
              </p>
              <p className="text-xs text-white/45 mt-1">
                {arenaFeed.error ? `No live matchups yet. Try refresh or return at next Pulse (${pulseCountdown || '--:--:--'}).` : 'Checking for the next live matchups.'}
              </p>
              {(arenaFeed.showManualRefresh || arenaFeed.error) && (
                <button
                  onClick={() => void arenaFeed.refresh()}
                  className="mt-2 h-8 px-3 rounded-lg border border-cyan-300/35 bg-cyan-500/10 text-[11px] font-semibold text-cyan-100"
                >
                  Refresh
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-white/70">No results matchups yet.</p>
              <p className="text-xs text-white/45 mt-1">Check back shortly. New pairs roll in automatically.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activeList.map((match) => (
            <MatchCard
              key={match.match_id}
              match={match}
              voted={votedMatches[match.match_id] || null}
              isVoting={votingMatch === match.match_id}
              predictBusy={predictBusyMatch === match.match_id}
              calloutBusy={calloutBusyMatch === match.match_id}
              socialEnabled={socialEnabled}
              availableSigils={availableSigils}
              voteStreak={voteStreak}
              isExiting={segment === 'voting' && exitingId === match.match_id}
              voteEffectSlug={voteEffectSlug || null}
              onVote={(matchId, catId) => {
                if (segment === 'voting' && !exitingId) {
                  setExitingId(matchId);
                  window.setTimeout(() => {
                    replaceCard(matchId);
                    setExitingId((current) => (current === matchId ? null : current));
                  }, 150);
                }
                onVote(matchId, catId);
              }}
              onPredict={onPredict}
              onCreateCallout={onCreateCallout}
            />
          ))}
          {arena.status === "complete" && arena.champion && (
            <div className="mt-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden">
                <img src={getCatImage(arena.champion)} alt={arena.champion.name} className="w-full h-full object-cover object-center" />
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <Link href={`/cat/${arena.champion.id}`} className="font-bold text-yellow-300 hover:underline">{arena.champion.name}</Link>
                </div>
                <p className="text-xs text-white/45">Tournament Champion</p>
              </div>
            </div>
          )}
          <div className="text-xs text-white/35 px-1">{config.description}</div>
        </div>
      )}
    </div>
  );
}

// ── API Helpers ──
async function fetchUserState() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 2600) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArenas(options?: { refresh?: boolean }): Promise<{ arenas: Arena[]; votedMatches: Record<string, string> }> {
  try {
    const refreshFlag = options?.refresh ? '?refresh=1' : '';
    const res = await fetchWithTimeout(`/api/tournament/active${refreshFlag}`, { cache: "no-store" }, 2600);
    const data = await res.json();
    return { arenas: data.arenas || [], votedMatches: data.voted_matches || {} };
  } catch {
    return { arenas: [], votedMatches: {} };
  }
}

async function fetchArenaPage(arena: "main" | "rookie", page: number, tab: "voting" | "results" = "voting") {
  const res = await fetch(`/api/arena/pages?arena=${arena}&page=${Math.max(0, page)}&tab=${tab}`, { cache: "no-store" });
  return await res.json().catch(() => null);
}

async function fetchArenaProgress(arena: "main" | "rookie") {
  const res = await fetch(`/api/arena/progress?arena=${arena}`, { cache: "no-store" });
  return await res.json().catch(() => null);
}

async function persistArenaProgress(arena: "main" | "rookie", pageIndex: number, votedMatchIds: string[]) {
  await fetch('/api/arena/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      arena,
      pageIndex: Math.max(0, pageIndex),
      withinPageOffset: votedMatchIds.length,
      votedMatchIds,
    }),
  }).catch(() => null);
}

async function fetchHomeDashboard() {
  try {
    const res = await fetch('/api/home/dashboard', { cache: 'no-store' });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function apiClaimCrate() {
  try {
    const res = await fetch("/api/crate/claim", { method: "POST", headers: { "Content-Type": "application/json" } });
    return await res.json();
  } catch (e) { return { error: e instanceof Error ? e.message : "Error" }; }
}

// ── Main Page ──
export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [predictBusyMatch, setPredictBusyMatch] = useState<string | null>(null);
  const [calloutBusyMatch, setCalloutBusyMatch] = useState<string | null>(null);
  const [claimingCrate, setClaimingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [showClaimNamePrompt, setShowClaimNamePrompt] = useState(false);
  const [guestId, setGuestId] = useState<string>("");
  const [flame, setFlame] = useState<ArenaFlame | null>(null);
  const [socialLoopEnabled, setSocialLoopEnabled] = useState(false);
  const [crossMode, setCrossMode] = useState<{
    enabled?: boolean;
    main_to_whisker?: { eligible: boolean; claimed: boolean; votes_today?: number; votes_needed?: number };
    whisker_to_main?: { eligible: boolean; claimed: boolean };
  } | null>(null);
  const [challengeIntro, setChallengeIntro] = useState<null | {
    code: string;
    owner_username?: string | null;
    active: boolean;
    seconds_left: number;
  }>(null);
  const [spotlights, setSpotlights] = useState<{
    hall_of_fame: null | { note?: string | null; tagline?: string | null; theme?: string | null; expires_in_hours?: number | null; cat: { id: string; name: string; rarity: string; owner_username?: string | null; image_url?: string | null } | null };
    cat_of_week: null | { note?: string | null; tagline?: string | null; theme?: string | null; expires_in_hours?: number | null; cat: { id: string; name: string; rarity: string; owner_username?: string | null; image_url?: string | null } | null };
  }>({ hall_of_fame: null, cat_of_week: null });
  const [gettingStarted, setGettingStarted] = useState<{
    title: string;
    rank_label: string;
    subtitle?: string;
    missions: StarterMission[];
    progress: { completed: number; total: number; pct: number };
    current_mission_key: string | null;
    completion: { complete: boolean; badge_unlocked: boolean; bonus_xp: number };
    runtime_rewards?: { xp_awarded_now?: number; cat_xp_banked_now?: number };
  } | null>(null);
  const [missionBoardOpen, setMissionBoardOpen] = useState(false);
  const [openMissionKey, setOpenMissionKey] = useState<string | null>(null);
  const [arenaTypeTab, setArenaTypeTab] = useState<'main' | 'rookie'>('main');
  const [pendingDuelCount, setPendingDuelCount] = useState(0);
  const [liveDuels, setLiveDuels] = useState<DuelRow[]>([]);
  const [liveDuelVotes2m, setLiveDuelVotes2m] = useState(0);
  const missionToastKeyRef = useRef<string>('');
  const missionNudgeKeyRef = useRef<string>('');
  const [missionNudge, setMissionNudge] = useState<null | { key: string; title: string; cta: string; href: string }>(null);
  const [crateCountdown, setCrateCountdown] = useState('00:00:00');
  const [crateMeta, setCrateMeta] = useState<null | {
    rarity_tier?: string;
    near_miss_tier?: string;
    secondary_reward_applied?: boolean;
    pity_status?: {
      streak_without_epic_plus?: number;
      streak_without_legendary_plus?: number;
      streak_without_god?: number;
    };
  }>(null);
  const [hudPulseKey, setHudPulseKey] = useState('');
  const [displayStats, setDisplayStats] = useState({ streak: 0, xp: 0, sigils: 0, pred: 0 });
  const [hudCompact, setHudCompact] = useState(false);
  const [hudDetail, setHudDetail] = useState<null | { title: string; detail: string }>(null);
  const [dailyRewardSplash, setDailyRewardSplash] = useState<null | {
    day: number;
    sigils: number;
    nextHint: string;
  }>(null);
  const [showBookmarkMissionBanner, setShowBookmarkMissionBanner] = useState(false);
  const [bookmarkMissionBusy, setBookmarkMissionBusy] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const bookmarkMissionToastRef = useRef<string>('');
  const [voteStreak, setVoteStreak] = useState(0);
  const [lastVoteAtMs, setLastVoteAtMs] = useState<number | null>(null);
  const [pulseCountdown, setPulseCountdown] = useState('00:00:00');
  const [pulseSecondsRemaining, setPulseSecondsRemaining] = useState(0);
  const [pulseRecap, setPulseRecap] = useState<string | null>(null);
  const [launchSpotlight, setLaunchSpotlight] = useState<{ title: string; subtitle: string; cta_href: string } | null>(null);
  const [launchSocialProofLine, setLaunchSocialProofLine] = useState<string | null>(null);
  const [recruitPushEnabled, setRecruitPushEnabled] = useState(false);
  const [hotMatchBiasEnabled, setHotMatchBiasEnabled] = useState(true);
  const [clutchSharePromptEnabled, setClutchSharePromptEnabled] = useState(true);
  const [clutchSharePrompt, setClutchSharePrompt] = useState<{ text: string; href: string } | null>(null);
  const [equippedCosmetics, setEquippedCosmetics] = useState<{ title?: { slug?: string | null } | null; border?: { slug?: string | null } | null; color?: { slug?: string | null } | null; vote_effect?: { slug?: string | null } | null }>({});
  const [globalPageInfo, setGlobalPageInfo] = useState<Record<'main' | 'rookie', GlobalArenaPageInfo>>({
    main: { dayKey: '', pageIndex: 0, pageSize: 16, totalPages: 1, activeVoters10m: 0, livePulseAt: null },
    rookie: { dayKey: '', pageIndex: 0, pageSize: 16, totalPages: 1, activeVoters10m: 0, livePulseAt: null },
  });
  const pageMatchIdsRef = useRef<Record<'main' | 'rookie', string[]>>({ main: [], rookie: [] });
  const pollSinceRef = useRef<Record<'main' | 'rookie', number>>({ main: 0, rookie: 0 });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'landing_view', payload: { route: '/' } }),
    }).catch(() => null);
  }, []);
  useEffect(() => {
    if (!launchSpotlight) return;
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'launch_spotlight_shown', payload: { title: launchSpotlight.title } }),
    }).catch(() => null);
  }, [launchSpotlight?.title]);
  useEffect(() => {
    if (!recruitPushEnabled) return;
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'recruit_push_seen', payload: { route: '/' } }),
    }).catch(() => null);
  }, [recruitPushEnabled]);
  useEffect(() => {
    if (!progress) return;
    const animateTo = (field: 'streak' | 'xp' | 'sigils' | 'pred', target: number) => {
      const start = displayStats[field];
      const diff = target - start;
      if (diff === 0) return;
      const duration = 260;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(start + diff * eased);
        setDisplayStats((prev) => ({ ...prev, [field]: val }));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    animateTo('streak', Number(progress.currentStreak || 0));
    animateTo('xp', Number(progress.xp || 0));
    animateTo('sigils', Number(progress.sigils || 0));
    animateTo('pred', Number(progress.predictionStreak || 0));
    setHudPulseKey(`${progress.currentStreak}:${progress.xp}:${progress.sigils}:${progress.predictionStreak}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.currentStreak, progress?.xp, progress?.sigils, progress?.predictionStreak]);
  useEffect(() => {
    const onScroll = () => setHudCompact(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
  }, []);
  useEffect(() => {
    const key = gettingStarted?.current_mission_key || '';
    if (key !== 'bookmark_home') {
      setShowBookmarkMissionBanner(false);
      return;
    }

    if (bookmarkMissionToastRef.current === key) return;
    bookmarkMissionToastRef.current = key;
    setShowBookmarkMissionBanner(true);
    const timer = window.setTimeout(() => setShowBookmarkMissionBanner(false), 6500);
    return () => window.clearTimeout(timer);
  }, [gettingStarted?.current_mission_key]);
  useEffect(() => {
    if (!missionNudge) return;
    const timer = window.setTimeout(() => setMissionNudge(null), 7000);
    return () => window.clearTimeout(timer);
  }, [missionNudge]);
  useEffect(() => {
    if (!hudDetail) return;
    const timer = window.setTimeout(() => setHudDetail(null), 3600);
    return () => window.clearTimeout(timer);
  }, [hudDetail]);
  useEffect(() => {
    if (!challengeIntro) return;
    const timer = window.setTimeout(() => setChallengeIntro(null), 8500);
    return () => window.clearTimeout(timer);
  }, [challengeIntro]);
  useEffect(() => {
    if (!clutchSharePrompt) return;
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'clutch_share_prompt_shown', payload: { text: clutchSharePrompt.text } }),
    }).catch(() => null);
    const timer = window.setTimeout(() => setClutchSharePrompt(null), 8000);
    return () => window.clearTimeout(timer);
  }, [clutchSharePrompt]);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const ms = Math.max(0, next.getTime() - now.getTime());
      const total = Math.floor(ms / 1000);
      setPulseSecondsRemaining(total);
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      setCrateCountdown(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const ms = Math.max(0, next.getTime() - now.getTime());
      const total = Math.floor(ms / 1000);
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      setPulseCountdown(`${h}:${m}:${s}`);
      if (lastVoteAtMs && Date.now() - lastVoteAtMs > 60000 && voteStreak !== 0) {
        setVoteStreak(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastVoteAtMs, voteStreak]);
  useEffect(() => {
    const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const ref = qp ? String(qp.get('ref') || '').trim() : '';
    const guild = qp ? String(qp.get('guild') || '').trim().toLowerCase() : '';
    const pitch = qp ? String(qp.get('pitch') || '').trim() : '';
    const campaignTag = qp ? String(qp.get('campaign_tag') || '').trim() : '';
    const referralCode = qp ? String(qp.get('code') || '').trim() : '';
    if (!ref) return;
    fetch('/api/referral/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref,
        guild: guild === 'sun' || guild === 'moon' ? guild : undefined,
        pitch: pitch || undefined,
        campaign_tag: campaignTag || undefined,
        referral_code: referralCode || undefined,
      }),
    }).then((r) => r.json().catch(() => null)).then((d) => {
      if (d?.ok && !d?.already_tracked) {
        showToast(`Referral bonus: +${d.visitor_bonus || 0} sigils`);
        loadAll();
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const challenge = typeof window !== 'undefined'
      ? String(new URLSearchParams(window.location.search).get('challenge') || '').trim()
      : '';
    if (!challenge) return;
    fetch(`/api/social/challenge?code=${encodeURIComponent(challenge)}`, { cache: 'no-store' })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.ok && d?.challenge) {
          setChallengeIntro({
            code: String(d.challenge.ref_code || challenge),
            owner_username: d.challenge.owner_username || null,
            active: !!d.challenge.active,
            seconds_left: Number(d.challenge.seconds_left || 0),
          });
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const tick = async () => {
      const duel = await fetch('/api/duel/challenges', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
      if (!duel?.ok) return;
      const open = Array.isArray(duel.open) ? duel.open : [];
      const top = open
        .filter((d: DuelRow) => !!d?.challenger_cat?.id && !!d?.challenged_cat?.id)
        .sort((a: DuelRow, b: DuelRow) => Number(b?.votes?.total || 0) - Number(a?.votes?.total || 0))
        .slice(0, 5);
      setLiveDuels(top);
      setLiveDuelVotes2m(Number(duel?.recent_votes_2m || 0));
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  const activeVotersNow = Math.max(0, Number(globalPageInfo[arenaTypeTab]?.activeVoters10m || 0));

  function applyPageMatchesToArenas(current: Arena[], arenaType: 'main' | 'rookie', matches: ArenaMatch[]): Arena[] {
    return current.map((a) => {
      if (a.type !== arenaType) return a;
      const round = Number(a.current_round || 1);
      return {
        ...a,
        rounds: [{ round, matches }],
      };
    });
  }

  async function loadGlobalPage(arenaType: 'main' | 'rookie', pageIndex: number, opts?: { dayKey?: string; persist?: boolean }) {
    const data = await fetchArenaPage(arenaType, pageIndex, 'voting');
    if (!data?.ok) return false;
    const matches = Array.isArray(data.matches) ? (data.matches as ArenaMatch[]) : [];
    setArenas((prev) => applyPageMatchesToArenas(prev, arenaType, matches));
    pageMatchIdsRef.current[arenaType] = matches.map((m) => m.match_id);
    pollSinceRef.current[arenaType] = Date.now();
    setGlobalPageInfo((prev) => ({
      ...prev,
      [arenaType]: {
        dayKey: String(data.dayKey || opts?.dayKey || ''),
        pageIndex: Number(data.pageIndex || 0),
        pageSize: Number(data.pageSize || 16),
        totalPages: Math.max(1, Number(data.totalPages || 1)),
        activeVoters10m: Math.max(0, Number(data.activeVoters10m || 0)),
        livePulseAt: prev[arenaType].livePulseAt,
      },
    }));
    if (opts?.persist !== false) {
      try {
        localStorage.setItem(`arena_page_idx:${arenaType}`, String(Math.max(0, Number(data.pageIndex || 0))));
      } catch {
        // ignore
      }
    }
    return true;
  }

  async function initializeGlobalPages() {
    const dayKey = new Date().toISOString().slice(0, 10);
    const arenaTypes: Array<'main' | 'rookie'> = ['main', 'rookie'];
    for (const arenaType of arenaTypes) {
      let startPage = 0;
      try {
        const pg = await fetchArenaProgress(arenaType);
        const serverPage = Number(pg?.progress?.page_index ?? 0);
        const serverDay = String(pg?.progress?.day_key || '');
        const localPage = Number(localStorage.getItem(`arena_page_idx:${arenaType}`) || 0);
        if (serverDay === dayKey) startPage = Math.max(0, serverPage);
        else startPage = Math.max(0, localPage);
      } catch {
        startPage = 0;
      }
      await loadGlobalPage(arenaType, startPage, { dayKey, persist: true });
    }
  }

  function persistCurrentArenaProgress(arenaType: 'main' | 'rookie', votedMap: Record<string, string>) {
    const info = globalPageInfo[arenaType];
    const matchIds = pageMatchIdsRef.current[arenaType] || [];
    const votedIds = matchIds.filter((id) => !!votedMap[id]);
    persistArenaProgress(arenaType, info.pageIndex, votedIds).catch(() => null);
  }

  async function loadAll() {
    setLoading(true);
    const [userData, arenaData, homeData] = await Promise.all([fetchUserState(), fetchArenas(), fetchHomeDashboard()]);
    if (!userData.error) {
      setMeError(null);
      setGuestId(userData.guest_id || "");
      setFlame(userData.data?.flame || null);
      setProgress({
        xp: userData.data?.progress?.xp || 0,
        level: userData.data?.progress?.level || 1,
        currentStreak: userData.data?.flame?.dayCount || userData.data?.streak?.current_streak || 0,
        sigils: userData.data?.progress?.sigils || 0,
        predictionStreak: userData.data?.prediction_streak || 0,
        catXpPool: Number(userData.data?.cat_xp_pool || 0),
      });
      setHasCredentials(!!userData.data?.has_credentials);
      setEquippedCosmetics((userData.data?.equipped_cosmetics || {}) as any);
      const daily = await fetch('/api/rewards/daily-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json().catch(() => null)).catch(() => null);
      if (daily?.ok && !daily?.already_claimed) {
        setProgress((p) => p ? { ...p, sigils: Number(daily.sigils_after ?? (p.sigils + Number(daily.sigils_awarded || 0))) } : p);
        setDailyRewardSplash({
          day: Math.max(1, Number(daily.day || 1)),
          sigils: Math.max(0, Number(daily.sigils_awarded || 20)),
          nextHint: String(daily.next_hint || 'Come back tomorrow for a Rare Crate.'),
        });
      }
    } else {
      setMeError(String(userData.error || 'Failed to load Arena Flame'));
      setFlame(null);
    }
    setArenas(arenaData.arenas);
    setVotedMatches(arenaData.votedMatches);
    setLoading(false);
    void initializeGlobalPages();
    const gs = await fetch("/api/rewards/getting-started", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null);
    if (gs?.ok) {
      setGettingStarted(gs);
      const newlyCompleted = Array.isArray(gs?.runtime_rewards?.newly_completed_keys) ? gs.runtime_rewards.newly_completed_keys : [];
      const xpAwarded = Number(gs?.runtime_rewards?.xp_awarded_now || 0);
      const banked = Number(gs?.runtime_rewards?.cat_xp_banked_now || 0);
      if (xpAwarded > 0 || banked > 0) {
        const refreshed = await fetchUserState();
        if (!refreshed.error) {
          setFlame(refreshed.data?.flame || null);
          setProgress({
            xp: refreshed.data?.progress?.xp || 0,
            level: refreshed.data?.progress?.level || 1,
            currentStreak: refreshed.data?.flame?.dayCount || refreshed.data?.streak?.current_streak || 0,
            sigils: refreshed.data?.progress?.sigils || 0,
            predictionStreak: refreshed.data?.prediction_streak || 0,
            catXpPool: Number(refreshed.data?.cat_xp_pool || 0),
          });
        }
        const key = `${xpAwarded}:${banked}:${gs?.progress?.completed || 0}`;
        if (missionToastKeyRef.current !== key) {
          missionToastKeyRef.current = key;
          showToast(`Mission rewards: +${xpAwarded} XP${banked > 0 ? ` · +${banked} Cat XP` : ''}`);
        }
      }
      if (newlyCompleted.length > 0 && gs?.current_mission_key) {
        const nextMission = (gs?.missions || []).find((m: StarterMission) => m.key === gs.current_mission_key && m.status === 'active');
        if (nextMission) {
          const nudgeKey = `${newlyCompleted.join(',')}:${nextMission.key}:${gs?.progress?.completed || 0}`;
          if (missionNudgeKeyRef.current !== nudgeKey) {
            missionNudgeKeyRef.current = nudgeKey;
            setMissionNudge({
              key: nextMission.key,
              title: nextMission.title,
              cta: nextMission.cta,
              href: nextMission.cta_href,
            });
          }
        }
      }
    }
    const sp = await fetch('/api/spotlights', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
    if (sp?.ok) setSpotlights({ hall_of_fame: sp.hall_of_fame || null, cat_of_week: sp.cat_of_week || null });
    if (homeData?.ok) {
      setLaunchSpotlight(homeData?.launch?.spotlight || null);
      setLaunchSocialProofLine(String(homeData?.launch?.social_proof_line || '').trim() || null);
      setRecruitPushEnabled(!!homeData?.launch?.recruit_push_enabled);
      setHotMatchBiasEnabled(!!homeData?.launch?.hot_match_bias_enabled);
      setClutchSharePromptEnabled(!!homeData?.launch?.clutch_share_prompt_enabled);
    }
    const rv = await fetch('/api/social/rivalries', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
    setSocialLoopEnabled(!!(rv?.ok && rv?.enabled));
    const cm = await fetch('/api/cross-mode/status', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
    setCrossMode(cm?.ok ? cm : null);
    const duel = await fetch('/api/duel/challenges', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
    if (duel?.ok && Array.isArray(duel.incoming)) {
      const pending = duel.incoming.filter((d: { status?: string | null }) => String(d?.status || '').toLowerCase() === 'pending').length;
      setPendingDuelCount(pending);
      const open = Array.isArray(duel.open) ? duel.open : [];
      const top = open
        .filter((d: DuelRow) => !!d?.challenger_cat?.id && !!d?.challenged_cat?.id)
        .sort((a: DuelRow, b: DuelRow) => Number(b?.votes?.total || 0) - Number(a?.votes?.total || 0))
        .slice(0, 5);
      setLiveDuels(top);
      setLiveDuelVotes2m(Number(duel?.recent_votes_2m || 0));
    } else {
      setPendingDuelCount(0);
      setLiveDuels([]);
      setLiveDuelVotes2m(0);
    }
    setLoading(false);

    // Show compact recap once per 4h UTC pulse window.
    try {
      const now = new Date();
      const bucket = `${now.toISOString().slice(0, 10)}:${Math.floor(now.getUTCHours() / 4)}`;
      const key = 'pulse_recap_seen_bucket';
      const last = localStorage.getItem(key);
      if (last !== bucket) {
        localStorage.setItem(key, bucket);
        const nextAction = (userData.data?.progress?.sigils || 0) > 0 ? 'Pulse just hit. Place prediction or vote hot matches.' : 'Pulse just hit. Vote a hot match now.';
        setPulseRecap(nextAction);
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'pulse_recap_shown', payload: { bucket } }),
        }).catch(() => null);
      }
    } catch {
      // ignore localStorage issues
    }
  }

  async function refreshGettingStarted() {
    const gs = await fetch("/api/rewards/getting-started", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null);
    if (!gs?.ok) return;
    setGettingStarted(gs);
    const newlyCompleted = Array.isArray(gs?.runtime_rewards?.newly_completed_keys) ? gs.runtime_rewards.newly_completed_keys : [];
    if (newlyCompleted.length > 0 && gs?.current_mission_key) {
      const nextMission = (gs?.missions || []).find((m: StarterMission) => m.key === gs.current_mission_key && m.status === 'active');
      if (nextMission) {
        const nudgeKey = `${newlyCompleted.join(',')}:${nextMission.key}:${gs?.progress?.completed || 0}`;
        if (missionNudgeKeyRef.current !== nudgeKey) {
          missionNudgeKeyRef.current = nudgeKey;
          setMissionNudge({
            key: nextMission.key,
            title: nextMission.title,
            cta: nextMission.cta,
            href: nextMission.cta_href,
          });
        }
      }
    }
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatch || votedMatches[matchId]) return;
    setVotingMatch(matchId);
    setError(null);
    try {
      const r = await fetch("/api/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.error || "Vote failed";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate")) {
          setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
        }
        showToast(msg);
      } else {
        const nowMs = Date.now();
        setVoteStreak((prev) => {
          const next = !lastVoteAtMs || (nowMs - lastVoteAtMs > 60000) ? 1 : prev + 1;
          if (next === 3 || next === 5 || next === 10) {
            const label = next === 3 ? 'Clutch Voter x3' : `Vote streak x${next}`;
            showToast(label);
            fetch('/api/telemetry/event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'vote_streak_hit', payload: { count: next } }),
            }).catch(() => null);
          }
          if (next === 5) handleClutchSignal('🔥 5-vote streak');
          return next;
        });
        setLastVoteAtMs(nowMs);
        if (!hasCredentials) {
          try {
            const k = 'guest_vote_count';
            const current = Number(localStorage.getItem(k) || 0);
            const nextGuestVotes = current + 1;
            localStorage.setItem(k, String(nextGuestVotes));
            if (nextGuestVotes <= 2) {
              showToast(`🔥 Vote streak started: ${nextGuestVotes}/3`);
            }
            if (nextGuestVotes >= 1) {
              setShowClaimNamePrompt(true);
              window.setTimeout(() => setShowClaimNamePrompt(false), 5200);
            }
          } catch {
            setShowClaimNamePrompt(true);
          }
        }
        setVotedMatches((prev) => {
          const next = { ...prev, [matchId]: catId };
          const arenaType = arenas.find((a) =>
            (a.rounds || []).some((r) => (r.matches || []).some((m) => m.match_id === matchId))
          )?.type as 'main' | 'rookie' | undefined;
          if (arenaType === 'main' || arenaType === 'rookie') {
            persistCurrentArenaProgress(arenaType, next);
          }
          return next;
        });
        showToast(data?.message || "Vote recorded! +5 XP");
        setProgress((prev) => prev ? {
          ...prev,
          xp: prev.xp + Number(data?.xp_earned || 5),
          catXpPool: prev.catXpPool + Number(data?.cat_xp_banked || 0),
        } : null);
        // Keep voting flow stable: avoid full arena refetch on every vote.
        // Arena data refreshes when the current stack is exhausted.
        refreshGettingStarted();
      }
    } catch { showToast("Network error"); }
    setVotingMatch(null);
  }

  function showToast(msg: string) { showGlobalToast(msg, 5000); }

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      if (cancelled) return;
      const activeArena = arenaTypeTab;
      const info = globalPageInfo[activeArena];
      const isHidden = typeof document !== 'undefined' && document.hidden;
      const busy = !!(votingMatch || predictBusyMatch);
      const delay = isHidden || busy ? 6000 : 2000;

      if (!isHidden && info.dayKey) {
        const since = Math.max(0, Number(pollSinceRef.current[activeArena] || Date.now() - 3000));
        try {
          const res = await fetch(`/api/arena/updates?arena=${activeArena}&tab=voting&page=${info.pageIndex}&since=${since}`, { cache: 'no-store' });
          const data = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.updates)) {
            const updates = data.updates as Array<{ matchId: string; votesA: number; votesB: number }>;
            if (updates.length > 0) {
              const updateMap = new Map(updates.map((u) => [u.matchId, u]));
              setArenas((prev) => prev.map((arena) => {
                if (arena.type !== activeArena) return arena;
                return {
                  ...arena,
                  rounds: (arena.rounds || []).map((round) => ({
                    ...round,
                    matches: (round.matches || []).map((match) => {
                      const u = updateMap.get(match.match_id);
                      if (!u) return match;
                      return { ...match, votes_a: Number(u.votesA || 0), votes_b: Number(u.votesB || 0) };
                    }),
                  })),
                };
              }));
              setGlobalPageInfo((prev) => ({
                ...prev,
                [activeArena]: { ...prev[activeArena], livePulseAt: Date.now() },
              }));
            }
            pollSinceRef.current[activeArena] = Number(data.serverTime || Date.now());
          }
        } catch {
          // ignore transient polling errors
        }
      }
      if (!cancelled) timer = window.setTimeout(poll, delay);
    };

    timer = window.setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [
    arenaTypeTab,
    globalPageInfo.main.dayKey,
    globalPageInfo.main.pageIndex,
    globalPageInfo.rookie.dayKey,
    globalPageInfo.rookie.pageIndex,
    predictBusyMatch,
    votingMatch,
  ]);

  function handleClutchSignal(label: string) {
    if (!clutchSharePromptEnabled) return;
    try {
      if (sessionStorage.getItem('clutch_share_prompt_seen_v1') === '1') return;
      sessionStorage.setItem('clutch_share_prompt_seen_v1', '1');
    } catch {
      // ignore storage errors
    }
    setClutchSharePrompt({
      text: `Share this chaos? ${label}`,
      href: '/social',
    });
  }

  async function handleArenaStackRefill(arenaType?: 'main' | 'rookie'): Promise<ArenaRefreshResult> {
    const type = arenaType || arenaTypeTab;
    const current = globalPageInfo[type];
    const totalPages = Math.max(1, Number(current.totalPages || 1));
    const nextPage = (Math.max(0, Number(current.pageIndex || 0)) + 1) % totalPages;
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'arena_fetch_start', payload: { arena: type, page: nextPage, tab: 'voting' } }),
    }).catch(() => null);
    const loaded = await loadGlobalPage(type, nextPage, { persist: true });
    if (!loaded) {
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'arena_refill_failed', payload: { arena: type, page: nextPage, tab: 'voting', reason: 'load_failed' } }),
      }).catch(() => null);
      return { ok: false, count: 0, status: 'failed' };
    }
    const count = Number(pageMatchIdsRef.current[type]?.length || 0);
    const votedIds = pageMatchIdsRef.current[type].filter((id) => !!votedMatches[id]);
    persistArenaProgress(type, nextPage, votedIds).catch(() => null);
    if (count > 0) {
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'arena_fetch_success', payload: { arena: type, page: nextPage, tab: 'voting', count } }),
      }).catch(() => null);
      return { ok: true, count, status: 'ok' };
    }
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'arena_fetch_empty', payload: { arena: type, page: nextPage, tab: 'voting' } }),
    }).catch(() => null);
    return { ok: true, count: 0, status: 'refilling' };
  }

  useEffect(() => {
    if (!gettingStarted) return;
    const key = gettingStarted.current_mission_key || gettingStarted.missions.find((m) => m.status === 'active')?.key || gettingStarted.missions[0]?.key || null;
    setOpenMissionKey(key);
  }, [gettingStarted?.current_mission_key]);

  useEffect(() => {
    if (!openMissionKey) return;
    const node = document.getElementById(`mission-${openMissionKey}`);
    if (node && missionBoardOpen) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [openMissionKey, missionBoardOpen]);

  async function handlePredict(matchId: string, catId: string, bet: number) {
    if (predictBusyMatch) return;
    setPredictBusyMatch(matchId);
    try {
      const r = await fetch('/api/match/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, predicted_cat_id: catId, bet }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        showToast(data?.error || 'Prediction failed');
      } else {
        setProgress((p) => p ? { ...p, sigils: Number(data.sigils_after ?? p.sigils), predictionStreak: Number(data.current_streak ?? p.predictionStreak) } : p);
        showToast(`Prediction locked (-${bet})`);
        const updated = await fetchArenas();
        setArenas(updated.arenas);
        setVotedMatches((prev) => ({ ...prev, ...updated.votedMatches }));
        refreshGettingStarted();
      }
    } catch {
      showToast("Network error");
    } finally {
      setPredictBusyMatch(null);
    }
  }

  async function handleCreateCallout(matchId: string, catId: string) {
    if (!matchId || !catId || calloutBusyMatch) return;
    setCalloutBusyMatch(matchId);
    try {
      const r = await fetch('/api/social/callout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, picked_cat_id: catId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        showToast(data?.error || 'Callout failed');
      } else {
        const shareUrl = data?.image_url ? `${window.location.origin}${data.image_url}` : window.location.href;
        const text = String(data?.share_text || 'Join me in CatBattle Arena');
        await navigator.clipboard.writeText(`${text} ${shareUrl}`);
        showToast('Callout copied');
      }
    } catch {
      showToast('Callout failed');
    } finally {
      setCalloutBusyMatch(null);
    }
  }

  async function handleVoteDuel(duelId: string, catId: string) {
    if (!duelId || !catId) return;
    try {
      const res = await fetch('/api/duel/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duel_id: duelId, voted_cat_id: catId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Duel vote failed');
        return;
      }
      showToast(data?.status === 'completed' ? 'Duel completed' : 'Duel vote recorded');
      const duel = await fetch('/api/duel/challenges', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
      if (duel?.ok && Array.isArray(duel.open)) {
        const top = duel.open
          .filter((d: DuelRow) => !!d?.challenger_cat?.id && !!d?.challenged_cat?.id)
          .sort((a: DuelRow, b: DuelRow) => Number(b?.votes?.total || 0) - Number(a?.votes?.total || 0))
          .slice(0, 5);
        setLiveDuels(top);
      }
    } catch {
      showToast('Duel vote failed');
    }
  }

  function resolveMissionHref(href: string): string {
    if (href === '/profile/me') return guestId ? `/profile/${guestId}` : '/profile';
    return href;
  }

  function runMissionCta(mission: StarterMission) {
    const target = resolveMissionHref(mission.cta_href || '');
    if (!target) return;
    if (target.startsWith('#')) {
      const el = document.getElementById(target.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(target);
  }

  function handleMissionPrimaryAction() {
    if (!gettingStarted) return;
    const active = gettingStarted.missions.find((m) => m.status === 'active');
    if (!active) return;
    runMissionCta(active);
  }

  async function handleClaimCrate() {
    if (claimingCrate) return;
    setClaimingCrate(true);
    const result = await apiClaimCrate();
    if (result.error) setError(result.error);
    else if (!result.success) setError(result.message || "Already claimed");
    else {
      setCrateMeta({
        rarity_tier: result?.rarity_tier,
        near_miss_tier: result?.near_miss_tier,
        secondary_reward_applied: !!result?.secondary_reward_applied,
        pity_status: result?.pity_status || null,
      });
      setProgress((p) => p ? {
        ...p,
        xp: p.xp + Number(result.xp_gained || 0),
        sigils: p.sigils + Number(result.sigils_gained || 0),
        catXpPool: p.catXpPool + Number(result.cat_xp_banked || 0),
      } : null);
      if (Number(result.cat_xp_banked || 0) > 0) {
        showToast(`Crate: +${result.cat_xp_banked} cat XP banked`);
      }
    }
    setClaimingCrate(false);
  }

  async function handleBookmarkMissionComplete() {
    if (bookmarkMissionBusy) return;
    setBookmarkMissionBusy(true);
    try {
      const res = await fetch('/api/rewards/home-bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Mission claim failed');
        return;
      }
      if (!data?.already_claimed && Number(data?.sigils_awarded || 0) > 0) {
        setProgress((p) => p ? { ...p, sigils: Number(data.sigils_after ?? (p.sigils + Number(data.sigils_awarded || 0))) } : p);
        showToast(`Mission complete: +${Number(data.sigils_awarded || 0)} sigils`);
      } else {
        showToast('Mission already completed');
      }
      await refreshGettingStarted();
    } catch {
      showToast('Mission claim failed');
    } finally {
      setBookmarkMissionBusy(false);
    }
  }

  async function handleAddToHomeScreen() {
    try {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        setDeferredInstallPrompt(null);
      } else {
        showToast('Use browser menu → Add to Home Screen');
      }
    } catch {
      showToast('Use browser menu → Add to Home Screen');
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-white/50" /></div>;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {showBookmarkMissionBanner && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-300/35 backdrop-blur text-cyan-100 text-xs font-semibold popup-linger">
          Mission: Add CatClash to your Home Screen. Reward: 50 Sigils.
        </div>
      )}
      {dailyRewardSplash && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-yellow-300/35 bg-gradient-to-b from-yellow-500/20 to-orange-500/10 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <p className="text-xs uppercase tracking-wider text-yellow-100/80 mb-2">Daily Chest</p>
            <div className="crate-hero mb-3">
              <div className="crate-visual opening">
                <div className="crate-lid" />
                <div className="crate-box" />
                <div className="crate-glow" />
              </div>
            </div>
            <p className="text-lg font-bold text-yellow-100">Day {dailyRewardSplash.day} Streak!</p>
            <p className="text-sm text-white/90 mt-1">
              You earned <span className="inline-flex items-center gap-1 font-bold"><SigilIcon className="w-4 h-4" />{dailyRewardSplash.sigils}</span>.
            </p>
            <p className="text-xs text-white/75 mt-1">{dailyRewardSplash.nextHint}</p>
            <button
              onClick={() => setDailyRewardSplash(null)}
              className="mt-4 h-10 px-4 rounded-xl bg-yellow-300 text-black text-sm font-bold"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {hudDetail && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm rounded-2xl border border-white/15 bg-black/85 backdrop-blur p-3">
          <p className="text-sm font-bold text-white">{hudDetail.title}</p>
          <p className="text-[11px] text-white/70 mt-1">{hudDetail.detail}</p>
          <button onClick={() => setHudDetail(null)} className="mt-2 h-8 px-3 rounded-lg bg-white/10 text-xs font-semibold">Close</button>
        </div>
      )}
      {missionNudge && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md rounded-2xl border border-emerald-300/35 bg-emerald-500/20 backdrop-blur p-3 shadow-[0_12px_35px_rgba(16,185,129,0.25)] popup-linger">
          <p className="text-sm font-bold text-emerald-100">Mission Complete. Continue?</p>
          <p className="text-[11px] text-emerald-100/85 mt-0.5">{missionNudge.title.replace(/^Mission \d+\s+—\s+/, '')}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                runMissionCta({ key: missionNudge.key, title: missionNudge.title, description: '', reward_xp: 0, cta: missionNudge.cta, cta_href: missionNudge.href, status: 'active' });
                setMissionNudge(null);
              }}
              className="h-9 px-3 rounded-lg bg-emerald-300 text-black text-xs font-bold"
            >
              {missionNudge.cta}
            </button>
            <button
              onClick={() => setMissionNudge(null)}
              className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-white/85 text-xs font-semibold"
            >
              Stay Here
            </button>
          </div>
        </div>
      )}
      {showClaimNamePrompt && !hasCredentials && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md rounded-2xl border border-emerald-300/35 bg-emerald-500/20 backdrop-blur p-3 shadow-[0_12px_35px_rgba(16,185,129,0.25)] popup-linger">
          <p className="text-sm font-bold text-emerald-100">Claim your Vuxsolian name</p>
          <p className="text-[11px] text-emerald-100/85 mt-0.5">Lock in rewards and keep your streak across devices.</p>
          <div className="mt-2 flex items-center gap-2">
            <Link href="/login?next=/" className="h-9 px-3 rounded-lg bg-emerald-300 text-black text-xs font-bold inline-flex items-center justify-center">
              Claim Name
            </Link>
            <button onClick={() => setShowClaimNamePrompt(false)} className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 text-white/85 text-xs font-semibold">
              Later
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="fixed top-16 left-0 right-0 z-30 hidden sm:block">
        <div className={`max-w-4xl mx-auto px-3 ${hudCompact ? 'pt-0.5' : 'pt-2'} transition-all duration-200`}>
          <div
            className={`rounded-2xl bg-neutral-950/94 backdrop-blur-xl shadow-[0_14px_34px_rgba(0,0,0,0.46)] transition-all duration-200 ${
              hudCompact ? 'p-1' : 'p-1.5'
            }`}
          >
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setHudDetail({ title: 'Battle Flame', detail: 'Consecutive daily battle participation.' })}
                className={`hud-capsule rounded-xl inline-flex flex-col items-start justify-center transition-all duration-200 ${
                  hudCompact ? 'h-9 px-2' : 'h-12 px-2.5'
                } ${hudPulseKey ? 'hud-pulse' : ''}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Flame className={`${hudCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-orange-400 ${displayStats.streak > 0 ? 'flame-flicker' : ''}`} />
                  <span className={`hud-value ${hudCompact ? 'text-xs' : 'text-sm'} font-extrabold text-white`}>{displayStats.streak}</span>
                </span>
                <span className={`${hudCompact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-wide text-white/55`}>Flame</span>
              </button>
              <button
                onClick={() => setHudDetail({ title: 'Energy', detail: `Energy ${displayStats.xp} · Level ${progress?.level || 1}` })}
                className={`hud-capsule rounded-xl inline-flex flex-col items-start justify-center transition-all duration-200 ${
                  hudCompact ? 'h-9 px-2' : 'h-12 px-2.5'
                } ${hudPulseKey ? 'hud-pulse' : ''}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Zap className={`${hudCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-yellow-300`} />
                  <span className={`hud-value ${hudCompact ? 'text-xs' : 'text-sm'} font-extrabold text-white`}>{displayStats.xp}</span>
                </span>
                <span className={`${hudCompact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-wide text-white/55`}>Energy</span>
              </button>
              <button
                onClick={() => setHudDetail({ title: 'Sigils', detail: 'Premium currency used for rerolls, crates, and cosmetics.' })}
                className={`hud-capsule rounded-xl inline-flex flex-col items-start justify-center transition-all duration-200 ${
                  hudCompact ? 'h-9 px-2' : 'h-12 px-2.5'
                } ${hudPulseKey ? 'hud-pulse' : ''}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <SigilIcon className={hudCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} glow />
                  <span className={`hud-value ${hudCompact ? 'text-xs' : 'text-sm'} font-extrabold text-cyan-100`}>{displayStats.sigils}</span>
                </span>
                <span className={`${hudCompact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-wide text-white/55`}>Sigils</span>
              </button>
              <button
                onClick={() => setHudDetail({ title: 'Prediction', detail: 'Correct winner predictions in a row.' })}
                className={`hud-capsule rounded-xl inline-flex flex-col items-start justify-center transition-all duration-200 ${
                  hudCompact ? 'h-9 px-2' : 'h-12 px-2.5'
                } ${hudPulseKey ? 'hud-pulse' : ''}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Crosshair className={`${hudCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-cyan-300 ${displayStats.pred > 0 ? 'animate-pulse' : ''}`} />
                  <span className={`hud-value ${hudCompact ? 'text-xs' : 'text-sm'} font-extrabold text-white`}>{displayStats.pred}</span>
                </span>
                <span className={`${hudCompact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-wide text-white/55`}>Predict</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-18 pb-2">
        <div className="max-w-2xl mx-auto px-3.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-yellow-500/25 bg-yellow-500/8 text-[10px]">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-200/95">Unbox. Battle. Evolve.</span>
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Today&apos;s Arenas</h1>
              <p className="text-[11px] text-white/55">Vote fast, stack streaks, and catch the next Pulse.</p>
            </div>
            <span className="vuxsolia-canon-line text-[10px] text-cyan-200/65">Vuxsolia</span>
          </div>
        </div>
      </section>

      {challengeIntro && (
        <section className="px-4 mb-4">
          <div className="max-w-2xl mx-auto rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4">
            <p className="text-sm font-bold text-fuchsia-100">48h Challenge</p>
            <p className="text-xs text-fuchsia-100/80 mt-1">
              {challengeIntro.owner_username ? `You joined @${challengeIntro.owner_username}'s challenge.` : 'You joined a 48h challenge link.'}
              {' '}Vote, predict, and battle in Whisker before the timer ends.
            </p>
            <p className="text-[11px] text-fuchsia-100/70 mt-2">
              Code: {challengeIntro.code} · {challengeIntro.active ? `${Math.floor(challengeIntro.seconds_left / 3600)}h left` : 'Expired'}
            </p>
          </div>
        </section>
      )}

      {error && (
        <section className="px-4 mb-4">
          <div className="max-w-md mx-auto p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>
        </section>
      )}

      <section className="px-3.5 mb-3">
        <div className="max-w-2xl mx-auto space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/7 px-2.5 py-1 text-[10px] text-white/85">
              <Flame className="w-3 h-3 text-orange-300" /> {displayStats.streak}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/7 px-2.5 py-1 text-[10px] text-white/85">
              <Zap className="w-3 h-3 text-yellow-300" /> {displayStats.xp}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/7 px-2.5 py-1 text-[10px] text-white/85">
              <SigilIcon className="w-3 h-3" /> {displayStats.sigils}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/7 px-2.5 py-1 text-[10px] text-white/85">
              <Crosshair className="w-3 h-3 text-cyan-300" /> {displayStats.pred}
            </span>
          </div>

        </div>
      </section>

      {/* Spotlights */}
      {(spotlights.hall_of_fame?.cat || spotlights.cat_of_week?.cat) && (
        <section className="px-4 mb-4">
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {spotlights.hall_of_fame?.cat && (
              <Link href={`/cat/${spotlights.hall_of_fame.cat.id}`} className="rounded-2xl border border-yellow-300/25 bg-yellow-500/10 p-3 block">
                <p className="text-xs text-yellow-200/90 mb-2">Hall of Fame</p>
                <img src={spotlights.hall_of_fame.cat.image_url || '/cat-placeholder.svg'} alt={spotlights.hall_of_fame.cat.name} className="w-full h-28 rounded-lg object-cover mb-2" />
                <p className="font-bold text-sm">{spotlights.hall_of_fame.cat.name}</p>
                <p className="text-xs text-white/70">by {spotlights.hall_of_fame.cat.owner_username || 'Unknown'} · {spotlights.hall_of_fame.cat.rarity}</p>
                {(spotlights.hall_of_fame.tagline || spotlights.hall_of_fame.theme || spotlights.hall_of_fame.expires_in_hours != null) && (
                  <p className="text-[11px] text-white/55 mt-1">
                    {spotlights.hall_of_fame.tagline || spotlights.hall_of_fame.theme || `Expires in ${spotlights.hall_of_fame.expires_in_hours}h`}
                  </p>
                )}
              </Link>
            )}
            {spotlights.cat_of_week?.cat && (
              <Link href={`/cat/${spotlights.cat_of_week.cat.id}`} className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 block">
                <p className="text-xs text-rose-200/90 mb-2">Cat of the Week</p>
                <img src={spotlights.cat_of_week.cat.image_url || '/cat-placeholder.svg'} alt={spotlights.cat_of_week.cat.name} className="w-full h-28 rounded-lg object-cover mb-2" />
                <p className="font-bold text-sm">{spotlights.cat_of_week.cat.name}</p>
                <p className="text-xs text-white/70">by {spotlights.cat_of_week.cat.owner_username || 'Unknown'} · {spotlights.cat_of_week.cat.rarity}</p>
                {(spotlights.cat_of_week.tagline || spotlights.cat_of_week.theme || spotlights.cat_of_week.expires_in_hours != null) && (
                  <p className="text-[11px] text-white/55 mt-1">
                    {spotlights.cat_of_week.tagline || spotlights.cat_of_week.theme || `Expires in ${spotlights.cat_of_week.expires_in_hours}h`}
                  </p>
                )}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Enter the Arena Missions */}
      {gettingStarted && !gettingStarted.completion.complete && (
        <section className="px-4 mb-4">
          <div className="max-w-md mx-auto">
            <div id="mission-board" className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-2.5 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div>
                  <h3 className="text-[13px] font-bold text-emerald-200">{gettingStarted.title || 'Enter the Arena'}</h3>
                  <p className="text-[11px] text-emerald-100/80">{gettingStarted.rank_label || 'Arena Rank 1'} · {gettingStarted.progress.pct}% complete</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-300/20 border border-emerald-200/30 text-emerald-100">
                  {gettingStarted.progress.completed}/{gettingStarted.progress.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-emerald-300 to-cyan-300 transition-all duration-500" style={{ width: `${gettingStarted.progress.pct}%` }} />
              </div>
              <button
                onClick={handleMissionPrimaryAction}
                className="h-10 w-full px-3 rounded-xl bg-emerald-300 text-black text-sm font-bold active:scale-[0.99] transition-transform"
              >
                Start Voting
              </button>
              <button
                onClick={() => setMissionBoardOpen((v) => !v)}
                className="mt-1.5 text-[11px] text-emerald-100/80 underline underline-offset-2"
              >
                {missionBoardOpen ? 'Hide Missions' : 'Show Missions'}
              </button>
              {missionBoardOpen && (
                <div className="space-y-2 mb-2">
                  {gettingStarted.missions.map((mission) => {
                    const isOpen = openMissionKey === mission.key;
                    const isComplete = mission.status === 'complete';
                    const isLocked = mission.status === 'locked';
                    return (
                      <div key={mission.key} id={`mission-${mission.key}`} className={`rounded-xl border p-2.5 transition-all ${isComplete ? 'border-emerald-300/35 bg-emerald-400/10' : isLocked ? 'border-white/10 bg-white/5' : 'border-cyan-300/35 bg-cyan-500/10 shadow-[0_8px_20px_rgba(34,211,238,0.12)]'}`}>
                        <button
                          onClick={() => setOpenMissionKey(mission.key)}
                          className="w-full text-left flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold truncate">{mission.title}</p>
                            <p className="text-[10px] text-white/65 truncate">{mission.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isComplete ? 'border-emerald-200/35 text-emerald-100 bg-emerald-300/20' : isLocked ? 'border-white/15 text-white/60 bg-white/5' : 'border-cyan-200/35 text-cyan-100 bg-cyan-300/20'}`}>
                              {isComplete ? 'Complete' : isLocked ? 'Locked' : 'Active'}
                            </span>
                            <p className="text-[10px] text-yellow-200 mt-1">+{mission.reward_xp} XP</p>
                          </div>
                        </button>
                        {isComplete && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-100 bg-emerald-400/15 border border-emerald-300/25 rounded-lg px-2 py-1">
                            <Check className="w-3.5 h-3.5" />
                            Mission complete
                          </div>
                        )}
                        {isOpen && (
                          mission.key === 'bookmark_home' ? (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                onClick={handleAddToHomeScreen}
                                disabled={isLocked || isComplete}
                                className="h-11 rounded-xl bg-cyan-300/20 border border-cyan-200/35 text-cyan-100 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                              >
                                Add to Home Screen
                              </button>
                              <button
                                onClick={handleBookmarkMissionComplete}
                                disabled={isLocked || isComplete || bookmarkMissionBusy}
                                className="h-11 rounded-xl bg-emerald-300 text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                              >
                                {bookmarkMissionBusy ? 'Claiming...' : 'Mission Complete (+50 Sigils)'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => runMissionCta(mission)}
                              disabled={isLocked || isComplete}
                              className="mt-2 h-12 w-full rounded-xl bg-emerald-300 text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                            >
                              {isComplete ? 'Completed' : mission.cta}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                  <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-2.5">
                    <div className="w-full text-left flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate">Optional Quest — Vuxsolia Initiation Trials</p>
                        <p className="text-[10px] text-white/65 truncate">Vote 20 times · Place 3 predictions · Submit or adopt 1 cat.</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-200/35 text-cyan-100 bg-cyan-300/20">
                          Optional
                        </span>
                        <p className="text-[10px] text-yellow-200 mt-1">Flex title</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/social')}
                      className="mt-2 h-11 w-full rounded-xl bg-cyan-300 text-black text-xs font-bold active:scale-[0.99] transition-transform"
                    >
                      Open Social Hub
                    </button>
                  </div>
                  <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-2.5">
                    <div className="w-full text-left flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold truncate">Optional Quest — Invite Friends</p>
                        <p className="text-[10px] text-white/65 truncate">Share your invite link and recruit friends into CatClash.</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-200/35 text-cyan-100 bg-cyan-300/20">
                          Optional
                        </span>
                        <p className="text-[10px] text-yellow-200 mt-1">Social bonus</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/social')}
                      className="mt-2 h-11 w-full rounded-xl bg-cyan-300 text-black text-xs font-bold active:scale-[0.99] transition-transform"
                    >
                      Go to Social
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Flame + Crate */}
      <section className="px-4 mb-4">
        <div className="max-w-md mx-auto">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[12px] font-bold tracking-wide text-white/85 uppercase">Daily Core</h2>
            <Link href="/crate" className="text-[11px] text-yellow-200/90 hover:text-yellow-100">View Crates</Link>
          </div>
        </div>
        <div className="max-w-md mx-auto grid grid-cols-2 gap-2">
          <ArenaFlameCard
            flame={flame}
            loading={loading && !flame}
            error={meError}
            onRetry={loadAll}
            compact
            className="h-full"
          />
          <div className="glass rounded-2xl p-3 text-center min-h-[210px] h-full">
            <div className="flex items-center justify-center gap-2 mb-2">
              <SigilIcon className="w-4 h-4" glow />
              <h3 className="font-bold text-sm">Crate</h3>
            </div>
            <div className="crate-hero mb-1.5">
              <div className={`crate-visual ${claimingCrate ? 'opening' : ''}`}>
                <div className="crate-lid" />
                <div className="crate-box" />
                <div className="crate-glow" />
              </div>
            </div>
            <button onClick={handleClaimCrate} disabled={claimingCrate}
              className="h-9 px-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 mx-auto">
              {claimingCrate ? <Loader2 className="w-3 h-3 animate-spin" /> : "Open"}
            </button>
            <p className="text-[10px] text-white/50 mt-1">Resets in {crateCountdown}</p>
            <div className="mt-2 flex items-center justify-center gap-1 text-[9px]">
              <span className="px-1.5 py-0.5 rounded-full bg-zinc-500/25 text-zinc-200">C</span>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/25 text-blue-200">R</span>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200">E</span>
              <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/25 text-yellow-100">L</span>
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-100">M</span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-100">G</span>
            </div>
            {crateMeta?.pity_status && (
              <div className="mt-2 text-[10px] text-white/60">
                <p>Pity: {Math.max(0, 10 - Number(crateMeta.pity_status.streak_without_epic_plus || 0))} to Epic+</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Arenas */}
      <section id="home-arenas" className="px-2.5 sm:px-4 pb-8">
        <div className="mx-auto w-full max-w-none sm:max-w-2xl">
          <div className="mb-2 flex justify-end">
            <Link href="/duel" className="text-[11px] text-cyan-200 inline-flex items-center gap-1">
              Open Duel Arena <ArrowRight className="w-3 h-3" />
              {pendingDuelCount > 0 ? (
                <span className="px-1 py-0.5 rounded-full bg-red-500/20 border border-red-300/35 text-[9px] text-red-100 font-semibold">
                  {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              onClick={() => setArenaTypeTab('main')}
              size="md"
              variant={arenaTypeTab === 'main' ? 'primary' : 'secondary'}
              className={arenaTypeTab === 'main' ? 'bg-white text-black border-white' : ''}
            >
              Main Arena
            </Button>
            <Button
              onClick={() => setArenaTypeTab('rookie')}
              size="md"
              variant={arenaTypeTab === 'rookie' ? 'primary' : 'secondary'}
              className={arenaTypeTab === 'rookie' ? 'bg-emerald-300 text-black border-emerald-200/80' : 'border-emerald-300/25 bg-emerald-500/10 text-emerald-200'}
            >
              Rookie Arena
            </Button>
          </div>

          <Card className="mb-3 p-2.5 border-cyan-300/25 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.2),transparent_42%),linear-gradient(145deg,rgba(8,47,73,0.45),rgba(8,145,178,0.18))]">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-cyan-50 inline-flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Next Pulse {pulseCountdown}
              </span>
              <div className="inline-flex items-center gap-2">
                {activeVotersNow > 0 ? <span className="text-cyan-100/80">{activeVotersNow} online</span> : null}
                <Link href="/tournament" className="h-7 px-2 rounded-md border border-cyan-200/35 bg-cyan-400/15 text-cyan-100 inline-flex items-center">Full Bracket</Link>
              </div>
            </div>
            {pulseRecap && <p className="mt-1 text-[10px] text-cyan-100/85">{pulseRecap}</p>}
          </Card>

          {arenas.filter((a) => a.type === arenaTypeTab).length === 0 ? (
            <div className="text-center py-12 glass rounded-2xl">
              <p className="text-white/50 mb-4">No active {arenaTypeTab} arena today.</p>
              <Link href="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:scale-105 transition-transform">
                Submit a Cat
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {arenas.filter((arena) => arena.type === arenaTypeTab).map((arena) => (
                <ArenaSection key={arena.tournament_id} arena={arena} votedMatches={votedMatches}
                  votingMatch={votingMatch}
                  predictBusyMatch={predictBusyMatch}
                  calloutBusyMatch={calloutBusyMatch}
                  socialEnabled={socialLoopEnabled}
                  availableSigils={progress?.sigils || 0}
                  voteStreak={voteStreak}
                  hotMatchBiasEnabled={hotMatchBiasEnabled}
                  globalPageInfo={arena.type === 'main' || arena.type === 'rookie' ? globalPageInfo[arena.type] : null}
                  pulseCountdown={pulseCountdown}
                  voteEffectSlug={equippedCosmetics?.vote_effect?.slug || equippedCosmetics?.color?.slug || null}
                  onRequestMore={() => handleArenaStackRefill((arena.type as 'main' | 'rookie'))}
                  onVote={handleVote}
                  onPredict={handlePredict}
                  onCreateCallout={handleCreateCallout}
                />
              ))}
            </div>
          )}

          <div className="mt-4">
            <LiveDuelsModule
              compact
              duels={liveDuels}
              pendingDuelCount={pendingDuelCount}
              liveDuelVotes2m={liveDuelVotes2m}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center text-neutral-500 text-sm">
          <div className="mb-3">CatClash Arena 2026</div>
          <a className="inline-flex items-center gap-2 hover:text-white transition-colors"
            href="https://instagram.com/vuxsal" target="_blank" rel="noopener noreferrer">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            @vuxsal
          </a>
        </div>
      </footer>
    </main>
  );
}
