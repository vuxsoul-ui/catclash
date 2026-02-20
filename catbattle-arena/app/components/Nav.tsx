'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Swords,
  Cat,
  User,
  Home,
  PlusSquare,
  ShoppingBag,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Nav() {
  const pathname = usePathname();
  const [myProfileHref, setMyProfileHref] = useState('/login');
  const [profileLabel, setProfileLabel] = useState<'Login' | 'My Profile'>('Login');
  const [pendingDuelCount, setPendingDuelCount] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/me', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/duel/challenges', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([me, duel]) => {
        if (!alive) return;
        const username = String(me?.data?.profile?.username || '').trim();
        const id = me?.guest_id;
        if (id && username) {
          setMyProfileHref(`/profile/${id}`);
          setProfileLabel('My Profile');
        } else {
          setMyProfileHref('/login');
          setProfileLabel('Login');
        }
        if (duel?.ok && Array.isArray(duel.incoming)) {
          const pending = duel.incoming.filter((d: { status?: string | null }) => String(d?.status || '').toLowerCase() === 'pending').length;
          setPendingDuelCount(pending);
        } else {
          setPendingDuelCount(0);
        }
      })
      .catch(() => {
        // ignore
      });
    return () => { alive = false; };
  }, [pathname]);

  const mobilePrimaryLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/arena', label: 'Whisker', icon: Swords },
    { href: '/submit', label: 'Submit', icon: PlusSquare, emphasis: true },
    { href: '/gallery', label: 'Gallery', icon: Cat },
    { href: '/shop', label: 'Shop', icon: ShoppingBag },
    { href: myProfileHref, label: 'Profile', icon: User },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[70] border-b border-white/10 bg-black/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="h-[var(--header-h)] grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="relative w-8 h-8 rounded-xl border border-white/20 bg-gradient-to-br from-slate-800 via-slate-900 to-black overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.4)]">
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(56,189,248,0.28),transparent_58%)]" />
                <Cat className="absolute left-[2px] top-[7px] w-3.5 h-3.5 text-cyan-200/95" />
                <Cat className="absolute right-[2px] top-[7px] w-3.5 h-3.5 text-amber-200/95 scale-x-[-1]" />
                <Swords className="absolute left-1/2 -translate-x-1/2 bottom-[2px] w-3.5 h-3.5 text-white/90" />
              </span>
              <span className="font-black text-[14px] sm:text-[15px] tracking-wide bg-gradient-to-r from-cyan-200 via-white to-amber-200 bg-clip-text text-transparent">
                CatClash
              </span>
            </Link>

            <nav className="hidden sm:flex items-center justify-center gap-1.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/arena', label: 'Whisker' },
                { href: '/submit', label: 'Submit' },
                { href: '/gallery', label: 'Gallery' },
                { href: '/shop', label: 'Shop' },
                { href: '/leaderboard', label: 'Leaderboard' },
                { href: '/social', label: 'Social' },
              ].map((link) => {
                const active = pathname === link.href;
                const duelBadge = link.href === '/duel' && pendingDuelCount > 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative h-9 px-3 rounded-full border text-xs font-semibold inline-flex items-center justify-center transition-all ${active ? 'bg-gradient-to-r from-emerald-300 to-cyan-300 text-black border-emerald-200 shadow-[0_8px_20px_rgba(16,185,129,0.28)]' : 'bg-white/5 border-white/15 text-white/85 hover:bg-white/10'}`}
                  >
                    {link.label}
                    {duelBadge && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-bold text-center border border-red-300/40">
                        {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="sm:hidden flex items-center gap-1.5">
                <Link
                  href="/social"
                  aria-label="Social"
                  className={`h-8 w-8 rounded-full border inline-flex items-center justify-center ${pathname === '/social' ? 'bg-white text-black border-white' : 'bg-white/10 border-white/15 text-white/80'}`}
                >
                  <Users className="h-4 w-4" />
                </Link>
                <Link
                  href="/leaderboard"
                  aria-label="Leaderboard"
                  className={`h-8 w-8 rounded-full border inline-flex items-center justify-center ${pathname === '/leaderboard' ? 'bg-white text-black border-white' : 'bg-white/10 border-white/15 text-white/80'}`}
                >
                  <Trophy className="h-4 w-4" />
                </Link>
              </div>
              <Link
                href={myProfileHref}
                className={`hidden sm:inline-flex h-9 px-3 rounded-full border items-center text-xs font-semibold ${pathname === myProfileHref ? 'bg-white text-black border-white' : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/15'}`}
              >
                {profileLabel}
              </Link>
            </div>
          </div>
        </div>

      </header>

      <nav
        className="sm:hidden fixed bottom-0 left-1/2 -translate-x-1/2 z-[95] w-[min(500px,calc(100%-0.5rem))] h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] rounded-t-[14px] border-t border-white/10 bg-black/94 backdrop-blur-xl shadow-[0_-6px_16px_rgba(0,0,0,0.30)] px-1 transition-opacity opacity-100 pointer-events-auto"
      >
        <div className="relative flex h-[var(--bottom-nav-h)] items-center gap-1">
          {mobilePrimaryLinks.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            const duelBadge = link.href === '/duel' && pendingDuelCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative z-10 min-h-10 flex-1 rounded-lg text-[10px] font-semibold inline-flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-[0.98] touch-manipulation ${
                  link.emphasis
                    ? `-translate-y-0.5 border ${active ? 'border-emerald-200 bg-gradient-to-r from-emerald-300 to-cyan-300 text-black shadow-[0_6px_14px_rgba(16,185,129,0.28)]' : 'border-emerald-300/30 bg-emerald-500/18 text-emerald-100'}`
                    : active
                      ? 'bg-white/10 text-white border border-white/15'
                      : 'bg-white/3 text-white/72 border border-white/8'
                }`}
              >
                <Icon className="w-[17px] h-[17px]" />
                {link.label}
                {duelBadge && (
                  <span className="absolute top-1 right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-bold text-center border border-red-300/40">
                    {pendingDuelCount > 99 ? '99+' : pendingDuelCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
