import {
  normalizeCosmeticSlot,
  normalizeEquippedSlot,
  slotCandidatesForNormalizedSlot,
  type CosmeticLike,
} from '../../../_lib/cosmetics/effectsRegistry';

export function normalizeCategoryForCatalog(category: string): string {
  const c = String(category || '').toLowerCase();
  if (c === 'title') return 'cat_title';
  if (c === 'border') return 'cat_border';
  if (c === 'color') return 'cat_color';
  if (c === 'xp') return 'xp_boost';
  if (c === 'effect') return 'vote_effect';
  return c;
}

export function normalizeSlotForApi(slot: string): 'title' | 'border' | 'color' | 'vote_effect' | 'voter_badge' {
  const normalized = normalizeEquippedSlot(slot);
  if (normalized === 'vote_effect') return 'vote_effect';
  if (normalized === 'badge') return 'voter_badge';
  if (normalized === 'xp') return 'color';
  if (normalized === 'theme') return 'color';
  return normalized;
}

export function slotCandidatesForCosmetic(cosmetic: CosmeticLike): string[] {
  const slot = normalizeCosmeticSlot(cosmetic);
  return slotCandidatesForNormalizedSlot(slot);
}
