-- Security hardening: ensure newer tables have explicit RLS posture.
-- Default posture for internal tables is deny-all for anon/authenticated.

DO $$
BEGIN
  IF to_regclass('public.app_telemetry') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_telemetry ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.app_telemetry FROM anon, authenticated';
  END IF;

  IF to_regclass('public.auth_credentials') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.auth_credentials ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.auth_credentials FROM anon, authenticated';
  END IF;

  IF to_regclass('public.duel_challenges') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.duel_challenges ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.duel_challenges FROM anon, authenticated';
  END IF;

  IF to_regclass('public.duel_votes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.duel_votes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.duel_votes FROM anon, authenticated';
  END IF;

  IF to_regclass('public.referral_edges_daily') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.referral_edges_daily ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.referral_edges_daily FROM anon, authenticated';
  END IF;

  IF to_regclass('public.referral_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.referral_events FROM anon, authenticated';
  END IF;

  IF to_regclass('public.social_callouts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_callouts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.social_callouts FROM anon, authenticated';
  END IF;

  IF to_regclass('public.social_feed_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_feed_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.social_feed_events FROM anon, authenticated';
  END IF;

  IF to_regclass('public.social_referrals') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.social_referrals ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.social_referrals FROM anon, authenticated';
  END IF;

  IF to_regclass('public.user_social_challenges') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_social_challenges ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.user_social_challenges FROM anon, authenticated';
  END IF;

  IF to_regclass('public.whisker_telemetry') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.whisker_telemetry ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.whisker_telemetry FROM anon, authenticated';
  END IF;

  IF to_regclass('public.crate_cat_drops') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crate_cat_drops ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.crate_cat_drops FROM anon, authenticated';
  END IF;

  IF to_regclass('public.cat_forge_history') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cat_forge_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.cat_forge_history FROM anon, authenticated';
  END IF;

  IF to_regclass('public.cat_xp_pools') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cat_xp_pools ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.cat_xp_pools FROM anon, authenticated';
  END IF;

  IF to_regclass('public.daily_boss_progress') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.daily_boss_progress ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.daily_boss_progress FROM anon, authenticated';
  END IF;
END $$;

-- Public read tables: explicit read-only grants + policies.
DO $$
BEGIN
  IF to_regclass('public.tournament_matches') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.tournament_matches FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.tournament_matches TO anon, authenticated';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tournament_matches'
        AND policyname = 'tournament_matches_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY tournament_matches_public_read ON public.tournament_matches FOR SELECT USING (true)';
    END IF;
  END IF;

  IF to_regclass('public.share_cards') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.share_cards ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.share_cards FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.share_cards TO anon, authenticated';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'share_cards'
        AND policyname = 'share_cards_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY share_cards_public_read ON public.share_cards FOR SELECT USING (coalesce(is_public, false) = true)';
    END IF;
  END IF;

  IF to_regclass('public.tournament_comments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tournament_comments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.tournament_comments FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.tournament_comments TO anon, authenticated';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tournament_comments'
        AND policyname = 'tournament_comments_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY tournament_comments_public_read ON public.tournament_comments FOR SELECT USING (true)';
    END IF;
  END IF;

  IF to_regclass('public.site_spotlights') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.site_spotlights ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.site_spotlights FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.site_spotlights TO anon, authenticated';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'site_spotlights'
        AND policyname = 'site_spotlights_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY site_spotlights_public_read ON public.site_spotlights FOR SELECT USING (true)';
    END IF;
  END IF;
END $$;
