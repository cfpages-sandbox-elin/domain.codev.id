import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AutoMineRule, CategoryManualOverrides, CategoryWordGroup, Domain, DomainTag, WhoisData, WhoisProviderStatus } from './types';
import { getWhoisData, getWhoisProviderStatuses } from './services/whoisService';
import { saveWhoisProviderCredential, removeWhoisProviderCredential, supabase, supabaseConfigError } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import * as SupabaseService from './services/supabaseService';
import type { DomainInsert, DomainUpdate } from './services/supabaseService';

import Header from './components/Header';
import DomainList from './components/DomainList';
import Modal from './components/Modal';
import Auth from './components/Auth';
import Spinner from './components/Spinner';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import StatusLog from './components/StatusLog';
import DocsPage from './components/DocsPage';
import BulkAddModal from './components/BulkAddModal';
import WhoisProviderPanel from './components/WhoisProviderPanel';
import Tooltip from './components/Tooltip';
import IntegrationSettingsModal from './components/IntegrationSettingsModal';
import AutoMinePanel from './components/AutoMinePanel';
import CategoriesPage from './components/CategoriesPage';
import { PlusIcon } from './components/icons';
import {
  readStoredAutoMineRules,
  readStoredCategoryManualOverrides,
  readStoredCategoryNameOverrides,
  readStoredCategoryWordGroups,
  writeStoredAutoMineRules,
  writeStoredCategoryManualOverrides,
  writeStoredCategoryNameOverrides,
  writeStoredCategoryWordGroups,
} from './utils/userSettingsStorage';

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

type View = 'dashboard' | 'docs' | 'categories' | 'settings';
type SettingsTab = 'whois' | 'auto-mine';

type BulkDomain = { domainName: string; tag?: DomainTag };
type DomainEntryTab = 'single' | 'bulk';
type AddDomainOptions = { optimistic?: boolean };
const WHOIS_AUTO_REPAIR_CONCURRENCY = 6;

const getWhoisFailureReason = (whoisData: WhoisData): string | null => {
  if ((whoisData.status === 'registered' || whoisData.status === 'expired') && !whoisData.expirationDate) {
    return 'WHOIS provider confirmed the domain is registered, but did not return an expiry date.';
  }

  return null;
};

const getWhoisFailureAdvice = (whoisData: WhoisData): string => {
  const attemptMessages = (whoisData.providerAttempts || [])
    .map(attempt => attempt.errorMessage || '')
    .join(' ')
    .toLowerCase();

  if (/month|monthly|free-tier/.test(attemptMessages)) {
    return 'The provider quota looks monthly-limited, so try again after the provider quota resets next month. The dashboard will keep it visible for future re-check.';
  }

  if (/day|daily/.test(attemptMessages)) {
    return 'The provider quota looks daily-limited, so try again tomorrow or after the provider daily reset.';
  }

  if (/429|too many requests|rate[\s-]?limit|per-minute|retry after|temporarily blocked/.test(attemptMessages)) {
    return 'This looks rate-limited, so try re-checking again in another minute.';
  }

  if (/missing required environment|key not provided|missing-key/.test(attemptMessages)) {
    return 'Some backup providers are not configured, so check the WHOIS provider dashboard before retrying.';
  }

  return 'Try re-checking later; the domain stays in your list so you do not need to enter it again.';
};

