'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GLOBAL_TOAST_EVENT, type GlobalToastPayload } from '../lib/global-toast';
import { Toast, ToastHost } from './ui/toast';

type ActiveToast = {
  id: number;
  message: string;
};

function parseToastMessage(message: string): { title: string; subtext: string | null } {
  const trimmed = String(message || '').trim();
  if (!trimmed) return { title: '', subtext: null };
  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { title: lines[0], subtext: lines.slice(1).join(' ') };
  }
  const parts = trimmed.split(' — ').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return { title: parts[0], subtext: parts.slice(1).join(' — ') };
  }
  return { title: trimmed, subtext: null };
}

export default function GlobalToastHost() {
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };

  useEffect(() => {
    function onToast(event: Event) {
      const custom = event as CustomEvent<GlobalToastPayload>;
      const message = String(custom.detail?.message || '').trim();
      if (!message) return;

      clearHideTimer();
      setActiveToast({ id: Date.now(), message });

      const duration = Number(custom.detail?.durationMs || 2500);
      hideTimerRef.current = setTimeout(() => {
        setActiveToast(null);
      }, Math.max(1200, duration));
    }

    window.addEventListener(GLOBAL_TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(GLOBAL_TOAST_EVENT, onToast as EventListener);
      clearHideTimer();
    };
  }, []);

  const classes = useMemo(
    () =>
      [
        'global-toast-host',
        activeToast ? 'global-toast-host--visible' : 'global-toast-host--hidden',
      ].join(' '),
    [activeToast],
  );

  return (
    <ToastHost className={classes}>
      {activeToast ? (() => {
        const parsed = parseToastMessage(activeToast.message);
        return (
          <Toast key={activeToast.id}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-[10px] text-white/80"
              >
                ✦
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold leading-tight text-white">{parsed.title}</p>
                {parsed.subtext ? (
                  <p className="mt-1 truncate text-[12px] leading-tight text-white/55">{parsed.subtext}</p>
                ) : null}
              </div>
            </div>
          </Toast>
        );
      })() : null}
    </ToastHost>
  );
}
