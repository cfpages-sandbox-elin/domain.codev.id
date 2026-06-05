import { Domain } from '../types';
import { CategoryManualOverrides, CategoryWordGroup } from '../types';
import { getMembership, getMembershipScore, makePairKey } from './domainCategorizationScoring';

export interface DomainParts {
  base: string;
  tld: string;
}

export interface DomainCategoryMember {
  domainId: number;
  score: number;
  reason: 'exact' | 'contains' | 'similar' | 'manual' | 'word-group';
}

export interface DomainCategory {
  id: string;
  suggestedName: string;
  anchorBase: string;
  members: DomainCategoryMember[];
}

export interface CategorizedDomain {
  domain: Domain;
  parts: DomainParts;
  categoryIds: string[];
  primaryCategoryId: string | null;
}

export interface DomainCategorizationResult {
  categories: DomainCategory[];
  categorizedDomains: CategorizedDomain[];
  categoryIdsByDomainId: Record<number, string[]>;
}

const INDONESIAN_SECOND_LEVEL_TLDS = new Set([
  'ac',
  'biz',
  'co',
  'desa',
  'go',
  'mil',
  'my',
  'net',
  'or',
  'ponpes',
  'sch',
  'web',
]);

export const getDomainParts = (domainName: string): DomainParts => {
  const labels = domainName.toLowerCase().split('.').filter(Boolean);
  if (labels.length === 0) return { base: domainName.toLowerCase(), tld: '' };

  const usesIndonesianSecondLevel = labels.length >= 3
    && labels[labels.length - 1] === 'id'
    && INDONESIAN_SECOND_LEVEL_TLDS.has(labels[labels.length - 2]);
  const tldLabelCount = usesIndonesianSecondLevel ? 2 : 1;
  const baseLabels = labels.slice(0, -tldLabelCount);
  const tld = `.${labels.slice(-tldLabelCount).join('.')}`;

  return {
    base: (baseLabels[baseLabels.length - 1] || labels[0] || domainName).replace(/[^a-z0-9]/g, ''),
    tld,
  };
};

const getCategoryId = (base: string) => `category:${base}`;

const getPrimaryCategoryId = (categoryIds: string[], categoriesById: Map<string, DomainCategory>) => categoryIds
  .map(categoryId => categoriesById.get(categoryId))
  .filter((category): category is DomainCategory => Boolean(category))
  .sort((a, b) => {
    const aWordGroup = a.id.startsWith('word-group:') ? 0 : 1;
    const bWordGroup = b.id.startsWith('word-group:') ? 0 : 1;
    return aWordGroup - bWordGroup
      || a.suggestedName.length - b.suggestedName.length
      || a.suggestedName.localeCompare(b.suggestedName);
  })[0]?.id || null;

const rebuildCategorizedDomains = (
  categories: DomainCategory[],
  categorizedDomains: CategorizedDomain[],
): DomainCategorizationResult => {
  const categoriesById = new Map(categories.map(category => [category.id, category]));
  const categoryIdsByDomainId: Record<number, string[]> = {};

  for (const category of categories) {
    for (const member of category.members) {
      categoryIdsByDomainId[member.domainId] = [
        ...(categoryIdsByDomainId[member.domainId] || []),
        category.id,
      ];
    }
  }

  return {
    categories,
    categoryIdsByDomainId,
    categorizedDomains: categorizedDomains.map(item => {
      const categoryIds = categoryIdsByDomainId[item.domain.id] || [];
      return {
        ...item,
        categoryIds,
        primaryCategoryId: getPrimaryCategoryId(categoryIds, categoriesById),
      };
    }),
  };
};

