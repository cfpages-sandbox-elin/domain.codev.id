import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Domain, DomainTag, WhoisData } from './types';
import { supabase, supabaseConfigError } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import * as SupabaseService from './services/supabaseService';

import Header from './components/Header';
import Modal from './components/Modal';
import Auth from './components/Auth';
import Spinner from './components/Spinner';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import StatusLog from './components/StatusLog';
import Tooltip from './components/Tooltip';
import { CheckCircleIcon, ExclamationTriangleIcon, PlusIcon } from './components/icons';
import DashboardView from './components/app/DashboardView';
import { useDomainActions } from './hooks/useDomainActions';
import { useStatusLog } from './hooks/useStatusLog';
import { useSyncedUserSettings } from './hooks/useSyncedUserSettings';
import { useWhoisProviders } from './hooks/useWhoisProviders';
import {
  buildDomainExport,
  buildDropTimelineHtml,
  getDomainNotificationMessage,
} from './utils/appDomainLogic';

const DocsPage = React.lazy(() => import('./components/DocsPage'));
const BulkAddModal = React.lazy(() => import('./components/BulkAddModal'));
const IntegrationSettingsModal = React.lazy(() => import('./components/IntegrationSettingsModal'));
const CategoriesPage = React.lazy(() => import('./components/CategoriesPage'));
const SettingsView = React.lazy(() => import('./components/app/SettingsView'));

type View = 'dashboard' | 'docs' | 'categories' | 'settings';
type SettingsTab = 'whois' | 'auto-mine';

type BulkDomain = { domainName: string; tag?: DomainTag };
type DomainEntryTab = 'single' | 'bulk';
type Toast = { id: number; kind: 'success' | 'warning'; title: string; body: string };

