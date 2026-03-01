'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, Cat, User, Home, PlusSquare, Trophy, Users, Images } from 'lucide-react';
import { useEffect, useState } from 'react';
import { resolveActorId, runIdentityResolutionChecks } from '../lib/identity';
import { checkTapTarget, installBottomNavInterceptionDiagnostics, warnOnce } from '../lib/dev-click-guards';
import { scanDuplicateTestIds } from '../lib/dev-testid-guard';

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
        const actorId = resolveActorId(me);
        if (actorId) {
          setMyProfileHref(`/profile/${actorId}`);
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

  useEffect(() => {
    runIdentityResolutionChecks();
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      const noise = document.querySelector('.noise-overlay') as HTMLElement | null;
      const watermark = document.querySelector('.vuxsolia-watermark') as HTMLElement | null;
      const toastHost = document.querySelector('.global-toast-host') as HTMLElement | null;
      const touchTarget = document.elementFromPoint(
        Math.floor(window.innerWidth * 0.5),
        Math.max(0, window.innerHeight - 8)
      ) as HTMLElement | null;
      const pointerSafe =
        (!noise || getComputedStyle(noise).pointerEvents === 'none') &&
        (!watermark || getComputedStyle(watermark).pointerEvents === 'none') &&
        (!toastHost || getComputedStyle(toastHost).pointerEvents === 'none');
      if (!pointerSafe) {
        warnOnce('overlay-pointer-safe', '[DEV_CHECK] Overlay layers must keep pointer-events: none');
      }
      const isAnchor = touchTarget?.tagName === 'A' || !!touchTarget?.closest('a');
      if (!isAnchor) {
        warnOnce('nav-bottom-probe', '[DEV_CHECK] Bottom viewport click target should resolve to a nav anchor', {
          tag: touchTarget?.tagName || null,
          className: touchTarget?.className || null,
        });
      }

      checkTapTarget({ key: 'nav-home-hit', selector: '[data-testid="nav-home"]', expect: ['A'] });
      checkTapTarget({ key: 'nav-duel-hit', selector: '[data-testid="nav-duel"]', expect: ['A'] });
      checkTapTarget({ key: 'nav-profile-hit', selector: '[data-testid="nav-profile"]', expect: ['A'] });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => scanDuplicateTestIds('nav'), 120);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    return installBottomNavInterceptionDiagnostics('[data-nav-root="mobile"]');
  }, [pathname]);

  const mobilePrimaryLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/duel', label: 'Duel', icon: Swords },
    { href: '/submit', label: 'Submit', icon: PlusSquare, emphasis: true },
    { href: '/gallery', label: 'Gallery', icon: Images },
    { href: myProfileHref, label: 'Profile', icon: User },
  ];

  const quickBtnBase =
    'h-9 rounded-full border inline-flex items-center justify-center transition-all duration-150 shrink-0';
  const quickBtnIdle =
    'bg-zinc-900/95 border-zinc-300/20 text-zinc-100 hover:bg-zinc-800/95 shadow-[0_8px_20px_rgba(0,0,0,0.35)]';
  const quickBtnActive =
    'bg-gradient-to-r from-emerald-300 to-cyan-300 text-black border-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.28)]';

  const withNavFallback = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const before = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.setTimeout(() => {
      const after = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (after === before) window.location.assign(href);
    }, 220);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[1300] pt-[env(safe-area-inset-top)] pointer-events-auto isolate">
        <div className="absolute inset-0 pointer-events-none border-b border-zinc-200/15 bg-[linear-gradient(180deg,#070707_0%,#131417_62%,#1a1c22_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.45)]" />
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none bg-gradient-to-r from-transparent via-zinc-200/35 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative h-[var(--header-h)] grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <Link href="/" onClick={withNavFallback('/')} className="inline-flex items-center gap-2">
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
                  { href: '/duel', label: 'Duel' },
                  { href: '/submit', label: 'Submit' },
                  { href: '/gallery', label: 'Gallery' },
                  { href: '/shop', label: 'Shop' },
                ].map((link) => {
                const active = pathname === link.href;
                const duelBadge = link.href === '/duel' && pendingDuelCount > 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={withNavFallback(link.href)}
                    className={`relative h-9 px-3 rounded-full border text-xs font-semibold inline-flex items-center justify-center transition-all ${active ? 'bg-gradient-to-r from-zinc-200 to-zinc-100 text-black border-zinc-100 shadow-[0_8px_20px_rgba(255,255,255,0.16)]' : 'bg-white/5 border-white/15 text-white/85 hover:bg-white/10'}`}
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
                onClick={withNavFallback('/social')}
                aria-label="Social"
                title="Social"
                className={`px-2.5 gap-1.5 text-[11px] font-semibold ${quickBtnBase} ${pathname === '/social' ? quickBtnActive : quickBtnIdle}`}
              >
                <Users className="h-4 w-4" />
                <span>Social</span>
              </Link>
              <Link
                href="/leaderboard"
                onClick={withNavFallback('/leaderboard')}
                aria-label="Leaderboard"
                title="Leaderboard"
                className={`px-2.5 gap-1.5 text-[11px] font-semibold ${quickBtnBase} ${pathname === '/leaderboard' ? quickBtnActive : quickBtnIdle}`}
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </Link>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Link
                href="/social"
                onClick={withNavFallback('/social')}
                aria-label="Social"
                title="Social"
                className={`px-2.5 gap-1.5 text-[11px] font-semibold ${quickBtnBase} ${pathname === '/social' ? quickBtnActive : quickBtnIdle}`}
              >
                <Users className="h-4 w-4" />
                <span>Social</span>
              </Link>
              <Link
                href="/leaderboard"
                onClick={withNavFallback('/leaderboard')}
                aria-label="Leaderboard"
                title="Leaderboard"
                className={`px-2.5 gap-1.5 text-[11px] font-semibold ${quickBtnBase} ${pathname === '/leaderboard' ? quickBtnActive : quickBtnIdle}`}
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </Link>
            </div>
              <Link
                href={myProfileHref}
                onClick={withNavFallback(myProfileHref)}
                className={`hidden sm:inline-flex h-9 px-3 rounded-full border items-center text-xs font-semibold ${pathname === myProfileHref ? 'bg-white text-black border-white' : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/15'}`}
              >
                {profileLabel}
              </Link>
            </div>
          </div>
        </div>

      </header>

      <nav
        data-nav-root="mobile"
        className="sm:hidden fixed bottom-0 inset-x-1 mx-auto z-[1400] w-[calc(100%-0.5rem)] max-w-[500px] h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+6px)] pb-[env(safe-area-inset-bottom)] rounded-t-[18px] border border-zinc-300/20 border-b-0 bg-zinc-950 shadow-[0_-16px_38px_rgba(0,0,0,0.62)] px-1.5 pt-1.5 opacity-100 pointer-events-auto overflow-visible backdrop-blur-xl isolate"
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,#141518_0%,#1b1d22_54%,#20232a_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-200/40 to-transparent pointer-events-none" />
        <div className="relative flex h-[var(--bottom-nav-h)] items-stretch gap-1.5">
          {mobilePrimaryLinks.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            const duelBadge = link.href === '/duel' && pendingDuelCount > 0;
            const testId =
              link.href === '/'
                ? 'nav-home'
                : link.href === '/duel'
                  ? 'nav-duel'
                  : link.href === '/submit'
                    ? 'nav-submit'
                    : link.href === '/gallery'
                      ? 'nav-gallery'
                      : 'nav-profile';
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={withNavFallback(link.href)}
                data-testid={testId}
                aria-current={active ? 'page' : undefined}
                className={`relative z-10 h-full flex-1 rounded-xl text-[10px] font-semibold inline-flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-[0.98] touch-manipulation ${
                  link.emphasis
                    ? `-translate-y-0.5 border ${active ? 'border-emerald-200 bg-gradient-to-r from-emerald-300 to-cyan-300 text-black shadow-[0_6px_14px_rgba(16,185,129,0.28)]' : 'border-emerald-300/30 bg-emerald-500/18 text-emerald-100'}`
                    : active
                      ? 'bg-gradient-to-b from-zinc-500/70 to-zinc-600/75 text-white border border-zinc-100/35 shadow-[0_8px_16px_rgba(148,163,184,0.22)] after:absolute after:left-3 after:right-3 after:top-[3px] after:h-[2px] after:rounded-full after:bg-zinc-100/85'
                      : 'bg-zinc-800/82 text-zinc-100/90 border border-zinc-500/60 hover:bg-zinc-700/84'
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
