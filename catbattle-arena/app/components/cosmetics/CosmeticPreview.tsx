'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import VoteEffectLayer from './VoteEffectLayer';
import BorderPreview from './BorderPreview';
import { resolveCosmeticEffect, type CosmeticLike } from '../../_lib/cosmetics/effectsRegistry';

type TitlePreset = {
  text: string;
  shadow: string;
  glow: string;
};

const DYNAMIC_TITLE_PRESETS: TitlePreset[] = [
  { text: '#facc15', shadow: '0 0 10px rgba(234,179,8,0.45)', glow: 'radial-gradient(120% 90% at 14% 15%, rgba(234,179,8,0.18), rgba(0,0,0,0) 58%)' },
  { text: '#60a5fa', shadow: '0 0 10px rgba(96,165,250,0.4)', glow: 'radial-gradient(120% 90% at 84% 12%, rgba(59,130,246,0.18), rgba(0,0,0,0) 58%)' },
  { text: '#34d399', shadow: '0 0 10px rgba(16,185,129,0.4)', glow: 'radial-gradient(120% 90% at 20% 84%, rgba(16,185,129,0.18), rgba(0,0,0,0) 58%)' },
  { text: '#f472b6', shadow: '0 0 10px rgba(244,114,182,0.42)', glow: 'radial-gradient(120% 90% at 78% 78%, rgba(244,114,182,0.18), rgba(0,0,0,0) 58%)' },
  { text: '#a78bfa', shadow: '0 0 10px rgba(167,139,250,0.42)', glow: 'radial-gradient(120% 90% at 50% 50%, rgba(167,139,250,0.16), rgba(0,0,0,0) 58%)' },
  { text: '#fb7185', shadow: '0 0 10px rgba(251,113,133,0.42)', glow: 'radial-gradient(120% 90% at 26% 46%, rgba(251,113,133,0.18), rgba(0,0,0,0) 58%)' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dynamicTitleStyle(title: string): { textStyle: CSSProperties; shellStyle: CSSProperties } {
  const key = title.trim().toLowerCase() || 'untitled';
  const preset = DYNAMIC_TITLE_PRESETS[hashString(key) % DYNAMIC_TITLE_PRESETS.length];
  return {
    textStyle: {
      color: preset.text,
      textShadow: preset.shadow,
      letterSpacing: '0.02em',
      fontWeight: 800,
    },
    shellStyle: {
      backgroundImage: `${preset.glow}, linear-gradient(120deg, rgba(4,10,22,0.88), rgba(2,12,34,0.65), rgba(0,0,0,0.82))`,
    },
  };
}

export default function CosmeticPreview({
  cosmetic,
  compact = false,
  onInteracted,
}: {
  cosmetic: CosmeticLike;
  compact?: boolean;
  onInteracted?: () => void;
}) {
  const effect = resolveCosmeticEffect(cosmetic);
  const [triggerKey, setTriggerKey] = useState('');
  const titleLabel = String(cosmetic.name || 'Untitled').trim() || 'Untitled';
  const badgeLabel = String(cosmetic.name || 'Badge').trim() || 'Badge';
  const isGenericTitle =
    effect.slot === 'title' && (effect.id === 'title_rookie' || effect.id === 'unimplemented');
  const dynamicTitle = isGenericTitle ? dynamicTitleStyle(titleLabel) : null;

  if (effect.slot === 'border') {
    return <BorderPreview fxClass={effect.apply.className} compact={compact} />;
  }

  if (effect.slot === 'theme') {
    return (
      <div className={`rounded-xl border border-white/10 ${effect.apply.className || 'cosm-theme-default'} ${compact ? 'h-16' : 'h-24'} p-2 flex flex-col justify-between`}>
        <div className="flex items-center justify-between gap-1.5">
          <span className={`text-[10px] font-semibold ${effect.textClassName || 'text-white/85'}`}>Theme Accent</span>
          <span className="h-2 w-2 rounded-full bg-white/60" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-6 rounded border border-white/15 bg-black/30" />
          <div className="h-6 rounded border border-white/15 bg-white/10" />
        </div>
      </div>
    );
  }

  if (effect.slot === 'vote_effect') {
    return (
      <div className={`relative rounded-xl border border-white/10 bg-black/35 ${compact ? 'h-16' : 'h-24'} p-2 flex items-end`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const key = `${Date.now()}`;
            setTriggerKey(key);
            onInteracted?.();
          }}
          className="relative z-10 h-8 w-full rounded-lg bg-white/10 border border-white/15 text-xs font-semibold text-white"
        >
          Tap To Test
        </button>
        <VoteEffectLayer effectSlug={cosmetic.slug || null} triggerKey={triggerKey} />
      </div>
    );
  }

  if (effect.slot === 'badge') {
    return (
      <div className={`rounded-xl border border-white/10 bg-black/35 ${compact ? 'h-16' : 'h-24'} p-2 flex items-center`}>
        <div className="w-full flex items-center justify-between gap-2 text-xs text-white/85">
          <span className={`inline-flex px-2 py-1 rounded-full border ${effect.badgeClassName || 'cosm-badge-default'}`}>🏴 {badgeLabel}</span>
          <span className="text-[10px] text-white/55">Arena Tag</span>
        </div>
      </div>
    );
  }

  if (effect.slot === 'xp') {
    return (
      <div className={`rounded-xl border border-white/10 bg-black/35 ${compact ? 'h-16' : 'h-24'} p-2 flex items-center justify-center`}>
        <div className="w-full">
          <p className="text-[10px] text-cyan-100/80 mb-1">XP Boost Pack</p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/35 ${compact ? 'h-16' : 'h-24'} p-2 flex items-center justify-between`}
      style={dynamicTitle?.shellStyle}
    >
      <span
        className={`${isGenericTitle ? 'text-white/90' : (effect.textClassName || 'text-white/85')} text-sm font-bold`}
        style={dynamicTitle?.textStyle}
      >
        {titleLabel}
      </span>
      <span className="text-[10px] text-white/50 uppercase">Title</span>
    </div>
  );
}
