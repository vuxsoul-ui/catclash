'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Club, Loader2 } from 'lucide-react';
import SigilBalanceChip from '../components/SigilBalanceChip';

type Game = 'blackjack' | 'coinflip';

type BlackjackHand = {
  hand_id: string;
  status: 'active' | 'complete';
  bet: number;
  player_cards: number[];
  dealer_cards: number[];
  player_total: number;
  dealer_total: number | null;
  outcome: 'win' | 'lose' | 'push' | null;
  natural_blackjack: boolean;
  payout: number;
};

type CasinoResponse = {
  ok: boolean;
  sigils: number;
  hand?: BlackjackHand;
  active_hand?: BlackjackHand | null;
  error?: string;
};

export default function CasinoPage() {
  const [game, setGame] = useState<Game>('blackjack');
  const [bet, setBet] = useState(25);
  const [sigils, setSigils] = useState(0);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [hand, setHand] = useState<BlackjackHand | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/casino/play', { cache: 'no-store' });
        const data: CasinoResponse = await res.json();
        if (res.ok && data.ok) {
          setSigils(data.sigils || 0);
          setHand(data.active_hand || null);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  const canStartBlackjack = useMemo(() => !hand || hand.status !== 'active', [hand]);

  async function callCasino(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/casino/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: CasinoResponse & { detail?: { choice?: string; result?: string } } = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed');
        return;
      }
      if (typeof data.sigils === 'number') setSigils(data.sigils);
      if (data.hand) {
        setHand(data.hand);
        if (data.hand.status === 'complete') {
          if (data.hand.outcome === 'win') setResultText(`Blackjack win: +${Math.max(0, (data.hand.payout || 0) - data.hand.bet)} sigils`);
          else if (data.hand.outcome === 'push') setResultText('Push: bet returned');
          else setResultText('Bust/Loss: better luck next hand');
        } else {
          setResultText(null);
        }
      }
      if (data.detail?.choice && data.detail?.result) {
        setResultText(data.detail.choice === data.detail.result ? 'Coinflip win' : 'Coinflip loss');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function playCoinflip() {
    await callCasino({ game: 'coinflip', bet, choice });
  }

  async function startBlackjack() {
    await callCasino({ game: 'blackjack', action: 'start', bet });
  }

  async function hitBlackjack() {
    await callCasino({ game: 'blackjack', action: 'hit' });
  }

  async function standBlackjack() {
    await callCasino({ game: 'blackjack', action: 'stand' });
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 pb-32 pt-4 sm:pt-5">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/45 hover:text-white/80 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[30px] leading-[1.05] font-bold tracking-tight">Sigil Casino</h1>
            <p className="mt-1 text-white/55 text-sm">Play side games with your sigils.</p>
          </div>
          <SigilBalanceChip balance={sigils} size="sm" className="whitespace-nowrap mt-1 opacity-90" />
        </div>

        <div className="mb-4 rounded-2xl bg-white/[0.03] p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setGame('blackjack')} className={`h-11 rounded-xl text-sm font-semibold transition-all ${game === 'blackjack' ? 'border border-cyan-300/45 bg-gradient-to-r from-cyan-500/25 to-violet-500/20 text-white shadow-[0_0_20px_rgba(34,211,238,0.22)]' : 'border border-transparent bg-white/[0.04] text-white/75'}`}>
            <Club className="w-4 h-4 inline mr-1.5" /> Blackjack
          </button>
          <button onClick={() => setGame('coinflip')} className={`h-11 rounded-xl text-sm font-semibold transition-all ${game === 'coinflip' ? 'border border-violet-300/45 bg-gradient-to-r from-violet-500/25 to-cyan-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.22)]' : 'border border-transparent bg-white/[0.04] text-white/75'}`}>
            <Coins className="w-4 h-4 inline mr-1.5" /> Coinflip
          </button>
          </div>
        </div>

        <section className="rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4">
          <div className="rounded-xl bg-black/35 p-3">
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-white/45">Bet</span>
              <input
                type="number"
                min={1}
                max={500}
                value={bet}
                onChange={(e) => setBet(Math.max(1, Math.min(500, Number(e.target.value || 1))))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold"
              />
            </label>

            {game === 'coinflip' && (
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-white/45">Pick Side</span>
                <select value={choice} onChange={(e) => setChoice((e.target.value as 'heads' | 'tails') || 'heads')}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <option value="heads">Heads</option>
                  <option value="tails">Tails</option>
                </select>
              </label>
            )}

            {game === 'coinflip' ? (
              <button onClick={playCoinflip} disabled={loading || bet > sigils}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold shadow-[0_10px_24px_rgba(16,185,129,0.25)] disabled:opacity-40">
                {loading ? 'Playing...' : `Flip for ${bet}`}
              </button>
            ) : (
              <button onClick={startBlackjack} disabled={loading || bet > sigils || !canStartBlackjack}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-400 text-black font-bold shadow-[0_14px_28px_rgba(245,158,11,0.30)] ring-1 ring-amber-200/35 disabled:opacity-40">
                {loading ? 'Starting...' : canStartBlackjack ? 'Deal Hand' : 'Hand Active'}
              </button>
            )}
          </div>
          </div>

          {game === 'blackjack' && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3.5">
              <div className="mb-3 rounded-xl bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(15,23,42,0.38))] px-3 py-2.5 ring-1 ring-white/8 shadow-[0_10px_24px_rgba(2,6,23,0.26)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/50 mb-2">Dealer {hand ? `(${hand.dealer_total ?? 0})` : ''}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(hand?.dealer_cards || []).map((card, i) => (
                  <div key={`d-${i}`} className="min-w-10 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03))] px-3 py-2 text-center text-sm font-bold ring-1 ring-white/10 shadow-[0_8px_14px_rgba(2,6,23,0.22)]">
                    {card === -1 ? '?' : card}
                  </div>
                ))}
                {!hand && (
                  <div className="w-full rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/8">
                    <p className="text-white/80 text-sm font-semibold">No hand active</p>
                    <p className="mt-0.5 text-xs text-white/50">Place your bet and deal to begin.</p>
                  </div>
                )}
              </div>
              </div>

              <div className="rounded-xl bg-[linear-gradient(180deg,rgba(168,85,247,0.07),rgba(15,23,42,0.42))] px-3 py-2.5 ring-1 ring-white/8 shadow-[0_10px_24px_rgba(2,6,23,0.26)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/50 mb-2">You ({hand?.player_total ?? 0})</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(hand?.player_cards || []).map((card, i) => (
                  <div key={`p-${i}`} className="min-w-10 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.04))] px-3 py-2 text-center text-sm font-bold ring-1 ring-white/10 shadow-[0_8px_14px_rgba(2,6,23,0.24)]">{card}</div>
                ))}
              </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={hitBlackjack}
                  disabled={loading || !hand || hand.status !== 'active'}
                  className="py-2.5 rounded-xl bg-[linear-gradient(180deg,rgba(34,211,238,0.22),rgba(6,95,120,0.2))] text-cyan-50 text-sm font-bold ring-1 ring-cyan-300/35 shadow-[0_10px_18px_rgba(8,145,178,0.24)] transition-colors hover:bg-[linear-gradient(180deg,rgba(34,211,238,0.28),rgba(8,80,110,0.24))] disabled:opacity-40"
                >
                  Hit
                </button>
                <button
                  onClick={standBlackjack}
                  disabled={loading || !hand || hand.status !== 'active'}
                  className="py-2.5 rounded-xl bg-[linear-gradient(180deg,rgba(251,113,133,0.2),rgba(136,19,55,0.18))] text-rose-50 text-sm font-bold ring-1 ring-rose-300/35 shadow-[0_10px_18px_rgba(190,24,93,0.22)] transition-colors hover:bg-[linear-gradient(180deg,rgba(251,113,133,0.26),rgba(136,19,55,0.22))] disabled:opacity-40"
                >
                  Stand
                </button>
              </div>

              {hand?.status === 'complete' && (
                <p className="mt-3 text-sm text-white/80">
                  Result: <b className="uppercase">{hand.outcome}</b> • Payout: <b>{hand.payout}</b>
                </p>
              )}
            </div>
          )}

          {error && <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}
          {resultText && <div className="mt-3 text-sm text-emerald-300">{resultText}</div>}
        </section>
      </div>
    </div>
  );
}
