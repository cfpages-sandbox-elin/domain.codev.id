import { useCallback, useState } from 'react';
import type { SerpProviderStatus } from '../types';
import { getSerpProviderStatuses } from '../services/rankService';
import { removeSerpProviderCredential, saveSerpProviderCredential } from '../services/supabaseService';

export const useSerpProviders = (addLog: (message: string) => void) => {
  const [serpProviders, setSerpProviders] = useState<SerpProviderStatus[]>([]);
  const [isSerpProviderLoading, setIsSerpProviderLoading] = useState(false);

  const refreshSerpProviders = useCallback(async () => {
    setIsSerpProviderLoading(true);
    try {
      const statuses = await getSerpProviderStatuses();
      if (statuses) {
        setSerpProviders(statuses);
        addLog(`✅ Loaded ${statuses.length} SERP providers.`);
      } else {
        addLog('⚠️ Could not load SERP provider statuses.');
      }
    } finally {
      setIsSerpProviderLoading(false);
    }
  }, [addLog]);

  const handleSaveSerpProviderCredential = useCallback(async (providerId: string, apiKey: string) => {
    const saved = await saveSerpProviderCredential({
      providerId: providerId as SerpProviderStatus['id'],
      apiKey,
    });
    if (saved) {
      addLog(`✅ Saved SERP key for ${providerId}.`);
      await refreshSerpProviders();
    }
    return saved;
  }, [addLog, refreshSerpProviders]);

  const handleRemoveSerpProviderCredential = useCallback(async (providerId: string) => {
    const removed = await removeSerpProviderCredential(providerId);
    if (removed) {
      addLog(`✅ Removed SERP key for ${providerId}.`);
      await refreshSerpProviders();
    }
    return removed;
  }, [addLog, refreshSerpProviders]);

  return {
    serpProviders,
    isSerpProviderLoading,
    refreshSerpProviders,
    handleSaveSerpProviderCredential,
    handleRemoveSerpProviderCredential,
  };
};
