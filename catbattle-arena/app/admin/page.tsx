// REPLACE: app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Check, X, Shield, Trophy, Zap, RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';

interface Cat {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
  ability: string;
  created_at: string;
}

interface TournamentMatch {
  match_id: string;
  cat_a: { id: string; name: string };
  cat_b: { id: string; name: string };
  votes_a: number;
  votes_b: number;
  status: string;
}

interface TournamentInfo {
  tournament_id: string;
  date: string;
  round: number;
  matches: TournamentMatch[];
}

export default function AdminPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showSecretInput, setShowSecretInput] = useState(true);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const [ticking, setTicking] = useState(false);

  async function loadPending() {
    try {
      const res = await fetch('/api/cats/pending');
      const data = await res.json();
      
      console.log('Admin loadPending:', data);
      
      if (!data.ok) {
        setError(data.error || 'Failed to load');
      } else {
        setCats(data.cats || []);
        setShowSecretInput(false);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTournament() {
    try {
      const res = await fetch('/api/tournament/today', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.tournament) {
        setTournament(data.tournament);
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (!showSecretInput) {
      loadTournament();
    }
  }, [showSecretInput]);

  async function handleApprove(catId: string) {
    setProcessing(catId);
    setError(null);
    try {
      const res = await fetch('/api/admin/cats/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ catId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCats(prev => prev.filter(c => c.id !== catId));
        showSuccess('Cat approved');
      } else {
        setError(data.error || 'Approve failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(catId: string) {
    setProcessing(catId);
    setError(null);
    try {
      const res = await fetch('/api/admin/cats/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ catId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCats(prev => prev.filter(c => c.id !== catId));
        showSuccess('Cat rejected');
      } else {
        setError(data.error || 'Reject failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleResolveRound() {
    if (resolving || !tournament) return;
    setResolving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tournament/resolve-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ tournament_id: tournament.tournament_id }),
      });
      const data = await res.json();
      if (data.ok) {
        const result = data.result;
        if (result?.status === 'complete') {
          showSuccess('Tournament complete! Champion crowned!');
        } else if (result?.status === 'advanced') {
          showSuccess('Round resolved! Advanced to Round ' + result.next_round);
        } else {
          showSuccess('Round resolved!');
        }
        await loadTournament();
      } else {
        setError(data.error || 'Resolve failed');
      }
    } catch {
      setError('Network error');
    }
    setResolving(false);
  }

  async function handleDailyTick() {
    if (ticking) return;
    setTicking(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tournament/resolve-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        showSuccess('Daily tick complete! Check tournaments.');
        await loadTournament();
      } else {
        setError(data.error || 'Tick failed');
      }
    } catch {
      setError('Network error');
    }
    setTicking(false);
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  if (showSecretInput) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h1 className="text-2xl font-bold">Admin Access</h1>
          </div>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Enter admin secret"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white mb-4"
          />
          <button onClick={loadPending} className="w-full py-3 rounded-xl bg-white text-black font-bold">
            Access Admin Panel
          </button>
          <Link href="/" className="block text-center mt-4 text-white/60 hover:text-white">
            &larr; Back to Arena
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-200">{success}</div>
        )}

        {/* Tournament Controls */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Tournament Controls
          </h2>

          {tournament ? (
            <div className="glass rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">Today&apos;s Tournament</h3>
                  <p className="text-sm text-white/50">
                    Round {tournament.round} &middot; {tournament.matches.length} matches &middot; {tournament.date}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadTournament}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>
              </div>

              {/* Match list */}
              <div className="space-y-3 mb-4">
                {tournament.matches.map((match, i) => {
                  const total = match.votes_a + match.votes_b;
                  return (
                    <div key={match.match_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <span className="text-xs text-white/30 w-8">M{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{match.cat_a.name}</span>
                          <span className="text-white/30">vs</span>
                          <span className="font-medium">{match.cat_b.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/40 mt-1">
                          <span>{match.votes_a} votes</span>
                          <span>{total} total</span>
                          <span>{match.votes_b} votes</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        match.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        match.status === 'complete' ? 'bg-white/10 text-white/40' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {match.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleResolveRound}
                  disabled={resolving}
                  className="flex-1 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Resolve Current Round
                </button>
                <button
                  onClick={handleDailyTick}
                  disabled={ticking}
                  className="flex-1 py-3 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {ticking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Run Daily Tick
                </button>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 text-center mb-4">
              <p className="text-white/60 mb-4">No active tournament found.</p>
              <button
                onClick={handleDailyTick}
                disabled={ticking}
                className="px-6 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-bold flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
              >
                {ticking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Today&apos;s Tournaments
              </button>
            </div>
          )}
        </div>

        {/* Cat Moderation */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" /> Cat Moderation
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
              {cats.length} Pending
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cats.map((cat) => (
              <div key={cat.id} className="glass rounded-2xl overflow-hidden">
                <div className="relative h-48 bg-white/5">
                  <img
                    src={cat.image_url || 'https://placekitten.com/300/300'}
                    alt={cat.name || ''}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://placekitten.com/300/300';
                    }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{cat.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10">{cat.rarity}</span>
                  </div>
                  <p className="text-sm text-white/50 mb-2">{cat.ability}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-white/40 mb-4">
                    <div>ATK: {cat.stats?.attack}</div>
                    <div>DEF: {cat.stats?.defense}</div>
                    <div>SPD: {cat.stats?.speed}</div>
                    <div>CHA: {cat.stats?.charisma}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(cat.id)}
                      disabled={processing === cat.id}
                      className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processing === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(cat.id)}
                      disabled={processing === cat.id}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cats.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/60">No pending cats to moderate!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}