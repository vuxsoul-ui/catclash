'use client';

import * as React from 'react';
import { cn } from '../../lib/cn';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Card({ className, ...props }: DivProps) {
  return <div className={cn('surface-elevated p-3 sm:p-4', className)} {...props} />;
}

export function SectionHeader({ className, ...props }: DivProps) {
  return <div className={cn('mb-2 flex items-center justify-between gap-2', className)} {...props} />;
}

export function Divider({ className, ...props }: DivProps) {
  return <div className={cn('h-px bg-white/10', className)} {...props} />;
}

export function Chip({ className, ...props }: DivProps) {
  return <span className={cn('inline-flex h-7 items-center rounded-full border border-white/15 bg-white/6 px-2.5 text-[11px] font-semibold text-white/85', className)} {...props} />;
}

export function Badge({ className, ...props }: DivProps) {
  return <span className={cn('inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100', className)} {...props} />;
}

export function Button({ className, variant = 'secondary', size = 'md', ...props }: ButtonProps) {
  const v = {
    primary: 'bg-cyan-300 text-black border border-cyan-200/70 hover:bg-cyan-200',
    secondary: 'bg-white/8 text-white border border-white/15 hover:bg-white/12',
    ghost: 'bg-transparent text-white/80 border border-transparent hover:bg-white/8',
    danger: 'bg-red-500/20 text-red-100 border border-red-300/35 hover:bg-red-500/25',
  }[variant];
  const s = {
    sm: 'h-8 px-3 text-[11px]',
    md: 'h-9 px-3.5 text-[12px]',
    lg: 'h-11 px-4 text-[13px]',
  }[size];

  return (
    <button
      className={cn('focus-ring inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]', v, s, className)}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('h-9 w-9 rounded-full p-0', className)}
      {...props}
    />
  );
}

export function Tabs({ className, ...props }: DivProps) {
  return <div className={cn('grid grid-cols-2 gap-2', className)} role="tablist" {...props} />;
}

export function SegmentedControl({ className, ...props }: DivProps) {
  return <div className={cn('rounded-2xl border border-white/10 bg-white/[0.03] p-1.5', className)} {...props} />;
}

export function Skeleton({ className, ...props }: DivProps) {
  return <div className={cn('animate-pulse rounded-xl bg-white/10', className)} aria-hidden="true" {...props} />;
}
