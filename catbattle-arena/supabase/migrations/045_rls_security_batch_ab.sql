-- Batch A/B Supabase RLS hardening for security-critical tables.
-- Batch A: public.cats
-- Batch B: user-private gameplay tables.

DO $$
BEGIN
  IF to_regclass('public.cats') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.cats FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS cats_owner_select ON public.cats
    ';
    EXECUTE '
      CREATE POLICY cats_owner_select
        ON public.cats
        FOR SELECT
        USING (auth.uid() = user_id)
    ';

    EXECUTE '
      DROP POLICY IF EXISTS cats_public_read_approved ON public.cats
    ';
    EXECUTE '
      CREATE POLICY cats_public_read_approved
        ON public.cats
        FOR SELECT
        USING (
          (status = ''approved'')
          OR (image_review_status = ''approved'')
          OR (image_review_status IS NULL AND status = ''approved'')
        )
    ';

    EXECUTE '
      DROP POLICY IF EXISTS cats_owner_insert ON public.cats
    ';
    EXECUTE '
      CREATE POLICY cats_owner_insert
        ON public.cats
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    ';

    EXECUTE '
      DROP POLICY IF EXISTS cats_owner_update ON public.cats
    ';
    EXECUTE '
      CREATE POLICY cats_owner_update
        ON public.cats
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';

    EXECUTE '
      DROP POLICY IF EXISTS cats_owner_delete ON public.cats
    ';
    EXECUTE '
      CREATE POLICY cats_owner_delete
        ON public.cats
        FOR DELETE
        USING (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.user_inventory') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.user_inventory FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS user_inventory_owner_select ON public.user_inventory
    ';
    EXECUTE '
      CREATE POLICY user_inventory_owner_select
        ON public.user_inventory
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS user_inventory_owner_insert ON public.user_inventory
    ';
    EXECUTE '
      CREATE POLICY user_inventory_owner_insert
        ON public.user_inventory
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS user_inventory_owner_update ON public.user_inventory
    ';
    EXECUTE '
      CREATE POLICY user_inventory_owner_update
        ON public.user_inventory
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS user_inventory_owner_delete ON public.user_inventory
    ';
    EXECUTE '
      CREATE POLICY user_inventory_owner_delete
        ON public.user_inventory
        FOR DELETE
        USING (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.equipped_cosmetics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.equipped_cosmetics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.equipped_cosmetics FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS equipped_cosmetics_owner_select ON public.equipped_cosmetics
    ';
    EXECUTE '
      CREATE POLICY equipped_cosmetics_owner_select
        ON public.equipped_cosmetics
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS equipped_cosmetics_owner_insert ON public.equipped_cosmetics
    ';
    EXECUTE '
      CREATE POLICY equipped_cosmetics_owner_insert
        ON public.equipped_cosmetics
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS equipped_cosmetics_owner_update ON public.equipped_cosmetics
    ';
    EXECUTE '
      CREATE POLICY equipped_cosmetics_owner_update
        ON public.equipped_cosmetics
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS equipped_cosmetics_owner_delete ON public.equipped_cosmetics
    ';
    EXECUTE '
      CREATE POLICY equipped_cosmetics_owner_delete
        ON public.equipped_cosmetics
        FOR DELETE
        USING (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.match_predictions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.match_predictions FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS match_predictions_owner_select ON public.match_predictions
    ';
    EXECUTE '
      CREATE POLICY match_predictions_owner_select
        ON public.match_predictions
        FOR SELECT
        USING (auth.uid() = voter_user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS match_predictions_owner_insert ON public.match_predictions
    ';
    EXECUTE '
      CREATE POLICY match_predictions_owner_insert
        ON public.match_predictions
        FOR INSERT
        WITH CHECK (auth.uid() = voter_user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS match_predictions_owner_delete ON public.match_predictions
    ';
    EXECUTE '
      CREATE POLICY match_predictions_owner_delete
        ON public.match_predictions
        FOR DELETE
        USING (auth.uid() = voter_user_id)
    ';
  END IF;

  IF to_regclass('public.user_reward_claims') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_reward_claims ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.user_reward_claims FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS user_reward_claims_owner_select ON public.user_reward_claims
    ';
    EXECUTE '
      CREATE POLICY user_reward_claims_owner_select
        ON public.user_reward_claims
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS user_reward_claims_owner_modify ON public.user_reward_claims
    ';
    EXECUTE '
      CREATE POLICY user_reward_claims_owner_modify
        ON public.user_reward_claims
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.starter_adoptions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.starter_adoptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.starter_adoptions FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS starter_adoptions_owner_select ON public.starter_adoptions
    ';
    EXECUTE '
      CREATE POLICY starter_adoptions_owner_select
        ON public.starter_adoptions
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS starter_adoptions_owner_modify ON public.starter_adoptions
    ';
    EXECUTE '
      CREATE POLICY starter_adoptions_owner_modify
        ON public.starter_adoptions
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.casino_blackjack_hands') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.casino_blackjack_hands ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.casino_blackjack_hands FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS casino_blackjack_hands_owner_select ON public.casino_blackjack_hands
    ';
    EXECUTE '
      CREATE POLICY casino_blackjack_hands_owner_select
        ON public.casino_blackjack_hands
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS casino_blackjack_hands_owner_modify ON public.casino_blackjack_hands
    ';
    EXECUTE '
      CREATE POLICY casino_blackjack_hands_owner_modify
        ON public.casino_blackjack_hands
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.notification_preferences FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS notification_preferences_owner_select ON public.notification_preferences
    ';
    EXECUTE '
      CREATE POLICY notification_preferences_owner_select
        ON public.notification_preferences
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS notification_preferences_owner_modify ON public.notification_preferences
    ';
    EXECUTE '
      CREATE POLICY notification_preferences_owner_modify
        ON public.notification_preferences
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.cat_approval_notifications') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cat_approval_notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.cat_approval_notifications FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS cat_approval_notifications_owner_select ON public.cat_approval_notifications
    ';
    EXECUTE '
      CREATE POLICY cat_approval_notifications_owner_select
        ON public.cat_approval_notifications
        FOR SELECT
        USING (auth.uid() = user_id)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS cat_approval_notifications_owner_modify ON public.cat_approval_notifications
    ';
    EXECUTE '
      CREATE POLICY cat_approval_notifications_owner_modify
        ON public.cat_approval_notifications
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;

  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated';

    EXECUTE '
      DROP POLICY IF EXISTS rate_limits_client_select ON public.rate_limits
    ';
    EXECUTE '
      CREATE POLICY rate_limits_client_select
        ON public.rate_limits
        FOR SELECT
        USING (false)
    ';
    EXECUTE '
      DROP POLICY IF EXISTS rate_limits_client_modify ON public.rate_limits
    ';
    EXECUTE '
      CREATE POLICY rate_limits_client_modify
        ON public.rate_limits
        FOR ALL
        USING (false)
        WITH CHECK (false)
    ';
  END IF;

  -- Historical drift compatibility: older environments may still have crate_opens
  -- (current schema uses crate_openings). Keep this as a follow-up item if present.
  IF to_regclass('public.crate_opens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crate_opens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.crate_opens FROM anon, authenticated';
    EXECUTE '
      DROP POLICY IF EXISTS crate_opens_private ON public.crate_opens
    ';
    EXECUTE '
      CREATE POLICY crate_opens_private
        ON public.crate_opens
        FOR ALL
        USING (false)
        WITH CHECK (false)
    ';
  END IF;
END $$;
