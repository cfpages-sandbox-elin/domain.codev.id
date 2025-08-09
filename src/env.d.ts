interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_WHO_DAT_URL?: string;
  readonly VITE_WHO_DAT_AUTH_KEY?: string;
  readonly VITE_WHOIS_API_KEY?: string;
  readonly VITE_APILAYER_API_KEY?: string;
  readonly VITE_WHOISFREAKS_API_KEY?: string;
  readonly VITE_WHOAPI_COM_API_KEY?: string;
  readonly VITE_RAPIDAPI_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}