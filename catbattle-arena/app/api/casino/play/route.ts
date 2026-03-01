import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim();

const MAX_BET = 500;

type GameType = 'coinflip' | 'blackjack';
type BjOutcome = 'win' | 'lose' | 'push';

type BjHand = {
  id: string;
  user_id: string;
  bet: number;
  player_cards: number[];
  dealer_cards: number[];
  status: 'active' | 'complete';
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function drawCard(): number {
  const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
  return pick(deck);
}

function handValue(cards: number[]): number {
  let total = cards.reduce((a, b) => a + b, 0);
  let aces = cards.filter((c) => c === 11).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function payoutForResult(bet: number, outcome: BjOutcome, naturalBlackjack = false): { payout: number; delta: number } {
  if (outcome === 'lose') return { payout: 0, delta: 0 };
  if (outcome === 'push') return { payout: bet, delta: bet };
  const payout = naturalBlackjack ? Math.floor(bet * 2.5) : bet * 2;
  return { payout, delta: payout };
}

function revealDealer(dealerCards: number[], reveal: boolean): number[] {
  if (reveal) return dealerCards;
  if (dealerCards.length <= 1) return dealerCards;
  return [dealerCards[0], -1];
}

function formatHand(hand: BjHand, revealDealerCards: boolean, outcome?: BjOutcome, natural = false, payout = 0) {
  const playerTotal = handValue(hand.player_cards || []);
  const dealerTotal = handValue(hand.dealer_cards || []);
  return {
    hand_id: hand.id,
    status: hand.status,
    bet: hand.bet,
    player_cards: hand.player_cards,
    dealer_cards: revealDealer(hand.dealer_cards, revealDealerCards),
    player_total: playerTotal,
    dealer_total: revealDealerCards ? dealerTotal : null,
    outcome: outcome || null,
    natural_blackjack: natural,
    payout,
  };
}

export async function GET() {
  try {
    let guestId = '';
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: hand }, { data: progress }] = await Promise.all([
      supabase
        .from('casino_blackjack_hands')
        .select('id, user_id, bet, player_cards, dealer_cards, status')
        .eq('user_id', guestId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle(),
    ]);

    return NextResponse.json({
      ok: true,
      sigils: progress?.sigils || 0,
      active_hand: hand ? formatHand(hand as BjHand, false) : null,
      supported_games: ['blackjack', 'coinflip'],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let guestId = '';
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const game = String(body?.game || '') as GameType;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.rpc('bootstrap_user', { p_user_id: guestId });

    if (game === 'coinflip') {
      const bet = Number(body?.bet || 0);
      if (!Number.isFinite(bet) || bet < 1 || Math.floor(bet) !== bet || bet > MAX_BET) {
        return NextResponse.json({ ok: false, error: `Bet must be 1-${MAX_BET}` }, { status: 400 });
      }

      const { data: progress } = await supabase
        .from('user_progress')
        .select('sigils')
        .eq('user_id', guestId)
        .maybeSingle();

      const currentSigils = progress?.sigils || 0;
      if (currentSigils < bet) {
        return NextResponse.json({ ok: false, error: 'Not enough sigils', currentSigils }, { status: 400 });
      }

      const choice = body?.choice === 'tails' ? 'tails' : 'heads';
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === result;
      const payout = won ? Math.floor(bet * 1.95) : 0;
      const delta = payout - bet;
      const newSigils = currentSigils + delta;

      await supabase.from('user_progress').update({ sigils: newSigils }).eq('user_id', guestId);

      return NextResponse.json({
        ok: true,
        game,
        outcome: won ? 'win' : 'lose',
        bet,
        payout,
        delta,
        sigils: newSigils,
        detail: { choice, result },
      });
    }

    if (game !== 'blackjack') {
      return NextResponse.json({ ok: false, error: 'Invalid game' }, { status: 400 });
    }

    const action = String(body?.action || '').toLowerCase();

    if (action === 'start') {
      const bet = Number(body?.bet || 0);
      if (!Number.isFinite(bet) || bet < 1 || Math.floor(bet) !== bet || bet > MAX_BET) {
        return NextResponse.json({ ok: false, error: `Bet must be 1-${MAX_BET}` }, { status: 400 });
      }

      const [{ data: activeHand }, { data: progress }] = await Promise.all([
        supabase
          .from('casino_blackjack_hands')
          .select('id')
          .eq('user_id', guestId)
          .eq('status', 'active')
          .maybeSingle(),
        supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle(),
      ]);

      if (activeHand?.id) {
        return NextResponse.json({ ok: false, error: 'Finish your current hand first' }, { status: 409 });
      }

      const currentSigils = progress?.sigils || 0;
      if (currentSigils < bet) {
        return NextResponse.json({ ok: false, error: 'Not enough sigils', currentSigils }, { status: 400 });
      }

      await supabase.from('user_progress').update({ sigils: currentSigils - bet }).eq('user_id', guestId);

      const playerCards = [drawCard(), drawCard()];
      const dealerCards = [drawCard(), drawCard()];
      const natural = handValue(playerCards) === 21;

      const { data: inserted, error: insertErr } = await supabase
        .from('casino_blackjack_hands')
        .insert({
          user_id: guestId,
          bet,
          player_cards: playerCards,
          dealer_cards: dealerCards,
          status: natural ? 'complete' : 'active',
          outcome: natural ? 'win' : null,
          payout: null,
        })
        .select('id, user_id, bet, player_cards, dealer_cards, status')
        .single();

      if (insertErr || !inserted) {
        await supabase.from('user_progress').update({ sigils: currentSigils }).eq('user_id', guestId);
        return NextResponse.json({ ok: false, error: insertErr?.message || 'Failed to start hand' }, { status: 500 });
      }

      if (!natural) {
        return NextResponse.json({
          ok: true,
          game,
          action,
          sigils: currentSigils - bet,
          hand: formatHand(inserted as BjHand, false),
        });
      }

      const payoutData = payoutForResult(bet, 'win', true);
      const finalSigils = currentSigils - bet + payoutData.delta;
      await Promise.all([
        supabase.from('user_progress').update({ sigils: finalSigils }).eq('user_id', guestId),
        supabase
          .from('casino_blackjack_hands')
          .update({ payout: payoutData.payout, updated_at: new Date().toISOString() })
          .eq('id', inserted.id),
      ]);

      return NextResponse.json({
        ok: true,
        game,
        action,
        sigils: finalSigils,
        hand: formatHand(inserted as BjHand, true, 'win', true, payoutData.payout),
      });
    }

    const { data: activeHand } = await supabase
      .from('casino_blackjack_hands')
      .select('id, user_id, bet, player_cards, dealer_cards, status')
      .eq('user_id', guestId)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeHand) {
      return NextResponse.json({ ok: false, error: 'No active blackjack hand' }, { status: 404 });
    }

    const hand = activeHand as BjHand;

    if (action === 'hit') {
      const nextPlayerCards = [...(hand.player_cards || []), drawCard()];
      const playerTotal = handValue(nextPlayerCards);

      if (playerTotal > 21) {
        await supabase
          .from('casino_blackjack_hands')
          .update({
            player_cards: nextPlayerCards,
            status: 'complete',
            outcome: 'lose',
            payout: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', hand.id);

        const { data: progress } = await supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle();
        return NextResponse.json({
          ok: true,
          game,
          action,
          sigils: progress?.sigils || 0,
          hand: formatHand({ ...hand, player_cards: nextPlayerCards, status: 'complete' }, true, 'lose', false, 0),
        });
      }

      await supabase
        .from('casino_blackjack_hands')
        .update({ player_cards: nextPlayerCards, updated_at: new Date().toISOString() })
        .eq('id', hand.id);

      const { data: progress } = await supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle();
      return NextResponse.json({
        ok: true,
        game,
        action,
        sigils: progress?.sigils || 0,
        hand: formatHand({ ...hand, player_cards: nextPlayerCards }, false),
      });
    }

    if (action === 'stand') {
      const dealerCards = [...(hand.dealer_cards || [])];
      while (handValue(dealerCards) < 17) dealerCards.push(drawCard());

      const playerTotal = handValue(hand.player_cards || []);
      const dealerTotal = handValue(dealerCards);

      let outcome: BjOutcome = 'lose';
      if (dealerTotal > 21) outcome = 'win';
      else if (playerTotal > dealerTotal) outcome = 'win';
      else if (playerTotal === dealerTotal) outcome = 'push';

      const payoutData = payoutForResult(hand.bet, outcome, false);

      const { data: progress } = await supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle();
      const currentSigils = progress?.sigils || 0;
      const finalSigils = currentSigils + payoutData.delta;

      await Promise.all([
        supabase
          .from('casino_blackjack_hands')
          .update({
            dealer_cards: dealerCards,
            status: 'complete',
            outcome,
            payout: payoutData.payout,
            updated_at: new Date().toISOString(),
          })
          .eq('id', hand.id),
        supabase.from('user_progress').update({ sigils: finalSigils }).eq('user_id', guestId),
      ]);

      return NextResponse.json({
        ok: true,
        game,
        action,
        sigils: finalSigils,
        hand: formatHand({ ...hand, dealer_cards: dealerCards, status: 'complete' }, true, outcome, false, payoutData.payout),
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid blackjack action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
