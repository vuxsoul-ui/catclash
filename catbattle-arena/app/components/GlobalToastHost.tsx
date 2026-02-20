'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GLOBAL_TOAST_EVENT, type GlobalToastPayload } from '../lib/global-toast';
import { Toast, ToastHost } from './ui/toast';

type ActiveToast = {
  id: number;
  message: string;
};

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

      const duration = Number(custom.detail?.durationMs || 4500);
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
      {activeToast && (
        <Toast key={activeToast.id}>
          {activeToast.message}
        </Toast>
      )}
    </ToastHost>
  );
}
