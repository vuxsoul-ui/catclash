export type ArenaStats = {
  attack: number;
  defense: number;
  speed: number;
  charisma: number;
  chaos: number;
  rarity?: string;
  owner_level?: number;
};

export type ArenaAction = 'strike' | 'guard' | 'control' | 'burst' | 'heal' | 'bleed' | 'stun';
export type ArenaBehavior = 'aggressive' | 'defensive' | 'tactical' | 'chaotic' | 'turtle' | 'trickster';
export type ArenaStance = 'neutral' | 'aggro' | 'guard';
export type WeeklyModifierKey = 'speed_week' | 'chaos_week' | 'control_week' | 'shields_week';

export type ArenaFighter = {
  slot: 'a' | 'b';
  label: string;
  ai_behavior: ArenaBehavior;
  skill_priority: string[];
  stats: ArenaStats;
  passive?: 'first_guard_bonus' | 'first_burst_discount' | 'control_focus' | null;
};

export type ArenaRuntimeFighter = ArenaFighter & {
  hp: number;
  maxHp: number;
  energy: number;
  shield: number;
  control_debuff_turns: number;
  stunned_turns: number;
  bleed_turns: number;
  first_guard_used: boolean;
  first_burst_used: boolean;
  first_action_done: boolean;
  momentum: number;
  burst_discount_charged: boolean;
};

export type ArenaEvent = {
  turn_no: number;
  actor_slot: 'a' | 'b';
  action_type: string;
  value: number;
  payload: Record<string, unknown>;
};

export type ArenaResult = {
  turns: number;
  winner_slot: 'a' | 'b';
  final_hp_a: number;
  final_hp_b: number;
  events: ArenaEvent[];
};

export type ArenaBattleState = {
  turn: number;
  max_turns: number;
  seed: number;
  fighter_a: ArenaRuntimeFighter;
  fighter_b: ArenaRuntimeFighter;
  pending_player_action: ArenaAction | null;
  winner_slot: 'a' | 'b' | null;
  weekly_modifier: WeeklyModifierKey | null;
  player_stance: ArenaStance;
  npc_stance: ArenaStance;
  shield_wall_a_used?: boolean;
  shield_wall_b_used?: boolean;
};

const ENERGY_MAX = 6;
const ENERGY_START = 3;
const ENERGY_TURN_GAIN = 2;
const ENERGY_ON_HIT = 0;
const MAX_TURNS = 12;

const ENERGY_COST: Record<ArenaAction, number> = {
  strike: 2,
  guard: 1,
  control: 2,
  burst: 4,
  heal: 3,
  bleed: 3,
  stun: 3,
};

