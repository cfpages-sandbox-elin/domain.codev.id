import React, { useEffect, useMemo, useState } from 'react';
import { Domain } from '../types';
import { categorizeDomains } from '../utils/domainCategorization';
import { TagIcon } from './icons';

interface CategoriesPageProps {
  domains: Domain[];
}

const CATEGORY_NAMES_STORAGE_KEY = 'domain-codev-category-names';

const readStoredCategoryNames = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(CATEGORY_NAMES_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const CategoriesPage: React.FC<CategoriesPageProps> = ({ domains }) => {
  const [categoryNameOverrides, setCategoryNameOverrides] = useState<Record<string, string>>(readStoredCategoryNames);
  const categorization = useMemo(() => categorizeDomains(domains), [domains]);
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

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_NAMES_STORAGE_KEY, JSON.stringify(categoryNameOverrides));
  }, [categoryNameOverrides]);

  const categoryGroups = useMemo(() => categorization.categories.map(category => {
    const domainsInCategory = category.members
      .map(member => domains.find(domain => domain.id === member.domainId))
      .filter((domain): domain is Domain => Boolean(domain))
      .sort((a, b) => a.domain_name.localeCompare(b.domain_name));
    const overlapCategoryIds = new Set<string>();
    for (const domain of domainsInCategory) {
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
    };
  }).sort((a, b) => b.overlapLabels.length - a.overlapLabels.length || a.label.localeCompare(b.label)),
  [categorizedDomainById, categorization.categories, categoryNames, domains]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-lg bg-slate-200 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <TagIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Categories</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {categoryGroups.length} auto category group{categoryGroups.length === 1 ? '' : 's'} from {domains.length} domains.
          </p>
        </div>
      </div>

      {categoryGroups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">No categories yet</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add related domains and the auto categorizer will group them here.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {categoryGroups.map(({ category, label, domains: categoryDomains, overlapLabels }) => (
            <section key={category.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={label}
                  onChange={(event) => setCategoryNameOverrides(current => ({ ...current, [category.id]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  aria-label={`Rename category ${category.suggestedName}`}
                />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {categoryDomains.length}
                </span>
              </div>

              {overlapLabels.length > 0 && (
                <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  overlaps {overlapLabels.slice(0, 4).join(' + ')}
                  {overlapLabels.length > 4 ? ` +${overlapLabels.length - 4}` : ''}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {categoryDomains.slice(0, 30).map(domain => (
                  <span key={domain.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {domain.domain_name}
                  </span>
                ))}
                {categoryDomains.length > 30 && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    +{categoryDomains.length - 30}
                  </span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
