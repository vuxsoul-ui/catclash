// REPLACE: app/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import {
  Sparkles, Flame, Target, Zap, Loader2, Check, Crosshair,
  ArrowRight, Crown, Swords, MessageCircle, Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SigilIcon from "./components/icons/SigilIcon";
import ArenaFlameCard, { type ArenaFlame } from "./components/ArenaFlameCard";
import DuelCardMini from "./components/duel/DuelCardMini";
import type { DuelRowData } from "./components/duel/types";
import { showGlobalToast } from "./lib/global-toast";
import { resolveActorId, resolveProfileUsername, runIdentityResolutionChecks } from "./lib/identity";
import {
  mergeVotedMaps,
  readVotedMatchesFromStorage,
  removeVotedMatch,
  runVoteStateChecks,
  upsertVotedMatch,
  writeVotedMatchesToStorage,
} from "./lib/vote-state";
import CatCardBack from "./components/CatCardBack";
import { cosmeticBorderClassFromSlug, cosmeticTextClassFromSlug } from "./_lib/cosmetics/effectsRegistry";
import { computePowerRating } from "./_lib/combat";
import { Button, Card, SectionHeader } from "./components/ui/primitives";
import { pickFairMatches } from "./api/_lib/pickFairMatches";
import { checkTapTarget, warnOnce } from "./lib/dev-click-guards";
import { scanDuplicateTestIds } from "./lib/dev-testid-guard";
import { canonicalThumbForCat } from "./lib/cat-images";
import DebugControls from "./components/DebugControls";
import DebugWidget from "./components/DebugWidget";
import CosmicStatsBar from "./components/CosmicStatsBar";
import { useHeaderExtension } from "./components/HeaderSystem";

// Types
interface UserProgress {
  xp: number;
  level: number;
  currentStreak: number;
  sigils: number;
  predictionStreak: number;
  catXpPool: number;
}

export interface ArenaCat {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  level?: number;
  ability?: string | null;
  ability_description?: string | null;
  description?: string | null;
  lore?: string | null;
  tagline?: string | null;
  origin?: string | null;
  wins?: number;
  losses?: number;
  owner_id?: string | null;
  owner_username?: string | null;
  owner_guild?: 'sun' | 'moon' | null;
  stats?: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
}

export interface ArenaMatch {
  match_id: string;
  cat_a: ArenaCat;
  cat_b: ArenaCat;
  votes_a: number;
  votes_b: number;
  total_votes?: number;
  percent_a?: number;
  percent_b?: number;
  status: string;
  winner_id?: string | null;
  is_close_match?: boolean;
  user_prediction?: { predicted_cat_id: string; bet_sigils: number } | null;
}

type VoteSnapshot = {
  votes_a: number;
  votes_b: number;
  total_votes: number;
  percent_a: number;
  percent_b: number;
};

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

interface ArenaQueuePageInfo {
  pageIndex: number;
  pageSize: number;
  totalSize: number;
  votedCount: number;
  pageComplete: boolean;
}

