export type EffectKey = string;
export type Slot = 'border' | 'title' | 'theme' | 'vote_effect' | 'badge' | 'xp';
export type PerfCost = 'low' | 'med' | 'high';
export type MotionKind = 'static' | 'loop' | 'burst';

export type CosmeticLike = {
  slug?: string | null;
  name?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CosmeticEffectDefinition = {
  key: EffectKey;
  id: EffectKey;
  slot: Slot;
  isImplemented: boolean;
  previewComponent: 'BorderPreview' | 'TitlePreview' | 'ThemePreview' | 'VoteEffectPreview' | 'BadgePreview' | 'XpPreview';
  apply: { className?: string };
  preview?: { className?: string };
  tokens?: { hue?: number; intensity?: number };
  perf: PerfCost;
  motion: MotionKind;
  description: string;
  textClassName?: string;
  badgeClassName?: string;
};

const EFFECTS: Record<EffectKey, CosmeticEffectDefinition> = {
  unimplemented: {
    key: 'unimplemented',
    id: 'unimplemented',
    slot: 'title',
    isImplemented: false,
    previewComponent: 'TitlePreview',
    apply: {},
    perf: 'low',
    motion: 'static',
    description: 'Preview coming soon',
    textClassName: 'text-white/55',
  },

  border_neon_cyan: {
    key: 'border_neon_cyan', id: 'border_neon_cyan', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-neon-cyan' }, preview: { className: 'cosm-border-neon-cyan' },
    perf: 'low', motion: 'loop', description: 'Neon cyan pulse frame', tokens: { hue: 190, intensity: 50 },
  },
  border_flame: {
    key: 'border_flame', id: 'border_flame', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'fx-border-flame' }, preview: { className: 'fx-border-flame' },
    perf: 'low', motion: 'loop', description: 'Animated ember edge', tokens: { hue: 22, intensity: 70 },
  },
  border_lightning: {
    key: 'border_lightning', id: 'border_lightning', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'fx-border-lightning' }, preview: { className: 'fx-border-lightning' },
    perf: 'med', motion: 'loop', description: 'Electric arc trim', tokens: { hue: 205, intensity: 75 },
  },
  border_solarflare: {
    key: 'border_solarflare', id: 'border_solarflare', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-solarflare' }, preview: { className: 'cosm-border-solarflare' },
    perf: 'med', motion: 'loop', description: 'Molten trim shimmer', tokens: { hue: 32, intensity: 85 },
  },
  border_galaxy: {
    key: 'border_galaxy', id: 'border_galaxy', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-galaxy' }, preview: { className: 'cosm-border-galaxy' },
    perf: 'med', motion: 'loop', description: 'Starfield shimmer', tokens: { hue: 256, intensity: 55 },
  },
  border_shadow: {
    key: 'border_shadow', id: 'border_shadow', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'fx-border-shadow' }, preview: { className: 'fx-border-shadow' },
    perf: 'med', motion: 'loop', description: 'Smoky void shimmer', tokens: { hue: 266, intensity: 58 },
  },
  border_void: {
    key: 'border_void', id: 'border_void', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-void' }, preview: { className: 'cosm-border-void' },
    perf: 'med', motion: 'loop', description: 'Void particle drift', tokens: { hue: 266, intensity: 58 },
  },
  border_prism: {
    key: 'border_prism', id: 'border_prism', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-prism' }, preview: { className: 'cosm-border-prism' },
    perf: 'med', motion: 'loop', description: 'Prismatic highlight frame', tokens: { hue: 240, intensity: 64 },
  },
  border_holographic: {
    key: 'border_holographic', id: 'border_holographic', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-holographic' }, preview: { className: 'cosm-border-holographic' },
    perf: 'med', motion: 'loop', description: 'Iridescent holographic shimmer', tokens: { hue: 188, intensity: 78 },
  },
  border_obsidian: {
    key: 'border_obsidian', id: 'border_obsidian', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'fx-border-obsidian' }, preview: { className: 'fx-border-obsidian' },
    perf: 'low', motion: 'static', description: 'Obsidian edge trim', tokens: { hue: 0, intensity: 20 },
  },
  border_royal_violet: {
    key: 'border_royal_violet', id: 'border_royal_violet', slot: 'border', isImplemented: true,
    previewComponent: 'BorderPreview', apply: { className: 'cosm-border-royal-violet' }, preview: { className: 'cosm-border-royal-violet' },
    perf: 'med', motion: 'loop', description: 'Royal violet aura', tokens: { hue: 286, intensity: 60 },
  },

  title_rookie: {
    key: 'title_rookie', id: 'title_rookie', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-rookie' }, perf: 'low', motion: 'static', description: 'Starter arena title', textClassName: 'cosm-title-rookie',
  },
  title_clutch: {
    key: 'title_clutch', id: 'title_clutch', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-clutch' }, perf: 'low', motion: 'static', description: 'Clutch voter title', textClassName: 'cosm-title-clutch',
  },
  title_sigil: {
    key: 'title_sigil', id: 'title_sigil', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-sigil' }, perf: 'low', motion: 'loop', description: 'Sigil whisperer aura', textClassName: 'cosm-title-sigil',
  },
  title_meme_lord: {
    key: 'title_meme_lord', id: 'title_meme_lord', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-meme-lord' }, perf: 'low', motion: 'loop', description: 'Gradient title with star icon', textClassName: 'cosm-title-meme-lord',
  },
  title_absolute_unit: {
    key: 'title_absolute_unit', id: 'title_absolute_unit', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-absolute-unit' }, perf: 'low', motion: 'static', description: 'Heavy embossed flex title', textClassName: 'cosm-title-absolute-unit',
  },
  title_instafamous: {
    key: 'title_instafamous', id: 'title_instafamous', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-instafamous' }, perf: 'med', motion: 'loop', description: 'Neon flash title', textClassName: 'cosm-title-instafamous',
  },
  title_ember_emperor: {
    key: 'title_ember_emperor', id: 'title_ember_emperor', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-ember-emperor' }, perf: 'med', motion: 'loop', description: 'Ember emperor flicker title', textClassName: 'cosm-title-ember-emperor',
  },
  title_midnight: {
    key: 'title_midnight', id: 'title_midnight', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-midnight' }, perf: 'low', motion: 'static', description: 'Midnight hunter title', textClassName: 'cosm-title-midnight',
  },
  title_apex: {
    key: 'title_apex', id: 'title_apex', slot: 'title', isImplemented: true,
    previewComponent: 'TitlePreview', apply: { className: 'cosm-title-apex' }, perf: 'med', motion: 'loop', description: 'Apex overlord title', textClassName: 'cosm-title-apex',
  },

  badge_default: {
    key: 'badge_default', id: 'badge_default', slot: 'badge', isImplemented: true,
    previewComponent: 'BadgePreview', apply: { className: 'cosm-badge-default' }, perf: 'low', motion: 'static', description: 'Standard badge style', badgeClassName: 'cosm-badge-default',
  },
  badge_underdog: {
    key: 'badge_underdog', id: 'badge_underdog', slot: 'badge', isImplemented: true,
    previewComponent: 'BadgePreview', apply: { className: 'cosm-badge-underdog' }, perf: 'low', motion: 'static', description: 'Underdog backer badge', badgeClassName: 'cosm-badge-underdog',
  },

  theme_default: {
    key: 'theme_default', id: 'theme_default', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-default' }, perf: 'low', motion: 'static', description: 'Default card theme', textClassName: 'cosm-text-default',
  },
  theme_solar: {
    key: 'theme_solar', id: 'theme_solar', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-solar' }, perf: 'low', motion: 'static', description: 'Solar flare theme', textClassName: 'cosm-text-solar',
  },
  theme_lunar: {
    key: 'theme_lunar', id: 'theme_lunar', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-lunar' }, perf: 'low', motion: 'static', description: 'Lunar ice theme', textClassName: 'cosm-text-lunar',
  },
  theme_neon_lime: {
    key: 'theme_neon_lime', id: 'theme_neon_lime', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-neon-lime' }, perf: 'low', motion: 'static', description: 'Neon lime theme', textClassName: 'cosm-text-neon-lime',
  },
  theme_rose_gold: {
    key: 'theme_rose_gold', id: 'theme_rose_gold', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-rose-gold' }, perf: 'low', motion: 'static', description: 'Rose-gold theme', textClassName: 'cosm-text-rose-gold',
  },
  theme_deep_space: {
    key: 'theme_deep_space', id: 'theme_deep_space', slot: 'theme', isImplemented: true,
    previewComponent: 'ThemePreview', apply: { className: 'cosm-theme-deep-space' }, perf: 'low', motion: 'loop', description: 'Deep-space aura theme', textClassName: 'cosm-text-deep-space',
  },

  vote_default: {
    key: 'vote_default', id: 'vote_default', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-default' }, perf: 'low', motion: 'burst', description: 'Vote pulse',
  },
  vote_ember_burst: {
    key: 'vote_ember_burst', id: 'vote_ember_burst', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-ember-burst' }, perf: 'low', motion: 'burst', description: 'Ember particle burst',
  },
  vote_comet: {
    key: 'vote_comet', id: 'vote_comet', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-comet' }, perf: 'low', motion: 'burst', description: 'Comet trail vote FX',
  },
  vote_crown: {
    key: 'vote_crown', id: 'vote_crown', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-crown' }, perf: 'low', motion: 'burst', description: 'Crown flash vote FX',
  },
  vote_arc: {
    key: 'vote_arc', id: 'vote_arc', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-arc' }, perf: 'low', motion: 'burst', description: 'Arc light vote FX',
  },
  vote_stardust: {
    key: 'vote_stardust', id: 'vote_stardust', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-stardust' }, perf: 'low', motion: 'burst', description: 'Stardust pop vote FX',
  },
  vote_lightning_strike: {
    key: 'vote_lightning_strike', id: 'vote_lightning_strike', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-lightning' }, perf: 'med', motion: 'burst', description: 'Lightning strike vote FX',
  },
  vote_aurora: {
    key: 'vote_aurora', id: 'vote_aurora', slot: 'vote_effect', isImplemented: true,
    previewComponent: 'VoteEffectPreview', apply: { className: 'cosm-vote-aurora' }, perf: 'med', motion: 'burst', description: 'Aurora pulse vote FX',
  },

  xp_pack: {
    key: 'xp_pack', id: 'xp_pack', slot: 'xp', isImplemented: true,
    previewComponent: 'XpPreview', apply: {}, perf: 'low', motion: 'static', description: 'XP boost item',
  },
};

