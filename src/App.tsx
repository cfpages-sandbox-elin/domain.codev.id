import React, { useState, useEffect, useCallback } from 'react';
import { Domain, DomainTag, NewDomain, DomainUpdate } from './types';
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

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });

  useEffect(() => {
    // If supabase is not configured, we can't do anything. Just stop loading.
    if (supabaseConfigError) {
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
        const currentSession = await SupabaseService.getSession();
        setSession(currentSession);
        setLoading(false);
    };

    fetchSession();

    // The 'supabase' is guaranteed to be non-null here due to the check above.
    const { data: authListener } = supabase!.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if(!session) {
          setDomains([]); // Clear data on logout
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      const fetchDomains = async () => {
        const userDomains = await SupabaseService.getDomains();
        if (userDomains) {
          setDomains(userDomains);
        }
      };
      fetchDomains();
    }
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


  const updateDomainStatus = useCallback(async (domainToUpdate: Domain) => {
      const updatedWhois = await getWhoisData(domainToUpdate.domain_name);
      
      const finalStatus = domainToUpdate.status === 'expired' && updatedWhois.status === 'available' ? 'dropped' : updatedWhois.status;

      const updatedDomainFields: DomainUpdate = {
          status: finalStatus,
          expiration_date: updatedWhois.expirationDate,
          registered_date: updatedWhois.registeredDate,
          registrar: updatedWhois.registrar,
          last_checked: new Date().toISOString(),
      };

      const updatedDomain = await SupabaseService.updateDomain(domainToUpdate.id, updatedDomainFields);

      if(updatedDomain) {
        setDomains(prevDomains => 
            prevDomains.map(d => (d.id === updatedDomain.id ? updatedDomain : d))
        );
        checkAndNotify(updatedDomain);
      }
  }, [checkAndNotify]);


  // Simulated Cron Job Effect
  useEffect(() => {
    if (!session) return;
    
    // This interval checks for notifications on existing data without API calls.
    // It runs frequently to ensure UI alerts are timely.
    const notificationInterval = setInterval(() => {
      domains.forEach(checkAndNotify);
    }, 5 * 60 * 1000); // every 5 minutes

    // This interval performs the heavy lifting of WHOIS lookups.
    // It runs less frequently to conserve API credits and avoid rate limits.
    const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
    const checkDomainsJob = () => {
        console.log("Running simulated daily check for WHOIS updates...");
        const now = new Date().getTime();
        domains.forEach(domain => {
            const lastCheckedTime = domain.last_checked ? new Date(domain.last_checked).getTime() : 0;
            // Only check if it hasn't been checked in the last 24 hours.
            if (now - lastCheckedTime > ONE_DAY_IN_MS) {
                 console.log(`Updating WHOIS for ${domain.domain_name} (last checked: ${domain.last_checked})`);
                 updateDomainStatus(domain);
            }
        });
    };
    
    // Run once on load, then set an interval to run roughly every hour.
    // The internal logic will prevent re-checking too often.
    checkDomainsJob();
    const whoisCheckInterval = setInterval(checkDomainsJob, 60 * 60 * 1000); // Check every hour

    return () => {
        clearInterval(notificationInterval);
        clearInterval(whoisCheckInterval);
    };
  }, [domains, session, checkAndNotify, updateDomainStatus]);


  const addDomain = async (domainName: string, tag: DomainTag) => {
    if (domains.some(d => d.domain_name.toLowerCase() === domainName.toLowerCase())) {
      alert('This domain is already being tracked.');
      return;
    }
    const whoisData = await getWhoisData(domainName);
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
    }
  };

  const removeDomain = async (id: number) => {
    const success = await SupabaseService.removeDomain(id);
    if(success){
        setDomains(prevDomains => prevDomains.filter(d => d.id !== id));
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

      {!loading && session && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalContent.title}>
            <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.body }}></div>
        </Modal>
      )}
    </div>
  );
};

export default App;