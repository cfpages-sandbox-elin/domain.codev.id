import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { buildSnapshot, derivePositions, fetchSerpWithRotation } from '../_shared/serp-logic.ts';
import type { RankMatchMode, SerpDevice } from '../_shared/serp-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHECKS_PER_RUN = 20;

type KeywordRow = {
  id: string;
  user_id: string;
  keyword: string;
  locale: string;
  device: SerpDevice;
  location: string | null;
  check_interval_hours: number;
};

const runKeywordCheck = async (admin: any, keyword: KeywordRow) => {
  const checkInsert = await admin.from('rank_checks').insert({
    keyword_id: keyword.id,
    user_id: keyword.user_id,
    status: 'running',
  }).select('id').single();

  if (checkInsert.error || !checkInsert.data) {
    throw new Error(checkInsert.error?.message || 'Failed to create rank check');
  }
  const checkId = checkInsert.data.id as string;

  try {
    const { data: links, error: linksError } = await admin
      .from('rank_keyword_domains')
      .select('domain_id, match_mode, target_url, domains!inner(domain_name)')
      .eq('keyword_id', keyword.id);

    if (linksError) throw linksError;

    const domainLinks = (links || []).map((row: any) => ({
      domain_id: row.domain_id as number,
      domain_name: String(row.domains?.domain_name || ''),
      match_mode: (row.match_mode || 'domain') as RankMatchMode,
      target_url: row.target_url as string | null,
    })).filter((row: { domain_name: string }) => row.domain_name);

    const { result, attempts } = await fetchSerpWithRotation(admin, keyword.user_id, {
      keyword: keyword.keyword,
      locale: keyword.locale || 'id',
      device: keyword.device || 'desktop',
      location: keyword.location,
      depth: 100,
    });

    const snapshot = buildSnapshot({
      keyword: keyword.keyword,
      locale: keyword.locale || 'id',
      device: keyword.device || 'desktop',
      location: keyword.location,
    }, result.provider, result.organic);

    const storageKey = `${keyword.user_id}/${keyword.id}/${checkId}.json`;

    await admin.from('rank_checks').update({
      status: 'succeeded',
      provider: result.provider,
      completed_at: new Date().toISOString(),
      storage_key: storageKey,
      serp_json: snapshot,
      result_count: result.organic.length,
      provider_attempts: attempts,
      error_message: null,
    }).eq('id', checkId);

    if (domainLinks.length > 0) {
      const positions = derivePositions(result.organic, domainLinks).map(position => ({
        check_id: checkId,
        keyword_id: keyword.id,
        domain_id: position.domain_id,
        user_id: keyword.user_id,
        position: position.position,
        rank_url: position.rank_url,
        rank_title: position.rank_title,
        found: position.found,
      }));
      const { error: posError } = await admin.from('rank_positions').insert(positions);
      if (posError) throw posError;
    }

    const next = new Date(Date.now() + Math.max(keyword.check_interval_hours || 24, 6) * 3600 * 1000);
    await admin.from('rank_keywords').update({
      last_checked_at: new Date().toISOString(),
      next_check_at: next.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', keyword.id);

    return { checkId, provider: result.provider, organicCount: result.organic.length, positions: domainLinks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = (error as { attempts?: unknown })?.attempts || [];
    await admin.from('rank_checks').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: message,
      provider_attempts: attempts,
    }).eq('id', checkId);

    const next = new Date(Date.now() + 6 * 3600 * 1000);
    await admin.from('rank_keywords').update({
      next_check_at: next.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', keyword.id);

    throw error;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cronSecret = Deno.env.get('CRON_SECRET') || '';
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

    const admin = createClient(supabaseUrl, serviceRoleKey);
    let body: { keywordId?: string; userId?: string } = {};
    try {
      body = req.method === 'POST' ? await req.json() : {};
    } catch {
      body = {};
    }

    // Cron path
    if (cronSecret && bearer === cronSecret) {
      const nowIso = new Date().toISOString();
      const { data: due, error } = await admin
        .from('rank_keywords')
        .select('id, user_id, keyword, locale, device, location, check_interval_hours')
        .eq('enabled', true)
        .lte('next_check_at', nowIso)
        .order('next_check_at', { ascending: true })
        .limit(MAX_CHECKS_PER_RUN);
      if (error) throw error;

      const results = [];
      for (const keyword of due || []) {
        try {
          const result = await runKeywordCheck(admin, keyword as KeywordRow);
          results.push({ keywordId: keyword.id, ok: true, ...result });
        } catch (error) {
          results.push({
            keywordId: keyword.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return new Response(JSON.stringify({ mode: 'cron', checked: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticated user path — single keyword check
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.keywordId) {
      return new Response(JSON.stringify({ error: 'keywordId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: keyword, error: keywordError } = await admin
      .from('rank_keywords')
      .select('id, user_id, keyword, locale, device, location, check_interval_hours')
      .eq('id', body.keywordId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (keywordError) throw keywordError;
    if (!keyword) {
      return new Response(JSON.stringify({ error: 'Keyword not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await runKeywordCheck(admin, keyword as KeywordRow);
    return new Response(JSON.stringify({ mode: 'manual', ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      attempts: (error as { attempts?: unknown })?.attempts,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