const EFFECT_ID_BY_SLUG: Record<string, EffectKey> = {
  'border-neon-cyan': 'border_neon_cyan',
  'border-flame': 'border_flame',
  'border-lightning': 'border_lightning',
  'border-thunder': 'border_lightning',
  'border-solarflare': 'border_solarflare',
  'border-ember-gold': 'border_flame',
  'border-galaxy': 'border_galaxy',
  'border-prism-shift': 'border_prism',
  'border-prism': 'border_prism',
  'border-holographic': 'border_holographic',
  'holographic-border': 'border_holographic',
  'border-holo': 'border_holographic',
  'border-shadow': 'border_shadow',
  'border-shadow-drift': 'border_shadow',
  'border-shadow-veil': 'border_shadow',
  'border-void-drift': 'border_void',
  'border-obsidian': 'border_obsidian',
  'border-royal-violet': 'border_royal_violet',

  'title-arena-rookie': 'title_rookie',
  'title-clutch-voter': 'title_clutch',
  'title-sigil-whisperer': 'title_sigil',
  'title-meme-lord': 'title_meme_lord',
  'title-instafamous': 'title_instafamous',
  'title-ember-emperor': 'title_ember_emperor',
  'title-midnight-hunter': 'title_midnight',
  'title-absolute-unit': 'title_absolute_unit',
  'title-apex-overlord': 'title_apex',

  'badge-underdog-picker': 'badge_underdog',
  'badge-underdog-backer': 'badge_underdog',
  'badge-first-100': 'badge_default',
  'badge-prediction-pro': 'badge_default',

  'color-solar-flare': 'theme_solar',
  'color-lunar-ice': 'theme_lunar',
  'color-neon-lime': 'theme_neon_lime',
  'color-rose-gold': 'theme_rose_gold',
  'color-deep-space': 'theme_deep_space',

  'vote-ember-burst': 'vote_ember_burst',
  'vote-comet-trail': 'vote_comet',
  'vote-crown-flash': 'vote_crown',
  'vote-arc-light': 'vote_arc',
  'vote-stardust-pop': 'vote_stardust',
  'vote-lightning-strike': 'vote_lightning_strike',
  'vote-aurora': 'vote_aurora',

  'xp-quick-50': 'xp_pack',
  'xp-burst-150': 'xp_pack',
  'xp-surge-300': 'xp_pack',
};

