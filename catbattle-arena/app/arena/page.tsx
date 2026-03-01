'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, PlusCircle, Swords, Zap } from 'lucide-react';
import { showGlobalToast } from '../lib/global-toast';

type MyCat = {
  id: string;
  name: string;
  rarity: string;
  image_url: string | null;
  cat_level?: number;
  stats?: {
    attack: number;
    defense: number;
    speed: number;
    charisma: number;
    chaos: number;
  };
};

type Snapshot = {
  id: string;
  cat_id: string;
  cat_name: string;
  ai_behavior: 'aggressive' | 'tactical' | 'turtle' | 'trickster' | 'defensive' | 'chaotic';
  skill_priority: string[];
  snapshot_version?: number;
  created_at: string;
  active: boolean;
};

type ArenaMatch = {
  id: string;
  opponent_name: string | null;
  winner_snapshot_id: string | null;
  snapshot_a_id: string | null;
  status?: 'active' | 'complete';
  turns: number;
  rating_delta: number;
  created_at: string;
};

type NpcCat = { id: string; name: string; rarity: string; image_url?: string | null };
type BattleAction = 'strike' | 'guard' | 'control' | 'burst' | 'heal' | 'bleed' | 'stun';

type BattleState = {
  turn: number;
  max_turns: number;
  weekly_modifier?: 'speed_week' | 'chaos_week' | 'control_week' | 'shields_week' | null;
  player_stance?: 'neutral' | 'aggro' | 'guard';
  npc_stance?: 'neutral' | 'aggro' | 'guard';
  fighter_a: {
    hp: number;
    maxHp: number;
    energy: number;
    shield: number;
    momentum: number;
    label: string;
  };
  fighter_b: {
    hp: number;
    maxHp: number;
    energy: number;
    shield: number;
    momentum: number;
    label: string;
  };
  winner_slot: 'a' | 'b' | null;
};

type ReplayEvent = {
  turn_no: number;
  actor_slot: 'a' | 'b';
  action_type: string;
  value: number;
  payload?: {
    actor_hp?: number;
    target_hp?: number;
    actor_shield?: number;
    target_shield?: number;
    actor_energy?: number;
    interaction_message?: string | null;
  };
};

type DailyBoss = {
  today: string;
  reward_sigils: number;
  claimed: boolean;
  clear_streak?: number;
  boss_modifier?: string | null;
  weekly_modifier?: {
    key: 'speed_week' | 'chaos_week' | 'control_week' | 'shields_week';
    label: string;
    description: string;
  } | null;
  boss: { id: string; name: string; rarity: string; image_url?: string | null };
};

const AI_BEHAVIORS = ['aggressive', 'tactical', 'turtle', 'trickster'] as const;
const PRIORITY_PRESETS: Record<string, string[]> = {
  balanced: ['strike', 'guard', 'control', 'burst'],
  pressure: ['control', 'strike', 'burst', 'guard'],
  fortress: ['guard', 'control', 'strike', 'burst'],
  chaos: ['burst', 'strike', 'control', 'guard'],
};

const ACTION_META: Record<BattleAction, { label: string; cost: number; hint: string; color: string }> = {
  strike: { label: 'Strike', cost: 2, hint: 'Steady damage', color: 'bg-cyan-400/20 border-cyan-300/30 text-cyan-100' },
  guard: { label: 'Guard', cost: 1, hint: 'Build shield', color: 'bg-emerald-400/20 border-emerald-300/30 text-emerald-100' },
  control: { label: 'Control', cost: 2, hint: 'Debuff / disable', color: 'bg-violet-400/20 border-violet-300/30 text-violet-100' },
  burst: { label: 'Burst', cost: 4, hint: 'Heavy chaos hit', color: 'bg-amber-400/20 border-amber-300/30 text-amber-100' },
  heal: { label: 'Heal', cost: 3, hint: 'Recover HP', color: 'bg-lime-400/20 border-lime-300/30 text-lime-100' },
  bleed: { label: 'Bleed', cost: 3, hint: 'Apply damage over time', color: 'bg-rose-400/20 border-rose-300/30 text-rose-100' },
  stun: { label: 'Stun', cost: 3, hint: 'Chance to skip enemy turn', color: 'bg-indigo-400/20 border-indigo-300/30 text-indigo-100' },
};

