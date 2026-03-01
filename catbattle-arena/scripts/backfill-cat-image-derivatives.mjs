import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "cat-images";
const ONE_YEAR_CACHE = "public, max-age=31536000, immutable";
const ONE_WEEK_CACHE = "public, max-age=604800";
const batchSize = Math.max(1, Number(process.env.BACKFILL_BATCH || 25));
const maxRows = Math.max(1, Number(process.env.BACKFILL_MAX || 5000));
const writeMode = process.argv.includes("--write");
const dryRun = !writeMode;

function extensionFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  return "jpg";
}

function normalizePath(imagePath) {
  let p = String(imagePath || "").trim();
  p = p.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/cat-images\//, "");
  p = p.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/sign\/cat-images\//, "");
  p = p.replace(/^cat-images\//, "");
  p = p.replace(/^\/+/, "");
  return p;
}

function toPublicUrl(path) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${String(path || "").replace(/^\/+/, "")}`;
}

function sourceUrlForRow(row) {
  const fromOriginal = String(row.image_url_original || "").trim();
  if (/^https?:\/\//i.test(fromOriginal)) return fromOriginal;
  const p = normalizePath(row.image_path || "");
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return toPublicUrl(p);
}

async function listRows(offset, limit) {
  const { data, error } = await sb
    .from("cats")
    .select("id, image_path, image_url_original, image_url_card, image_url_thumb")
    .or("image_url_thumb.is.null,image_url_card.is.null,image_url_original.is.null")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

async function uploadSet(catId, sourceBuffer, contentType) {
  const originalExt = extensionFromContentType(contentType);
  const originalPath = `cats/${catId}/original.${originalExt}`;
  const cardPath = `cats/${catId}/card.webp`;
  const thumbPath = `cats/${catId}/thumb.webp`;

  const normalized = await sharp(sourceBuffer, { failOn: "none" }).rotate().toBuffer();
  const [cardBuf, thumbBuf] = await Promise.all([
    sharp(normalized).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
    sharp(normalized).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
  ]);

  if (dryRun) {
    return {
      originalPath,
      cardPath,
      thumbPath,
      originalUrl: toPublicUrl(originalPath),
      cardUrl: toPublicUrl(cardPath),
      thumbUrl: toPublicUrl(thumbPath),
    };
  }

  const [o, c, t] = await Promise.all([
    sb.storage.from(BUCKET).upload(originalPath, normalized, {
      upsert: true,
      contentType,
      cacheControl: ONE_WEEK_CACHE,
    }),
    sb.storage.from(BUCKET).upload(cardPath, cardBuf, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: ONE_YEAR_CACHE,
    }),
    sb.storage.from(BUCKET).upload(thumbPath, thumbBuf, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: ONE_YEAR_CACHE,
    }),
  ]);
  const err = o.error || c.error || t.error;
  if (err) throw err;
  return {
    originalPath,
    cardPath,
    thumbPath,
    originalUrl: toPublicUrl(originalPath),
    cardUrl: toPublicUrl(cardPath),
    thumbUrl: toPublicUrl(thumbPath),
  };
}

async function backfillRow(row) {
  const catId = String(row.id || "").trim();
  if (!catId) return { ok: false, reason: "missing_id" };
  const src = sourceUrlForRow(row);
  if (!src) return { ok: false, reason: "no_source_url", catId };
  const res = await fetch(src, { cache: "no-store" });
  if (!res.ok) return { ok: false, reason: `fetch_${res.status}`, catId };
  const contentType = String(res.headers.get("content-type") || "image/jpeg");
  if (!contentType.startsWith("image/")) return { ok: false, reason: "not_image", catId };
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.byteLength) return { ok: false, reason: "empty_body", catId };

  const out = await uploadSet(catId, buf, contentType);
  if (!dryRun) {
    const { error } = await sb
      .from("cats")
      .update({
        image_path: out.originalPath,
        image_url_original: out.originalUrl,
        image_url_card: out.cardUrl,
        image_url_thumb: out.thumbUrl,
      })
      .eq("id", catId);
    if (error) return { ok: false, reason: `update_${error.message}`, catId };
  }
  return { ok: true, catId };
}

async function main() {
  console.log(`Backfill mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
  console.log(`Batch size: ${batchSize}, max rows: ${maxRows}`);

  let scanned = 0;
  let success = 0;
  let failed = 0;
  const reasons = new Map();

  for (let offset = 0; offset < maxRows; offset += batchSize) {
    const rows = await listRows(offset, batchSize);
    if (!rows.length) break;
    for (const row of rows) {
      scanned += 1;
      try {
        const result = await backfillRow(row);
        if (result.ok) {
          success += 1;
        } else {
          failed += 1;
          reasons.set(result.reason, (reasons.get(result.reason) || 0) + 1);
          console.warn(`skip ${result.catId || ""} reason=${result.reason}`);
        }
      } catch (e) {
        failed += 1;
        const reason = String(e?.message || e);
        reasons.set(reason, (reasons.get(reason) || 0) + 1);
        console.warn(`error row id=${row.id}: ${reason}`);
      }
    }
    if (rows.length < batchSize) break;
  }

  console.log("Backfill summary:");
  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "write",
        scanned,
        success,
        failed,
        reasons: Object.fromEntries([...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