const LazyChunkFallback = () => (
  <div className="flex min-h-[16rem] items-center justify-center">
    <Spinner size="lg" color="border-brand-blue" />
  </div>
);

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isDomainEntryModalOpen, setIsDomainEntryModalOpen] = useState(false);
  const [isIntegrationSettingsOpen, setIsIntegrationSettingsOpen] = useState(false);
  const [domainEntryInitialTab, setDomainEntryInitialTab] = useState<DomainEntryTab>('single');
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { logs, addLog } = useStatusLog();
  const [view, setView] = useState<View>('dashboard');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('whois');
  const {
    categoryNameOverrides,
    setCategoryNameOverrides,
    categoryManualOverrides,
    setCategoryManualOverrides,
    categoryWordGroups,
    setCategoryWordGroups,
    autoMineRules,
    setAutoMineRules,
    resetUserSettings,
  } = useSyncedUserSettings(session, addLog);
  const {
    whoisProviders,
    isWhoisProviderLoading,
    refreshWhoisProviders,
    updateProviderFromWhoisData,
    handleSaveWhoisProviderCredential,
    handleRemoveWhoisProviderCredential,
  } = useWhoisProviders(addLog);

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
          resetUserSettings();
          addLog('ℹ️ User signed out.');
        } else {
          addLog('ℹ️ Auth state changed, user is signed in.');
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, [addLog, resetUserSettings]);

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

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(current => [{ id, ...toast }, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== id));
    }, 4200);
  }, []);

  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [message, ...prev.filter(m => m !== message)]);
  }, []);
  
  const checkAndNotify = useCallback((domain: Domain) => {
    const message = getDomainNotificationMessage(domain);
    if (message) addNotification(message);
  }, [addNotification]);
  const handleWhoisCheckFinished = useCallback((domain: Domain, whoisData: WhoisData) => {
    const isFailed = whoisData.status === 'unknown' || domain.status === 'unknown';
    addToast({
      kind: isFailed ? 'warning' : 'success',
      title: isFailed ? 'WHOIS check needs retry' : 'WHOIS check finished',
      body: isFailed
        ? `${domain.domain_name} was added, but WHOIS status is still unknown.`
        : `${domain.domain_name} is ${domain.status}.`,
    });
  }, [addToast]);
  const {
    domains,
    isDomainListLoading,
    isBulkProcessing,
    whoisDetailsByDomainId,
    autoRepairingDomainIds,
    pendingDomainIds,
    addDomain,
    bulkAddDomains,
    removeDomain,
    toggleDomainTag,
    setDomainTag,
    markDomainsAsMine,
    recheckDomain,
  } = useDomainActions({
    session,
    view,
    addLog,
    checkAndNotify,
    updateProviderFromWhoisData,
    onWhoisCheckFinished: handleWhoisCheckFinished,
  });

  useEffect(() => {
    if (session) {
      void refreshWhoisProviders();
    }
  }, [session, refreshWhoisProviders]);

  useEffect(() => {
    if (session && domains.length > 0) {
      addLog(`ℹ️ Checking for notifications across ${domains.length} domains.`);
      domains.forEach(checkAndNotify);
    }
  }, [domains, session, addLog, checkAndNotify]);

  const handleBulkAdd = async (bulkDomains: BulkDomain[], defaultTag: DomainTag) => {
    return bulkAddDomains(bulkDomains, defaultTag);
  };

  const handleAddDomainFromModal = (domainName: string, tag: DomainTag) => {
    return addDomain(domainName, tag, { optimistic: true });
  };

  const handleShowInfo = useCallback((domain: Domain) => {
    if (!domain.expiration_date) return;

    setModalContent({
      title: `Estimated Drop Timeline for ${domain.domain_name}`,
      body: buildDropTimelineHtml(domain.expiration_date),
    });
    setIsInfoModalOpen(true);
    addLog(`ℹ️ Displayed drop info for ${domain.domain_name}.`);
  }, [addLog]);

  const handleExport = (format: 'json' | 'csv') => {
    const { content, mimeType, filename } = buildDomainExport(domains, format);
    addLog(`✅ Exporting data as ${format.toUpperCase()}...`);

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
        return (
          <SettingsView
            domains={domains}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            whoisProviders={whoisProviders}
            isWhoisProviderLoading={isWhoisProviderLoading}
            autoMineRules={autoMineRules}
            onRefreshWhoisProviders={refreshWhoisProviders}
            onSaveWhoisProviderCredential={handleSaveWhoisProviderCredential}
            onRemoveWhoisProviderCredential={handleRemoveWhoisProviderCredential}
            onAutoMineRulesChange={setAutoMineRules}
            onApplyAutoMineMatches={markDomainsAsMine}
            addLog={addLog}
          />
        );
      case 'dashboard':
      default:
        return (
          <DashboardView
            domains={domains}
            isDomainListLoading={isDomainListLoading}
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
            isBulkProcessing={isBulkProcessing}
          />
        );
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
          <Suspense fallback={<LazyChunkFallback />}>
            {renderCurrentView()}
          </Suspense>
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
      {toasts.length > 0 && (
        <div className="fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
          {toasts.map(toast => {
            const Icon = toast.kind === 'warning' ? ExclamationTriangleIcon : CheckCircleIcon;
            return (
              <div
                key={toast.id}
                className={`rounded-lg border px-4 py-3 shadow-xl backdrop-blur ${
                  toast.kind === 'warning'
                    ? 'border-amber-300 bg-amber-50/95 text-amber-950 dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-100'
                    : 'border-green-300 bg-green-50/95 text-green-950 dark:border-green-700 dark:bg-green-950/95 dark:text-green-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 flex-none" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{toast.title}</p>
                    <p className="mt-0.5 text-sm opacity-90">{toast.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && session && (
        <>
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title={modalContent.title}>
                <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.body }}></div>
            </Modal>
            <Suspense fallback={null}>
              {isDomainEntryModalOpen && (
                <BulkAddModal
                    isOpen
                    onClose={() => setIsDomainEntryModalOpen(false)}
                    initialTab={domainEntryInitialTab}
                    existingDomains={domains}
                    onAddDomain={handleAddDomainFromModal}
                    onBulkAdd={handleBulkAdd}
                    isLoading={isBulkProcessing}
                    addLog={addLog}
                />
              )}
              {isIntegrationSettingsOpen && (
                <IntegrationSettingsModal
                    isOpen
                    onClose={() => setIsIntegrationSettingsOpen(false)}
                    addLog={addLog}
                />
              )}
            </Suspense>
        </>
      )}
    </div>
  );
};

export default App;
