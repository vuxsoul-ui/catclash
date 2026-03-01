'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Target } from 'lucide-react';
import { thumbUrlForCat } from '../lib/cat-images';

type ArenaCat = { id: string; name: string; image_url: string | null; rarity: string; owner_username?: string | null };
type ArenaMatch = { match_id: string; cat_a: ArenaCat; cat_b: ArenaCat; votes_a: number; votes_b: number; status: string };
type ArenaRound = { round: number; matches: ArenaMatch[] };
type Arena = { tournament_id: string; type: string; current_round: number; rounds: ArenaRound[] };

function isByeMatch(match: ArenaMatch): boolean {
  return match.cat_a.id === match.cat_b.id;
}

export default function RookieArenaPage() {
  const [loading, setLoading] = useState(true);
  const [arena, setArena] = useState<Arena | null>(null);
  const [segment, setSegment] = useState<'voting' | 'results'>('voting');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/tournament/active', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const rookie = (Array.isArray(data?.arenas) ? data.arenas : []).find((a: Arena) => a.type === 'rookie') || null;
        setArena(rookie);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeMatches = useMemo(() => {
    if (!arena) return [];
    const currentRound = arena.rounds.find((r) => r.round === arena.current_round);
    const voting = (currentRound?.matches || []).filter((m) => !isByeMatch(m) && m.status === 'active');
    const results = [...arena.rounds].reverse().flatMap((r) => r.matches || []).filter((m) => !isByeMatch(m) && m.status === 'complete');
    return segment === 'voting' ? voting : results;
  }, [arena, segment]);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-white/40" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4 mb-4">
          <h1 className="text-2xl font-bold mb-1">Rookie Arena</h1>
          <p className="text-sm text-white/60">Fresh cats compete here before they dominate Main Arena.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['voting', 'results'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`h-10 rounded-full text-xs font-semibold capitalize ${segment === s ? 'bg-white text-black' : 'bg-white/10 text-white/85'}`}
            >
              {s === 'voting' ? 'Voting Now' : 'Results'}
            </button>
          ))}
        </div>

        {activeMatches.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
            <Target className="w-8 h-8 mx-auto text-white/40 mb-2" />
            <p className="text-sm text-white/70">No rookie matchups right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMatches.map((m) => (
              <div key={m.match_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <Link href={`/cat/${m.cat_a.id}`} className="block">
                    <img src={thumbUrlForCat(m.cat_a.id)} alt={m.cat_a.name} className="w-full h-24 rounded-lg object-cover mb-1" />
                    <p className="text-sm font-semibold truncate">{m.cat_a.name}</p>
                  </Link>
                  <span className="text-[10px] text-white/60">VS</span>
                  <Link href={`/cat/${m.cat_b.id}`} className="block">
                    <img src={thumbUrlForCat(m.cat_b.id)} alt={m.cat_b.name} className="w-full h-24 rounded-lg object-cover mb-1" />
                    <p className="text-sm font-semibold truncate">{m.cat_b.name}</p>
                  </Link>
                </div>
                <p className="text-xs text-white/50 mt-2">{m.votes_a}-{m.votes_b} votes</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
