'use client';

import React from 'react';
import { Swords, Coins, Trophy } from 'lucide-react';

export type RecruitMilestone = {
  level: number;
  reward_sigils: number;
};

export type RecruitRow = {
  recruit_user_id: string;
  username: string;
  guild: string | null;
  status?: 'clicked' | 'signed_up' | 'qualified';
  level: number;
  xp: number;
  pitch_slug: string | null;
  active_duels: number;
  claimable_milestones: RecruitMilestone[];
  next_milestone: number | null;
  progress_to_next: number;
  trainer_claimable_sigils: number;
};

type Props = {
  recruit: RecruitRow;
  claimingKey: string | null;
  onClaimMilestone: (recruitUserId: string, milestone: number) => Promise<void>;
};

function guildLabel(guild: string | null): { label: string; cls: string } {
  if (guild === 'sun') return { label: 'Solar Claw', cls: 'text-amber-200 bg-amber-400/15 border-amber-300/25' };
  if (guild === 'moon') return { label: 'Lunar Paw', cls: 'text-cyan-200 bg-cyan-400/15 border-cyan-300/25' };
  return { label: 'No Guild', cls: 'text-white/70 bg-white/10 border-white/15' };
}

export default function RecruitmentCard({ recruit, claimingKey, onClaimMilestone }: Props) {
  const guild = guildLabel(recruit.guild);
  const pct = Math.round(Math.max(0, Math.min(1, recruit.progress_to_next || 0)) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{recruit.username}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70">
            <span className={`rounded-full border px-2 py-0.5 ${guild.cls}`}>{guild.label}</span>
            <span>Lv {recruit.level}</span>
            <span>XP {recruit.xp}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-white/45">Pitch</p>
          <p className="text-[11px] font-semibold text-white/80">{recruit.pitch_slug || 'unknown'}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 border border-white/10 p-2">
          <Swords className="w-3.5 h-3.5 mx-auto text-white/80" />
          <p className="mt-1 text-xs font-bold">{recruit.active_duels}</p>
          <p className="text-[10px] text-white/55">Duels</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-2">
          <Coins className="w-3.5 h-3.5 mx-auto text-emerald-300" />
          <p className="mt-1 text-xs font-bold text-emerald-200">{recruit.trainer_claimable_sigils}</p>
          <p className="text-[10px] text-white/55">Pouch</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-2">
          <Trophy className="w-3.5 h-3.5 mx-auto text-cyan-300" />
          <p className="mt-1 text-xs font-bold">{recruit.next_milestone ? `Lv ${recruit.next_milestone}` : 'Max'}</p>
          <p className="text-[10px] text-white/55">Next</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-white/60">Progress to next milestone</span>
          <span className="text-white/80">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-300 to-cyan-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {recruit.claimable_milestones.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {recruit.claimable_milestones.map((m) => {
            const key = `${recruit.recruit_user_id}:${m.level}`;
            const busy = claimingKey === key;
            return (
              <button
                key={key}
                onClick={() => onClaimMilestone(recruit.recruit_user_id, m.level)}
                disabled={busy}
                className="h-8 rounded-lg border border-emerald-300/35 bg-emerald-400/20 px-2.5 text-[11px] font-bold text-emerald-100 disabled:opacity-60"
              >
                {busy ? 'Claiming...' : `Claim Lv ${m.level} (+${m.reward_sigils})`}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-white/45">No milestone rewards ready yet.</p>
      )}
    </div>
  );
}
