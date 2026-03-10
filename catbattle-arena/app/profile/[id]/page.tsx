'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import CosmeticFrame from '../../components/cosmetics/CosmeticFrame';
import CosmeticTitle from '../../components/cosmetics/CosmeticTitle';
import CosmeticThemeProvider from '../../components/cosmetics/CosmeticThemeProvider';
import { cosmeticBorderClassFromSlug, cosmeticTextClassFromSlug } from '../../_lib/cosmetics/effectsRegistry';

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
  cheer_count?: number;
  origin?: string | null;
  prestige_weight?: number;
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
  }>;
  equipped_cosmetics: Array<{ slot: string; cosmetic: { slug: string; name: string; rarity: string; category: string } | null }>;
  recruit_stats?: {
    active_recruits: number;
    direct_qualified: number;
    claimable_sigils: number;
    total_sigils_earned: number;
  };
  recent_receipts?: Array<{
    slug: string;
    name: string;
    rarity: string;
    power_rating: number;
    image_url: string;
    minted_at: string;
  }>;
  rivalries?: Array<{ cat_id: string; cat_name: string; battles: number }>;
  most_supported_cat?: { id: string; name: string; fan_count: number } | null;
  signature_cat?: { id: string; name: string; image_url: string | null } | null;
  prediction_stats?: { current_streak: number; best_streak: number; bonus_rolls: number };
}

interface OwnedCosmetic {
  id: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  description: string | null;
  owned: boolean;
  equipped_slot: string | null;
}

