CREATE TABLE IF NOT EXISTS public.app_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_word_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_mine_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_user_settings_category_names_object
    CHECK (jsonb_typeof(category_name_overrides) = 'object'),
  CONSTRAINT app_user_settings_category_manual_overrides_object
    CHECK (jsonb_typeof(category_manual_overrides) = 'object'),
  CONSTRAINT app_user_settings_category_word_groups_array
    CHECK (jsonb_typeof(category_word_groups) = 'array'),
  CONSTRAINT app_user_settings_auto_mine_rules_array
    CHECK (jsonb_typeof(auto_mine_rules) = 'array')
);

ALTER TABLE public.app_user_settings
  ADD COLUMN IF NOT EXISTS category_manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.app_user_settings
  ADD COLUMN IF NOT EXISTS category_word_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.app_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their app settings" ON public.app_user_settings;
CREATE POLICY "Users can read their app settings"
ON public.app_user_settings
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their app settings" ON public.app_user_settings;
CREATE POLICY "Users can insert their app settings"
ON public.app_user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their app settings" ON public.app_user_settings;
CREATE POLICY "Users can update their app settings"
ON public.app_user_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.app_user_settings IS
  'Stores user-scoped app preferences that should sync across browsers, including category rename overrides and Auto Mine name-server combination rules.';
