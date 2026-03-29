'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Loader2, Share2, Swords, X } from 'lucide-react';
import { LoadingState } from '../components/LoadingState';
import type { DuelRowData } from '../components/duel/types';
import { Button, Card, Tabs, buttonStyles } from '../components/ui/primitives';
import { pickLiveDuels } from '../lib/duel-live';

type MyCat = { id: string; name: string; image_url: string | null; rarity: string; status?: string };
type PlayerOption = { id: string; username: string; guild?: string | null };
type DuelTab = 'live' | 'pending' | 'results';

function dedupeById(rows: DuelRowData[]): DuelRowData[] {
  const map = new Map<string, DuelRowData>();
  rows.forEach((r) => {
    if (r?.id) map.set(String(r.id), r);
  });
  return [...map.values()];
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

function duelStatusMeta(duel: DuelRowData): { label: string; chipClass: string } {
  const status = String(duel.status || '').toLowerCase();
  if (status === 'pending') return { label: 'Pending', chipClass: 'border-amber-300/35 bg-amber-500/14 text-amber-100' };
  if (status === 'completed') return { label: 'Result', chipClass: 'border-cyan-300/28 bg-cyan-500/10 text-cyan-100/90' };
  return { label: 'Live', chipClass: 'border-cyan-300/35 bg-cyan-500/14 text-cyan-100' };
}

function CombatInboxRow({
  duel,
  onOpen,
}: {
  duel: DuelRowData;
  onOpen: (duelId: string) => void;
}) {
  const meta = duelStatusMeta(duel);
  const created = duel.created_at ? relativeTime(duel.created_at) : '';
  const votes = Number(duel.votes?.total || 0);
  const mineWon = duel.winner_cat_id
    ? duel.winner_cat_id === duel.challenger_cat?.id || duel.winner_cat_id === duel.challenged_cat?.id
    : null;
  const resultTint = String(duel.status || '').toLowerCase() === 'completed'
    ? mineWon
      ? 'border-emerald-300/28'
      : 'border-rose-300/25'
    : 'border-white/12';

  return (
    <button
      type="button"
      onClick={() => onOpen(duel.id)}
      className={`group w-full rounded-2xl border ${resultTint} bg-slate-900/45 p-2.5 text-left shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur-md transition-all duration-150 active:scale-[0.98]`}
    >
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <img
          src={duel.challenger_cat?.image_url || '/cat-placeholder.svg'}
          alt={duel.challenger_cat?.name || 'Cat A'}
          className="h-11 w-11 rounded-full border border-white/18 object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex flex-col items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.chipClass}`}>
            {meta.label}{created ? ` • ${created}` : ''}
          </span>
          <p className="w-full truncate text-center text-[12px] font-semibold text-white/82">
            {duel.challenger_cat?.name || 'Challenger'} vs {duel.challenged_cat?.name || 'Defender'}
            {votes > 0 ? ` • ${votes} votes` : ''}
          </p>
        </div>
        <img
          src={duel.challenged_cat?.image_url || '/cat-placeholder.svg'}
          alt={duel.challenged_cat?.name || 'Cat B'}
          className="h-11 w-11 rounded-full border border-white/18 object-cover"
          loading="lazy"
        />
      </div>
    </button>
  );
}

export default function DuelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [meId, setMeId] = useState<string>('');
  const [myCats, setMyCats] = useState<MyCat[]>([]);
  const [incoming, setIncoming] = useState<DuelRowData[]>([]);
  const [outgoing, setOutgoing] = useState<DuelRowData[]>([]);
  const [openDuels, setOpenDuels] = useState<DuelRowData[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [myCatId, setMyCatId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [defenderCatsByDuel, setDefenderCatsByDuel] = useState<Record<string, string>>({});
  const [launchOpen, setLaunchOpen] = useState(false);
  const [shareSheetDuelId, setShareSheetDuelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DuelTab>('live');
  const [targetQuery, setTargetQuery] = useState('');
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = String(params.get('tab') || '').toLowerCase();
    if (tabParam === 'live' || tabParam === 'pending' || tabParam === 'results') {
      setActiveTab(tabParam as DuelTab);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    return () => {
      if (loadAbortRef.current) {
        loadAbortRef.current.abort();
        loadAbortRef.current = null;
      }
    };
  }, []);

  const activeCats = useMemo(() => myCats.filter((c) => c.status !== 'rejected'), [myCats]);

  const liveRows = useMemo(
    () => dedupeById(pickLiveDuels<DuelRowData>(openDuels)),
    [openDuels]
  );

  const pendingRows = useMemo(
    () => dedupeById([
      ...incoming.filter((d) => String(d.status || '') === 'pending'),
      ...outgoing.filter((d) => String(d.status || '') === 'pending'),
      ...openDuels.filter((d) => String(d.status || '') === 'pending'),
    ]),
    [incoming, outgoing, openDuels]
  );

  const resultRows = useMemo(
    () => dedupeById([
      ...openDuels.filter((d) => String(d.status || '') === 'completed'),
      ...incoming.filter((d) => String(d.status || '') === 'completed'),
      ...outgoing.filter((d) => String(d.status || '') === 'completed'),
    ]),
    [openDuels, incoming, outgoing]
  );

  const activeRows = activeTab === 'live' ? liveRows : activeTab === 'pending' ? pendingRows : resultRows;
  const selectedFighter = useMemo(
    () => activeCats.find((c) => String(c.id) === String(myCatId)) || activeCats[0] || null,
    [activeCats, myCatId]
  );
  const filteredTargets = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.username.toLowerCase().includes(q));
  }, [players, targetQuery]);

  function setRouteState(nextTab: DuelTab) {
    const params = new URLSearchParams();
    params.set('tab', nextTab);
    router.replace(`/duel?${params.toString()}`, { scroll: false });
  }

  async function loadAll() {
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    try {
      const meRes = await fetch('/api/me', { cache: 'no-store', signal });
      const meData = await meRes.json().catch(() => ({}));
      if (signal.aborted) return;
      const gid = String(meData?.guest_id || '');
      setMeId(gid);

      if (gid) {
        const profileRes = await fetch(`/api/profile/${gid}?t=${Date.now()}`, { cache: 'no-store', signal });
        const profileData = await profileRes.json().catch(() => ({}));
        if (signal.aborted) return;
        const cats = Array.isArray(profileData?.submitted_cats) ? profileData.submitted_cats : [];
        setMyCats(cats);
        if (cats[0]?.id) setMyCatId(String(cats[0].id));
      }

      const [duelRes, lbRes] = await Promise.all([
        fetch('/api/duel/challenges', { cache: 'no-store', signal }),
        fetch('/api/leaderboard', { cache: 'no-store', signal }),
      ]);
      const duelData = await duelRes.json().catch(() => ({}));
      const lbData = await lbRes.json().catch(() => ({}));
      if (signal.aborted) return;

      if (duelData?.disabled) setDisabled(true);
      setIncoming(Array.isArray(duelData?.incoming) ? duelData.incoming : []);
      setOutgoing(Array.isArray(duelData?.outgoing) ? duelData.outgoing : []);
      setOpenDuels(Array.isArray(duelData?.open) ? duelData.open : []);

      const p = Array.isArray(lbData?.players) ? lbData.players : [];
      const isFallbackUsername = (value: string) => /^Player\s+[0-9a-f]{8}$/i.test(value.trim());
      const opts = p
        .map((row: { id?: string; username?: string; guild?: string | null }) => ({ id: String(row.id || ''), username: String(row.username || '').trim(), guild: row.guild || null }))
        .filter((row: PlayerOption) => row.id && row.id !== gid && row.username && !isFallbackUsername(row.username));
      setPlayers(opts);
      if (opts[0]?.id) setTargetUserId(opts[0].id);
      else setTargetUserId('');
    } catch {
      if (signal.aborted) return;
      setMessage('Failed to load Duel Arena');
    } finally {
      if (loadAbortRef.current !== controller) return;
      loadAbortRef.current = null;
      setLoading(false);
    }
  }

  async function createChallenge(): Promise<boolean> {
    if (!targetUserId || !myCatId || busy) return false;
    setBusy('create');
    setMessage(null);
    try {
      const res = await fetch('/api/duel/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenged_user_id: targetUserId, challenger_cat_id: myCatId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Challenge failed');
        return false;
      }
      setMessage('Challenge sent');
      await loadAll();
      return true;
    } catch {
      setMessage('Challenge failed');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function rematch(duel: DuelRowData): Promise<boolean> {
    if (busy) return false;
    const amChallenger = meId && duel.challenger_user_id === meId;
    const amChallenged = meId && duel.challenged_user_id === meId;
    if (!amChallenger && !amChallenged) {
      setMessage('Only duel participants can request a rematch');
      return false;
    }
    const challengedUserId = amChallenger ? duel.challenged_user_id : duel.challenger_user_id;
    const challengerCatId = amChallenger ? duel.challenger_cat?.id : duel.challenged_cat?.id;
    if (!challengedUserId || !challengerCatId) {
      setMessage('Rematch unavailable for this duel');
      return false;
    }

    setBusy(`rematch:${duel.id}`);
    setMessage(null);
    try {
      const res = await fetch('/api/duel/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenged_user_id: challengedUserId, challenger_cat_id: challengerCatId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Rematch failed');
        return false;
      }
      setMessage('Rematch sent');
      await loadAll();
      setActiveTab('pending');
      setRouteState('pending');
      return true;
    } catch {
      setMessage('Rematch failed');
      return false;
    } finally {
      setBusy(null);
    }
  }

  function pickRandomTraitor() {
    if (!players.length) return;
    const pool = [...players];
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (choice?.id) setTargetUserId(choice.id);
  }

  async function respond(duelId: string, action: 'accept' | 'decline') {
    if (busy) return;
    setBusy(`${action}:${duelId}`);
    setMessage(null);
    try {
      const res = await fetch('/api/duel/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duel_id: duelId,
          action,
          challenged_cat_id: action === 'accept' ? defenderCatsByDuel[duelId] || myCatId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Action failed');
      } else {
        setMessage(action === 'accept' ? 'Duel opened for voting' : 'Challenge declined');
        await loadAll();
      }
    } catch {
      setMessage('Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function voteDuel(duelId: string, catId: string): Promise<boolean> {
    if (busy) return false;
    const holdAfterVoteMs = 900;
    setBusy(`vote:${duelId}:${catId}`);
    setMessage(null);
    try {
      const res = await fetch('/api/duel/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duel_id: duelId, voted_cat_id: catId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Vote failed');
        return false;
      } else {
        setMessage(data?.status === 'completed' ? 'Duel vote completed' : 'Vote recorded');
        await new Promise((resolve) => window.setTimeout(resolve, holdAfterVoteMs));
        await loadAll();
        return true;
      }
    } catch {
      setMessage('Vote failed');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function shareDuel(duelId: string) {
    const url = `${window.location.origin}/d/${encodeURIComponent(duelId)}`;
    const text = 'Live duel in CatClash Arena';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CatClash Duel', text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setMessage('Duel share link ready');
    } catch {
      // user canceled
    }
  }

  async function copyShareLink(duelId: string) {
    const url = `${window.location.origin}/d/${encodeURIComponent(duelId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Link copied');
    } catch {
      setMessage('Could not copy link');
    }
    setShareSheetDuelId(null);
  }

  if (loading) {
    return <LoadingState fullPage icon="⚔️" message="Summoning combatants..." />;
  }

  const pendingCount = pendingRows.length;
  const urgentHeader = pendingCount > 0;
  const tabMeta = [
    { key: 'live' as const, label: 'Live', count: liveRows.length, dot: 'bg-cyan-300/80' },
    { key: 'pending' as const, label: 'Pending', count: pendingRows.length, dot: '' },
    { key: 'results' as const, label: 'Results', count: resultRows.length, dot: 'bg-amber-300/80' },
  ];
  const emptyCopy =
    activeTab === 'live'
      ? { title: 'The Arena is quiet...', cta: 'Launch Duel' }
      : activeTab === 'pending'
        ? { title: 'No pending challenges. Claim your next rival.', cta: 'Launch Duel' }
        : { title: 'Your legend begins here.', cta: 'Find Live Duels' };

  return (
    <div className="min-h-screen bg-black px-3 py-6 text-white sm:px-4 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-white/45 hover:text-white text-xs">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <Card className={`bg-white/[0.03] ${urgentHeader ? 'border-amber-300/25 shadow-[0_0_18px_rgba(251,191,36,0.12)]' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{urgentHeader ? `${pendingCount} Challenges Await` : 'Ready for Battle'}</h1>
              <p className={`text-sm leading-relaxed ${urgentHeader ? 'text-amber-100/76' : 'text-white/60'} ${urgentHeader ? 'animate-[subtleBreathe_2200ms_ease-in-out_infinite]' : ''}`}>
                Combat Inbox
              </p>
            </div>
            <Button onClick={loadAll} size="sm">Refresh</Button>
          </div>
          {message && <p className="mt-1.5 text-xs text-cyan-300">{message}</p>}
          {disabled && <p className="mt-1.5 text-xs text-amber-300">Duel Arena migration not applied yet on this deployment.</p>}
        </Card>

        <Card className="bg-white/[0.03]">
          <Tabs className="grid-cols-3 rounded-full bg-slate-900/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.35)]">
            {tabMeta.map((tab) => (
              <button
                key={tab.key}
                data-testid={`duel-tab-${tab.key}`}
                onClick={() => {
                  const next = tab.key;
                  setActiveTab(next);
                  setRouteState(next);
                }}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`focus-ring h-10 rounded-full border text-xs font-semibold transition-all duration-150 active:translate-y-[1px] ${activeTab === tab.key ? 'scale-[1.01] border-white/35 bg-white/14 text-white shadow-[0_6px_14px_rgba(0,0,0,0.2)]' : 'border-white/10 bg-white/4 text-white/68'}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {(tab.key === 'live' || tab.key === 'results') ? <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} /> : null}
                  {tab.label}
                  <span className="text-[10px] opacity-70">{tab.count}</span>
                </span>
              </button>
            ))}
          </Tabs>

          <button
            onClick={() => setLaunchOpen(true)}
            disabled={disabled || activeCats.length === 0 || players.length === 0}
            className={buttonStyles({ variant: 'primary', size: 'xl', className: 'mt-3 h-11 w-full gap-2 text-xs shadow-[0_12px_26px_rgba(6,182,212,0.3)] active:scale-95' })}
          >
            <Swords className="w-4 h-4" />
            Launch Duel
          </button>

          <div key={activeTab} className="mt-3 space-y-2.5 animate-[fadeIn_260ms_ease-out]">
            {activeRows.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
                <p className="text-sm font-semibold text-white/78">{emptyCopy.title}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'results') {
                      setActiveTab('live');
                      setRouteState('live');
                    } else {
                      setLaunchOpen(true);
                    }
                  }}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-cyan-300/28 bg-cyan-500/12 px-4 text-xs font-semibold text-cyan-100 transition-all duration-100 active:scale-95"
                >
                  {emptyCopy.cta}
                </button>
              </div>
            )}
            {activeRows.map((d) => (
              <CombatInboxRow key={d.id} duel={d} onOpen={(duelId) => router.push(`/duel/${encodeURIComponent(duelId)}`)} />
            ))}
          </div>
        </Card>
      </div>

      {launchOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="scrollbar-none w-full max-w-xl max-h-[86vh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/90 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-2xl sm:p-5 sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Combat Deployment</h3>
              <button
                onClick={() => setLaunchOpen(false)}
                aria-label="Close launch duel"
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 transition-all duration-150 active:translate-y-[1px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-orange-300/12 p-2.5 relative">
              <span className="pointer-events-none absolute left-1 top-1 h-2.5 w-2.5 border-l border-t border-orange-300/28" />
              <span className="pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 border-r border-t border-orange-300/28" />
              <span className="pointer-events-none absolute left-1 bottom-1 h-2.5 w-2.5 border-l border-b border-orange-300/28" />
              <span className="pointer-events-none absolute right-1 bottom-1 h-2.5 w-2.5 border-r border-b border-orange-300/28" />
              <p className="mb-2 text-sm font-semibold text-white/80">Select Fighter</p>
              <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {activeCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setMyCatId(c.id)}
                  className={`focus-ring min-w-[126px] rounded-xl border p-2 text-left transition-all duration-150 active:translate-y-[1px] ${myCatId === c.id ? 'scale-[1.05] border-violet-300 bg-violet-500/10 shadow-[0_0_18px_rgba(167,139,250,0.24)] ring-1 ring-violet-300/45' : 'border-white/15 bg-white/[0.03]'}`}
                >
                  <img
                    src={c.image_url || '/cat-placeholder.svg'}
                    alt={c.name}
                    width={116}
                    height={64}
                    className="w-full h-16 rounded-lg object-cover mb-1.5"
                    loading="lazy"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{c.name}</p>
                    <span className="rounded-full border border-white/20 bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold text-white/72">
                      {c.rarity}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-0.5">Power ready</p>
                </button>
              ))}
            </div>
            </div>

            <div className="mb-4 rounded-xl border border-orange-300/12 p-2.5 relative">
              <span className="pointer-events-none absolute left-1 top-1 h-2.5 w-2.5 border-l border-t border-orange-300/28" />
              <span className="pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 border-r border-t border-orange-300/28" />
              <span className="pointer-events-none absolute left-1 bottom-1 h-2.5 w-2.5 border-l border-b border-orange-300/28" />
              <span className="pointer-events-none absolute right-1 bottom-1 h-2.5 w-2.5 border-r border-b border-orange-300/28" />
              <p className="mb-2 text-sm font-semibold text-white/80">Target Acquisition</p>
              <input
                type="text"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="Search by name"
                className="input-focus mb-2.5 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/45"
              />
              <div className="scrollbar-none space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                <button
                  type="button"
                  onClick={pickRandomTraitor}
                  className={`w-full rounded-xl border p-2 text-left transition-all duration-150 active:scale-[0.98] ${!targetUserId ? 'border-cyan-300/35 bg-[linear-gradient(120deg,rgba(34,211,238,0.12),rgba(167,139,250,0.12))]' : 'border-white/14 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),rgba(34,211,238,0.06))]'}`}
                >
                  <p className="text-xs font-semibold text-white/88">Unknown Encounter</p>
                  <p className="text-[10px] text-white/58">Unscouted rival. High risk, high chaos.</p>
                </button>
                {filteredTargets.map((p) => {
                  const selected = p.id === targetUserId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTargetUserId(p.id)}
                      className={`w-full rounded-xl border p-2 text-left transition-all duration-150 active:scale-[0.98] ${selected ? 'border-cyan-300/38 bg-cyan-500/10 ring-1 ring-cyan-300/35' : 'border-white/14 bg-white/[0.02]'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white/86">{p.username}</p>
                          <p className="text-[10px] text-white/52">{p.guild ? (p.guild === 'sun' ? 'Solar guild' : 'Lunar guild') : 'Arena active'}</p>
                        </div>
                        <span className={`h-2 w-2 rounded-full ${selected ? 'bg-cyan-300' : 'bg-white/25'}`} />
                      </div>
                    </button>
                  );
                })}
                {filteredTargets.length === 0 ? (
                  <p className="rounded-xl border border-white/12 bg-white/[0.02] p-2 text-[11px] text-white/58">No targets match your search.</p>
                ) : null}
              </div>
            </div>

            {selectedFighter && targetUserId ? (
              <div className="mb-4 rounded-xl border border-white/14 bg-white/[0.03] p-2.5 animate-[fadeIn_180ms_ease-out]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52 mb-1.5">VS Preview</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <p className="truncate text-xs font-semibold text-white/86">{selectedFighter.name}</p>
                  <span className="rounded-full border border-white/20 bg-white/8 px-2 py-1 text-[10px] font-semibold text-white/70">VS</span>
                  <p className="truncate text-right text-xs font-semibold text-white/86">{players.find((p) => p.id === targetUserId)?.username || 'Unknown'}</p>
                </div>
              </div>
            ) : null}

            <button
              onClick={async () => {
                const ok = await createChallenge();
                if (ok) setLaunchOpen(false);
              }}
              disabled={disabled || !targetUserId || !myCatId || busy === 'create'}
              className={buttonStyles({ variant: 'primary', size: 'xl', className: 'w-full gap-2 bg-[linear-gradient(90deg,rgba(139,92,246,0.95),rgba(34,211,238,0.92))] shadow-[0_12px_24px_rgba(34,211,238,0.24)] active:scale-95' })}
            >
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Confirm Duel
            </button>
          </div>
        </div>
      )}

      {shareSheetDuelId && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5 sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">Share Match</h3>
              <button
                aria-label="Close share options"
                onClick={() => setShareSheetDuelId(null)}
                className="h-9 w-9 rounded-lg bg-white/10 inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => shareDuel(shareSheetDuelId)} className="justify-start" aria-label="Share story">
                <Share2 className="w-3.5 h-3.5 mr-1.5" />Share Story
              </Button>
              <Button onClick={() => shareDuel(shareSheetDuelId)} className="justify-start" aria-label="Share post">
                <Share2 className="w-3.5 h-3.5 mr-1.5" />Share Post
              </Button>
              <Button onClick={() => copyShareLink(shareSheetDuelId)} className="justify-start" aria-label="Copy link">
                <Share2 className="w-3.5 h-3.5 mr-1.5" />Copy Link
              </Button>
              <Button onClick={() => copyShareLink(shareSheetDuelId)} className="justify-start" aria-label="Download card">
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
