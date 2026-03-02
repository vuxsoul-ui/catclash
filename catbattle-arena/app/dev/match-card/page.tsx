'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ArenaMatch } from '../../page';

type MatchCardProps = {
  match: ArenaMatch;
  voted: string | null;
  isVoting: boolean;
  predictBusy: boolean;
  calloutBusy: boolean;
  socialEnabled: boolean;
  availableSigils: number;
  voteStreak: number;
  isExiting?: boolean;
  voteQueued?: boolean;
  showNextUp?: boolean;
  onRefreshQueued?: (matchId: string) => void;
  onVoteAccepted?: (matchId: string, side: 'a' | 'b') => void;
  slotPhase?: 'idle' | 'voted' | 'exiting';
  slotChosenSide?: 'a' | 'b' | null;
  enterPhase?: 'idle' | 'entering';
  debugMode?: boolean;
  onVote: (matchId: string, catId: string) => Promise<boolean>;
  onPredict: (matchId: string, catId: string, bet: number) => Promise<boolean>;
  onCreateCallout: (matchId: string, catId: string) => void;
};

function DevMatchCard({ match, voted, isExiting }: MatchCardProps) {
  const votedLabel = voted ? 'VOTED' : 'UNVOTED';
  const exitLabel = isExiting ? 'EXITING' : '';
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">{match.match_id}</div>
        <div className="text-[10px] text-white/60">{[votedLabel, exitLabel].filter(Boolean).join(' • ')}</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          <div className="text-xs font-semibold">{match.cat_a?.name || 'Cat A'}</div>
          <div className="text-[10px] text-white/60">@{match.cat_a?.owner_username || 'unknown'}</div>
          <div className="mt-1 text-[10px] text-white/60">votes: {match.votes_a}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-2">
          <div className="text-xs font-semibold">{match.cat_b?.name || 'Cat B'}</div>
          <div className="text-[10px] text-white/60">@{match.cat_b?.owner_username || 'unknown'}</div>
          <div className="mt-1 text-[10px] text-white/60">votes: {match.votes_b}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-white/50">
        This sandbox uses a lightweight preview component to avoid importing runtime exports from `app/page.tsx`.
      </div>
    </div>
  );
}

function makeMatch(id: string, opts?: { close?: boolean; votesA?: number; votesB?: number; cosmetics?: boolean }): ArenaMatch {
  const cosmetics = !!opts?.cosmetics;
  return {
    match_id: id,
    status: 'active',
    votes_a: opts?.votesA ?? 24,
    votes_b: opts?.votesB ?? 22,
    winner_id: null,
    is_close_match: opts?.close ?? true,
    user_prediction: null,
    cat_a: {
      id: `${id}-a`,
      name: 'Furboss',
      image_url: '/cat-placeholder.svg',
      rarity: 'Rare',
      owner_username: 'vuxsal',
      owner_guild: 'moon',
      ability: 'Solar Blink',
      stats: { attack: 14, defense: 12, speed: 13, charisma: 9, chaos: 8 },
      ...(cosmetics ? { cosmetic_title: 'Meme Lord', cosmetic_border: 'Solarflare', cosmetic_color: 'Cyan Ember' } : {}),
    } as any,
    cat_b: {
      id: `${id}-b`,
      name: 'Couchraider',
      image_url: '/cat-placeholder.svg',
      rarity: 'Epic',
      owner_username: 'kais',
      owner_guild: 'sun',
      ability: 'Moon Guard',
      stats: { attack: 13, defense: 14, speed: 10, charisma: 11, chaos: 9 },
      ...(cosmetics ? { cosmetic_title: 'Arena King', cosmetic_border: 'Void Frame', cosmetic_color: 'Amber Pulse' } : {}),
    } as any,
  };
}

export default function DevMatchCardPage() {
  const [devGate, setDevGate] = useState(false);
  const [queryReady, setQueryReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fixtureIndicator, setFixtureIndicator] = useState(true);
  const [mobilePreview, setMobilePreview] = useState(true);
  const [votedMap, setVotedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDevGate(params.get('dev') === '1');
    setQueryReady(true);
  }, []);

  const mocks = useMemo(() => {
    const base = [
      { label: 'Default', match: makeMatch('dev-default', { close: true, votesA: 18, votesB: 17 }), exiting: false },
      { label: 'Hot/Heating', match: makeMatch('dev-hot', { close: false, votesA: 31, votesB: 18 }), exiting: false },
      { label: 'Voted', match: makeMatch('dev-voted', { close: true, votesA: 23, votesB: 22 }), exiting: false },
      { label: 'Closing', match: makeMatch('dev-closing', { close: false, votesA: 19, votesB: 20 }), exiting: true },
    ];
    return [
      ...base.map((b) => ({ ...b, key: `${b.match.match_id}-plain`, cosmetics: 'None' })),
      ...base.map((b) => ({ ...b, match: makeMatch(`${b.match.match_id}-cos`, { close: b.match.is_close_match, votesA: b.match.votes_a, votesB: b.match.votes_b, cosmetics: true }), key: `${b.match.match_id}-cos`, cosmetics: 'Present' })),
    ];
  }, []);

  async function vote(matchId: string, catId: string) {
    setVotedMap((prev) => ({ ...prev, [matchId]: catId }));
    return true;
  }

  async function predict() {
    return true;
  }

  const shellClass = [
    reduceMotion ? 'reduce-motion-sim' : '',
    'min-h-screen bg-black text-white',
  ].join(' ');

  if (process.env.NODE_ENV === 'production' && queryReady && !devGate) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/70">Sandbox unavailable.</p>
      </main>
    );
  }

  return (
    <main className={shellClass}>
      <section className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
          <h1 className="text-lg font-semibold">MatchCard Sandbox</h1>
          <p className="text-xs text-white/60">Deterministic mock states for design iteration. No API calls.</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
              Simulate reduced motion
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={fixtureIndicator} onChange={(e) => setFixtureIndicator(e.target.checked)} />
              Fixture indicators
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={mobilePreview} onChange={(e) => setMobilePreview(e.target.checked)} />
              Mobile width preview (390px)
            </label>
          </div>
          {fixtureIndicator ? (
            <p className="mt-2 text-[11px] text-cyan-200/80">Fixture mode visual parity: ON</p>
          ) : null}
        </div>

        <div className={mobilePreview ? 'mx-auto w-full max-w-[390px] space-y-3' : 'space-y-3'}>
          {mocks.map((entry) => (
            <div key={entry.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <p className="mb-1 text-[11px] text-white/60">{entry.label} • Cosmetics: {entry.cosmetics}</p>
              <DevMatchCard
                match={entry.match}
                voted={entry.label === 'Voted' ? (votedMap[entry.match.match_id] || entry.match.cat_a.id) : (votedMap[entry.match.match_id] || null)}
                isVoting={false}
                predictBusy={false}
                calloutBusy={false}
                socialEnabled={true}
                availableSigils={120}
                voteStreak={4}
                isExiting={entry.exiting}
                onVote={vote}
                onPredict={predict}
                onCreateCallout={() => {}}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