const SPECIAL_UNLOCKS: Array<{ action: BattleAction; level: number }> = [
  { action: 'heal', level: 3 },
  { action: 'bleed', level: 5 },
  { action: 'stun', level: 8 },
];

function pct(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

function fallbackCatUrl(seed: string) {
  return '/cat-placeholder.svg';
}

function behaviorLabel(v: Snapshot['ai_behavior']): string {
  if (v === 'turtle' || v === 'defensive') return 'Turtle';
  if (v === 'trickster' || v === 'chaotic') return 'Trickster';
  if (v === 'aggressive') return 'Aggro';
  return 'Tactical';
}

function modifierMeta(key?: string | null): { label: string; description: string } | null {
  if (key === 'speed_week') return { label: 'Week of Speed', description: 'First action gives +1 momentum to the faster cat.' };
  if (key === 'chaos_week') return { label: 'Week of Chaos', description: 'Chaos proc chance +3% (capped).' };
  if (key === 'control_week') return { label: 'Week of Control', description: 'First Control costs 1 less energy.' };
  if (key === 'shields_week') return { label: 'Week of Shields', description: 'First large hit on each cat is reduced by 20%.' };
  return null;
}

export default function WhiskerArenaPage() {
  const show = (message: string) => showGlobalToast(message, 4500);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [battleBusy, setBattleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uninitialized, setUninitialized] = useState(false);

  const [cats, setCats] = useState<MyCat[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [rating, setRating] = useState<{ rating: number; tier: string; wins: number; losses: number }>({
    rating: 1000,
    tier: 'bronze',
    wins: 0,
    losses: 0,
  });

  const [catId, setCatId] = useState('');
  const [npcCats, setNpcCats] = useState<NpcCat[]>([]);
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [behavior, setBehavior] = useState<Snapshot['ai_behavior']>('tactical');
  const [priorityPreset, setPriorityPreset] = useState<keyof typeof PRIORITY_PRESETS>('balanced');

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [selectedStance, setSelectedStance] = useState<'neutral' | 'aggro' | 'guard'>('neutral');
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [battleLog, setBattleLog] = useState<ReplayEvent[]>([]);

  const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([]);
  const [dailyBoss, setDailyBoss] = useState<DailyBoss | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [snapshots]
  );
  const preferredSnapshotId = useMemo(() => {
    const sameCat = sortedSnapshots.find((s) => s.cat_id === catId);
    return sameCat?.id || sortedSnapshots[0]?.id || '';
  }, [sortedSnapshots, catId]);

  const selectedNpc = useMemo(() => npcCats.find((n) => n.id === selectedNpcId), [npcCats, selectedNpcId]);

  const energyA = battleState?.fighter_a.energy || 0;
  const activeModifier = modifierMeta(battleState?.weekly_modifier || dailyBoss?.weekly_modifier?.key || null);
  const baseActionButtons: BattleAction[] = ['strike', 'guard', 'control', 'burst'];

  const activeCatLevel = useMemo(() => {
    if (!activeSnapshotId) return 1;
    const snap = snapshots.find((s) => s.id === activeSnapshotId);
    if (!snap) return 1;
    const cat = cats.find((c) => c.id === snap.cat_id);
    return Math.max(1, Number(cat?.cat_level || 1));
  }, [activeSnapshotId, snapshots, cats]);

  const unlockedSpecialButtons = useMemo(() => {
    return SPECIAL_UNLOCKS.filter((s) => activeCatLevel >= s.level).map((s) => s.action);
  }, [activeCatLevel]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch('/api/me', { cache: 'no-store' });
      const me = await meRes.json().catch(() => ({}));
      const guestId = me?.guest_id;
      if (!guestId) throw new Error('No session found');

      const [profileRes, snapRes, historyRes, npcRes] = await Promise.all([
        fetch(`/api/profile/${guestId}`, { cache: 'no-store' }),
        fetch('/api/arena/snapshot', { cache: 'no-store' }),
        fetch('/api/arena/history', { cache: 'no-store' }),
        fetch('/api/arena/npcs', { cache: 'no-store' }),
      ]);

      const profile = await profileRes.json().catch(() => ({}));
      const snap = await snapRes.json().catch(() => ({}));
      const history = await historyRes.json().catch(() => ({}));
      const npc = await npcRes.json().catch(() => ({}));

      const myCats: MyCat[] = (profile?.submitted_cats || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        rarity: c.rarity || 'Common',
        image_url: c.image_url || null,
        cat_level: Number(c.cat_level || c.level || 1),
        stats: c.stats || {
          attack: Number(c.attack || 0),
          defense: Number(c.defense || 0),
          speed: Number(c.speed || 0),
          charisma: Number(c.charisma || 0),
          chaos: Number(c.chaos || 0),
        },
      }));

      setCats(myCats);
      setCatId((prev) => prev || myCats[0]?.id || '');

      if (!snapRes.ok || !snap?.ok) {
        const msg = String(snap?.error || '');
        if (msg.toLowerCase().includes('not initialized')) {
          setUninitialized(true);
          setSnapshots([]);
        } else {
          throw new Error(snap?.error || 'Failed to load snapshots');
        }
      } else {
        setUninitialized(false);
        setSnapshots(snap.snapshots || []);
      }

      if (history?.arena_uninitialized) {
        setUninitialized(true);
        setMatches([]);
      } else if (historyRes.ok && history?.ok) {
        const rows = history.matches || [];
        setMatches(rows);
        setRating(history.rating || { rating: 1000, tier: 'bronze', wins: 0, losses: 0 });

        const active = rows.find((m: ArenaMatch) => m.status === 'active');
        if (active?.id) {
          await loadActiveMatch(active.id);
        }
      }

      if (npcRes.ok && npc?.ok) {
        setNpcCats(npc.npcs || []);
      }
      const bossRes = await fetch('/api/arena/boss', { cache: 'no-store' });
      const boss = await bossRes.json().catch(() => ({}));
      if (bossRes.ok && boss?.ok) setDailyBoss(boss as DailyBoss);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Whisker Arena');
    } finally {
      setLoading(false);
    }
  }

  async function createSnapshot() {
    if (!catId || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/arena/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cat_id: catId,
          ai_behavior: behavior,
          skill_priority: PRIORITY_PRESETS[priorityPreset],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Snapshot failed');
      } else {
        show('Snapshot published');
        await loadAll();
      }
    } catch {
      setError('Snapshot failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadActiveMatch(matchId: string) {
    try {
      const res = await fetch(`/api/arena/match/${matchId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      setActiveMatchId(matchId);
      setActiveSnapshotId(data?.match?.snapshot_a_id || null);
      setBattleState(data.state || null);
      setSelectedStance((data.state?.player_stance || 'neutral') as 'neutral' | 'aggro' | 'guard');
      setBattleLog((data.events || []).slice(-18));
    } catch {
      // ignore
    }
  }

  async function startBattle(snapshotId: string) {
    if (!snapshotId || battleBusy || uninitialized) return;
    setBattleBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/arena/match/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_id: snapshotId, opponent_cat_id: selectedNpcId || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to start battle');
      } else {
        setActiveMatchId(data.match_id);
        setActiveSnapshotId(snapshotId);
        setBattleState(data.state || null);
        setSelectedStance((data.state?.player_stance || 'neutral') as 'neutral' | 'aggro' | 'guard');
        setBattleLog([]);
        if (Number(data.cross_mode_bonus || 0) > 0) {
          show(`Battle started · +${data.cross_mode_bonus} cross-mode sigils`);
        } else {
          show(data.resumed ? 'Resumed active match' : 'Battle started');
        }
        await loadAll();
      }
    } catch {
      setError('Failed to start battle');
    } finally {
      setBattleBusy(false);
    }
  }

  async function startBossBattle(snapshotId: string) {
    if (!snapshotId || battleBusy || uninitialized) return;
    setBattleBusy(true);
    try {
      const res = await fetch('/api/arena/boss/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_id: snapshotId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to start Daily Boss');
      } else {
        setActiveMatchId(data.match_id);
        setActiveSnapshotId(snapshotId);
        setBattleState(data.state || null);
        setSelectedStance((data.state?.player_stance || 'neutral') as 'neutral' | 'aggro' | 'guard');
        setBattleLog([]);
        if (Number(data.cross_mode_bonus || 0) > 0) {
          show(`Daily Boss started · +${data.cross_mode_bonus} cross-mode sigils`);
        } else {
          show(`Daily Boss started: ${data.boss_name}`);
        }
        await loadAll();
      }
    } catch {
      setError('Failed to start Daily Boss');
    } finally {
      setBattleBusy(false);
    }
  }

  async function playAction(action: BattleAction) {
    if (!activeMatchId || !battleState || battleBusy) return;
    if ((battleState.fighter_a.energy || 0) < ACTION_META[action].cost) {
      show('Not enough energy');
      return;
    }

    setBattleBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/arena/match/${activeMatchId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, stance: selectedStance }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Action failed');
      } else {
        setBattleState(data.state || null);
        const nextEvents = [...battleLog, ...(data.events || [])].slice(-20);
        setBattleLog(nextEvents);

        if (data.done) {
          const tokenLine = Number(data.whisker_tokens_awarded || 0) > 0 ? ` · +${data.whisker_tokens_awarded} tokens` : '';
          const rollLine = Number(data.bonus_rolls_awarded || 0) > 0 ? ` · +${data.bonus_rolls_awarded} bonus roll` : '';
          show(data.winner_slot === 'a'
            ? `Victory! Rating +${data.rating_delta || 0}${tokenLine}${rollLine}`
            : `Defeat ${data.rating_delta || 0}${tokenLine}${rollLine}`);
          setActiveMatchId(null);
          setActiveSnapshotId(null);
          await loadAll();
        }
      }
    } catch {
      setError('Action failed');
    } finally {
      setBattleBusy(false);
    }
  }

  async function loadReplay(matchId: string) {
    setSelectedReplay(matchId);
    setReplayEvents([]);
    try {
      const res = await fetch(`/api/arena/match/${matchId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Replay failed');
        return;
      }
      setReplayEvents(data.events || []);
    } catch {
      setError('Replay failed');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090d] text-white pt-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-white/40" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-white pt-4 pb-8 px-3 sm:px-4">

      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white mb-3">
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>

        <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-cyan-500/15 to-transparent p-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Whisker Arena</h1>
          <p className="text-xs sm:text-sm text-white/70 mt-1">Turn-based 1v1. Pick actions each turn, manage energy, and outplay NPCs or snapshots.</p>
          {activeModifier && (
            <div className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
              <p className="text-xs font-bold text-cyan-100">{activeModifier.label}</p>
              <p className="text-[11px] text-cyan-100/80">{activeModifier.description}</p>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-white/10 px-2.5 py-1.5">Rating <span className="font-bold">{rating.rating}</span></div>
            <div className="rounded-lg bg-white/10 px-2.5 py-1.5">Tier <span className="font-bold capitalize">{rating.tier}</span></div>
            <div className="rounded-lg bg-white/10 px-2.5 py-1.5">W/L <span className="font-bold">{rating.wins}/{rating.losses}</span></div>
            <div className="rounded-lg bg-white/10 px-2.5 py-1.5">Turn Cap <span className="font-bold">12</span></div>
          </div>
        </section>

        {dailyBoss?.boss && (
          <section className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 sm:p-4 mb-4">
            <h2 className="font-bold mb-2">Daily Boss Cat</h2>
            <div className="flex items-center gap-3">
              <img src={dailyBoss.boss.image_url || '/cat-placeholder.svg'} alt={dailyBoss.boss.name} className="w-16 h-16 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-bold">{dailyBoss.boss.name}</p>
                <p className="text-xs text-white/70">{dailyBoss.boss.rarity} · Reward {dailyBoss.reward_sigils} sigils + bonus roll + XP</p>
                <p className="text-[11px] text-white/55">{dailyBoss.claimed ? 'Reward claimed today' : 'Defeat this boss once today for daily rewards.'}</p>
                {(dailyBoss.boss_modifier || (dailyBoss.clear_streak || 0) > 0) && (
                  <p className="text-[11px] text-white/55">
                    Modifier: {String(dailyBoss.boss_modifier || 'none').replace(/_/g, ' ')} · Streak: {dailyBoss.clear_streak || 0}
                  </p>
                )}
              </div>
            </div>
            <button
              disabled={!preferredSnapshotId || battleBusy || uninitialized}
              onClick={() => startBossBattle(preferredSnapshotId)}
              className="mt-3 px-3 py-2 rounded-lg bg-amber-300 text-black text-xs font-bold disabled:opacity-50"
            >
              Challenge Daily Boss
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Start Match</p>
              <p className="text-[11px] text-white/60">Fast queue into snapshots or NPCs.</p>
            </div>
            <button
              disabled={!preferredSnapshotId || battleBusy || uninitialized}
              onClick={() => startBattle(preferredSnapshotId)}
              className="px-3 py-2 rounded-lg bg-cyan-300 text-black text-xs font-black disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Swords className="w-3.5 h-3.5" />
              Start Match
            </button>
          </div>
        </section>

        <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-4">
          <summary className="cursor-pointer text-sm font-bold">Whisker Tutorial</summary>
          <div className="mt-3 grid gap-2 text-xs text-white/80">
            <div className="rounded-lg bg-white/5 p-2.5"><span className="font-bold text-cyan-200">1. Publish Snapshot:</span> choose one cat, AI style, and move priority. That frozen build is your arena version.</div>
            <div className="rounded-lg bg-white/5 p-2.5"><span className="font-bold text-emerald-200">2. Start Match:</span> optionally target an NPC. Both cats begin at 3 energy and gain +2 each turn.</div>
            <div className="rounded-lg bg-white/5 p-2.5"><span className="font-bold text-amber-200">3. Choose Action + Stance:</span> set Neutral/Aggro/Guard each turn, then play Strike, Guard, Control, or Burst.</div>
            <div className="rounded-lg bg-white/5 p-2.5"><span className="font-bold text-sky-200">Combat Model:</span> HP = Defense x 10. Momentum swings from interactions (Strike &gt; Control, Control &gt; Guard, Guard &gt; Strike).</div>
          </div>
        </details>

        {uninitialized && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 mb-4 text-sm text-red-100">
            Whisker Arena tables are not initialized yet. Run migration `016_whisker_arena_phase1.sql` and `020_whisker_snapshot_version.sql`.
          </div>
        )}

        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 mb-4 text-sm text-red-100">{error}</div>}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 mb-4">
          <h2 className="font-bold mb-3">Snapshot Builder</h2>
          {cats.length === 0 ? (
            <div className="text-sm text-white/60">
              No cats yet. <Link href="/submit" className="text-cyan-300 underline">Submit or adopt a cat first</Link>.
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <label>
                  <span className="text-white/60 block mb-1">Cat</span>
                  <select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-full bg-black/70 border border-white/20 rounded-lg p-2">
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-white/60 block mb-1">AI Behavior</span>
                  <select value={behavior} onChange={(e) => setBehavior(e.target.value as Snapshot['ai_behavior'])} className="w-full bg-black/70 border border-white/20 rounded-lg p-2">
                    {AI_BEHAVIORS.map((b) => <option key={b} value={b}>{behaviorLabel(b)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-white/60 block mb-1">Move Preset</span>
                  <select value={priorityPreset} onChange={(e) => setPriorityPreset(e.target.value as keyof typeof PRIORITY_PRESETS)} className="w-full bg-black/70 border border-white/20 rounded-lg p-2">
                    <option value="balanced">Balanced</option>
                    <option value="pressure">Pressure</option>
                    <option value="fortress">Fortress</option>
                    <option value="chaos">Chaos</option>
                  </select>
                </label>
                <label>
                  <span className="text-white/60 block mb-1">NPC Target (optional)</span>
                  <select value={selectedNpcId} onChange={(e) => setSelectedNpcId(e.target.value)} className="w-full bg-black/70 border border-white/20 rounded-lg p-2">
                    <option value="">Random NPC / Snapshot</option>
                    {npcCats.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.rarity})</option>)}
                  </select>
                </label>
              </div>

              {selectedNpc && (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2.5 flex items-center gap-2">
                  <img src={selectedNpc.image_url || fallbackCatUrl(`npc-${selectedNpc.id}`)} alt={selectedNpc.name} className="w-10 h-10 rounded object-cover" />
                  <p className="text-xs text-white/80">Targeting <span className="font-bold">{selectedNpc.name}</span> ({selectedNpc.rarity})</p>
                </div>
              )}

              <button
                disabled={!catId || busy || uninitialized}
                onClick={createSnapshot}
                className="mt-3 px-3 py-2 rounded-lg bg-emerald-300 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Publish Snapshot
              </button>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 mb-4">
            <h2 className="font-bold mb-3">Turn Battle</h2>
            {!battleState ? (
              <p className="text-sm text-white/50">Start a match from your snapshot list.</p>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#121826] to-[#0f1014] p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="rounded-lg bg-cyan-500/10 border border-cyan-300/20 p-2">
                      <p className="font-bold truncate">{battleState.fighter_a.label}</p>
                      <p className="text-[11px] text-white/70">HP {battleState.fighter_a.hp}/{battleState.fighter_a.maxHp}</p>
                      <div className="h-2 rounded bg-white/10 overflow-hidden mt-1"><div className="h-full bg-emerald-400" style={{ width: `${pct(battleState.fighter_a.hp, battleState.fighter_a.maxHp)}%` }} /></div>
                      <p className="text-[11px] text-white/70 mt-1">Shield {battleState.fighter_a.shield} · Energy {battleState.fighter_a.energy}</p>
                      <div className="mt-1">
                        <p className="text-[10px] text-white/60">Momentum</p>
                        <div className="h-1.5 rounded bg-white/10 overflow-hidden"><div className={`h-full ${battleState.fighter_a.momentum >= 5 ? 'bg-amber-300' : battleState.fighter_a.momentum >= 3 ? 'bg-cyan-300' : 'bg-white/40'}`} style={{ width: `${pct(battleState.fighter_a.momentum, 6)}%` }} /></div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 border border-rose-300/20 p-2">
                      <p className="font-bold truncate">{battleState.fighter_b.label}</p>
                      <p className="text-[11px] text-white/70">HP {battleState.fighter_b.hp}/{battleState.fighter_b.maxHp}</p>
                      <div className="h-2 rounded bg-white/10 overflow-hidden mt-1"><div className="h-full bg-rose-400" style={{ width: `${pct(battleState.fighter_b.hp, battleState.fighter_b.maxHp)}%` }} /></div>
                      <p className="text-[11px] text-white/70 mt-1">Shield {battleState.fighter_b.shield} · Energy {battleState.fighter_b.energy}</p>
                      <div className="mt-1">
                        <p className="text-[10px] text-white/60">Momentum</p>
                        <div className="h-1.5 rounded bg-white/10 overflow-hidden"><div className={`h-full ${battleState.fighter_b.momentum >= 5 ? 'bg-amber-300' : battleState.fighter_b.momentum >= 3 ? 'bg-cyan-300' : 'bg-white/40'}`} style={{ width: `${pct(battleState.fighter_b.momentum, 6)}%` }} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/5 border border-white/10 p-2 mb-2">
                    <p className="text-[11px] text-white/70">Turn {battleState.turn}/{battleState.max_turns}</p>
                    <div className="h-2 rounded bg-white/10 overflow-hidden mt-1">
                      <div className="h-full bg-cyan-300 transition-all" style={{ width: `${pct(energyA, 6)}%` }} />
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">Your Energy {energyA}/6</p>
                  </div>

                  <div className="rounded-lg bg-white/5 border border-white/10 p-2 mb-2">
                    <p className="text-[11px] text-white/70 mb-1">Stance</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['neutral', 'aggro', 'guard'] as const).map((stance) => (
                        <button
                          key={stance}
                          type="button"
                          onClick={() => setSelectedStance(stance)}
                          className={`rounded-md px-2 py-1.5 text-[11px] font-bold uppercase border ${
                            selectedStance === stance
                              ? 'bg-cyan-300/20 border-cyan-200/50 text-cyan-100'
                              : 'bg-white/5 border-white/15 text-white/70'
                          }`}
                        >
                          {stance}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">Aggro: +damage / less mitigation. Guard: less taken / less dealt.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {baseActionButtons.map((action) => {
                      const meta = ACTION_META[action];
                      const disabled = battleBusy || energyA < meta.cost || !!battleState.winner_slot;
                      return (
                        <button
                          key={action}
                          disabled={disabled}
                          onClick={() => playAction(action)}
                          className={`rounded-lg border p-2 text-left text-xs ${meta.color} disabled:opacity-40`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase tracking-wide">{meta.label}</span>
                            <span className="inline-flex items-center gap-0.5 text-[11px]"><Zap className="w-3 h-3" />{meta.cost}</span>
                          </div>
                          <p className="text-[11px] opacity-85 mt-0.5">{meta.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                  {unlockedSpecialButtons.length > 0 && (
                    <>
                      <p className="text-[11px] text-white/60 mt-2 mb-1">Unlocked Specials (Cat Lv {activeCatLevel})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {unlockedSpecialButtons.map((action) => {
                          const meta = ACTION_META[action];
                          const disabled = battleBusy || energyA < meta.cost || !!battleState.winner_slot;
                          return (
                            <button
                              key={action}
                              disabled={disabled}
                              onClick={() => playAction(action)}
                              className={`rounded-lg border p-2 text-left text-[11px] ${meta.color} disabled:opacity-40`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold uppercase tracking-wide">{meta.label}</span>
                                <span className="inline-flex items-center gap-0.5 text-[10px]"><Zap className="w-3 h-3" />{meta.cost}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {unlockedSpecialButtons.length === 0 && (
                    <p className="text-[11px] text-white/45 mt-2">Unlock specials with cat levels: Heal Lv3, Bleed Lv5, Stun Lv8.</p>
                  )}
                </div>

                <details className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
                  <summary className="cursor-pointer text-xs font-bold">Combat Log</summary>
                  <div className="max-h-40 overflow-auto mt-1">
                    {battleLog.length === 0 && <p className="text-xs text-white/50">Action log appears here.</p>}
                    {battleLog.slice().reverse().map((ev, idx) => (
                      <div key={`${ev.turn_no}-${idx}`} className="py-0.5">
                        <p className="text-[11px] text-white/80">
                          T{ev.turn_no} · {ev.actor_slot.toUpperCase()} used <span className="font-bold uppercase">{ev.action_type}</span> {ev.value > 0 ? `(${ev.value})` : ''}
                        </p>
                        {ev.payload?.interaction_message && (
                          <p className="text-[10px] text-cyan-200/80 uppercase tracking-wide">{ev.payload.interaction_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>

                {battleState.winner_slot && (
                  <div className="mt-2 rounded-lg border border-yellow-300/30 bg-yellow-500/10 p-2 text-xs">
                    <p className="font-bold">{battleState.winner_slot === 'a' ? 'You win the duel!' : 'Defeat. Tune your snapshot and retry.'}</p>
                  </div>
                )}
              </>
            )}
        </section>

        <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 mb-4">
          <summary className="cursor-pointer font-bold text-sm">My Snapshots</summary>
          <div className="mt-3 space-y-2">
            {sortedSnapshots.length === 0 && <p className="text-sm text-white/50">No snapshots yet.</p>}
            {sortedSnapshots.map((s) => (
              <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-sm font-bold">{s.cat_name} <span className="text-[11px] text-cyan-300">v{s.snapshot_version || 1}</span></p>
                <p className="text-xs text-white/60">{behaviorLabel(s.ai_behavior)} · {s.skill_priority.join(' > ')}</p>
                <div className="mt-2 flex justify-between items-center gap-2">
                  <span className="text-[11px] text-white/40">{new Date(s.created_at).toLocaleString()}</span>
                  <button
                    disabled={battleBusy || uninitialized}
                    onClick={() => startBattle(s.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-300 text-black text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Start Match
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>

        <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <summary className="cursor-pointer font-bold text-sm">Recent Results</summary>
          <div className="mt-3 space-y-2">
            {matches.filter((m) => m.status !== 'active').length === 0 && <p className="text-sm text-white/50">No completed matches yet.</p>}
            {matches.filter((m) => m.status !== 'active').map((m) => {
              const won = !!m.snapshot_a_id && m.winner_snapshot_id === m.snapshot_a_id;
              return (
                <div key={m.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="text-sm font-bold">vs {m.opponent_name || 'Unknown'}</p>
                  <p className="text-xs text-white/60">{won ? 'Win' : 'Loss'} · Turns {m.turns} · Rating {m.rating_delta > 0 ? `+${m.rating_delta}` : m.rating_delta}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/40">{new Date(m.created_at).toLocaleString()}</span>
                    <button onClick={() => loadReplay(m.id)} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs">Replay Log</button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedReplay && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
              <p className="text-xs text-white/60 mb-2">Replay {selectedReplay}</p>
              <div className="space-y-1.5 max-h-52 overflow-auto">
                {replayEvents.length === 0 && <p className="text-xs text-white/50">Loading...</p>}
                {replayEvents.map((ev, idx) => (
                  <div key={`${ev.turn_no}-${idx}`} className="rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs">
                    Turn {ev.turn_no} · {ev.actor_slot.toUpperCase()} used {ev.action_type.toUpperCase()} {ev.value > 0 ? `(${ev.value})` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </details>
      </div>
    </main>
  );
}
