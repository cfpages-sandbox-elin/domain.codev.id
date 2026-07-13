import type {
  RankDevice,
  RankKeyword,
  RankKeywordWithLinks,
  RankPosition,
  SerpProviderStatus,
} from '../types';
import { getSession, supabase } from './supabaseService';

const normalizeKeywordKey = (keyword: string) => keyword.trim().toLowerCase().replace(/\s+/g, ' ');

export const getSerpProviderStatuses = async (): Promise<SerpProviderStatus[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('get-serp-providers');
    if (error) {
      console.error('Error fetching SERP provider statuses:', error);
      return null;
    }
    return Array.isArray(data?.providers) ? data.providers as SerpProviderStatus[] : null;
  } catch (error) {
    console.error('Critical error fetching SERP provider statuses:', error);
    return null;
  }
};

export const listRankKeywords = async (): Promise<RankKeywordWithLinks[]> => {
  if (!supabase) return [];
  const session = await getSession();
  if (!session) return [];

  const { data: keywords, error } = await supabase
    .from('rank_keywords')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing rank keywords:', error);
    throw error;
  }

  const rows = (keywords || []) as RankKeyword[];
  if (rows.length === 0) return [];

  const keywordIds = rows.map(row => row.id);
  const { data: links, error: linksError } = await supabase
    .from('rank_keyword_domains')
    .select('keyword_id, domain_id')
    .in('keyword_id', keywordIds);

  if (linksError) {
    console.error('Error listing rank keyword domains:', linksError);
    throw linksError;
  }

  const { data: positions, error: positionsError } = await supabase
    .from('rank_positions')
    .select('keyword_id, domain_id, position, found, rank_url, created_at, check_id')
    .in('keyword_id', keywordIds)
    .order('created_at', { ascending: false });

  if (positionsError) {
    console.error('Error listing rank positions:', positionsError);
    throw positionsError;
  }

  const linksByKeyword = new Map<string, number[]>();
  for (const link of (links || []) as Array<{ keyword_id: string; domain_id: number }>) {
    const list = linksByKeyword.get(link.keyword_id) || [];
    list.push(link.domain_id);
    linksByKeyword.set(link.keyword_id, list);
  }

  const latestByKeywordDomain = new Map<string, RankKeywordWithLinks['latestPositions'][number]>();
  for (const position of (positions || []) as RankPosition[]) {
    const key = `${position.keyword_id}:${position.domain_id}`;
    if (latestByKeywordDomain.has(key)) continue;
    latestByKeywordDomain.set(key, {
      domain_id: position.domain_id,
      position: position.position,
      found: position.found,
      rank_url: position.rank_url,
      created_at: position.created_at,
    });
  }

  return rows.map(row => {
    const domainIds = linksByKeyword.get(row.id) || [];
    const latestPositions = domainIds
      .map(domainId => latestByKeywordDomain.get(`${row.id}:${domainId}`))
      .filter((item): item is RankKeywordWithLinks['latestPositions'][number] => Boolean(item));
    return {
      ...row,
      domainIds,
      latestPositions,
    };
  });
};

export const createRankKeyword = async (input: {
  keyword: string;
  locale?: string;
  device?: RankDevice;
  domainIds: number[];
  checkIntervalHours?: number;
}): Promise<RankKeyword> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const session = await getSession();
  if (!session) throw new Error('Sign in before creating keywords.');

  const keyword = input.keyword.trim();
  if (!keyword) throw new Error('Keyword is required.');
  const keywordKey = normalizeKeywordKey(keyword);
  const locale = (input.locale || 'id').trim() || 'id';
  const device = input.device || 'desktop';

  const { data, error } = await supabase
    .from('rank_keywords')
    .insert([{
      user_id: session.user.id,
      keyword,
      keyword_key: keywordKey,
      engine: 'google',
      locale,
      device,
      location: null,
      enabled: true,
      check_interval_hours: input.checkIntervalHours || 24,
      next_check_at: new Date().toISOString(),
    }] as never)
    .select('*')
    .single();

  if (error) throw error;
  const row = data as RankKeyword;

  const uniqueDomainIds = Array.from(new Set(input.domainIds.filter(id => id > 0)));
  if (uniqueDomainIds.length > 0) {
    const { error: linkError } = await supabase
      .from('rank_keyword_domains')
      .insert(uniqueDomainIds.map(domainId => ({
        keyword_id: row.id,
        domain_id: domainId,
        user_id: session.user.id,
        match_mode: 'domain',
        target_url: null,
      })) as never);
    if (linkError) throw linkError;
  }

  return row;
};

export const updateRankKeywordDomains = async (keywordId: string, domainIds: number[]): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const session = await getSession();
  if (!session) throw new Error('Sign in required.');

  const { error: deleteError } = await supabase
    .from('rank_keyword_domains')
    .delete()
    .eq('keyword_id', keywordId);
  if (deleteError) throw deleteError;

  const uniqueDomainIds = Array.from(new Set(domainIds.filter(id => id > 0)));
  if (uniqueDomainIds.length === 0) return;

  const { error } = await supabase
    .from('rank_keyword_domains')
    .insert(uniqueDomainIds.map(domainId => ({
      keyword_id: keywordId,
      domain_id: domainId,
      user_id: session.user.id,
      match_mode: 'domain',
      target_url: null,
    })) as never);
  if (error) throw error;
};

export const setRankKeywordEnabled = async (keywordId: string, enabled: boolean): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('rank_keywords')
    .update({ enabled, updated_at: new Date().toISOString() } as never)
    .eq('id', keywordId);
  if (error) throw error;
};

export const deleteRankKeyword = async (keywordId: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('rank_keywords')
    .delete()
    .eq('id', keywordId);
  if (error) throw error;
};

export const runRankCheck = async (keywordId: string): Promise<{ ok: boolean; error?: string; provider?: string; organicCount?: number }> => {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  try {
    const { data, error } = await supabase.functions.invoke('check-ranks', {
      body: { keywordId },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (data?.error) {
      return { ok: false, error: String(data.error) };
    }
    return {
      ok: Boolean(data?.ok),
      provider: data?.provider,
      organicCount: data?.organicCount,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