function cosmeticTypeLabel(c: OwnedCosmetic): string {
  if (c.slug.startsWith('vote-')) return 'vote effect';
  if (c.slug.startsWith('badge-')) return 'voter badge';
  return c.category.replace(/_/g, ' ');
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = params?.id as string;
  const [activeSection, setActiveSection] = useState<'overview' | 'cats' | 'history'>('overview');
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [pinningCatId, setPinningCatId] = useState<string | null>(null);
  const [ownedCosmetics, setOwnedCosmetics] = useState<OwnedCosmetic[]>([]);
  const [equippingSlug, setEquippingSlug] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
          setNewUsername(d.profile?.username || '');
        }
      } catch {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profileId]);
  useEffect(() => {
    const hidden = localStorage.getItem('tip_profile_cosmetics_v1') === '1';
    setShowTip(!hidden);
  }, []);

  useEffect(() => {
    const tab = String(searchParams?.get('tab') || '').trim().toLowerCase();
    if (tab === 'cats') {
      setActiveSection('cats');
      return;
    }
    if (tab === 'history') {
      setActiveSection('history');
      return;
    }
    setActiveSection('overview');
  }, [searchParams]);

  useEffect(() => {
    if (!data?.is_owner) return;
    async function loadOwned() {
      try {
        const res = await fetch('/api/shop/catalog', { cache: 'no-store' });
        const d = await res.json();
        if (res.ok && d.ok) {
          setOwnedCosmetics((d.cosmetics || []).filter((c: OwnedCosmetic) => c.owned && c.category !== 'xp_boost'));
        }
      } catch {
        // ignore
      }
    }
    loadOwned();
  }, [data?.is_owner]);


  const totalWins = useMemo(() => (data?.submitted_cats || []).reduce((a, c) => a + (c.wins || 0), 0), [data]);
  const submittedCatCount = useMemo(
    () => (data?.submitted_cats || []).filter((c) => String(c.origin || 'submitted') === 'submitted').length,
    [data]
  );
  const activeTitle = data?.equipped_cosmetics.find((e) => e.slot === 'title')?.cosmetic?.name || null;
  const activeTitleSlug = data?.equipped_cosmetics.find((e) => e.slot === 'title')?.cosmetic?.slug || null;
  const activeBorderSlug = data?.equipped_cosmetics.find((e) => e.slot === 'border')?.cosmetic?.slug || null;
  const activeColorSlug = data?.equipped_cosmetics.find((e) => e.slot === 'color')?.cosmetic?.slug || null;
  const profileAccentClass = cosmeticTextClassFromSlug(activeColorSlug);
  const guildLabel = data?.profile.guild === 'sun'
    ? 'Solar Claw'
    : data?.profile.guild === 'moon'
      ? 'Lunar Paw'
      : 'No guild pledged';
  const usernameDisplay = data?.profile.username || `Player ${data?.profile.id.slice(0, 8)}`;
  const shortUserId = data?.profile.id ? `${data.profile.id.slice(0, 8)}…${data.profile.id.slice(-4)}` : '';
  const predictionCurrent = data?.prediction_stats?.current_streak || 0;
  const predictionBest = Math.max(predictionCurrent, data?.prediction_stats?.best_streak || 0);
  const predictionProgress = predictionBest > 0 ? Math.min(100, Math.round((predictionCurrent / predictionBest) * 100)) : 0;
  const activityItems = data?.vote_history || [];
  const showCosmeticsSection = (data?.equipped_cosmetics.length || 0) > 0 || (data?.is_owner && ownedCosmetics.length > 0);
  const recentReceipts = data?.recent_receipts || [];
  const showOverview = activeSection === 'overview';
  const showCats = activeSection === 'cats';
  const showHistory = activeSection === 'history';
  const statPills = [
    { label: 'Level', value: String(data?.progress.level || 0), tone: 'profile-pill-value--violet' },
    { label: 'XP', value: (data?.progress.xp || 0).toLocaleString(), tone: 'profile-pill-value--gold' },
    { label: 'Sigils', value: (data?.progress.sigils || 0).toLocaleString(), tone: 'profile-pill-value--violet' },
    { label: 'Cat Wins', value: totalWins.toLocaleString(), tone: totalWins > 0 ? 'profile-pill-value--violet' : 'profile-pill-value--dim' },
    { label: 'Tactical', value: String(data?.profile.tactical_rating || 0), tone: 'profile-pill-value--dim' },
    { label: 'Predict', value: String(predictionCurrent), tone: predictionCurrent > 0 ? 'profile-pill-value--teal' : 'profile-pill-value--dim' },
  ];

  async function equipFromProfile(slug: string) {
    if (!data?.is_owner || equippingSlug) return;
    setEquippingSlug(slug);
    setNameMessage(null);
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setNameMessage(result.error || 'Failed to equip');
      } else {
        setOwnedCosmetics((prev) =>
          prev.map((c) => ({
            ...c,
            equipped_slot: c.slug === slug ? result.slot : (c.equipped_slot === result.slot ? null : c.equipped_slot),
          }))
        );
        setNameMessage('Cosmetic equipped');
      }
    } catch {
      setNameMessage('Failed to equip');
    } finally {
      setEquippingSlug(null);
    }
  }

  async function saveUsername() {
    if (!data?.is_owner || savingName) return;
    setSavingName(true);
    setNameMessage(null);
    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setNameMessage(result.error || 'Failed to update username');
      } else {
        if (result.linked_existing_profile && result.user_id) {
          window.location.href = `/profile/${result.user_id}`;
          return;
        }
        setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, username: result.username } } : prev));
        setEditingName(false);
        setNameMessage('Username updated');
      }
    } catch {
      setNameMessage('Failed to update username');
    } finally {
      setSavingName(false);
    }
  }


  async function pinSignature(catId: string) {
    if (!data?.is_owner || pinningCatId) return;
    setPinningCatId(catId);
    try {
      const res = await fetch('/api/profile/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: catId }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setNameMessage(result.error || 'Failed to pin signature cat');
      } else {
        const picked = data.submitted_cats.find((c) => c.id === catId);
        setData((prev) => prev ? { ...prev, signature_cat: picked ? { id: picked.id, name: picked.name, image_url: picked.image_url } : prev.signature_cat } : prev);
        setNameMessage('Signature cat updated');
      }
    } catch {
      setNameMessage('Failed to pin signature cat');
    } finally {
      setPinningCatId(null);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore and continue redirect
    }
    router.push('/login');
    router.refresh();
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white/50 mb-3">{error || 'Profile not found'}</p>
          <Link href="/" className="text-white/70 hover:text-white">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content min-h-screen bg-[#06050e] text-white pb-[72px] sm:pb-[72px]">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          {data.is_owner && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          )}
        </div>

        <CosmeticThemeProvider colorSlug={activeColorSlug}>
        <CosmeticFrame borderSlug={activeBorderSlug} className="profile-hero-shell mb-6 overflow-hidden p-0">
          <div className="profile-hero">
            <div className="profile-hero-bg" />
            <div className="profile-hero-content">
              <div className="profile-hero-avatar-wrap">
                {data.signature_cat?.image_url ? (
                  <img src={data.signature_cat.image_url} alt={data.signature_cat.name} className="profile-hero-avatar object-cover" />
                ) : (
                  <div className="profile-hero-avatar profile-hero-avatar--placeholder">
                    {(usernameDisplay || 'P').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="profile-hero-avatar-orbit" />
                <div className="profile-hero-level-badge">LVL {data.progress.level}</div>
              </div>

              <div className="min-w-0 flex-1">
                <h1 className={`profile-hero-name ${profileAccentClass}`}>{usernameDisplay}</h1>
                {activeTitle && (
                  <p className="mt-1 text-[11px] uppercase tracking-wider">
                    <CosmeticTitle title={activeTitle} titleSlug={activeTitleSlug} />
                  </p>
                )}
                <p className="profile-hero-uid">UID {shortUserId}</p>
                <div className="profile-hero-badges">
                  <span className="profile-hero-chip">{guildLabel}</span>
                  <span className="profile-hero-chip">XP {data.progress.xp.toLocaleString()}</span>
                </div>
                {data.signature_cat && (
                  <p className="mt-3 text-xs text-white/58">
                    Signature Cat: <Link href={`/cat/${data.signature_cat.id}`} className="text-white hover:underline">{data.signature_cat.name}</Link>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="stat-pills">
            {statPills.map((pill) => (
              <div key={pill.label} className="stat-pill">
                <span className={`stat-pill-value ${pill.tone}`}>{pill.value}</span>
                <span className="stat-pill-label">{pill.label}</span>
              </div>
            ))}
          </div>
        </CosmeticFrame>
        </CosmeticThemeProvider>

        <div className="profile-sections">
          <button
            type="button"
            className={`ps-tab ${showOverview ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`ps-tab ${showCats ? 'active' : ''}`}
            onClick={() => setActiveSection('cats')}
          >
            My Cats
          </button>
          <button
            type="button"
            className={`ps-tab ${showHistory ? 'active' : ''}`}
            onClick={() => setActiveSection('history')}
          >
            History
          </button>
        </div>

        <div className="grid gap-6">
          {showOverview ? (
            <>
          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">Trainer Identity</h2></div>
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="flex items-center gap-3 text-white/75">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">✦</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Public trainer identity</p>
                    <p className="text-xs text-white/55">Public trainer pages and Battle Receipts turn this profile into a share target, not just a settings screen.</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/r/${encodeURIComponent(data.profile.username || data.profile.id)}`} className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-400/15">
                    Open Recruit Card
                  </Link>
                  {recentReceipts[0] ? (
                    <Link href={`/c/${encodeURIComponent(recentReceipts[0].slug)}/share`} className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-400/15">
                      Latest Battle Receipt
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4">
                <p className="text-xs text-white/50">Guild</p>
                <p className="mt-1 font-semibold text-white">{guildLabel}</p>
                {data.most_supported_cat ? (
                  <p className="mt-3 text-xs text-white/55">
                    Most Supported: <Link href={`/cat/${data.most_supported_cat.id}`} className="text-white hover:underline">{data.most_supported_cat.name}</Link> ({data.most_supported_cat.fan_count} fans)
                  </p>
                ) : null}
              </div>
            </div>
            {data.is_owner && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs text-white/55">Edit your public trainer identity</p>
                  <Link href="/shop" className="rounded-lg bg-yellow-500/20 px-2.5 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-500/30">Open Shop</Link>
                </div>
                {editingName ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                    />
                    <button onClick={saveUsername} disabled={savingName} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
                      {savingName ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingName(false); setNewUsername(data.profile.username || ''); }} className="rounded-lg bg-white/10 px-4 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditingName(true)} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
                    Edit Username
                  </button>
                )}
                {nameMessage && <p className="mt-2 text-xs text-white/60">{nameMessage}</p>}
              </div>
            )}
          </section>

          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">Recruit Loop</h2></div>
            <div className="grid gap-2 text-sm">
              <div className="profile-stat-row"><span>Active recruits</span><span>{data.recruit_stats?.active_recruits || 0}</span></div>
              <div className="profile-stat-row"><span>Qualified</span><span>{data.recruit_stats?.direct_qualified || 0}</span></div>
              <div className="profile-stat-row"><span>Claimable sigils</span><span>{(data.recruit_stats?.claimable_sigils || 0).toLocaleString()}</span></div>
            </div>
          </section>

          {showCosmeticsSection ? (
            <section className="profile-section-card">
              <div className="profile-section-title-wrap"><h2 className="profile-section-title">Cosmetics</h2></div>
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Equipped Slots</p>
                    {data.is_owner ? <Link href="/shop" className="rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-white/15">Shop</Link> : null}
                  </div>
                  <div className="grid gap-2">
                    {(data.equipped_cosmetics.length === 0 ? [
                      { slot: 'Title', cosmetic: null },
                      { slot: 'Border', cosmetic: null },
                      { slot: 'Effect', cosmetic: null },
                      { slot: 'Badge', cosmetic: null },
                    ] : data.equipped_cosmetics).slice(0, 4).map((e, idx) => (
                      <div key={`${e.slot}-${idx}`} className="rounded-lg border border-white/8 bg-white/[0.03] p-3 flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{e.slot}</p>
                        <p className="text-sm text-white/78">{e.cosmetic?.name || 'Empty'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {showTip && (
                    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs text-white/65">Tips: equip titles, borders, colors, and effects here after buying them in Shop.</p>
                        <button onClick={() => { localStorage.setItem('tip_profile_cosmetics_v1', '1'); setShowTip(false); }} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
                          Got it
                        </button>
                      </div>
                    </div>
                  )}
                  {data.is_owner ? (
                    <div className="grid gap-2 max-h-[280px] overflow-auto pr-1">
                      {ownedCosmetics.length === 0 ? (
                        <div className="profile-empty-state">
                          <p className="text-lg opacity-30">✨</p>
                          <p>No cosmetics owned yet.</p>
                          <p className="profile-empty-sub">Visit the shop to start building your look.</p>
                        </div>
                      ) : ownedCosmetics.map((c) => (
                        <div key={c.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{c.name}</p>
                            <p className="text-[11px] text-white/50">{cosmeticTypeLabel(c)} · {c.rarity}</p>
                          </div>
                          <button onClick={() => equipFromProfile(c.slug)} disabled={!!equippingSlug || !!c.equipped_slot} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs disabled:opacity-50 hover:bg-white/20">
                            {c.equipped_slot ? 'Equipped' : (equippingSlug === c.slug ? '...' : 'Equip')}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="profile-empty-state">
                      <p className="text-lg opacity-30">🎴</p>
                      <p>No cosmetics visible here.</p>
                      <p className="profile-empty-sub">Owned cosmetics only appear for the account owner.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">Prediction Streak</h2></div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-white/50">Current Streak</p>
                  <p className="mt-1 text-4xl font-black text-white">{predictionCurrent}</p>
                </div>
                <div className="text-right text-xs text-white/50">
                  <p>Best {predictionBest}</p>
                  <p>Bonus Rolls {(data.prediction_stats?.bonus_rolls || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-violet-400/80" style={{ width: `${predictionProgress}%` }} />
              </div>
            </div>
          </section>
            </>
          ) : null}

          {(showOverview || showHistory) ? (
          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">Activity</h2></div>
            {activityItems.length === 0 ? (
              <div className="profile-empty-state">
                <p className="text-lg opacity-30">🌌</p>
                <p>No battles recorded yet. Enter the Arena to start.</p>
                <p className="profile-empty-sub">Recent activity will appear here once voting starts.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {activityItems.map((v) => (
                  <div key={`${v.battle_id}-${v.created_at}`} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-sm">
                      Voted for <span className="font-bold">{v.voted_for_name}</span>
                      {v.against_name ? ` vs ${v.against_name}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-white/45">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          ) : null}

          {(showOverview || showCats) ? (
          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">My Cats</h2></div>
            {data.is_owner ? (
              <div className="mb-3 flex items-center justify-end">
                <Link href="/submit" className="rounded-lg border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-400/15">
                  Submit a Cat
                </Link>
              </div>
            ) : null}
            {data.submitted_cats.length === 0 ? (
              <div className="profile-empty-state">
                <p className="text-lg opacity-30">🐾</p>
                <p>No cats submitted yet.</p>
                <p className="profile-empty-sub">Submit a cat to start building your roster.</p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.submitted_cats.map((cat) => (
                  <Link key={cat.id} href={`/cat/${cat.id}`} className={`block rounded-xl bg-white/5 border p-3 hover:bg-white/10 transition-colors ${cosmeticBorderClassFromSlug(activeBorderSlug)}`}>
                    <div className="flex gap-3">
                      <img src={cat.image_url || '/cat-placeholder.svg'} alt={cat.name} className="w-14 h-14 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{cat.name}</p>
                        <p className="text-xs text-white/50">{cat.rarity} · {cat.status} · Lvl {cat.level}</p>
                        <p className="text-xs text-white/40">W {cat.wins} / L {cat.losses} · Fans {cat.fan_count || 0}</p>
                        {cat.stance ? <p className="text-[10px] uppercase text-cyan-300">Stance: {cat.stance}</p> : null}
                      </div>
                      {data.is_owner && (
                        <button
                          onClick={(e) => { e.preventDefault(); pinSignature(cat.id); }}
                          disabled={!!pinningCatId}
                          className="rounded-md bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20"
                        >
                          {pinningCatId === cat.id ? 'Pinning...' : 'Pin'}
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          ) : null}

          {showOverview ? (
          <section className="profile-section-card">
            <div className="profile-section-title-wrap"><h2 className="profile-section-title">Account</h2></div>
            <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="grid gap-2 text-sm">
                <div className="rounded-xl bg-white/[0.03] p-3">
                  <p className="text-xs text-white/50 mb-1">User ID</p>
                  <p className="break-all text-white/80">{data.profile.id}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-3">
                  <p className="text-xs text-white/50 mb-1">Submitted Cats</p>
                  <p className="text-white/80">{submittedCatCount}</p>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Battle Receipts</p>
                  {recentReceipts[0] ? (
                    <Link href={`/c/${encodeURIComponent(recentReceipts[0].slug)}/share`} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-white/15">
                      Open Latest
                    </Link>
                  ) : null}
                </div>
                {recentReceipts.length === 0 ? (
                  <div className="profile-empty-state">
                    <p className="text-lg opacity-30">🧾</p>
                    <p>No battle receipts yet.</p>
                    <p className="profile-empty-sub">Mint a share card from any cat profile to start your receipt feed.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentReceipts.map((receipt) => (
                      <Link key={receipt.slug} href={`/c/${encodeURIComponent(receipt.slug)}/share`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05]">
                        <img src={receipt.image_url} alt={receipt.name} className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-bold text-white">{receipt.name}</p>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55">{receipt.rarity}</span>
                          </div>
                          <p className="mt-2 text-xs text-white/55">Power {receipt.power_rating} · {new Date(receipt.minted_at).toLocaleDateString()}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
