'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Loader2, ArrowLeft, Swords } from 'lucide-react';
import Link from 'next/link';


interface Match {
  match_id: string;
  cat_a: { id: string; name: string; image_path: string; image_url: string };
  cat_b: { id: string; name: string; image_path: string; image_url: string };
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
      void loadTournament();
    }, []);
  
    async function loadTournament() {
      try {
        setLoading(true);
        const res = await fetch("/api/tournament/today", { cache: "no-store" });
        const data: unknown = await res.json().catch(() => null);
  
        if (!res.ok) {
          setError((data as { error?: string } | null)?.error || "Failed to load tournament");
          setTournament(null);
          return;
        }
  
        const t = (data as { tournament?: Tournament; success?: boolean } | null)?.tournament;
  
        if (!(data as { success?: boolean } | null)?.success || !t?.tournament_id) {
          setError((data as { error?: string } | null)?.error || "No active tournament");
          setTournament(null);
          return;
        }
  
        setTournament(t);
        setError(null);
      } catch {
        setError("Network error");
        setTournament(null);
      } finally {
        setLoading(false);
      }
    }
  
    async function vote(matchId: string, catId: string) {
      setError(null);
      setVoting(matchId);
  
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: matchId, voted_for: catId }),
        });
  
        const json: unknown = await res.json().catch(() => null);
  
        if (!res.ok || !(json as { ok?: boolean } | null)?.ok) {
          const j = json as { error?: string; details?: string } | null;
          setError(j?.error || j?.details || "Vote failed");
          return;
        }
  
        const j = json as { votes_a?: number; votes_b?: number };
        setTournament((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            matches: prev.matches.map((m) =>
              m.match_id === matchId
                ? { ...m, votes_a: j.votes_a ?? m.votes_a, votes_b: j.votes_b ?? m.votes_b }
                : m
            ),
          };
        });
      } catch {
        setError("Network error");
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
            {tournament?.matches?.map((match, idx) => {
              const total = (match.votes_a || 0) + (match.votes_b || 0);
              const pctA = total > 0 ? Math.round((match.votes_a / total) * 100) : 50;
              const pctB = 100 - pctA;
  
              return (
                <div key={match.match_id} className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-white/40">Match {idx + 1}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        match.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>
  
                  <div className="relative grid grid-cols-2 gap-4 items-center">
                    {/* Cat A */}
                    <button
                      onClick={() => vote(match.match_id, match.cat_a.id)}
                      disabled={voting === match.match_id}
                      className="relative group"
                    >
                      <div className="relative h-32 rounded-xl overflow-hidden bg-white/5">
                        <img
                          src={match.cat_a.image_url || "https://placekitten.com/300/300"}
                          alt={match.cat_a.name || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "https://placekitten.com/300/300";
                          }}
                        />
                      </div>
                      <p className="mt-2 font-bold text-center">{match.cat_a.name}</p>
                      <p className="text-sm text-white/50 text-center">{match.votes_a} votes</p>
  
                      <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${pctA}%` }}
                        />
                      </div>
                      <p className="text-xs text-white/40 text-center mt-1">{pctA}%</p>
                    </button>
  
                    {/* VS */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
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
                        <img
                          src={match.cat_b.image_url || "https://placekitten.com/301/301"}
                          alt={match.cat_b.name || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "https://placekitten.com/301/301";
                          }}
                        />
                      </div>
                      <p className="mt-2 font-bold text-center">{match.cat_b.name}</p>
                      <p className="text-sm text-white/50 text-center">{match.votes_b} votes</p>
  
                      <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all duration-300"
                          style={{ width: `${pctB}%` }}
                        />
                      </div>
                      <p className="text-xs text-white/40 text-center mt-1">{pctB}%</p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
  
          {!tournament?.matches?.length && (
            <div className="text-center py-12">
              <p className="text-white/60">No matches yet. Submit cats to seed the tournament!</p>
              <Link
                href="/submit"
                className="inline-block mt-4 px-6 py-3 bg-white text-black rounded-xl font-bold"
              >
                Submit a Cat
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }
  