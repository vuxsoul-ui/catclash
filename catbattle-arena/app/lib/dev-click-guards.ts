'use client';

type TapPoint = { x: number; y: number; label: string };

type CheckTapTargetInput = {
  key: string;
  selector: string;
  expect?: Array<'A' | 'BUTTON'>;
  points?: Array<{ xPct: number; yPct: number; label: string }>;
  skipWhenModalOpen?: boolean;
};

const warned = new Set<string>();
const outlineTimers = new WeakMap<HTMLElement, number>();

export function warnOnce(key: string, message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof data === 'undefined') {
    console.warn(message);
    return;
  }
  console.warn(message, data);
}

function isModalOpen(): boolean {
  return !!document.querySelector('[data-modal-open="true"], [aria-modal="true"]');
}

function buildPoints(rect: DOMRect, points?: CheckTapTargetInput['points']): TapPoint[] {
  const base = points && points.length > 0
    ? points
    : [
        { xPct: 0.5, yPct: 0.2, label: 'top' },
        { xPct: 0.5, yPct: 0.5, label: 'center' },
        { xPct: 0.5, yPct: 0.8, label: 'bottom' },
      ];
  return base.map((p) => ({
    label: p.label,
    x: Math.floor(rect.x + rect.width * p.xPct),
    y: Math.floor(rect.y + rect.height * p.yPct),
  }));
}

function parentDump(target: Element | null): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let cur: Element | null = target;
  let count = 0;
  while (cur && count < 5) {
    const style = getComputedStyle(cur as HTMLElement);
    out.push({
      tag: cur.tagName,
      className: String((cur as HTMLElement).className || ''),
      id: cur.id || null,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      position: style.position,
    });
    cur = cur.parentElement;
    count += 1;
  }
  return out;
}

function isExpectedTarget(top: Element | null, expect: Array<'A' | 'BUTTON'>): boolean {
  if (!top) return false;
  for (const tag of expect) {
    if (top.tagName === tag) return true;
    if (top.closest(tag.toLowerCase())) return true;
  }
  return false;
}

function highlightIntercept(el: HTMLElement) {
  const priorOutline = el.style.outline;
  const priorOffset = el.style.outlineOffset;
  el.style.outline = '2px solid rgba(255, 58, 58, 0.95)';
  el.style.outlineOffset = '-2px';
  const prevTimer = outlineTimers.get(el);
  if (typeof prevTimer === 'number') window.clearTimeout(prevTimer);
  const timer = window.setTimeout(() => {
    el.style.outline = priorOutline;
    el.style.outlineOffset = priorOffset;
    outlineTimers.delete(el);
  }, 1000);
  outlineTimers.set(el, timer);
}

type PositionedAncestorDump = {
  tag: string;
  className: string;
  id: string | null;
  position: string;
  zIndex: string;
  pointerEvents: string;
};

function fixedAbsoluteAncestorDump(target: HTMLElement, max = 5): PositionedAncestorDump[] {
  const rows: PositionedAncestorDump[] = [];
  let cur: HTMLElement | null = target;
  while (cur && rows.length < max) {
    const style = getComputedStyle(cur);
    if (style.position === 'fixed' || style.position === 'absolute') {
      rows.push({
        tag: cur.tagName,
        className: String(cur.className || ''),
        id: cur.id || null,
        position: style.position,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
      });
    }
    cur = cur.parentElement;
  }
  return rows;
}

function pointFromEvent(event: Event): { x: number; y: number } | null {
  if (event instanceof PointerEvent || event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (event instanceof TouchEvent && event.touches[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return null;
}

export function installBottomNavInterceptionDiagnostics(navSelector = '[data-nav-root="mobile"]'): () => void {
  if (process.env.NODE_ENV === 'production') return () => {};
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event) => {
    const point = pointFromEvent(event);
    if (!point) return;
    const nav = document.querySelector(navSelector) as HTMLElement | null;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const inside =
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
    if (!inside) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;
    const navButton = target.closest('[data-testid^="nav-"], a, button');
    if (navButton && nav.contains(navButton)) return;

    const style = getComputedStyle(target);
    const positioned = fixedAbsoluteAncestorDump(target, 5);
    warnOnce(`nav-intercept:${target.tagName}:${target.className}`, '[DEV_CHECK] Bottom nav tap intercepted', {
      target: {
        tag: target.tagName,
        className: String(target.className || ''),
      },
      intercepting: {
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        position: style.position,
      },
      fixedAbsoluteAncestors: positioned,
    });
    highlightIntercept(target);
  };

  document.addEventListener('pointerdown', handler, true);
  document.addEventListener('touchstart', handler, true);
  return () => {
    document.removeEventListener('pointerdown', handler, true);
    document.removeEventListener('touchstart', handler, true);
  };
}

export function checkTapTarget({
  key,
  selector,
  expect = ['A', 'BUTTON'],
  points,
  skipWhenModalOpen = true,
}: CheckTapTargetInput): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (skipWhenModalOpen && isModalOpen()) return true;
  const target = document.querySelector(selector) as HTMLElement | null;
  if (!target) {
    warnOnce(`${key}:missing`, `[DEV_CHECK] Tap target selector not found: ${selector}`);
    return false;
  }
  const rect = target.getBoundingClientRect();
  const probes = buildPoints(rect, points);
  for (const p of probes) {
    const top = document.elementFromPoint(p.x, p.y);
    if (isExpectedTarget(top, expect)) continue;
    warnOnce(`${key}:${p.label}`, `[DEV_CHECK] Tap target mismatch for ${selector}`, {
      point: p,
      expected: expect,
      topTag: top?.tagName || null,
      topClass: top ? String((top as HTMLElement).className || '') : null,
      parents: parentDump(top),
    });
    return false;
  }
  return true;
}
