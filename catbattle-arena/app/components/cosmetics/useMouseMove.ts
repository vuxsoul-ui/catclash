'use client';

import { useCallback, useRef, useState } from 'react';

type MouseState = {
  x: number;
  y: number;
  active: boolean;
};

export function useMouseMove<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [mouse, setMouse] = useState<MouseState>({ x: 0, y: 0, active: false });

  const onMouseMove = useCallback((event: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const nx = (px - 0.5) * 2;
    const ny = (py - 0.5) * 2;
    setMouse({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)), active: true });
  }, []);

  const onMouseLeave = useCallback(() => {
    setMouse({ x: 0, y: 0, active: false });
  }, []);

  return {
    ref,
    mouse,
    handlers: {
      onMouseMove,
      onMouseLeave,
    },
  };
}

