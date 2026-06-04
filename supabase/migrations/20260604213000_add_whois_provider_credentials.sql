CREATE TABLE IF NOT EXISTS public.whois_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id),
  CONSTRAINT whois_provider_credentials_provider_check CHECK (
    provider_id IN ('oti-labs', 'domainduck', 'rdap-api')
  )
);

ALTER TABLE public.whois_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their WHOIS provider credentials" ON public.whois_provider_credentials;
CREATE POLICY "Users can insert their WHOIS provider credentials"
ON public.whois_provider_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their WHOIS provider credentials" ON public.whois_provider_credentials;
CREATE POLICY "Users can update their WHOIS provider credentials"
ON public.whois_provider_credentials
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their WHOIS provider credentials" ON public.whois_provider_credentials;
CREATE POLICY "Users can delete their WHOIS provider credentials"
ON public.whois_provider_credentials
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE public.whois_provider_credentials IS
  'Stores user-provided optional WHOIS provider API keys. Browser clients may insert/update/delete their own keys, but no SELECT policy exposes raw keys back to the browser. Edge Functions read keys with service-role access.';
