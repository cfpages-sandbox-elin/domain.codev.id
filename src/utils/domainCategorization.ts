import { Domain } from '../types';
import { CategoryManualOverrides, CategoryWordGroup } from '../types';

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

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const MEANINGFUL_SHORT_PREFIXES = new Set([
  'law',
  'pre',
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

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
};

const normalizedSimilarity = (left: string, right: string) => {
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  return 1 - (levenshteinDistance(left, right) / longest);
};

const longestCommonSubstringLength = (left: string, right: string) => {
  let longest = 0;
  const previous = Array(right.length + 1).fill(0);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : 0;
      longest = Math.max(longest, current[j]);
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
      current[j] = 0;
    }
  }

  return longest;
};

const commonPrefixLength = (left: string, right: string) => {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
};

const commonSuffixLength = (left: string, right: string) => {
  let index = 0;
  while (
    index < left.length
    && index < right.length
    && left[left.length - 1 - index] === right[right.length - 1 - index]
  ) {
    index += 1;
  }
  return index;
};

const splitLetters = (value: string) => {
  const letters = value.replace(/[^a-z]/g, '');
  let vowels = '';
  let consonants = '';

  for (const char of letters) {
    if (VOWELS.has(char)) {
      vowels += char;
    } else {
      consonants += char;
    }
  }

  return { vowels, consonants };
};

const phoneticKey = (value: string) => value
  .replace(/[^a-z0-9]/g, '')
  .replace(/c/g, 'k')
  .replace(/q/g, 'k')
  .replace(/x/g, 'ks')
  .replace(/y/g, 'i')
  .replace(/ph/g, 'f');

const onlyDiffersByLeadingLetter = (left: string, right: string) => {
  if (left.length !== right.length || left.length < 5) return false;
  if (commonSuffixLength(left, right) !== left.length - 1) return false;
  return phoneticKey(left[0]) !== phoneticKey(right[0]);
};

const scoreBaseSimilarity = (left: string, right: string) => {
  const leftLetters = splitLetters(left);
  const rightLetters = splitLetters(right);
  const consonantScore = normalizedSimilarity(leftLetters.consonants, rightLetters.consonants);
  const vowelScore = normalizedSimilarity(leftLetters.vowels, rightLetters.vowels);
  const fullScore = normalizedSimilarity(left, right);
  const phoneticScore = normalizedSimilarity(phoneticKey(left), phoneticKey(right));
  let score = (consonantScore * 0.42) + (vowelScore * 0.38) + (fullScore * 0.20);

  if (vowelScore < 0.35) {
    score *= 0.78;
  }

  return Math.max(score, phoneticScore * 0.9);
};

const hasMeaningfulRemainder = (
  remainder: string,
  position: 'prefix' | 'suffix',
  knownBases: Set<string>,
) => {
  if (remainder.length >= 4 && knownBases.has(remainder)) return true;
  return position === 'prefix' && MEANINGFUL_SHORT_PREFIXES.has(remainder);
};

const hasMinorTrailingSuffix = (shorter: string, longer: string) => {
  if (!longer.startsWith(shorter)) return false;
  if (longer.length !== shorter.length + 1) return false;
  return shorter.length >= 4 && normalizedSimilarity(shorter, longer) >= 0.80;
};

const hasStrongContainment = (anchor: string, base: string, knownBases: Set<string>) => {
  if (anchor.length >= base.length || !base.includes(anchor)) return false;

  const shorter = anchor;
  const longer = base;
  if (shorter.length < 4) return false;

  const startsOrEnds = longer.startsWith(shorter) || longer.endsWith(shorter);
  const coverage = shorter.length / longer.length;

  if (shorter.length <= 5) {
    if (!startsOrEnds || coverage < 0.22) return false;

    if (longer.startsWith(shorter)) {
      const suffix = longer.slice(shorter.length);
      return hasMinorTrailingSuffix(shorter, longer)
        || hasMeaningfulRemainder(suffix, 'suffix', knownBases);
    }

    const prefix = longer.slice(0, -shorter.length);
    return hasMeaningfulRemainder(prefix, 'prefix', knownBases);
  }

  return coverage >= 0.30 || startsOrEnds;
};

const hasStrongSimilarityEvidence = (left: string, right: string) => {
  const shortest = Math.min(left.length, right.length);
  const longest = Math.max(left.length, right.length);
  if (shortest < 5) return false;
  if (longest / shortest > 1.55) return false;
  if (onlyDiffersByLeadingLetter(left, right)) return false;

  const fullScore = normalizedSimilarity(left, right);
  const phoneticScore = normalizedSimilarity(phoneticKey(left), phoneticKey(right));
  if (phoneticScore >= 0.88 && fullScore >= 0.42) return true;

  const sharedRun = longestCommonSubstringLength(left, right);
  const prefix = commonPrefixLength(left, right);
  const suffix = commonSuffixLength(left, right);
  const hasSharedShape = sharedRun >= 4 || prefix >= 4 || suffix >= 4;
  if (!hasSharedShape) return false;

  const leftLetters = splitLetters(left);
  const rightLetters = splitLetters(right);
  const vowelScore = normalizedSimilarity(leftLetters.vowels, rightLetters.vowels);
  const consonantScore = normalizedSimilarity(leftLetters.consonants, rightLetters.consonants);

  return fullScore >= 0.62
    && consonantScore >= 0.58
    && vowelScore >= 0.50;
};

const getMembership = (anchor: string, base: string, knownBases: Set<string>): DomainCategoryMember['reason'] | null => {
  if (anchor === base) return 'exact';
  if (hasStrongContainment(anchor, base, knownBases)) return 'contains';
  if (anchor.includes(base) || base.includes(anchor)) return null;

  const score = scoreBaseSimilarity(anchor, base);
  return score >= 0.74 && hasStrongSimilarityEvidence(anchor, base) ? 'similar' : null;
};

const getMembershipScore = (anchor: string, base: string, reason: DomainCategoryMember['reason']) => {
  if (reason === 'exact') return 1;
  if (reason === 'contains') {
    const shorterLength = Math.min(anchor.length, base.length);
    const longerLength = Math.max(anchor.length, base.length);
    return Math.max(0.78, shorterLength / longerLength);
  }
  return scoreBaseSimilarity(anchor, base);
};

const getCategoryId = (base: string) => `category:${base}`;

const makePairKey = (left: string, right: string) => left <= right ? `${left}\u0000${right}` : `${right}\u0000${left}`;

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
    const score = scoreBaseSimilarity(anchor, base);
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
