'use client';

import React, { useState } from 'react';
import { X, Trophy, Sparkles, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Trophy,
    title: 'Vote in Daily Tournaments',
    description: 'Pick winners in head-to-head cat battles. New matchups unlock every day.',
    highlight: 'Earn XP every time you vote',
  },
  {
    icon: Sparkles,
    title: 'Earn Sigils and Rewards',
    description: 'Sigils power predictions, crates, and other upgrades across CatClash.',
    highlight: 'Open your daily crate for free sigils',
  },
  {
    icon: Calendar,
    title: 'Build Your Streak',
    description: 'Come back tomorrow to keep your streak alive and unlock stronger rewards.',
    highlight: 'Daily check-ins stack your momentum',
  },
] as const;

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const currentStep = STEPS[step];
  const Icon = currentStep.icon;

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    onComplete();
  }

  function handleBack() {
    setStep((prev) => Math.max(0, prev - 1));
  }

  return (
    <div
      className="fixed inset-0 z-[1550] flex items-center justify-center bg-black/90 px-4 py-6 backdrop-blur-sm"
      onClick={onComplete}
    >
      <div
        className="relative w-full max-w-lg rounded-[1.75rem] border border-fuchsia-300/18 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(6,8,14,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onComplete}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((_, index) => (
            <div
              key={`onboarding-step-${index}`}
              className={`h-2 rounded-full transition-all ${index === step ? 'w-8 bg-fuchsia-400' : index < step ? 'w-2 bg-fuchsia-400/55' : 'w-2 bg-white/18'}`}
            />
          ))}
        </div>

        <div className="mb-8 text-center">
          <div className="mb-5">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-fuchsia-300/18 bg-fuchsia-500/12 shadow-[0_0_40px_rgba(217,70,239,0.18)]">
              <Icon className="h-10 w-10 text-fuchsia-300" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white sm:text-3xl">{currentStep.title}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/72 sm:text-base">
            {currentStep.description}
          </p>
          <div className="mt-5 inline-flex rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200">
            {currentStep.highlight}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(217,70,239,0.24)] transition hover:scale-[1.01] active:scale-[0.99]"
          >
            {step === STEPS.length - 1 ? "Let's Go!" : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="mt-4 w-full text-center text-sm text-white/42 transition hover:text-white/60"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  );
}