export const categorizeDomains = (domains: Domain[]): DomainCategorizationResult => {
  const domainsWithParts = domains.map(domain => ({
    domain,
    parts: getDomainParts(domain.domain_name),
  }));
  const knownBases = new Set(domainsWithParts.map(item => item.parts.base));
  const categoriesById = new Map<string, DomainCategory>();
  const membershipCache = new Map<string, DomainCategoryMember['reason'] | null>();
  const scoreCache = new Map<string, number>();
  const getCachedMembership = (anchor: string, base: string) => {
    const key = `${anchor}\u0000${base}`;
    if (membershipCache.has(key)) return membershipCache.get(key) || null;
    const membership = getMembership(anchor, base, knownBases);
    membershipCache.set(key, membership);
    return membership;
  };
  const getCachedScore = (anchor: string, base: string, reason: DomainCategoryMember['reason']) => {
    if (reason === 'exact') return 1;
    if (reason === 'contains') return getMembershipScore(anchor, base, reason);
    const key = makePairKey(anchor, base);
    const cached = scoreCache.get(key);
    if (cached !== undefined) return cached;
    const score = getMembershipScore(anchor, base, reason);
    scoreCache.set(key, score);
    return score;
  };
  const anchors = Array.from(new Set(domainsWithParts.map(item => item.parts.base)))
    .filter(base => base.length >= 4)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const rawCategories = anchors.map(anchor => {
    const members = domainsWithParts
      .map(item => {
        const reason = getCachedMembership(anchor, item.parts.base);
        if (!reason) return null;
        return {
          domainId: item.domain.id,
          score: getCachedScore(anchor, item.parts.base, reason),
          reason,
        };
      })
      .filter((member): member is DomainCategoryMember => Boolean(member))
      .sort((a, b) => b.score - a.score);

    return {
      id: getCategoryId(anchor),
      suggestedName: anchor,
      anchorBase: anchor,
      members,
    };
  }).filter(category => category.members.length >= 2);

  const seenMemberSets = new Set<string>();
  const categories = rawCategories.filter(category => {
    const memberKey = category.members.map(member => member.domainId).sort((a, b) => a - b).join(',');
    if (seenMemberSets.has(memberKey)) return false;
    seenMemberSets.add(memberKey);
    categoriesById.set(category.id, category);
    return true;
  });
  const categoryIdsByDomainId: Record<number, string[]> = {};

  for (const category of categories) {
    for (const member of category.members) {
      categoryIdsByDomainId[member.domainId] = [
        ...(categoryIdsByDomainId[member.domainId] || []),
        category.id,
      ];
    }
  }

  const categorizedDomains = domainsWithParts.map(item => {
    const categoryIds = categoryIdsByDomainId[item.domain.id] || [];
    return {
      ...item,
      categoryIds,
      primaryCategoryId: getPrimaryCategoryId(categoryIds, categoriesById),
    };
  });

  return {
    categories,
    categorizedDomains,
    categoryIdsByDomainId,
  };
};

export const applyCategoryWordGroups = (
  result: DomainCategorizationResult,
  domains: Domain[],
  wordGroups: CategoryWordGroup[],
): DomainCategorizationResult => {
  const domainsWithParts = new Map(domains.map(domain => [domain.id, getDomainParts(domain.domain_name)]));
  const configuredCategories = wordGroups
    .filter(group => group.enabled && group.words.length >= 2)
    .map((group): DomainCategory | null => {
      const words = Array.from(new Set(group.words.map(word => word.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(word => word.length >= 3)));
      if (words.length < 2) return null;
      const members: DomainCategoryMember[] = domains
        .map((domain): DomainCategoryMember | null => {
          const base = domainsWithParts.get(domain.id)?.base || '';
          const matchedWords = words.filter(word => base.includes(word));
          if (matchedWords.length === 0) return null;
          return {
            domainId: domain.id,
            score: Math.min(1, 0.82 + (matchedWords.length * 0.06)),
            reason: 'word-group' as const,
          };
        })
        .filter((member): member is DomainCategoryMember => member !== null)
        .sort((a, b) => b.score - a.score || a.domainId - b.domainId);

      if (members.length === 0) return null;
      const suggestedName = group.label.trim() || words.join(' ');
      return {
        id: `word-group:${group.id}`,
        suggestedName,
        anchorBase: words[0],
        members,
      };
    })
    .filter((category): category is DomainCategory => Boolean(category));

  if (configuredCategories.length === 0) return result;
  return rebuildCategorizedDomains([...configuredCategories, ...result.categories], result.categorizedDomains);
};

export const applyCategoryManualOverrides = (
  result: DomainCategorizationResult,
  domains: Domain[],
  overrides: CategoryManualOverrides,
): DomainCategorizationResult => {
  const domainIds = new Set(domains.map(domain => domain.id));
  const categories = result.categories
    .map(category => {
      const override = overrides[category.id];
      if (!override) return category;

      const excludedIds = new Set(override.excludeDomainIds.filter(id => domainIds.has(id)));
      const memberByDomainId = new Map<number, DomainCategoryMember>();
      for (const member of category.members) {
        if (!excludedIds.has(member.domainId)) {
          memberByDomainId.set(member.domainId, member);
        }
      }

      for (const domainId of override.includeDomainIds) {
        if (!domainIds.has(domainId) || excludedIds.has(domainId)) continue;
        memberByDomainId.set(domainId, {
          domainId,
          score: 1,
          reason: 'manual',
        });
      }

      return {
        ...category,
        members: Array.from(memberByDomainId.values())
          .sort((a, b) => b.score - a.score || a.domainId - b.domainId),
      };
    })
    .filter(category => category.members.length > 0);

  return rebuildCategorizedDomains(categories, result.categorizedDomains);
};
