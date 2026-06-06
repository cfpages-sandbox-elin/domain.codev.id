import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
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
import { splitCategoryWords } from './utils/userSettingsStorage';

type View = 'dashboard' | 'docs' | 'categories' | 'settings';
type SettingsTab = 'whois' | 'auto-mine';

type BulkDomain = { domainName: string; tag?: DomainTag };
type DomainEntryTab = 'single' | 'bulk';
type Toast = { id: number; kind: 'success' | 'warning'; title: string; body: string };

const loadDocsPage = () => import('./components/DocsPage');
const loadBulkAddModal = () => import('./components/BulkAddModal');
const loadIntegrationSettingsModal = () => import('./components/IntegrationSettingsModal');
const loadCategoriesPage = () => import('./components/CategoriesPage');
const loadSettingsView = () => import('./components/app/SettingsView');

const loadedViewChunks = new Set<View>(['dashboard']);
const viewChunkModules = new Map<View, unknown>();
const viewChunkPromises = new Map<View, Promise<unknown>>();

const trackViewChunk = <TModule extends { default: React.ComponentType<any> }>(
  view: Exclude<View, 'dashboard'>,
  loader: () => Promise<TModule>,
): Promise<TModule> => {
  const loadedModule = viewChunkModules.get(view);
  if (loadedModule) return Promise.resolve(loadedModule as TModule);
  const existing = viewChunkPromises.get(view);
  if (existing) return existing as Promise<TModule>;
  const promise = loader().then(module => {
    viewChunkModules.set(view, module);
    loadedViewChunks.add(view);
    return module;
  }).catch(error => {
    viewChunkPromises.delete(view);
    loadedViewChunks.delete(view);
    viewChunkModules.delete(view);
    throw error;
  });
  viewChunkPromises.set(view, promise);
  return promise;
};

const DocsPage = React.lazy(() => trackViewChunk('docs', loadDocsPage));
const BulkAddModal = React.lazy(loadBulkAddModal);
const IntegrationSettingsModal = React.lazy(loadIntegrationSettingsModal);
const CategoriesPage = React.lazy(() => trackViewChunk('categories', loadCategoriesPage));
const SettingsView = React.lazy(() => trackViewChunk('settings', loadSettingsView));

const LazyChunkFallback = () => (
  <div className="flex min-h-[16rem] items-center justify-center">
    <Spinner size="lg" color="border-brand-blue" />
  </div>
);

const getViewLabel = (view: View) => {
  switch (view) {
    case 'docs':
      return 'Documentation';
    case 'categories':
      return 'Categories';
    case 'settings':
      return 'Settings';
    case 'dashboard':
    default:
      return 'Dashboard';
  }
};

const preloadViewChunk = (view: View) => {
  switch (view) {
    case 'docs':
      void trackViewChunk('docs', loadDocsPage);
      break;
    case 'categories':
      void trackViewChunk('categories', loadCategoriesPage);
      break;
    case 'settings':
      void trackViewChunk('settings', loadSettingsView);
      break;
    case 'dashboard':
    default:
      break;
  }
};

const ViewTransitionFallback = ({ view }: { view: View }) => (
  <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center">
    <Spinner size="lg" color="border-brand-blue" />
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Loading {getViewLabel(view)}...</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Preparing the page without blocking navigation.</p>
    </div>
  </div>
);

