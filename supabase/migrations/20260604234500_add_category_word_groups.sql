ALTER TABLE public.app_user_settings
  ADD COLUMN IF NOT EXISTS category_word_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_user_settings_category_word_groups_array'
  ) THEN
    ALTER TABLE public.app_user_settings
      ADD CONSTRAINT app_user_settings_category_word_groups_array
      CHECK (jsonb_typeof(category_word_groups) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.app_user_settings.category_word_groups IS
  'User-defined synonym/word groups that create auto categories from different words, such as steel, besi, and baja.';
