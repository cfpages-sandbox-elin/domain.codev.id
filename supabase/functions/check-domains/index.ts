// This function runs on a cron schedule to check for domain status changes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'
import { checkDecisionForDomain, Domain, DomainStatus, DomainTag } from './scheduler.ts'
import { dispatchPendingNotifications, enqueueDropNotifications } from './notifications.ts'

console.log('✅ "check-domains" function loaded');

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
      .select('id, user_id, domain_name, status, tag, expiration_date, registered_date, last_checked');
    
    if (fetchError) throw fetchError;

    if (!domains || domains.length === 0) {
      console.log('No domains found.');
      let notificationResult = { sent: 0, failed: 0 };
      try {
        notificationResult = await dispatchPendingNotifications(supabaseAdmin);
      } catch (notificationError) {
        console.error('Notification dispatcher failed:', notificationError);
      }
      return new Response(JSON.stringify({ message: 'No domains to check.', notifications: notificationResult }), {
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
      .sort((a, b) => {
        const priorityDifference = b.decision.priority - a.decision.priority;
        if (priorityDifference !== 0) return priorityDifference;
        const aLastChecked = a.domain.last_checked ? new Date(a.domain.last_checked).getTime() : 0;
        const bLastChecked = b.domain.last_checked ? new Date(b.domain.last_checked).getTime() : 0;
        return aLastChecked - bLastChecked;
      })
      .slice(0, Number.isFinite(maxChecks) && maxChecks > 0 ? maxChecks : 50);

    const skippedCount = domains.length - dueDomains.length;

    if (dueDomains.length === 0) {
      console.log(`No domains are due for targeted checking. Skipped ${domains.length} domain(s) to save quota.`);
      let notificationResult = { sent: 0, failed: 0 };
      try {
        notificationResult = await dispatchPendingNotifications(supabaseAdmin);
      } catch (notificationError) {
        console.error('Notification dispatcher failed:', notificationError);
      }
      return new Response(JSON.stringify({
        message: 'No domains are due for targeted checking.',
        scanned: domains.length,
        skipped: domains.length,
        notifications: notificationResult,
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
      const whoisData = await getWhoisData(domain.domain_name, { telemetryClient: supabaseAdmin, userId: domain.user_id });

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
    const detectedDrops: Array<{ domain: Domain; newStatus: DomainStatus; detectedAt: string }> = [];
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(CHECK_CONCURRENCY, dueDomains.length) }, async () => {
      while (nextIndex < dueDomains.length) {
        const domain = dueDomains[nextIndex].domain as Domain;
        nextIndex += 1;
        const update = await checkDomain(domain);
        if (update) {
          updatesToApply.push(update);
          if (
            domain.tag === 'to-snatch'
            && domain.status !== 'available'
            && domain.status !== 'dropped'
            && (update.status === 'available' || update.status === 'dropped')
          ) {
            detectedDrops.push({
              domain,
              newStatus: update.status,
              detectedAt: update.last_checked || new Date().toISOString(),
            });
          }
        }
      }
    });

    await Promise.all(workers);

    // Batch update the domains in the database
    if (updatesToApply.length > 0) {
      for (const event of detectedDrops) {
        const queued = await enqueueDropNotifications(supabaseAdmin, event.domain, event.newStatus, event.detectedAt);
        console.log(`Queued ${queued} drop notification(s) for ${event.domain.domain_name}.`);
      }

      console.log(`Applying ${updatesToApply.length} updates...`);
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .upsert(updatesToApply);

      if (updateError) throw updateError;
      console.log('✅ Batch update successful.');
    } else {
        console.log('No domains needed updates.');
    }

    let notificationResult = { sent: 0, failed: 0 };
    try {
      notificationResult = await dispatchPendingNotifications(supabaseAdmin);
      console.log(`Notification dispatch: ${notificationResult.sent} sent, ${notificationResult.failed} failed.`);
    } catch (notificationError) {
      console.error('Notification dispatcher failed:', notificationError);
    }

    return new Response(JSON.stringify({
      message: `Checked ${dueDomains.length} due domain(s). Updated ${updatesToApply.length}. Skipped ${skippedCount}.`,
      scanned: domains.length,
      checked: dueDomains.length,
      updated: updatesToApply.length,
      skipped: skippedCount,
      notifications: notificationResult,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred:', err.message);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