interface ArenaInventoryDebug {
  requestedCount?: number;
  returnedCount?: number;
  arena?: string;
  pageIndex?: number;
  roundId?: number;
  eligibleCatsCount?: number;
  openMatchesCount?: number;
  existingCount?: number;
  generatedCount?: number;
  attempts?: number;
  timeWindow?: string;
  whyNotFilled?: string[];
  votingClosedUntilNextPulse?: boolean;
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
type ArenaRefreshResult = {
  ok: boolean;
  count: number;
  status?: string | null;
  pageIndex?: number;
  renderableCount?: number;
  advanced?: boolean;
  pageComplete?: boolean;
  votedCount?: number;
  totalSize?: number;
};

// Config
const ARENA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; accent: string; description: string }> = {
  main: {
    label: "Main Arena",
    icon: <Swords className="w-4 h-4" />,
    color: "border-yellow-500/30 bg-yellow-500/5",
    accent: "text-yellow-400",
    description: "The premier daily tournament. 8 cats enter, 1 champion emerges.",
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
  const raw = String((cat as any)?.image_url || "").trim();
  if (!raw) return "/cat-placeholder.svg";
  if (raw.includes('/cat-placeholder')) return raw;
  return /\/thumb\.webp(?:$|[?#])/i.test(raw) ? raw : "/cat-placeholder.svg";
}

function getCatDisplayName(cat: Partial<ArenaCat> | null | undefined): string {
  const candidates = [
    (cat as any)?.display_name,
    cat?.name,
    (cat as any)?.title,
  ];
  for (const v of candidates) {
    const s = String(v || '').trim();
    if (!s) continue;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    const isLongId = /^[a-z0-9_-]{24,}$/i.test(s);
    if (isUuid || isLongId || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') continue;
    return s;
  }
  return 'Unnamed Cat';
}

function getVotePercent(
  match: Pick<ArenaMatch, 'votes_a' | 'votes_b' | 'percent_a' | 'percent_b'>,
  snapshot?: VoteSnapshot | null
): [number, number] {
  const source = snapshot || match;
  const pA = Number(source.percent_a);
  const pB = Number(source.percent_b);
  if (Number.isFinite(pA) && Number.isFinite(pB) && pA >= 0 && pB >= 0) {
    return [Math.max(0, Math.min(100, Math.round(pA))), Math.max(0, Math.min(100, Math.round(pB)))];
  }
  const total = Number(source.votes_a || 0) + Number(source.votes_b || 0);
  if (total === 0) return [50, 50];
  const aPct = Math.round((Number(source.votes_a || 0) / total) * 100);
  return [aPct, Math.max(0, 100 - aPct)];
}

function voteScopeFromArenas(arenas: Arena[]): string {
  const ids = arenas
    .map((a) => String(a.tournament_id || '').trim())
    .filter(Boolean)
    .sort();
  return ids.length > 0 ? ids.join('|') : 'global';
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
  const [pctA, pctB] = getVotePercent(match);
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

function isArenaVotingStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'active' || s === 'in_progress' || s === 'pending';
}

function isArenaCompleteStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'complete' || s === 'completed';
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
  const visibleDuels = duels.slice(0, compact ? 6 : 10);
  const withFallbackNav = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const before = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.setTimeout(() => {
      const after = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (after === before) window.location.assign(href);
    }, 220);
  };
  return (
    <Card className={`live-duels-shell relative overflow-hidden border-cyan-300/25 bg-[linear-gradient(160deg,rgba(14,28,48,0.55),rgba(8,16,28,0.88))] ${compact ? 'p-2' : 'p-2.5'}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-20%,rgba(34,211,238,0.2),transparent_42%),radial-gradient(circle_at_88%_110%,rgba(59,130,246,0.16),transparent_40%)]" />
      <SectionHeader className="mb-1.5">
        <h3 className="home-subsection-title relative z-10 text-[12px] font-semibold text-cyan-100 inline-flex items-center gap-1.5">
          <span className="live-duels-dot w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          Live Duels
          {visibleDuels.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-100">
              {visibleDuels.length}
            </span>
          )}
        </h3>
        <Link
          href="/duel"
          onClick={withFallbackNav('/duel')}
          data-testid="open-duel-arena-cta-live"
          className="relative z-20 pointer-events-auto rounded-full border border-cyan-300/35 bg-cyan-500/14 px-2 py-1 text-[10px] text-cyan-100 inline-flex items-center gap-1 tap-target hover:bg-cyan-500/22"
        >
          Open Duel Arena <ArrowRight className="w-3 h-3" />
          {pendingDuelCount > 0 && (
            <span className="absolute -top-2 -right-4 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold inline-flex items-center justify-center border border-red-300/40">
              {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
            </span>
          )}
        </Link>
      </SectionHeader>
      {visibleDuels.length > 0 ? (
        <div className="relative z-10 -mx-0.5 px-0.5 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleDuels.map((duel) => (
            <div key={`live-duel-${duel.id}`} className="snap-start w-[44vw] min-w-[156px] max-w-[196px]">
              <DuelCardMini duel={duel} />
            </div>
          ))}
        </div>
      ) : (
        <p className="relative z-10 text-[11px] text-white/65">No live duels yet.</p>
      )}
      {liveDuelVotes2m > 0 && (
        <p className="relative z-10 text-[10px] text-cyan-100/75 mt-1.5 inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
          +{liveDuelVotes2m} duel votes in last 2m
        </p>
      )}
    </Card>
  );
}

function LoadingNextFightsCard({ text = "Loading next fights..." }: { text?: string }) {
  return (
    <div className="min-h-[140px] rounded-2xl border border-cyan-300/25 bg-cyan-500/8 p-4 pointer-events-none">
      <div className="h-full w-full flex items-center justify-between gap-3 pointer-events-none">
        <div>
          <p className="text-sm font-semibold text-cyan-100">{text}</p>
          <p className="text-[11px] text-cyan-100/70 mt-1">Keeping your current queue stable while we refill.</p>
        </div>
        <Loader2 className="w-5 h-5 text-cyan-200 animate-spin shrink-0" />
      </div>
    </div>
  );
}

function AllMatchesVotedCard({ pulseCountdown }: { pulseCountdown: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-emerald-300/30 bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(6,182,212,0.12),rgba(10,10,12,0.45))] p-6 text-center shadow-[0_14px_36px_rgba(16,185,129,0.2)]">
      <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-300/20">
        <Sparkles className="h-5 w-5 text-emerald-100" />
      </div>
      <p className="text-base font-bold text-emerald-100">All matches voted. You cleared the arena.</p>
      <p className="mt-1 text-xs text-white/70">New battles will appear on the next pulse.</p>
      <p className="mt-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white/85">
        Next Pulse: {pulseCountdown || "--:--:--"}
      </p>
    </div>
  );
}

// ── Match Card ── Images link to profile, vote buttons below
const MatchCard = React.memo(function MatchCard({
  match, voted, isVoting, predictBusy, calloutBusy, socialEnabled, availableSigils, voteStreak, isExiting, onVote, onPredict, onCreateCallout,
  voteQueued, onRefreshQueued, onVoteAccepted, showNextUp, slotPhase = "idle", slotChosenSide = null, enterPhase = "idle",
  isRefilling = false, resetFlipSignal = '',
  debugMode = false, voteSnapshot = null,
}: {
  match: ArenaMatch; voted: string | null; isVoting: boolean;
  predictBusy: boolean;
  calloutBusy: boolean;
  socialEnabled: boolean;
  availableSigils: number;
  voteStreak: number;
  isExiting?: boolean;
  voteQueued?: boolean;
  showNextUp?: boolean;
  onRefreshQueued?: (matchId: string) => void;
  onVoteAccepted?: (matchId: string, side: "a" | "b") => void;
  slotPhase?: "idle" | "voted" | "exiting";
  slotChosenSide?: "a" | "b" | null;
  enterPhase?: "idle" | "entering";
  isRefilling?: boolean;
  resetFlipSignal?: string;
  debugMode?: boolean;
  voteSnapshot?: VoteSnapshot | null;
  onVote: (matchId: string, catId: string) => Promise<boolean>;
  onPredict: (matchId: string, catId: string, bet: number) => Promise<boolean>;
  onCreateCallout: (matchId: string, catId: string) => void;
}) {
  const [pctA, pctB] = getVotePercent(match, voteSnapshot);
  const isComplete = String(match.status || '').toLowerCase() === "complete" || String(match.status || '').toLowerCase() === "completed";
  const hasVoted = !!voted;
  const [votePending, setVotePending] = useState(false);
  const [chosenSide, setChosenSide] = useState<"a" | "b" | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteConfirm, setVoteConfirm] = useState(false);
  const canVote = !hasVoted && !isVoting && !isComplete && !votePending;
  const selectedSide: "a" | "b" | null = voted === match.cat_a.id ? "a" : voted === match.cat_b.id ? "b" : null;
  const liveSide: "a" | "b" | null = slotChosenSide || chosenSide || selectedSide;
  const parentConfirmed = slotPhase === "voted" || slotPhase === "exiting";
  const exitingVisual = isExiting || slotPhase === "exiting";
  const voteStage: "idle" | "pending" | "confirmed" =
    parentConfirmed
      ? "confirmed"
      : votePending && !voteSubmitted
        ? "pending"
        : (hasVoted || voteSubmitted || voteConfirm ? "confirmed" : "idle");
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
  const [dragging, setDragging] = useState(false);
  const [dragIntent, setDragIntent] = useState<"a" | "b" | null>(null);
  const [swipeCommitting, setSwipeCommitting] = useState(false);
  const [voteFxSide, setVoteFxSide] = useState<"a" | "b" | null>(null);
  const [plusOneFxSide, setPlusOneFxSide] = useState<"a" | "b" | null>(null);
  const [impactSide, setImpactSide] = useState<"a" | "b" | null>(null);
  const [animTick, setAnimTick] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [predictOpen, setPredictOpen] = useState(false);
  const [predictConfirmed, setPredictConfirmed] = useState(false);
  const [previewToast, setPreviewToast] = useState<string | null>(null);
  const [flipA, setFlipA] = useState(false);
  const [flipB, setFlipB] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const voteInFlightRef = useRef(false);
  const flipTouchedRef = useRef(false);
  const allowFlip = flipTouchedRef.current;
  const forceFront = !allowFlip || isRefilling || exitingVisual || voteQueued || slotPhase !== "idle";
  const motionRef = useRef<HTMLDivElement | null>(null);
  const dragXRef = useRef(0);
  const dragIntentRef = useRef<"a" | "b" | null>(null);
  const draggingRef = useRef(false);
  const swipeCommittingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const swipeReleaseCleanupRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const swipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startTs: number;
    lastDx: number;
    lastDy: number;
    active: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startTs: 0,
    lastDx: 0,
    lastDy: 0,
    active: false,
  });
  const guildA = guildBadge(match.cat_a.owner_guild || null);
  const guildB = guildBadge(match.cat_b.owner_guild || null);
  const catAName = getCatDisplayName(match.cat_a);
  const catBName = getCatDisplayName(match.cat_b);
  const aPower = statPower(match.cat_a);
  const bPower = statPower(match.cat_b);
  const strongerA = aPower >= bPower;
  const edgePct = Math.min(35, Math.round((Math.abs(aPower - bPower) / Math.max(1, Math.max(aPower, bPower))) * 100));
  const statsA = match.cat_a.stats || { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 };
  const statsB = match.cat_b.stats || { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 };
  const probA = Math.max(0.05, displayPct.a / 100);
  const probB = Math.max(0.05, displayPct.b / 100);
  const payoutA = (1 / probA).toFixed(2);
  const payoutB = (1 / probB).toFixed(2);
  const underdogA = probA < 0.35;
  const underdogB = probB < 0.35;
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
  const SWIPE_X_THRESHOLD = 56;
  const SWIPE_X_FAST = 34;
  const SWIPE_Y_CANCEL = 44;
  const SWIPE_MIN_VELOCITY = 0.24; // px/ms
  const SWIPE_EXIT_MS = reduceMotion ? 80 : 180;

  const applyMotionTransform = useCallback((rawDx: number, opts?: { released?: boolean }) => {
    const el = motionRef.current;
    if (!el) return;
    const sign = rawDx < 0 ? -1 : 1;
    if (opts?.released) {
      const offscreen = (typeof window !== 'undefined' ? window.innerWidth : 420) * 1.2 * sign;
      const rotate = reduceMotion ? 0 : 18 * sign;
      const scale = reduceMotion ? 1 : 0.985;
      el.style.transform = `translate3d(${offscreen}px,0,0) rotate(${rotate}deg) scale(${scale})`;
      return;
    }
    if (reduceMotion) {
      el.style.transform = `translate3d(${rawDx}px,0,0) rotate(0deg) scale(1)`;
      return;
    }
    const abs = Math.abs(rawDx);
    const effectiveX = abs < SWIPE_X_THRESHOLD
      ? rawDx * 0.85
      : (SWIPE_X_THRESHOLD * sign) + ((rawDx - (SWIPE_X_THRESHOLD * sign)) * 0.35);
    const rotate = Math.max(-14, Math.min(14, effectiveX / 12));
    const scale = 1 - Math.min(Math.abs(effectiveX) / 1000, 0.04);
    el.style.transform = `translate3d(${effectiveX}px,0,0) rotate(${rotate}deg) scale(${scale})`;
  }, [SWIPE_X_THRESHOLD, reduceMotion]);

  const scheduleMotionFrame = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      applyMotionTransform(dragXRef.current);
    });
  }, [applyMotionTransform]);

  const commitVote = async (
    source: "tap" | "swipe_up" | "swipe_move" | "swipe_cancel" | "other",
    catId: string,
    meta?: { dx?: number; dy?: number }
  ) => {
    if (source === "swipe_move") {
      if (process.env.NODE_ENV !== 'production') {
        warnOnce(`swipe-move-commit-blocked:${match.match_id}`, `[DEV] blocked swipe_move commit path for ${match.match_id}`);
      }
      return;
    }
    if (source === "swipe_cancel") {
      if (process.env.NODE_ENV !== 'production') {
        warnOnce(`swipe-cancel-commit-blocked:${match.match_id}`, `[DEV] blocked swipe_cancel commit path for ${match.match_id}`);
      }
      return;
    }
    if (!canVote || voteInFlightRef.current || swipeCommitting) {
      if (process.env.NODE_ENV !== 'production' && swipeCommittingRef.current) {
        warnOnce(`vote-while-committing:${match.match_id}`, `[DEV] vote blocked while swipeCommittingRef=true for ${match.match_id}`);
      }
      return;
    }
    voteInFlightRef.current = true;
    const side: "a" | "b" = catId === match.cat_a.id ? "a" : "b";
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `[DEV][vote-trigger] source=${source} matchId=${match.match_id} dx=${Number(meta?.dx || 0)} dy=${Number(meta?.dy || 0)} dragging=${dragging} intent=${dragIntent || 'none'}`
      );
      // eslint-disable-next-line no-console
      console.log(new Error().stack);
    }
    setChosenSide(side);
    setVotePending(true);
    setVoteSubmitted(false);
    let ok = false;
    try {
      ok = await onVote(match.match_id, catId);
      if (ok) {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(10);
        }
        setAnimTick((n) => n + 1);
        setVoteFxSide(side);
        setPlusOneFxSide(side);
        if (!reduceMotion) setImpactSide(side);
        window.setTimeout(() => setVoteFxSide(null), 210);
        window.setTimeout(() => setPlusOneFxSide(null), 420);
        window.setTimeout(() => setImpactSide(null), 160);
        setVoteSubmitted(true);
        setVoteConfirm(true);
        onVoteAccepted?.(match.match_id, side);
      } else {
        setChosenSide(null);
        setVoteSubmitted(false);
        setVotePending(false);
        setDisplayPct({ a: pctA, b: pctB });
      }
    } finally {
      voteInFlightRef.current = false;
      setSwipeCommitting(false);
      swipeCommittingRef.current = false;
    }
  };

  function isSwipeBlockedTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest(
      '.arena-vote-btn, input, textarea, select, a, [role="button"], [data-no-swipe="1"]'
    );
  }

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (isSwipeBlockedTarget(e.target) || !canVote || voteInFlightRef.current || swipeCommitting) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTs: performance.now(),
      lastDx: 0,
      lastDy: 0,
      active: true,
    };
    draggingRef.current = true;
    dragXRef.current = 0;
    const el = motionRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.willChange = 'transform';
    }
    if (swipeReleaseCleanupRef.current !== null) {
      window.clearTimeout(swipeReleaseCleanupRef.current);
      swipeReleaseCleanupRef.current = null;
    }
    setDragging(true);
  };

  const shouldCommitSwipe = useCallback((dx: number, dy: number, elapsedMs: number): boolean => {
    if (!canVote || voteInFlightRef.current || swipeCommittingRef.current) return false;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDy >= SWIPE_Y_CANCEL || absDx <= absDy + 8) return false;
    const velocity = absDx / Math.max(1, elapsedMs);
    return absDx >= SWIPE_X_THRESHOLD || (absDx >= SWIPE_X_FAST && velocity >= SWIPE_MIN_VELOCITY);
  }, [canVote, swipeCommitting]);

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (!s.active || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    s.lastDx = dx;
    s.lastDy = dy;
    if (Math.abs(dy) > SWIPE_Y_CANCEL) {
      s.active = false;
      draggingRef.current = false;
      dragXRef.current = 0;
      setDragging(false);
      setDragIntent(null);
      dragIntentRef.current = null;
      const el = motionRef.current;
      if (el) {
        el.style.transition = `transform ${reduceMotion ? 120 : 180}ms cubic-bezier(.2,.8,.2,1)`;
        el.style.willChange = 'auto';
      }
      scheduleMotionFrame();
      return;
    }
    dragXRef.current = dx;
    const nextIntent: "a" | "b" | null = Math.abs(dx) >= 8 ? (dx > 0 ? "a" : "b") : null;
    if (nextIntent !== dragIntentRef.current) {
      dragIntentRef.current = nextIntent;
      setDragIntent(nextIntent);
    }
    scheduleMotionFrame();
    if (process.env.NODE_ENV !== 'production') {
      const elapsedMs = Math.max(1, performance.now() - s.startTs);
      if (shouldCommitSwipe(dx, dy, elapsedMs)) {
        warnOnce(`swipe-move-pass-threshold:${match.match_id}`, `[DEV] swipe move reached threshold (will commit on pointerup only) for ${match.match_id}`);
      }
    }
  };

  const handlePointerEnd: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const s = swipeRef.current;
    if (s.pointerId !== e.pointerId) return;
    const isCancel = e.type === 'pointercancel';
    const dx = isCancel ? s.lastDx : (e.clientX - s.startX);
    const dy = isCancel ? s.lastDy : (e.clientY - s.startY);
    const elapsedMs = Math.max(1, performance.now() - s.startTs);
    const pass = !isCancel && shouldCommitSwipe(dx, dy, elapsedMs);
    if (pass && !voteInFlightRef.current && !swipeCommittingRef.current) {
      const side: "a" | "b" = dx > 0 ? "a" : "b";
      const el = motionRef.current;
      dragXRef.current = dx;
      dragIntentRef.current = side;
      setDragIntent(side);
      setSwipeCommitting(true);
      swipeCommittingRef.current = true;
      setDragging(false);
      draggingRef.current = false;
      if (el) {
        el.style.transition = 'none';
        applyMotionTransform(dragXRef.current);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const target = motionRef.current;
            if (!target) return;
            target.style.transition = `transform ${SWIPE_EXIT_MS}ms ease-out`;
            applyMotionTransform(dx, { released: true });
          });
        });
        if (swipeReleaseCleanupRef.current !== null) {
          window.clearTimeout(swipeReleaseCleanupRef.current);
        }
        swipeReleaseCleanupRef.current = window.setTimeout(() => {
          const target = motionRef.current;
          if (target) target.style.willChange = 'auto';
          swipeReleaseCleanupRef.current = null;
        }, SWIPE_EXIT_MS + 40);
      }
      void commitVote("swipe_up", side === "a" ? match.cat_a.id : match.cat_b.id, { dx, dy }).finally(() => {
        setSwipeCommitting(false);
        swipeCommittingRef.current = false;
      });
    } else {
      dragXRef.current = 0;
      setDragIntent(null);
      dragIntentRef.current = null;
      const el = motionRef.current;
      if (el) {
        el.style.transition = `transform ${reduceMotion ? 120 : 180}ms cubic-bezier(.2,.8,.2,1)`;
        el.style.willChange = 'auto';
      }
      setSwipeCommitting(false);
      swipeCommittingRef.current = false;
      scheduleMotionFrame();
    }
    s.active = false;
    s.pointerId = null;
    draggingRef.current = false;
    setDragging(false);
  };

  useEffect(() => {
    setDisplayPct((prev) => {
      if (prev.a === pctA && prev.b === pctB) return prev;
      return { a: pctA, b: pctB };
    });
  }, [pctA, pctB]);

  useEffect(() => {
    if (!predictedCatId) return;
    setPredictOpen(false);
    setPredictConfirmed(true);
    const id = window.setTimeout(() => setPredictConfirmed(false), 1500);
    return () => window.clearTimeout(id);
  }, [predictedCatId]);

  useEffect(() => {
    setDetailsOpen(false);
    setPredictOpen(false);
    setCommentsOpen(false);
    setVotePending(false);
    setChosenSide(null);
    setVoteSubmitted(false);
    setVoteConfirm(false);
    dragXRef.current = 0;
    setDragging(false);
    setDragIntent(null);
    dragIntentRef.current = null;
    setSwipeCommitting(false);
    swipeCommittingRef.current = false;
    draggingRef.current = false;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = motionRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(1)';
      el.style.willChange = 'auto';
    }
    if (swipeReleaseCleanupRef.current !== null) {
      window.clearTimeout(swipeReleaseCleanupRef.current);
      swipeReleaseCleanupRef.current = null;
    }
    setVoteFxSide(null);
    setPlusOneFxSide(null);
    setImpactSide(null);
    setAnimTick(0);
    setFlipA(false);
    setFlipB(false);
    flipTouchedRef.current = false;
    voteInFlightRef.current = false;
  }, [match.match_id, resetFlipSignal]);

  useEffect(() => {
    if (!isRefilling) return;
    setFlipA(false);
    setFlipB(false);
    flipTouchedRef.current = false;
  }, [isRefilling]);

  useEffect(() => {
    if (flipTouchedRef.current) return;
    if (!flipA && !flipB) return;
    setFlipA(false);
    setFlipB(false);
  }, [flipA, flipB]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (swipeReleaseCleanupRef.current !== null) {
        window.clearTimeout(swipeReleaseCleanupRef.current);
        swipeReleaseCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!voteConfirm) return;
    const t = window.setTimeout(() => setVoteConfirm(false), 1400);
    return () => window.clearTimeout(t);
  }, [voteConfirm]);

  useEffect(() => {
    if (!hasVoted) return;
    setVotePending(false);
    setVoteSubmitted(true);
  }, [hasVoted]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (catAName === 'Unnamed Cat') {
      warnOnce(`unnamed-cat-a:${match.match_id}`, `[DEV WARNING] Unresolved cat A name on match ${match.match_id}`);
    }
    if (catBName === 'Unnamed Cat') {
      warnOnce(`unnamed-cat-b:${match.match_id}`, `[DEV WARNING] Unresolved cat B name on match ${match.match_id}`);
    }
  }, [catAName, catBName, match.match_id]);

  useEffect(() => {
    if (!previewToast) return;
    const id = window.setTimeout(() => setPreviewToast(null), 1200);
    return () => window.clearTimeout(id);
  }, [previewToast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setFlipA(false);
      setFlipB(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function cosmeticChips(cat: ArenaCat): Array<{ slot: string; label: string; icon: string; previewable: boolean }> {
    const anyCat = cat as any;
    const slots = [
      { slot: 'title', icon: '✦', value: anyCat.cosmetic_title || anyCat.title || anyCat.title_name || null, previewable: false },
      { slot: 'border', icon: '▣', value: anyCat.cosmetic_border || anyCat.border || anyCat.border_name || null, previewable: true },
      { slot: 'color', icon: '◉', value: anyCat.cosmetic_color || anyCat.color || anyCat.color_name || null, previewable: true },
      { slot: 'badge', icon: '★', value: anyCat.cosmetic_badge || anyCat.badge || anyCat.badge_name || null, previewable: false },
      { slot: 'effect', icon: '✺', value: anyCat.vote_effect || anyCat.effect || anyCat.effect_name || null, previewable: true },
    ];
    return slots
      .filter((s) => !!s.value)
      .map((s) => ({
        slot: s.slot,
        icon: s.icon,
        label: String(s.value).replace(/^cat_/, '').replace(/_/g, ' '),
        previewable: s.previewable,
      }));
  }

  const cosmeticsA = cosmeticChips(match.cat_a);
  const cosmeticsB = cosmeticChips(match.cat_b);

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
    <div
      className={`arena-match-card relative mx-auto w-full rounded-2xl p-2.5 transition-transform transition-opacity ${reduceMotion ? 'duration-150' : 'duration-300'} ease-out touch-pan-y ${dragging ? 'is-dragging' : ''} ${impactSide && !reduceMotion ? 'impact' : ''} ${match.is_close_match && !dragging && !exitingVisual && !reduceMotion ? 'close-glow' : ''} ${hasVoted || isComplete ? "opacity-65" : ""} ${exitingVisual ? (isRefilling ? 'opacity-100' : 'opacity-0 pointer-events-none') : 'opacity-100'}`}
      data-testid="match-root"
      data-match-id={match.match_id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {debugMode && hasVoted && (
        <div className="pointer-events-none absolute right-3 top-3 z-30 rounded-full border border-amber-300/45 bg-amber-500/18 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
          DEBUG: voted{selectedSide ? ` ${selectedSide.toUpperCase()}` : ''}
        </div>
      )}
      <div>
        {voteFxSide && (
          <div key={`flash-${animTick}`} className={`vote-flash ${voteFxSide === 'a' ? 'vote-flash-a' : 'vote-flash-b'}`} />
        )}
        {plusOneFxSide && (
          <div key={`plus-${animTick}`} className={`pointer-events-none absolute z-30 top-1/2 -translate-y-1/2 ${plusOneFxSide === 'a' ? 'left-[16%]' : 'right-[16%]'} anim-float-up`}>
            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${plusOneFxSide === 'a' ? 'border-emerald-300/45 bg-emerald-500/20 text-emerald-100' : 'border-cyan-300/45 bg-cyan-500/20 text-cyan-100'}`}>+1</span>
          </div>
        )}
        {impactSide && !reduceMotion && (
          <div key={`impact-${animTick}`} className={`pointer-events-none absolute z-30 top-[42%] ${impactSide === 'a' ? 'left-[18%]' : 'right-[18%]'}`}>
            {[
              { dx: '-18px', dy: '-12px' },
              { dx: '-8px', dy: '-20px' },
              { dx: '8px', dy: '-18px' },
              { dx: '18px', dy: '-10px' },
              { dx: '-10px', dy: '10px' },
              { dx: '12px', dy: '12px' },
            ].map((v, idx) => (
              <span
                key={`${impactSide}-${idx}`}
                className={`burst-dot ${impactSide === 'a' ? 'burst-dot-a' : 'burst-dot-b'}`}
                style={{ ['--dx' as any]: v.dx, ['--dy' as any]: v.dy }}
              />
            ))}
          </div>
        )}
        {match.is_close_match && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 close-badge-pulse">
            <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-500/14 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              🔥 Close Battle
            </span>
          </div>
        )}
        <div
          ref={motionRef}
          className={`${dragging ? 'transition-none touch-none' : 'transition-transform transition-opacity ease-out touch-pan-y'} transform-gpu ${!dragging && enterPhase === 'entering' ? 'opacity-95 translate-y-[6px] scale-[0.99]' : 'opacity-100 translate-y-0 scale-100'}`}
          style={!dragging ? { transitionDuration: reduceMotion ? '120ms' : '160ms' } : undefined}
        >
      {process.env.NODE_ENV !== 'production' && (
        <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 px-2 py-0.5 text-[9px] text-fuchsia-100">
          R{renderCountRef.current}
        </div>
      )}
      {dragIntent && canVote && (
        <>
          <div className={`pointer-events-none absolute left-2 top-9 z-30 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity ${dragIntent === 'a' ? 'border-blue-300/45 bg-blue-500/20 text-blue-100' : 'border-white/20 bg-black/30 text-white/40'}`} style={{ opacity: dragIntent === 'a' ? 0.92 : 0.38 }}>
            VOTE A
          </div>
          <div className={`pointer-events-none absolute right-2 top-9 z-30 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity ${dragIntent === 'b' ? 'border-rose-300/45 bg-rose-500/20 text-rose-100' : 'border-white/20 bg-black/30 text-white/40'}`} style={{ opacity: dragIntent === 'b' ? 0.92 : 0.38 }}>
            VOTE B
          </div>
        </>
      )}
      {previewToast && (
        <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-full border border-cyan-300/35 bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-100">
          {previewToast}
        </div>
      )}
      {showNextUp && (
        <div className="pointer-events-none absolute left-2 top-2 z-20 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-100 animate-pulse">
          Next up
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_26px_minmax(0,1fr)] items-start gap-2">
        <div className="min-w-0">
          <div className="arena-flip-scene h-[220px] md:h-[300px]">
            <div className={`arena-flip-card ${flipA && !forceFront ? 'is-flipped' : ''}`}>
              <div className={`arena-flip-face arena-flip-front arena-fighter-pane rounded-2xl border border-white/15 p-1.5 transition-transform transition-opacity ${reduceMotion ? 'duration-0' : 'duration-300'} ${borderA} ${liveSide === 'a' ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.28)]' : liveSide === 'b' ? 'opacity-75' : ''} ${dragIntent === 'a' ? 'scale-[1.01] shadow-[0_0_22px_rgba(59,130,246,0.35)]' : dragIntent === 'b' ? 'opacity-80' : ''}`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`rarity-badge px-1.5 py-0.5 rounded-full border text-[8px] font-semibold ${match.cat_a.rarity === 'Rare' ? 'text-blue-100 border-blue-300/45 bg-blue-500/20 rarity-badge--rare' : match.cat_a.rarity === 'Epic' ? 'text-purple-100 border-purple-300/45 bg-purple-500/20 rarity-badge--epic' : match.cat_a.rarity === 'Legendary' ? 'text-amber-100 border-amber-300/45 bg-amber-500/20 rarity-badge--legendary' : match.cat_a.rarity === 'Mythic' ? 'text-fuchsia-100 border-fuchsia-300/45 bg-fuchsia-500/20' : 'text-zinc-100 border-zinc-300/35 bg-zinc-500/20 rarity-badge--common'}`}>
                    {match.cat_a.rarity}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-[8px] text-white/85">LVL {Math.max(1, Number(match.cat_a.level || 1))}</span>
                    <button
                      type="button"
                      onClick={() => {
                        flipTouchedRef.current = true;
                        setFlipA(true);
                      }}
                      aria-label={`Open ${catAName} details`}
                      className="h-4 min-w-4 px-1 rounded-full border border-cyan-300/30 bg-cyan-500/15 text-[8px] text-cyan-100"
                    >
                      i
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    flipTouchedRef.current = true;
                    setFlipA((v) => !v);
                  }}
                  aria-label={`Flip ${catAName} card`}
                  className="block w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                >
                  <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-white/15">
                    <img src={getCatImage(match.cat_a)} alt={catAName} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg'; }} className="w-full h-full object-cover" />
                  </div>
                </button>
                <div className="mt-1">
                  <p className="text-[13px] leading-tight font-semibold truncate">{catAName}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-1 min-w-0 flex-nowrap">
                    <p className="min-w-0 truncate text-[9px] text-white/70">Challenger</p>
                    {guildA ? <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] ${guildA.cls}`}>{guildA.label}</span> : null}
                  </div>
                </div>
              </div>
                <CatCardBack
                  cat={match.cat_a}
                  role="Challenger"
                  votes={Number(match.votes_a || 0)}
                  sharePct={displayPct.a}
                  onClose={() => setFlipA(false)}
                  className={borderA}
                />
            </div>
          </div>
        </div>

        <div className="pt-12 flex flex-col items-center justify-center gap-1">
          <div className="arena-vs-separator text-[9px] text-white/65 font-bold tracking-[0.12em]">VS</div>
        </div>

        <div className="min-w-0">
          <div className="arena-flip-scene h-[220px] md:h-[300px]">
            <div className={`arena-flip-card ${flipB && !forceFront ? 'is-flipped' : ''}`}>
              <div className={`arena-flip-face arena-flip-front arena-fighter-pane rounded-2xl border border-white/15 p-1.5 transition-transform transition-opacity ${reduceMotion ? 'duration-0' : 'duration-300'} ${borderB} ${liveSide === 'b' ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.28)]' : liveSide === 'a' ? 'opacity-75' : ''} ${dragIntent === 'b' ? 'scale-[1.01] shadow-[0_0_22px_rgba(244,63,94,0.35)]' : dragIntent === 'a' ? 'opacity-80' : ''}`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`rarity-badge px-1.5 py-0.5 rounded-full border text-[8px] font-semibold ${match.cat_b.rarity === 'Rare' ? 'text-blue-100 border-blue-300/45 bg-blue-500/20 rarity-badge--rare' : match.cat_b.rarity === 'Epic' ? 'text-purple-100 border-purple-300/45 bg-purple-500/20 rarity-badge--epic' : match.cat_b.rarity === 'Legendary' ? 'text-amber-100 border-amber-300/45 bg-amber-500/20 rarity-badge--legendary' : match.cat_b.rarity === 'Mythic' ? 'text-fuchsia-100 border-fuchsia-300/45 bg-fuchsia-500/20' : 'text-zinc-100 border-zinc-300/35 bg-zinc-500/20 rarity-badge--common'}`}>
                    {match.cat_b.rarity}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-full border border-white/20 bg-white/10 text-[8px] text-white/85">LVL {Math.max(1, Number(match.cat_b.level || 1))}</span>
                    <button
                      type="button"
                      onClick={() => {
                        flipTouchedRef.current = true;
                        setFlipB(true);
                      }}
                      aria-label={`Open ${catBName} details`}
                      className="h-4 min-w-4 px-1 rounded-full border border-cyan-300/30 bg-cyan-500/15 text-[8px] text-cyan-100"
                    >
                      i
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    flipTouchedRef.current = true;
                    setFlipB((v) => !v);
                  }}
                  aria-label={`Flip ${catBName} card`}
                  className="block w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                >
                  <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-white/15">
                    <img src={getCatImage(match.cat_b)} alt={catBName} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg'; }} className="w-full h-full object-cover" />
                  </div>
                </button>
                <div className="mt-1">
                  <p className="text-[13px] leading-tight font-semibold truncate">{catBName}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-1 min-w-0 flex-nowrap">
                    <p className="min-w-0 truncate text-[9px] text-white/70">Defender</p>
                    {guildB ? <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] ${guildB.cls}`}>{guildB.label}</span> : null}
                  </div>
                </div>
              </div>
                <CatCardBack
                  cat={match.cat_b}
                  role="Defender"
                  votes={Number(match.votes_b || 0)}
                  sharePct={displayPct.b}
                  onClose={() => setFlipB(false)}
                  className={borderB}
                />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => void commitVote("tap", match.cat_a.id)}
          aria-label={`Vote for ${catAName}`}
          data-testid="vote-a"
          disabled={!canVote}
          className={`arena-vote-btn arena-vote-btn-a relative h-11 rounded-xl border text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 touch-manipulation ${voted === match.cat_a.id ? 'border-blue-300/60 bg-blue-500/20 text-blue-100' : 'border-white/20 text-white'} disabled:opacity-50`}
        >
          <span className="arena-vote-dot arena-vote-dot-a inline-block w-1.5 h-1.5 rounded-full bg-blue-300" />
          {voteStage === 'pending' && liveSide === 'a' ? 'Submitting…' : voted === match.cat_a.id ? 'Voted A' : (isVoting ? "Voting..." : "Vote A")}
        </button>
        <button
          onClick={() => void commitVote("tap", match.cat_b.id)}
          aria-label={`Vote for ${catBName}`}
          data-testid="vote-b"
          disabled={!canVote}
          className={`arena-vote-btn arena-vote-btn-b relative h-11 rounded-xl border text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 touch-manipulation ${voted === match.cat_b.id ? 'border-rose-300/60 bg-rose-500/20 text-rose-100' : 'border-white/20 text-white'} disabled:opacity-50`}
        >
          <span className="arena-vote-dot arena-vote-dot-b inline-block w-1.5 h-1.5 rounded-full bg-rose-300" />
          {voteStage === 'pending' && liveSide === 'b' ? 'Submitting…' : voted === match.cat_b.id ? 'Voted B' : (isVoting ? "Voting..." : "Vote B")}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/70">
        {match.is_close_match ? (
          <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-300/35 bg-amber-500/12 text-amber-100">Close Match</span>
        ) : (
          <span className={`inline-flex px-2 py-0.5 rounded-full border ${strongerA ? 'border-blue-300/35 bg-blue-500/12 text-blue-100' : 'border-rose-300/35 bg-rose-500/12 text-rose-100'}`}>
            Edge: {strongerA ? 'A' : 'B'} +{edgePct}%
          </span>
        )}
        <span className="arena-vote-pct tabular-nums text-white/55">{displayPct.a}% · {displayPct.b}%</span>
      </div>

      <div className="arena-vote-split mt-1 relative h-1.5 rounded-full overflow-hidden bg-white/8 border border-white/10">
        <div
          className={`arena-vote-split-a absolute left-0 top-0 h-full bg-blue-500 ${reduceMotion ? 'duration-200' : 'duration-500'} transition-[width] ${liveSide === 'a' ? 'shadow-[0_0_12px_rgba(59,130,246,0.55)]' : ''}`}
          style={{ width: `${Math.max(0, Math.min(100, displayPct.a))}%` }}
        />
        <div
          className={`arena-vote-split-b absolute right-0 top-0 h-full bg-red-500 ${reduceMotion ? 'duration-200' : 'duration-500'} transition-[width] ${liveSide === 'b' ? 'shadow-[0_0_12px_rgba(239,68,68,0.55)]' : ''}`}
          style={{ width: `${Math.max(0, Math.min(100, displayPct.b))}%` }}
        />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {!isComplete && !predictedCatId ? (
          <button
            onClick={() => setPredictOpen(true)}
            aria-label="Open prediction panel"
            className="h-9 px-3 rounded-lg border border-cyan-300/30 bg-cyan-500/10 text-cyan-100 text-[11px] font-semibold inline-flex items-center justify-center"
          >
            🔮 Predict
          </button>
        ) : (
          <div className="h-9 inline-flex items-center">
            {(predictedCatId || predictConfirmed) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100">
                Predicted +<SigilIcon className="w-3 h-3" />{match.user_prediction?.bet_sigils || bet}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="h-9 px-3 rounded-lg border border-white/15 bg-white/6 text-white/80 text-[11px] font-semibold inline-flex items-center gap-1"
          aria-label={detailsOpen ? 'Hide analyze section' : 'Open analyze section'}
        >
          {detailsOpen ? 'Hide' : 'Analyze'}
          <span className={`transition-transform duration-150 ${detailsOpen ? 'rotate-180' : ''}`}>⌄</span>
        </button>
      </div>
      {(hasVoted || voteSubmitted || voteConfirm || voteQueued || votePending || parentConfirmed) && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
          {voteStage === 'pending' ? (
            <span className="inline-flex px-2 py-0.5 rounded-full border border-cyan-300/30 bg-cyan-500/12 text-cyan-100">
              Submitting…
            </span>
          ) : (hasVoted || voteSubmitted || parentConfirmed) ? (
            <span className="inline-flex px-2 py-0.5 rounded-full border border-emerald-300/30 bg-emerald-500/15 text-emerald-100">
              Voted ✅
            </span>
          ) : voteConfirm ? (
            <span className="inline-flex px-2 py-0.5 rounded-full border border-emerald-300/30 bg-emerald-500/15 text-emerald-100">
              Voted ✓
            </span>
          ) : null}
          {voteQueued ? (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-300/35 bg-amber-500/12 text-amber-100">Queued</span>
                  {onRefreshQueued ? (
                    <button onClick={() => onRefreshQueued(match.match_id)} className="underline text-cyan-200">Refresh</button>
                  ) : null}
                </span>
          ) : null}
          {votePending && liveSide ? (
            <span className={`inline-flex px-2 py-0.5 rounded-full border ${liveSide === 'a' ? 'border-blue-300/35 bg-blue-500/12 text-blue-100' : 'border-rose-300/35 bg-rose-500/12 text-rose-100'}`}>
              +1
            </span>
          ) : null}
        </div>
      )}

      {predictOpen && !isComplete && !predictedCatId && (
        <>
          <button
            type="button"
            aria-label="Close predict panel"
            onClick={() => setPredictOpen(false)}
            className="sm:hidden fixed inset-0 z-[88] bg-black/45"
          />
          <div className="fixed sm:static inset-x-0 bottom-0 z-[89] sm:z-auto sm:mt-2">
            <div className="rounded-t-2xl sm:rounded-2xl border border-cyan-300/25 bg-[#05131e] p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-cyan-100">Predict Winner</p>
                <button onClick={() => setPredictOpen(false)} className="h-11 min-h-[44px] px-3 rounded-md border border-white/15 bg-white/8 text-[10px] text-white/80 touch-manipulation">Close</button>
              </div>
              <p className="text-[10px] text-white/65">P(A)={displayPct.a}% • up to {payoutA}× · P(B)={displayPct.b}% • up to {payoutB}×</p>
              {(underdogA || underdogB) && <p className="mt-1 text-[10px] text-amber-200">Underdogs pay more</p>}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map((chip) => (
                  <button
                    key={`${match.match_id}-sheet-${chip}`}
                    disabled={chip > availableSigils}
                    onClick={() => setBet(chip)}
                    className={`h-8 rounded-lg text-[10px] border ${bet === chip ? 'border-amber-300 text-amber-200 bg-amber-500/15' : 'border-white/15 text-white/70 bg-white/5'} disabled:opacity-40`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  disabled={predictBusy || bet > availableSigils}
                  onClick={async () => {
                    const ok = await onPredict(match.match_id, match.cat_a.id, bet);
                    if (ok) setPredictOpen(false);
                  }}
                  aria-label={`Predict ${catAName} for ${bet} sigils`}
                  className="h-11 rounded-lg bg-blue-500/15 text-blue-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-40"
                >
                  Predict A (+<SigilIcon className="w-3 h-3" />{bet})
                </button>
                <button
                  disabled={predictBusy || bet > availableSigils}
                  onClick={async () => {
                    const ok = await onPredict(match.match_id, match.cat_b.id, bet);
                    if (ok) setPredictOpen(false);
                  }}
                  aria-label={`Predict ${catBName} for ${bet} sigils`}
                  className="h-11 rounded-lg bg-red-500/15 text-red-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-40"
                >
                  Predict B (+<SigilIcon className="w-3 h-3" />{bet})
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {detailsOpen && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2.5 space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-cyan-100">Power A: {Math.round(aPower)}</span>
              <span className="text-cyan-100">Power B: {Math.round(bPower)}</span>
            </div>
            <div className="mt-1 h-1 rounded-full overflow-hidden bg-white/10 flex">
              <div
                className="h-full w-full bg-blue-500 origin-left transition-transform duration-300"
                style={{ transform: `scaleX(${Math.max(0.08, Math.min(1, (strongerA ? 50 + edgePct : 50 - edgePct) / 100))})` }}
              />
              <div
                className="h-full w-full -ml-full bg-rose-500 origin-right transition-transform duration-300"
                style={{ transform: `scaleX(${Math.max(0.08, Math.min(1, (strongerA ? 50 - edgePct : 50 + edgePct) / 100))})` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <span className="text-white/55">Stat</span>
            <span className="text-blue-200 text-right">A</span>
            <span className="text-rose-200 text-right">B</span>
            <span className="text-red-200">ATK</span><span className="text-right">{statsA.attack}</span><span className="text-right">{statsB.attack}</span>
            <span className="text-cyan-200">DEF</span><span className="text-right">{statsA.defense}</span><span className="text-right">{statsB.defense}</span>
            <span className="text-emerald-200">SPD</span><span className="text-right">{statsA.speed}</span><span className="text-right">{statsB.speed}</span>
            <span className="text-violet-200">CHA</span><span className="text-right">{statsA.charisma}</span><span className="text-right">{statsB.charisma}</span>
            <span className="text-amber-200">CHS</span><span className="text-right">{statsA.chaos}</span><span className="text-right">{statsB.chaos}</span>
          </div>

          <p className="text-[10px] text-white/65">{edgePct <= 3 ? 'Stat edge is balanced.' : `${strongerA ? catAName : catBName} has a ${edgePct}% stat edge.`}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[10px] text-white/60 mb-1">{catAName} cosmetics</p>
              <div className="space-y-1">
                {cosmeticsA.slice(0, 4).map((c) => (
                  <div key={`a-full-${c.slot}`} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate">{c.icon} {c.label}</span>
                    {c.previewable ? <button onClick={() => setPreviewToast(`${c.label} preview`)} className="px-1.5 py-0.5 rounded border border-cyan-300/30 bg-cyan-500/10 text-cyan-100">Preview</button> : null}
                  </div>
                ))}
                {cosmeticsA.length === 0 && <p className="text-[10px] text-white/45">No cosmetics equipped</p>}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[10px] text-white/60 mb-1">{catBName} cosmetics</p>
              <div className="space-y-1">
                {cosmeticsB.slice(0, 4).map((c) => (
                  <div key={`b-full-${c.slot}`} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate">{c.icon} {c.label}</span>
                    {c.previewable ? <button onClick={() => setPreviewToast(`${c.label} preview`)} className="px-1.5 py-0.5 rounded border border-cyan-300/30 bg-cyan-500/10 text-cyan-100">Preview</button> : null}
                  </div>
                ))}
                {cosmeticsB.length === 0 && <p className="text-[10px] text-white/45">No cosmetics equipped</p>}
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                const nextOpen = !commentsOpen;
                setCommentsOpen(nextOpen);
                if (nextOpen && !commentsLoaded && !commentsBusy) {
                  loadComments();
                }
              }}
              className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/85 text-[11px] font-semibold inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </button>
          </div>

          {commentsOpen && (
            <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
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
                      className="flex-1 h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
                    />
                    <button
                      disabled={commentPosting || !commentText.trim()}
                      onClick={handlePostComment}
                      className="h-9 px-3 rounded-lg bg-cyan-500/20 border border-cyan-300/30 text-cyan-200 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1"
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
            className="h-9 px-3 rounded-lg bg-cyan-500/15 text-cyan-200 text-[11px] font-semibold inline-flex items-center justify-center disabled:opacity-50"
          >
            {calloutBusy ? 'Creating...' : 'Create Callout'}
          </button>
        </div>
      )}

      {predictedCatId && (
        <div className="mt-1 text-[10px]">
          <span className="inline-flex px-2 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-100">Return at next Pulse</span>
        </div>
      )}
      {exitingVisual && (
        <div className="mt-1 text-[10px] text-cyan-200/90 animate-pulse">Next matchup loading...</div>
      )}
      </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.match === next.match &&
    prev.voted === next.voted &&
    prev.isVoting === next.isVoting &&
    prev.predictBusy === next.predictBusy &&
    prev.calloutBusy === next.calloutBusy &&
    prev.socialEnabled === next.socialEnabled &&
    prev.availableSigils === next.availableSigils &&
    prev.voteStreak === next.voteStreak &&
    prev.isExiting === next.isExiting &&
    prev.voteQueued === next.voteQueued &&
    prev.showNextUp === next.showNextUp &&
    prev.slotPhase === next.slotPhase &&
    prev.slotChosenSide === next.slotChosenSide &&
    prev.enterPhase === next.enterPhase &&
    prev.isRefilling === next.isRefilling &&
    prev.resetFlipSignal === next.resetFlipSignal &&
    prev.onVote === next.onVote &&
    prev.onPredict === next.onPredict &&
    prev.onCreateCallout === next.onCreateCallout &&
    prev.onRefreshQueued === next.onRefreshQueued &&
    prev.onVoteAccepted === next.onVoteAccepted
  );
});

// ── Arena Section ──
function ArenaSection({
  arena, votedMatches, voteSnapshotByMatchId, votingMatch, predictBusyMatch, calloutBusyMatch, socialEnabled, availableSigils, voteStreak, hotMatchBiasEnabled, testerMode = false, onVote, onPredict, onCreateCallout, onRequestMore, globalPageInfo, pulseCountdown, onSwitchArena, debugInfo, queueInfo, debugMode = false,
}: {
  arena: Arena; votedMatches: Record<string, string>;
  voteSnapshotByMatchId: Record<string, VoteSnapshot>;
  votingMatch: string | null;
  predictBusyMatch: string | null;
  calloutBusyMatch: string | null;
  socialEnabled: boolean;
  availableSigils: number;
  voteStreak: number;
  hotMatchBiasEnabled?: boolean;
  testerMode?: boolean;
  globalPageInfo?: GlobalArenaPageInfo | null;
  pulseCountdown?: string;
  onSwitchArena?: (arena: 'main' | 'rookie') => void;
  debugInfo?: ArenaInventoryDebug | null;
  queueInfo?: ArenaQueuePageInfo | null;
  debugMode?: boolean;
  onVote: (matchId: string, catId: string) => Promise<boolean>;
  onPredict: (matchId: string, catId: string, bet: number) => Promise<boolean>;
  onCreateCallout: (matchId: string, catId: string) => void;
  onRequestMore?: () => Promise<ArenaRefreshResult>;
}) {
  type SlotUiState = { phase: "idle" | "voted" | "exiting"; chosenSide: "a" | "b" | null };
  const config = getArenaConfig(arena.type);
  const [segment, setSegment] = useState<"voting" | "results">("voting");
  const [stackIds, setStackIds] = useState<string[]>([]);
  const [slotUiByMatchId, setSlotUiByMatchId] = useState<Record<string, SlotUiState>>({});
  const [queuedVotes, setQueuedVotes] = useState<Record<string, boolean>>({});
  const [prunedMatchIds, setPrunedMatchIds] = useState<Record<string, boolean>>({});
  const [nextUpId, setNextUpId] = useState<string | null>(null);
  const [stackReady, setStackReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cursorRef = useRef(0);
  const mountedRef = useRef(true);
  const presentMatchIdsRef = useRef<Set<string>>(new Set());
  const transitionTimeoutsRef = useRef<Map<string, number[]>>(new Map());
  const keepUntilTimersRef = useRef<Map<string, number>>(new Map());
  const autoTopupBusyRef = useRef(false);
  const lastAutoTopupAtRef = useRef(0);
  const lowInventoryRetryKeyRef = useRef('');
  const deckInitKeyRef = useRef('');
  const suppressVotedPruneUntilRef = useRef(0);
  const keepVisibleVoteMatchIdsRef = useRef<Set<string>>(new Set());
  const votedRenderDebugSeenRef = useRef<Set<string>>(new Set());
  const prunedMatchIdsRef = useRef<Record<string, boolean>>({});
  const votedMatchesRef = useRef<Record<string, string>>({});
  const queuedVotesStateRef = useRef<Record<string, boolean>>({});
  const prunedMatchIdsStateRef = useRef<Record<string, boolean>>({});
  const stackIdsRef = useRef<string[]>([]);
  const keepUntilByMatchIdRef = useRef<Record<string, number>>({});
  const onVoteRef = useRef(onVote);
  const onPredictRef = useRef(onPredict);
  const onCreateCalloutRef = useRef(onCreateCallout);
  const refillRequestSeqRef = useRef(0);
  const preserveSnapshotOnEmptyRef = useRef(false);
  const refillSettleTimerRef = useRef<number | null>(null);
  const lastRefillCallAtRef = useRef(0);
  const deckEnterTimerRef = useRef<number | null>(null);
  const hotStreakTimerRef = useRef<number | null>(null);
  const prevTopMatchIdRef = useRef<string | null>(null);
  const prevVoteStreakRef = useRef(0);
  const lastResetKeyRef = useRef<string>('');
  const lastOrderSigRef = useRef<string>('');
  const [snapshotOrder, setSnapshotOrder] = useState<string[]>([]);
  const [snapshotById, setSnapshotById] = useState<Record<string, ArenaMatch>>({});
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [feedStatus, setFeedStatus] = useState<"ready" | "refilling" | "transitioning" | "error">("ready");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refillRetryAttempt, setRefillRetryAttempt] = useState(0);
  const [showManualRefresh, setShowManualRefresh] = useState(false);
  const [deckEnterPhase, setDeckEnterPhase] = useState<"idle" | "entering">("idle");
  const [showHotStreakBanner, setShowHotStreakBanner] = useState(false);
  const [hotStreakTick, setHotStreakTick] = useState(0);
  const [keepUntilByMatchId, setKeepUntilByMatchId] = useState<Record<string, number>>({});
  const MAX_VISIBLE = 6;
  const EXIT_MS = 180;
  const SWAP_DELAY_MS = 80;
  const currentRound = arena.rounds.find((r) => r.round === arena.current_round);
  const allArenaMatches = [...arena.rounds].reverse().flatMap((r) => r.matches || []).filter((m) => !isByeMatch(m));
  const voting = (currentRound?.matches || []).filter((m) => !isByeMatch(m) && isArenaVotingStatus(m.status));
  const [globalResults, setGlobalResults] = useState<ArenaMatch[]>([]);
  const fallbackResults = useMemo(() => {
    const out: ArenaMatch[] = [];
    const seen = new Set<string>();
    for (const m of allArenaMatches) {
      const id = String(m.match_id || '');
      if (!id || seen.has(id)) continue;
      const isVotedByUser = !!votedMatches[id];
      if (!(isArenaCompleteStatus(m.status) || isVotedByUser)) continue;
      seen.add(id);
      out.push(m);
    }
    return out;
  }, [allArenaMatches, votedMatches]);
  const results = globalResults.length > 0 ? globalResults : fallbackResults;
  const orderedVoting = useMemo(() => {
    if (globalPageInfo) return voting;
    const arranged = arrangeWithCatSpacing(voting, 10);
    if (arranged.length <= 1) return arranged;

    const scored = arranged.map((m) => {
  const [aPct, bPct] = getVotePercent(m);
      const margin = Math.abs(aPct - bPct);
      const energy = computeMatchEnergy(m, 0);
      const tension = margin < 15 || energy >= 45 || !!m.is_close_match;
      return { m, margin, energy, tension };
    });

    // Main arena favors tension-heavy close matches at the top.
    if (arena.type === 'main' || hotMatchBiasEnabled) {
      const tense = scored.filter((x) => x.tension).sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin));
      const rest = scored.filter((x) => !x.tension).sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin));
      return [...tense, ...rest].map((x) => x.m);
    }

    return scored.sort((a, b) => (b.energy - a.energy) || (a.margin - b.margin)).map((x) => x.m);
  }, [arena.type, globalPageInfo, hotMatchBiasEnabled, voting]);

  const visiblePageOrderBase = useMemo(() => {
    if (orderedVoting.length <= MAX_VISIBLE) return orderedVoting;
    const out: ArenaMatch[] = [];
    const used = new Set<string>();

    for (let i = 0; i < orderedVoting.length; i += MAX_VISIBLE) {
      const window = orderedVoting
        .slice(i, i + 18)
        .filter((m) => !used.has(String(m.match_id || "")));
      const picked = pickFairMatches(window, MAX_VISIBLE, {
        maxPerOwner: 1,
        avoidSameOwnerMatch: true,
      });

      if (picked.length > 0) {
        for (const m of picked) {
          const id = String(m.match_id || "");
          if (!id || used.has(id)) continue;
          used.add(id);
          out.push(m);
        }
      } else {
        const fallback = window.slice(0, MAX_VISIBLE);
        for (const m of fallback) {
          const id = String(m.match_id || "");
          if (!id || used.has(id)) continue;
          used.add(id);
          out.push(m);
        }
      }
    }

    // Keep any unconsumed matches reachable for graceful degradation.
    for (const m of orderedVoting) {
      const id = String(m.match_id || "");
      if (!id || used.has(id)) continue;
      used.add(id);
      out.push(m);
    }
    return out;
  }, [orderedVoting]);

  const shouldKeepInUI = useCallback((matchId: string): boolean => {
    if (!matchId) return false;
    const keepUntil = Number(keepUntilByMatchId[matchId] || 0);
    if (keepUntil > Date.now()) return true;
    if (keepVisibleVoteMatchIdsRef.current.has(matchId)) return true;
    const slotUi = slotUiByMatchId[matchId];
    if (slotUi && slotUi.phase !== "idle") return true;
    if (votingMatch === matchId) return true;
    if (queuedVotes[matchId]) return true;
    return false;
  }, [keepUntilByMatchId, queuedVotes, slotUiByMatchId, votingMatch]);
  const visiblePageOrder = useMemo(
    () =>
      visiblePageOrderBase.filter((m) => {
        const id = String(m.match_id || '');
        if (!id) return false;
        if (debugMode) return true;
        if (queuedVotes[id]) return true;
        if (shouldKeepInUI(id)) return true;
        if (prunedMatchIds[id]) return false;
        return !votedMatches[id];
      }),
    [debugMode, prunedMatchIds, queuedVotes, shouldKeepInUI, visiblePageOrderBase, votedMatches]
  );
  const votingById = useMemo(() => new Map(visiblePageOrderBase.map((m) => [m.match_id, m])), [visiblePageOrderBase]);
  const votedMatchesSig = useMemo(() => Object.keys(votedMatches).sort().join('|'), [votedMatches]);
  const queuedVotesSig = useMemo(() => Object.keys(queuedVotes).sort().join('|'), [queuedVotes]);
  const prunedMatchIdsSig = useMemo(
    () => Object.keys(prunedMatchIds).filter((id) => !!prunedMatchIds[id]).sort().join('|'),
    [prunedMatchIds]
  );
  const isVotableForUser = useCallback((id: string): boolean => {
    if (!id) return false;
    if (debugMode) return true;
    if (prunedMatchIdsStateRef.current[id] && !shouldKeepInUI(id)) return false;
    if (queuedVotesStateRef.current[id]) return true;
    if (shouldKeepInUI(id)) return true;
    return !votedMatchesRef.current[id];
  }, [debugMode, prunedMatchIdsSig, queuedVotesSig, shouldKeepInUI, votedMatchesSig]);
  const resultsList = useMemo(() => results.slice(0, MAX_VISIBLE), [results]);
  const activeVoting = useMemo(
    () =>
      stackIds
        .map((id) => votingById.get(id))
        .filter((m): m is ArenaMatch => !!m)
        .filter((m) => isVotableForUser(m.match_id)),
    [isVotableForUser, stackIds, votingById]
  );
  const activeList = segment === "voting" ? activeVoting : resultsList;
  const totalVotableCount = useMemo(() => visiblePageOrder.length, [visiblePageOrder]);
  const remainingForUserCount = useMemo(
    () => visiblePageOrder.filter((m) => {
      const id = String(m.match_id || '');
      if (!id) return false;
      if (queuedVotes[id]) return true;
      return !votedMatches[id];
    }).length,
    [queuedVotes, visiblePageOrder, votedMatches]
  );
  const queueSuggestsMore = useMemo(() => {
    const totalSize = Math.max(0, Number(queueInfo?.totalSize || 0));
    const votedCount = Math.max(0, Number(queueInfo?.votedCount || 0));
    const pageComplete = !!queueInfo?.pageComplete;
    if (pageComplete) return false;
    if (totalSize <= 0) return true;
    return votedCount < totalSize;
  }, [queueInfo?.pageComplete, queueInfo?.totalSize, queueInfo?.votedCount]);
  const hasLocalUnvotedOrQueued = remainingForUserCount > 0;
  const hasMoreFightsForUser =
    segment === 'voting' && (hasLocalUnvotedOrQueued || queueSuggestsMore);
  const userCaughtUp = segment === 'voting' && !hasMoreFightsForUser;
  const hasSlotTransition = useMemo(
    () => Object.values(slotUiByMatchId).some((state) => state.phase !== "idle"),
    [slotUiByMatchId]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const debugEnabled = process.env.NODE_ENV !== 'production' || debugMode;
    if (!debugEnabled) return;
    const renderableAfterExclusion = activeVoting.length;
    for (const match of activeVoting) {
      const id = String(match.match_id || '');
      if (!id) continue;
      if (!votedMatches[id]) continue;
      const dedupeKey = `${id}:${votedMatches[id]}:${queuedVotes[id] ? '1' : '0'}:${Number(keepUntilByMatchId[id] || 0)}`;
      if (votedRenderDebugSeenRef.current.has(dedupeKey)) continue;
      votedRenderDebugSeenRef.current.add(dedupeKey);
      // eslint-disable-next-line no-console
      console.warn('[VOTE_DECK_DEBUG] already-voted rendered', {
        match_id: id,
        votedMatch: votedMatches[id] || null,
        queuedVote: !!queuedVotes[id],
        keepUntil: Number(keepUntilByMatchId[id] || 0),
        renderableAfterExclusion,
      });
    }
  }, [activeVoting, debugMode, keepUntilByMatchId, queuedVotes, votedMatches]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (segment !== 'voting') return;
    for (const matchId of stackIds) {
      if (!prunedMatchIds[matchId]) continue;
      if (shouldKeepInUI(matchId)) continue;
      // eslint-disable-next-line no-console
      console.warn('[VOTE_DECK_BUG] voted match still in deck', {
        match_id: matchId,
        voted: votedMatches[matchId] || null,
        stackIdsLength: stackIds.length,
      });
    }
  }, [prunedMatchIds, segment, shouldKeepInUI, stackIds, votedMatches]);

  const clearTransitionTimeoutsFor = useCallback((matchId: string) => {
    const bucket = transitionTimeoutsRef.current.get(matchId);
    if (!bucket?.length) return;
    for (const tid of bucket) window.clearTimeout(tid);
    transitionTimeoutsRef.current.delete(matchId);
  }, []);

  const clearAllTransitionTimeouts = useCallback(() => {
    for (const ids of transitionTimeoutsRef.current.values()) {
      for (const tid of ids) window.clearTimeout(tid);
    }
    transitionTimeoutsRef.current.clear();
  }, []);

  const clearKeepUntilTimer = useCallback((matchId: string) => {
    const tid = keepUntilTimersRef.current.get(matchId);
    if (typeof tid === 'number') {
      window.clearTimeout(tid);
      keepUntilTimersRef.current.delete(matchId);
    }
  }, []);

  const queueTransitionTimeout = useCallback((matchId: string, ms: number, fn: () => void) => {
    const tid = window.setTimeout(() => {
      const bucket = transitionTimeoutsRef.current.get(matchId);
      if (bucket?.length) {
        const next = bucket.filter((id) => id !== tid);
        if (next.length) transitionTimeoutsRef.current.set(matchId, next);
        else transitionTimeoutsRef.current.delete(matchId);
      }
      if (!mountedRef.current) return;
      if (!presentMatchIdsRef.current.has(matchId)) return;
      fn();
    }, ms);
    const bucket = transitionTimeoutsRef.current.get(matchId) || [];
    bucket.push(tid);
    transitionTimeoutsRef.current.set(matchId, bucket);
    return tid;
  }, []);

  const clearRefillSettleTimer = useCallback(() => {
    if (refillSettleTimerRef.current === null) return;
    window.clearTimeout(refillSettleTimerRef.current);
    refillSettleTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTransitionTimeouts();
      clearRefillSettleTimer();
      if (deckEnterTimerRef.current !== null) {
        window.clearTimeout(deckEnterTimerRef.current);
        deckEnterTimerRef.current = null;
      }
      if (hotStreakTimerRef.current !== null) {
        window.clearTimeout(hotStreakTimerRef.current);
        hotStreakTimerRef.current = null;
      }
      for (const tid of keepUntilTimersRef.current.values()) window.clearTimeout(tid);
      keepUntilTimersRef.current.clear();
    };
  }, [clearAllTransitionTimeouts, clearRefillSettleTimer]);

  useEffect(() => {
    const present = new Set(visiblePageOrder.map((m) => m.match_id).filter(Boolean));
    presentMatchIdsRef.current = present;
    const staleIds: string[] = [];
    for (const matchId of transitionTimeoutsRef.current.keys()) {
      if (!present.has(matchId)) staleIds.push(matchId);
    }
    if (!staleIds.length) return;
    for (const matchId of staleIds) clearTransitionTimeoutsFor(matchId);
    for (const matchId of staleIds) clearKeepUntilTimer(matchId);
    setSlotUiByMatchId((prev) => {
      let changed = false;
      const next: Record<string, SlotUiState> = {};
      for (const [id, state] of Object.entries(prev)) {
        if (!present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = state;
      }
      return changed ? next : prev;
    });
    setQueuedVotes((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [id, state] of Object.entries(prev)) {
        if (!present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = state;
      }
      return changed ? next : prev;
    });
    setKeepUntilByMatchId((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, ts] of Object.entries(prev)) {
        if (!present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = ts;
      }
      return changed ? next : prev;
    });
    setPrunedMatchIds((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [id, state] of Object.entries(prev)) {
        if (!present.has(id)) {
          changed = true;
          continue;
        }
        next[id] = state;
      }
      return changed ? next : prev;
    });
  }, [clearKeepUntilTimer, clearTransitionTimeoutsFor, visiblePageOrder]);

  function pullNextMatchId(excluded: Set<string>): string | null {
    for (let i = cursorRef.current; i < visiblePageOrder.length; i += 1) {
      const id = visiblePageOrder[i]?.match_id;
      if (!id) continue;
      if (excluded.has(id)) continue;
      if (!isVotableForUser(id)) continue;
      cursorRef.current = i + 1;
      return id;
    }
    if (testerMode) {
      for (let i = 0; i < visiblePageOrder.length; i += 1) {
        const id = visiblePageOrder[i]?.match_id;
        if (!id) continue;
        if (excluded.has(id)) continue;
        if (!isVotableForUser(id)) continue;
        cursorRef.current = i + 1;
        return id;
      }
    }
    return null;
  }

  function fillStackToFour(seed: string[]): string[] {
    const next = [...seed];
    const excluded = new Set(next);
    Object.keys(prunedMatchIdsRef.current || {}).forEach((id) => {
      if (prunedMatchIdsRef.current[id]) excluded.add(id);
    });
    if (!debugMode) {
      Object.keys(votedMatches).forEach((id) => excluded.add(id));
      Object.keys(queuedVotes).forEach((id) => excluded.add(id));
    }
    while (next.length < MAX_VISIBLE) {
      const id = pullNextMatchId(excluded);
      if (!id) break;
      next.push(id);
      excluded.add(id);
    }
    return next;
  }

  const replaceCard = useCallback((matchId: string, onResolved?: (result: { replaced: boolean; insertedId: string | null }) => void) => {
    setStackIds((prev) => {
      const index = prev.indexOf(matchId);
      if (index < 0) {
        const filled = fillStackToFour(prev);
        onResolved?.({ replaced: filled.length >= prev.length, insertedId: null });
        return filled;
      }
      const next = [...prev];
      next.splice(index, 1);
      const filled = fillStackToFour(next);
      const replaced = filled.length >= prev.length;
      const insertedId = replaced ? filled[index] || null : null;
      onResolved?.({ replaced, insertedId });
      return filled;
    });
  }, [fillStackToFour]);

  useEffect(() => {
    stackIdsRef.current = stackIds;
  }, [stackIds]);

  useEffect(() => {
    keepUntilByMatchIdRef.current = keepUntilByMatchId;
  }, [keepUntilByMatchId]);

  useEffect(() => {
    prunedMatchIdsRef.current = prunedMatchIds;
  }, [prunedMatchIds]);
  useEffect(() => {
    votedMatchesRef.current = votedMatches;
  }, [votedMatchesSig]);
  useEffect(() => {
    queuedVotesStateRef.current = queuedVotes;
  }, [queuedVotesSig]);
  useEffect(() => {
    prunedMatchIdsStateRef.current = prunedMatchIds;
  }, [prunedMatchIdsSig]);

  useEffect(() => {
    if (segment !== 'voting') {
      deckInitKeyRef.current = '';
      setStackReady(false);
      return;
    }
  }, [segment]);

  const resetKey = `${String(arena.tournament_id || '')}:${arena.type}:${segment}`;
  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    if (segment !== 'voting') return;
    if (Object.keys(keepUntilByMatchId).some((id) => shouldKeepInUI(id))) return;
    const initKey = [
      String(arena.tournament_id || ''),
      visiblePageOrder.map((m) => String(m.match_id || '')).join(','),
      Object.keys(votedMatches).sort().join(','),
    ].join('|');
    if (deckInitKeyRef.current === initKey) return;
    deckInitKeyRef.current = initKey;
    clearAllTransitionTimeouts();
    const votedSet = new Set(Object.keys(votedMatches));
    const initial: string[] = [];
    let i = 0;
    for (; i < visiblePageOrder.length && initial.length < MAX_VISIBLE; i += 1) {
      const id = visiblePageOrder[i]?.match_id;
      if (!id || votedSet.has(id)) continue;
      initial.push(id);
    }
    cursorRef.current = i;
    setSlotUiByMatchId({});
    setStackIds(initial);
    setQueuedVotes({});
    setPrunedMatchIds({});
    setKeepUntilByMatchId({});
    setNextUpId(null);
    setStackReady(true);
  }, [clearAllTransitionTimeouts, keepUntilByMatchId, resetKey, segment, shouldKeepInUI, visiblePageOrder, votedMatches]);

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
    if (Date.now() < suppressVotedPruneUntilRef.current) return;
    if (hasSlotTransition) return;
    if (votingMatch) return;
    const hasVotedCardsInStack = stackIds.some((id) => !!votedMatches[id]);
    if (!hasVotedCardsInStack) return;
    setStackIds((prev) => {
      const next = fillStackToFour(prev.filter((id) => isVotableForUser(id)));
      return next.join('|') === prev.join('|') ? prev : next;
    });
  }, [hasSlotTransition, isVotableForUser, segment, stackIds, votedMatches, votingMatch]);

  useEffect(() => {
    if (segment !== 'voting') return;
    const topped = fillStackToFour(stackIds);
    if (topped.length !== stackIds.length) {
      setStackIds(topped);
    }
  }, [segment, stackIds, visiblePageOrder, votedMatches]);

  const refillArena = useCallback(
    async (reason: "manual" | "auto-empty" | "auto-low" | "queued" = "manual"): Promise<boolean> => {
      if (!onRequestMore) return false;
      const now = Date.now();
      if (now - lastRefillCallAtRef.current < 900) return false;
      if ((reason === 'auto-empty' || reason === 'auto-low') && feedStatus !== 'ready') return false;
      if ((reason === 'manual' || reason === 'queued') && !(feedStatus === 'ready' || feedStatus === 'error')) return false;
      if (refillRequestSeqRef.current > 0 && feedStatus === "refilling") return false;
      lastRefillCallAtRef.current = now;
      clearRefillSettleTimer();
      const reqId = ++refillRequestSeqRef.current;
      preserveSnapshotOnEmptyRef.current = true;
      setFeedStatus("refilling");
      setFeedError(null);
      setShowManualRefresh(false);
      setRefillRetryAttempt((prev) => (reason === "manual" ? prev : prev + 1));
      const result = await onRequestMore().catch(() => ({ ok: false, count: 0 } as ArenaRefreshResult));
      if (!mountedRef.current || reqId !== refillRequestSeqRef.current) return false;
      if (result?.ok && Number(result.count || 0) > 0) {
        setFeedStatus("transitioning");
        setFeedError(null);
        setShowManualRefresh(false);
        const settleMs = reduceMotion ? 80 : 220;
        refillSettleTimerRef.current = window.setTimeout(() => {
          refillSettleTimerRef.current = null;
          if (!mountedRef.current || reqId !== refillRequestSeqRef.current) return;
          setFeedStatus("ready");
          setRefillRetryAttempt(0);
        }, settleMs);
        return true;
      }
      const noAdditionalFights =
        Number(result?.renderableCount || 0) <= 0 &&
        (result?.pageComplete || (!hasMoreFightsForUser && reason !== 'manual'));
      if (noAdditionalFights) {
        setFeedStatus('ready');
        setFeedError(null);
        setShowManualRefresh(false);
        return false;
      }
      clearRefillSettleTimer();
      setFeedStatus("error");
      setFeedError("Arena is reloading.");
      setShowManualRefresh(true);
      return false;
    },
    [clearRefillSettleTimer, feedStatus, hasMoreFightsForUser, onRequestMore, reduceMotion]
  );

  useEffect(() => {
    if (segment !== 'voting') return;
    if (!stackReady) return;
    if (!hasMoreFightsForUser) return;
    if (!onRequestMore) return;
    if (votingMatch || hasSlotTransition) return;
    if (feedStatus !== 'ready') return;
    // If we still have a visible snapshot, do not auto-refill again.
    if (snapshotOrder.length > 0) return;
    if (activeVoting.length !== 0) return;
    if (autoTopupBusyRef.current) return;
    const now = Date.now();
    if (now - lastAutoTopupAtRef.current < 900) return;

    autoTopupBusyRef.current = true;
    lastAutoTopupAtRef.current = now;
    refillArena('auto-empty')
      .then((ok) => {
        if (ok) setQueuedVotes({});
      })
      .finally(() => {
        autoTopupBusyRef.current = false;
      });
  }, [activeVoting.length, feedStatus, hasMoreFightsForUser, hasSlotTransition, onRequestMore, refillArena, segment, snapshotOrder.length, stackReady, votingMatch]);

  const stackLead = activeVoting[0];
  const stackSecond = activeVoting[1];
  const stackVelocity = useMemo(() => {
    const base = [stackLead, stackSecond].filter((m): m is ArenaMatch => !!m);
    if (!base.length) return null;
    const total = base.reduce((sum, m) => sum + Number(m.votes_a || 0) + Number(m.votes_b || 0), 0);
    return `+${Math.max(0, Math.round(total / 2))} votes in this cycle`;
  }, [stackLead, stackSecond]);
  const lowInventory = segment === 'voting' && activeVoting.length > 0 && activeVoting.length < MAX_VISIBLE;
  const isRefilling = feedStatus === 'refilling' || feedStatus === 'transitioning';
  const flipResetSignal = `${feedStatus}:${snapshotVersion}:${refillRetryAttempt}`;
  const activeSig = useMemo(() => activeVoting.map((m) => m.match_id).join('|'), [activeVoting]);
  const activeById = useMemo(() => {
    const next: Record<string, ArenaMatch> = {};
    for (const m of activeVoting) next[m.match_id] = m;
    return next;
  }, [activeSig]);
  useEffect(() => {
    if (segment !== 'voting') return;
    const nextOrder = Object.keys(activeById).filter(Boolean);
    const nextById = activeById;

    if (nextOrder.length > 0) {
      preserveSnapshotOnEmptyRef.current = false;
    }

    if (nextOrder.length === 0 && snapshotOrder.length > 0 && preserveSnapshotOnEmptyRef.current) {
      if (feedStatus !== 'error') {
        setFeedStatus('error');
        setFeedError('Arena refill returned no matches.');
        setShowManualRefresh(true);
      }
      return;
    }

    // Refill returned data but none are vote-renderable. Stop auto cycling and require explicit retry.
    if (nextOrder.length === 0 && snapshotOrder.length === 0 && feedStatus === 'transitioning' && hasMoreFightsForUser) {
      setFeedStatus('error');
      setFeedError('No new votable matches right now.');
      setShowManualRefresh(true);
      return;
    }

    // Keep prior snapshot visible while refilling/transitioning/error if the new pull is empty.
    if (nextOrder.length === 0 && (feedStatus === 'refilling' || feedStatus === 'transitioning' || feedStatus === 'error')) {
      if (userCaughtUp) {
        setSnapshotOrder((prev) => (prev.length === 0 ? prev : []));
        setSnapshotById((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      }
      return;
    }
    const nextOrderKey = nextOrder.join('|');
    const orderChanged = snapshotOrder.join('|') !== nextOrderKey;
    if (orderChanged) {
      setSnapshotOrder(nextOrder);
      setSnapshotVersion((v) => v + 1);
    }
    setSnapshotById((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextById);
      if (prevKeys.length !== nextKeys.length) return nextById;
      for (const key of nextKeys) {
        if (prev[key] !== nextById[key]) return nextById;
      }
      return prev;
    });
  }, [activeVoting, feedStatus, hasMoreFightsForUser, segment, snapshotVersion, snapshotOrder.length, userCaughtUp]);

  const votingSlots = useMemo(() => {
    if (segment !== 'voting') return [] as Array<{ key: string; match: ArenaMatch | null }>;
    const ids = snapshotOrder.filter((id) => !!snapshotById[id]);
    return ids.map((id) => ({
      key: id,
      match: snapshotById[id] || null,
    }));
  }, [segment, snapshotById, snapshotOrder]);
  const hasRenderableVotingMatch = useMemo(
    () => votingSlots.some((slot) => !!slot?.match),
    [votingSlots],
  );
  const topVotingSlot = segment === 'voting' ? (votingSlots[0] || null) : null;
  const nextVotingSlot = segment === 'voting' ? (votingSlots[1] || null) : null;
  const showAllVotedState =
    segment === 'voting' &&
    activeVoting.length === 0 &&
    userCaughtUp;
  const showAllVotedModule =
    segment === 'voting' &&
    (showAllVotedState || !hasRenderableVotingMatch);
  const isStableVotingEmpty =
    segment === 'voting' &&
    !hasRenderableVotingMatch;
  const shouldShowEmptyModule = isStableVotingEmpty || (segment !== 'voting' && activeList.length === 0);
  const refillProbeLoggedRef = useRef(false);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (refillProbeLoggedRef.current) return;
    if (segment !== 'voting' || !isRefilling || !topVotingSlot?.match) return;
    const timer = window.setTimeout(() => {
      const card = document.querySelector('.arena-match-card') as HTMLElement | null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = Math.floor(rect.left + rect.width / 2);
      const y = Math.floor(rect.top + rect.height / 2);
      const top = document.elementFromPoint(x, y) as HTMLElement | null;
      const style = top ? window.getComputedStyle(top) : null;
      // eslint-disable-next-line no-console
      console.log('[DEV][arena-card-center-probe]', {
        point: { x, y },
        topTag: top?.tagName || null,
        topClass: top?.className || null,
        topPointerEvents: style?.pointerEvents || null,
        topZIndex: style?.zIndex || null,
      });
      refillProbeLoggedRef.current = true;
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isRefilling, segment, topVotingSlot?.match?.match_id]);
  useEffect(() => {
    if (segment !== 'voting') return;
    if (!userCaughtUp) return;
    if (feedStatus === 'ready' && !feedError && !showManualRefresh) return;
    setFeedStatus('ready');
    setFeedError(null);
    setShowManualRefresh(false);
  }, [feedError, feedStatus, segment, showManualRefresh, userCaughtUp]);
  useEffect(() => {
    if (segment !== 'voting') return;
    const topId = topVotingSlot?.match?.match_id || null;
    if (!topId) return;
    if (prevTopMatchIdRef.current === topId) return;
    prevTopMatchIdRef.current = topId;
    if (hotStreakTimerRef.current !== null) {
      window.clearTimeout(hotStreakTimerRef.current);
      hotStreakTimerRef.current = null;
    }
    setShowHotStreakBanner(false);
    setDeckEnterPhase("entering");
    if (deckEnterTimerRef.current !== null) {
      window.clearTimeout(deckEnterTimerRef.current);
    }
    deckEnterTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDeckEnterPhase("idle");
      deckEnterTimerRef.current = null;
    }, 160);
  }, [segment, topVotingSlot?.match?.match_id]);
  useEffect(() => {
    if (segment !== 'voting') return;
    const prev = prevVoteStreakRef.current;
    prevVoteStreakRef.current = voteStreak;
    if (voteStreak < 10 || voteStreak <= prev) return;
    setHotStreakTick((n) => n + 1);
    setShowHotStreakBanner(true);
    if (hotStreakTimerRef.current !== null) {
      window.clearTimeout(hotStreakTimerRef.current);
    }
    hotStreakTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setShowHotStreakBanner(false);
      hotStreakTimerRef.current = null;
    }, 600);
  }, [segment, voteStreak]);
  const predecodedMatchIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextMatch = nextVotingSlot?.match;
    if (!nextMatch?.match_id) return;
    if (predecodedMatchIdsRef.current.has(nextMatch.match_id)) return;
    predecodedMatchIdsRef.current.add(nextMatch.match_id);
    const urls = [nextMatch.cat_a?.image_url, nextMatch.cat_b?.image_url].filter(Boolean) as string[];
    for (const url of urls) {
      const img = new Image();
      img.src = url;
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => {});
      }
    }
  }, [nextVotingSlot?.match?.match_id, nextVotingSlot?.match?.cat_a?.image_url, nextVotingSlot?.match?.cat_b?.image_url]);
  const queueDebug = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return null;
    const pendingSnapshot =
      snapshotOrder.length > 0 &&
      activeVoting.length === 0 &&
      (feedStatus === 'refilling' || feedStatus === 'transitioning' || feedStatus === 'error');
    const slots = votingSlots.map((slot, slotIndex) => {
      const matchId = slot.match?.match_id || null;
      const ui = matchId ? slotUiByMatchId[matchId] : null;
      return {
        slotIndex,
        matchId,
        phase: ui?.phase || 'idle',
      };
    });
    return {
      arenaType: arena.type,
      poolLen: snapshotOrder.length,
      pageIndex: Number(queueInfo?.pageIndex || 0),
      votedCount: Number(queueInfo?.votedCount || 0),
      status: feedStatus,
      snapshotVersion,
      requestSeq: refillRequestSeqRef.current,
      pendingSnapshot,
      slots,
    };
  }, [activeVoting.length, arena.type, feedStatus, queueInfo?.pageIndex, queueInfo?.votedCount, slotUiByMatchId, snapshotOrder.length, snapshotVersion, votingSlots]);

  useEffect(() => {
    const activeIds = new Set(activeVoting.map((m) => m.match_id));
    const staleIds: string[] = [];
    for (const matchId of Object.keys(slotUiByMatchId)) {
      if (!activeIds.has(matchId) && !presentMatchIdsRef.current.has(matchId)) staleIds.push(matchId);
    }
    if (!staleIds.length) return;
    const staleSet = new Set(staleIds);
    for (const matchId of staleIds) clearTransitionTimeoutsFor(matchId);
    setSlotUiByMatchId((prev) => {
      let changed = false;
      const next: Record<string, SlotUiState> = {};
      for (const [id, state] of Object.entries(prev)) {
        if (staleSet.has(id)) {
          changed = true;
          continue;
        }
        next[id] = state;
      }
      return changed ? next : prev;
    });
  }, [activeVoting, clearTransitionTimeoutsFor, slotUiByMatchId]);

  useEffect(() => {
    if (!lowInventory || !onRequestMore || feedStatus !== 'ready' || votingMatch || hasSlotTransition) return;
    if (!hasMoreFightsForUser) return;
    if (snapshotOrder.length > 0) return;
    const key = `${arena.type}:${globalPageInfo?.pageIndex || 0}:${activeVoting.map((m) => m.match_id).join(',')}`;
    if (lowInventoryRetryKeyRef.current === key) return;
    lowInventoryRetryKeyRef.current = key;
    const id = window.setTimeout(() => {
      void refillArena('auto-low');
    }, 900);
    return () => window.clearTimeout(id);
  }, [activeVoting, arena.type, feedStatus, globalPageInfo?.pageIndex, hasMoreFightsForUser, hasSlotTransition, lowInventory, onRequestMore, refillArena, snapshotOrder.length, votingMatch]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!(feedStatus === 'refilling' || feedStatus === 'transitioning')) return;
    const id = window.setTimeout(() => {
      const navTarget = document.querySelector('[data-testid="nav-duel"]') as HTMLElement | null;
      const rect = navTarget?.getBoundingClientRect();
      const x = rect ? Math.floor(rect.left + rect.width * 0.5) : Math.floor(window.innerWidth * 0.5);
      const y = rect ? Math.floor(rect.top + rect.height * 0.5) : Math.max(0, window.innerHeight - 8);
      const top = document.elementFromPoint(x, y) as HTMLElement | null;
      const style = top ? getComputedStyle(top) : null;
      const fixedAncestors: Array<Record<string, string | null>> = [];
      let cursor: HTMLElement | null = top;
      while (cursor && fixedAncestors.length < 5) {
        const cs = getComputedStyle(cursor);
        if (cs.position === 'fixed' || cs.position === 'absolute') {
          fixedAncestors.push({
            tag: cursor.tagName,
            className: String(cursor.className || ''),
            id: cursor.id || null,
            position: cs.position,
            zIndex: cs.zIndex,
            pointerEvents: cs.pointerEvents,
          });
        }
        cursor = cursor.parentElement;
      }
      // eslint-disable-next-line no-console
      console.log('[DEV] arena-refill bottom probe', {
        arena: arena.type,
        phase: feedStatus,
        point: { x, y },
        expectedNav: !!navTarget,
        topTag: top?.tagName || null,
        topClass: top?.className || null,
        topHref: top?.closest?.('a')?.getAttribute?.('href') || null,
        topZ: style?.zIndex || null,
        topPointerEvents: style?.pointerEvents || null,
        fixedAncestors,
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [arena.type, feedStatus]);

  useEffect(() => {
    onVoteRef.current = onVote;
  }, [onVote]);

  useEffect(() => {
    onPredictRef.current = onPredict;
  }, [onPredict]);

  useEffect(() => {
    onCreateCalloutRef.current = onCreateCallout;
  }, [onCreateCallout]);

  const stableVote = useCallback(async (matchId: string, catId: string) => {
    const keepMs = 900;
    const keepUntil = Date.now() + keepMs;
    suppressVotedPruneUntilRef.current = Date.now() + (reduceMotion ? 450 : 1400);
    keepVisibleVoteMatchIdsRef.current.add(matchId);
    clearKeepUntilTimer(matchId);
    setKeepUntilByMatchId((prev) => ({ ...prev, [matchId]: keepUntil }));
    const cleanupTid = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setKeepUntilByMatchId((prev) => {
        if (!prev[matchId]) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      keepUntilTimersRef.current.delete(matchId);
    }, keepMs + 500);
    keepUntilTimersRef.current.set(matchId, cleanupTid);
    setQueuedVotes((prev) => (prev[matchId] ? prev : { ...prev, [matchId]: true }));
    const ok = await onVoteRef.current(matchId, catId);
    if (!ok) {
      keepVisibleVoteMatchIdsRef.current.delete(matchId);
      clearKeepUntilTimer(matchId);
      setKeepUntilByMatchId((prev) => {
        if (!prev[matchId]) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setQueuedVotes((prev) => {
        if (!prev[matchId]) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    }
    return ok;
  }, [clearKeepUntilTimer, reduceMotion]);

  const stablePredict = useCallback((matchId: string, catId: string, bet: number) => {
    return onPredictRef.current(matchId, catId, bet);
  }, []);

  const stableCreateCallout = useCallback((matchId: string, catId: string) => {
    onCreateCalloutRef.current(matchId, catId);
  }, []);

  const handleRefreshQueued = useCallback((matchId: string) => {
    keepVisibleVoteMatchIdsRef.current.delete(matchId);
    clearKeepUntilTimer(matchId);
    setQueuedVotes((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setKeepUntilByMatchId((prev) => {
      if (!prev[matchId]) return prev;
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    void refillArena('queued');
  }, [clearKeepUntilTimer, refillArena]);

  const handleVoteAccepted = useCallback((matchId: string, side: "a" | "b") => {
    if (segment !== 'voting') return;
    // Do not hard-depend on `presentMatchIdsRef` here: on fast clicks right after a
    // deck refresh/remount, the "present set" effect may not have run yet, causing
    // vote animations to intermittently fail to transition.
    if (presentMatchIdsRef.current.has(matchId)) {
      setPrunedMatchIds((prev) => (prev[matchId] ? prev : { ...prev, [matchId]: true }));
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[DEV][vote-lifecycle] accepted', {
        arena: arena.type,
        matchId,
        side,
        hasPresent: presentMatchIdsRef.current.has(matchId),
        queued: !!queuedVotes[matchId],
        voted: !!votedMatches[matchId],
      });
    }
    // Give vote FX enough time to render before card exits the deck.
    const CONFIRMED_HOLD_MS = reduceMotion ? 920 : 1150;
    const EXIT_ANIMATION_MS = reduceMotion ? 150 : Math.max(EXIT_MS, 220);
    const SWAP_PAUSE_MS = reduceMotion ? 0 : Math.max(SWAP_DELAY_MS, 110);
    clearTransitionTimeoutsFor(matchId);
    setQueuedVotes((prev) => ({ ...prev, [matchId]: true }));
    setSlotUiByMatchId((prev) => ({ ...prev, [matchId]: { phase: "voted", chosenSide: side } }));
    if (process.env.NODE_ENV !== 'production') {
      window.setTimeout(() => {
        const keepUntil = Number(keepUntilByMatchIdRef.current[matchId] || 0);
        if (keepUntil > Date.now() && !stackIdsRef.current.includes(matchId)) {
          // eslint-disable-next-line no-console
          console.warn('[KEEP VIOLATION]', {
            arena: arena.type,
            matchId,
            keepUntil,
            now: Date.now(),
            stackIds: [...stackIdsRef.current],
          });
        }
      }, 200);
    }
    queueTransitionTimeout(matchId, CONFIRMED_HOLD_MS, () => {
      setSlotUiByMatchId((prev) => {
        const current = prev[matchId];
        if (!current) return prev;
        return { ...prev, [matchId]: { ...current, phase: "exiting" } };
      });
      const finalize = () => {
        const keepUntil = Number(keepUntilByMatchIdRef.current[matchId] || 0);
        const now = Date.now();
        if (keepUntil > now) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn('[KEEP VIOLATION]', { arena: arena.type, matchId, keepUntil, now, note: 'deferred removal until keep window ends' });
          }
          const wait = Math.max(16, keepUntil - now);
          queueTransitionTimeout(matchId, wait, finalize);
          return;
        }
        if (!presentMatchIdsRef.current.has(matchId)) return;
        const advanceToNextMatch = () => {
          replaceCard(matchId, (result) => {
            clearTransitionTimeoutsFor(matchId);
            keepVisibleVoteMatchIdsRef.current.delete(matchId);
            clearKeepUntilTimer(matchId);
            setQueuedVotes((prev) => {
              const next = { ...prev };
              delete next[matchId];
              return next;
            });
            setKeepUntilByMatchId((prev) => {
              if (!prev[matchId]) return prev;
              const next = { ...prev };
              delete next[matchId];
              return next;
            });
            setSlotUiByMatchId((prev) => {
              if (!prev[matchId]) return prev;
              const next = { ...prev };
              delete next[matchId];
              return next;
            });
            if (!result.replaced) {
              if (testerMode) {
                setQueuedVotes((prev) => {
                  const next = { ...prev };
                  delete next[matchId];
                  return next;
                });
                setSlotUiByMatchId((prev) => {
                  const current = prev[matchId];
                  if (!current) return prev;
                  return { ...prev, [matchId]: { ...current, phase: "idle" } };
                });
              } else {
                void refillArena('auto-empty');
              }
              return;
            }
            if (result.insertedId) {
              setNextUpId(result.insertedId);
              queueTransitionTimeout(matchId, 800, () =>
                setNextUpId((id) => (id === result.insertedId ? null : id))
              );
            }
          });
        };
        if (SWAP_PAUSE_MS > 0) {
          queueTransitionTimeout(matchId, SWAP_PAUSE_MS, advanceToNextMatch);
        } else {
          advanceToNextMatch();
        }
      };
      if (EXIT_ANIMATION_MS > 0) {
        queueTransitionTimeout(matchId, EXIT_ANIMATION_MS, finalize);
      } else {
        finalize();
      }
    });
  }, [EXIT_MS, SWAP_DELAY_MS, clearKeepUntilTimer, clearTransitionTimeoutsFor, queueTransitionTimeout, reduceMotion, refillArena, replaceCard, segment, testerMode]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const rows = stackIds.map((id, idx) => ({
      idx,
      id,
      queued: !!queuedVotes[id],
      voted: !!votedMatches[id],
      phase: slotUiByMatchId[id]?.phase || 'idle',
      keepVisible: keepVisibleVoteMatchIdsRef.current.has(id),
    }));
    // eslint-disable-next-line no-console
    console.log('[DEV][vote-lifecycle] stack', { arena: arena.type, feedStatus, rows });
  }, [arena.type, feedStatus, queuedVotes, slotUiByMatchId, stackIds, votedMatches]);

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
      {segment === 'voting' && voteStreak >= 2 && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <span className={`streak-badge relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${voteStreak >= 3 ? 'badge-glow border-orange-200/55 bg-orange-500/18 text-orange-50' : 'border-orange-300/35 bg-orange-500/12 text-orange-100'}`}>
            {voteStreak >= 5 && !reduceMotion ? <span className="ring-pulse" /> : null}
            🔥 {voteStreak} Vote Streak
          </span>
          {voteStreak % 5 === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-300/35 bg-emerald-500/15 text-[10px] font-semibold text-emerald-100 animate-pulse">
              +1 XP
            </span>
          )}
        </div>
      )}
      {queueDebug && (
        <div className="mb-2 rounded-lg border border-white/15 bg-black/35 p-2 text-[10px] text-white/70">
          <div>
            debug arena={queueDebug.arenaType} phase={queueDebug.status} snapshotV={queueDebug.snapshotVersion} reqSeq={queueDebug.requestSeq} orderLen={queueDebug.poolLen} pendingSnapshot={String(queueDebug.pendingSnapshot)}
          </div>
          <div>page={queueDebug.pageIndex} voted={queueDebug.votedCount}</div>
          <div className="mt-1 break-all">
            {queueDebug.slots.map((slot) => `${slot.slotIndex}:${slot.matchId || 'empty'}:${slot.phase}`).join(' | ')}
          </div>
        </div>
      )}

      {segment === 'voting' && stackVelocity && (
        <p className="text-[10px] text-white/50 mb-2">{stackVelocity}</p>
      )}
      {segment === 'voting' && debugInfo?.whyNotFilled?.length ? (
        <p className="text-[10px] text-white/45 mb-2">
          debug: {debugInfo.whyNotFilled.join(', ')} · eligible {Number(debugInfo.eligibleCatsCount || 0)} · open {Number(debugInfo.openMatchesCount || 0)}
        </p>
      ) : null}
      {segment === 'voting' && hasRenderableVotingMatch && feedError && !showAllVotedModule && hasMoreFightsForUser && isRefilling && (
        <div className="mb-2 rounded-xl border border-amber-300/35 bg-amber-500/10 p-2 text-[11px] text-amber-100 flex items-center justify-between gap-2">
          <span>{feedError}</span>
          {showManualRefresh && (
            <button
              onClick={() => {
                setQueuedVotes({});
                void refillArena('manual');
              }}
              className="h-9 min-h-[36px] px-3 rounded-lg border border-amber-300/45 bg-amber-500/15 text-[11px] font-semibold text-amber-100 touch-manipulation"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {segment === 'voting' && voteStreak >= 5 && (
        <p className="text-[10px] text-amber-200/90 mb-2">
          {voteStreak >= 10 ? '⚡ Chaos Agent unlocked' : `🔥 You're on a roll (${voteStreak} votes)`}
        </p>
      )}
      {segment === 'voting' && showHotStreakBanner && voteStreak >= 10 && (
        <div key={`hot-${hotStreakTick}`} className={`mb-2 inline-flex items-center rounded-full border border-fuchsia-300/45 bg-fuchsia-500/18 px-3 py-1 text-[11px] font-semibold text-fuchsia-100 ${reduceMotion ? '' : 'hot-streak'}`}>
          🔥 HOT STREAK x{voteStreak}
        </div>
      )}

      {shouldShowEmptyModule ? (
        <div className="rounded-2xl bg-white/[0.02] p-6 text-center">
          {!showAllVotedModule ? <Target className="w-7 h-7 text-white/40 mx-auto mb-2" /> : null}
          {segment === 'voting' ? (
            showAllVotedModule ? (
              <AllMatchesVotedCard pulseCountdown={pulseCountdown} />
            ) : (
              <>
                <p className="text-sm text-cyan-200/85">
                  {isRefilling
                    ? `${config.label} loading...`
                    : `${config.label} is refilling.`}
                </p>
                <p className="text-xs text-white/45 mt-1">Next Pulse in {pulseCountdown || '--:--:--'}.</p>
                {hasMoreFightsForUser && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setQueuedVotes({});
                        void refillArena('manual');
                      }}
                      className="h-11 min-h-[44px] px-3 rounded-lg border border-cyan-300/35 bg-cyan-500/10 text-[11px] font-semibold text-cyan-100 touch-manipulation"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </>
            )
          ) : (
            <>
              <p className="text-sm text-white/70">No results matchups yet.</p>
              <p className="text-xs text-white/45 mt-1">Check back shortly. New pairs roll in automatically.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {segment === 'voting' ? (
            <>
              <div className={topVotingSlot?.match ? "min-h-[420px]" : "min-h-[140px]"}>
                {topVotingSlot?.match ? (
                  <MatchCard
                    key={topVotingSlot.match.match_id}
                    match={topVotingSlot.match}
                    voted={votedMatches[topVotingSlot.match.match_id] || null}
                    debugMode={debugMode}
                    isVoting={votingMatch === topVotingSlot.match.match_id}
                    predictBusy={predictBusyMatch === topVotingSlot.match.match_id}
                    calloutBusy={calloutBusyMatch === topVotingSlot.match.match_id}
                    socialEnabled={socialEnabled}
                    availableSigils={availableSigils}
                    voteStreak={voteStreak}
                    isExiting={slotUiByMatchId[topVotingSlot.match.match_id]?.phase === 'exiting'}
                    slotPhase={slotUiByMatchId[topVotingSlot.match.match_id]?.phase || 'idle'}
                    slotChosenSide={slotUiByMatchId[topVotingSlot.match.match_id]?.chosenSide || null}
                    enterPhase={deckEnterPhase}
                    isRefilling={isRefilling}
                    resetFlipSignal={flipResetSignal}
                    voteQueued={!!queuedVotes[topVotingSlot.match.match_id]}
                    showNextUp={nextUpId === topVotingSlot.match.match_id}
                    voteSnapshot={voteSnapshotByMatchId[topVotingSlot.match.match_id] || null}
                    onRefreshQueued={handleRefreshQueued}
                    onVote={stableVote}
                    onVoteAccepted={handleVoteAccepted}
                    onPredict={stablePredict}
                    onCreateCallout={stableCreateCallout}
                  />
                ) : shouldShowEmptyModule ? null : (
                  <LoadingNextFightsCard
                    text={
                      refillRetryAttempt > 0
                        ? `Loading next fights... (retry ${Math.min(refillRetryAttempt, 3)})`
                        : 'Loading next fights...'
                    }
                  />
                )}
              </div>
              {topVotingSlot?.match && hasRenderableVotingMatch && isRefilling && hasMoreFightsForUser && !showAllVotedModule && (
                <LoadingNextFightsCard
                  text={
                    refillRetryAttempt > 0
                      ? `Loading next fights... (retry ${Math.min(refillRetryAttempt, 3)})`
                      : 'Loading next fights...'
                  }
                />
              )}
            </>
          ) : (
            activeList.map((match) => (
              <MatchCard
                key={match.match_id}
                match={match}
                voted={votedMatches[match.match_id] || null}
                debugMode={debugMode}
                isVoting={votingMatch === match.match_id}
                predictBusy={predictBusyMatch === match.match_id}
                calloutBusy={calloutBusyMatch === match.match_id}
                socialEnabled={socialEnabled}
                availableSigils={availableSigils}
                voteStreak={voteStreak}
                voteQueued={!!queuedVotes[match.match_id]}
                showNextUp={nextUpId === match.match_id}
                voteSnapshot={voteSnapshotByMatchId[match.match_id] || null}
                onRefreshQueued={handleRefreshQueued}
                onVote={stableVote}
                onVoteAccepted={handleVoteAccepted}
                onPredict={stablePredict}
                onCreateCallout={stableCreateCallout}
              />
            ))
          )}
          {segment === 'voting' && visiblePageOrder.length > MAX_VISIBLE && (
            <div className="pt-1 flex items-center justify-center">
              <button
                onClick={() => {
                  const excluded = new Set<string>(Object.keys(votedMatches));
                  const nextIds: string[] = [];
                  while (nextIds.length < MAX_VISIBLE) {
                    const id = pullNextMatchId(excluded);
                    if (!id) break;
                    nextIds.push(id);
                    excluded.add(id);
                  }
                  if (nextIds.length === 0) {
                    cursorRef.current = 0;
                    setStackIds(fillStackToFour([]));
                  } else {
                    setStackIds(nextIds);
                  }
                }}
                className="h-8 px-3 rounded-full border border-white/20 bg-white/8 text-[11px] font-semibold text-white/85"
              >
                See more fights
              </button>
            </div>
          )}
          {arena.status === "complete" && arena.champion && (
            <div className="mt-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden">
                <img src={getCatImage(arena.champion)} alt={arena.champion.name} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg'; }} className="w-full h-full object-cover object-center" />
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
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}

function isClientFixtureMode(): boolean {
  if (process.env.NEXT_PUBLIC_FIXTURE_MODE === "1") return true;
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("fixture") === "1") {
      localStorage.setItem("fixture_mode", "1");
      return true;
    }
    return localStorage.getItem("fixture_mode") === "1";
  } catch {
    return false;
  }
}

function withFixtureRequest(input: string, init: RequestInit = {}) {
  if (!isClientFixtureMode()) return { input, init };
  const headers = new Headers(init.headers || {});
  headers.set("x-fixture-mode", "1");
  const nextInput = input.includes("?") ? `${input}&fixture=1` : `${input}?fixture=1`;
  return { input: nextInput, init: { ...init, headers } };
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 2600) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const req = withFixtureRequest(input, init);
    return await fetch(req.input, { ...req.init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArenas(options?: { refresh?: boolean }): Promise<{ arenas: Arena[]; votedMatches: Record<string, string>; mainPool: ArenaMatch[]; rookiePool: ArenaMatch[] }> {
  try {
    const refreshFlag = options?.refresh ? '?refresh=1' : '';
    const res = await fetchWithTimeout(`/api/tournament/active${refreshFlag}`, { cache: "no-store" }, 2600);
    const data = await res.json();
    return {
      arenas: data.arenas || [],
      votedMatches: data.voted_matches || {},
      mainPool: Array.isArray(data?.mainPool) ? data.mainPool : [],
      rookiePool: Array.isArray(data?.rookiePool) ? data.rookiePool : [],
    };
  } catch {
    return { arenas: [], votedMatches: {}, mainPool: [], rookiePool: [] };
  }
}

async function fetchArenaPage(arena: "main" | "rookie", page: number, tab: "voting" | "results" = "voting") {
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const req = withFixtureRequest(`/api/arena/pages?arena=${arena}&page=${Math.max(0, page)}&tab=${tab}${debugMode ? '&debug=1' : ''}`, { cache: "no-store" });
  const res = await fetch(req.input, req.init);
  return await res.json().catch(() => null);
}

async function fetchArenaQueuePage(arena: "main" | "rookie") {
  const req = withFixtureRequest(`/api/arena/page?arena=${arena}&page_size=6&total_size=36`, { cache: "no-store" });
  const res = await fetch(req.input, req.init);
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
    const res = await fetch("/api/crates/open", { method: "POST", headers: { "Content-Type": "application/json" } });
    return await res.json();
  } catch (e) { return { error: e instanceof Error ? e.message : "Error" }; }
}

// ── Main Page ──
export default function Page() {
  const router = useRouter();
  const [debugMode, setDebugMode] = useState(false);
  const resetMatchesRef = useRef<() => void>(() => {});
  const [debugDeckNonce, setDebugDeckNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [voteSnapshotByMatchId, setVoteSnapshotByMatchId] = useState<Record<string, VoteSnapshot>>({});
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [predictBusyMatch, setPredictBusyMatch] = useState<string | null>(null);
  const [calloutBusyMatch, setCalloutBusyMatch] = useState<string | null>(null);
  const [claimingCrate, setClaimingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(true);
  const [testerMode, setTesterMode] = useState(false);
  const [hasProfileUsername, setHasProfileUsername] = useState(false);
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
  const [arenaTypeTab] = useState<'main' | 'rookie'>('main');
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
  const displayStatsRef = useRef(displayStats);
  const statsAnimRafRef = useRef<number | null>(null);
  const [hudCompact, setHudCompact] = useState(false);
  const [hudDetail, setHudDetail] = useState<null | { title: string; detail: string }>(null);
  const [dailyRewardSplash, setDailyRewardSplash] = useState<null | {
    day: number;
    sigils: number;
    nextHint: string;
  }>(null);

  const statsStrip = useMemo(() => (
    <div className="stats-strip-shell hidden sm:block">
      <div className={`stats-strip-inner max-w-4xl mx-auto px-3 ${hudCompact ? 'pt-0.5' : 'pt-2'} transition-all duration-200`}>
        <div className={hudPulseKey ? 'stats-strip-pulse hud-pulse rounded-2xl' : 'stats-strip-pulse'}>
          <CosmicStatsBar
            cells={[
              {
                key: 'flame',
                label: 'Flame',
                value: displayStats.streak,
                detail: 'Consecutive daily battle participation.',
                tagline: 'Unbox. Battle. Evolve.',
                onClick: () => setHudDetail({ title: 'Battle Flame', detail: 'Consecutive daily battle participation.' }),
              },
              {
                key: 'energy',
                label: 'Energy',
                value: displayStats.xp,
                detail: `Energy ${displayStats.xp} · Level ${progress?.level || 1}`,
                onClick: () => setHudDetail({ title: 'Energy', detail: `Energy ${displayStats.xp} · Level ${progress?.level || 1}` }),
              },
              {
                key: 'sigils',
                label: 'Sigils',
                value: displayStats.sigils,
                detail: 'Premium currency used for rerolls, crates, and cosmetics.',
                onClick: () => setHudDetail({ title: 'Sigils', detail: 'Premium currency used for rerolls, crates, and cosmetics.' }),
              },
              {
                key: 'predict',
                label: 'Predict',
                value: displayStats.pred,
                detail: 'Correct winner predictions in a row.',
                onClick: () => setHudDetail({ title: 'Prediction', detail: 'Correct winner predictions in a row.' }),
              },
            ]}
          />
        </div>
      </div>
    </div>
  ), [displayStats.pred, displayStats.sigils, displayStats.streak, displayStats.xp, hudCompact, hudPulseKey, progress?.level]);

  useHeaderExtension(statsStrip);
  const [showBookmarkMissionBanner, setShowBookmarkMissionBanner] = useState(false);
  const [bookmarkMissionBusy, setBookmarkMissionBusy] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const bookmarkMissionToastRef = useRef<string>('');
  const [voteStreak, setVoteStreak] = useState(0);
  const [lastVoteAtMs, setLastVoteAtMs] = useState<number | null>(null);
  const voteCooldownUntilRef = useRef(0);
  const voteCooldownTimerRef = useRef<number | null>(null);
  const [pulseCountdown, setPulseCountdown] = useState('00:00:00');
  const [pulseSecondsRemaining, setPulseSecondsRemaining] = useState(0);
  const [pulseRecap, setPulseRecap] = useState<string | null>(null);
  const nextRefreshAtUtc = useMemo(() => {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    return next.toISOString();
  }, []);
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
  const [arenaQueueInfo, setArenaQueueInfo] = useState<Record<'main' | 'rookie', ArenaQueuePageInfo>>({
    main: { pageIndex: 0, pageSize: 6, totalSize: 36, votedCount: 0, pageComplete: false },
    rookie: { pageIndex: 0, pageSize: 6, totalSize: 36, votedCount: 0, pageComplete: false },
  });
  const [arenaPoolsByType, setArenaPoolsByType] = useState<Record<'main' | 'rookie', ArenaMatch[]>>({
    main: [],
    rookie: [],
  });
  const [arenaDebugInfo, setArenaDebugInfo] = useState<Record<'main' | 'rookie', ArenaInventoryDebug | null>>({
    main: null,
    rookie: null,
  });
  const [hasSeenArenaByType, setHasSeenArenaByType] = useState<Record<'main' | 'rookie', boolean>>({
    main: false,
    rookie: false,
  });
  const pageMatchIdsRef = useRef<Record<'main' | 'rookie', string[]>>({ main: [], rookie: [] });
  const pollSinceRef = useRef<Record<'main' | 'rookie', number>>({ main: 0, rookie: 0 });
  const arenaVersionRef = useRef<Record<'main' | 'rookie', string>>({ main: '', rookie: '' });
  const duelVersionRef = useRef<string>('');
  const statusBurstUntilRef = useRef<number>(0);
  const duelSectionRef = useRef<HTMLDivElement | null>(null);
  const [duelSectionInView, setDuelSectionInView] = useState(false);
  const lowEgressMode = process.env.NEXT_PUBLIC_LOW_EGRESS === '1';
  const guestRewardsHintShownRef = useRef(false);
  const arenaRefillInFlightRef = useRef<Record<'main' | 'rookie', boolean>>({ main: false, rookie: false });
  const arenaRefillLastAtRef = useRef<Record<'main' | 'rookie', number>>({ main: 0, rookie: 0 });
  const voteStateScope = useMemo(() => voteScopeFromArenas(arenas), [arenas]);
  const showToast = useCallback((msg: string) => showGlobalToast(msg, 5000), []);
  const handleResetMatches = useCallback(() => {
    setVotedMatches({});
    writeVotedMatchesToStorage({}, voteStateScope);
    setArenaPoolsByType({ main: [], rookie: [] });
    setArenaQueueInfo((prev) => ({
      main: { ...prev.main, votedCount: 0, pageComplete: false },
      rookie: { ...prev.rookie, votedCount: 0, pageComplete: false },
    }));
    setHasSeenArenaByType({ main: false, rookie: false });
    statusBurstUntilRef.current = 0;
    setVoteStreak(0);
    showToast("Debug reset: cleared voted matches");
  }, [voteStateScope, showToast]);
  resetMatchesRef.current = handleResetMatches;
  const handleDebugResetMatches = useCallback(() => {
    setVotedMatches({});
    writeVotedMatchesToStorage({}, voteStateScope);
    statusBurstUntilRef.current = 0;
    setVoteStreak(0);
    showToast("Votes reset for debugging");
  }, [voteStateScope, showToast]);
  const handleDebugWidgetHydrate = useCallback((payload: unknown) => {
    // Debug refresh should not wipe the current deck; it should just clear local vote state
    // and rehydrate the deck from the debug refresh payload.
    handleDebugResetMatches();
    const data = (payload && typeof payload === 'object') ? (payload as any) : null;
    const matches = Array.isArray(data?.matches) ? (data.matches as ArenaMatch[]) : [];
    if (matches.length > 0) {
      setArenas((prev) => applyPageMatchesToArenas(prev, arenaTypeTab, matches));
      setArenaPoolsByType((prev) => ({ ...prev, [arenaTypeTab]: matches }));
      setArenaQueueInfo((prev) => ({
        ...prev,
        [arenaTypeTab]: {
          pageIndex: Math.max(0, Number(data?.page_index || prev[arenaTypeTab]?.pageIndex || 0)),
          pageSize: Math.max(1, Number(data?.page_size || prev[arenaTypeTab]?.pageSize || 6)),
          totalSize: Math.max(0, Number(data?.total_size || prev[arenaTypeTab]?.totalSize || 36)),
          // Debug UX: force "fresh" vote flow even if the server reports completion.
          votedCount: 0,
          pageComplete: false,
        },
      }));
    } else {
      // Still remount the deck UI so you can re-test vote animations on the current deck.
      setArenaQueueInfo((prev) => ({
        ...prev,
        [arenaTypeTab]: { ...prev[arenaTypeTab], votedCount: 0, pageComplete: false },
      }));
    }
    setDebugDeckNonce((n) => n + 1);
  }, [arenaTypeTab, handleDebugResetMatches]);

  const handleDebugArenaStackRefill = useCallback(async (arenaType?: 'main' | 'rookie'): Promise<ArenaRefreshResult> => {
    const type = arenaType || arenaTypeTab;
    const url = `/api/arena/refresh?arena=${encodeURIComponent(type)}&debug=1`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const payload = await res.json().catch(() => null) as any;
      const matches = Array.isArray(payload?.matches) ? (payload.matches as ArenaMatch[]) : [];
      // eslint-disable-next-line no-console
      console.log('[debug refill] got', { arena: type, status: res.status, count: matches.length });

      if (!payload?.ok || matches.length === 0) {
        return { ok: true, count: 0, status: 'nonrenderable', renderableCount: 0, advanced: false, pageIndex: 0, pageComplete: false, votedCount: 0, totalSize: 0 };
      }

      setArenas((prev) => applyPageMatchesToArenas(prev, type, matches));
      setArenaPoolsByType((prev) => ({ ...prev, [type]: matches }));
      setArenaQueueInfo((prev) => ({
        ...prev,
        [type]: {
          pageIndex: 0,
          pageSize: matches.length,
          totalSize: Math.max(matches.length, Number(payload?.total_size || matches.length)),
          votedCount: 0,
          pageComplete: false,
        },
      }));
      setHasSeenArenaByType((prev) => ({ ...prev, [type]: true }));
      setDebugDeckNonce((n) => n + 1);
      return { ok: true, count: matches.length, status: 'ok', renderableCount: matches.length, advanced: true, pageIndex: 0, pageComplete: false, votedCount: 0, totalSize: Math.max(matches.length, Number(payload?.total_size || matches.length)) };
    } catch {
      return { ok: false, count: 0, status: 'fetch_failed' };
    }
  }, [arenaTypeTab]);

  const handleDebugRefreshMatches = useCallback(async () => {
    const url = `/api/arena/refresh?arena=${encodeURIComponent(arenaTypeTab)}&debug=1`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const payload = await res.json().catch(() => null) as any;

      const matches = Array.isArray(payload?.matches) ? (payload.matches as ArenaMatch[]) : [];
      // eslint-disable-next-line no-console
      console.log('[debug refresh] got', { count: matches.length });

      if (payload?.ok && matches.length > 0) {
        // Debug refresh should be authoritative: apply directly to the deck-driving state.
        handleDebugResetMatches();
        setArenas((prev) => applyPageMatchesToArenas(prev, arenaTypeTab, matches));
        setArenaPoolsByType((prev) => ({ ...prev, [arenaTypeTab]: matches }));
        setArenaQueueInfo((prev) => ({
          ...prev,
          [arenaTypeTab]: {
            pageIndex: Math.max(0, Number(payload?.page_index ?? prev[arenaTypeTab]?.pageIndex ?? 0)),
            pageSize: Math.max(1, Number(payload?.page_size ?? prev[arenaTypeTab]?.pageSize ?? 6)),
            totalSize: Math.max(0, Number(payload?.total_size ?? prev[arenaTypeTab]?.totalSize ?? 36)),
            votedCount: 0,
            pageComplete: false,
          },
        }));
        setHasSeenArenaByType((prev) => ({ ...prev, [arenaTypeTab]: true }));
        // Remount the arena UI so internal cursor/segment/refill state resets.
        setDebugDeckNonce((n) => n + 1);
        // eslint-disable-next-line no-console
        console.log('[debug refresh] applied to deck state');
      } else {
        // eslint-disable-next-line no-console
        console.log('[debug refresh] no matches to apply', { ok: !!payload?.ok, status: res.status });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG_REFRESH] refresh failed', e);
    }
  }, [arenaTypeTab, handleDebugResetMatches]);
  const displayedArenas = useMemo(() => {
    const typed = arenas.filter((a) => a.type === arenaTypeTab);
    if (typed.length > 0) return typed;
    const fallbackMatches = (arenaPoolsByType[arenaTypeTab] || []).filter((m) => !!m?.match_id);
    if (fallbackMatches.length === 0) return [];
    const anchor = arenas[0];
    const round = Number(anchor?.current_round || 1);
    const synthetic: Arena = {
      tournament_id: String(anchor?.tournament_id || `synthetic-${arenaTypeTab}-${new Date().toISOString().slice(0, 10)}`),
      type: arenaTypeTab,
      date: String(anchor?.date || new Date().toISOString().slice(0, 10)),
      current_round: round,
      status: String(anchor?.status || 'active'),
      champion: null,
      rounds: [{ round, matches: fallbackMatches }],
    };
    return [synthetic];
  }, [arenas, arenaPoolsByType, arenaTypeTab]);
  const hasMatchesForActiveTab = displayedArenas.some((arena) =>
    (arena.rounds || []).some((round) => (round.matches || []).length > 0)
  );

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const seenMain = arenas.some((a) => a.type === 'main');
    const seenRookie = arenas.some((a) => a.type === 'rookie');
    if (!seenMain && !seenRookie) return;
    setHasSeenArenaByType((prev) => ({
      main: prev.main || seenMain,
      rookie: prev.rookie || seenRookie,
    }));
  }, [arenas]);
  useEffect(() => {
    runIdentityResolutionChecks();
    runVoteStateChecks();
  }, []);
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
    displayStatsRef.current = displayStats;
  }, [displayStats]);
  const statsTargetSig = `${Number(progress?.currentStreak || 0)}:${Number(progress?.xp || 0)}:${Number(progress?.sigils || 0)}:${Number(progress?.predictionStreak || 0)}`;
  const shouldAnimateStats = true;
  useEffect(() => {
    const target = {
      streak: Number(progress?.currentStreak || 0),
      xp: Number(progress?.xp || 0),
      sigils: Number(progress?.sigils || 0),
      pred: Number(progress?.predictionStreak || 0),
    };
    setHudPulseKey(statsTargetSig);
    if (statsAnimRafRef.current !== null) {
      window.cancelAnimationFrame(statsAnimRafRef.current);
      statsAnimRafRef.current = null;
    }
    if (!shouldAnimateStats) {
      setDisplayStats(target);
      return;
    }
    const start = displayStatsRef.current;
    const duration = 260;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = {
        streak: Math.round(start.streak + (target.streak - start.streak) * eased),
        xp: Math.round(start.xp + (target.xp - start.xp) * eased),
        sigils: Math.round(start.sigils + (target.sigils - start.sigils) * eased),
        pred: Math.round(start.pred + (target.pred - start.pred) * eased),
      };
      setDisplayStats(next);
      displayStatsRef.current = next;
      if (p < 1) {
        statsAnimRafRef.current = window.requestAnimationFrame(tick);
      } else {
        statsAnimRafRef.current = null;
      }
    };
    statsAnimRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (statsAnimRafRef.current !== null) {
        window.cancelAnimationFrame(statsAnimRafRef.current);
        statsAnimRafRef.current = null;
      }
    };
  }, [shouldAnimateStats, statsTargetSig]);
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
    if (process.env.NODE_ENV === 'production') return;
    if (!(showClaimNamePrompt && hasCredentials && !hasProfileUsername)) return;
    const timer = window.setTimeout(() => {
      checkTapTarget({ key: 'claim-name-cta-hit', selector: '[data-testid="claim-name-cta"]', expect: ['A'] });
      checkTapTarget({ key: 'claim-name-later-hit', selector: '[data-testid="claim-name-later"]', expect: ['BUTTON'] });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hasCredentials, hasProfileUsername, showClaimNamePrompt]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      checkTapTarget({ key: 'home-open-duel-live-hit', selector: '[data-testid="open-duel-arena-cta-live"]', expect: ['A'] });
      checkTapTarget({ key: 'home-open-duel-arenas-hit', selector: '[data-testid="open-duel-arena-cta-arenas"]', expect: ['A'] });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [arenaTypeTab, liveDuels.length, loading]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => scanDuplicateTestIds('home'), 140);
    return () => window.clearTimeout(timer);
  }, [arenas, showClaimNamePrompt, arenaTypeTab]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      for (const img of imgs) {
        const src = String((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '').trim();
        if (!src) continue;
        const lower = src.toLowerCase();
        if (lower.includes('/thumb.webp')) continue;
        if (lower.includes('/cat-placeholder')) continue;
        if (lower.startsWith('data:') || lower.startsWith('blob:')) continue;
        warnOnce(`non-thumb-image:${src}`, `[DEV WARNING] Non-thumb image detected: ${src}`);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [arenas, arenaTypeTab, liveDuels, loading]);
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
    if (!dailyRewardSplash) return;
    const timer = window.setTimeout(() => setDailyRewardSplash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [dailyRewardSplash]);
  useEffect(() => {
    const targetMs = new Date(nextRefreshAtUtc).getTime();
    const tick = () => {
      const ms = Math.max(0, targetMs - Date.now());
      const total = Math.floor(ms / 1000);
      setPulseSecondsRemaining((prev) => (prev === total ? prev : total));
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      setCrateCountdown(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAtUtc]);
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
    const el = duelSectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      setDuelSectionInView(entries.some((e) => e.isIntersecting));
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (lowEgressMode && !duelSectionInView) return;
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
    tick();
    const id = setInterval(tick, lowEgressMode ? 60000 : 15000);
    return () => clearInterval(id);
  }, [duelSectionInView, lowEgressMode]);

  const activeVotersNow = Math.max(0, Number(globalPageInfo[arenaTypeTab]?.activeVoters10m || 0));

  function applyPageMatchesToArenas(current: Arena[], arenaType: 'main' | 'rookie', matches: ArenaMatch[]): Arena[] {
    let found = false;
    const next = current.map((a) => {
      if (a.type !== arenaType) return a;
      found = true;
      const round = Number(a.current_round || 1);
      return {
        ...a,
        rounds: [{ round, matches }],
      };
    });
    if (found || matches.length === 0) return next;
    const anchor = current[0];
    const synthetic: Arena = {
      tournament_id: String(anchor?.tournament_id || `synthetic-${arenaType}-${new Date().toISOString().slice(0, 10)}`),
      type: arenaType,
      date: String(anchor?.date || new Date().toISOString().slice(0, 10)),
      current_round: 1,
      status: "active",
      champion: null,
      rounds: [{ round: 1, matches }],
    };
    return [...next, synthetic];
  }

  async function loadArenaQueuePage(arenaType: 'main' | 'rookie', options?: { preserveExistingOnEmpty?: boolean }): Promise<{ ok: boolean; count: number }> {
    const data = await fetchArenaQueuePage(arenaType);
    if (!data?.ok) return { ok: false, count: 0 };
    const matches = Array.isArray(data.matches) ? (data.matches as ArenaMatch[]) : [];
    if (options?.preserveExistingOnEmpty && matches.length === 0) return { ok: true, count: 0 };
    setArenas((prev) => applyPageMatchesToArenas(prev, arenaType, matches));
    setArenaPoolsByType((prev) => ({ ...prev, [arenaType]: matches }));
    setArenaQueueInfo((prev) => ({
      ...prev,
      [arenaType]: {
        pageIndex: Math.max(0, Number(data.page_index || 0)),
        pageSize: Math.max(1, Number(data.page_size || 6)),
        totalSize: Math.max(0, Number(data.total_size || 36)),
        votedCount: Math.max(0, Number(data.voted_count || 0)),
        pageComplete: !!data.page_complete,
      },
    }));
    return { ok: true, count: matches.length };
  }

  async function loadGlobalPage(
    arenaType: 'main' | 'rookie',
    pageIndex: number,
    opts?: { dayKey?: string; persist?: boolean; preserveExistingOnEmpty?: boolean },
  ) {
    const data = await fetchArenaPage(arenaType, pageIndex, 'voting');
    if (!data?.ok) return false;
    const matches = Array.isArray(data.matches) ? (data.matches as ArenaMatch[]) : [];
    if (opts?.preserveExistingOnEmpty && matches.length === 0) {
      setArenaDebugInfo((prev) => ({
        ...prev,
        [arenaType]: data?.debug ? (data.debug as ArenaInventoryDebug) : prev[arenaType],
      }));
      return false;
    }
    setArenas((prev) => applyPageMatchesToArenas(prev, arenaType, matches));
    setArenaPoolsByType((prev) => ({ ...prev, [arenaType]: matches }));
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
    setArenaDebugInfo((prev) => ({
      ...prev,
      [arenaType]: data?.debug ? (data.debug as ArenaInventoryDebug) : null,
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
    const arenaTypes: Array<'main' | 'rookie'> = ['main'];
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
      const actorId = resolveActorId(userData);
      setGuestId(actorId || userData.guest_id || "");
      setHasProfileUsername(!!resolveProfileUsername(userData));
      setFlame(userData.data?.flame || null);
      setProgress({
        xp: userData.data?.progress?.xp || 0,
        level: userData.data?.progress?.level || 1,
        currentStreak: userData.data?.flame?.dayCount || userData.data?.streak?.current_streak || 0,
        sigils: userData.data?.progress?.sigils || 0,
        predictionStreak: userData.data?.prediction_streak || 0,
        catXpPool: Number(userData.data?.cat_xp_pool || 0),
      });
      setHasCredentials(Boolean(userData.data?.has_credentials));
      setTesterMode(!!userData.data?.tester_mode);
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
    const poolMap: Record<'main' | 'rookie', ArenaMatch[]> = {
      main: Array.isArray(arenaData.mainPool) ? arenaData.mainPool : [],
      rookie: [],
    };
    const arenasWithPools = (arenaData.arenas || []).map((a) => {
      const t = a.type === 'main' || a.type === 'rookie' ? a.type : null;
      if (!t) return a;
      const currentRound = Number(a.current_round || 1);
      const poolMatches = poolMap[t];
      if (!poolMatches.length) return a;
      return {
        ...a,
        rounds: [{ round: currentRound, matches: poolMatches }],
      };
    });
    setArenaPoolsByType(poolMap);
    setArenas(arenasWithPools);
    await Promise.all([
      loadArenaQueuePage('main').catch(() => ({ ok: false, count: 0 })),
    ]);
    const nextVoteScope = voteScopeFromArenas(arenasWithPools as Arena[]);
    const mergedVotes = mergeVotedMaps(arenaData.votedMatches, readVotedMatchesFromStorage(nextVoteScope));
    setVotedMatches(mergedVotes);
    writeVotedMatchesToStorage(mergedVotes, nextVoteScope);
    setLoading(false);
    const gs = await fetch("/api/rewards/getting-started", { cache: "no-store" }).then((r) => r.json().catch(() => null)).catch(() => null);
    if (gs?.ok) {
      setGettingStarted(gs);
      const newlyCompleted = Array.isArray(gs?.runtime_rewards?.newly_completed_keys) ? gs.runtime_rewards.newly_completed_keys : [];
      const xpAwarded = Number(gs?.runtime_rewards?.xp_awarded_now || 0);
      const banked = Number(gs?.runtime_rewards?.cat_xp_banked_now || 0);
      if (xpAwarded > 0 || banked > 0) {
        const refreshed = await fetchUserState();
        if (!refreshed.error) {
          setHasCredentials(Boolean(refreshed.data?.has_credentials));
          setHasProfileUsername(!!resolveProfileUsername(refreshed));
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

  async function handleVote(matchId: string, catId: string): Promise<boolean> {
    if (votingMatch) return false;
    if (Date.now() < Number(voteCooldownUntilRef.current || 0)) {
      showToast("Too fast — take a breath 😼");
      return false;
    }
      const matchedMatch = arenas
        .flatMap((a) => (a.rounds || []).flatMap((r) => r.matches || []))
        .find((m) => m.match_id === matchId);
  const matchedArenaType = arenas.find((a) =>
    (a.rounds || []).some((r) => (r.matches || []).some((m) => m.match_id === matchId))
  )?.type as 'main' | 'rookie' | undefined;
    setVotingMatch(matchId);
    setError(null);
    setVotedMatches((prev) => {
      const next = upsertVotedMatch(prev, matchId, catId);
      writeVotedMatchesToStorage(next, voteStateScope);
      const arenaType = arenas.find((a) =>
        (a.rounds || []).some((r) => (r.matches || []).some((m) => m.match_id === matchId))
      )?.type as 'main' | 'rookie' | undefined;
      if (arenaType === 'main' || arenaType === 'rookie') {
        persistCurrentArenaProgress(arenaType, next);
      }
      return next;
    });
    try {
      const r = await fetch("/api/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      const applyServerVoteSnapshot = (payload: any) => {
        if (!payload || !matchedArenaType) return;
        const snapshot: VoteSnapshot = {
          votes_a: Number(payload.votes_a || matchedMatch?.votes_a || 0),
          votes_b: Number(payload.votes_b || matchedMatch?.votes_b || 0),
          total_votes: Number(payload.total_votes || 0),
          percent_a: Number(payload.percent_a || 0),
          percent_b: Number(payload.percent_b || 0),
        };
        setVoteSnapshotByMatchId((prev) => ({ ...prev, [matchId]: snapshot }));
        setArenas((prev) => prev.map((arena) => {
          if (arena.type !== matchedArenaType) return arena;
          return {
            ...arena,
            rounds: (arena.rounds || []).map((round) => ({
              ...round,
              matches: (round.matches || []).map((m) => {
                if (String(m.match_id || '') !== String(matchId || '')) return m;
                  return {
                    ...m,
                    votes_a: snapshot.votes_a,
                    votes_b: snapshot.votes_b,
                    total_votes: snapshot.total_votes || m.total_votes || 0,
                    percent_a: snapshot.percent_a,
                    percent_b: snapshot.percent_b,
                  };
                }),
              })),
          };
        }));
      };
      if (r.status === 429) {
        voteCooldownUntilRef.current = Date.now() + 1200;
        if (voteCooldownTimerRef.current !== null) {
          window.clearTimeout(voteCooldownTimerRef.current);
        }
        voteCooldownTimerRef.current = window.setTimeout(() => {
          voteCooldownUntilRef.current = 0;
          voteCooldownTimerRef.current = null;
        }, 1200);
        setVotedMatches((prev) => {
          const next = removeVotedMatch(prev, matchId);
          writeVotedMatchesToStorage(next, voteStateScope);
          return next;
        });
        showToast("Too fast — take a breath 😼");
        return false;
      }
      const msg = String(data?.error || "");
      const alreadyVotedConflict =
        r.status === 409 ||
        !!data?.alreadyVoted ||
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("duplicate");
      if (alreadyVotedConflict) {
        statusBurstUntilRef.current = Date.now() + 20_000;
        const incomingChoice = String(data?.choice || '').trim();
        const resolvedChoice =
          incomingChoice === 'a' ? String(matchedMatch?.cat_a?.id || catId)
          : incomingChoice === 'b' ? String(matchedMatch?.cat_b?.id || catId)
          : String(catId || incomingChoice || 'already');
        applyServerVoteSnapshot(data);
        setVotedMatches((prev) => {
          const next = upsertVotedMatch(prev, matchId, resolvedChoice || 'already');
          writeVotedMatchesToStorage(next, voteStateScope);
          return next;
        });
        showToast("Already voted ✅");
        return true;
      }
      if (!r.ok || !data?.ok) {
        setVoteStreak(0);
        setVotedMatches((prev) => {
          const next = removeVotedMatch(prev, matchId);
          writeVotedMatchesToStorage(next, voteStateScope);
          return next;
        });
        showToast("Vote failed — try again");
        return false;
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
        applyServerVoteSnapshot(data);
        if (hasCredentials && !hasProfileUsername) {
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
          const next = upsertVotedMatch(prev, matchId, catId);
          writeVotedMatchesToStorage(next, voteStateScope);
          if (matchedArenaType === 'main' || matchedArenaType === 'rookie') {
            persistCurrentArenaProgress(matchedArenaType, next);
          }
          return next;
        });
        showToast("Vote registered ✅");
        if (!data?.rewards_locked) {
          setProgress((prev) => prev ? {
            ...prev,
            xp: prev.xp + Number(data?.xp_earned || 5),
            catXpPool: prev.catXpPool + Number(data?.cat_xp_banked || 0),
          } : null);
        } else if (!guestRewardsHintShownRef.current) {
          guestRewardsHintShownRef.current = true;
          showToast("Create account to earn streak/XP/rewards");
        }
        // Keep voting flow stable: avoid full arena refetch on every vote.
        // Arena data refreshes when the current stack is exhausted.
        statusBurstUntilRef.current = Date.now() + 20_000;
        if (matchedArenaType && globalPageInfo?.[matchedArenaType]?.dayKey) {
          fetch(`/api/arena/updates?arena=${matchedArenaType}&tab=voting&page=${globalPageInfo[matchedArenaType].pageIndex}`, { cache: 'no-store' })
            .then((r) => r.json().catch(() => null))
            .then((payload) => {
              const updates = Array.isArray(payload?.updates)
                ? (payload.updates as Array<{ matchId: string; votesA?: number; votesB?: number; totalVotes?: number; percentA?: number; percentB?: number }>)
                : [];
              if (!updates.length) return;
              const updateMap = new Map(updates.map((u: any) => [String(u.matchId || ''), u]));
              setArenas((prev) => prev.map((arena) => {
                if (arena.type !== matchedArenaType) return arena;
                return {
                  ...arena,
                  rounds: (arena.rounds || []).map((round) => ({
                    ...round,
                    matches: (round.matches || []).map((m) => {
                      const u = updateMap.get(String(m.match_id || ''));
                      if (!u) return m;
                      return {
                        ...m,
                        votes_a: Number(u.votesA || 0),
                        votes_b: Number(u.votesB || 0),
                        total_votes: Number(u.totalVotes || 0),
                        percent_a: Number(u.percentA || 0),
                        percent_b: Number(u.percentB || 0),
                      };
                    }),
                  })),
                };
              }));
              setGlobalPageInfo((prev) => ({
                ...prev,
                [matchedArenaType]: { ...prev[matchedArenaType], livePulseAt: Date.now() },
              }));
            })
            .catch(() => null);
        }
        refreshGettingStarted();
        return true;
      }
    } catch {
      setVoteStreak(0);
      setVotedMatches((prev) => {
        const next = removeVotedMatch(prev, matchId);
        writeVotedMatchesToStorage(next, voteStateScope);
        return next;
      });
      showToast("Vote failed — try again");
      return false;
    } finally {
      setVotingMatch(null);
    }
  }

  useEffect(() => {
    return () => {
      if (voteCooldownTimerRef.current !== null) {
        window.clearTimeout(voteCooldownTimerRef.current);
        voteCooldownTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      if (cancelled) return;
      const isHidden = typeof document !== 'undefined' && document.hidden;
      const busy = !!(votingMatch || predictBusyMatch);
      const now = Date.now();
      const burst = now < Number(statusBurstUntilRef.current || 0);
      const baseDelay = isHidden ? 60_000 : (burst ? 6_000 : 12_000);
      const delay = busy ? Math.max(baseDelay, 12_000) : baseDelay;

      try {
        const status = await fetch('/api/home/status', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
        if (status?.ok) {
          const versions = {
            main: String(status.arenaVersionMain || ''),
            rookie: String(status.arenaVersionRookie || ''),
          };
          const activeArena = arenaTypeTab;
          const info = globalPageInfo[activeArena];
          if (!isHidden && info.dayKey) {
            const since = Math.max(0, Number(pollSinceRef.current[activeArena] || Date.now() - 5000));
            const res = await fetch(`/api/arena/updates?arena=${activeArena}&tab=voting&page=${info.pageIndex}&since=${since}`, { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (data?.ok && Array.isArray(data.updates)) {
              const updates = data.updates as Array<{ matchId: string; votesA: number; votesB: number; totalVotes?: number; percentA?: number; percentB?: number }>;
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
                        return {
                          ...match,
                          votes_a: Number(u.votesA || 0),
                          votes_b: Number(u.votesB || 0),
                          total_votes: Number(u.totalVotes || 0),
                          percent_a: Number(u.percentA || 0),
                          percent_b: Number(u.percentB || 0),
                        };
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
          }
          arenaVersionRef.current[activeArena] = versions[activeArena];
          if (!isHidden && !lowEgressMode && duelSectionInView) {
            const duelVersion = String(status.duelVersion || '');
            if (duelVersion && duelVersion !== duelVersionRef.current) {
              const duel = await fetch('/api/duel/challenges', { cache: 'no-store' }).then((r) => r.json().catch(() => null)).catch(() => null);
              if (duel?.ok) {
                const open = Array.isArray(duel.open) ? duel.open : [];
                const top = open
                  .filter((d: DuelRow) => !!d?.challenger_cat?.id && !!d?.challenged_cat?.id)
                  .sort((a: DuelRow, b: DuelRow) => Number(b?.votes?.total || 0) - Number(a?.votes?.total || 0))
                  .slice(0, 5);
                setLiveDuels(top);
                setLiveDuelVotes2m(Number(duel?.recent_votes_2m || 0));
                duelVersionRef.current = duelVersion;
              }
            }
          }
        }
      } catch {
        // ignore transient status polling errors
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
    duelSectionInView,
    lowEgressMode,
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
    if (arenaRefillInFlightRef.current[type]) {
      return { ok: true, count: 0, status: 'skipped_inflight' };
    }
    const now = Date.now();
    if (now - Number(arenaRefillLastAtRef.current[type] || 0) < 1200) {
      return { ok: true, count: 0, status: 'skipped_cooldown' };
    }
    arenaRefillInFlightRef.current[type] = true;
    arenaRefillLastAtRef.current[type] = now;
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'arena_fetch_start', payload: { arena: type, source: 'pool-refetch' } }),
    }).catch(() => null);
    try {
      const prevPageIndex = Number(arenaQueueInfo[type]?.pageIndex || 0);
      const prevMatches =
        arenas.find((a) => a.type === type)?.rounds?.flatMap((r) => r.matches || []) || [];
      const prevSignature = prevMatches.map((m) => String(m.match_id || '')).filter(Boolean).join('|');

      const data = await fetchArenaQueuePage(type);
      if (!data?.ok) {
        return { ok: false, count: 0, status: 'fetch_failed' };
      }
      const matches = Array.isArray(data.matches) ? (data.matches as ArenaMatch[]) : [];
      const nextPageIndex = Math.max(0, Number(data.page_index || prevPageIndex));
      const pageComplete = !!data.page_complete;
      const votedCount = Math.max(0, Number(data.voted_count || 0));
      const totalSize = Math.max(0, Number(data.total_size || 36));
      const nextSignature = matches.map((m) => String(m.match_id || '')).filter(Boolean).join('|');
      const renderableMatches = matches.filter((m) =>
        isArenaVotingStatus(m.status) && (!votedMatches[m.match_id] || String(votingMatch || '') === String(m.match_id || ''))
      );
      const renderableCount = renderableMatches.length;
      const advanced = nextPageIndex > prevPageIndex || (!!nextSignature && nextSignature !== prevSignature);
      setArenaQueueInfo((prev) => ({
        ...prev,
        [type]: {
          pageIndex: nextPageIndex,
          pageSize: Math.max(1, Number(data.page_size || 6)),
          totalSize,
          votedCount,
          pageComplete,
        },
      }));

      if (matches.length === 0) {
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'arena_fetch_empty', payload: { arena: type, source: 'pool-refetch' } }),
        }).catch(() => null);
        return {
          ok: true,
          count: 0,
          status: 'empty',
          pageIndex: nextPageIndex,
          renderableCount: 0,
          advanced: false,
          pageComplete,
          votedCount,
          totalSize,
        };
      }

      // Keep current snapshot if server did not advance and returned no votable cards for this user.
      if (!advanced && renderableCount === 0) {
        return {
          ok: true,
          count: 0,
          status: 'stale_nonrenderable',
          pageIndex: nextPageIndex,
          renderableCount,
          advanced: false,
          pageComplete,
          votedCount,
          totalSize,
        };
      }

      if (renderableCount <= 0) {
        return {
          ok: true,
          count: 0,
          status: 'nonrenderable',
          pageIndex: nextPageIndex,
          renderableCount,
          advanced,
          pageComplete,
          votedCount,
          totalSize,
        };
      }

      setArenas((prev) => applyPageMatchesToArenas(prev, type, matches));
      setArenaPoolsByType((prev) => ({ ...prev, [type]: matches }));
      if (renderableCount > 0) {
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'arena_fetch_success',
            payload: { arena: type, source: 'pool-refetch', count: renderableCount, page_index: nextPageIndex },
          }),
        }).catch(() => null);
        return {
          ok: true,
          count: renderableCount,
          status: 'ok',
          pageIndex: nextPageIndex,
          renderableCount,
          advanced,
          pageComplete,
          votedCount,
          totalSize,
        };
      }
      return {
        ok: true,
        count: 0,
        status: 'nonrenderable',
        pageIndex: nextPageIndex,
        renderableCount,
        advanced,
        pageComplete,
        votedCount,
        totalSize,
      };
    } finally {
      arenaRefillInFlightRef.current[type] = false;
    }
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

  async function handlePredict(matchId: string, catId: string, bet: number): Promise<boolean> {
    if (predictBusyMatch) return false;
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
        return false;
      } else {
        setProgress((p) => p ? { ...p, sigils: Number(data.sigils_after ?? p.sigils), predictionStreak: Number(data.current_streak ?? p.predictionStreak) } : p);
        showToast(`Prediction locked (-${bet})`);
        const updated = await fetchArenas();
        const poolMap: Record<'main' | 'rookie', ArenaMatch[]> = {
          main: Array.isArray(updated.mainPool) ? updated.mainPool : [],
          rookie: [],
        };
        const arenasWithPools = (updated.arenas || []).map((a) => {
          const t = a.type === 'main' || a.type === 'rookie' ? a.type : null;
          if (!t) return a;
          const currentRound = Number(a.current_round || 1);
          const poolMatches = poolMap[t];
          if (!poolMatches.length) return a;
          return { ...a, rounds: [{ round: currentRound, matches: poolMatches }] };
        });
        setArenas(arenasWithPools);
        setVotedMatches((prev) => {
          const next = mergeVotedMaps(prev, updated.votedMatches);
          writeVotedMatchesToStorage(next, voteStateScope);
          return next;
        });
        statusBurstUntilRef.current = Date.now() + 20_000;
        refreshGettingStarted();
        return true;
      }
    } catch {
      showToast("Network error");
      return false;
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
    try {
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
    } finally {
      setClaimingCrate(false);
    }
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
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-300/35 backdrop-blur text-cyan-100 text-xs font-semibold popup-linger pointer-events-none">
          <span className="pointer-events-auto">Mission: Add CatClash to your Home Screen. Reward: 50 Sigils.</span>
        </div>
      )}
      {dailyRewardSplash && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-yellow-300/35 bg-gradient-to-b from-yellow-500/20 to-orange-500/10 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
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
      {showClaimNamePrompt && hasCredentials && !hasProfileUsername && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[92vw] max-w-md rounded-2xl border border-emerald-300/35 bg-emerald-500/20 backdrop-blur p-3 shadow-[0_12px_35px_rgba(16,185,129,0.25)] popup-linger pointer-events-auto">
          <p className="text-sm font-bold text-emerald-100">Claim your Vuxsolian name</p>
          <p className="text-[11px] text-emerald-100/85 mt-0.5">Lock in rewards and keep your streak across devices.</p>
          <div className="mt-2 flex items-stretch gap-2">
            <Link
              href="/login?next=/"
              data-testid="claim-name-cta"
              className="h-9 w-full flex-1 rounded-lg bg-emerald-300 text-black text-xs font-bold inline-flex items-center justify-center touch-manipulation"
            >
              Claim Name
            </Link>
            <button
              onClick={() => setShowClaimNamePrompt(false)}
              data-testid="claim-name-later"
              className="h-9 w-full flex-1 rounded-lg bg-white/10 border border-white/20 text-white/85 text-xs font-semibold touch-manipulation"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <Suspense fallback={null}>
        <DebugWidget arenaType={arenaTypeTab} onHydrate={handleDebugWidgetHydrate} />
      </Suspense>
      <section className="pt-5 sm:pt-7 lg:pt-8 pb-2 sm:pb-3">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-yellow-500/25 bg-yellow-500/8 text-[10px]">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-200/95">Unbox. Battle. Evolve.</span>
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div>
              <h1 className="home-page-title text-lg font-bold tracking-tight text-white">Today&apos;s Arenas</h1>
              <p className="home-page-subtitle text-[11px] text-white/55">Vote fast, stack streaks, and catch the next Pulse.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="vuxsolia-canon-line text-[10px] text-cyan-200/65">Vuxsolia</span>
              <Suspense fallback={null}>
                <DebugControls
                  onDebugChange={setDebugMode}
                  onRefresh={handleDebugRefreshMatches}
                  onReset={handleDebugResetMatches}
                />
              </Suspense>
            </div>
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

      <section className="px-3.5 mb-3 sm:hidden">
        <div className="max-w-5xl mx-auto space-y-1.5">
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
                <img src={canonicalThumbForCat({ id: spotlights.hall_of_fame.cat.id, image_url: spotlights.hall_of_fame.cat.image_url || null })} alt={spotlights.hall_of_fame.cat.name} loading="lazy" decoding="async" className="w-full h-28 rounded-lg object-cover mb-2" />
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
                <img src={canonicalThumbForCat({ id: spotlights.cat_of_week.cat.id, image_url: spotlights.cat_of_week.cat.image_url || null })} alt={spotlights.cat_of_week.cat.name} loading="lazy" decoding="async" className="w-full h-28 rounded-lg object-cover mb-2" />
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
            <div id="mission-board" className="arena-entry-card rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-2.5 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div>
                  <h3 className="text-[13px] font-bold text-emerald-200">{gettingStarted.title || 'Enter the Arena'}</h3>
                  <p className="text-[11px] text-emerald-100/80">{gettingStarted.rank_label || 'Arena Rank 1'} · {gettingStarted.progress.pct}% complete</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-300/20 border border-emerald-200/30 text-emerald-100">
                  {gettingStarted.progress.completed}/{gettingStarted.progress.total}
                </span>
              </div>
              <div className="arena-entry-progress h-2 rounded-full bg-black/30 overflow-hidden mb-1.5">
                <div className="arena-entry-progress-fill h-full bg-gradient-to-r from-emerald-300 to-cyan-300 transition-all duration-500" style={{ width: `${gettingStarted.progress.pct}%` }} />
              </div>
              <button
                onClick={handleMissionPrimaryAction}
                className="arena-start-voting-btn h-10 w-full px-3 rounded-xl bg-emerald-300 text-black text-sm font-bold active:scale-[0.99] transition-transform"
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
            <h2 className="home-subsection-title text-[12px] font-bold tracking-wide text-white/85 uppercase">Daily Core</h2>
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
          <div className="daily-crate-card glass rounded-2xl p-3 min-h-[210px] h-full flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <SigilIcon className="daily-crate-icon w-4 h-4" glow />
              <h3 className="font-bold text-sm">Crate</h3>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="crate-hero mb-1.5">
                <div className={`crate-visual ${claimingCrate ? 'opening' : ''}`}>
                  <div className="crate-lid" />
                  <div className="crate-box" />
                  <div className="crate-glow" />
                </div>
              </div>
              <div className="mt-1.5 w-full max-w-[170px] flex flex-col gap-1.5">
                <button
                  onClick={handleClaimCrate}
                  disabled={claimingCrate}
                  className="crate-open-btn h-9 w-full px-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {claimingCrate ? <Loader2 className="w-3 h-3 animate-spin" /> : "Open"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/crate')}
                  className="crate-view-btn h-8 w-full px-3 rounded-lg border border-yellow-300/35 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-100 text-[11px] font-semibold"
                >
                  View Crates
                </button>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-white/10 text-center space-y-1">
              <p className="text-[10px] text-white/55">Daily resets in {crateCountdown}</p>
              <div className="flex items-center justify-center gap-1 text-[9px]">
                <span className="px-1.5 py-0.5 rounded-full bg-zinc-500/25 text-zinc-200">C</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/25 text-blue-200">R</span>
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200">E</span>
                <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/25 text-yellow-100">L</span>
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-100">M</span>
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-100">G</span>
              </div>
              <p className="text-[10px] text-white/60 min-h-[14px]">
                {crateMeta?.pity_status
                  ? `Pity: ${Math.max(0, 10 - Number(crateMeta.pity_status.streak_without_epic_plus || 0))} to Epic+`
                  : 'Every open builds pity toward Epic+'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Arenas */}
      <section id="home-arenas" className="px-2.5 sm:px-4 pb-8">
        <div className="mx-auto w-full max-w-none sm:max-w-5xl">
          <div className="mb-2 sm:mb-3 flex justify-end">
            <Link
              href="/duel"
              onClick={(e) => {
                if (e.defaultPrevented) return;
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const before = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                window.setTimeout(() => {
                  const after = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  if (after === before) window.location.assign('/duel');
                }, 220);
              }}
              data-testid="open-duel-arena-cta-arenas"
              className="relative z-20 pointer-events-auto text-[11px] text-cyan-200 inline-flex items-center gap-1 tap-target"
            >
              Open Duel Arena <ArrowRight className="w-3 h-3" />
              {pendingDuelCount > 0 ? (
                <span className="px-1 py-0.5 rounded-full bg-red-500/20 border border-red-300/35 text-[9px] text-red-100 font-semibold">
                  {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="mb-4">
            <div className="grid grid-cols-1 gap-2">
              <Button size="md" variant="primary" className="bg-white text-black border-white">
                Arena
              </Button>
            </div>
          </div>

          {!hasMatchesForActiveTab ? (
            <div className="text-center py-12 glass rounded-2xl">
              {(hasSeenArenaByType[arenaTypeTab] || Object.keys(votedMatches).length > 0) ? (
                <>
                  <p className="text-white/70 mb-2">You've voted on all matches for today. Come back later!</p>
                  <p className="text-white/45 text-sm">Next Pulse in {pulseCountdown || '--:--:--'}.</p>
                </>
              ) : (
                <>
                  <p className="text-white/50 mb-4">No active arena today.</p>
                  <Link href="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:scale-105 transition-transform">
                    Submit a Cat
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedArenas.map((arena) => (
                <ArenaSection key={`${arena.tournament_id}:${debugDeckNonce}`} arena={arena} votedMatches={votedMatches} voteSnapshotByMatchId={voteSnapshotByMatchId}
                  votingMatch={votingMatch}
                  predictBusyMatch={predictBusyMatch}
                  calloutBusyMatch={calloutBusyMatch}
                  socialEnabled={socialLoopEnabled}
                  availableSigils={progress?.sigils || 0}
                  voteStreak={voteStreak}
                  hotMatchBiasEnabled={hotMatchBiasEnabled}
                  testerMode={testerMode}
                  globalPageInfo={null}
                  debugInfo={null}
                  queueInfo={arenaQueueInfo[arena.type as 'main' | 'rookie'] || null}
                  pulseCountdown={pulseCountdown}
                  onSwitchArena={undefined}
                  onRequestMore={() => debugMode ? handleDebugArenaStackRefill((arena.type as 'main' | 'rookie')) : handleArenaStackRefill((arena.type as 'main' | 'rookie'))}
                  onVote={handleVote}
                  onPredict={handlePredict}
                  onCreateCallout={handleCreateCallout}
                  debugMode={debugMode}
            />
          ))}
        </div>
      )}

          <div className="mt-4" ref={duelSectionRef}>
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
