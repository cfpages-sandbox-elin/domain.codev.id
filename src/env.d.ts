interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  glob<T = unknown>(
    pattern: string,
    options?: {
      query?: string;
      import?: string;
      eager?: boolean;
    }
  ): Record<string, T>;
}
