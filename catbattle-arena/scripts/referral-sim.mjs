#!/usr/bin/env node

/**
 * CatClash Recruit Growth Monte Carlo Simulation
 * Usage:
 *   node scripts/referral-sim.mjs
 *   node scripts/referral-sim.mjs --audience=300000 --reach=100000 --days=14 --iterations=10000
 */

function parseArg(name, fallback) {
  const key = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(key));
  if (!hit) return fallback;
  const raw = hit.slice(key.length);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pickTriangular(min, mode, max) {
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u <= c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

const cfg = {
  audienceSize: parseArg('audience', 300000),
  reachPerPost: parseArg('reach', 100000),
  days: parseArg('days', 14),
  iterations: parseArg('iterations', 10000),
  ctr: { low: 0.003, med: 0.008, high: 0.015 },
  signupConv: { low: 0.1, med: 0.18, high: 0.28 },
  qualifyConv: { low: 0.35, med: 0.5, high: 0.65 },
  shareRate: { low: 0.06, med: 0.1, high: 0.16 },
  invitesPerSharer: { low: 1.2, med: 1.8, high: 2.6 },
  damping: parseArg('damping', 0.75),
};

const runs = [];
for (let i = 0; i < cfg.iterations; i += 1) {
  const ctr = pickTriangular(cfg.ctr.low, cfg.ctr.med, cfg.ctr.high);
  const signupConv = pickTriangular(cfg.signupConv.low, cfg.signupConv.med, cfg.signupConv.high);
  const qualifyConv = pickTriangular(cfg.qualifyConv.low, cfg.qualifyConv.med, cfg.qualifyConv.high);
  const shareRate = pickTriangular(cfg.shareRate.low, cfg.shareRate.med, cfg.shareRate.high);
  const invitesPerSharer = pickTriangular(cfg.invitesPerSharer.low, cfg.invitesPerSharer.med, cfg.invitesPerSharer.high);

  let totalClicks = 0;
  let totalSignups = 0;
  let totalQualified = 0;
  let generationInvites = cfg.reachPerPost * ctr;
  const genDepth = [];
  const daily = [];

  for (let day = 1; day <= cfg.days; day += 1) {
    const clicks = Math.max(0, Math.round(generationInvites));
    const signups = Math.max(0, Math.round(clicks * signupConv));
    const qualified = Math.max(0, Math.round(signups * qualifyConv));
    const sharers = Math.max(0, Math.round(qualified * shareRate));
    const invites = Math.max(0, Math.round(sharers * invitesPerSharer));

    totalClicks += clicks;
    totalSignups += signups;
    totalQualified += qualified;
    genDepth.push(invites);
    daily.push({ day, clicks, signups, qualified, invites });

    generationInvites = invites * cfg.damping;
  }

  runs.push({
    totalClicks,
    totalSignups,
    totalQualified,
    maxDailyQualified: Math.max(...daily.map((d) => d.qualified), 0),
    daily,
    genDepth,
  });
}

const sortedSignups = runs.map((r) => r.totalSignups).sort((a, b) => a - b);
const sortedQualified = runs.map((r) => r.totalQualified).sort((a, b) => a - b);
const sortedPeakDaily = runs.map((r) => r.maxDailyQualified).sort((a, b) => a - b);

const summary = {
  config: cfg,
  outcomes: {
    signups: {
      p50: percentile(sortedSignups, 50),
      p75: percentile(sortedSignups, 75),
      p90: percentile(sortedSignups, 90),
    },
    qualified: {
      p50: percentile(sortedQualified, 50),
      p75: percentile(sortedQualified, 75),
      p90: percentile(sortedQualified, 90),
    },
    maxDailyQualified: {
      p50: percentile(sortedPeakDaily, 50),
      p75: percentile(sortedPeakDaily, 75),
      p90: percentile(sortedPeakDaily, 90),
    },
  },
  riskFlags: {
    infraWarning: percentile(sortedPeakDaily, 90) > 2500,
    abuseWatch: percentile(sortedQualified, 90) / Math.max(1, percentile(sortedSignups, 90)) > 0.9,
  },
  recommendations: {
    qualifiedDailyCapPerInviter: percentile(sortedPeakDaily, 75) > 500 ? 25 : 40,
    ipThrottling: 'Enable/keep referral visit per-IP throttles and dedupe keys.',
    rewardMode: 'Keep recurring rewards non-sigil; use cosmetic/bonus_roll for depth.',
  },
};

console.log(JSON.stringify(summary, null, 2));
