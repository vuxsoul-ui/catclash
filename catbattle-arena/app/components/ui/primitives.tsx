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
  return <div className={cn('h-px bg-[rgba(118,140,176,0.22)]', className)} {...props} />;
}

export function Chip({ className, ...props }: DivProps) {
  return <span className={cn('inline-flex h-7 items-center rounded-full border border-[rgba(112,132,170,0.32)] bg-[linear-gradient(180deg,rgba(124,146,186,0.14),rgba(10,14,24,0.78))] px-2.5 text-[11px] font-semibold text-[rgba(234,241,255,0.9)]', className)} {...props} />;
}

export function Badge({ className, ...props }: DivProps) {
  return <span className={cn('inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100', className)} {...props} />;
}

export function buttonStyles({ className, variant = 'secondary', size = 'md' }: ButtonStyleOptions = {}) {
  const v = {
    primary: 'border border-cyan-200/52 bg-[linear-gradient(180deg,rgba(246,253,255,0.14),rgba(86,212,236,0.14)_10%,rgba(11,26,41,0.94)_11%,rgba(8,18,30,0.98)_100%)] text-white shadow-[0_12px_18px_rgba(0,0,0,0.32),0_3px_10px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(8,47,73,0.8)] hover:-translate-y-px hover:border-cyan-100/68 hover:bg-[linear-gradient(180deg,rgba(250,255,255,0.16),rgba(103,232,249,0.16)_10%,rgba(10,29,45,0.96)_11%,rgba(9,20,34,1)_100%)] hover:text-white hover:shadow-[0_14px_20px_rgba(0,0,0,0.34),0_4px_12px_rgba(34,211,238,0.1),inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(8,47,73,0.84)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_8px_14px_rgba(0,0,0,0.28),0_2px_8px_rgba(34,211,238,0.06),inset_0_1px_0_rgba(255,255,255,0.16)] focus-visible:ring-2 focus-visible:ring-cyan-300/46 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    secondary: 'border border-[rgba(124,146,184,0.34)] bg-[linear-gradient(180deg,rgba(196,209,236,0.11),rgba(167,187,226,0.05)_11%,rgba(14,20,32,0.97)_12%,rgba(9,13,22,0.99)_100%)] text-white shadow-[0_8px_14px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.74)] hover:-translate-y-px hover:border-[rgba(152,179,226,0.48)] hover:bg-[linear-gradient(180deg,rgba(210,221,244,0.12),rgba(176,197,236,0.06)_11%,rgba(17,26,40,0.98)_12%,rgba(10,16,27,1)_100%)] hover:text-white hover:shadow-[0_10px_16px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(2,6,23,0.76)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_6px_10px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.1)] focus-visible:ring-2 focus-visible:ring-cyan-300/28 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    ghost: 'border border-[rgba(116,136,168,0.28)] bg-[linear-gradient(180deg,rgba(146,168,210,0.09),rgba(116,136,168,0.05)_12%,rgba(9,13,22,0.72)_100%)] text-[rgba(228,236,250,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-px hover:border-[rgba(142,165,210,0.42)] hover:bg-[linear-gradient(180deg,rgba(170,190,230,0.12),rgba(132,154,198,0.06)_12%,rgba(10,15,25,0.78)_100%)] hover:text-white active:translate-y-[1px] active:scale-[0.98] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-cyan-300/22 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    danger: 'border border-red-200/34 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(248,113,113,0.08)_10%,rgba(55,18,18,0.96)_11%,rgba(38,11,11,0.98)_100%)] text-red-50 shadow-[0_10px_16px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(69,10,10,0.72)] hover:-translate-y-px hover:border-red-100/44 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(248,113,113,0.1)_10%,rgba(65,20,20,0.98)_11%,rgba(44,13,13,1)_100%)] hover:shadow-[0_12px_18px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.16)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_7px_12px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] focus-visible:ring-2 focus-visible:ring-red-300/34 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
  }[variant];

  const s = {
    sm: 'h-10 px-4 text-sm font-semibold',
    md: 'h-11 px-6 text-sm font-semibold',
    lg: 'h-12 px-6 text-sm font-bold',
    xl: 'h-[52px] px-8 text-sm font-bold',
  }[size];

  return cn(
    'focus-ring inline-flex items-center justify-center rounded-xl font-semibold antialiased tracking-[-0.01em] transition-all duration-150 ease-out will-change-transform disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:translate-y-0 disabled:active:scale-100',
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
      variant="ghost"
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
  return <div className={cn('rounded-2xl border border-[rgba(112,132,170,0.3)] bg-[linear-gradient(180deg,rgba(96,120,164,0.12),rgba(9,13,24,0.78))] p-1.5', className)} {...props} />;
}

export function Skeleton({ className, ...props }: DivProps) {
  return <div className={cn('animate-pulse rounded-xl bg-white/10', className)} aria-hidden="true" {...props} />;
}
