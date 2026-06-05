import { AutoMineRule, CategoryManualOverrides, CategoryWordGroup } from '../types';

export const CATEGORY_NAMES_STORAGE_KEY = 'domain-codev-category-names';
export const CATEGORY_MANUAL_OVERRIDES_STORAGE_KEY = 'domain-codev-category-manual-overrides';
export const CATEGORY_WORD_GROUPS_STORAGE_KEY = 'domain-codev-category-word-groups';
export const AUTO_MINE_RULES_STORAGE_KEY = 'domain-codev-auto-mine-rules';

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const normalizeNameServer = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .replace(/\.$/, '');

export const splitNameServers = (value: string) => value
  .split(/[\s,;]+/)
  .map(normalizeNameServer)
  .filter(Boolean);

export const normalizeCategoryWord = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const splitCategoryWords = (value: string) => value
  .split(/[\s,;]+/)
  .map(normalizeCategoryWord)
  .filter(word => word.length >= 3);

export const sanitizeCategoryNameOverrides = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, label]) => (key.startsWith('category:') || key.startsWith('word-group:')) && typeof label === 'string')
    .map(([key, label]) => [key, String(label).trim()])
    .filter(([, label]) => label);
  return Object.fromEntries(entries);
};

export const sanitizeAutoMineRules = (value: unknown): AutoMineRule[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const nameServers = Array.isArray(record.nameServers)
        ? Array.from(new Set<string>(record.nameServers.map(String).map(normalizeNameServer).filter(Boolean)))
        : [];

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createId(),
        label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : 'Name server rule',
        nameServers,
        enabled: record.enabled !== false,
      };
    })
    .filter(rule => rule.nameServers.length >= 2);
};

const sanitizeDomainIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item > 0),
  )).sort((a, b) => a - b);
};

export const sanitizeCategoryManualOverrides = (value: unknown): CategoryManualOverrides => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const overrides: CategoryManualOverrides = {};

  for (const [categoryId, rawOverride] of Object.entries(value as Record<string, unknown>)) {
    if (!categoryId.startsWith('category:') && !categoryId.startsWith('word-group:')) continue;
    const record = rawOverride && typeof rawOverride === 'object' && !Array.isArray(rawOverride)
      ? rawOverride as Record<string, unknown>
      : {};
    const includeDomainIds = sanitizeDomainIds(record.includeDomainIds);
    const excludeDomainIds = sanitizeDomainIds(record.excludeDomainIds);
    const excludeSet = new Set(excludeDomainIds);
    const cleanedIncludeIds = includeDomainIds.filter(id => !excludeSet.has(id));
    if (cleanedIncludeIds.length === 0 && excludeDomainIds.length === 0) continue;
    overrides[categoryId] = {
      includeDomainIds: cleanedIncludeIds,
      excludeDomainIds,
    };
  }

  return overrides;
};

export const sanitizeCategoryWordGroups = (value: unknown): CategoryWordGroup[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const words = Array.isArray(record.words)
        ? Array.from(new Set(record.words.map(String).map(normalizeCategoryWord).filter(word => word.length >= 3)))
        : [];
      const label = typeof record.label === 'string' && record.label.trim()
        ? record.label.trim()
        : words.join(' ');

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createId(),
        label: label || 'Word group',
        words,
        enabled: record.enabled !== false,
      };
    })
    .filter(group => group.words.length >= 2);
};

export const readStoredCategoryNameOverrides = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    return sanitizeCategoryNameOverrides(JSON.parse(window.localStorage.getItem(CATEGORY_NAMES_STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
};

export const writeStoredCategoryNameOverrides = (overrides: Record<string, string>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CATEGORY_NAMES_STORAGE_KEY, JSON.stringify(sanitizeCategoryNameOverrides(overrides)));
};

export const readStoredCategoryManualOverrides = (): CategoryManualOverrides => {
  if (typeof window === 'undefined') return {};
  try {
    return sanitizeCategoryManualOverrides(JSON.parse(window.localStorage.getItem(CATEGORY_MANUAL_OVERRIDES_STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
};

export const writeStoredCategoryManualOverrides = (overrides: CategoryManualOverrides) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CATEGORY_MANUAL_OVERRIDES_STORAGE_KEY, JSON.stringify(sanitizeCategoryManualOverrides(overrides)));
};

export const readStoredCategoryWordGroups = (): CategoryWordGroup[] => {
  if (typeof window === 'undefined') return [];
  try {
    return sanitizeCategoryWordGroups(JSON.parse(window.localStorage.getItem(CATEGORY_WORD_GROUPS_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
};

export const writeStoredCategoryWordGroups = (groups: CategoryWordGroup[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CATEGORY_WORD_GROUPS_STORAGE_KEY, JSON.stringify(sanitizeCategoryWordGroups(groups)));
};

export const readStoredAutoMineRules = (): AutoMineRule[] => {
  if (typeof window === 'undefined') return [];
  try {
    return sanitizeAutoMineRules(JSON.parse(window.localStorage.getItem(AUTO_MINE_RULES_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
};

export const writeStoredAutoMineRules = (rules: AutoMineRule[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTO_MINE_RULES_STORAGE_KEY, JSON.stringify(sanitizeAutoMineRules(rules)));
};
