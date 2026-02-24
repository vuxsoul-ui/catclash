// REPLACE: app/admin/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Check, X, RefreshCw, Zap, Shield, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { showGlobalToast } from '../lib/global-toast';

interface PendingCat {
  id: string;
  name: string;
  image_url: string | null;
  image_path: string | null;
  rarity: string;
  status: string;
  image_review_status?: 'pending_review' | 'approved' | 'disapproved';
  image_review_reason?: string | null;
  created_at: string;
  description?: string;
}

type ArenaSeedType = 'rookie' | 'main' | 'both';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [secret, setSecret] = useState('');
  const [inputSecret, setInputSecret] = useState('');
  const [cats, setCats] = useState<PendingCat[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hofCatId, setHofCatId] = useState('');
  const [cotwCatId, setCotwCatId] = useState('');
  const [hofNote, setHofNote] = useState('');
  const [cotwNote, setCotwNote] = useState('');
  const [hofTagline, setHofTagline] = useState('');
  const [hofTheme, setHofTheme] = useState('');
  const [hofExpires, setHofExpires] = useState('');
  const [cotwTagline, setCotwTagline] = useState('');
  const [cotwTheme, setCotwTheme] = useState('');
  const [cotwExpires, setCotwExpires] = useState('');
  const [seedArenaType, setSeedArenaType] = useState<ArenaSeedType>('both');
  const [seedCount, setSeedCount] = useState(12);
  const [seedPrioritizeNew, setSeedPrioritizeNew] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<null | {
    insertedMatches: number;
    rookieInserted: number;
    mainInserted: number;
    catsUsed: number;
  }>(null);
  const [advanceSummary, setAdvanceSummary] = useState<null | {
    tournamentId: string;
    createdTournament: boolean;
    seeded: { main: number; rookie: number };
    resolvedRound: boolean;
    advancedToRound: number | null;
    notes: string[];
  }>(null);
  const [resetResult, setResetResult] = useState<null | {
    oldTournamentId: string | null;
    newTournamentId: string;
    seeded: { main: number; rookie: number };
  }>(null);
  const lastLoadRequestId = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem('admin_secret');
    if (saved) {
      setSecret(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) loadCats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, statusFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, cats.length]);

  function login() {
    if (!inputSecret.trim()) return;
    const s = inputSecret.trim();
    setSecret(s);
    localStorage.setItem('admin_secret', s);
    setAuthed(true);
  }

  function showToast(msg: string) {
    showGlobalToast(msg, 3000);
  }

  async function adminFetch(url: string, opts: RequestInit = {}) {
    return fetch(url, {
      ...opts,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        ...(opts.headers || {}),
      },
    });
  }

  async function loadCats() {
    const requestId = ++lastLoadRequestId.current;
    setLoading(true);
    try {
      const includeAll = statusFilter !== 'pending' ? '&include_all=1' : '';
      const res = await adminFetch(`/api/admin/cats?t=${Date.now()}${includeAll}&status=${statusFilter}`);
      const data = await res.json();
      if (requestId !== lastLoadRequestId.current) return;
      if (data.error === 'Unauthorized') {
        setAuthed(false);
        localStorage.removeItem('admin_secret');
        showToast('Invalid secret');
        setLoading(false);
        return;
      }
      const serverCats = Array.isArray(data.cats) ? data.cats : [];
      setCats(serverCats);
    } catch {
      if (requestId !== lastLoadRequestId.current) return;
      showToast('Failed to load');
    }
    if (requestId === lastLoadRequestId.current) {
      setLoading(false);
    }
  }

  async function approveCat(catId: string) {
    setActionLoading(catId);
    try {
      const res = await adminFetch('/api/admin/cats/image-approve', {
        method: 'POST',
        body: JSON.stringify({ catId }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.message === 'Already approved') {
          setCats(prev => prev.filter(c => c.id !== catId));
        }
        showToast(data.message || 'Approved!');
        await loadCats();
      } else {
        showToast(data.error || 'Failed');
        if (data.error === 'Unauthorized') {
          setAuthed(false);
          localStorage.removeItem('admin_secret');
        }
      }
    } catch {
      showToast('Network error');
    }
    setActionLoading(null);
  }

  async function rejectCat(catId: string) {
    setActionLoading(catId);
    try {
      const res = await adminFetch('/api/admin/cats/image-disapprove', {
        method: 'POST',
        body: JSON.stringify({ catId }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || 'Rejected');
        await loadCats();
      } else {
        showToast(data.error || 'Failed');
      }
    } catch {
      showToast('Network error');
    }
    setActionLoading(null);
  }

  async function deleteCat(catId: string) {
    const confirmed = window.confirm('Delete this cat permanently?');
    if (!confirmed) return;

    setActionLoading(catId);
    try {
      const res = await adminFetch('/api/admin/cats/delete', {
        method: 'POST',
        body: JSON.stringify({ catId }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || 'Deleted');
        await loadCats();
      } else {
        showToast(data.error || 'Delete failed');
      }
    } catch {
      showToast('Network error');
    }
    setActionLoading(null);
  }

  function toggleSelect(catId: string) {
    setSelectedIds((prev) => (prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]));
  }

  function selectAllVisible() {
    setSelectedIds(cats.map((c) => c.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function bulkApprove() {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setActionLoading('bulk');
    for (const id of selectedIds) {
      try {
        await adminFetch('/api/admin/cats/image-approve', {
          method: 'POST',
          body: JSON.stringify({ catId: id }),
        });
      } catch {
        // ignore per item
      }
    }
    setActionLoading(null);
    setSelectedIds([]);
    await loadCats();
    showToast(`Approved ${count} photo(s)`);
  }

  async function bulkDisapprove() {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setActionLoading('bulk');
    for (const id of selectedIds) {
      try {
        await adminFetch('/api/admin/cats/image-disapprove', {
          method: 'POST',
          body: JSON.stringify({ catId: id }),
        });
      } catch {
        // ignore per item
      }
    }
    setActionLoading(null);
    setSelectedIds([]);
    await loadCats();
    showToast(`Disapproved ${count} photo(s)`);
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const confirmed = window.confirm(`Delete ${count} selected cat(s) permanently?`);
    if (!confirmed) return;
    setActionLoading('bulk');
    for (const id of selectedIds) {
      try {
        await adminFetch('/api/admin/cats/delete', {
          method: 'POST',
          body: JSON.stringify({ catId: id }),
        });
      } catch {
        // ignore per item
      }
    }
    setActionLoading(null);
    setSelectedIds([]);
    await loadCats();
    showToast(`Deleted ${count} cat(s)`);
  }

  async function advanceTournament() {
    setActionLoading('advance');
    setAdvanceSummary(null);
    try {
      const res = await adminFetch('/api/admin/tournament/advance', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Advance failed');
      } else {
        const summary = {
          tournamentId: String(data.tournamentId || ''),
          createdTournament: !!data.createdTournament,
          seeded: {
            main: Number(data?.seeded?.main || 0),
            rookie: Number(data?.seeded?.rookie || 0),
          },
          resolvedRound: !!data.resolvedRound,
          advancedToRound: data?.advancedToRound == null ? null : Number(data.advancedToRound),
          notes: Array.isArray(data?.notes) ? data.notes.map((n: unknown) => String(n)) : [],
        };
        setAdvanceSummary(summary);
        showToast('Tournament advanced');
      }
    } catch {
      showToast('Advance failed');
    }
    setActionLoading(null);
  }

  async function hardResetTournament() {
    if (actionLoading === 'reset') return;
    const confirmText = window.prompt('Type RESET to confirm hard reset');
    if (confirmText !== 'RESET') return;
    setActionLoading('reset');
    setResetResult(null);
    try {
      const res = await adminFetch('/api/admin/tournament/reset', {
        method: 'POST',
        body: JSON.stringify({
          seed: seedArenaType,
          seedNewest: seedPrioritizeNew,
          seedCount: Math.max(2, Math.min(50, Number(seedCount) || 12)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Hard reset failed');
      } else {
        setResetResult({
          oldTournamentId: data?.oldTournamentId ? String(data.oldTournamentId) : null,
          newTournamentId: String(data?.newTournamentId || ''),
          seeded: {
            main: Number(data?.seeded?.main || 0),
            rookie: Number(data?.seeded?.rookie || 0),
          },
        });
        showToast('Tournament reset');
      }
    } catch {
      showToast('Hard reset failed');
    }
    setActionLoading(null);
  }

  async function seedArenas(opts?: { seedCount?: number; prioritizeNew?: boolean; tournamentType?: ArenaSeedType }) {
    if (seedLoading) return;
    const tournamentType = opts?.tournamentType || seedArenaType;
    const count = Math.max(2, Math.min(50, Number(opts?.seedCount ?? seedCount) || 12));
    const prioritizeNew = opts?.prioritizeNew ?? seedPrioritizeNew;
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const res = await adminFetch('/api/admin/arena/seed', {
        method: 'POST',
        body: JSON.stringify({
          tournamentType,
          seedCount: count,
          prioritizeNew,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Failed to seed arenas');
      } else {
        setSeedResult({
          insertedMatches: Number(data.insertedMatches || 0),
          rookieInserted: Number(data.rookieInserted || 0),
          mainInserted: Number(data.mainInserted || 0),
          catsUsed: Number(data.catsUsed || 0),
        });
        showToast(`Seeded ${Number(data.insertedMatches || 0)} matches`);
        await loadCats();
      }
    } catch {
      showToast('Network error');
    }
    setSeedLoading(false);
  }

  async function setSpotlight(
    slot: 'hall_of_fame' | 'cat_of_week',
    catId: string,
    note: string,
    tagline: string,
    theme: string,
    expiresAt: string
  ) {
    if (!catId.trim()) {
      showToast('Enter a cat ID first');
      return;
    }
    setActionLoading(slot);
    try {
      const res = await adminFetch('/api/admin/spotlights', {
        method: 'POST',
        body: JSON.stringify({
          slot,
          cat_id: catId.trim(),
          note: note.trim() || null,
          tagline: tagline.trim() || null,
          theme: theme.trim() || null,
          expires_at: expiresAt || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Failed to set spotlight');
      } else {
        showToast(slot === 'hall_of_fame' ? 'Hall of Fame updated' : 'Cat of the Week updated');
      }
    } catch {
      showToast('Network error');
    }
    setActionLoading(null);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm p-6">
          <h1 className="text-xl font-bold mb-4 text-center">Admin Login</h1>
          <input
            type="password"
            value={inputSecret}
            onChange={e => setInputSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter admin secret"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:outline-none mb-3"
          />
          <button onClick={login} className="w-full py-3 rounded-xl bg-yellow-500 text-black font-bold">
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/40 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <button onClick={() => { setAuthed(false); localStorage.removeItem('admin_secret'); }}
            className="text-xs text-white/30 hover:text-white">Logout</button>
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <button onClick={advanceTournament} disabled={actionLoading === 'advance'}
            className="py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {actionLoading === 'advance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Advance Tournament
          </button>
          <button onClick={hardResetTournament} disabled={actionLoading === 'reset'}
            className="py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {actionLoading === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Hard Reset (New Tournament)
          </button>
        </div>
        {advanceSummary ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-4 text-xs text-white/80">
            <p className="font-semibold">Advance summary</p>
            <p className="mt-1">Tournament: {advanceSummary.tournamentId || 'n/a'}</p>
            <p>Created today: {advanceSummary.createdTournament ? 'yes' : 'no'}</p>
            <p>Seeded: {advanceSummary.seeded.main} main, {advanceSummary.seeded.rookie} rookie</p>
            <p>Resolved round: {advanceSummary.resolvedRound ? 'yes' : 'no'}{advanceSummary.advancedToRound ? ` (round ${advanceSummary.advancedToRound})` : ''}</p>
            {advanceSummary.notes.length > 0 ? (
              <p className="mt-1 text-white/65">{advanceSummary.notes.join(' · ')}</p>
            ) : null}
          </div>
        ) : null}
        {resetResult ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-4 text-xs text-white/80">
            <p className="font-semibold">Reset summary</p>
            <p className="mt-1">Old tournament: {resetResult.oldTournamentId || 'n/a'}</p>
            <p>New tournament: {resetResult.newTournamentId || 'n/a'}</p>
            <p>Seeded: {resetResult.seeded.main} main, {resetResult.seeded.rookie} rookie</p>
            <div className="mt-2">
              <Link href="/" className="inline-flex px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-semibold">
                Open Home
              </Link>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-6">
          <h2 className="text-sm font-bold mb-3">Seed cats into arenas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={seedArenaType}
              onChange={(e) => setSeedArenaType(e.target.value as ArenaSeedType)}
              className="w-full rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-xs"
            >
              <option value="both">Both arenas</option>
              <option value="rookie">Rookie only</option>
              <option value="main">Main only</option>
            </select>
            <input
              type="number"
              min={2}
              max={50}
              value={seedCount}
              onChange={(e) => setSeedCount(Math.max(2, Math.min(50, Number(e.target.value) || 12)))}
              className="w-full rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-xs"
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={seedPrioritizeNew}
                onChange={(e) => setSeedPrioritizeNew(e.target.checked)}
              />
              Prioritize newest submissions
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => seedArenas()}
              disabled={seedLoading}
              className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {seedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Seed Now
            </button>
            <button
              onClick={() => seedArenas({ tournamentType: 'both', seedCount: 20, prioritizeNew: true })}
              disabled={seedLoading}
              className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold disabled:opacity-50"
            >
              Seed newest 20 (fast lane)
            </button>
          </div>
          {seedResult ? (
            <p className="mt-2 text-xs text-white/75">
              Inserted {seedResult.insertedMatches} matches ({seedResult.rookieInserted} rookie, {seedResult.mainInserted} main) using {seedResult.catsUsed} cats.
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-6">
          <h2 className="text-sm font-bold mb-3">Manual Spotlights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs font-bold mb-2">Hall of Fame</p>
              <input value={hofCatId} onChange={(e) => setHofCatId(e.target.value)} placeholder="Cat ID" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={hofNote} onChange={(e) => setHofNote(e.target.value)} placeholder="Note (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={hofTagline} onChange={(e) => setHofTagline(e.target.value)} placeholder="Tagline (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={hofTheme} onChange={(e) => setHofTheme(e.target.value)} placeholder="Theme (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input type="datetime-local" value={hofExpires} onChange={(e) => setHofExpires(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <button onClick={() => setSpotlight('hall_of_fame', hofCatId, hofNote, hofTagline, hofTheme, hofExpires)} disabled={!!actionLoading}
                className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold disabled:opacity-50">
                {actionLoading === 'hall_of_fame' ? 'Saving...' : 'Set Hall of Fame'}
              </button>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs font-bold mb-2">Cat of the Week</p>
              <input value={cotwCatId} onChange={(e) => setCotwCatId(e.target.value)} placeholder="Cat ID" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={cotwNote} onChange={(e) => setCotwNote(e.target.value)} placeholder="Note (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={cotwTagline} onChange={(e) => setCotwTagline(e.target.value)} placeholder="Tagline (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input value={cotwTheme} onChange={(e) => setCotwTheme(e.target.value)} placeholder="Theme (optional)" className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <input type="datetime-local" value={cotwExpires} onChange={(e) => setCotwExpires(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs" />
              <button onClick={() => setSpotlight('cat_of_week', cotwCatId, cotwNote, cotwTagline, cotwTheme, cotwExpires)} disabled={!!actionLoading}
                className="w-full py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold disabled:opacity-50">
                {actionLoading === 'cat_of_week' ? 'Saving...' : 'Set Cat of Week'}
              </button>
            </div>
          </div>
        </div>

        {/* Cats */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold capitalize">{statusFilter} Image Queue ({cats.length})</h2>
          <div className="flex items-center gap-3">
            <button onClick={loadCats} disabled={loading} className="text-white/40 hover:text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={selectAllVisible}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold"
            >
              Select All Visible
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold"
            >
              Clear
            </button>
            <span className="text-xs text-white/60">{selectedIds.length} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={bulkApprove}
                disabled={selectedIds.length === 0 || !!actionLoading}
                className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-bold disabled:opacity-40"
              >
                Approve Selected
              </button>
              <button
                onClick={bulkDisapprove}
                disabled={selectedIds.length === 0 || !!actionLoading}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold disabled:opacity-40"
              >
                Disapprove Selected
              </button>
              <button
                onClick={bulkDelete}
                disabled={selectedIds.length === 0 || !!actionLoading}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-bold disabled:opacity-40"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`py-2 rounded-lg text-xs font-bold ${statusFilter === 'pending' ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`py-2 rounded-lg text-xs font-bold ${statusFilter === 'approved' ? 'bg-green-400 text-black' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`py-2 rounded-lg text-xs font-bold ${statusFilter === 'rejected' ? 'bg-red-400 text-black' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
          >
            Rejected
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`py-2 rounded-lg text-xs font-bold ${statusFilter === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}
          >
            All
          </button>
        </div>

        {loading && cats.length === 0 ? (
          <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-white/30 mx-auto" /></div>
        ) : cats.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-white/[0.03] border border-white/5">
            <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-white/50">No cats in this filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cats.map(cat => (
              <div key={cat.id} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <div className="flex gap-4">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(cat.id)}
                      onChange={() => toggleSelect(cat.id)}
                    />
                  </div>
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{cat.name}</p>
                    <p className="text-xs text-white/40">{cat.rarity} · profile:{String(cat.status || 'approved')} · image:{String(cat.image_review_status || 'pending_review')} · {new Date(cat.created_at).toLocaleDateString()}</p>
                    {cat.description && <p className="text-xs text-white/30 mt-1 line-clamp-2">{cat.description}</p>}
                    {cat.image_review_reason && <p className="text-xs text-red-300 mt-1 line-clamp-2">Reason: {cat.image_review_reason}</p>}
                    <p className="text-[10px] text-white/20 font-mono mt-1">{cat.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button onClick={() => approveCat(cat.id)} disabled={!!actionLoading}
                    className="px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {actionLoading === cat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve Photo
                  </button>
                  <button onClick={() => rejectCat(cat.id)} disabled={!!actionLoading}
                    className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <X className="w-3 h-3" /> Disapprove Photo
                  </button>
                  <button onClick={() => deleteCat(cat.id)} disabled={!!actionLoading}
                    className="px-3 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
