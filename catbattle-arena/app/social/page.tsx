'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Copy, Share2, Swords, Trophy, Users } from 'lucide-react';
import { LoadingState } from '../components/LoadingState';
import RecruitmentCard, { type RecruitRow } from '../components/RecruitmentCard';
import { showGlobalToast } from '../lib/global-toast';
import { buttonStyles } from '../components/ui/primitives';

type SocialStats = {
  total_recruits: number;
  qualified_recruits?: number;
  network_recruits?: number;
  active_duels: number;
  sigils_earned: number;
  claimable_pouch: number;
  recruits_value_today: number;
  loyal_recruits: number;
  traitor_recruits: number;
};

type SocialEvent = {
  id: string;
  kind: string;
  message: string;
  reward_sigils: number;
  created_at: string;
  meta?: Record<string, unknown>;
};

type SocialPayload = {
  ok: boolean;
  stats: SocialStats;
  recruits: RecruitRow[];
  share_base: { ref: string; username?: string | null; guild: string | null };
  pitches: Array<{ slug: string; recruits_count: number }>;
  events: SocialEvent[];
  recruit_tree?: {
    rank: string;
    next_rank: string | null;
    points: number;
    points_to_next: number;
    direct_qualified: number;
    network_qualified: number;
    depth_counts: { d1: number; d2: number; d3: number };
  };
  weekly_leaderboard?: Array<{ user_id: string; username: string; qualified: number }>;
};

type GuildStanding = {
  guild: 'sun' | 'moon';
  members: number;
  cats: number;
  wins: number;
  avg_power: number;
  daily_value: number;
};

type GuildPayload = {
  ok: boolean;
  standings: GuildStanding[];
  pledged_guild: 'sun' | 'moon' | null;
  leader_guild: 'sun' | 'moon' | null;
  next_refresh_at: string | null;
};

type CatsMinePayload = {
  ok: boolean;
  cats: Array<{ id: string; name: string }>;
};

const PITCHES = [
  {
    slug: 'challenger',
    title: 'The Challenger',
    copy: "I just minted a cat in CatClash Arena. Think you can beat me? Submit your fighter and let\'s duel!",
  },
  {
    slug: 'beggar',
    title: 'The Beggar',
    copy: 'I need more Sigils for my next crate. Join the arena from my link and help a cat out!',
  },
  {
    slug: 'pro',
    title: 'The Pro',
    copy: "Join my guild in CatClash and let\'s climb the leaderboard together.",
  },
] as const;

const SOCIAL_STEPS = [
  'Claim your pouch if it is ready.',
  'Pick a pitch and copy or share your link.',
  'Watch recruits and milestones fill the page.',
];

function guildName(guild: string | null): string {
  if (guild === 'sun') return 'Solar Claw';
  if (guild === 'moon') return 'Lunar Paw';
  return 'Unpledged';
}

