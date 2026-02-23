'use client';

const warned = new Set<string>();

function warnOnce(key: string, message: string) {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

export function scanDuplicateTestIds(scopeKey = 'global', root?: ParentNode) {
  if (process.env.NODE_ENV === 'production') return;
  const source = root ?? document;
  const nodes = Array.from(source.querySelectorAll('[data-testid]'));
  if (!nodes.length) return;
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const id = (node.getAttribute('data-testid') || '').trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const [id, count] of counts.entries()) {
    if (count > 1) {
      warnOnce(`${scopeKey}:${id}`, `[DEV WARNING] Duplicate data-testid detected: ${id}`);
    }
  }
}