export function normalizeCosmeticSlot(cosmetic: CosmeticLike): Slot {
  const slug = String(cosmetic.slug || '').toLowerCase();
  const category = String(cosmetic.category || '').toLowerCase();
  const cosmeticType = String(cosmetic.metadata?.cosmetic_type || '').toLowerCase();

  if (slug.startsWith('vote-') || category === 'vote_effect' || category === 'effect' || cosmeticType === 'vote_effect') return 'vote_effect';
  if (slug.startsWith('badge-') || category === 'voter_badge' || category === 'badge' || cosmeticType === 'voter_badge') return 'badge';
  if (category === 'cat_border' || category === 'border' || category === 'frame' || category === 'cat_frame') return 'border';
  if (category === 'cat_color' || category === 'color' || category === 'background') return 'theme';
  if (category === 'cat_title' || category === 'title') return 'title';
  if (category === 'xp' || category === 'xp_boost') return 'xp';
  return 'title';
}

export function normalizeEquippedSlot(slot: string): Slot {
  const s = String(slot || '').toLowerCase();
  if (s === 'title' || s === 'cat_title') return 'title';
  if (s === 'badge' || s === 'voter_badge') return 'badge';
  if (s === 'border' || s === 'cat_border' || s === 'frame') return 'border';
  if (s === 'vote_effect' || s === 'effect') return 'vote_effect';
  if (s === 'color' || s === 'cat_color') return 'theme';
  return 'theme';
}

