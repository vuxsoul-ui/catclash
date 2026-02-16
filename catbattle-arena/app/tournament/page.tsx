// REPLACE: app/tournament/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Check, Crown, Swords, Star, Target } from 'lucide-react';
import Link from 'next/link';

interface ArenaCat { id: string; name: string; image_url: string | null; rarity: string; }
interface ArenaMatch { match_id: string; cat_a: ArenaCat; cat_b: ArenaCat; votes_a: number; votes_b: number; status: string; winner_id?: string | null; }
interface ArenaRound { round: number; matches: ArenaMatch[]; }
interface Arena { tournament_id: string; type: string; date: string; current_round: number; status: string; champion: ArenaCat | null; rounds: ArenaRound[]; }

const ARENA_CFG: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
  main:   { label: 'Main Arena',   icon: <Swords className="w-4 h-4" />, accent: 'text-yellow-400' },
  rookie: { label: 'Rookie Arena', icon: <Star className="w-4 h-4" />,   accent: 'text-green-400' },
};
function getCfg(t: string) { return ARENA_CFG[t] || { label: t + ' Arena', icon: <Target className="w-4 h-4" />, accent: 'text-purple-400' }; }
function rarityCol(r: string) { return ({ Common:'text-gray-400', Rare:'text-blue-400', Epic:'text-purple-400', Legendary:'text-yellow-400', Mythic:'text-red-400', 'God-Tier':'text-pink-400' })[r] || 'text-gray-400'; }
function catImg(c: ArenaCat) { return c.image_url || 'https://placekitten.com/300/300'; }
function pct(a: number, b: number): [number, number] { const t = a+b; return t === 0 ? [50,50] : [Math.round(a/t*100), Math.round(b/t*100)]; }
function isBye(m: ArenaMatch) { return m.cat_a.id === m.cat_b.id; }