const DomainEntryModalFallback = ({ onClose }: { onClose: () => void }) => (
  <Modal isOpen onClose={onClose} title="Add Domains">
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
      <Spinner size="lg" color="border-brand-blue" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading add domain form...</p>
    </div>
  </Modal>
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
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('whois');
  const viewChangeTokenRef = useRef(0);
  const openDomainEntryModal = useCallback((tab: DomainEntryTab) => {
    void loadBulkAddModal();
    setDomainEntryInitialTab(tab);
    setIsDomainEntryModalOpen(true);
  }, []);
  const requestViewChange = useCallback((nextView: View) => {
    preloadViewChunk(nextView);
    if (nextView === view) {
      setPendingView(null);
      return;
    }

    const shouldYieldBeforeMount = nextView === 'dashboard';
    if (loadedViewChunks.has(nextView) && !shouldYieldBeforeMount) {
      viewChangeTokenRef.current += 1;
      setPendingView(null);
      setView(nextView);
      return;
    }

    const token = viewChangeTokenRef.current + 1;
    viewChangeTokenRef.current = token;
    setPendingView(nextView);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (viewChangeTokenRef.current !== token) return;
        setView(nextView);
        setPendingView(null);
      });
    });
  }, [view]);
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
                openDomainEntryModal('single');
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [openDomainEntryModal, session]);

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
    tagUpdatingDomainIds,
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
    if (!session || loading) return;

    const prefetch = () => {
      void loadBulkAddModal();
      void loadCategoriesPage();
      void loadSettingsView();
      void loadDocsPage();
      void loadIntegrationSettingsModal();
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(prefetch, 700);
    return () => window.clearTimeout(timeoutId);
  }, [loading, session]);

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

  const handleRemoveDomainCategory = useCallback((domainId: number, categoryId: string) => {
    setCategoryManualOverrides(current => {
      const currentOverride = current[categoryId] || { includeDomainIds: [], excludeDomainIds: [] };
      return {
        ...current,
        [categoryId]: {
          includeDomainIds: currentOverride.includeDomainIds.filter(id => id !== domainId),
          excludeDomainIds: Array.from(new Set([...currentOverride.excludeDomainIds, domainId])).sort((a, b) => a - b),
        },
      };
    });
  }, [setCategoryManualOverrides]);

  const handleCreateWordGroupCategory = useCallback((domain: Domain, suggestedWords: string[]) => {
    const rawWords = window.prompt(
      `Create a word-group category for ${domain.domain_name}. Enter at least two words separated by commas.`,
      suggestedWords.join(', '),
    );
    if (rawWords === null) return;

    const words = splitCategoryWords(rawWords);
    if (words.length < 2) {
      alert('Add at least two words, for example: haji, umroh.');
      return;
    }

    const signature = words.slice().sort().join(',');
    const duplicate = categoryWordGroups.some(group => group.words.slice().sort().join(',') === signature);
    if (duplicate) {
      alert('This word-group category already exists.');
      return;
    }

    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `word-group-${Date.now()}`;
    setCategoryWordGroups(current => [
      {
        id,
        label: words.join(' '),
        words,
        enabled: true,
      },
      ...current,
    ]);
  }, [categoryWordGroups, setCategoryWordGroups]);

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
            tagUpdatingDomainIds={tagUpdatingDomainIds}
            onRemoveDomainCategory={handleRemoveDomainCategory}
            onCreateWordGroupCategory={handleCreateWordGroupCategory}
            onExportRequest={handleExport}
            onImportRequest={() => openDomainEntryModal('bulk')}
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
        setView={requestViewChange}
        onViewIntent={preloadViewChunk}
        onOpenIntegrations={() => {
          void loadIntegrationSettingsModal();
          setIsIntegrationSettingsOpen(true);
        }}
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
        ) : pendingView ? (
          <ViewTransitionFallback view={pendingView} />
        ) : (
          <Suspense fallback={<LazyChunkFallback />}>
            {renderCurrentView()}
          </Suspense>
        )}
      </main>

      {!loading && session && (
        <Tooltip content="Add new domain. Shortcut: Ctrl + N; fallback: Alt + N if the browser captures Ctrl + N." className="fixed bottom-8 right-8 z-40" placement="top">
          <button
            onMouseEnter={() => void loadBulkAddModal()}
            onFocus={() => void loadBulkAddModal()}
            onClick={() => openDomainEntryModal('single')}
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
            {isDomainEntryModalOpen && (
              <Suspense fallback={<DomainEntryModalFallback onClose={() => setIsDomainEntryModalOpen(false)} />}>
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
              </Suspense>
            )}
            <Suspense fallback={null}>
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
