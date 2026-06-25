import React, { useMemo, useState } from 'react';
import { CategoryManualOverride, CategoryManualOverrides, CategoryWordGroup, Domain } from '../types';
import { DomainCategorizationResult, applyCategoryManualOverrides, applyCategoryWordGroups, categorizeDomains } from '../utils/domainCategorization';
import { splitCategoryWords } from '../utils/userSettingsStorage';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, RefreshIcon, TagIcon, TrashIcon, XCircleIcon } from './icons';
import Tooltip from './Tooltip';

interface CategoriesPageProps {
  domains: Domain[];
  categoryNameOverrides: Record<string, string>;
  categoryManualOverrides: CategoryManualOverrides;
  categoryWordGroups: CategoryWordGroup[];
  onCategoryNameOverridesChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onCategoryManualOverridesChange: React.Dispatch<React.SetStateAction<CategoryManualOverrides>>;
  onCategoryWordGroupsChange: React.Dispatch<React.SetStateAction<CategoryWordGroup[]>>;
}

const emptyCategoryOverride: CategoryManualOverride = {
  includeDomainIds: [],
  excludeDomainIds: [],
};

const hasManualOverride = (override?: CategoryManualOverride) => Boolean(
  override && (override.includeDomainIds.length > 0 || override.excludeDomainIds.length > 0),
);

const EMPTY_CATEGORIZATION: DomainCategorizationResult = {
  categories: [],
  categorizedDomains: [],
  categoryIdsByDomainId: {},
};

