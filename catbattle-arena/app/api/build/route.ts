import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveBuildId(): Promise<string | null> {
  const envBuild = String(process.env.NEXT_BUILD_ID || "").trim();
  if (envBuild) return envBuild;

  const globalBuild = String((globalThis as any)?.__NEXT_DATA__?.buildId || "").trim();
  if (globalBuild) return globalBuild;

  try {
    const file = await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8");
    const parsed = String(file || "").trim();
    return parsed || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const nextBuildId = await resolveBuildId();
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF || null;
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null;
  const vercelEnv = process.env.VERCEL_ENV || null;
  const vercelUrl = process.env.VERCEL_URL || null;
  return NextResponse.json(
    {
      ok: true,
      nextBuildId,
      gitSha,
      gitRef,
      deploymentId,
      vercelEnv,
      vercelUrl,
      deployedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
