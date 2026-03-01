'use client';

import { useCallback, useRef, useState } from 'react';

type MouseState = {
  x: number;
  y: number;
  active: boolean;
};

export function useMousePosition<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [mouse, setMouse] = useState<MouseState>({ x: 0, y: 0, active: false });

  const updateFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const nx = (px - 0.5) * 2;
    const ny = (py - 0.5) * 2;
    setMouse({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
      active: true,
    });
  }, []);

  const onMouseMove = useCallback((event: React.MouseEvent<T>) => {
    updateFromPoint(event.clientX, event.clientY);
  }, [updateFromPoint]);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    updateFromPoint(event.clientX, event.clientY);
  }, [updateFromPoint]);

  const onMouseLeave = useCallback(() => {
    setMouse({ x: 0, y: 0, active: false });
  }, []);

  return {
    ref,
    mouse,
    handlers: {
      onMouseMove,
      onPointerMove,
      onMouseLeave,
      onPointerLeave: onMouseLeave,
    },
  };
}

