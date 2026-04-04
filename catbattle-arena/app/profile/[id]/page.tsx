'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, LogOut, X } from 'lucide-react';
import { DataLoadError } from '../../components/DataLoadError';
import TrainerHero from '../../components/trainer/TrainerHero';
import TrainerInlineStats from '../../components/trainer/TrainerInlineStats';
import TrainerTabs, { type TrainerTab } from '../../components/trainer/TrainerTabs';
import TrainerOverview from '../../components/trainer/TrainerOverview';
import TrainerMyCats, { type TrainerCat } from '../../components/trainer/TrainerMyCats';
import TrainerActivity, { type TrainerActivityItem } from '../../components/trainer/TrainerActivity';

interface ProfileCat {
  id: string;
  name: string;
  rarity: string;
  status: string;
  wins: number;
  losses: number;
  battles_fought: number;
  level: number;
  image_url: string | null;
  created_at: string;
  stance?: string | null;
  fan_count?: number;
}

interface ProfileResponse {
  ok: boolean;
  is_owner?: boolean;
  profile: { id: string; username: string | null; created_at: string | null; guild?: string | null; tactical_rating?: number };
  progress: { xp: number; level: number; sigils: number };
  streak: { current_streak: number; last_claim_date: string | null };
  submitted_cats: ProfileCat[];
  vote_history: Array<{
    battle_id: string;
    voted_for_name: string;
    against_name: string | null;
    created_at: string;
    resolved?: boolean;
    won?: boolean | null;
  }>;
  signature_cat?: { id: string; name: string; image_url: string | null } | null;
  prediction_stats?: { current_streak: number; best_streak: number; bonus_rolls: number; resolved_count?: number; won_count?: number };
}

