'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, Gift, GalleryHorizontal, ShieldCheck, Swords } from 'lucide-react';
import { buttonStyles } from './ui/primitives';

type PostSubmitSuccessProps = {
  catName: string;
  onDismiss?: () => void;
  inline?: boolean;
};

function ActionCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="interactive-card focus-ring block rounded-2xl border border-emerald-300/18 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/12 text-emerald-200">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-white/62">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}

export function PostSubmitSuccess({
  catName,
  onDismiss,
  inline = false,
}: PostSubmitSuccessProps) {
  const shellClass = inline
    ? 'mt-4 rounded-[1.6rem] border border-emerald-300/24 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(8,18,18,0.88))] p-4 shadow-[0_16px_46px_rgba(0,0,0,0.36)]'
    : 'fixed inset-0 z-[220] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm';

  const cardClass = inline
    ? ''
    : 'w-full max-w-lg rounded-[1.8rem] border border-emerald-300/24 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(6,12,16,0.95))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.56)]';

  const content = (
    <div className={cardClass}>
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/15 text-emerald-200">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/82">Success!</p>
          <h2 className="mt-1 text-xl font-black text-white">{catName || 'Your cat'} is in the forge</h2>
          <p className="mt-2 text-sm leading-6 text-white/68">
            Your cat is submitted and waiting for admin approval. You can still equip skills and
            participate in duels while it waits. It will appear in the public gallery once approved.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <ActionCard
          href="/gallery?view=mine#my-cats"
          icon={<GalleryHorizontal className="h-4 w-4" />}
          title="View My Cat"
          subtitle={`Confirm ${catName || 'your cat'} in your roster`}
        />
        <ActionCard
          href="/duel"
          icon={<Swords className="h-4 w-4" />}
          title="Vote in a Duel"
          subtitle="Back a fighter in a live clash"
        />
        <ActionCard
          href="/crate"
          icon={<Gift className="h-4 w-4" />}
          title="Open Daily Crate"
          subtitle="Claim your free daily reward"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={buttonStyles({ variant: 'secondary', size: 'md', className: 'flex-1' })}
          >
            Add Another Cat
          </button>
        ) : (
          <Link
            href="/submit"
            className={buttonStyles({ variant: 'secondary', size: 'md', className: 'flex-1' })}
          >
            Add Another Cat
          </Link>
        )}

        <Link
          href="/gallery?view=mine#my-cats"
          className={buttonStyles({ variant: 'primary', size: 'xl', className: 'flex-1 gap-2' })}
        >
          <ShieldCheck className="h-4 w-4" />
          Done
        </Link>
      </div>
    </div>
  );

  if (inline) return <div>{content}</div>;

  return (
    <div className={shellClass}>
      {content}
    </div>
  );
}
