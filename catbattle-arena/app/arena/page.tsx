'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Loader2, PlusCircle, Play, Swords, Zap } from 'lucide-react';
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
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);
  const [moveFlash, setMoveFlash] = useState<{ id: number; label: string } | null>(null);

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

  const hasActiveMatch = Boolean(activeMatchId);
  const filteredRecent = matches.filter((m) => m.status !== 'active');
  const momentumPct = useMemo(() => {
    if (!battleState) return 50;
    const momentum = battleState.fighter_a.momentum;
    return Math.max(0, Math.min(100, Math.round(((momentum + 5) / 10) * 100)));
  }, [battleState]);

  function onMoveFlashComplete(id: number) {
    setMoveFlash((current) => (current?.id === id ? null : current));
  }

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
    const flash = { id: Date.now(), label: ACTION_META[action].label };
    setMoveFlash(flash);
    setTimeout(() => onMoveFlashComplete(flash.id), 740);

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

        <section className="arena-hero-shell">
          <div className="arena-hero-top">
            <div>
              <p className="arena-hero-eyebrow">⚔ BATTLE MODE</p>
              <h1 className="arena-hero-title">Whisker Arena</h1>
              <p className="arena-hero-subtitle">Turn-based 1v1. Outplay NPCs or rival snapshots.</p>
            </div>
            <div className="arena-tier-pill">Tier {String(rating.tier || 'bronze').toUpperCase()}</div>
          </div>

          {activeModifier && (
            <div className="arena-week-buff mt-3">
              <span className="arena-week-dot" />
              <div>
                <p className="arena-week-label">{activeModifier.label}</p>
                <p className="arena-week-desc">{activeModifier.description}</p>
              </div>
            </div>
          )}

          <div className="arena-stats-grid mt-3">
            <div className="arena-stat-cell">
              <p className="arena-stat-label">W / L</p>
              <p className="arena-stat-value">{rating.wins} / {rating.losses}</p>
            </div>
            <div className="arena-stat-cell">
              <p className="arena-stat-label">TURN CAP</p>
              <p className="arena-stat-value">12</p>
            </div>
            <div className="arena-stat-cell">
              <p className="arena-stat-label">RATING</p>
              <p className="arena-stat-value">{rating.rating}</p>
            </div>
            <div className="arena-stat-cell">
              <p className="arena-stat-label">ELO RATING</p>
              <p className="arena-stat-value">{rating.tier}</p>
            </div>
          </div>
        </section>

        <section className="arena-section-shell">
          <div className="arena-section-head">
            <p className="arena-section-title">Quick Match</p>
            <button
              disabled={!preferredSnapshotId || battleBusy || uninitialized || hasActiveMatch}
              onClick={() => startBattle(preferredSnapshotId)}
              className="arena-start-match-btn"
            >
              <Play className="w-3.5 h-3.5" />
              Start Match
            </button>
          </div>
          {!preferredSnapshotId && <p className="arena-helper-text">Select a snapshot in configuration first.</p>}
          {hasActiveMatch && <p className="arena-helper-text mt-1">Match in progress.</p>}
        </section>

        {dailyBoss?.boss && (
          <section className="arena-boss-card">
            <div className="arena-boss-row">
              <div className="arena-boss-avatar-wrap">
                <img src={dailyBoss.boss.image_url || '/cat-placeholder.svg'} alt={dailyBoss.boss.name} className="arena-boss-avatar" />
              </div>
              <div className="arena-boss-copy">
                <p className="arena-boss-name">{dailyBoss.boss.name}</p>
                <p className="arena-boss-meta">{dailyBoss.boss.rarity} · Reward {dailyBoss.reward_sigils} sigils</p>
                {dailyBoss.boss_modifier && <p className="arena-boss-meta">Modifier: {dailyBoss.boss_modifier.replace(/_/g, ' ')}</p>}
                <p className="arena-boss-meta">Streak: {dailyBoss.clear_streak || 0}</p>
              </div>
            </div>
            <button
              disabled={!preferredSnapshotId || battleBusy || uninitialized || hasActiveMatch || dailyBoss.claimed}
              onClick={() => startBossBattle(preferredSnapshotId)}
              className="arena-boss-btn"
            >
              {dailyBoss.claimed ? '✓ Completed' : 'Challenge Daily Boss'}
            </button>
          </section>
        )}

        {uninitialized && (
          <div className="arena-error-box">Whisker Arena tables are not initialized yet. Run migration `016_whisker_arena_phase1.sql` and `020_whisker_snapshot_version.sql`.</div>
        )}

        {error && <div className="arena-error-box">{error}</div>}

        <section className="arena-section-shell">
          <button className="arena-snapshot-header" onClick={() => setSnapshotPanelOpen((v) => !v)} type="button">
            <p>
              Snapshot Config
              <span className="arena-snapshot-sub">{snapshotPanelOpen ? 'Click to hide' : 'Click to expand'}</span>
            </p>
            <ChevronDown className={`w-4 h-4 transition-transform ${snapshotPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          {!snapshotPanelOpen && (
            <p className="arena-helper-text">{preferredSnapshotId ? `Current snapshot configured` : 'No snapshot configured'}</p>
          )}

          {!preferredSnapshotId && (
            <div className="arena-submit-guide">
              <div>
                <p className="arena-submit-guide-title">Need a fighter first?</p>
                <p className="arena-submit-guide-copy">Submit a cat, then come back here to publish your snapshot and enter Arena battles.</p>
              </div>
              <div className="arena-submit-guide-actions">
                <Link href="/submit" className="arena-submit-guide-primary">Submit Cat</Link>
              </div>
            </div>
          )}

          {snapshotPanelOpen && (
            <>
              {cats.length === 0 ? (
                <div className="arena-helper-text">
                  No cats ready for snapshots yet. Use the submit path above, then return here to configure behavior and queue into matches.
                </div>
              ) : (
                <>
                  <div className="arena-snapshot-grid">
                    <label>
                      <span className="arena-form-label">Cat</span>
                      <select value={catId} onChange={(e) => setCatId(e.target.value)} className="styled-select">
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="arena-form-label">AI Behavior</span>
                      <select value={behavior} onChange={(e) => setBehavior(e.target.value as Snapshot['ai_behavior'])} className="styled-select">
                        {AI_BEHAVIORS.map((b) => <option key={b} value={b}>{behaviorLabel(b)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="arena-form-label">Move Preset</span>
                      <select value={priorityPreset} onChange={(e) => setPriorityPreset(e.target.value as keyof typeof PRIORITY_PRESETS)} className="styled-select">
                        <option value="balanced">Balanced</option>
                        <option value="pressure">Pressure</option>
                        <option value="fortress">Fortress</option>
                        <option value="chaos">Chaos</option>
                      </select>
                    </label>
                    <label>
                      <span className="arena-form-label">NPC Target (optional)</span>
                      <select value={selectedNpcId} onChange={(e) => setSelectedNpcId(e.target.value)} className="styled-select">
                        <option value="">Random NPC / Snapshot</option>
                        {npcCats.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.rarity})</option>)}
                      </select>
                    </label>
                  </div>

                  {selectedNpc && (
                    <div className="arena-selected-npc">
                      <img src={selectedNpc.image_url || fallbackCatUrl(`npc-${selectedNpc.id}`)} alt={selectedNpc.name} className="arena-npc-avatar" />
                      <p>Targeting <span className="font-bold">{selectedNpc.name}</span> ({selectedNpc.rarity})</p>
                    </div>
                  )}

                  <button
                    disabled={!catId || busy || uninitialized}
                    onClick={createSnapshot}
                    className="arena-primary-btn mt-3"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Publish Snapshot
                  </button>
                </>
              )}
            </>
          )}
        </section>

        {hasActiveMatch && battleState && (
          <section className="arena-section-shell">
            <div className="arena-section-head">
              <p className="arena-section-title">Battle</p>
              <p className="arena-helper-text">Turn {battleState.turn}/{battleState.max_turns}</p>
            </div>

            <div className="arena-fighters-grid">
              <div className="arena-fighter-cell arena-player-cell">
                <p className="arena-fighter-label">{battleState.fighter_a.label}</p>
                <p className="arena-fighter-meta">HP {battleState.fighter_a.hp}/{battleState.fighter_a.maxHp}</p>
                <div className="arena-hp-track"><div className="arena-hp-fill arena-hp-fill-player" style={{ width: `${pct(battleState.fighter_a.hp, battleState.fighter_a.maxHp)}%` }} /></div>
                <p className="arena-fighter-meta">Shield {battleState.fighter_a.shield} · Energy {battleState.fighter_a.energy}</p>
              </div>

              <div className="arena-fighter-cell arena-opponent-cell">
                <p className="arena-fighter-label">{battleState.fighter_b.label}</p>
                <p className="arena-fighter-meta">HP {battleState.fighter_b.hp}/{battleState.fighter_b.maxHp}</p>
                <div className="arena-hp-track"><div className="arena-hp-fill arena-hp-fill-opponent" style={{ width: `${pct(battleState.fighter_b.hp, battleState.fighter_b.maxHp)}%` }} /></div>
                <p className="arena-fighter-meta">Shield {battleState.fighter_b.shield} · Energy {battleState.fighter_b.energy}</p>
              </div>

              <div className="arena-momentum-bar"><div className={`arena-momentum-fill ${momentumPct >= 60 ? 'arena-momentum-player' : momentumPct <= 40 ? 'arena-momentum-opponent' : ''}`} style={{ width: `${momentumPct}%` }} /></div>
            </div>

            <div className="arena-energy-row">
              <p className="arena-helper-text">Your Energy {energyA}/6</p>
              <div className="arena-energy-track"><div className="arena-energy-fill" style={{ width: `${pct(energyA, 6)}%` }} /></div>
            </div>

            <div className="arena-stance-row">
              {(['neutral', 'aggro', 'guard'] as const).map((stance) => (
                <button
                  key={stance}
                  type="button"
                  onClick={() => setSelectedStance(stance)}
                  className={`arena-stance-btn ${selectedStance === stance ? 'arena-stance-btn-active' : ''}`}
                >
                  {stance}
                </button>
              ))}
            </div>

            <div className="arena-move-grid mb-2">
              {baseActionButtons.map((action) => {
                const meta = ACTION_META[action];
                const disabled = battleBusy || energyA < meta.cost || !!battleState.winner_slot;
                return (
                  <button
                    key={action}
                    disabled={disabled}
                    onClick={() => playAction(action)}
                    className={`arena-move-btn ${disabled ? 'arena-move-btn-disabled' : ''}`}
                  >
                    <div className="arena-move-top">
                      <span className="arena-move-name">{meta.label}</span>
                      <span className="arena-move-cost"><Zap className="w-3 h-3" /> {meta.cost}</span>
                    </div>
                    <p className="arena-move-hint">{meta.hint}</p>
                  </button>
                );
              })}
            </div>

            {unlockedSpecialButtons.length > 0 && (
              <div className="arena-move-grid">
                {unlockedSpecialButtons.map((action) => {
                  const meta = ACTION_META[action];
                  const disabled = battleBusy || energyA < meta.cost || !!battleState.winner_slot;
                  return (
                    <button
                      key={action}
                      disabled={disabled}
                      onClick={() => playAction(action)}
                      className={`arena-move-btn ${disabled ? 'arena-move-btn-disabled' : ''}`}
                    >
                      <div className="arena-move-top">
                        <span className="arena-move-name">{meta.label}</span>
                        <span className="arena-move-cost"><Zap className="w-3 h-3" /> {meta.cost}</span>
                      </div>
                      <p className="arena-move-hint">{meta.hint}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <details className="arena-combat-log">
              <summary>Combat Log</summary>
              <div>
                {battleLog.length === 0 && <p>No combat updates yet.</p>}
                {battleLog.slice().reverse().map((ev, idx) => (
                  <div key={`${ev.turn_no}-${idx}`} className="arena-log-row">
                    <p>
                      T{ev.turn_no} · {ev.actor_slot.toUpperCase()} used <span className="font-bold uppercase">{ev.action_type}</span> {ev.value > 0 ? `(${ev.value})` : ''}
                    </p>
                    {ev.payload?.interaction_message && <p>{ev.payload.interaction_message}</p>}
                  </div>
                ))}
              </div>
            </details>

            {battleState.winner_slot && <p className="arena-helper-text">{battleState.winner_slot === 'a' ? 'You win the duel.' : 'Defeat. Tune your snapshot and retry.'}</p>}
            {moveFlash && <span key={moveFlash.id} className="arena-move-flash">{moveFlash.label}</span>}
          </section>
        )}

        <section className="arena-section-shell">
          <p className="arena-section-title">Top Snapshots</p>
          <div className="arena-compact-list">
            {sortedSnapshots.slice(0, 3).map((s) => (
              <div key={s.id} className="arena-compact-row">
                <p className="arena-compact-main">{s.cat_name}</p>
                <p className="arena-compact-sub">{behaviorLabel(s.ai_behavior)} · v{s.snapshot_version || 1}</p>
                <button type="button" onClick={() => startBattle(s.id)} className="arena-mini-btn">Fight</button>
              </div>
            ))}
            {sortedSnapshots.length === 0 && <p className="arena-empty">No snapshots published yet.</p>}
          </div>
        </section>

        {filteredRecent.length > 0 && (
          <section className="arena-section-shell">
            <p className="arena-section-title">Recent Results</p>
            <div className="arena-compact-list">
              {filteredRecent.map((m) => {
                const won = !!m.snapshot_a_id && m.winner_snapshot_id === m.snapshot_a_id;
                return (
                  <div key={m.id} className="arena-result-row">
                    <p className="arena-result-main">vs {m.opponent_name || 'Unknown'}</p>
                    <p className="arena-result-sub">{won ? 'Win' : 'Loss'} · Turns {m.turns} · Rating {m.rating_delta > 0 ? `+${m.rating_delta}` : m.rating_delta}</p>
                    <button onClick={() => loadReplay(m.id)} className="arena-mini-btn">Replay Log</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {selectedReplay && (
          <section className="arena-section-shell">
            <p className="arena-section-title">Replay · {selectedReplay}</p>
            <div className="arena-compact-list">
              {replayEvents.length === 0 && <p className="arena-empty">Loading replay...</p>}
              {replayEvents.map((ev, idx) => (
                <div key={`${ev.turn_no}-${idx}`} className="arena-result-row">
                  <p className="arena-result-main">Turn {ev.turn_no}</p>
                  <p className="arena-result-sub">{ev.actor_slot.toUpperCase()} used {ev.action_type.toUpperCase()} {ev.value > 0 ? `(${ev.value})` : ''}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <details className="arena-help-dropdown">
          <summary>How Arena Works</summary>
          <div className="arena-help-list">
            <p><strong>1.</strong> Get a fighter by opening <Link href="/submit" className="arena-inline-link">Submit</Link>.</p>
            <p><strong>2.</strong> Publish a snapshot here so Arena has your cat, behavior, and move preset.</p>
            <p><strong>3.</strong> Start a match, manage energy each turn, and use stance plus move timing to win.</p>
            <p><strong>4.</strong> Daily Boss is a bonus fight. Top Snapshots let you challenge popular builds fast.</p>
          </div>
        </details>
      </div>
    </main>
  );
}
