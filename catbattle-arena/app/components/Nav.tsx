'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, Cat, User, Home, Trophy, Users, Plus, ShoppingBag, Star, Flame } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resolveActorId, runIdentityResolutionChecks } from '../lib/identity';
import { countLiveDuels } from '../lib/duel-live';
import { checkTapTarget, installBottomNavInterceptionDiagnostics, warnOnce } from '../lib/dev-click-guards';
import { scanDuplicateTestIds } from '../lib/dev-testid-guard';
import SigilIcon from './icons/SigilIcon';

export default function Nav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [myProfileHref, setMyProfileHref] = useState('/login');
  const [liveDuelCount, setLiveDuelCount] = useState(0);
  const [rankSigils, setRankSigils] = useState(0);
  const [rankStreak, setRankStreak] = useState(0);
  const [isArenaNavCompact, setIsArenaNavCompact] = useState(false);
  const topNavRef = useRef<HTMLElement | null>(null);
  const onArenaPage = pathname === '/tournament' || pathname === '/arena';

  useEffect(() => {
    setMounted(true);
  }, []);

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
        } else {
          setMyProfileHref('/login');
        }
        setRankSigils(Number(me?.data?.progress?.sigils || 0));
        setRankStreak(Number(me?.data?.prediction_streak || me?.data?.streak?.current_streak || 0));
        if (duel?.ok) {
          setLiveDuelCount(countLiveDuels(duel.open));
        } else {
          setLiveDuelCount(0);
        }
      })
      .catch(() => {
        if (!alive) return;
        setLiveDuelCount(0);
      });
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    runIdentityResolutionChecks();
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      const mobileNav = document.querySelector('[data-nav-root="mobile"]') as HTMLElement | null;
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const navVisible = !!mobileNav && getComputedStyle(mobileNav).display !== 'none' && getComputedStyle(mobileNav).visibility !== 'hidden' && mobileNav.getBoundingClientRect().width > 0 && mobileNav.getBoundingClientRect().height > 0;
      const noise = document.querySelector('.noise-overlay') as HTMLElement | null;
      const watermark = document.querySelector('.vuxsolia-watermark') as HTMLElement | null;
      const toastHost = document.querySelector('.global-toast-host') as HTMLElement | null;
      const pointerSafe =
        (!noise || getComputedStyle(noise).pointerEvents === 'none') &&
        (!watermark || getComputedStyle(watermark).pointerEvents === 'none') &&
        (!toastHost || getComputedStyle(toastHost).pointerEvents === 'none');
      if (!pointerSafe) {
        warnOnce('overlay-pointer-safe', '[DEV_CHECK] Overlay layers must keep pointer-events: none');
      }
      if (isMobile && navVisible && mobileNav) {
        const probeAnchor = mobileNav.querySelector('[data-testid="nav-home"], [data-testid="nav-gallery"], [data-testid="nav-tournament"], [data-testid="nav-shop"], [data-testid="nav-profile"]') as HTMLElement | null;
        const probeRect = (probeAnchor || mobileNav).getBoundingClientRect();
        const probeX = Math.floor(probeRect.left + probeRect.width * 0.5);
        const probeY = Math.floor(probeRect.top + probeRect.height * 0.5);
        const touchTarget = document.elementFromPoint(probeX, probeY) as HTMLElement | null;
        const isAnchor = touchTarget?.tagName === 'A' || !!touchTarget?.closest('a');
        const isNavContainer = touchTarget === mobileNav;
        if (!isAnchor && !isNavContainer) {
          warnOnce('nav-bottom-probe', '[DEV_CHECK] Bottom nav probe should resolve to a nav anchor', {
            tag: touchTarget?.tagName || null,
            className: touchTarget?.className || null,
          });
        }
      }

      checkTapTarget({ key: 'nav-home-hit', selector: '[data-testid="nav-home"]', expect: ['A'] });
      checkTapTarget({ key: 'nav-gallery-hit', selector: '[data-testid="nav-gallery"]', expect: ['A'] });
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

  useEffect(() => {
    if (!mounted || !onArenaPage) {
      setIsArenaNavCompact(false);
      return;
    }
    const onScroll = () => {
      setIsArenaNavCompact(window.scrollY > 56);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mounted, onArenaPage]);

  useEffect(() => {
    const nav = topNavRef.current;
    if (!nav || !mounted) return;
    const arenaEnabled = onArenaPage;
    nav.classList.toggle('top-nav-shell--arena', arenaEnabled);
    nav.classList.toggle('top-nav-shell--compact', arenaEnabled && isArenaNavCompact);
  }, [mounted, onArenaPage, isArenaNavCompact]);

  const topActionLinks: Array<{ href: string; label: string; icon: typeof Home; iconOnly?: boolean; hideBelow360?: boolean; primary?: boolean }> = [
    { href: '/submit', label: 'Submit', icon: Plus, primary: true },
    { href: '/social', label: 'Social', icon: Users, hideBelow360: true },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, iconOnly: true },
  ];

  const mobilePrimaryLinks: Array<{ href: string; label: string; icon: typeof Home }> = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/gallery', label: 'Gallery', icon: Cat },
    { href: '/tournament', label: 'Arena', icon: Swords },
    { href: '/shop', label: 'Shop', icon: ShoppingBag },
    { href: myProfileHref, label: 'Profile', icon: User },
  ];

  const isActiveHref = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/profile')) return pathname.startsWith('/profile');
    return pathname === href;
  };

  const withNavFallback = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
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
      <nav ref={topNavRef} className="main-nav top-nav-shell sticky top-0 z-[1300] pt-[env(safe-area-inset-top)] pointer-events-auto isolate">
        <div className="top-nav-backdrop absolute inset-0 pointer-events-none" />
        <div className="top-nav-inner relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="top-nav-primary-row">
            <Link href="/" onClick={withNavFallback('/')} className="top-nav-brand inline-flex min-w-0 items-center gap-2">
              <span className="top-nav-brand-copy min-w-0">
                <span className="top-nav-wordmark">CatClash</span>
              </span>
            </Link>

            <div className="top-nav-actions top-nav-pill-wrap">
              {topActionLinks.map((link) => {
                const active = isActiveHref(link.href);
                const Icon = link.icon;
                const duelBadge = link.href === '/duel' && liveDuelCount > 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={withNavFallback(link.href)}
                    className={`nav-tab top-nav-action ${active ? 'active' : ''} ${link.primary ? 'top-nav-action--primary' : ''} ${link.iconOnly ? 'top-nav-action--icon' : ''} ${link.hideBelow360 ? 'top-nav-action--hide-compact' : ''}`}
                    aria-label={link.label}
                  >
                    <Icon className="h-[11px] w-[11px]" />
                    {!link.iconOnly && <span className="pill-label">{link.label}</span>}
                    {duelBadge && (
                      <span className="bn-badge">
                        {liveDuelCount > 99 ? '99+' : liveDuelCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="top-nav-status-row">
            <div className="top-nav-rank-pill flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Star className="top-nav-rank-icon" aria-hidden="true" />
                <span className="top-nav-rank-label">Rank 1</span>
                <span className="top-nav-rank-track" aria-hidden="true">
                  <span className="top-nav-rank-fill" />
                </span>
                <span className="top-nav-rank-value">14%</span>
              </span>
              <span className="top-nav-rank-chip top-nav-rank-chip--sigils inline-flex items-center gap-1">
                <SigilIcon className="h-3.5 w-3.5" />
                {rankSigils}
              </span>
              <span className="top-nav-rank-chip top-nav-rank-chip--streak inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                {rankStreak}
              </span>
            </div>
          </div>
        </div>

      </nav>

      <nav
        data-nav-root="mobile"
        className="mobile-bottom-nav sm:hidden fixed bottom-0 inset-x-0 z-[1400] mx-auto w-full max-w-[390px] px-2 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1 opacity-100 pointer-events-auto overflow-visible isolate"
        style={{ pointerEvents: 'none' }}
      >
        <div className="mobile-bottom-nav-shell" style={{ pointerEvents: 'none', gap: 0 }}>
          {mobilePrimaryLinks.map((link) => {
            const active = isActiveHref(link.href);
            const Icon = link.icon;
            const duelBadge = link.href === '/duel' && liveDuelCount > 0;
            const isTournament = link.href === '/tournament';
            const testId =
              link.href === '/'
                ? 'nav-home'
                : link.href === '/gallery'
                  ? 'nav-gallery'
                : link.href === '/tournament'
                    ? 'nav-tournament'
                  : link.href === '/shop'
                    ? 'nav-shop'
                    : 'nav-profile';
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={withNavFallback(link.href)}
                data-testid={testId}
                aria-current={active ? 'page' : undefined}
                className={`bn-tab ${active ? 'active' : ''} ${isTournament ? 'bn-tab--arena' : ''} nav-tab flex-1 w-full`}
                style={{ pointerEvents: 'auto' }}
              >
                <span className={`bn-icon ${isTournament ? 'bn-icon--arena' : ''}`}>
                  <Icon />
                </span>
                <span className="bn-label">{link.label}</span>
                {duelBadge && (
                  <span className="bn-badge">
                    {liveDuelCount > 99 ? '99+' : liveDuelCount}
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
