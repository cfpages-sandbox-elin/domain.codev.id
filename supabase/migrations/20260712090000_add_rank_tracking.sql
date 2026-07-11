-- Keyword-first SERP rank tracking + user-supplied SERP provider credentials.

CREATE TABLE IF NOT EXISTS public.rank_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  keyword_key text NOT NULL,
  engine text NOT NULL DEFAULT 'google',
  locale text NOT NULL DEFAULT 'id',
  device text NOT NULL DEFAULT 'desktop',
  location text,
  enabled boolean NOT NULL DEFAULT true,
  check_interval_hours integer NOT NULL DEFAULT 24 CHECK (check_interval_hours BETWEEN 6 AND 168),
  last_checked_at timestamptz,
  next_check_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rank_keywords_engine_check CHECK (engine IN ('google')),
  CONSTRAINT rank_keywords_device_check CHECK (device IN ('desktop', 'mobile')),
  CONSTRAINT rank_keywords_unique UNIQUE (user_id, keyword_key, engine, locale, device, location)
);

CREATE INDEX IF NOT EXISTS rank_keywords_user_next_check_idx
  ON public.rank_keywords (user_id, enabled, next_check_at);

CREATE TABLE IF NOT EXISTS public.rank_keyword_domains (
  keyword_id uuid NOT NULL REFERENCES public.rank_keywords(id) ON DELETE CASCADE,
  domain_id integer NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_mode text NOT NULL DEFAULT 'domain',
  target_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (keyword_id, domain_id),
  CONSTRAINT rank_keyword_domains_match_mode_check CHECK (
    match_mode IN ('domain', 'subdomain', 'exact_url', 'prefix')
  )
);

CREATE INDEX IF NOT EXISTS rank_keyword_domains_user_domain_idx
  ON public.rank_keyword_domains (user_id, domain_id);

CREATE TABLE IF NOT EXISTS public.rank_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES public.rank_keywords(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  storage_key text,
  serp_json jsonb,
  result_count integer,
  error_message text,
  provider_attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT rank_checks_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS rank_checks_keyword_requested_idx
  ON public.rank_checks (keyword_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS rank_checks_user_requested_idx
  ON public.rank_checks (user_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.rank_positions (
  id bigserial PRIMARY KEY,
  check_id uuid NOT NULL REFERENCES public.rank_checks(id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES public.rank_keywords(id) ON DELETE CASCADE,
  domain_id integer NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer,
  rank_url text,
  rank_title text,
  found boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rank_positions_check_domain_unique UNIQUE (check_id, domain_id)
);

CREATE INDEX IF NOT EXISTS rank_positions_history_idx
  ON public.rank_positions (user_id, domain_id, keyword_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rank_positions_keyword_created_idx
  ON public.rank_positions (keyword_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.serp_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id),
  CONSTRAINT serp_provider_credentials_provider_check CHECK (
    provider_id IN (
      'serper',
      'serpapi',
      'searchapi',
      'valueserp',
      'scaleserp',
      'zenserp',
      'serpwow',
      'serpstack',
      'scrapingdog',
      'hasdata'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.serp_provider_telemetry (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  estimated_month_used integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  block_reason text,
  last_used_at timestamptz,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider_id)
);

ALTER TABLE public.rank_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_keyword_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serp_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serp_provider_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own rank keywords" ON public.rank_keywords;
CREATE POLICY "Users manage own rank keywords"
ON public.rank_keywords
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own rank keyword domains" ON public.rank_keyword_domains;
CREATE POLICY "Users manage own rank keyword domains"
ON public.rank_keyword_domains
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own rank checks" ON public.rank_checks;
CREATE POLICY "Users read own rank checks"
ON public.rank_checks
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own rank positions" ON public.rank_positions;
CREATE POLICY "Users read own rank positions"
ON public.rank_positions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert serp credentials" ON public.serp_provider_credentials;
CREATE POLICY "Users insert serp credentials"
ON public.serp_provider_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update serp credentials" ON public.serp_provider_credentials;
CREATE POLICY "Users update serp credentials"
ON public.serp_provider_credentials
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete serp credentials" ON public.serp_provider_credentials;
CREATE POLICY "Users delete serp credentials"
ON public.serp_provider_credentials
FOR DELETE
USING (auth.uid() = user_id);

-- No SELECT policy on serp_provider_credentials: raw keys stay Edge Function / service-role only.

COMMENT ON TABLE public.rank_keywords IS
  'Keyword-centric SERP tracking configs. One SERP fetch per keyword serves all linked domains.';
COMMENT ON TABLE public.serp_provider_credentials IS
  'User-pasted third-party SERP API keys. Browser can write/delete; service role reads for Edge Functions.';