const ACTION_ADVANTAGE: Record<'strike' | 'guard' | 'control', 'strike' | 'guard' | 'control'> = {
  strike: 'control',
  control: 'guard',
  guard: 'strike',
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toAction(value: unknown): ArenaAction {
  const v = String(value || '').toLowerCase();
  if (v === 'guard' || v === 'control' || v === 'burst' || v === 'heal' || v === 'bleed' || v === 'stun') {
    return v;
  }
  return 'strike';
}

export function toStance(value: unknown): ArenaStance {
  const v = String(value || '').toLowerCase();
  if (v === 'aggro' || v === 'guard') return v;
  return 'neutral';
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function effectiveStat(value: number): number {
  const v = Math.max(0, Number(value || 0));
  if (v <= 60) return v;
  return 60 + (v - 60) * 0.85;
}

function rarityScale(rarity?: string): number {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary') return 1.08;
  if (r === 'epic') return 1.06;
  if (r === 'rare') return 1.04;
  if (r === 'mythic' || r === 'god-tier') return 1.08;
  return 1.03;
}

function buildPassive(rarity?: string, speed = 0, charisma = 0, chaos = 0): ArenaFighter['passive'] {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary' || r === 'mythic' || r === 'god-tier') return 'first_burst_discount';
  if (r === 'epic') return speed >= charisma ? 'control_focus' : 'first_guard_bonus';
  if (r === 'rare') return chaos >= speed ? 'first_guard_bonus' : 'control_focus';
  return null;
}

function resolveValue(stats: ArenaStats): number {
  return (effectiveStat(Number(stats.charisma || 0)) + effectiveStat(Number(stats.chaos || 0))) / 2;
}

function readInteraction(actionA: ArenaAction, actionB: ArenaAction): 1 | -1 | 0 {
  const a = actionA === 'burst' || actionA === 'heal' || actionA === 'bleed' || actionA === 'stun' ? 'strike' : actionA;
  const b = actionB === 'burst' || actionB === 'heal' || actionB === 'bleed' || actionB === 'stun' ? 'strike' : actionB;
  if (a === b) return 0;
  if (ACTION_ADVANTAGE[a] === b) return 1;
  if (ACTION_ADVANTAGE[b] === a) return -1;
  return 0;
}

function applyDamage(state: ArenaBattleState, target: ArenaRuntimeFighter, rawDamage: number): { hpLoss: number; shieldLoss: number } {
  let dmg = Math.max(0, Math.floor(rawDamage));

  const isA = target.slot === 'a';
  const shieldKey = isA ? 'shield_wall_a_used' : 'shield_wall_b_used';
  if (state.weekly_modifier === 'shields_week' && !state[shieldKey] && dmg >= 28) {
    dmg = Math.floor(dmg * 0.8);
    state[shieldKey] = true;
  }

  const shieldLoss = Math.min(target.shield, dmg);
  target.shield = clamp(target.shield - shieldLoss, 0, 999);
  const hpLoss = dmg - shieldLoss;
  target.hp = clamp(target.hp - hpLoss, 0, target.maxHp);
  return { hpLoss, shieldLoss };
}

function weightedInitiative(a: ArenaRuntimeFighter, b: ArenaRuntimeFighter, rand: () => number): Array<'a' | 'b'> {
  const aWeight = Math.max(1, effectiveStat(Number(a.stats.speed || 1)));
  const bWeight = Math.max(1, effectiveStat(Number(b.stats.speed || 1)));
  const roll = rand() * (aWeight + bWeight);
  return roll < aWeight ? ['a', 'b'] : ['b', 'a'];
}

function chooseNpcStance(actor: ArenaRuntimeFighter, opponent: ArenaRuntimeFighter): ArenaStance {
  const hpPct = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
  if (actor.ai_behavior === 'defensive' || actor.ai_behavior === 'turtle') return hpPct < 0.55 ? 'guard' : 'neutral';
  if (actor.ai_behavior === 'aggressive') return opponent.shield > 0 ? 'aggro' : 'neutral';
  if (actor.ai_behavior === 'tactical') return hpPct < 0.35 ? 'guard' : 'neutral';
  return hpPct < 0.4 ? 'guard' : 'aggro';
}

function stanceAttackMult(stance: ArenaStance): number {
  if (stance === 'aggro') return 1.1;
  if (stance === 'guard') return 0.9;
  return 1;
}

function stanceMitigationMult(stance: ArenaStance): number {
  if (stance === 'aggro') return 1.1;
  if (stance === 'guard') return 0.85;
  return 1;
}

function momentumProcBonus(actor: ArenaRuntimeFighter, state: ArenaBattleState): number {
  let bonus = actor.momentum >= 3 ? 0.05 : 0;
  if (state.weekly_modifier === 'chaos_week') bonus += 0.03;
  return Math.min(0.15, bonus);
}

function canUse(action: ArenaAction, actor: ArenaRuntimeFighter, state: ArenaBattleState): boolean {
  let cost = ENERGY_COST[action];
  if (action === 'burst' && actor.passive === 'first_burst_discount' && !actor.first_burst_used) {
    cost = Math.max(1, cost - 1);
  }
  if (action === 'burst' && actor.burst_discount_charged) {
    cost = Math.max(1, cost - 1);
  }
  if (action === 'control' && state.weekly_modifier === 'control_week' && !actor.first_action_done) {
    cost = Math.max(1, cost - 1);
  }
  return actor.energy >= cost;
}

function spendEnergy(action: ArenaAction, actor: ArenaRuntimeFighter, state: ArenaBattleState): number {
  let cost = ENERGY_COST[action];
  if (action === 'burst' && actor.passive === 'first_burst_discount' && !actor.first_burst_used) {
    cost = Math.max(1, cost - 1);
  }
  if (action === 'burst' && actor.burst_discount_charged) {
    cost = Math.max(1, cost - 1);
    actor.burst_discount_charged = false;
  }
  if (action === 'control' && state.weekly_modifier === 'control_week' && !actor.first_action_done) {
    cost = Math.max(1, cost - 1);
  }

  actor.energy = clamp(actor.energy - cost, 0, ENERGY_MAX);
  if (action === 'burst') actor.first_burst_used = true;
  return cost;
}

function chooseAiAction(actor: ArenaRuntimeFighter, opponent: ArenaRuntimeFighter, rand: () => number, state: ArenaBattleState): ArenaAction {
  const hpPct = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
  const oppShield = opponent.shield;

  const candidates: Array<{ action: ArenaAction; weight: number }> = [
    { action: 'strike', weight: 1 },
    { action: 'guard', weight: 1 },
    { action: 'control', weight: 1 },
    { action: 'burst', weight: 1 },
  ];

  const behavior = actor.ai_behavior === 'turtle'
    ? 'defensive'
    : actor.ai_behavior === 'trickster'
      ? 'chaotic'
      : actor.ai_behavior;

  if (behavior === 'aggressive') {
    candidates.find((c) => c.action === 'burst')!.weight += 1.8;
    candidates.find((c) => c.action === 'strike')!.weight += 1.2;
    candidates.find((c) => c.action === 'guard')!.weight -= 0.3;
  } else if (behavior === 'defensive') {
    candidates.find((c) => c.action === 'guard')!.weight += hpPct < 0.55 ? 2.0 : 1.0;
    candidates.find((c) => c.action === 'control')!.weight += 0.8;
    candidates.find((c) => c.action === 'burst')!.weight -= 0.2;
  } else if (behavior === 'tactical') {
    candidates.find((c) => c.action === 'control')!.weight += oppShield > 0 ? 1.0 : 0.7;
    candidates.find((c) => c.action === 'strike')!.weight += 0.7;
  } else {
    candidates.find((c) => c.action === 'burst')!.weight += 1.0;
    candidates.find((c) => c.action === 'control')!.weight += 0.9;
    candidates.find((c) => c.action === 'guard')!.weight += 0.4;
  }

  const priority = Array.isArray(actor.skill_priority) && actor.skill_priority.length > 0
    ? actor.skill_priority
    : ['strike', 'guard', 'control', 'burst'];

  for (let i = 0; i < priority.length; i += 1) {
    const p = toAction(priority[i]);
    const candidate = candidates.find((c) => c.action === p);
    if (candidate) candidate.weight += Math.max(0, (priority.length - i) * 0.25);
  }

  const usable = candidates.filter((c) => c.weight > 0 && canUse(c.action, actor, state));
  if (usable.length === 0) return 'strike';

  const total = usable.reduce((sum, c) => sum + c.weight, 0);
  let needle = rand() * total;
  for (const c of usable) {
    needle -= c.weight;
    if (needle <= 0) return c.action;
  }
  return usable[usable.length - 1].action;
}

function applyStatusTicks(actor: ArenaRuntimeFighter, turn: number, events: ArenaEvent[]) {
  if (actor.bleed_turns <= 0) return;
  const bleed = Math.max(2, Math.floor((effectiveStat(Number(actor.stats.attack || 0)) * 0.16) + 2));
  actor.hp = clamp(actor.hp - bleed, 0, actor.maxHp);
  actor.bleed_turns = Math.max(0, actor.bleed_turns - 1);
  events.push({
    turn_no: turn,
    actor_slot: actor.slot,
    action_type: 'bleed_tick',
    value: bleed,
    payload: {
      actor_hp: actor.hp,
      actor_energy: actor.energy,
      actor_shield: actor.shield,
      target_hp: null,
      target_shield: null,
      actor_momentum: actor.momentum,
    },
  });
}

function markMomentum(actor: ArenaRuntimeFighter, delta: number) {
  actor.momentum = clamp(actor.momentum + delta, 0, 6);
  if (actor.momentum >= 5 && !actor.burst_discount_charged) {
    actor.burst_discount_charged = true;
  }
}

function computeDamage(params: {
  action: ArenaAction;
  actor: ArenaRuntimeFighter;
  target: ArenaRuntimeFighter;
  state: ArenaBattleState;
  rand: () => number;
  effectMult: number;
  actorStance: ArenaStance;
  targetStance: ArenaStance;
}): number {
  const { action, actor, target, state, rand, effectMult, actorStance, targetStance } = params;
  const atk = effectiveStat(Number(actor.stats.attack || 0));
  const def = effectiveStat(Number(target.stats.defense || 0));
  const spd = effectiveStat(Number(actor.stats.speed || 0));
  const cha = effectiveStat(Number(actor.stats.charisma || 0));
  const chs = effectiveStat(Number(actor.stats.chaos || 0));
  const ratio = atk / Math.max(1, atk + def);
  const rarity = rarityScale(actor.stats.rarity);
  const stanceAtk = stanceAttackMult(actorStance);
  const stanceMit = stanceMitigationMult(targetStance);
  const procBonus = momentumProcBonus(actor, state);

  let k = 0;
  if (action === 'strike') k = 34 + spd * 0.12;
  else if (action === 'control') k = 28 + cha * 0.22;
  else if (action === 'burst') k = 42 + chs * 0.4;
  else if (action === 'bleed') k = 30 + chs * 0.18;
  else if (action === 'stun') k = 24 + spd * 0.2;

  let dmg = k * ratio;
  if (action === 'burst') {
    const chaosSwing = (rand() - 0.5) * Math.max(8, chs * 0.35);
    dmg += chaosSwing;
    if (rand() < procBonus) dmg *= 1.05;
  }

  dmg *= rarity;
  dmg *= stanceAtk;
  dmg *= stanceMit;
  dmg *= effectMult;

  return Math.max(5, Math.floor(dmg));
}

function resolveAction(args: {
  state: ArenaBattleState;
  actor: ArenaRuntimeFighter;
  target: ArenaRuntimeFighter;
  action: ArenaAction;
  enemyAction: ArenaAction;
  actorStance: ArenaStance;
  targetStance: ArenaStance;
  turn: number;
  rand: () => number;
  events: ArenaEvent[];
}) {
  const { state, actor, target, enemyAction, turn, rand, events, actorStance, targetStance } = args;
  let action = args.action;

  if (actor.stunned_turns > 0) {
    actor.stunned_turns -= 1;
    markMomentum(actor, -1);
    events.push({
      turn_no: turn,
      actor_slot: actor.slot,
      action_type: 'stunned',
      value: 0,
      payload: {
        actor_hp: actor.hp,
        actor_energy: actor.energy,
        actor_shield: actor.shield,
        target_hp: target.hp,
        target_shield: target.shield,
        actor_momentum: actor.momentum,
      },
    });
    return;
  }

  if (!canUse(action, actor, state)) {
    action = 'strike';
    if (!canUse(action, actor, state)) {
      markMomentum(actor, -1);
      events.push({
        turn_no: turn,
        actor_slot: actor.slot,
        action_type: 'exhausted',
        value: 0,
        payload: {
          actor_hp: actor.hp,
          actor_energy: actor.energy,
          actor_shield: actor.shield,
          target_hp: target.hp,
          target_shield: target.shield,
          actor_momentum: actor.momentum,
        },
      });
      return;
    }
  }

  const interaction = readInteraction(action, enemyAction);
  let effectMult = 1;
  if (interaction > 0) {
    effectMult *= 1.1;
    markMomentum(actor, 1);
    markMomentum(target, -1);
  } else if (interaction < 0) {
    effectMult *= 0.9;
    markMomentum(actor, -1);
  }

  const spent = spendEnergy(action, actor, state);
  const attack = effectiveStat(Number(actor.stats.attack || 0));
  const defense = effectiveStat(Number(actor.stats.defense || 0));
  const speed = effectiveStat(Number(actor.stats.speed || 0));
  const charisma = effectiveStat(Number(actor.stats.charisma || 0));
  const chaos = effectiveStat(Number(actor.stats.chaos || 0));
  const targetResolve = resolveValue(target.stats);
  const actorResolve = resolveValue(actor.stats);

  let amount = 0;

  if (action === 'guard') {
    amount = Math.max(6, Math.floor((defense * 0.26) * rarityScale(actor.stats.rarity) * effectMult));
    if (actor.passive === 'first_guard_bonus' && !actor.first_guard_used) {
      amount += Math.max(3, Math.floor(defense * 0.08));
    }
    actor.first_guard_used = true;
    actor.shield = clamp(actor.shield + amount, 0, Math.floor(actor.maxHp * 0.7));
  } else if (action === 'control') {
    const base = computeDamage({ action, actor, target, state, rand, effectMult, actorStance, targetStance });
    const hit = applyDamage(state, target, base);
    amount = hit.hpLoss + hit.shieldLoss;

    let successChance = 0.26 + ((charisma - targetResolve) * 0.0045) + momentumProcBonus(actor, state);
    if (actor.passive === 'control_focus') successChance += 0.05;
    successChance = clamp(successChance, 0.12, 0.62);

    if (rand() < successChance) {
      target.control_debuff_turns = Math.max(target.control_debuff_turns, 1);
      if (rand() < clamp(0.08 + ((charisma + chaos) - targetResolve) * 0.003, 0.05, 0.28)) {
        target.stunned_turns = Math.max(target.stunned_turns, 1);
      }
    }
  } else if (action === 'burst') {
    const base = computeDamage({ action, actor, target, state, rand, effectMult, actorStance, targetStance });
    const hit = applyDamage(state, target, base);
    amount = hit.hpLoss + hit.shieldLoss;
  } else if (action === 'heal') {
    amount = Math.max(8, Math.floor((charisma * 0.24 + defense * 0.15 + actorResolve * 0.06) * rarityScale(actor.stats.rarity) * effectMult));
    actor.hp = clamp(actor.hp + amount, 0, actor.maxHp);
  } else if (action === 'bleed') {
    const base = computeDamage({ action, actor, target, state, rand, effectMult, actorStance, targetStance });
    const hit = applyDamage(state, target, base);
    amount = hit.hpLoss + hit.shieldLoss;
    target.bleed_turns = Math.max(target.bleed_turns, 2);
  } else if (action === 'stun') {
    const base = computeDamage({ action, actor, target, state, rand, effectMult, actorStance, targetStance });
    const hit = applyDamage(state, target, base);
    amount = hit.hpLoss + hit.shieldLoss;
    const chance = clamp(0.14 + ((speed - effectiveStat(Number(target.stats.speed || 0))) * 0.0045) + momentumProcBonus(actor, state), 0.08, 0.38);
    if (rand() < chance) target.stunned_turns = Math.max(target.stunned_turns, 1);
  } else {
    const base = computeDamage({ action, actor, target, state, rand, effectMult, actorStance, targetStance });
    const hit = applyDamage(state, target, base);
    amount = hit.hpLoss + hit.shieldLoss;
  }

  if (amount > 0 && action !== 'guard' && action !== 'heal') {
    markMomentum(actor, 1);
  }

  events.push({
    turn_no: turn,
    actor_slot: actor.slot,
    action_type: action,
    value: amount,
    payload: {
      actor_hp: actor.hp,
      actor_energy: actor.energy,
      actor_shield: actor.shield,
      target_hp: target.hp,
      target_shield: target.shield,
      actor_momentum: actor.momentum,
      target_momentum: target.momentum,
      actor_stance: actorStance,
      target_stance: targetStance,
      energy_spent: spent,
      enemy_action: enemyAction,
      interaction,
      interaction_message: interaction > 0 ? `${action} broke ${enemyAction}` : interaction < 0 ? `${enemyAction} countered ${action}` : null,
    },
  });

  actor.first_action_done = true;

  if (target.control_debuff_turns > 0) {
    target.control_debuff_turns = Math.max(0, target.control_debuff_turns - 1);
  }
}

export function buildRuntimeFighter(input: ArenaFighter): ArenaRuntimeFighter {
  const maxHp = Math.max(1, Math.floor(effectiveStat(Number(input.stats.defense || 0)) * 10));
  return {
    ...input,
    passive: input.passive || buildPassive(input.stats.rarity, input.stats.speed, input.stats.charisma, input.stats.chaos),
    hp: maxHp,
    maxHp,
    energy: ENERGY_START,
    shield: 0,
    control_debuff_turns: 0,
    stunned_turns: 0,
    bleed_turns: 0,
    first_guard_used: false,
    first_burst_used: false,
    first_action_done: false,
    momentum: 0,
    burst_discount_charged: false,
  };
}

export function createBattleState(input: { fighterA: ArenaFighter; fighterB: ArenaFighter; seed?: number; weeklyModifier?: WeeklyModifierKey | null }): ArenaBattleState {
  return {
    turn: 0,
    max_turns: MAX_TURNS,
    seed: Number(input.seed || Date.now()) % 1_000_000_000,
    fighter_a: buildRuntimeFighter({ ...input.fighterA, slot: 'a' }),
    fighter_b: buildRuntimeFighter({ ...input.fighterB, slot: 'b' }),
    pending_player_action: null,
    winner_slot: null,
    weekly_modifier: input.weeklyModifier || null,
    player_stance: 'neutral',
    npc_stance: 'neutral',
    shield_wall_a_used: false,
    shield_wall_b_used: false,
  };
}

function decideWinner(state: ArenaBattleState, rand: () => number): 'a' | 'b' {
  if (state.fighter_a.hp !== state.fighter_b.hp) {
    return state.fighter_a.hp > state.fighter_b.hp ? 'a' : 'b';
  }
  const aChaos = Number(state.fighter_a.stats.chaos || 0);
  const bChaos = Number(state.fighter_b.stats.chaos || 0);
  if (aChaos !== bChaos) {
    return aChaos > bChaos ? 'a' : 'b';
  }
  return rand() < 0.5 ? 'a' : 'b';
}

export function runBattleTurn(input: {
  state: ArenaBattleState;
  playerAction: ArenaAction;
  playerStance?: ArenaStance;
  seedOffset?: number;
}): { state: ArenaBattleState; events: ArenaEvent[]; done: boolean; winner_slot: 'a' | 'b' | null } {
  const state: ArenaBattleState = JSON.parse(JSON.stringify(input.state));
  if (state.winner_slot) {
    return { state, events: [], done: true, winner_slot: state.winner_slot };
  }

  const rand = mulberry32((state.seed + Number(input.seedOffset || state.turn + 1)) % 1_000_000_000);
  const events: ArenaEvent[] = [];

  state.turn += 1;
  state.fighter_a.energy = clamp(state.fighter_a.energy + ENERGY_TURN_GAIN, 0, ENERGY_MAX);
  state.fighter_b.energy = clamp(state.fighter_b.energy + ENERGY_TURN_GAIN, 0, ENERGY_MAX);

  const playerStance = toStance(input.playerStance || state.player_stance || 'neutral');
  const npcStance = chooseNpcStance(state.fighter_b, state.fighter_a);
  state.player_stance = playerStance;
  state.npc_stance = npcStance;

  applyStatusTicks(state.fighter_a, state.turn, events);
  applyStatusTicks(state.fighter_b, state.turn, events);

  if (state.fighter_a.hp <= 0 || state.fighter_b.hp <= 0) {
    state.winner_slot = decideWinner(state, rand);
    return { state, events, done: true, winner_slot: state.winner_slot };
  }

  if (state.weekly_modifier === 'speed_week' && state.turn === 1) {
    if (effectiveStat(Number(state.fighter_a.stats.speed || 0)) > effectiveStat(Number(state.fighter_b.stats.speed || 0))) {
      markMomentum(state.fighter_a, 1);
    } else if (effectiveStat(Number(state.fighter_b.stats.speed || 0)) > effectiveStat(Number(state.fighter_a.stats.speed || 0))) {
      markMomentum(state.fighter_b, 1);
    }
  }

  const npcAction = chooseAiAction(state.fighter_b, state.fighter_a, rand, state);
  const playerAction = toAction(input.playerAction);
  const order = weightedInitiative(state.fighter_a, state.fighter_b, rand);

  for (const slot of order) {
    const actor = slot === 'a' ? state.fighter_a : state.fighter_b;
    const target = slot === 'a' ? state.fighter_b : state.fighter_a;
    const action = slot === 'a' ? playerAction : npcAction;
    const enemyAction = slot === 'a' ? npcAction : playerAction;
    const actorStance = slot === 'a' ? playerStance : npcStance;
    const targetStance = slot === 'a' ? npcStance : playerStance;
    resolveAction({ state, actor, target, action, enemyAction, actorStance, targetStance, turn: state.turn, rand, events });
    if (target.hp > 0) {
      target.energy = clamp(target.energy + ENERGY_ON_HIT, 0, ENERGY_MAX);
    }
    if (state.fighter_a.hp <= 0 || state.fighter_b.hp <= 0) break;
  }

  const done = state.fighter_a.hp <= 0 || state.fighter_b.hp <= 0 || state.turn >= state.max_turns;
  if (done) {
    state.winner_slot = decideWinner(state, rand);
  }

  return { state, events, done, winner_slot: state.winner_slot };
}

export function simulateArenaBattle(input: {
  fighterA: ArenaFighter;
  fighterB: ArenaFighter;
  seed?: number;
  weeklyModifier?: WeeklyModifierKey | null;
}): ArenaResult {
  let state = createBattleState(input);
  const rand = mulberry32(state.seed);
  const events: ArenaEvent[] = [];

  for (let i = 0; i < MAX_TURNS; i += 1) {
    const playerAuto = chooseAiAction(state.fighter_a, state.fighter_b, rand, state);
    const round = runBattleTurn({ state, playerAction: playerAuto, playerStance: 'neutral', seedOffset: i + 1 });
    state = round.state;
    events.push(...round.events);
    if (round.done) break;
  }

  const winner = state.winner_slot || decideWinner(state, rand);
  return {
    turns: state.turn,
    winner_slot: winner,
    final_hp_a: state.fighter_a.hp,
    final_hp_b: state.fighter_b.hp,
    events,
  };
}

export function ratingTier(rating: number): string {
  if (rating >= 1700) return 'mythic';
  if (rating >= 1450) return 'platinum';
  if (rating >= 1250) return 'gold';
  if (rating >= 1100) return 'silver';
  return 'bronze';
}

export function xpForBattle(win: boolean): number {
  return win ? 100 : 50;
}

export function actionCost(action: ArenaAction): number {
  return ENERGY_COST[action];
}

export const ARENA_CONFIG = {
  energyMax: ENERGY_MAX,
  energyStart: ENERGY_START,
  energyTurnGain: ENERGY_TURN_GAIN,
  maxTurns: MAX_TURNS,
};
