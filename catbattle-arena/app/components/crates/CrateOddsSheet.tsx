'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';

type CrateType = 'daily' | 'premium' | 'epic';

type OddsRow = {
  tier: string;
  label: string;
  rate: number;
};

type OddsPayload = {
  ok?: boolean;
  rows?: OddsRow[];
  pity_threshold?: number;
  pity_status?: {
    streak_without_epic_plus?: number;
  };
};

const FALLBACK_ROWS: Record<CrateType, OddsRow[]> = {
  daily: [
    { tier: 'xp_sigils', label: 'XP / Sigils', rate: 62 },
    { tier: 'common', label: 'Common Cosmetic', rate: 20 },
    { tier: 'rare', label: 'Rare Cosmetic', rate: 10 },
    { tier: 'epic', label: 'Epic Cosmetic', rate: 5 },
    { tier: 'legendary', label: 'Legendary Cosmetic', rate: 2 },
    { tier: 'mythic', label: 'Mythic Cosmetic', rate: 0.8 },
    { tier: 'god_tier', label: 'Guaranteed (G)', rate: 0.2 },
  ],
  premium: [
    { tier: 'xp_sigils', label: 'XP / Sigils', rate: 45 },
    { tier: 'common', label: 'Common Cosmetic', rate: 24 },
    { tier: 'rare', label: 'Rare Cosmetic', rate: 16 },
    { tier: 'epic', label: 'Epic Cosmetic', rate: 9 },
    { tier: 'legendary', label: 'Legendary Cosmetic', rate: 4.5 },
    { tier: 'mythic', label: 'Mythic Cosmetic', rate: 1.2 },
    { tier: 'god_tier', label: 'Guaranteed (G)', rate: 0.3 },
  ],
  epic: [
    { tier: 'common', label: 'Common Cosmetic', rate: 30 },
    { tier: 'rare', label: 'Rare Cosmetic', rate: 28 },
    { tier: 'epic', label: 'Epic Cosmetic', rate: 20 },
    { tier: 'legendary', label: 'Legendary Cosmetic', rate: 12 },
    { tier: 'mythic', label: 'Mythic Cosmetic', rate: 7 },
    { tier: 'god_tier', label: 'Guaranteed (G)', rate: 3 },
  ],
};

function tierTone(tier: string) {
  switch (tier) {
    case 'xp_sigils':
      return {
        dot: 'bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.55)]',
        label: 'text-sky-200/85',
        fill: 'from-sky-400 via-cyan-300 to-cyan-200',
      };
    case 'common':
      return {
        dot: 'bg-zinc-300 shadow-[0_0_8px_rgba(212,212,216,0.35)]',
        label: 'text-zinc-200/80',
        fill: 'from-zinc-400 to-zinc-300',
      };
    case 'rare':
      return {
        dot: 'bg-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.45)]',
        label: 'text-blue-200/85',
        fill: 'from-blue-500 to-sky-300',
      };
    case 'epic':
      return {
        dot: 'bg-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.55)]',
        label: 'text-purple-200/90',
        fill: 'from-purple-500 to-fuchsia-300',
      };
    case 'legendary':
      return {
        dot: 'bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]',
        label: 'text-amber-200/90',
        fill: 'from-amber-500 via-yellow-400 to-amber-200',
      };
    case 'mythic':
      return {
        dot: 'bg-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.6)]',
        label: 'text-rose-200/90',
        fill: 'from-rose-500 to-red-300',
      };
    case 'god_tier':
      return {
        dot: 'bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.6)]',
        label: 'text-cyan-200/90',
        fill: 'from-cyan-400 to-sky-200',
      };
    default:
      return {
        dot: 'bg-white/50',
        label: 'text-white/75',
        fill: 'from-white/60 to-white/40',
      };
  }
}

export default function CrateOddsSheet({
  open,
  onClose,
  crateType,
  title,
}: {
  open: boolean;
  onClose: () => void;
  crateType: CrateType;
  title: string;
}) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<OddsPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/crates/odds?crate_type=${crateType}`, { cache: 'no-store' })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return;
        setPayload(data && data.ok ? data : null);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [crateType, open]);

  const rows = useMemo(() => {
    const candidate = Array.isArray(payload?.rows) ? payload?.rows : null;
    return candidate && candidate.length ? candidate : FALLBACK_ROWS[crateType];
  }, [crateType, payload?.rows]);

  const pityThreshold = Number(payload?.pity_threshold || (crateType === 'epic' ? 6 : 10));
  const pityProgress = Number(payload?.pity_status?.streak_without_epic_plus || 0);
  const pityLeft = Math.max(0, pityThreshold - pityProgress);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close rewards and odds"
        onClick={onClose}
        className="fixed inset-0 z-[399] bg-[rgba(3,2,10,0.6)] backdrop-blur-[4px]"
      />
      <div
        className="fixed inset-x-0 top-1/2 z-[400] mx-auto flex w-full max-w-[430px] -translate-y-1/2 flex-col overflow-y-auto rounded-[18px] border border-[rgba(55,28,108,0.22)] bg-[rgba(8,6,18,0.97)] backdrop-blur-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overscroll-contain"
        style={{
          maxHeight: 'min(78vh, calc(100dvh - 72px))',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
        }}
      >
        <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-[rgba(88,55,165,0.28)]" />
        <div className="flex items-center justify-between border-b border-[rgba(38,18,88,0.18)] px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-amber-300/80" />
            <h3 className="text-[0.78rem] font-semibold tracking-[0.04em] text-amber-200/90">{title} - Drop Rates</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-[rgba(55,28,108,0.22)] bg-white/[0.03] px-3 py-1 text-[0.68rem] font-medium text-[rgba(120,95,175,0.75)]"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>

        <div className="py-1">
          {rows.map((row) => {
            const tone = tierTone(row.tier);
            return (
              <div key={`${row.tier}:${row.label}`} className="flex items-center gap-3 border-b border-[rgba(38,18,88,0.1)] px-4 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                <div className={`min-w-0 flex-1 text-[0.72rem] font-semibold ${tone.label}`}>{row.label}</div>
                <div className="h-[5px] w-[85px] overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${tone.fill}`}
                    style={{ width: `${Math.max(2, Math.min(100, Number(row.rate || 0)))}%` }}
                  />
                </div>
                <div className={`w-12 text-right text-[0.66rem] font-semibold ${tone.label}`}>{Number(row.rate || 0)}%</div>
              </div>
            );
          })}
        </div>

        <div className="mx-4 mt-3 rounded-[9px] border border-[rgba(110,45,215,0.2)] bg-[rgba(88,30,175,0.1)] p-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-300 shadow-[0_0_10px_rgba(196,181,253,0.75)] animate-pulse" />
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.04em] text-purple-100/85">Pity system active</p>
              <p className="mt-1 text-[0.68rem] leading-5 text-white/70">
                Opens without Epic+ increase your pity counter. At {pityThreshold} opens you are guaranteed an Epic or higher.
              </p>
              <p className="mt-1 text-[0.68rem] text-purple-200/80">
                Current pity: {pityProgress} opens without Epic+ · {pityLeft} to guarantee
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-3 text-[0.68rem] text-white/45">Refreshing odds...</div>
        ) : null}
      </div>
    </>
  );
}
