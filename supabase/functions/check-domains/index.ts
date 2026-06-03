// This function runs on a cron schedule to check for domain status changes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'

console.log('✅ "check-domains" function loaded');

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainTag = 'mine' | 'to-snatch';
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

interface Domain {
  id: number;
  domain_name: string;
  status: DomainStatus;
  tag: DomainTag;
  expiration_date: string | null;
  last_checked: string | null;
}

interface DomainUpdate {
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  domain_statuses?: string[] | null;
  name_servers?: string[] | null;
  last_checked?: string | null;
}

interface CheckDecision {
  due: boolean;
  reason: string;
  priority: number;
}

const hoursSince = (dateString: string | null, now: Date) => {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  return Number.isFinite(diffMs) ? diffMs / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
};

const daysUntil = (dateString: string | null, now: Date) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = date.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const isAvailableLike = (status: DomainStatus) => status === 'available' || status === 'dropped';

const checkDecisionForDomain = (domain: Domain, now: Date): CheckDecision => {
  const lastCheckedHours = hoursSince(domain.last_checked, now);
  const daysUntilExpiry = daysUntil(domain.expiration_date, now);

  if (isAvailableLike(domain.status)) {
    return {
      due: false,
      reason: 'already marked available; manual buy/re-check is enough',
      priority: 0,
    };
  }

  if (daysUntilExpiry === null) {
    const intervalHours = domain.status === 'unknown' ? 24 * 7 : 24 * 30;
    return {
      due: lastCheckedHours >= intervalHours,
      reason: domain.status === 'unknown'
        ? 'unknown expiry; retry weekly'
        : 'missing expiry; retry monthly',
      priority: domain.status === 'unknown' ? 55 : 15,
    };
  }

  if (daysUntilExpiry > 30) {
    return {
      due: false,
      reason: 'expiry is more than 30 days away',
      priority: 0,
    };
  }

  if (domain.tag === 'mine') {
    if (daysUntilExpiry > 14) {
      return {
        due: lastCheckedHours >= 24 * 14,
        reason: 'owned domain inside expiry month; check once around 30 days',
        priority: 30,
      };
    }

    if (daysUntilExpiry > 7) {
      return {
        due: lastCheckedHours >= 24 * 7,
        reason: 'owned domain nearing renewal window; weekly confirmation',
        priority: 40,
      };
    }

    if (daysUntilExpiry > 3) {
      return {
        due: lastCheckedHours >= 24 * 3,
        reason: 'owned domain close to expiry; confirm every 3 days',
        priority: 50,
      };
    }

    return {
      due: lastCheckedHours >= 24,
      reason: daysUntilExpiry >= 0
        ? 'owned domain in final renewal days; daily confirmation'
        : 'owned domain expired; daily renewal reminder confirmation',
      priority: 60,
    };
  }

  if (daysUntilExpiry > 14) {
    return {
      due: lastCheckedHours >= 24 * 14,
      reason: 'target domain inside expiry month; check once around 30 days',
      priority: 35,
    };
  }

  if (daysUntilExpiry > 7) {
    return {
      due: lastCheckedHours >= 24 * 7,
      reason: 'target domain two weeks from expiry; weekly confirmation',
      priority: 45,
    };
  }

  if (daysUntilExpiry > 0) {
    return {
      due: lastCheckedHours >= 24,
      reason: 'target domain in final week before expiry; daily confirmation',
      priority: 65,
    };
  }

  const daysSinceExpiry = Math.abs(daysUntilExpiry);
  if (daysSinceExpiry < 45) {
    return {
      due: lastCheckedHours >= 24,
      reason: 'target domain likely in grace/redemption period; daily check',
      priority: 70,
    };
  }

  if (daysSinceExpiry < 58) {
    return {
      due: lastCheckedHours >= 12,
      reason: 'target domain approaching estimated drop window; twice-daily check',
      priority: 80,
    };
  }

  if (daysSinceExpiry <= 75) {
    return {
      due: lastCheckedHours >= 3,
      reason: 'target domain near estimated drop date; check every 3 hours',
      priority: 95,
    };
  }

  return {
    due: lastCheckedHours >= 24,
    reason: 'target domain is past estimated drop window but not available yet; daily check',
    priority: 75,
  };
};

