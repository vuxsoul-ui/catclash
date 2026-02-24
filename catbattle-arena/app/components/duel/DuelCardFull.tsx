'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { DuelRowData } from './types';

function percent(a: number, b: number): [number, number] {
  const total = a + b;
  if (!total) return [50, 50];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

export default function DuelCardFull({
  duel,
  meId,
  busy,
  onVote,
  onShare,
}: {
  duel: DuelRowData;
  meId: string;
  busy: boolean;
  onVote: (duelId: string, catId: string) => Promise<boolean>;
  onShare: (duelId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pendingVote, setPendingVote] = useState<'A' | 'B' | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const votesA = Number(duel.votes?.cat_a || 0);
  const votesB = Number(duel.votes?.cat_b || 0);
  const [pctA, pctB] = useMemo(() => percent(votesA, votesB), [votesA, votesB]);
  const localPctA = pendingVote === 'A' ? 62 : pendingVote === 'B' ? 38 : pctA;
  const localPctB = pendingVote === 'A' ? 38 : pendingVote === 'B' ? 62 : pctB;
  const canVote =
    duel.status === 'voting' &&
    !duel.votes?.user_vote_cat_id &&
    meId !== duel.challenger_user_id &&
    meId !== duel.challenged_user_id;
  const voteLocked = !!pendingVote || busy;

  useEffect(() => {
    setPendingVote(null);
    setVoteSubmitted(false);
    setVoteError(null);
  }, [duel.id, duel.votes?.user_vote_cat_id, duel.status]);

  async function handleVote(side: 'A' | 'B', catId: string | null | undefined) {
    if (!catId || !canVote || voteLocked) return;
    setPendingVote(side);
    setVoteSubmitted(false);
    setVoteError(null);
    const ok = await onVote(duel.id, catId);
    if (ok) {
      setVoteSubmitted(true);
      return;
    }
    setPendingVote(null);
    setVoteSubmitted(false);
    setVoteError('Vote failed — try again');
  }

  return (
    <article className="rounded-xl border border-white/12 bg-white/[0.035] p-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {[{ cat: duel.challenger_cat, user: duel.challenger_username, side: 'a' }, { cat: duel.challenged_cat, user: duel.challenged_username, side: 'b' }].map(({ cat, user, side }) => (
          <div key={side} className="rounded-lg border border-white/12 bg-black/25 p-2">
            <div className="flex items-center gap-2">
              <img
                src={cat?.image_url || '/cat-placeholder.svg'}
                alt={cat?.name || 'Cat'}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-cover border border-white/20"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{cat?.name || 'Unknown'}</p>
                <p className="text-[10px] text-white/60 truncate">{user}</p>
                <p className="text-[9px] text-white/45 truncate">{cat?.rarity || 'Common'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void handleVote('A', duel.challenger_cat?.id)}
            disabled={!canVote || voteLocked || !duel.challenger_cat?.id}
            className={`h-11 rounded-lg text-[12px] font-bold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 touch-manipulation transition-all duration-500 ${pendingVote === 'A' ? 'bg-orange-500/35 text-orange-50 ring-2 ring-orange-300/70 shadow-[0_0_18px_rgba(251,146,60,0.45)]' : pendingVote === 'B' ? 'bg-orange-500/10 text-orange-100/70' : 'bg-orange-500/20 text-orange-100'}`}
          >
            {pendingVote === 'A' && !voteSubmitted ? 'Submitting…' : 'Vote A'}
          </button>
          <button
            onClick={() => void handleVote('B', duel.challenged_cat?.id)}
            disabled={!canVote || voteLocked || !duel.challenged_cat?.id}
            className={`h-11 rounded-lg text-[12px] font-bold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation transition-all duration-500 ${pendingVote === 'B' ? 'bg-cyan-500/35 text-cyan-50 ring-2 ring-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.45)]' : pendingVote === 'A' ? 'bg-cyan-500/10 text-cyan-100/70' : 'bg-cyan-500/20 text-cyan-100'}`}
          >
            {pendingVote === 'B' && !voteSubmitted ? 'Submitting…' : 'Vote B'}
          </button>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/10 flex">
          <div className={`bg-orange-400/90 transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${pendingVote === 'A' ? 'shadow-[0_0_14px_rgba(251,146,60,0.75)]' : ''}`} style={{ width: `${localPctA}%` }} />
          <div className={`bg-cyan-400/90 transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${pendingVote === 'B' ? 'shadow-[0_0_14px_rgba(34,211,238,0.75)]' : ''}`} style={{ width: `${localPctB}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/65 min-h-[14px]">
          <span>{votesA} votes</span>
          <span>
            {pendingVote ? (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 ${pendingVote === 'A' ? 'border-orange-300/45 bg-orange-500/20 text-orange-100' : 'border-cyan-300/45 bg-cyan-500/20 text-cyan-100'}`}>
                +1 {pendingVote}
              </span>
            ) : `${Number(duel.votes?.total || 0)} total`}
          </span>
          <span>{votesB} votes</span>
        </div>
        {voteSubmitted && (
          <p className="mt-1 text-[10px] text-emerald-200">Voted ✅</p>
        )}
        {voteError && (
          <p className="mt-1 text-[10px] text-red-300">{voteError}</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-[11px] font-semibold text-white/85 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 touch-manipulation"
        >
          Details
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onShare(duel.id)}
          className="h-10 px-3 rounded-lg bg-white text-black text-[11px] font-bold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {expanded && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] text-white/70 space-y-1">
          <p>Status: <span className="text-white/90 capitalize">{String(duel.status || 'voting')}</span></p>
          <p>Challenger: <span className="text-white/90">{duel.challenger_username}</span></p>
          <p>Challenged: <span className="text-white/90">{duel.challenged_username}</span></p>
        </div>
      )}
    </article>
  );
}
