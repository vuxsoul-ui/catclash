'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Loader2, Share2, Swords, X } from 'lucide-react';
import DuelRow from '../components/duel/DuelRow';
import DuelCardFull from '../components/duel/DuelCardFull';
import type { DuelRowData } from '../components/duel/types';
import { Badge, Button, Card, SectionHeader, Tabs } from '../components/ui/primitives';

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
  const [selectedDuelId, setSelectedDuelId] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = String(params.get('tab') || '').toLowerCase();
    if (tabParam === 'live' || tabParam === 'pending' || tabParam === 'results') {
      setActiveTab(tabParam as DuelTab);
    }
    const duelParam = String(params.get('duel') || '').trim();
    if (duelParam) setSelectedDuelId(duelParam);
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
    () => dedupeById(openDuels.filter((d) => String(d.status || '') === 'voting')),
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

  useEffect(() => {
    if (!activeRows.length) {
      setSelectedDuelId(null);
      return;
    }
    if (!selectedDuelId || !activeRows.some((d) => d.id === selectedDuelId)) {
      setSelectedDuelId(activeRows[0].id);
    }
  }, [activeRows, selectedDuelId]);

  const selectedDuel = useMemo(
    () => activeRows.find((d) => d.id === selectedDuelId) || null,
    [activeRows, selectedDuelId]
  );

  function setRouteState(nextTab: DuelTab, duelId?: string | null) {
    const params = new URLSearchParams();
    params.set('tab', nextTab);
    if (duelId) params.set('duel', duelId);
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
      setRouteState('pending', data?.duel?.id || null);
      if (data?.duel?.id) setSelectedDuelId(String(data.duel.id));
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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-3.5 py-4 sm:px-4 sm:py-6">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-white/45 hover:text-white text-xs">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <button
            onClick={() => setLaunchOpen(true)}
            disabled={disabled || activeCats.length === 0 || players.length === 0}
            className="h-11 px-3.5 rounded-xl bg-cyan-300 text-black text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Swords className="w-4 h-4" />
            Launch Duel
          </button>
        </div>

        <Card className="bg-white/[0.03]">
          <SectionHeader>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Duel Arena</h1>
              <p className="text-[12px] text-white/60">Battle inbox: live, pending, results.</p>
            </div>
            <Button
              onClick={loadAll}
              size="sm"
            >
              Refresh
            </Button>
          </SectionHeader>
          {message && <p className="text-[11px] text-cyan-300 mt-1.5">{message}</p>}
          {disabled && <p className="text-[11px] text-amber-300 mt-1.5">Duel Arena migration not applied yet on this deployment.</p>}
        </Card>

        <Card className="bg-white/[0.03] p-2.5">
          <Tabs className="grid-cols-3">
            {[
              { key: 'live', label: 'Live', count: liveRows.length },
              { key: 'pending', label: 'Pending', count: pendingRows.length },
              { key: 'results', label: 'Results', count: resultRows.length },
            ].map((tab) => (
              <button
                key={tab.key}
                data-testid={`duel-tab-${tab.key}`}
                onClick={() => {
                  const next = tab.key as DuelTab;
                  setActiveTab(next);
                  setRouteState(next, selectedDuelId);
                }}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`h-11 rounded-lg text-[12px] font-semibold border ${activeTab === tab.key ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 text-white/80'}`}
              >
                {tab.label} <span className="text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </Tabs>

          <div className="mt-2.5 space-y-2">
            {activeRows.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-[12px] text-white/55">No duels in this tab yet.</div>
            )}
            {activeRows.map((d) => (
              <DuelRow
                key={d.id}
                duel={d}
                onOpen={(duel) => {
                  setSelectedDuelId(duel.id);
                  setRouteState(activeTab, duel.id);
                }}
                actionLabel={activeTab === 'live' ? 'Vote' : 'View'}
              />
            ))}
          </div>
        </Card>

        {selectedDuel && (
          <Card className="border-cyan-300/20 bg-cyan-500/8 p-2.5">
            <DuelCardFull duel={selectedDuel} meId={meId} busy={!!busy} onVote={voteDuel} onShare={shareDuel} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <Badge>{String(selectedDuel.status || 'voting').toUpperCase()}</Badge>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Share match"
                onClick={() => setShareSheetDuelId(selectedDuel.id)}
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                Share Match
              </Button>
            </div>

            {selectedDuel.status === 'pending' && selectedDuel.challenged_user_id === meId && (
              <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
                <p className="text-[11px] text-white/70 mb-2">Choose your defender cat:</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                  <select
                    value={defenderCatsByDuel[selectedDuel.id] || myCatId}
                    onChange={(e) => setDefenderCatsByDuel((prev) => ({ ...prev, [selectedDuel.id]: e.target.value }))}
                    className="h-11 rounded-lg bg-black/30 border border-white/15 px-2 text-xs"
                  >
                    {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    onClick={() => respond(selectedDuel.id, 'accept')}
                    disabled={!!busy}
                    className="h-11 px-3 rounded-lg bg-emerald-400/25 text-emerald-200 text-xs font-bold disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(selectedDuel.id, 'decline')}
                    disabled={!!busy}
                    className="h-11 px-3 rounded-lg bg-red-400/20 text-red-200 text-xs font-bold disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            {selectedDuel.status === 'completed' && (selectedDuel.challenger_user_id === meId || selectedDuel.challenged_user_id === meId) && (
              <div className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-cyan-100">Run it back with the same opponent.</p>
                  <button
                    onClick={() => void rematch(selectedDuel)}
                    disabled={!!busy}
                    className="h-10 px-3 rounded-lg bg-cyan-300 text-black text-xs font-bold disabled:opacity-50"
                  >
                    {busy?.startsWith('rematch:') ? 'Creating…' : 'Rematch'}
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {launchOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-neutral-950/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Launch Duel</h3>
              <button
                onClick={() => setLaunchOpen(false)}
                aria-label="Close launch duel"
                className="h-11 w-11 rounded-lg bg-white/10 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/60 mb-2">1) Select your fighter</p>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
              {activeCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setMyCatId(c.id)}
                  className={`min-w-[132px] rounded-xl border p-2 text-left ${myCatId === c.id ? 'border-cyan-300 bg-cyan-500/10' : 'border-white/15 bg-white/[0.03]'}`}
                >
                  <img
                    src={c.image_url || '/cat-placeholder.svg'}
                    alt={c.name}
                    width={116}
                    height={64}
                    className="w-full h-16 rounded-lg object-cover mb-1.5"
                    loading="lazy"
                  />
                  <p className="text-xs font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-white/60">{c.rarity}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/60 mb-2">2) Select target</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-3">
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="h-11 rounded-xl bg-black/30 border border-white/15 px-3 text-sm">
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username}{p.guild ? ` · ${p.guild === 'sun' ? 'Solar' : 'Lunar'}` : ''}
                  </option>
                ))}
              </select>
              <button onClick={pickRandomTraitor} className="h-11 px-3 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold">
                Random
              </button>
            </div>
            <button
              onClick={async () => {
                const ok = await createChallenge();
                if (ok) setLaunchOpen(false);
              }}
              disabled={disabled || !targetUserId || !myCatId || busy === 'create'}
              className="h-11 w-full rounded-xl bg-cyan-300 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Confirm Duel
            </button>
          </div>
        </div>
      )}

      {shareSheetDuelId && (
        <div className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-950/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
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
