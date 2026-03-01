'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Flame, Sparkles, Loader2, Trophy, LogOut } from 'lucide-react';
import SigilIcon from '../../components/icons/SigilIcon';
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
  const profileId = params?.id as string;
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
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-6">
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
        <CosmeticFrame borderSlug={activeBorderSlug} className="bg-white/[0.02] p-5 mb-6">
          <h1 className={`text-2xl font-bold mb-1 ${profileAccentClass}`}>{data.profile.username || `Player ${data.profile.id.slice(0, 8)}`}</h1>
          {activeTitle && (
            <p className="text-[11px] uppercase tracking-wider mb-2">
              <CosmeticTitle title={activeTitle} titleSlug={activeTitleSlug} />
            </p>
          )}
          <p className="text-white/40 text-sm mb-4">User ID: {data.profile.id}</p>
          <p className="text-white/40 text-sm mb-4">Guild: <span className="text-white/80">{guildLabel}</span></p>
          {activeColorSlug?.startsWith('vote-') && (
            <p className="text-white/40 text-xs mb-3">Active vote effect: <span className="text-white/80">{activeColorSlug.replace(/-/g, ' ')}</span></p>
          )}
          {data.signature_cat && (
            <div className="mb-4 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
              <img src={data.signature_cat.image_url || '/cat-placeholder.svg'} alt={data.signature_cat.name} className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <p className="text-xs text-white/50">Signature Cat</p>
                <Link href={`/cat/${data.signature_cat.id}`} className="font-bold hover:underline">{data.signature_cat.name}</Link>
              </div>
            </div>
          )}
          {data.is_owner && (
            <div className="mb-4 rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/50">Customize titles/borders/colors in Shop</p>
                <Link href="/shop" className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-bold hover:bg-yellow-500/30">Open Shop</Link>
              </div>
              {editingName ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-white/30"
                  />
                  <button
                    onClick={saveUsername}
                    disabled={savingName}
                    className="px-4 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-50"
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNewUsername(data.profile.username || ''); }}
                    className="px-4 py-2 rounded-lg bg-white/10 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
                >
                  Edit Username
                </button>
              )}
              {nameMessage && <p className="text-xs text-white/60 mt-2">{nameMessage}</p>}
            </div>
          )}
          {showTip && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-white/65">Tips: equip titles/borders/colors here after buying in Shop.</p>
                <button
                  onClick={() => { localStorage.setItem('tip_profile_cosmetics_v1', '1'); setShowTip(false); }}
                  className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">Level</p>
              <p className="font-bold">{data.progress.level}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">XP</p>
              <p className="font-bold">{data.progress.xp}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">Sigils</p>
              <p className="font-bold inline-flex items-center gap-1"><SigilIcon className="w-3.5 h-3.5" glow />{data.progress.sigils}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">Streak</p>
              <p className="font-bold inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" />{data.streak.current_streak}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">Cat Wins</p>
              <p className="font-bold inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-yellow-400" />{totalWins}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 col-span-2 md:col-span-1">
              <p className="text-xs text-white/50 mb-1">Tactical Rating</p>
              <p className="font-bold">{data.profile.tactical_rating || 0}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 col-span-2 md:col-span-1">
              <p className="text-xs text-white/50 mb-1">Prediction Streak</p>
              <p className="font-bold">{data.prediction_stats?.current_streak || 0} <span className="text-white/40 text-xs">best {data.prediction_stats?.best_streak || 0}</span></p>
            </div>
          </div>
          {data.most_supported_cat && (
            <p className="text-xs text-white/50 mt-3">
              Most Supported: <Link href={`/cat/${data.most_supported_cat.id}`} className="text-white hover:underline">{data.most_supported_cat.name}</Link> ({data.most_supported_cat.fan_count} fans)
            </p>
          )}
        </CosmeticFrame>
        </CosmeticThemeProvider>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 mb-6">
          <h2 className="text-base font-bold mb-3">Account Info</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">User ID</p>
              <p className="text-white/80 break-all">{data.profile.id}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-white/50 mb-1">Submitted Cats</p>
              <p className="text-white/80">{submittedCatCount}</p>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-lg font-bold mb-2">Cats</h2>
            <p className="text-xs text-white/50 mb-4">User-submitted cats are listed below.</p>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {data.submitted_cats.length === 0 && <p className="text-white/40 text-sm">No cats submitted yet.</p>}
                {data.submitted_cats.map((cat) => (
                <Link key={cat.id} href={`/cat/${cat.id}`} className={`block rounded-xl bg-white/5 border p-3 hover:bg-white/10 transition-colors ${cosmeticBorderClassFromSlug(activeBorderSlug)}`}>
                  <div className="flex gap-3">
                    <img
                      src={cat.image_url || '/cat-placeholder.svg'}
                      alt={cat.name}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{cat.name}</p>
                      <p className="text-xs text-white/50">{cat.rarity} · {cat.status} · Lvl {cat.level}</p>
                      <p className="text-xs text-white/40">W {cat.wins} / L {cat.losses} · Fans {cat.fan_count || 0}</p>
                      {cat.stance && <p className="text-[10px] text-cyan-300 uppercase">Stance: {cat.stance}</p>}
                    </div>
                    {data.is_owner && (
                      <button
                        onClick={(e) => { e.preventDefault(); pinSignature(cat.id); }}
                        disabled={!!pinningCatId}
                        className="px-2 py-1 text-[10px] rounded-md bg-white/10 hover:bg-white/20"
                      >
                        {pinningCatId === cat.id ? 'Pinning...' : 'Pin'}
                      </button>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-lg font-bold mb-4">Vote History</h2>
            <div className="space-y-2 max-h-[250px] overflow-auto pr-1 mb-5">
              {data.vote_history.length === 0 && <p className="text-white/40 text-sm">No votes recorded yet.</p>}
              {data.vote_history.map((v) => (
                <div key={`${v.battle_id}-${v.created_at}`} className="rounded-lg bg-white/5 border border-white/5 p-2.5">
                  <p className="text-sm">
                    Voted for <span className="font-bold">{v.voted_for_name}</span>
                    {v.against_name ? ` vs ${v.against_name}` : ''}
                  </p>
                  <p className="text-xs text-white/40">{new Date(v.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-bold mb-3">Equipped Cosmetics</h3>
            <div className="space-y-2">
              {data.equipped_cosmetics.length === 0 && <p className="text-white/40 text-sm">No cosmetics equipped.</p>}
              {data.equipped_cosmetics.map((e, idx) => (
                <div key={`${e.slot}-${idx}`} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex items-center justify-between">
                  <p className="text-xs uppercase text-white/50">{e.slot}</p>
                  <p className="text-sm">
                    {e.cosmetic ? (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                        {e.cosmetic.name}
                      </span>
                    ) : 'None'}
                  </p>
                </div>
              ))}
            </div>
            {data.is_owner && (
              <>
                <h3 className="text-sm font-bold mt-5 mb-3">My Cosmetics</h3>
                <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                  {ownedCosmetics.length === 0 && <p className="text-white/40 text-sm">No owned cosmetics yet.</p>}
                  {ownedCosmetics.map((c) => (
                    <div key={c.id} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        <p className="text-[11px] text-white/50">{cosmeticTypeLabel(c)} · {c.rarity}</p>
                      </div>
                      <button
                        onClick={() => equipFromProfile(c.slug)}
                        disabled={!!equippingSlug || !!c.equipped_slot}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs disabled:opacity-50"
                      >
                        {c.equipped_slot ? 'Equipped' : (equippingSlug === c.slug ? '...' : 'Equip')}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <h3 className="text-sm font-bold mt-5 mb-3">Top Rivalries</h3>
            <div className="space-y-2">
              {(data.rivalries || []).length === 0 && <p className="text-white/40 text-sm">No rivalries yet.</p>}
              {(data.rivalries || []).map((r) => (
                <div key={r.cat_id} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex items-center justify-between">
                  <Link href={`/cat/${r.cat_id}`} className="text-sm hover:underline">{r.cat_name}</Link>
                  <span className="text-xs text-white/50">{r.battles} clashes</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
