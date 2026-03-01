import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPublicObjectUrl } from './cat-image-storage';

const BUCKET = 'cat-images';
const CATAAS_PLACEHOLDER = '/cat-placeholder.svg';
const THUMB_PATH_RE = /\/cats\/[^/]+\/thumb\.webp(?:$|[?#])/i;
const CARD_PATH_RE = /\/cats\/[^/]+\/card\.webp(?:$|[?#])/i;

function normalizePath(imagePath: string): string {
  let path = imagePath.trim();
  path = path.split('?')[0]?.split('#')[0] || '';
  path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/cat-images\//, '');
  path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/sign\/cat-images\//, '');
  path = path.replace(/^cat-images\//, '');
  path = path.replace(/^\/+/, '');
  return path;
}

function getSupabaseHost(): string {
  try {
    const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    if (!raw) return '';
    return new URL(raw).host;
  } catch {
    return '';
  }
}

function shouldResolveStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = getSupabaseHost();
    if (!host || u.host !== host) return false;
    return u.pathname.includes('/storage/v1/object/public/cat-images/') || u.pathname.includes('/storage/v1/object/sign/cat-images/');
  } catch {
    return false;
  }
}

export async function resolveCatImageUrl(
  _supabase: SupabaseClient,
  imagePath: string | null | undefined,
  imageReviewStatus?: string | null,
  variant: 'thumb' | 'card' | 'original' = 'thumb'
): Promise<string | null> {
  const review = String(imageReviewStatus || '').toLowerCase();
  if (review === 'disapproved' || review === 'pending_review') return CATAAS_PLACEHOLDER;
  if (!imagePath) return CATAAS_PLACEHOLDER;
  const trimmed = String(imagePath).trim();
  if (!trimmed) return CATAAS_PLACEHOLDER;

  if (/^https?:\/\//i.test(trimmed) && !shouldResolveStorageUrl(trimmed)) {
    return trimmed;
  }

  const path = normalizePath(trimmed);
  if (!path) return CATAAS_PLACEHOLDER;
  if (path === 'npc/placeholder.jpg' || path.endsWith('/placeholder.jpg')) return CATAAS_PLACEHOLDER;

  const derived = deriveVariantPath(path, variant);
  if (derived) return buildPublicObjectUrl(BUCKET, derived);

  return buildPublicObjectUrl(BUCKET, path) || CATAAS_PLACEHOLDER;
}

export function isThumbUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  return /\/thumb\.webp(?:$|[?#])/i.test(value);
}

export function preferCardImage(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw || raw.includes('/cat-placeholder')) return null;
  if (CARD_PATH_RE.test(raw)) return raw;
  if (THUMB_PATH_RE.test(raw)) return raw.replace(/\/thumb\.webp(?:$|[?#])/i, '/card.webp');

  const deriveFromPath = (pathLike: string): string | null => {
    const p = normalizePath(pathLike);
    const m = p.match(/^cats\/([^/]+)\/.+$/i);
    if (!m?.[1]) return null;
    return buildPublicObjectUrl(BUCKET, `cats/${m[1]}/card.webp`);
  };

  if (!/^https?:\/\//i.test(raw)) return deriveFromPath(raw);

  try {
    const u = new URL(raw);
    const marker = '/storage/v1/object/public/cat-images/';
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const suffix = u.pathname.slice(idx + marker.length);
    return deriveFromPath(suffix);
  } catch {
    return null;
  }
}

export function thumbUrlForCat(catId: string): string {
  const clean = String(catId || '').trim();
  if (!clean) return CATAAS_PLACEHOLDER;
  return buildPublicObjectUrl(BUCKET, `cats/${clean}/thumb.webp`);
}

export function normalizeCatImageUrl(cat: { id: string; image_url?: string | null }): string {
  const catId = String(cat?.id || '').trim();
  if (!catId) return CATAAS_PLACEHOLDER;
  const existing = String(cat?.image_url || '').trim();
  if (isThumbUrl(existing)) return existing;
  const normalized = thumbUrlForCat(catId);
  return isThumbUrl(normalized) ? normalized : CATAAS_PLACEHOLDER;
}

export function isStarterOrAdoptedImage(url: string): boolean {
  const value = String(url || '').toLowerCase();
  if (!value) return false;
  if (value.includes('/starter/')) return true;
  if (value.includes('/cat-placeholder')) return false;
  return !THUMB_PATH_RE.test(value);
}

// Owner-only preview path for pending images on private surfaces (e.g. fighter card preview).
// Do not use this on public feeds or shared/public endpoints.
export async function resolveCatImageUrlOwnerPreview(
  _supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<string | null> {
  if (!imagePath) return CATAAS_PLACEHOLDER;
  const trimmed = String(imagePath).trim();
  if (!trimmed) return CATAAS_PLACEHOLDER;

  if (/^https?:\/\//i.test(trimmed) && !shouldResolveStorageUrl(trimmed)) {
    return trimmed;
  }

  const path = normalizePath(trimmed);
  if (!path) return CATAAS_PLACEHOLDER;
  if (path === 'npc/placeholder.jpg' || path.endsWith('/placeholder.jpg')) return CATAAS_PLACEHOLDER;

  return buildPublicObjectUrl(BUCKET, path) || CATAAS_PLACEHOLDER;
}

export function isPlaceholderLikeImage(url: string | null | undefined): boolean {
  const v = String(url || '').toLowerCase();
  if (!v) return true;
  return v.includes('t=placeholder') || v.includes('/cat-placeholder');
}

export function stableNpcImageUrl(catId: string, size = 512): string {
  const seed = encodeURIComponent(`npc-${catId}`);
  return `https://robohash.org/${seed}?set=set4&size=${size}x${size}&bgset=bg2`;
}

function deriveVariantPath(path: string, variant: 'thumb' | 'card' | 'original'): string | null {
  const p = String(path || '').trim().replace(/^\/+/, '');
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return null;
  const parts = p.split('/');
  if (parts.length >= 3 && parts[0] === 'cats') {
    const catId = parts[1];
    const current = parts.slice(2).join('/');
    const hasThumb = current.startsWith('thumb.');
    const hasCard = current.startsWith('card.');
    const hasOriginal = current.startsWith('original.');
    if (variant === 'original') {
      if (current.startsWith('original.')) return `cats/${catId}/${current}`;
      return `cats/${catId}/original.jpg`;
    }
    if ((variant === 'thumb' || variant === 'card') && (hasThumb || hasCard || hasOriginal)) {
      return variant === 'thumb' ? `cats/${catId}/thumb.webp` : `cats/${catId}/card.webp`;
    }
    // Legacy uploads may only have a single non-derivative object filename.
    // Fall back to the exact stored object path so approved images still render.
    return p;
  }
  if (variant === 'thumb' || variant === 'card') return null;
  return p;
}
