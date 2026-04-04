'use client';

interface TrainerEmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export default function TrainerEmptyState({ icon, title, subtitle, ctaLabel, onCtaClick }: TrainerEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center sm:p-8">
      <p className="text-4xl" aria-hidden>{icon}</p>
      <p className="mt-3 text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
      {ctaLabel && onCtaClick ? (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-5 inline-flex h-11 min-w-[180px] items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-black transition hover:bg-amber-300"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
