#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const domain = process.env.CANONICAL_DOMAIN || "catclash.org";
const remoteUrl = `https://${domain}/api/build`;

async function readLocalBuildId() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8");
    const id = String(raw || "").trim();
    return id || null;
  } catch {
    return null;
  }
}

async function readRemoteBuildId() {
  try {
    const res = await fetch(remoteUrl, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return String(data.nextBuildId || "").trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const [localBuildId, remoteBuildId] = await Promise.all([readLocalBuildId(), readRemoteBuildId()]);
  console.log(`[VERIFY DIFF] domain=${domain}`);
  console.log(`[VERIFY DIFF] localBuildId=${localBuildId || "null"}`);
  console.log(`[VERIFY DIFF] remoteBuildId=${remoteBuildId || "null"}`);

  if (!localBuildId) {
    console.log("[VERIFY DIFF] local .next/BUILD_ID not found (run `npm run build` first).");
    process.exit(0);
  }
  if (!remoteBuildId) {
    console.log(`[VERIFY DIFF] could not read remote build id from ${remoteUrl}.`);
    process.exit(1);
  }
  if (localBuildId !== remoteBuildId) {
    console.log("WARNING: Prod build != local build");
    process.exit(1);
  }

  console.log("OK: Prod build matches local build.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

