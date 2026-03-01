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
    <div className="min-h-screen bg-black text-white px-4 py-5 sm:py-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Sigil Casino</h1>
            <p className="text-white/50 text-sm">Blackjack is now real hit/stand. Slots removed.</p>
          </div>
          <SigilBalanceChip balance={sigils} size="sm" className="whitespace-nowrap" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setGame('blackjack')} className={`px-3 py-2 rounded-lg text-sm ${game === 'blackjack' ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/80'}`}>
            <Club className="w-4 h-4 inline mr-1" /> Blackjack
          </button>
          <button onClick={() => setGame('coinflip')} className={`px-3 py-2 rounded-lg text-sm ${game === 'coinflip' ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/80'}`}>
            <Coins className="w-4 h-4 inline mr-1" /> Coinflip
          </button>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/40">Bet</span>
              <input
                type="number"
                min={1}
                max={500}
                value={bet}
                onChange={(e) => setBet(Math.max(1, Math.min(500, Number(e.target.value || 1))))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              />
            </label>

            {game === 'coinflip' && (
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/40">Pick Side</span>
                <select value={choice} onChange={(e) => setChoice((e.target.value as 'heads' | 'tails') || 'heads')}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <option value="heads">Heads</option>
                  <option value="tails">Tails</option>
                </select>
              </label>
            )}

            {game === 'coinflip' ? (
              <button onClick={playCoinflip} disabled={loading || bet > sigils}
                className="h-10 px-4 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold disabled:opacity-40">
                {loading ? 'Playing...' : 'Play Coinflip'}
              </button>
            ) : (
              <button onClick={startBlackjack} disabled={loading || bet > sigils || !canStartBlackjack}
                className="h-10 px-4 rounded-lg bg-gradient-to-r from-yellow-300 to-amber-500 text-black font-bold disabled:opacity-40">
                {loading ? 'Starting...' : canStartBlackjack ? 'Start Hand' : 'Hand Active'}
              </button>
            )}
          </div>

          {game === 'blackjack' && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs text-white/50 mb-2">Dealer</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(hand?.dealer_cards || []).map((card, i) => (
                  <div key={`d-${i}`} className="px-3 py-2 rounded-lg bg-white/10 text-sm font-bold min-w-10 text-center">
                    {card === -1 ? '?' : card}
                  </div>
                ))}
                {!hand && <p className="text-white/30 text-sm">No active hand</p>}
              </div>

              <p className="text-xs text-white/50 mb-2">You ({hand?.player_total ?? 0})</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(hand?.player_cards || []).map((card, i) => (
                  <div key={`p-${i}`} className="px-3 py-2 rounded-lg bg-white/15 text-sm font-bold min-w-10 text-center">{card}</div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={hitBlackjack}
                  disabled={loading || !hand || hand.status !== 'active'}
                  className="py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-bold disabled:opacity-40"
                >
                  Hit
                </button>
                <button
                  onClick={standBlackjack}
                  disabled={loading || !hand || hand.status !== 'active'}
                  className="py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-bold disabled:opacity-40"
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
