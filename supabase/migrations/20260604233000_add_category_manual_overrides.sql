ALTER TABLE public.app_user_settings
  ADD COLUMN IF NOT EXISTS category_manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_user_settings_category_manual_overrides_object'
  ) THEN
    ALTER TABLE public.app_user_settings
      ADD CONSTRAINT app_user_settings_category_manual_overrides_object
      CHECK (jsonb_typeof(category_manual_overrides) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.app_user_settings.category_manual_overrides IS
  'Manual include/exclude domain ID overrides for deterministic auto categories.';