//-------------------------------------------------
// Main Server Logic
//-------------------------------------------------
serve(async (req) => {
  try {
    // Check for the cron secret from the Authorization header
    // @ts-ignore
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      console.error('CRON_SECRET is not set in environment variables. Function cannot run securely.');
      return new Response('Configuration error: Cron secret not set.', { status: 500 });
    }
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job access attempt.');
      return new Response('Unauthorized', { status: 401 });
    }
    
    console.log('✅ Cron job authorized.');

    // Create a Supabase client with the service_role key
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch metadata only. WHOIS quota is spent after the targeted scheduler marks a row due.
    const now = new Date();
    const { data: domains, error: fetchError } = await supabaseAdmin
      .from('domains')
      .select('id, domain_name, status, tag, expiration_date, last_checked');
    
    if (fetchError) throw fetchError;

    if (!domains || domains.length === 0) {
      console.log('No domains found.');
      return new Response(JSON.stringify({ message: 'No domains to check.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const maxChecks = Number.parseInt(
      // @ts-ignore
      Deno.env.get('WHOIS_CRON_MAX_CHECKS') || '50',
      10,
    );

    const decisions = domains
      .map((domain: Domain) => ({ domain, decision: checkDecisionForDomain(domain, now) }));

    const dueDomains = decisions
      .filter(item => item.decision.due)
      .sort((a, b) => b.decision.priority - a.decision.priority)
      .slice(0, Number.isFinite(maxChecks) && maxChecks > 0 ? maxChecks : 50);

    const skippedCount = domains.length - dueDomains.length;

    if (dueDomains.length === 0) {
      console.log(`No domains are due for targeted checking. Skipped ${domains.length} domain(s) to save quota.`);
      return new Response(JSON.stringify({
        message: 'No domains are due for targeted checking.',
        scanned: domains.length,
        skipped: domains.length,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Targeted scheduler selected ${dueDomains.length}/${domains.length} domain(s). Skipped ${skippedCount} to save quota.`);
    dueDomains.slice(0, 10).forEach(item => {
      console.log(`Due: ${item.domain.domain_name} (${item.decision.reason})`);
    });

    const checkDomain = async (domain: Domain): Promise<(DomainUpdate & { id: number }) | null> => {
      console.log(`➡️ Checking ${domain.domain_name}...`);
      const whoisData = await getWhoisData(domain.domain_name, { telemetryClient: supabaseAdmin });

      if (whoisData.status === 'unknown') {
        console.log(`⚠️ WHOIS check failed for ${domain.domain_name}. Skipping update.`);
        return null; // Skip update if WHOIS fails
      }
      
      const newStatus = (domain.status === 'expired' && whoisData.status === 'available') 
        ? 'dropped' 
        : whoisData.status;

      const payload: DomainUpdate & { id: number } = {
        id: domain.id,
        status: newStatus,
        expiration_date: whoisData.expirationDate,
        registered_date: whoisData.registeredDate,
        registrar: whoisData.registrar,
        domain_statuses: whoisData.domainStatuses || null,
        name_servers: whoisData.nameServers || null,
        last_checked: new Date().toISOString(),
      };

      if ((newStatus === 'available' || newStatus === 'dropped') && domain.tag === 'mine') {
        console.log(`⚠️ Provider says ${domain.domain_name} is available, but it is tagged as "mine". Keeping the tag unchanged.`);
      }
      
      console.log(`✅ Update for ${domain.domain_name}: status -> ${newStatus}`);
      return payload;
    };

    const CHECK_CONCURRENCY = 6;
    const updatesToApply: Array<DomainUpdate & { id: number }> = [];
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(CHECK_CONCURRENCY, dueDomains.length) }, async () => {
      while (nextIndex < dueDomains.length) {
        const domain = dueDomains[nextIndex].domain as Domain;
        nextIndex += 1;
        const update = await checkDomain(domain);
        if (update) updatesToApply.push(update);
      }
    });

    await Promise.all(workers);

    // Batch update the domains in the database
    if (updatesToApply.length > 0) {
      console.log(`Applying ${updatesToApply.length} updates...`);
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .upsert(updatesToApply);

      if (updateError) throw updateError;
      console.log('✅ Batch update successful.');
    } else {
        console.log('No domains needed updates.');
    }

    return new Response(JSON.stringify({
      message: `Checked ${dueDomains.length} due domain(s). Updated ${updatesToApply.length}. Skipped ${skippedCount}.`,
      scanned: domains.length,
      checked: dueDomains.length,
      updated: updatesToApply.length,
      skipped: skippedCount,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred:', err.message);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
