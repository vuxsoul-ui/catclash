"use client";

import { useEffect, useState } from "react";

type BuildInfo = {
  ok?: boolean;
  nextBuildId?: string | null;
  gitSha?: string | null;
  deployedAt?: string | null;
};

export default function BuildStamp() {
  const [debugEnabled, setDebugEnabled] = useState(process.env.NODE_ENV !== "production");
  const [info, setInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    const isDebugQuery = new URLSearchParams(window.location.search).get("debug") === "1";
    setDebugEnabled(process.env.NODE_ENV !== "production" || isDebugQuery);
  }, []);

  useEffect(() => {
    if (!debugEnabled) return;
    fetch("/api/build", { cache: "no-store" })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (!data?.ok) return;
        setInfo({
          nextBuildId: data.nextBuildId ?? null,
          gitSha: data.gitSha ?? null,
          deployedAt: data.deployedAt ?? null,
        });
      })
      .catch(() => null);
  }, [debugEnabled]);

  if (!debugEnabled) return null;
  const buildId = String(info?.nextBuildId || "").trim() || "unknown";
  const gitSha = String(info?.gitSha || "").trim() || "n/a";
  const deployedAt = String(info?.deployedAt || "").trim() || "n/a";

  return (
    <div className="fixed right-2 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+8px)] z-[170] rounded-md border border-white/20 bg-black/75 px-2 py-1 text-[10px] leading-tight text-white/80 pointer-events-none">
      <div>build: {buildId}</div>
      <div>sha: {gitSha}</div>
      <div>at: {deployedAt}</div>
    </div>
  );
}
