const PLACEHOLDER = '/cat-placeholder.svg';
const THUMB_RE = /\/thumb\.webp(?:$|[?#])/i;

function baseSupabaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
}

export function isThumbUrl(url: string): boolean {
  const raw = String(url || '').trim();
  return !!raw && THUMB_RE.test(raw);
}

export function thumbUrlForCat(catId: string): string {
  const id = String(catId || '').trim();
  if (!id) return PLACEHOLDER;
  const base = baseSupabaseUrl();
  if (!base) return PLACEHOLDER;
  return `${base}/storage/v1/object/public/cat-images/cats/${id}/thumb.webp`;
}

export function canonicalThumbForCat(cat: { id?: string | null; image_url?: string | null }): string {
  const raw = String(cat?.image_url || '').trim();
  if (isThumbUrl(raw)) return raw;
  return thumbUrlForCat(String(cat?.id || ''));
}
