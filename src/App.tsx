import React, { useState, useEffect, useCallback } from 'react';
import { Domain, DomainTag, NewDomain } from './types';
import { getWhoisData } from './services/whoisService';
import { supabase, supabaseConfigError } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import * as SupabaseService from './services/supabaseService';

import Header from './components/Header';
import DomainForm from './components/DomainForm';
import DomainList from './components/DomainList';
import Modal from './components/Modal';
import Auth from './components/Auth';
import Spinner from './components/Spinner';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import StatusLog from './components/StatusLog';

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  }, []);

  useEffect(() => {
    addLog('ℹ️ Application initializing...');
    // If supabase is not configured, we can't do anything. Just stop loading.
    if (supabaseConfigError) {
      setLoading(false);
      addLog(`❌ ${supabaseConfigError}`);
      return;
    }

    addLog('✅ Supabase configuration loaded.');

    // Log WHOIS Provider status
    const whoisKeys = {
        'who-dat': import.meta.env.VITE_WHO_DAT_URL,
        'WhoisXMLAPI': import.meta.env.VITE_WHOIS_API_KEY,
        'apilayer.com': import.meta.env.VITE_APILAYER_API_KEY,
        'whoisfreaks.com': import.meta.env.VITE_WHOISFREAKS_API_KEY
    };

    let hasAnyWhoisKey = false;
    for(const [provider, key] of Object.entries(whoisKeys)) {
        if(key) {
            addLog(`✅ ${provider} provider is configured.`);
            hasAnyWhoisKey = true;
        } else {
            addLog(`⚠️ ${provider} provider is not configured.`);
        }
    }
    if(!hasAnyWhoisKey) {
        addLog('❌ No WHOIS providers configured. Domain lookups will fail.');
    }


    const fetchSession = async () => {
        const currentSession = await SupabaseService.getSession();
        setSession(currentSession);
        setLoading(false);
        addLog(currentSession ? '✅ Session found.' : 'ℹ️ No active session.');
    };

    fetchSession();

    // The 'supabase' is guaranteed to be non-null here due to the check above.
    const { data: authListener } = supabase!.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if(!session) {
          setDomains([]); // Clear data on logout
          addLog('ℹ️ User signed out.');
        } else {
          addLog('ℹ️ Auth state changed, user is signed in.');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [addLog]);

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
      const fetchDomains = async () => {
        addLog('➡️ Fetching user domains...');
        const userDomains = await SupabaseService.getDomains();
        if (userDomains) {
          setDomains(userDomains);
          addLog(`✅ Found ${userDomains.length} domains.`);
        } else {
           addLog(`❌ Failed to fetch domains.`);
        }
      };
      fetchDomains();
    }
  }, [session, addLog]);

  // When domain data changes (e.g., on initial load), check for notifications.
  useEffect(() => {
    if (session && domains.length > 0) {
        addLog(`ℹ️ Checking for notifications across ${domains.length} domains.`);
        domains.forEach(checkAndNotify);
    }
  }, [domains, session, addLog, checkAndNotify]);


  const addDomain = async (domainName: string, tag: DomainTag) => {
    if (domains.some(d => d.domain_name.toLowerCase() === domainName.toLowerCase())) {
      addLog(`⚠️ Attempted to add duplicate domain: ${domainName}`);
      alert('This domain is already being tracked.');
      return;
    }
    const whoisData = await getWhoisData(domainName, addLog);
    const newDomainData: NewDomain = {
      domain_name: domainName,
      tag,
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
    } else {
        addLog(`❌ Failed to add ${domainName}.`);
    }
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
    if(!domain) return;
    const newTag = domain.tag === 'mine' ? 'to-snatch' : 'mine';
    const updatedDomain = await SupabaseService.updateDomain(id, { tag: newTag });
    if(updatedDomain){
        setDomains(prevDomains => prevDomains.map(d => 
            d.id === id ? { ...d, tag: newTag } : d
        ));
        addLog(`✅ Switched tag for ${domain.domain_name} to "${newTag}".`);
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
      <p class="mb-4 text-slate-600 dark:text-slate-400">This is an estimation based on typical domain registrar policies for .com, .net, etc. Actual dates may vary.</p>
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
    setIsModalOpen(true);
    addLog(`ℹ️ Displayed drop info for ${domain.domain_name}.`);
  };
  
  return (
    <div className="min-h-screen font-sans">
      <Header session={session} notifications={notifications} clearNotifications={() => setNotifications([])} />
      
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
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg mb-8">
              <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Check Domain</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Enter a domain to check its availability and add it to your tracking list.
              </p>
              <DomainForm onAddDomain={addDomain} />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
               <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-white">Tracked Domains</h2>
              <DomainList domains={domains} onRemove={removeDomain} onShowInfo={handleShowInfo} onToggleTag={toggleDomainTag} />
            </div>
          </div>
        )}
      </main>

      {!loading && (
          <StatusLog logs={logs} />
      )}

      {!loading && session && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalContent.title}>
            <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.body }}></div>
        </Modal>
      )}
    </div>
  );
};

export default App;