const isDomainMissingWhoisData = (domain: Domain) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (domain.status === 'available' || domain.status === 'dropped' || domain.status === 'reserved') return false;
  if (domain.status === 'registered' || domain.status === 'expired' || domain.tag === 'mine') {
    return !domain.expiration_date
      || !domain.registrar
      || !domain.domain_statuses
      || domain.domain_statuses.length === 0;
  }
  return false;
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [whoisDetailsByDomainId, setWhoisDetailsByDomainId] = useState<Record<number, WhoisData>>({});
  const [whoisProviders, setWhoisProviders] = useState<WhoisProviderStatus[]>([]);
  const [isWhoisProviderLoading, setIsWhoisProviderLoading] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isDomainEntryModalOpen, setIsDomainEntryModalOpen] = useState(false);
  const [isIntegrationSettingsOpen, setIsIntegrationSettingsOpen] = useState(false);
  const [domainEntryInitialTab, setDomainEntryInitialTab] = useState<DomainEntryTab>('single');
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('whois');
  const [categoryNameOverrides, setCategoryNameOverrides] = useState<Record<string, string>>(readStoredCategoryNameOverrides);
  const [categoryManualOverrides, setCategoryManualOverrides] = useState<CategoryManualOverrides>(readStoredCategoryManualOverrides);
  const [categoryWordGroups, setCategoryWordGroups] = useState<CategoryWordGroup[]>(readStoredCategoryWordGroups);
  const [autoMineRules, setAutoMineRules] = useState<AutoMineRule[]>(readStoredAutoMineRules);
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);
  const [autoRepairingDomainIds, setAutoRepairingDomainIds] = useState<Set<number>>(() => new Set());
  const [pendingDomainIds, setPendingDomainIds] = useState<Set<number>>(() => new Set());
  const autoRepairAttemptedIdsRef = useRef<Set<number>>(new Set());
  const nextPendingDomainIdRef = useRef(-1);
  const domainsRef = useRef<Domain[]>([]);
  const [isAutoRepairingWhois, setIsAutoRepairingWhois] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  }, []);

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  const refreshWhoisProviders = useCallback(async () => {
    setIsWhoisProviderLoading(true);
    const statuses = await getWhoisProviderStatuses();
    if (statuses) {
      setWhoisProviders(current => statuses.map(status => {
        const existing = current.find(provider => provider.id === status.id);
        return existing ? {
          ...status,
          quota: status.quota || existing.quota,
          lastResultAt: status.lastResultAt || existing.lastResultAt,
          lastErrorMessage: status.lastErrorMessage || existing.lastErrorMessage,
        } : status;
      }));
      addLog(`✅ Loaded ${statuses.length} WHOIS provider statuses.`);
    } else {
      addLog('⚠️ WHOIS provider dashboard is unavailable. Deploy get-whois-providers if needed.');
    }
    setIsWhoisProviderLoading(false);
  }, [addLog]);

  const updateProviderFromWhoisData = useCallback((whoisData: WhoisData) => {
    if (!whoisData.provider) return;

    setWhoisProviders(current => current.map(provider => {
      if (provider.id !== whoisData.provider) {
        const failedAttempt = whoisData.providerAttempts?.find(attempt => attempt.provider === provider.id && attempt.status === 'failed');
        return failedAttempt ? { ...provider, lastErrorMessage: failedAttempt.errorMessage } : provider;
      }

      return {
        ...provider,
        quota: whoisData.quota || provider.quota,
        lastResultAt: new Date().toISOString(),
        lastErrorMessage: undefined,
      };
    }));
  }, []);

  const handleSaveWhoisProviderCredential = useCallback(async (providerId: string, apiKey: string) => {
    const saved = await saveWhoisProviderCredential({ providerId, apiKey });
    if (saved) {
      addLog(`✅ Saved WHOIS provider key for ${providerId}.`);
    }
    return saved;
  }, [addLog]);

  const handleRemoveWhoisProviderCredential = useCallback(async (providerId: string) => {
    const removed = await removeWhoisProviderCredential(providerId);
    if (removed) {
      addLog(`✅ Removed WHOIS provider key for ${providerId}.`);
    }
    return removed;
  }, [addLog]);

  useEffect(() => {
    addLog('ℹ️ Application initializing...');
    if (supabaseConfigError) {
      setLoading(false);
      addLog(`❌ ${supabaseConfigError}`);
      return;
    }
    addLog('✅ Supabase configuration loaded.');
    addLog('ℹ️ WHOIS checks are performed server-side for security.');


    const fetchSession = async () => {
        const currentSession = await SupabaseService.getSession();
        setSession(currentSession);
        setLoading(false);
        addLog(currentSession ? '✅ Session found.' : 'ℹ️ No active session.');
    };
    fetchSession();

    const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if(!session) {
          setDomains([]);
          setWhoisDetailsByDomainId({});
          setAutoRepairingDomainIds(new Set());
          setPendingDomainIds(new Set());
          setCategoryNameOverrides(readStoredCategoryNameOverrides());
          setCategoryManualOverrides(readStoredCategoryManualOverrides());
          setCategoryWordGroups(readStoredCategoryWordGroups());
          setAutoMineRules(readStoredAutoMineRules());
          setUserSettingsLoaded(false);
          autoRepairAttemptedIdsRef.current.clear();
          addLog('ℹ️ User signed out.');
        } else {
          addLog('ℹ️ Auth state changed, user is signed in.');
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, [addLog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        const shouldOpenDomainEntry = ((event.ctrlKey || event.metaKey) && key === 'n') || (event.altKey && key === 'n');
        if (shouldOpenDomainEntry) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if(session) {
                setDomainEntryInitialTab('single');
                setIsDomainEntryModalOpen(true);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [session]);

  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [message, ...prev.filter(m => m !== message)]);
  }, []);
  
  const checkAndNotify = useCallback((domain: Domain) => {
    if (domain.tag === 'mine' && domain.expiration_date) {
      const now = new Date();
      const expiry = new Date(domain.expiration_date);
      const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (daysUntilExpiry <= 0) {
        addNotification(`Your domain ${domain.domain_name} is expired. Renew it immediately if it is still recoverable.`);
      } else if (daysUntilExpiry <= 7) {
        addNotification(`Your domain ${domain.domain_name} is expiring in ${Math.ceil(daysUntilExpiry)} days!`);
      }
    }
    if (domain.tag === 'others' && domain.expiration_date) {
      const now = new Date();
      const expiry = new Date(domain.expiration_date);
      const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
        addNotification(`Client/other domain ${domain.domain_name} is expiring in ${Math.ceil(daysUntilExpiry)} days.`);
      }
    }
    if(domain.status === 'dropped' && domain.tag === 'to-snatch') {
        addNotification(`The domain ${domain.domain_name} has dropped and is now available to register!`);
    }
  }, [addNotification]);
  
  useEffect(() => {
    if (session) {
      const fetchUserSettings = async () => {
        setUserSettingsLoaded(false);
        const settings = await SupabaseService.getUserAppSettings();
        if (settings) {
          setCategoryNameOverrides(settings.categoryNameOverrides);
          setCategoryManualOverrides(settings.categoryManualOverrides);
          setCategoryWordGroups(settings.categoryWordGroups);
          setAutoMineRules(settings.autoMineRules);
          writeStoredCategoryNameOverrides(settings.categoryNameOverrides);
          writeStoredCategoryManualOverrides(settings.categoryManualOverrides);
          writeStoredCategoryWordGroups(settings.categoryWordGroups);
          writeStoredAutoMineRules(settings.autoMineRules);
          addLog('✅ Loaded synced app settings.');
        } else {
          addLog('ℹ️ Using local app settings. Apply the app_user_settings migration to sync these across browsers.');
        }
        setUserSettingsLoaded(true);
      };
      const fetchAndSyncDomains = async () => {
        addLog('➡️ Fetching user domains...');
        const userDomains = await SupabaseService.getDomains();
        if (userDomains) {
          setDomains(userDomains);
          addLog(`✅ Found ${userDomains.length} domains.`);
        } else {
           addLog(`❌ Failed to fetch domains.`);
        }
      };
      fetchUserSettings();
      fetchAndSyncDomains();
      refreshWhoisProviders();
    }
  }, [session, addLog, refreshWhoisProviders]);

  useEffect(() => {
    writeStoredCategoryNameOverrides(categoryNameOverrides);
    if (!session || !userSettingsLoaded) return;
    void SupabaseService.saveUserAppSettings({ categoryNameOverrides });
  }, [categoryNameOverrides, session, userSettingsLoaded]);

  useEffect(() => {
    writeStoredCategoryManualOverrides(categoryManualOverrides);
    if (!session || !userSettingsLoaded) return;
    void SupabaseService.saveUserAppSettings({ categoryManualOverrides });
  }, [categoryManualOverrides, session, userSettingsLoaded]);

  useEffect(() => {
    writeStoredCategoryWordGroups(categoryWordGroups);
    if (!session || !userSettingsLoaded) return;
    void SupabaseService.saveUserAppSettings({ categoryWordGroups });
  }, [categoryWordGroups, session, userSettingsLoaded]);

  useEffect(() => {
    writeStoredAutoMineRules(autoMineRules);
    if (!session || !userSettingsLoaded) return;
    void SupabaseService.saveUserAppSettings({ autoMineRules });
  }, [autoMineRules, session, userSettingsLoaded]);

  useEffect(() => {
    if (session && domains.length > 0) {
        addLog(`ℹ️ Checking for notifications across ${domains.length} domains.`);
        domains.forEach(checkAndNotify);
    }
  }, [domains, session, addLog, checkAndNotify]);


  const addDomain = async (domainName: string, tag: DomainTag, options: AddDomainOptions = {}): Promise<Domain | null> => {
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

    const whoisData = await getWhoisData(normalizedDomainName, addLog);
    updateProviderFromWhoisData(whoisData);

    const failureReason = whoisData.status === 'unknown'
      ? 'WHOIS check failed or no provider could confirm the domain status.'
      : getWhoisFailureReason(whoisData);
    const shouldStoreAsFailed = Boolean(failureReason);
    const savedTag = whoisData.status === 'available' || whoisData.status === 'dropped' ? 'to-snatch' : tag;
    
    const newDomainData: DomainInsert = {
      domain_name: normalizedDomainName,
      tag: savedTag,
      status: shouldStoreAsFailed ? 'unknown' : whoisData.status,
      expiration_date: shouldStoreAsFailed ? null : whoisData.expirationDate,
      registered_date: shouldStoreAsFailed ? null : whoisData.registeredDate,
      registrar: shouldStoreAsFailed ? null : whoisData.registrar,
      domain_statuses: shouldStoreAsFailed ? null : whoisData.domainStatuses || null,
      name_servers: shouldStoreAsFailed ? null : whoisData.nameServers || null,
      last_checked: new Date().toISOString(),
    };
    const newDomain = await SupabaseService.addDomain(newDomainData);
    if(newDomain){
        setDomains(prevDomains => pendingDomain
          ? prevDomains.map(domain => domain.id === pendingDomain.id ? newDomain : domain)
          : [...prevDomains, newDomain]);
        clearPendingDomain();
        setWhoisDetailsByDomainId(prev => ({ ...prev, [newDomain.id]: whoisData }));
        if (shouldStoreAsFailed) {
          autoRepairAttemptedIdsRef.current.add(newDomain.id);
          const advice = getWhoisFailureAdvice(whoisData);
          addLog(`⚠️ Added ${normalizedDomainName} as WHOIS failed. ${failureReason} ${advice}`);
        } else {
          checkAndNotify(newDomain);
          addLog(`✅ Successfully added ${normalizedDomainName}.`);
        }
        return newDomain;
    } else {
        removePendingDomain();
        addLog(`❌ Failed to add ${normalizedDomainName}.`);
        return null;
    }
  };

  const handleBulkAdd = async (bulkDomains: BulkDomain[], defaultTag: DomainTag) => {
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
        return;
    }

    setIsDomainEntryModalOpen(false);
    setIsBulkProcessing(true);
    addLog(`➡️ Starting bulk add of ${domainsToAdd.length} domains...`);

    const BULK_CONCURRENCY = 6; // Also matches Cloudflare Workers/Pages simultaneous outgoing connection guidance for the future server-side port.
    const workerCount = Math.min(BULK_CONCURRENCY, domainsToAdd.length);
    let nextIndex = 0;
    let completedCount = 0;

    const runWorker = async (workerIndex: number) => {
      while (nextIndex < domainsToAdd.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = domainsToAdd[currentIndex];
        addLog(`🔄 Worker ${workerIndex + 1}: checking ${item.domainName} (${currentIndex + 1}/${domainsToAdd.length})...`);
        await addDomain(item.domainName, item.tag || defaultTag, { optimistic: true });
        completedCount += 1;
        if (completedCount % BULK_CONCURRENCY === 0 || completedCount === domainsToAdd.length) {
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
  };

  const handleAddDomainFromModal = (domainName: string, tag: DomainTag) => {
    setIsDomainEntryModalOpen(false);
    void addDomain(domainName, tag, { optimistic: true });
    return true;
  };

  const removeDomain = useCallback(async (id: number) => {
    const domainToRemove = domainsRef.current.find(d => d.id === id);
    const success = await SupabaseService.removeDomain(id);
    if(success){
        setDomains(prevDomains => prevDomains.filter(d => d.id !== id));
        setWhoisDetailsByDomainId(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if(domainToRemove) addLog(`✅ Successfully removed ${domainToRemove.domain_name}.`);
    }
  }, [addLog]);
  
  const toggleDomainTag = useCallback(async (id: number) => {
    const domain = domainsRef.current.find(d => d.id === id);
    if (!domain) return;
  
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
  }, [addLog]);

  const setDomainTag = useCallback(async (id: number, tag: DomainTag) => {
    const domain = domainsRef.current.find(d => d.id === id);
    if (!domain || domain.tag === tag) return;
    if ((domain.status === 'available' || domain.status === 'dropped') && tag !== 'to-snatch') return;

    const updatedDomain = await SupabaseService.updateDomain(id, { tag });
    if (updatedDomain) {
      setDomains(prevDomains => prevDomains.map(d =>
        d.id === id ? updatedDomain : d
      ));
      addLog(`✅ Switched tag for ${domain.domain_name} to "${tag}".`);
    }
  }, [addLog]);

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

  const handleShowInfo = useCallback((domain: Domain) => {
    if (!domain.expiration_date) return;
    const expiry = new Date(domain.expiration_date);
    const gracePeriodEnd = new Date(expiry);
    gracePeriodEnd.setDate(expiry.getDate() + 30);
    const redemptionPeriodEnd = new Date(gracePeriodEnd);
    redemptionPeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
    const dropDate = new Date(redemptionPeriodEnd);
    dropDate.setDate(redemptionPeriodEnd.getDate() + 5);

    const infoBody = `
      <p class="mb-4 text-slate-600 dark:text-slate-400"><b>Note:</b> This is an estimation based on typical domain registrar policies for .com, .net, etc. Actual dates may vary.</p>
      <ul class="space-y-3">
        <li class="flex items-start"><span class="bg-yellow-100 text-yellow-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-yellow-900 dark:text-yellow-300">Expired</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Domain Expired: ${formatDate(expiry)}</p><p class="text-sm text-slate-500 dark:text-slate-400">The domain is no longer active.</p></div></li>
        <li class="flex items-start"><span class="bg-orange-100 text-orange-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-orange-900 dark:text-orange-300">Grace Period</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Ends around: ${formatDate(gracePeriodEnd)}</p><p class="text-sm text-slate-500 dark:text-slate-400">Original owner can usually renew at normal price.</p></div></li>
        <li class="flex items-start"><span class="bg-red-100 text-red-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-red-900 dark:text-red-300">Redemption</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Ends around: ${formatDate(redemptionPeriodEnd)}</p><p class="text-sm text-slate-500 dark:text-slate-400">Owner can recover domain for a high fee.</p></div></li>
        <li class="flex items-start"><span class="bg-green-100 text-green-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-green-900 dark:text-green-300">Drops</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Becomes available after: ${formatDate(dropDate)}</p><p class="text-sm text-slate-500 dark:text-slate-400">The domain will be released for public registration.</p></div></li>
      </ul>`;

    setModalContent({
      title: `Estimated Drop Timeline for ${domain.domain_name}`,
      body: infoBody,
    });
    setIsInfoModalOpen(true);
    addLog(`ℹ️ Displayed drop info for ${domain.domain_name}.`);
  }, [addLog]);

  const handleExport = (format: 'json' | 'csv') => {
    let content = '';
    let mimeType = '';
    let filename = '';

    if (format === 'json') {
        content = JSON.stringify(domains, null, 2);
        mimeType = 'application/json';
        filename = 'domain_codev_export.json';
        addLog('✅ Exporting data as JSON...');
    } else { // csv
        const header = 'id,user_id,domain_name,tag,status,expiration_date,registered_date,registrar,created_at,last_checked\n';
        const rows = domains.map(d => 
            [d.id, d.user_id, d.domain_name, d.tag, d.status, d.expiration_date, d.registered_date, `"${d.registrar || ''}"`, d.created_at, d.last_checked].join(',')
        ).join('\n');
        content = header + rows;
        mimeType = 'text/csv';
        filename = 'domain_codev_export.csv';
        addLog('✅ Exporting data as CSV...');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('✅ Export download initiated.');
  };
  
  const renderDashboard = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg dark:shadow-black/40">
        <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Tracked Domains</h2>
        <DomainList 
            domains={domains}
            categoryNameOverrides={categoryNameOverrides}
            categoryManualOverrides={categoryManualOverrides}
            categoryWordGroups={categoryWordGroups}
            whoisDetailsByDomainId={whoisDetailsByDomainId}
            onRemove={removeDomain}
            onShowInfo={handleShowInfo}
            onToggleTag={toggleDomainTag}
            onSetTag={setDomainTag}
            onRecheck={recheckDomain}
            autoRepairingDomainIds={autoRepairingDomainIds}
            pendingDomainIds={pendingDomainIds}
            onExportRequest={handleExport}
            onImportRequest={() => {
              setDomainEntryInitialTab('bulk');
              setIsDomainEntryModalOpen(true);
            }}
            isProcessing={isBulkProcessing}
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage provider fallback behavior and ownership automation.</p>
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setSettingsTab('whois')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            settingsTab === 'whois'
              ? 'bg-brand-blue text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          WHOIS Providers
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab('auto-mine')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            settingsTab === 'auto-mine'
              ? 'bg-brand-blue text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Auto Mine
        </button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 dark:shadow-black/40">
        {settingsTab === 'whois' ? (
          <WhoisProviderPanel
            providers={whoisProviders}
            isLoading={isWhoisProviderLoading}
            onRefresh={refreshWhoisProviders}
            onSaveCredential={handleSaveWhoisProviderCredential}
            onRemoveCredential={handleRemoveWhoisProviderCredential}
            defaultExpanded
          />
        ) : (
          <AutoMinePanel
            domains={domains}
            rules={autoMineRules}
            onRulesChange={setAutoMineRules}
            onApplyMatches={markDomainsAsMine}
            addLog={addLog}
          />
        )}
      </div>
    </div>
  );

  const renderCurrentView = () => {
    switch (view) {
      case 'docs':
        return <DocsPage />;
      case 'categories':
        return (
          <CategoriesPage
            domains={domains}
            categoryNameOverrides={categoryNameOverrides}
            categoryManualOverrides={categoryManualOverrides}
            categoryWordGroups={categoryWordGroups}
            onCategoryNameOverridesChange={setCategoryNameOverrides}
            onCategoryManualOverridesChange={setCategoryManualOverrides}
            onCategoryWordGroupsChange={setCategoryWordGroups}
          />
        );
      case 'settings':
        return renderSettings();
      case 'dashboard':
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        session={session}
        notifications={notifications}
        clearNotifications={() => setNotifications([])}
        setView={setView}
        onOpenIntegrations={() => setIsIntegrationSettingsOpen(true)}
      />
      
      <main className="container mx-auto p-4 md:p-8">
        {loading ? (
            <div className="flex items-center justify-center pt-20">
              <Spinner size="lg" color="border-brand-blue" />
            </div>
        ) : supabaseConfigError ? (
          <ConfigErrorScreen message={supabaseConfigError} />
        ) : !session ? (
          <Auth />
        ) : (
          renderCurrentView()
        )}
      </main>

      {!loading && session && (
        <Tooltip content="Add new domain. Shortcut: Ctrl + N; fallback: Alt + N if the browser captures Ctrl + N." className="fixed bottom-8 right-8 z-40" placement="top">
          <button
            onClick={() => {
              setDomainEntryInitialTab('single');
              setIsDomainEntryModalOpen(true);
            }}
            className="bg-brand-blue hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
            aria-label="Add new domain"
          >
            <PlusIcon className="w-6 h-6" />
          </button>
        </Tooltip>
      )}

      {!loading && <StatusLog logs={logs} />}

      {!loading && session && (
        <>
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title={modalContent.title}>
                <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.body }}></div>
            </Modal>
            <BulkAddModal
                isOpen={isDomainEntryModalOpen}
                onClose={() => setIsDomainEntryModalOpen(false)}
                initialTab={domainEntryInitialTab}
                existingDomains={domains}
                onAddDomain={handleAddDomainFromModal}
                onBulkAdd={handleBulkAdd}
                isLoading={isBulkProcessing}
                addLog={addLog}
            />
            <IntegrationSettingsModal
                isOpen={isIntegrationSettingsOpen}
                onClose={() => setIsIntegrationSettingsOpen(false)}
                addLog={addLog}
            />
        </>
      )}
    </div>
  );
};

export default App;
