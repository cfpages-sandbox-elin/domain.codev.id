import { useCallback, useState } from 'react';
import { WhoisData, WhoisProviderStatus } from '../types';
import { getWhoisProviderStatuses } from '../services/whoisService';
import { removeWhoisProviderCredential, saveWhoisProviderCredential } from '../services/supabaseService';

export const useWhoisProviders = (addLog: (message: string) => void) => {
  const [whoisProviders, setWhoisProviders] = useState<WhoisProviderStatus[]>([]);
  const [isWhoisProviderLoading, setIsWhoisProviderLoading] = useState(false);

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

  return {
    whoisProviders,
    isWhoisProviderLoading,
    refreshWhoisProviders,
    updateProviderFromWhoisData,
    handleSaveWhoisProviderCredential,
    handleRemoveWhoisProviderCredential,
  };
};
