#!/usr/bin/env node
const base = process.env.SITE_URL || "https://catclash.org";
const token = String(process.env.ADMIN_SECRET || process.env.CRON_SECRET || "").trim();

if (!token) {
  console.error("[verify-vote-sync-admin] Missing ADMIN_SECRET/CRON_SECRET env.");
  process.exit(1);
}

const payload = {
  arena: process.env.ARENA || "main",
  page: Number(process.env.PAGE || 0),
  side: process.env.SIDE === "b" ? "b" : "a",
};

const res = await fetch(`${base}/api/admin/vote-sync-test`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log(JSON.stringify({ status: res.status, ok: !!data?.ok, result: data }, null, 2));
if (!res.ok || !data?.ok) process.exit(1);
