import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Domain, DomainTag, WhoisData } from '../types';
import { getWhoisData } from '../services/whoisService';
import * as SupabaseService from '../services/supabaseService';
import type { DomainInsert, DomainUpdate } from '../services/supabaseService';
import {
  getWhoisFailureAdvice,
  getWhoisFailureReason,
  isDomainMissingWhoisData,
} from '../utils/appDomainLogic';
import { readCachedDomains, writeCachedDomains } from '../utils/appDataCache';
import type { BulkAddResult, BulkDomain } from '../components/bulk-add/bulkAddLogic';

type ViewName = 'dashboard' | 'docs' | 'categories' | 'settings';
type AddDomainOptions = { optimistic?: boolean };

const WHOIS_AUTO_REPAIR_CONCURRENCY = 6;
const BULK_ADD_CONCURRENCY = 6;

interface UseDomainActionsOptions {
  session: Session | null;
  view: ViewName;
  addLog: (message: string) => void;
  checkAndNotify: (domain: Domain) => void;
  updateProviderFromWhoisData: (whoisData: WhoisData) => void;
  onWhoisCheckFinished?: (domain: Domain, whoisData: WhoisData) => void;
}

export const useDomainActions = ({
  session,
  view,
  addLog,
  checkAndNotify,
  updateProviderFromWhoisData,
  onWhoisCheckFinished,
}: UseDomainActionsOptions) => {
  const [isDomainListLoading, setIsDomainListLoading] = useState(true);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [whoisDetailsByDomainId, setWhoisDetailsByDomainId] = useState<Record<number, WhoisData>>({});
  const [autoRepairingDomainIds, setAutoRepairingDomainIds] = useState<Set<number>>(() => new Set());
  const [pendingDomainIds, setPendingDomainIds] = useState<Set<number>>(() => new Set());
  const [tagUpdatingDomainIds, setTagUpdatingDomainIds] = useState<Set<number>>(() => new Set());
  const [isAutoRepairingWhois, setIsAutoRepairingWhois] = useState(false);

  const autoRepairAttemptedIdsRef = useRef<Set<number>>(new Set());
  const nextPendingDomainIdRef = useRef(-1);
  const domainsRef = useRef<Domain[]>([]);
  const hasHydratedDomainSnapshotRef = useRef(false);
  const tagUpdatingDomainIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  useEffect(() => {
    if (!session) {
      setDomains([]);
      setIsDomainListLoading(false);
      setWhoisDetailsByDomainId({});
      setAutoRepairingDomainIds(new Set());
      setPendingDomainIds(new Set());
      setTagUpdatingDomainIds(new Set());
      autoRepairAttemptedIdsRef.current.clear();
      tagUpdatingDomainIdsRef.current.clear();
      hasHydratedDomainSnapshotRef.current = false;
      return;
    }

    let cancelled = false;

    const fetchAndSyncDomains = async () => {
      const cachedDomains = readCachedDomains(session.user.id);
      if (cachedDomains && cachedDomains.length > 0) {
        hasHydratedDomainSnapshotRef.current = true;
        setDomains(cachedDomains);
        setIsDomainListLoading(false);
        addLog(`✅ Loaded ${cachedDomains.length} cached domains. Refreshing from Supabase in the background.`);
      } else {
        setIsDomainListLoading(true);
        addLog('➡️ Fetching user domains...');
      }
      try {
        const userDomains = await SupabaseService.getDomains();
        if (cancelled) return;
        if (userDomains) {
          hasHydratedDomainSnapshotRef.current = true;
          setDomains(userDomains);
          writeCachedDomains(session.user.id, userDomains);
          addLog(`✅ Found ${userDomains.length} domains.`);
        } else {
          addLog('❌ Failed to fetch domains.');
        }
      } finally {
        if (!cancelled) setIsDomainListLoading(false);
      }
    };

    void fetchAndSyncDomains();

    return () => {
      cancelled = true;
    };
  }, [session, addLog]);

  useEffect(() => {
    if (!session || !hasHydratedDomainSnapshotRef.current) return;
    writeCachedDomains(session.user.id, domains);
  }, [domains, session]);

  const markTagUpdateStart = useCallback((id: number) => {
    if (tagUpdatingDomainIdsRef.current.has(id)) return false;
    tagUpdatingDomainIdsRef.current.add(id);
    setTagUpdatingDomainIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return true;
  }, []);

  const markTagUpdateFinished = useCallback((id: number) => {
    tagUpdatingDomainIdsRef.current.delete(id);
    setTagUpdatingDomainIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const addDomain = useCallback(async (domainName: string, tag: DomainTag, options: AddDomainOptions = {}): Promise<Domain | null> => {
    const normalizedDomainName = domainName.trim().toLowerCase();
    if (domains.some(d => d.domain_name.toLowerCase() === normalizedDomainName)) {
      addLog(`⚠️ Attempted to add duplicate domain: ${normalizedDomainName}`);
      return null;
    }

    const now = new Date().toISOString();
    const pendingDomain: Domain | null = options.optimistic ? {
      id: nextPendingDomainIdRef.current--,
      user_id: session?.user.id || 'pending',
      domain_name: normalizedDomainName,
      tag,
      status: 'unknown',
      expiration_date: null,
      registered_date: null,
      registrar: null,
      domain_statuses: null,
      name_servers: null,
      created_at: now,
      last_checked: null,
    } : null;

    if (pendingDomain) {
      setDomains(prevDomains => [pendingDomain, ...prevDomains]);
      setPendingDomainIds(prev => {
        const next = new Set(prev);
        next.add(pendingDomain.id);
        return next;
      });
    }

    const clearPendingDomain = () => {
      if (!pendingDomain) return;
      setPendingDomainIds(prev => {
        const next = new Set(prev);
        next.delete(pendingDomain.id);
        return next;
      });
    };

    const removePendingDomain = () => {
      if (!pendingDomain) return;
      setDomains(prevDomains => prevDomains.filter(domain => domain.id !== pendingDomain.id));
      clearPendingDomain();
    };

    const initialDomainData: DomainInsert = {
      domain_name: normalizedDomainName,
      tag,
      status: 'unknown',
      expiration_date: null,
      registered_date: null,
      registrar: null,
      domain_statuses: null,
      name_servers: null,
      last_checked: null,
    };

    const newDomain = await SupabaseService.addDomain(initialDomainData);
    if (!newDomain) {
      removePendingDomain();
      addLog(`❌ Failed to add ${normalizedDomainName}.`);
      return null;
    }

    setDomains(prevDomains => pendingDomain
      ? prevDomains.map(domain => domain.id === pendingDomain.id ? newDomain : domain)
      : [newDomain, ...prevDomains]);
    clearPendingDomain();
    autoRepairAttemptedIdsRef.current.add(newDomain.id);
    addLog(`✅ Added ${normalizedDomainName}. Checking WHOIS status in the background.`);

    void (async () => {
      const whoisData = await getWhoisData(normalizedDomainName, addLog);
      updateProviderFromWhoisData(whoisData);

      const failureReason = whoisData.status === 'unknown'
        ? 'WHOIS check failed or no provider could confirm the domain status.'
        : getWhoisFailureReason(whoisData);
      const shouldStoreAsFailed = Boolean(failureReason);
      const savedTag = whoisData.status === 'available' || whoisData.status === 'dropped' ? 'to-snatch' : tag;

      const updates: DomainUpdate = {
        tag: savedTag,
        status: shouldStoreAsFailed ? 'unknown' : whoisData.status,
        expiration_date: shouldStoreAsFailed ? null : whoisData.expirationDate,
        registered_date: shouldStoreAsFailed ? null : whoisData.registeredDate,
        registrar: shouldStoreAsFailed ? null : whoisData.registrar,
        domain_statuses: shouldStoreAsFailed ? null : whoisData.domainStatuses || null,
        name_servers: shouldStoreAsFailed ? null : whoisData.nameServers || null,
        last_checked: new Date().toISOString(),
      };

      const updatedDomain = await SupabaseService.updateDomain(newDomain.id, updates);
      if (!updatedDomain) {
        addLog(`❌ WHOIS check finished but failed to update ${normalizedDomainName}.`);
        return;
      }

      setDomains(prevDomains => prevDomains.map(domain => domain.id === newDomain.id ? updatedDomain : domain));
      setWhoisDetailsByDomainId(prev => ({ ...prev, [updatedDomain.id]: whoisData }));
      onWhoisCheckFinished?.(updatedDomain, whoisData);

      if (shouldStoreAsFailed) {
        autoRepairAttemptedIdsRef.current.add(updatedDomain.id);
        const advice = getWhoisFailureAdvice(whoisData);
        addLog(`⚠️ WHOIS failed for ${normalizedDomainName}. ${failureReason} ${advice}`);
      } else {
        checkAndNotify(updatedDomain);
        addLog(`✅ WHOIS check finished for ${normalizedDomainName}. Status is ${updatedDomain.status}.`);
      }
    })();

    return newDomain;
  }, [addLog, checkAndNotify, domains, onWhoisCheckFinished, session?.user.id, updateProviderFromWhoisData]);

  const bulkAddDomains = useCallback(async (bulkDomains: BulkDomain[], defaultTag: DomainTag): Promise<BulkAddResult> => {
    const seenDomains = new Set(domains.map(domain => domain.domain_name.toLowerCase()));
    const domainsToAdd: BulkDomain[] = [];

    for (const item of bulkDomains) {
      const domainName = item.domainName.trim().toLowerCase();
      if (!domainName || seenDomains.has(domainName)) continue;
      seenDomains.add(domainName);
      domainsToAdd.push({ domainName, tag: item.tag });
    }

    if (domainsToAdd.length !== bulkDomains.length) {
      const skippedCount = bulkDomains.length - domainsToAdd.length;
      addLog(`⚠️ Skipped ${skippedCount} duplicate domain(s) from bulk add.`);
    }

    if (domainsToAdd.length === 0) {
      addLog('ℹ️ No new domains to add from bulk list.');
      return {
        requestedCount: bulkDomains.length,
        acceptedCount: 0,
        addedCount: 0,
        skippedCount: bulkDomains.length,
      };
    }

    setIsBulkProcessing(true);
    addLog(`➡️ Starting bulk add of ${domainsToAdd.length} domains...`);

    const workerCount = Math.min(BULK_ADD_CONCURRENCY, domainsToAdd.length);
    let nextIndex = 0;
    let completedCount = 0;
    let addedCount = 0;

    const runWorker = async (workerIndex: number) => {
      while (nextIndex < domainsToAdd.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = domainsToAdd[currentIndex];
        addLog(`🔄 Worker ${workerIndex + 1}: checking ${item.domainName} (${currentIndex + 1}/${domainsToAdd.length})...`);
        const addedDomain = await addDomain(item.domainName, item.tag || defaultTag, { optimistic: true });
        if (addedDomain) addedCount += 1;
        completedCount += 1;
        if (completedCount % BULK_ADD_CONCURRENCY === 0 || completedCount === domainsToAdd.length) {
          addLog(`ℹ️ Bulk add progress: ${completedCount}/${domainsToAdd.length} processed.`);
        }
      }
    };

    try {
      await Promise.allSettled(Array.from({ length: workerCount }, (_, index) => runWorker(index)));
      addLog('✅ Bulk add finished.');
    } finally {
      setIsBulkProcessing(false);
    }

    return {
      requestedCount: bulkDomains.length,
      acceptedCount: domainsToAdd.length,
      addedCount,
      skippedCount: bulkDomains.length - domainsToAdd.length,
    };
  }, [addDomain, addLog, domains]);

  const removeDomain = useCallback(async (id: number) => {
    const domainToRemove = domainsRef.current.find(d => d.id === id);
    const success = await SupabaseService.removeDomain(id);
    if (success) {
      setDomains(prevDomains => prevDomains.filter(d => d.id !== id));
      setWhoisDetailsByDomainId(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (domainToRemove) addLog(`✅ Successfully removed ${domainToRemove.domain_name}.`);
    }
  }, [addLog]);

  const toggleDomainTag = useCallback(async (id: number) => {
    if (!markTagUpdateStart(id)) return;
    const domain = domainsRef.current.find(d => d.id === id);
    if (!domain) {
      markTagUpdateFinished(id);
      return;
    }

    try {
      const nextTags: DomainTag[] = ['mine', 'to-snatch', 'others'];
      const currentIndex = nextTags.indexOf(domain.tag);
      const newTag = nextTags[(currentIndex + 1) % nextTags.length];

      const updatedDomain = await SupabaseService.updateDomain(id, { tag: newTag });
      if (updatedDomain) {
        setDomains(prevDomains => prevDomains.map(d =>
          d.id === id ? updatedDomain : d
        ));
        addLog(`✅ Switched tag for ${domain.domain_name} to "${newTag}".`);
      }
    } finally {
      markTagUpdateFinished(id);
    }
  }, [addLog, markTagUpdateFinished, markTagUpdateStart]);

  const setDomainTag = useCallback(async (id: number, tag: DomainTag) => {
    const domain = domainsRef.current.find(d => d.id === id);
    if (!domain || domain.tag === tag) return;
    if ((domain.status === 'available' || domain.status === 'dropped') && tag !== 'to-snatch') return;
    if (!markTagUpdateStart(id)) return;

    try {
      const updatedDomain = await SupabaseService.updateDomain(id, { tag });
      if (updatedDomain) {
        setDomains(prevDomains => prevDomains.map(d =>
          d.id === id ? updatedDomain : d
        ));
        addLog(`✅ Switched tag for ${domain.domain_name} to "${tag}".`);
      }
    } finally {
      markTagUpdateFinished(id);
    }
  }, [addLog, markTagUpdateFinished, markTagUpdateStart]);

  const markDomainsAsMine = useCallback(async (domainIds: number[], reason: string) => {
    const targets = domains.filter(domain => (
      domainIds.includes(domain.id)
      && domain.tag !== 'mine'
      && domain.status !== 'available'
      && domain.status !== 'dropped'
    ));

    if (targets.length === 0) return;

    addLog(`➡️ ${reason}: marking ${targets.length} domain(s) as Mine based on name-server combination.`);
    const updatedDomains: Domain[] = [];

    for (const domain of targets) {
      const updatedDomain = await SupabaseService.updateDomain(domain.id, { tag: 'mine' });
      if (updatedDomain) {
        updatedDomains.push(updatedDomain);
      }
    }

    if (updatedDomains.length > 0) {
      setDomains(prevDomains => prevDomains.map(domain => (
        updatedDomains.find(updated => updated.id === domain.id) || domain
      )));
      addLog(`✅ Auto Mine updated ${updatedDomains.length}/${targets.length} domain(s).`);
    }
  }, [addLog, domains]);

  const syncWhoisForDomain = useCallback(async (domain: Domain, mode: 'manual' | 'auto' = 'manual') => {
    addLog(mode === 'manual'
      ? `🔄 Re-checking domain: ${domain.domain_name}`
      : `🔄 Auto-fixing missing WHOIS data: ${domain.domain_name}`);
    const whoisData = await getWhoisData(domain.domain_name, addLog);
    updateProviderFromWhoisData(whoisData);
    const forcedTag = whoisData.status === 'available' || whoisData.status === 'dropped' ? 'to-snatch' : domain.tag;

    const updates: DomainUpdate = {
      status: whoisData.status,
      tag: forcedTag,
      expiration_date: whoisData.expirationDate,
      registered_date: whoisData.registeredDate,
      registrar: whoisData.registrar,
      domain_statuses: whoisData.domainStatuses || null,
      name_servers: whoisData.nameServers || null,
      last_checked: new Date().toISOString(),
    };

    const updatedDomain = await SupabaseService.updateDomain(domain.id, updates);

    if (updatedDomain) {
      setDomains(prev => prev.map(d => d.id === domain.id ? updatedDomain : d));
      setWhoisDetailsByDomainId(prev => ({ ...prev, [domain.id]: whoisData }));
      if (updatedDomain.status !== 'unknown') {
        checkAndNotify(updatedDomain);
        addLog(`${mode === 'manual' ? '✅ Re-check' : '✅ Auto-fix'} successful for ${domain.domain_name}. Status is now ${updatedDomain.status}.`);
      } else {
        addLog(`${mode === 'manual' ? '❌ Re-check' : '❌ Auto-fix'} failed for ${domain.domain_name}. Still unknown.`);
      }
    }
  }, [addLog, checkAndNotify, updateProviderFromWhoisData]);

  const recheckDomain = useCallback(async (id: number) => {
    const domain = domainsRef.current.find(d => d.id === id);
    if (!domain) return;
    await syncWhoisForDomain(domain, 'manual');
  }, [syncWhoisForDomain]);

  useEffect(() => {
    if (!session || view !== 'dashboard' || domains.length === 0 || isAutoRepairingWhois || isBulkProcessing) return;

    const domainsToRepair = domains.filter(domain => {
      if (!isDomainMissingWhoisData(domain)) return false;
      if (pendingDomainIds.has(domain.id)) return false;
      return !autoRepairAttemptedIdsRef.current.has(domain.id);
    });

    if (domainsToRepair.length === 0) return;

    domainsToRepair.forEach(domain => autoRepairAttemptedIdsRef.current.add(domain.id));

    let cancelled = false;
    let nextIndex = 0;
    const workerCount = Math.min(WHOIS_AUTO_REPAIR_CONCURRENCY, domainsToRepair.length);

    const runWorker = async () => {
      while (!cancelled && nextIndex < domainsToRepair.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const domain = domainsToRepair[currentIndex];
        setAutoRepairingDomainIds(prev => {
          const next = new Set(prev);
          next.add(domain.id);
          return next;
        });
        try {
          await syncWhoisForDomain(domain, 'auto');
        } finally {
          setAutoRepairingDomainIds(prev => {
            const next = new Set(prev);
            next.delete(domain.id);
            return next;
          });
        }
      }
    };

    setIsAutoRepairingWhois(true);
    addLog(`🔄 Auto-checking ${domainsToRepair.length} domain(s) with incomplete WHOIS data using ${workerCount} worker(s). Rate-limited providers are skipped server-side.`);

    Promise.allSettled(Array.from({ length: workerCount }, runWorker))
      .then(() => {
        if (!cancelled) {
          addLog('✅ Automatic incomplete WHOIS check finished.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAutoRepairingWhois(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, view, domains, pendingDomainIds, isAutoRepairingWhois, isBulkProcessing, syncWhoisForDomain, addLog]);

  return {
    domains,
    isDomainListLoading,
    isBulkProcessing,
    whoisDetailsByDomainId,
    autoRepairingDomainIds,
    pendingDomainIds,
    tagUpdatingDomainIds,
    addDomain,
    bulkAddDomains,
    removeDomain,
    toggleDomainTag,
    setDomainTag,
    markDomainsAsMine,
    recheckDomain,
  };
};
