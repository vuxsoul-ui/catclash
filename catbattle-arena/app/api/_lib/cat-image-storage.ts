import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "cat-images";
const ONE_YEAR_CACHE = "public, max-age=31536000, immutable";
const ONE_WEEK_CACHE = "public, max-age=604800";

type CatImageVariant = {
  path: string;
  url: string;
};

export type CatImageSet = {
  original: CatImageVariant;
  card: CatImageVariant;
  thumb: CatImageVariant;
};

function cleanSupabaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\s/g, "").trim().replace(/\/+$/, "");
}

export function buildPublicObjectUrl(bucket: string, path: string): string {
  const base = cleanSupabaseUrl();
  const safePath = String(path || "").replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${safePath}`;
}

function extensionFromContentType(contentType: string): string {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  return "jpg";
}

export async function uploadCatImageDerivatives(params: {
  supabase: SupabaseClient;
  catId: string;
  source: Buffer | Uint8Array;
  contentType: string;
  originalCacheControl?: string;
}): Promise<CatImageSet> {
  const { supabase, catId } = params;
  const sourceBuffer = Buffer.isBuffer(params.source) ? params.source : Buffer.from(params.source);
  const contentType = String(params.contentType || "image/jpeg").toLowerCase();
  const basePath = `cats/${catId}`;
  const originalExt = extensionFromContentType(contentType);
  const originalPath = `${basePath}/original.${originalExt}`;
  const cardPath = `${basePath}/card.webp`;
  const thumbPath = `${basePath}/thumb.webp`;

  const normalized = await sharp(sourceBuffer, { failOn: "none" }).rotate().toBuffer();
  const [cardBuf, thumbBuf] = await Promise.all([
    sharp(normalized).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
    sharp(normalized).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
  ]);

  const originalCache = String(params.originalCacheControl || ONE_WEEK_CACHE);
  const uploads = await Promise.all([
    supabase.storage.from(BUCKET).upload(originalPath, normalized, {
      upsert: true,
      contentType,
      cacheControl: originalCache,
    }),
    supabase.storage.from(BUCKET).upload(cardPath, cardBuf, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: ONE_YEAR_CACHE,
    }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumbBuf, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: ONE_YEAR_CACHE,
    }),
  ]);

  const uploadErr = uploads.find((u) => !!u.error)?.error;
  if (uploadErr) throw uploadErr;

  return {
    original: { path: originalPath, url: buildPublicObjectUrl(BUCKET, originalPath) },
    card: { path: cardPath, url: buildPublicObjectUrl(BUCKET, cardPath) },
    thumb: { path: thumbPath, url: buildPublicObjectUrl(BUCKET, thumbPath) },
  };
}