export function slotCandidatesForNormalizedSlot(slot: Slot): string[] {
  if (slot === 'title') return ['title', 'cat_title'];
  if (slot === 'badge') return ['badge', 'voter_badge', 'title', 'cat_title'];
  if (slot === 'border') return ['border', 'cat_border', 'frame'];
  if (slot === 'vote_effect') return ['vote_effect', 'effect', 'color', 'cat_color'];
  if (slot === 'theme') return ['color', 'cat_color'];
  return [];
}

export function resolveEffectKey(cosmetic: CosmeticLike): EffectKey {
  const slot = normalizeCosmeticSlot(cosmetic);
  const metadataEffectKey = String(cosmetic.metadata?.effect_key || '').toLowerCase();
  if (metadataEffectKey) {
    const normalized = metadataEffectKey
      .replace(/^fx-/, '')
      .replace(/-/g, '_')
      .replace(/^border_/, 'border_')
      .replace(/^title_/, 'title_')
      .replace(/^theme_/, 'theme_')
      .replace(/^vote_/, 'vote_');
    const aliases: Record<string, EffectKey> = {
      border_flame: 'border_flame',
      flame_border: 'border_flame',
      border_lightning: 'border_lightning',
      lightning_border: 'border_lightning',
      border_shadow: 'border_shadow',
      shadow_border: 'border_shadow',
      border_obsidian: 'border_obsidian',
      obsidian_border: 'border_obsidian',
    };
    if (EFFECTS[normalized]) return normalized;
    if (aliases[normalized]) return aliases[normalized];
  }

  const slug = String(cosmetic.slug || '').toLowerCase();
  if (slug && EFFECT_ID_BY_SLUG[slug]) return EFFECT_ID_BY_SLUG[slug];
  const metadataEffect = String(cosmetic.metadata?.effect || '').toLowerCase();
  if (slot === 'vote_effect') {
    if (slug.includes('lightning') || slug.includes('thunder') || metadataEffect.includes('lightning')) return 'vote_lightning_strike';
    if (slug.includes('ember') || slug.includes('flame') || metadataEffect.includes('ember')) return 'vote_ember_burst';
    if (slug.includes('comet') || metadataEffect.includes('comet')) return 'vote_comet';
    if (slug.includes('crown') || metadataEffect.includes('crown')) return 'vote_crown';
    if (slug.includes('arc') || metadataEffect.includes('arc')) return 'vote_arc';
    if (slug.includes('star') || metadataEffect.includes('stardust')) return 'vote_stardust';
    if (slug.includes('aurora') || metadataEffect.includes('aurora')) return 'vote_aurora';
    return 'vote_default';
  }
  const metadataColor = String(cosmetic.metadata?.color || '').toLowerCase();
  if (slot === 'theme') {
    if (slug.includes('solar') || metadataColor.includes('solar')) return 'theme_solar';
    if (slug.includes('lunar') || metadataColor.includes('lunar')) return 'theme_lunar';
    if (slug.includes('lime') || metadataColor.includes('lime')) return 'theme_neon_lime';
    if (slug.includes('rose') || metadataColor.includes('rose')) return 'theme_rose_gold';
    if (slug.includes('space') || slug.includes('galaxy') || metadataColor.includes('space')) return 'theme_deep_space';
    return 'theme_default';
  }
  if (slot === 'badge') {
    if (slug.includes('underdog')) return 'badge_underdog';
    return 'badge_default';
  }
  if (slot === 'title') {
    if (slug.includes('clutch')) return 'title_clutch';
    if (slug.includes('sigil')) return 'title_sigil';
    if (slug.includes('meme')) return 'title_meme_lord';
    if (slug.includes('insta')) return 'title_instafamous';
    if (slug.includes('ember')) return 'title_ember_emperor';
    if (slug.includes('midnight')) return 'title_midnight';
    if (slug.includes('apex')) return 'title_apex';
    if (slug.includes('absolute')) return 'title_absolute_unit';
    return 'title_rookie';
  }
  if (slot === 'border') {
    if (slug.includes('holo')) return 'border_holographic';
    if (slug.includes('lightning') || slug.includes('thunder')) return 'border_lightning';
    if (slug.includes('flame') || slug.includes('ember')) return 'border_flame';
    if (slug.includes('solar')) return 'border_solarflare';
    if (slug.includes('prism')) return 'border_prism';
    if (slug.includes('galaxy')) return 'border_galaxy';
    if (slug.includes('shadow')) return 'border_shadow';
    if (slug.includes('void')) return 'border_void';
    if (slug.includes('obsidian')) return 'border_obsidian';
    if (slug.includes('violet')) return 'border_royal_violet';
    return 'border_neon_cyan';
  }

  if (slug.includes('lightning') || slug.includes('thunder')) return 'border_lightning';
  if (slug.includes('flame') || slug.includes('ember')) return 'border_flame';
  if (slug.includes('shadow') || slug.includes('void')) return 'border_shadow';
  if (slug.includes('obsidian')) return 'border_obsidian';

  if (slot === 'xp') return 'xp_pack';
  return 'title_rookie';
}

export function resolveCosmeticEffect(cosmetic: CosmeticLike): CosmeticEffectDefinition {
  const key = resolveEffectKey(cosmetic);
  return EFFECTS[key] || EFFECTS.unimplemented;
}

export function getEffectById(effectId: string): CosmeticEffectDefinition | null {
  return EFFECTS[effectId] || null;
}

export function canPurchaseCosmetic(cosmetic: CosmeticLike): boolean {
  return resolveCosmeticEffect(cosmetic).isImplemented;
}

export function cosmeticTextClassFromSlug(slug: string | null | undefined): string {
  if (!slug) return 'text-white/90';
  const effect = resolveCosmeticEffect({ slug, category: 'cat_color' });
  return effect.textClassName || 'text-white/90';
}

export function cosmeticBorderClassFromSlug(slug: string | null | undefined): string {
  if (!slug) return 'cosm-border-default';
  const effect = resolveCosmeticEffect({ slug, category: 'cat_border' });
  return effect.apply.className || 'cosm-border-default';
}

export const COSMETIC_EFFECTS = EFFECTS;
