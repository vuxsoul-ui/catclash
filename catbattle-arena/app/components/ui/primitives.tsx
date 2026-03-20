'use client';

import * as React from 'react';
import { cn } from '../../lib/cn';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

type ButtonStyleOptions = {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
};

export function Card({ className, ...props }: DivProps) {
  return <div className={cn('surface-elevated p-4', className)} {...props} />;
}

export function SectionHeader({ className, ...props }: DivProps) {
  return <div className={cn('mb-3 flex items-center justify-between gap-3', className)} {...props} />;
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

export function buttonStyles({ className, variant = 'secondary', size = 'md' }: ButtonStyleOptions = {}) {
  const v = {
    primary: 'border border-cyan-200/60 bg-gradient-to-r from-cyan-400 to-emerald-400 text-black shadow-lg shadow-emerald-500/20 hover:from-cyan-300 hover:to-emerald-300 hover:shadow-xl hover:shadow-emerald-500/24 hover:scale-[1.02] active:translate-y-[1px] active:scale-[0.99] active:shadow-md focus-visible:ring-2 focus-visible:ring-cyan-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    secondary: 'border border-white/20 bg-white/10 text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] hover:bg-white/16 hover:border-white/28 active:translate-y-[1px] active:shadow-sm focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    ghost: 'border border-transparent bg-transparent text-white/82 hover:bg-white/8 active:translate-y-[1px] active:shadow-sm focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    danger: 'border border-red-300/35 bg-red-500/20 text-red-100 hover:bg-red-500/28 active:translate-y-[1px] active:shadow-sm focus-visible:ring-2 focus-visible:ring-red-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
  }[variant];

  const s = {
    sm: 'h-10 px-4 text-sm font-semibold',
    md: 'h-11 px-6 text-sm font-semibold',
    lg: 'h-12 px-6 text-sm font-bold',
    xl: 'h-[52px] px-8 text-sm font-bold',
  }[size];

  return cn(
    'focus-ring inline-flex items-center justify-center rounded-xl transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:translate-y-0 disabled:active:scale-100',
    v,
    s,
    className
  );
}

export function Button({ className, variant = 'secondary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
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