function toActivityItems(rows: ProfileResponse['vote_history']): TrainerActivityItem[] {
  return (rows || []).map((row) => ({
    id: `${row.battle_id}-${row.created_at}`,
    icon: row.resolved ? (row.won ? '🎯' : '⚔️') : '⚔️',
    text: row.resolved
      ? row.won
        ? (row.against_name ? `Correct pick: ${row.voted_for_name} beat ${row.against_name}` : `Correct pick: ${row.voted_for_name}`)
        : (row.against_name ? `Missed pick: ${row.voted_for_name} vs ${row.against_name}` : `Missed pick: ${row.voted_for_name}`)
      : row.against_name
        ? `Voted for ${row.voted_for_name} vs ${row.against_name}`
        : `Voted for ${row.voted_for_name}`,
    timestamp: row.created_at,
  }));
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = params?.id as string;

  const [activeTab, setActiveTab] = useState<TrainerTab>('overview');
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [activeModal, setActiveModal] = useState<'share' | 'cat' | 'avatar' | null>(null);
  const [selectedCat, setSelectedCat] = useState<TrainerCat | null>(null);
  const [savingAvatarCatId, setSavingAvatarCatId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    async function load() {
      try {
        const res = await fetch(`/api/profile/${profileId}?t=${Date.now()}`, { cache: 'no-store' });
        const d = await res.json();
        if (!res.ok || !d.ok) {
          setError(d.error || 'Failed to load profile');
        } else {
          setData(d);
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [profileId]);

  useEffect(() => {
    const tab = String(searchParams?.get('tab') || '').trim().toLowerCase();
    if (tab === 'cats') {
      setActiveTab('cats');
      return;
    }
    if (tab === 'history' || tab === 'activity') {
      setActiveTab('activity');
      return;
    }
    setActiveTab('overview');
  }, [searchParams]);

  const usernameDisplay = data?.profile.username || (data?.profile.id ? `Player ${data.profile.id.slice(0, 8)}` : 'Trainer');
  const submittedCats = data?.submitted_cats || [];
  const submittedCatCount = useMemo(
    () => submittedCats.filter((cat) => String(cat.status || '').toLowerCase() !== 'rejected').length,
    [submittedCats]
  );
  const totalVotesCast = data?.vote_history?.length || 0;
  const resolvedPredictions = Math.max(0, Number(data?.prediction_stats?.resolved_count || 0));
  const wonPredictions = Math.max(0, Number(data?.prediction_stats?.won_count || 0));
  const predictionAccuracy = resolvedPredictions > 0 ? Math.round((wonPredictions / resolvedPredictions) * 100) : 0;
  const rank = Math.max(1, Number(data?.profile.tactical_rating || 1));
  const trainerRarity = data?.signature_cat ? (submittedCats.find((cat) => cat.id === data.signature_cat?.id)?.rarity || 'Common') : 'Common';
  const activityItems = useMemo(() => toActivityItems(data?.vote_history || []), [data?.vote_history]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !data?.profile.id) return '';
    return `${window.location.origin}/profile/${encodeURIComponent(data.profile.id)}`;
  }, [data?.profile.id]);

  const buildCats = useMemo(() => submittedCats.slice(0, 3).map((cat) => cat.name), [submittedCats]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore and continue
    }
    router.push('/login');
    router.refresh();
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore
    }
  }

  async function reloadProfile() {
    if (!profileId) return;
    const res = await fetch(`/api/profile/${profileId}?t=${Date.now()}`, { cache: 'no-store' });
    const d = await res.json().catch(() => null);
    if (res.ok && d?.ok) setData(d);
  }

  async function submitAvatarChange(catId: string) {
    if (!catId) return;
    setSavingAvatarCatId(catId);
    setFormError(null);
    try {
      const res = await fetch('/api/profile/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: catId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) {
        setFormError(String(payload?.error || 'Could not update avatar.'));
        return;
      }
      const cat = submittedCats.find((c) => c.id === catId);
      if (cat) {
        setData((prev) => (prev ? { ...prev, signature_cat: { id: cat.id, name: cat.name, image_url: cat.image_url } } : prev));
      } else {
        await reloadProfile();
      }
      setActiveModal(null);
    } finally {
      setSavingAvatarCatId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <DataLoadError
        title="Trainer Profile Unavailable"
        message={error ? 'We couldn\'t load this trainer card right now. Try again in a moment.' : 'That trainer profile isn\'t available right now.'}
        onRetry={() => window.location.reload()}
        showRetryButton={!!error}
        backHref="/"
        backLabel="Back to Home"
      />
    );
  }

  return (
    <div className="page-content min-h-screen bg-[#06050e] text-white pb-[72px]">
      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-white/50 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          {data.is_owner ? (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          ) : null}
        </div>

        <TrainerHero
          username={usernameDisplay}
          avatarUrl={data.signature_cat?.image_url || submittedCats[0]?.image_url || null}
          rarity={trainerRarity}
          streak={data.streak?.current_streak || 0}
          sigils={data.progress?.sigils || 0}
          rank={rank}
          canEditProfile={!!data.is_owner}
          onChangeAvatar={() => {
            setFormError(null);
            setActiveModal('avatar');
          }}
          onSubmitCat={() => router.push('/submit')}
          onViewMyCats={() => setActiveTab('cats')}
        />

        <TrainerInlineStats
          catsCount={submittedCatCount}
          votesCount={totalVotesCast}
          accuracy={predictionAccuracy}
          streak={data.streak?.current_streak || 0}
        />

        <TrainerTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' ? (
          <TrainerOverview
            hasBuild={submittedCats.length > 0}
            buildName={submittedCats.length > 0 ? `${usernameDisplay}'s Build` : null}
            buildCats={buildCats}
            onCreateBuild={() => setActiveTab('cats')}
            onShareProfile={() => setActiveModal('share')}
          />
        ) : null}

        {activeTab === 'cats' ? (
          <TrainerMyCats
            cats={submittedCats}
            onSubmitCat={() => router.push('/submit')}
            onSelectCat={(cat) => {
              setSelectedCat(cat);
              setActiveModal('cat');
            }}
          />
        ) : null}

        {activeTab === 'activity' ? <TrainerActivity items={activityItems} /> : null}
      </div>

      {activeModal === 'share' ? (
        <div className="fixed inset-0 z-[220] bg-black/80 p-4 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b15] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Share Profile</h3>
              <button type="button" onClick={() => setActiveModal(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-white/60">Public URL</p>
            <p className="mt-1 truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90">{shareUrl}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" onClick={copyShareUrl} className="h-10 rounded-lg bg-amber-400 text-sm font-semibold text-black hover:bg-amber-300">Copy Link</button>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 text-sm text-white/85 hover:bg-white/10">Twitter</a>
              <a href={`https://discord.com/channels/@me`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 text-sm text-white/85 hover:bg-white/10">Discord</a>
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === 'cat' && selectedCat ? (
        <div className="fixed inset-0 z-[220] bg-black/80 p-4 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b15] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{selectedCat.name}</h3>
              <button type="button" onClick={() => setActiveModal(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <img src={selectedCat.image_url || '/cat-placeholder.svg'} alt={selectedCat.name} className="h-56 w-full rounded-xl object-cover" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-white/80">Rarity: <span className="text-white">{selectedCat.rarity}</span></div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-white/80">Level: <span className="text-white">{selectedCat.level}</span></div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-white/80">Wins: <span className="text-white">{selectedCat.wins}</span></div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-white/80">Losses: <span className="text-white">{selectedCat.losses}</span></div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Link href={`/cat/${selectedCat.id}`} className="inline-flex h-10 items-center rounded-lg border border-white/20 px-3 text-sm text-white/85 hover:bg-white/10">Open Detail</Link>
              {data.is_owner ? <Link href="/submit" className="inline-flex h-10 items-center rounded-lg bg-amber-400 px-3 text-sm font-semibold text-black hover:bg-amber-300">Edit / Submit</Link> : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === 'avatar' && data.is_owner ? (
        <div className="fixed inset-0 z-[220] bg-black/80 p-4 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
          <div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b15] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Change Avatar</h3>
              <button type="button" onClick={() => setActiveModal(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {submittedCats.map((cat) => {
                const busy = savingAvatarCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={!!savingAvatarCatId}
                    onClick={() => submitAvatarChange(cat.id)}
                    className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left"
                  >
                    <img src={cat.image_url || '/cat-placeholder.svg'} alt={cat.name} className="h-24 w-full object-cover" />
                    <div className="px-2 py-1.5">
                      <p className="truncate text-xs font-semibold text-white">{cat.name}</p>
                      <p className="text-[10px] text-white/55">{busy ? 'Saving...' : 'Set as avatar'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {formError ? <p className="mt-2 text-xs text-rose-300">{formError}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