const CategoriesPage: React.FC<CategoriesPageProps> = ({
  domains,
  categoryNameOverrides,
  categoryManualOverrides,
  categoryWordGroups,
  onCategoryNameOverridesChange,
  onCategoryManualOverridesChange,
  onCategoryWordGroupsChange,
}) => {
  const [selectedDomainByCategoryId, setSelectedDomainByCategoryId] = useState<Record<string, string>>({});
  const [isAutoCategoriesOpen, setIsAutoCategoriesOpen] = useState(false);
  const [editingWordGroupId, setEditingWordGroupId] = useState<string | null>(null);
  const [wordGroupLabel, setWordGroupLabel] = useState('');
  const [wordGroupWords, setWordGroupWords] = useState('');
  const autoCategorization = useMemo(
    () => (isAutoCategoriesOpen ? categorizeDomains(domains) : EMPTY_CATEGORIZATION),
    [domains, isAutoCategoriesOpen],
  );
  const rawCategorization = useMemo(
    () => (isAutoCategoriesOpen
      ? applyCategoryWordGroups(autoCategorization, domains, categoryWordGroups)
      : EMPTY_CATEGORIZATION),
    [autoCategorization, categoryWordGroups, domains, isAutoCategoriesOpen],
  );
  const categorization = useMemo(
    () => (isAutoCategoriesOpen
      ? applyCategoryManualOverrides(rawCategorization, domains, categoryManualOverrides)
      : EMPTY_CATEGORIZATION),
    [categoryManualOverrides, domains, isAutoCategoriesOpen, rawCategorization],
  );
  const rawCategoryById = useMemo(
    () => new Map(rawCategorization.categories.map(category => [category.id, category])),
    [rawCategorization.categories],
  );
  const domainsById = useMemo(
    () => new Map(domains.map(domain => [domain.id, domain])),
    [domains],
  );
  const categorizedDomainById = useMemo(
    () => new Map(categorization.categorizedDomains.map(item => [item.domain.id, item])),
    [categorization.categorizedDomains],
  );
  const categoryNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const category of categorization.categories) {
      names[category.id] = (categoryNameOverrides[category.id] || category.suggestedName).trim() || category.suggestedName;
    }
    return names;
  }, [categorization.categories, categoryNameOverrides]);

  const updateManualOverride = (categoryId: string, updater: (override: CategoryManualOverride) => CategoryManualOverride) => {
    onCategoryManualOverridesChange(current => {
      const nextOverride = updater(current[categoryId] || emptyCategoryOverride);
      const next = { ...current };
      if (hasManualOverride(nextOverride)) {
        next[categoryId] = nextOverride;
      } else {
        delete next[categoryId];
      }
      return next;
    });
  };

  const removeDomainFromCategory = (categoryId: string, domainId: number, reason: string) => {
    updateManualOverride(categoryId, override => ({
      includeDomainIds: override.includeDomainIds.filter(id => id !== domainId),
      excludeDomainIds: reason === 'manual'
        ? override.excludeDomainIds.filter(id => id !== domainId)
        : Array.from(new Set([...override.excludeDomainIds, domainId])).sort((a, b) => a - b),
    }));
  };

  const addDomainToCategory = (categoryId: string, domainId: number) => {
    const rawCategory = rawCategoryById.get(categoryId);
    const isAutoMember = rawCategory?.members.some(member => member.domainId === domainId);
    updateManualOverride(categoryId, override => ({
      includeDomainIds: isAutoMember
        ? override.includeDomainIds.filter(id => id !== domainId)
        : Array.from(new Set([...override.includeDomainIds, domainId])).sort((a, b) => a - b),
      excludeDomainIds: override.excludeDomainIds.filter(id => id !== domainId),
    }));
    setSelectedDomainByCategoryId(current => ({ ...current, [categoryId]: '' }));
  };

  const resetCategoryMembership = (categoryId: string) => {
    onCategoryManualOverridesChange(current => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
    setSelectedDomainByCategoryId(current => ({ ...current, [categoryId]: '' }));
  };

  const resetWordGroupForm = () => {
    setEditingWordGroupId(null);
    setWordGroupLabel('');
    setWordGroupWords('');
  };

  const submitWordGroup = () => {
    const words = splitCategoryWords(wordGroupWords);
    if (words.length < 2) {
      alert('Add at least two words, for example: steel, besi, baja.');
      return;
    }

    const nextSignature = words.slice().sort().join(',');
    const duplicate = categoryWordGroups.some(group => {
      const existing = group.words.slice().sort().join(',');
      return group.id !== editingWordGroupId && existing === nextSignature;
    });
    if (duplicate) {
      alert('This category word group already exists.');
      return;
    }

    const label = wordGroupLabel.trim() || words.join(' ');
    if (editingWordGroupId) {
      onCategoryWordGroupsChange(current => current.map(group => (
        group.id === editingWordGroupId ? { ...group, label, words } : group
      )));
    } else {
      onCategoryWordGroupsChange(current => [
        {
          id: crypto.randomUUID(),
          label,
          words,
          enabled: true,
        },
        ...current,
      ]);
    }
    resetWordGroupForm();
  };

  const handleWordGroupFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWordGroup();
  };

  const editWordGroup = (group: CategoryWordGroup) => {
    setEditingWordGroupId(group.id);
    setWordGroupLabel(group.label);
    setWordGroupWords(group.words.join(', '));
    window.setTimeout(() => {
      document.getElementById('category-word-group-label')?.focus();
    }, 0);
  };

  const toggleWordGroup = (id: string) => {
    onCategoryWordGroupsChange(current => current.map(group => (
      group.id === id ? { ...group, enabled: !group.enabled } : group
    )));
  };

  const removeWordGroup = (id: string) => {
    const categoryId = `word-group:${id}`;
    onCategoryWordGroupsChange(current => current.filter(group => group.id !== id));
    if (editingWordGroupId === id) {
      resetWordGroupForm();
    }
    onCategoryNameOverridesChange(current => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
    onCategoryManualOverridesChange(current => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
  };

  const categoryGroups = useMemo(() => {
    if (!isAutoCategoriesOpen) return [];

    return categorization.categories.map(category => {
    const domainsInCategory = category.members
      .map(member => {
        const domain = domainsById.get(member.domainId);
        return domain ? { domain, member } : null;
      })
      .filter((item): item is { domain: Domain; member: typeof category.members[number] } => Boolean(item))
      .sort((a, b) => a.domain.domain_name.localeCompare(b.domain.domain_name));
    const overlapCategoryIds = new Set<string>();
    for (const { domain } of domainsInCategory) {
      const meta = categorizedDomainById.get(domain.id);
      for (const categoryId of meta?.categoryIds || []) {
        if (categoryId !== category.id) overlapCategoryIds.add(categoryId);
      }
    }

    return {
      category,
      label: categoryNames[category.id] || category.suggestedName,
      domains: domainsInCategory,
      overlapLabels: Array.from(overlapCategoryIds).map(categoryId => categoryNames[categoryId] || categoryId),
      override: categoryManualOverrides[category.id],
    };
  }).sort((a, b) => b.overlapLabels.length - a.overlapLabels.length || a.label.localeCompare(b.label));
  }, [categorizedDomainById, categorization.categories, categoryManualOverrides, categoryNames, domainsById, isAutoCategoriesOpen]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-3 sm:mb-6">
        <span className="rounded-lg bg-slate-200 p-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:p-2">
          <TagIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">Categories</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage word groups for {domains.length} domains. Auto categories stay collapsed until opened.
          </p>
        </div>
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-6 sm:p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Word groups</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Group different words into one category. Example: words `steel`, `besi`, and `baja` can create one category named `besi baja steel`.
          </p>
        </div>

        <form className="grid gap-2 sm:gap-3 md:grid-cols-[1fr_1.5fr_auto]" onSubmit={handleWordGroupFormSubmit}>
          <input
            id="category-word-group-label"
            value={wordGroupLabel}
            onChange={(event) => setWordGroupLabel(event.target.value)}
            placeholder="Category name, e.g. besi baja steel"
            className="rounded-lg border-2 border-slate-200 bg-slate-100 px-3 py-2 text-sm focus:border-brand-blue focus:ring-0 dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            value={wordGroupWords}
            onChange={(event) => setWordGroupWords(event.target.value)}
            placeholder="steel, besi, baja"
            className="rounded-lg border-2 border-slate-200 bg-slate-100 px-3 py-2 text-sm focus:border-brand-blue focus:ring-0 dark:border-slate-700 dark:bg-slate-800"
          />
          <Tooltip content={editingWordGroupId ? 'Save changes to this word group.' : 'Create an auto category from the listed words.'}>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
            >
              {editingWordGroupId ? <PencilIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {editingWordGroupId ? 'Edit' : 'Add'}
            </button>
          </Tooltip>
        </form>
        {editingWordGroupId && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={resetWordGroupForm}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <XCircleIcon className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          </div>
        )}

        {categoryWordGroups.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
            {categoryWordGroups.map(group => (
              <span key={group.id} className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:gap-2 sm:px-3 ${group.enabled ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                <button
                  type="button"
                  onClick={() => toggleWordGroup(group.id)}
                  className="font-semibold"
                  aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.label}`}
                >
                  {group.enabled ? group.label : `${group.label} off`}
                </button>
                <span className="break-all font-mono text-[10px] opacity-80">{group.words.join(' + ')}</span>
                <Tooltip content="Edit this word group">
                  <button
                    type="button"
                    onClick={() => editWordGroup(group)}
                    className="text-slate-400 transition-colors hover:text-brand-blue dark:text-slate-500 dark:hover:text-blue-300"
                    aria-label={`Edit ${group.label}`}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
                <Tooltip content="Remove this word group">
                  <button
                    type="button"
                    onClick={() => removeWordGroup(group.id)}
                    className="text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500 dark:hover:text-red-300"
                    aria-label={`Remove ${group.label}`}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setIsAutoCategoriesOpen(current => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
          aria-expanded={isAutoCategoriesOpen}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Auto categories</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {isAutoCategoriesOpen
                ? `${categoryGroups.length} auto category group${categoryGroups.length === 1 ? '' : 's'} loaded from ${domains.length} domains.`
                : 'Collapsed by default to keep this page light.'}
            </span>
          </span>
          <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            {isAutoCategoriesOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </span>
        </button>

        {isAutoCategoriesOpen && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-700 sm:p-4">
            {categoryGroups.length === 0 ? (
              <div className="p-6 text-center">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">No categories yet</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add related domains and the auto categorizer will group them here.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                {categoryGroups.map(({ category, label, domains: categoryDomains, overlapLabels, override }) => {
            const selectedDomainId = Number(selectedDomainByCategoryId[category.id] || 0);
            const categoryDomainIds = new Set(categoryDomains.map(({ domain }) => domain.id));
            const addableDomains = domains
              .filter(domain => !categoryDomainIds.has(domain.id))
              .sort((a, b) => a.domain_name.localeCompare(b.domain_name));

            return (
            <section key={category.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={label}
                  onChange={(event) => onCategoryNameOverridesChange(current => ({ ...current, [category.id]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  aria-label={`Rename category ${category.suggestedName}`}
                />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {categoryDomains.length}
                </span>
                {hasManualOverride(override) && (
                  <Tooltip content="Reset manual category membership changes for this category. The editable category name is kept.">
                    <button
                      type="button"
                      onClick={() => resetCategoryMembership(category.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-label={`Reset ${label} category membership`}
                    >
                      <RefreshIcon className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </div>

              {overlapLabels.length > 0 && (
                <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  overlaps {overlapLabels.slice(0, 4).join(' + ')}
                  {overlapLabels.length > 4 ? ` +${overlapLabels.length - 4}` : ''}
                </p>
              )}

              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select
                  value={selectedDomainByCategoryId[category.id] || ''}
                  onChange={(event) => setSelectedDomainByCategoryId(current => ({ ...current, [category.id]: event.target.value }))}
                  disabled={addableDomains.length === 0}
                  className="min-w-0 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="">Add domain to category...</option>
                  {addableDomains.map(domain => (
                    <option key={domain.id} value={domain.id}>{domain.domain_name}</option>
                  ))}
                </select>
                <Tooltip content="Manually include the selected domain in this category.">
                  <button
                    type="button"
                    onClick={() => selectedDomainId > 0 && addDomainToCategory(category.id, selectedDomainId)}
                    disabled={selectedDomainId <= 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-blue text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Add selected domain to ${label}`}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categoryDomains.slice(0, 30).map(({ domain, member }) => (
                  <span key={domain.id} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${member.reason === 'manual' || member.reason === 'word-group' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    <span className="min-w-0 break-all">{domain.domain_name}</span>
                    <Tooltip content={member.reason === 'manual' ? 'Remove this manual include.' : 'Exclude this domain from this category.'}>
                      <button
                        type="button"
                        onClick={() => removeDomainFromCategory(category.id, domain.id, member.reason)}
                        className="rounded-full text-slate-400 transition-colors hover:text-red-600 dark:text-slate-500 dark:hover:text-red-300"
                        aria-label={`Remove ${domain.domain_name} from ${label}`}
                      >
                        <XCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </span>
                ))}
                {categoryDomains.length > 30 && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    +{categoryDomains.length - 30}
                  </span>
                )}
              </div>
            </section>
            );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default CategoriesPage;
