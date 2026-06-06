import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AutoMineRule, CategoryManualOverrides, CategoryWordGroup, UserAppSettings } from '../types';
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
  const pendingSettingsSaveRef = useRef<Partial<{
    categoryNameOverrides: Record<string, string>;
    categoryManualOverrides: CategoryManualOverrides;
    categoryWordGroups: CategoryWordGroup[];
    autoMineRules: AutoMineRule[];
  }>>({});
  const lastSyncedSettingsJsonRef = useRef<Partial<Record<keyof UserAppSettings, string>>>({});
  const settingsSaveTimerRef = useRef<number | null>(null);

  const scheduleSettingsSave = useCallback((updates: Partial<UserAppSettings>) => {
    if (!session || !userSettingsLoaded) return;
    const changedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => {
        const settingsKey = key as keyof UserAppSettings;
        const serialized = JSON.stringify(value);
        if (lastSyncedSettingsJsonRef.current[settingsKey] === serialized) return false;
        lastSyncedSettingsJsonRef.current[settingsKey] = serialized;
        return true;
      }),
    ) as Partial<UserAppSettings>;
    if (Object.keys(changedUpdates).length === 0) return;
    pendingSettingsSaveRef.current = {
      ...pendingSettingsSaveRef.current,
      ...changedUpdates,
    };
    if (settingsSaveTimerRef.current !== null) {
      window.clearTimeout(settingsSaveTimerRef.current);
    }
    settingsSaveTimerRef.current = window.setTimeout(() => {
      const payload = pendingSettingsSaveRef.current;
      pendingSettingsSaveRef.current = {};
      settingsSaveTimerRef.current = null;
      void SupabaseService.saveUserAppSettings(payload);
    }, 900);
  }, [session, userSettingsLoaded]);

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
        lastSyncedSettingsJsonRef.current = {
          categoryNameOverrides: JSON.stringify(settings.categoryNameOverrides),
          categoryManualOverrides: JSON.stringify(settings.categoryManualOverrides),
          categoryWordGroups: JSON.stringify(settings.categoryWordGroups),
          autoMineRules: JSON.stringify(settings.autoMineRules),
        };
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
    scheduleSettingsSave({ categoryNameOverrides });
  }, [categoryNameOverrides, scheduleSettingsSave]);

  useEffect(() => {
    writeStoredCategoryManualOverrides(categoryManualOverrides);
    scheduleSettingsSave({ categoryManualOverrides });
  }, [categoryManualOverrides, scheduleSettingsSave]);

  useEffect(() => {
    writeStoredCategoryWordGroups(categoryWordGroups);
    scheduleSettingsSave({ categoryWordGroups });
  }, [categoryWordGroups, scheduleSettingsSave]);

  useEffect(() => {
    writeStoredAutoMineRules(autoMineRules);
    scheduleSettingsSave({ autoMineRules });
  }, [autoMineRules, scheduleSettingsSave]);

  useEffect(() => {
    return () => {
      if (settingsSaveTimerRef.current !== null) {
        window.clearTimeout(settingsSaveTimerRef.current);
      }
      const pending = pendingSettingsSaveRef.current;
      if (Object.keys(pending).length > 0) {
        void SupabaseService.saveUserAppSettings(pending);
      }
    };
  }, []);

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
