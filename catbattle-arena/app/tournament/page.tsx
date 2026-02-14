'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Trophy, Loader2, ArrowLeft, Swords } from 'lucide-react';
import Link from 'next/link';

interface Match {
  match_id: string;
  cat_a: { id: string; name: string; image_path: string };
  cat_b: { id: string; name: string; image_path: string };
  status: string;
  votes_a: number;
  votes_b: number;
}

interface Tournament {
  tournament_id: string;
  date: string;
  round: number;
  matches: Match[];
}

export default function TournamentPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    loadTournament();
  }, []);

  async function loadTournament() {
    try {
      const res = await fetch('/api/tournament/today');
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load tournament');
      } else {
        setTournament(data.tournament);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function vote(matchId: string, catId: string) {
    setVoting(matchId);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId: matchId, votedFor: catId })
      });
      
      if (res.ok) {
        await loadTournament(); // Refresh to show updated votes
      }
    } catch {
      // ignore
    } finally {
      setVoting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to Arena
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold">Daily Tournament</h1>
          </div>
          <p className="text-white/60">
            Round {tournament?.round} • {tournament?.matches?.length || 0} Matches
          </p>
        </div>

        <div className="space-y-6">
          {tournament?.matches?.map((match, idx) => (
            <div key={match.match_id} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-white/40">Match {idx + 1}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  match.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'
                }`}>
                  {match.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                {/* Cat A */}
                <button
                  onClick={() => vote(match.match_id, match.cat_a.id)}
                  disabled={voting === match.match_id}
                  className="relative group"
                >
                  <div className="relative h-32 rounded-xl overflow-hidden bg-white/5">
                    <Image
                      src={match.cat_a.image_path?.startsWith('http') ? match.cat_a.image_path : `https://placekitten.com/300/300`}
                      alt={match.cat_a.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="mt-2 font-bold text-center">{match.cat_a.name}</p>
                  <p className="text-sm text-white/50 text-center">{match.votes_a} votes</p>
                </button>

                {/* VS */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Swords className="w-6 h-6 text-white/50" />
                  </div>
                </div>

                {/* Cat B */}
                <button
                  onClick={() => vote(match.match_id, match.cat_b.id)}
                  disabled={voting === match.match_id}
                  className="relative group"
                >
                  <div className="relative h-32 rounded-xl overflow-hidden bg-white/5">
                    <Image
                      src={match.cat_b.image_path?.startsWith('http') ? match.cat_b.image_path : `https://placekitten.com/301/301`}
                      alt={match.cat_b.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="mt-2 font-bold text-center">{match.cat_b.name}</p>
                  <p className="text-sm text-white/50 text-center">{match.votes_b} votes</p>
                </button>
              </div>
            </div>
          ))}
        </div>

        {!tournament?.matches?.length && (
          <div className="text-center py-12">
            <p className="text-white/60">No matches yet. Submit cats to seed the tournament!</p>
            <Link href="/submit" className="inline-block mt-4 px-6 py-3 bg-white text-black rounded-xl font-bold">
              Submit a Cat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
