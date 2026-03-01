export function canonicalSiteOrigin(rawInput?: string | null): string {
  const fallback = "https://catclash.org";
  const raw = String(rawInput || process.env.NEXT_PUBLIC_SITE_URL || fallback).trim();
  if (!raw) return fallback;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    const host = String(u.host || "").toLowerCase().replace(/^www\./, "");
    if (!host) return fallback;
    return `https://${host}`;
  } catch {
    return fallback;
  }
}