export default function SocialPage() {
  const [loading, setLoading] = useState(true);
  const [social, setSocial] = useState<SocialPayload | null>(null);
  const [guild, setGuild] = useState<GuildPayload | null>(null);
  const [primaryCatId, setPrimaryCatId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<(typeof PITCHES)[number]['slug']>('challenger');
  const [claimingPouch, setClaimingPouch] = useState(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [socialRes, guildRes, catsRes] = await Promise.all([
      fetch('/api/social/recruits', { cache: 'no-store' }).then((r) => r.json().catch(() => ({ ok: false }))),
      fetch('/api/guild/standings', { cache: 'no-store' }).then((r) => r.json().catch(() => ({ ok: false }))),
      fetch('/api/cats/mine', { cache: 'no-store' }).then((r) => r.json().catch(() => ({ ok: false }))),
    ]);

    if (socialRes?.ok) setSocial(socialRes as SocialPayload);
    if (guildRes?.ok) setGuild(guildRes as GuildPayload);
    if (catsRes?.ok) {
      const catsPayload = catsRes as CatsMinePayload;
      setPrimaryCatId(catsPayload.cats?.[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch(() => {
        if (active) showGlobalToast('Failed to load social hub. Pull to refresh.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const selectedPitchObj = useMemo(() => PITCHES.find((p) => p.slug === selectedPitch) || PITCHES[0], [selectedPitch]);

  const referralUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const ref = social?.share_base?.ref || '';
    const username = String(social?.share_base?.username || '').trim();
    const guildId = social?.share_base?.guild || '';
    const target = primaryCatId || '';
    const path = username ? `/r/${encodeURIComponent(username)}` : (target ? `/cat/${encodeURIComponent(target)}` : '/');
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    if (guildId) params.set('guild', guildId);
    params.set('pitch', selectedPitchObj.slug);
    if (target) params.set('target', target);
    return base ? `${base}${path}?${params.toString()}` : `${path}?${params.toString()}`;
  }, [primaryCatId, selectedPitchObj.slug, social?.share_base?.guild, social?.share_base?.ref]);

  const shareText = useMemo(() => `${selectedPitchObj.copy} ${referralUrl}`, [selectedPitchObj.copy, referralUrl]);

  async function copyPitch() {
    try {
      await navigator.clipboard.writeText(shareText);
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'referral_link_copied', payload: { pitch: selectedPitchObj.slug } }),
      }).catch(() => null);
      showGlobalToast('Recruit link copied');
    } catch {
      showGlobalToast('Copy failed');
    }
  }

  async function sharePitch() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'CatClash Recruit Link',
          text: selectedPitchObj.copy,
          url: referralUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'recruit_shared', payload: { pitch: selectedPitchObj.slug } }),
      }).catch(() => null);
      showGlobalToast('Shared to socials');
    } catch {
      showGlobalToast('Share canceled');
    }
  }

  async function claimPouch() {
    if (claimingPouch) return;
    setClaimingPouch(true);
    try {
      const res = await fetch('/api/social/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'pouch' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showGlobalToast(data?.error || 'Claim failed');
        return;
      }
      if (data?.disabled) {
        showGlobalToast(data?.message || 'Referral sigil pouch disabled');
        return;
      }
      showGlobalToast(data.awarded > 0 ? `Claimed +${data.awarded} sigils` : 'No pouch rewards yet');
      await load();
    } catch {
      showGlobalToast('Claim failed');
    } finally {
      setClaimingPouch(false);
    }
  }

  async function claimMilestone(recruitUserId: string, milestone: number) {
    const key = `${recruitUserId}:${milestone}`;
    if (claimingKey) return;
    setClaimingKey(key);
    try {
      const res = await fetch('/api/social/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'milestone', recruit_user_id: recruitUserId, milestone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        showGlobalToast(data?.error || 'Milestone claim failed');
        return;
      }
      if (Number(data?.bonus_rolls_awarded || 0) > 0) {
        showGlobalToast(`Milestone claimed +${Number(data.bonus_rolls_awarded)} bonus roll`);
      } else {
        showGlobalToast(data.awarded > 0 ? `Milestone claimed +${data.awarded}` : 'Already claimed');
      }
      await load();
    } catch {
      showGlobalToast('Milestone claim failed');
    } finally {
      setClaimingKey(null);
    }
  }

  const stats = social?.stats;

  return (
    <div className="min-h-screen bg-black px-3 pt-4 text-white pb-28 sm:px-4 sm:pb-8 sm:pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-xs rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
            Social Hub
          </span>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-emerald-500/10 p-5 sm:mb-8 sm:p-6">
          <p className="text-xs uppercase tracking-wide text-cyan-200">Guild Commander</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black">Recruit & Rule</h1>
          <p className="mt-1 text-base leading-relaxed text-white/80">
            Your referrals now feed your faction power. Recruit rivals, grow your guild, and claim your trainer cut.
          </p>
          {social?.share_base?.guild && (
            <p className="mt-2 text-sm text-emerald-200/85">
              Active guild: {guildName(social.share_base.guild)}. New recruits from your link are pre-pledged.
            </p>
          )}
        </div>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:mb-8 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-cyan-200">Start here</p>
              <h2 className="text-base font-bold">How Social Works</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white/70">Clear path</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {SOCIAL_STEPS.map((step, index) => (
              <div key={step} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/70">Step {index + 1}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/78">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4">
            <LoadingState icon="🏰" message="Building the hall..." />
            <div className="grid gap-3 sm:gap-4" aria-hidden="true">
              <div className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
              <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
              <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-3 gap-3 sm:mb-8 sm:gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <Users className="w-4 h-4 mx-auto text-cyan-300" />
                <p className="mt-1 text-lg font-black">{stats?.total_recruits || 0}</p>
                <p className="text-xs text-white/50">Total Recruits</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <Swords className="w-4 h-4 mx-auto text-purple-300" />
                <p className="mt-1 text-lg font-black">{stats?.active_duels || 0}</p>
                <p className="text-xs text-white/50">Active Duels</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <Coins className="w-4 h-4 mx-auto text-emerald-300" />
                <p className="mt-1 text-lg font-black">{stats?.sigils_earned || 0}</p>
                <p className="text-xs text-white/50">Sigils Earned</p>
              </div>
            </div>

            <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:mb-8 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-cyan-200">Recruit Tree</p>
                  <h2 className="text-base font-bold">{social?.recruit_tree?.rank || 'Unranked'}</h2>
                  <p className="text-xs text-white/50">
                    Direct {social?.recruit_tree?.direct_qualified || 0} · Network {social?.recruit_tree?.network_qualified || 0}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-white">{social?.recruit_tree?.points || 0} pts</p>
                  <p className="text-[10px] text-white/45">
                    {social?.recruit_tree?.next_rank ? `${social.recruit_tree.points_to_next} to ${social.recruit_tree.next_rank}` : 'Max rank'}
                  </p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <p className="text-xs text-white/50">Depth 1</p>
                  <p className="text-sm font-bold">{social?.recruit_tree?.depth_counts?.d1 || 0}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <p className="text-xs text-white/50">Depth 2</p>
                  <p className="text-sm font-bold">{social?.recruit_tree?.depth_counts?.d2 || 0}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <p className="text-xs text-white/50">Depth 3</p>
                  <p className="text-sm font-bold">{social?.recruit_tree?.depth_counts?.d3 || 0}</p>
                </div>
              </div>
              {!!social?.weekly_leaderboard?.length && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-white/55">Weekly Recruit Rush</p>
                  <div className="space-y-1.5">
                    {social.weekly_leaderboard.slice(0, 5).map((row, idx) => (
                      <div key={`wk-${row.user_id}`} className="rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 flex items-center justify-between text-xs">
                        <span className="text-white/80">{idx + 1}. {row.username}</span>
                        <span className="text-cyan-200 font-semibold">{row.qualified} qualified</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-base font-bold">War Room</h2>
                  <div className="text-xs text-white/50">Recruit Value Today: +{stats?.recruits_value_today || 0}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(guild?.standings || []).map((g) => {
                    const active = guild?.pledged_guild === g.guild;
                    const isLeader = guild?.leader_guild === g.guild;
                    return (
                      <div
                        key={g.guild}
                        className={`rounded-xl border p-2.5 ${active ? 'border-cyan-300/35 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03]'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold">{g.guild === 'sun' ? 'Solar Claw' : 'Lunar Paw'}</p>
                          {isLeader && <Trophy className="w-3.5 h-3.5 text-amber-300" />}
                        </div>
                        <p className="text-xs text-white/50">Value {g.daily_value}</p>
                        <p className="text-xs text-white/50">Members {g.members}</p>
                        <p className="text-xs text-white/50">Wins {g.wins}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-2 text-center">
                    <p className="text-[10px] text-emerald-200/85 uppercase tracking-wide">Loyalists</p>
                    <p className="text-sm font-black text-emerald-100">{stats?.loyal_recruits || 0}</p>
                  </div>
                  <div className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-2 text-center">
                    <p className="text-[10px] text-rose-200/85 uppercase tracking-wide">Traitors</p>
                    <p className="text-sm font-black text-rose-100">{stats?.traitor_recruits || 0}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-2.5">
                  <p className="text-sm font-semibold text-emerald-100">Trainer&apos;s Cut</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    Recruit progress boosts your rank and status here, while milestone claims grant bonus rolls.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">Share My Link</h2>
                  <button
                    onClick={claimPouch}
                    disabled={claimingPouch}
                    className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'px-2.5 text-xs' })}
                  >
                    {claimingPouch ? 'Claiming...' : `Claim Pouch (+${stats?.claimable_pouch || 0})`}
                  </button>
                </div>

                <div className="space-y-2">
                  {PITCHES.map((p) => {
                    const selected = selectedPitch === p.slug;
                    return (
                      <button
                        key={p.slug}
                        onClick={() => setSelectedPitch(p.slug)}
                        className={`focus-ring w-full rounded-xl border p-2.5 text-left transition-all duration-150 active:translate-y-[1px] ${selected ? 'scale-[1.02] border-cyan-300/35 bg-cyan-400/10 shadow-md' : 'border-white/10 bg-white/[0.03]'}`}
                      >
                        <p className="text-sm font-bold">{p.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/55">{p.copy}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-2.5">
                  <p className="text-xs text-white/50">Referral link</p>
                  <p className="mt-1 break-all text-xs text-cyan-200">{referralUrl}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={copyPitch} className={buttonStyles({ variant: 'secondary', size: 'md', className: 'gap-1.5 text-xs' })}>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button onClick={sharePitch} className={buttonStyles({ variant: 'primary', size: 'xl', className: 'gap-1.5 text-xs' })}>
                      <Share2 className="w-3.5 h-3.5" /> Recruit Soldiers
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:mt-8 sm:p-5">
              <h2 className="mb-3 text-base font-bold">Recruit Stable</h2>
              {social?.recruits?.length ? (
                <div className="space-y-3">
                  {social.recruits.map((r) => (
                    <RecruitmentCard
                      key={r.recruit_user_id}
                      recruit={r}
                      claimingKey={claimingKey}
                      onClaimMilestone={claimMilestone}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-white/55">No recruits yet. Share your link from the section above to start building your stable.</p>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:mt-8 sm:p-5">
              <h2 className="mb-2 text-base font-bold">Recent Activity</h2>
              {social?.events?.length ? (
                <div className="space-y-2">
                  {social.events.slice(0, 8).map((e) => (
                    <div key={e.id} className="rounded-xl border border-white/10 bg-black/40 p-2.5">
                      <p className="text-xs text-white/85">{e.message}</p>
                      <p className="mt-1 text-xs text-emerald-200">{e.reward_sigils > 0 ? `+${e.reward_sigils} sigils` : 'Social update'}</p>
                      {typeof e.meta?.action_url === 'string' && String(e.meta.action_url).trim() && (
                        <Link
                          href={String(e.meta.action_url)}
                          className="mt-2 inline-flex h-7 items-center justify-center rounded-lg bg-rose-500/80 px-2.5 text-xs font-bold text-white hover:bg-rose-500"
                        >
                          {typeof e.meta?.action_label === 'string' && String(e.meta.action_label).trim()
                            ? String(e.meta.action_label)
                            : 'Challenge Now'}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-white/55">No activity yet. Recruit someone or claim a reward to start the feed.</p>
              )}
            </section>
          </>
        )}
      </div>

      <div className="sm:hidden fixed left-4 right-4 z-[60]" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
        <button
          onClick={sharePitch}
          className="w-full h-11 rounded-xl bg-emerald-400 text-black text-sm font-black shadow-[0_12px_30px_rgba(16,185,129,0.35)] inline-flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" /> Recruit for {guildName(social?.share_base?.guild || null)}
        </button>
      </div>

    </div>
  );
}
