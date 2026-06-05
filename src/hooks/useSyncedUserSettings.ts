import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AutoMineRule, CategoryManualOverrides, CategoryWordGroup } from '../types';
import * as SupabaseService from '../services/supabaseService';
import {
  readStoredAutoMineRules,
  readStoredCategoryManualOverrides,
  readStoredCategoryNameOverrides,
  readStoredCategoryWordGroups,
  writeStoredAutoMineRules,
  writeStoredCategoryManualOverrides,
  writeStoredCategoryNameOverrides,
  writeStoredCategoryWordGroups,
} from '../utils/userSettingsStorage';

export const useSyncedUserSettings = (session: Session | null, addLog: (message: string) => void) => {
  const [categoryNameOverrides, setCategoryNameOverrides] = useState<Record<string, string>>(readStoredCategoryNameOverrides);
  const [categoryManualOverrides, setCategoryManualOverrides] = useState<CategoryManualOverrides>(readStoredCategoryManualOverrides);
  const [categoryWordGroups, setCategoryWordGroups] = useState<CategoryWordGroup[]>(readStoredCategoryWordGroups);
  const [autoMineRules, setAutoMineRules] = useState<AutoMineRule[]>(readStoredAutoMineRules);
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);

  const resetUserSettings = useCallback(() => {
    setCategoryNameOverrides(readStoredCategoryNameOverrides());
    setCategoryManualOverrides(readStoredCategoryManualOverrides());
    setCategoryWordGroups(readStoredCategoryWordGroups());
    setAutoMineRules(readStoredAutoMineRules());
    setUserSettingsLoaded(false);
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const fetchUserSettings = async () => {
      setUserSettingsLoaded(false);
      const settings = await SupabaseService.getUserAppSettings();
      if (cancelled) return;
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

    fetchUserSettings();
    return () => {
      cancelled = true;
    };
  }, [session, addLog]);

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

  return {
    categoryNameOverrides,
    setCategoryNameOverrides,
    categoryManualOverrides,
    setCategoryManualOverrides,
    categoryWordGroups,
    setCategoryWordGroups,
    autoMineRules,
    setAutoMineRules,
    resetUserSettings,
  };
};