function MatchCard({ match, voted, isVoting, onVote }: { match: ArenaMatch; voted: string|null; isVoting: boolean; onVote: (m:string,c:string)=>void; }) {
  const [pA, pB] = pct(match.votes_a, match.votes_b);
  const total = match.votes_a + match.votes_b;
  const done = match.status === 'complete';
  const hasVoted = !!voted;
  const canVote = !hasVoted && !isVoting && !done;
  const dim = (hasVoted || done) ? 'opacity-60' : '';

  return (
    <div className={`rounded-xl bg-white/[0.03] border border-white/5 p-4 ${dim}`}>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* Cat A */}
        <div className="text-center">
          <Link href={`/cat/${match.cat_a.id}`}>
            <div className={`relative h-28 sm:h-36 rounded-lg overflow-hidden bg-white/5 mb-2 transition-transform hover:scale-[1.03] ${voted === match.cat_a.id ? 'ring-2 ring-blue-400' : ''}`}>
              <img src={catImg(match.cat_a)} alt={match.cat_a.name} className="w-full h-full object-cover object-center"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placekitten.com/300/300'; }} />
              {voted === match.cat_a.id && <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
              {done && match.winner_id === match.cat_a.id && <div className="absolute top-1.5 right-1.5 bg-yellow-500 rounded-full p-0.5"><Crown className="w-3 h-3 text-black" /></div>}
            </div>
          </Link>
          <Link href={`/cat/${match.cat_a.id}`} className="font-bold text-xs truncate block hover:underline">{match.cat_a.name}</Link>
          <p className={`text-[10px] ${rarityCol(match.cat_a.rarity)}`}>{match.cat_a.rarity}</p>
          {canVote && <button onClick={() => onVote(match.match_id, match.cat_a.id)} disabled={isVoting}
            className="mt-2 w-full py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition-colors disabled:opacity-50">
            {isVoting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Vote'}</button>}
          {hasVoted && voted === match.cat_a.id && <div className="mt-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-400/60 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" />Voted</div>}
        </div>

        <div className="flex flex-col items-center pt-12">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-white/50">VS</span>
          </div>
          {isVoting && <Loader2 className="w-3 h-3 animate-spin text-white/30 mt-1" />}
        </div>

        {/* Cat B */}
        <div className="text-center">
          <Link href={`/cat/${match.cat_b.id}`}>
            <div className={`relative h-28 sm:h-36 rounded-lg overflow-hidden bg-white/5 mb-2 transition-transform hover:scale-[1.03] ${voted === match.cat_b.id ? 'ring-2 ring-red-400' : ''}`}>
              <img src={catImg(match.cat_b)} alt={match.cat_b.name} className="w-full h-full object-cover object-center"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placekitten.com/300/300'; }} />
              {voted === match.cat_b.id && <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>}
              {done && match.winner_id === match.cat_b.id && <div className="absolute top-1.5 right-1.5 bg-yellow-500 rounded-full p-0.5"><Crown className="w-3 h-3 text-black" /></div>}
            </div>
          </Link>
          <Link href={`/cat/${match.cat_b.id}`} className="font-bold text-xs truncate block hover:underline">{match.cat_b.name}</Link>
          <p className={`text-[10px] ${rarityCol(match.cat_b.rarity)}`}>{match.cat_b.rarity}</p>
          {canVote && <button onClick={() => onVote(match.match_id, match.cat_b.id)} disabled={isVoting}
            className="mt-2 w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors disabled:opacity-50">
            {isVoting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Vote'}</button>}
          {hasVoted && voted === match.cat_b.id && <div className="mt-2 py-1.5 rounded-lg bg-red-500/10 text-red-400/60 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" />Voted</div>}
        </div>
      </div>

      {(hasVoted || total > 0 || done) && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/40 mb-0.5"><span>{match.votes_a} ({pA}%)</span><span>{match.votes_b} ({pB}%)</span></div>
          <div className="h-1.5 rounded-full overflow-hidden flex bg-white/5">
            <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pA}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${pB}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function getRoundLabel(round: number, totalRounds: number, matchCount: number): string {
  if (matchCount === 1 && round === totalRounds) return 'Final';
  if (matchCount === 2) return 'Semi-Finals';
  if (matchCount === 4) return 'Quarter-Finals';
  return `Round ${round}`;
}

export default function TournamentPage() {
  const [loading, setLoading] = useState(true);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/tournament/active', { cache: 'no-store' });
      const data = await res.json();
      setArenas(data.arenas || []);
      setVotedMatches(data.voted_matches || {});
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatch || votedMatches[matchId]) return;
    setVotingMatch(matchId);
    try {
      const r = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: matchId, voted_for: catId }) });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.error || 'Vote failed';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) setVotedMatches(p => ({ ...p, [matchId]: catId }));
        showToast(msg);
      } else {
        setVotedMatches(p => ({ ...p, [matchId]: catId }));
        showToast('Vote recorded! +5 XP');
        const res = await fetch('/api/tournament/active', { cache: 'no-store' });
        const d = await res.json();
        setArenas(d.arenas || []);
        setVotedMatches(p => ({ ...p, ...(d.voted_matches || {}) }));
      }
    } catch { showToast('Network error'); }
    setVotingMatch(null);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-white/50" /></div>;

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur text-white text-sm">{toast}</div>}
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <h1 className="text-3xl font-bold mb-6">All Tournaments</h1>

        {arenas.length === 0 && <div className="text-center py-12 glass rounded-2xl"><p className="text-white/50">No active tournaments today.</p></div>}

        <div className="space-y-10">
          {arenas.map(arena => {
            const cfg = getCfg(arena.type);
            const totalRounds = arena.rounds.length;
            return (
              <div key={arena.tournament_id}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={cfg.accent}>{cfg.icon}</span>
                  <h2 className="text-xl font-bold">{cfg.label}</h2>
                  <span className="text-xs text-white/30 px-2 py-0.5 rounded-full bg-white/5">
                    {arena.status === 'complete' ? 'Complete' : `Round ${arena.current_round}`}
                  </span>
                </div>

                {arena.champion && (
                  <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden">
                      <img src={catImg(arena.champion)} alt={arena.champion.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5"><Crown className="w-4 h-4 text-yellow-400" /><Link href={`/cat/${arena.champion.id}`} className="font-bold text-yellow-400 hover:underline">{arena.champion.name}</Link></div>
                      <p className="text-xs text-white/40">Champion</p>
                    </div>
                  </div>
                )}

                {/* Bracket visualization */}
                {arena.rounds.map(round => {
                  const realMatches = round.matches.filter(m => !isBye(m));
                  if (realMatches.length === 0) return null;
                  const isCurrent = round.round === arena.current_round;
                  const isPast = round.round < arena.current_round;
                  const label = getRoundLabel(round.round, totalRounds, round.matches.length);

                  return (
                    <div key={round.round} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-px flex-1 ${isCurrent ? 'bg-yellow-500/30' : 'bg-white/5'}`} />
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          isPast ? 'bg-green-500/10 text-green-400' : isCurrent ? 'bg-yellow-500/10 text-yellow-400' : 'bg-white/5 text-white/20'
                        }`}>{label}</span>
                        <div className={`h-px flex-1 ${isCurrent ? 'bg-yellow-500/30' : 'bg-white/5'}`} />
                      </div>
                      <div className="space-y-3">
                        {realMatches.map(match => (
                          <MatchCard key={match.match_id} match={match}
                            voted={votedMatches[match.match_id] || null}
                            isVoting={votingMatch === match.match_id} onVote={handleVote} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}