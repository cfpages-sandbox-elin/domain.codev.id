import React, { useState, useEffect, useCallback } from 'react';
import { Domain, DomainTag } from './types';
import { getWhoisData } from './services/whoisService';
import { supabase, supabaseConfigError } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import * as SupabaseService from './services/supabaseService';
import type { DomainInsert, DomainUpdate } from './services/supabaseService';

import Header from './components/Header';
import DomainForm from './components/DomainForm';
import DomainList from './components/DomainList';
import Modal from './components/Modal';
import Auth from './components/Auth';
import Spinner from './components/Spinner';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import StatusLog from './components/StatusLog';
import DocsPage from './components/DocsPage';
import BulkAddModal from './components/BulkAddModal';
import { PlusIcon } from './components/icons';

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

type View = 'dashboard' | 'docs';

type BulkDomain = { domainName: string; tag?: DomainTag };

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAddDomainModalOpen, setIsAddDomainModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [view, setView] = useState<View>('dashboard');

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  }, []);

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
        if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
            event.preventDefault();
            if(session) {
                setIsAddDomainModalOpen(true);
            }
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [session]);

  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [message, ...prev.filter(m => m !== message)]);
  }, []);
  
  const checkAndNotify = useCallback((domain: Domain) => {
    if (domain.tag === 'mine' && domain.expiration_date) {
      const now = new Date();
      const expiry = new Date(domain.expiration_date);
      const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
        addNotification(`Your domain ${domain.domain_name} is expiring in ${Math.ceil(daysUntilExpiry)} days!`);
      }
    }
    if(domain.status === 'dropped' && domain.tag === 'to-snatch') {
        addNotification(`The domain ${domain.domain_name} has dropped and is now available to register!`);
    }
  }, [addNotification]);
  
  useEffect(() => {
    if (session) {
      const fetchAndSyncDomains = async () => {
        addLog('➡️ Fetching user domains...');
        const userDomains = await SupabaseService.getDomains();
        if (userDomains) {
          setDomains(userDomains);
          addLog(`✅ Found ${userDomains.length} domains.`);

          const mineDomains = userDomains.filter(d => d.tag === 'mine');
          if (mineDomains.length > 0) {
              addLog(`🔄 Syncing ${mineDomains.length} "mine" domains in the background...`);
              
              const updatePromises = mineDomains.map(async (domain) => {
                  const whoisData = await getWhoisData(domain.domain_name); 
                  if (whoisData.status === 'available' || whoisData.status === 'dropped') {
                      const updates: DomainUpdate = { 
                          tag: 'to-snatch',
                          status: whoisData.status,
                          expiration_date: whoisData.expirationDate,
                          registered_date: whoisData.registeredDate,
                          registrar: whoisData.registrar,
                          last_checked: new Date().toISOString()
                      };
                      const updatedDomain = await SupabaseService.updateDomain(domain.id, updates);
                      if (updatedDomain) {
                          addLog(`✅ Synced ${domain.domain_name}: is available, tag switched to 'to-snatch'.`);
                      }
                      return updatedDomain;
                  }
                  return null;
              });

              const results = await Promise.all(updatePromises);
              const successfulUpdates = results.filter((d): d is Domain => d !== null);

              if (successfulUpdates.length > 0) {
                  setDomains(currentDomains => {
                      const updatedMap = new Map(successfulUpdates.map(d => [d.id, d]));
                      // Create a new array to ensure re-render
                      return currentDomains.map(d => updatedMap.get(d.id) || d);
                  });
              }
              addLog('✅ Background sync complete.');
          }
        } else {
           addLog(`❌ Failed to fetch domains.`);
        }
      };
      fetchAndSyncDomains();
    }
  }, [session, addLog]);

  useEffect(() => {
    if (session && domains.length > 0) {
        addLog(`ℹ️ Checking for notifications across ${domains.length} domains.`);
        domains.forEach(checkAndNotify);
    }
  }, [domains, session, addLog, checkAndNotify]);


  const addDomain = async (domainName: string, tag: DomainTag): Promise<Domain | null> => {
    if (domains.some(d => d.domain_name.toLowerCase() === domainName.toLowerCase())) {
      addLog(`⚠️ Attempted to add duplicate domain: ${domainName}`);
      return null;
    }
    const whoisData = await getWhoisData(domainName, addLog);
    
    let finalTag = tag;
    if (whoisData.status === 'available' || whoisData.status === 'dropped') {
        finalTag = 'to-snatch';
        if (tag === 'mine') {
            addLog(`ℹ️ Domain ${domainName} is available. Overriding tag to 'to-snatch' for accuracy.`);
        }
    }

    const newDomainData: DomainInsert = {
      domain_name: domainName,
      tag: finalTag,
      status: whoisData.status,
      expiration_date: whoisData.expirationDate,
      registered_date: whoisData.registeredDate,
      registrar: whoisData.registrar,
      last_checked: new Date().toISOString(),
    };
    const newDomain = await SupabaseService.addDomain(newDomainData);
    if(newDomain){
        setDomains(prevDomains => [...prevDomains, newDomain]);
        checkAndNotify(newDomain);
        addLog(`✅ Successfully added ${domainName}.`);
        return newDomain;
    } else {
        addLog(`❌ Failed to add ${domainName}.`);
        return null;
    }
  };

  const handleBulkAdd = async (bulkDomains: BulkDomain[], defaultTag: DomainTag) => {
    const domainsToAdd = bulkDomains.filter(item => 
        !domains.some(d => d.domain_name.toLowerCase() === item.domainName.toLowerCase())
    );
    
    if (domainsToAdd.length !== bulkDomains.length) {
        const skippedCount = bulkDomains.length - domainsToAdd.length;
        addLog(`⚠️ Skipped ${skippedCount} duplicate domain(s) from bulk add.`);
    }

    if (domainsToAdd.length === 0) {
        addLog('ℹ️ No new domains to add from bulk list.');
        return;
    }

    setIsBulkProcessing(true);
    addLog(`➡️ Starting bulk add of ${domainsToAdd.length} domains...`);

    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

    for (let i = 0; i < domainsToAdd.length; i += BATCH_SIZE) {
        const batch = domainsToAdd.slice(i, i + BATCH_SIZE);
        const batchNumber = i / BATCH_SIZE + 1;
        const totalBatches = Math.ceil(domainsToAdd.length / BATCH_SIZE);
        
        addLog(`🔄 Processing batch ${batchNumber} of ${totalBatches} (${batch.length} domains)...`);

        const promises = batch.map(item => addDomain(item.domainName, item.tag || defaultTag));
        await Promise.allSettled(promises);
        
        if (i + BATCH_SIZE < domainsToAdd.length) {
            addLog(`⌛ Waiting for ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }

    addLog('✅ Bulk add finished.');
    setIsBulkProcessing(false);
    setIsBulkAddModalOpen(false);
  };

  const handleAddDomainFromModal = async (domainName: string, tag: DomainTag) => {
    await addDomain(domainName, tag);
    setIsAddDomainModalOpen(false);
  };

  const removeDomain = async (id: number) => {
    const domainToRemove = domains.find(d => d.id === id);
    const success = await SupabaseService.removeDomain(id);
    if(success){
        setDomains(prevDomains => prevDomains.filter(d => d.id !== id));
        if(domainToRemove) addLog(`✅ Successfully removed ${domainToRemove.domain_name}.`);
    }
  };
  
  const toggleDomainTag = async (id: number) => {
    const domain = domains.find(d => d.id === id);
    if (!domain) return;
  
    const newTag = domain.tag === 'mine' ? 'to-snatch' : 'mine';
  
    if ((domain.status === 'available' || domain.status === 'dropped') && newTag === 'mine') {
      addLog(`⚠️ Attempted to tag an available domain (${domain.domain_name}) as "mine".`);
      alert('An available domain cannot be tagged as "Mine". Please register it first.');
      return;
    }
  
    const updatedDomain = await SupabaseService.updateDomain(id, { tag: newTag });
    if (updatedDomain) {
      setDomains(prevDomains => prevDomains.map(d =>
        d.id === id ? updatedDomain : d
      ));
      addLog(`✅ Switched tag for ${domain.domain_name} to "${newTag}".`);
    }
  };

  const recheckDomain = async (id: number) => {
    const domain = domains.find(d => d.id === id);
    if (!domain) return;

    addLog(`🔄 Re-checking domain: ${domain.domain_name}`);
    const whoisData = await getWhoisData(domain.domain_name, addLog);
    
    const updates: DomainUpdate = {
        status: whoisData.status,
        expiration_date: whoisData.expirationDate,
        registered_date: whoisData.registeredDate,
        registrar: whoisData.registrar,
        last_checked: new Date().toISOString(),
    };

    if ((whoisData.status === 'available' || whoisData.status === 'dropped') && domain.tag === 'mine') {
        updates.tag = 'to-snatch';
        addLog(`ℹ️ Domain ${domain.domain_name} is available. Switching tag to "to-snatch" for accuracy.`);
    }

    const updatedDomain = await SupabaseService.updateDomain(id, updates);

    if (updatedDomain) {
        setDomains(prev => prev.map(d => d.id === id ? updatedDomain : d));
        if (updatedDomain.status !== 'unknown') {
            checkAndNotify(updatedDomain);
            addLog(`✅ Re-check successful for ${domain.domain_name}. Status is now ${updatedDomain.status}.`);
        } else {
            addLog(`❌ Re-check failed for ${domain.domain_name}. Still unknown.`);
        }
    }
  };

  const handleShowInfo = (domain: Domain) => {
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
  };

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
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Tracked Domains</h2>
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-brand-blue p-4 rounded-r-lg mb-6 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold">Automated Daily Checks</p>
            <p className="mt-1">Your tracked domains are checked for status changes once a day. This requires a one-time setup of the Supabase Edge Function.</p>
            <button onClick={() => setView('docs')} className="font-semibold hover:underline mt-2 inline-block">Learn how to set up daily checks &rarr;</button>
        </div>
        <DomainList 
            domains={domains}
            onRemove={removeDomain}
            onShowInfo={handleShowInfo}
            onToggleTag={toggleDomainTag}
            onRecheck={recheckDomain}
            onExportRequest={handleExport}
            onImportRequest={() => setIsBulkAddModalOpen(true)}
            isProcessing={isBulkProcessing}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans">
      <Header session={session} notifications={notifications} clearNotifications={() => setNotifications([])} setView={setView} />
      
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
          view === 'dashboard' ? renderDashboard() : <DocsPage />
        )}
      </main>

      {!loading && session && (
        <button
            onClick={() => setIsAddDomainModalOpen(true)}
            className="fixed bottom-8 right-8 bg-brand-blue hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
            aria-label="Add new domain"
            title="Add new domain (Ctrl+N)"
        >
            <PlusIcon className="w-6 h-6" />
        </button>
      )}

      {!loading && <StatusLog logs={logs} />}

      {!loading && session && (
        <>
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title={modalContent.title}>
                <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.body }}></div>
            </Modal>
            <Modal isOpen={isAddDomainModalOpen} onClose={() => setIsAddDomainModalOpen(false)} title="Check and Track a New Domain">
                <div className="flex flex-col gap-4">
                    <p className="text-slate-600 dark:text-slate-400">
                        Enter a domain to check its availability. Your list is private, secure, and synced to your account.
                    </p>
                    <DomainForm onAddDomain={handleAddDomainFromModal} />
                </div>
            </Modal>
            <BulkAddModal
                isOpen={isBulkAddModalOpen}
                onClose={() => setIsBulkAddModalOpen(false)}
                onBulkAdd={handleBulkAdd}
                isLoading={isBulkProcessing}
                addLog={addLog}
            />
        </>
      )}
    </div>
  );
};

export default App;
