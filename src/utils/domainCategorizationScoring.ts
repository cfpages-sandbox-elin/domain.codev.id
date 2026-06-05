export type MembershipReason = 'exact' | 'contains' | 'similar' | 'manual' | 'word-group';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const MEANINGFUL_SHORT_PREFIXES = new Set([
  'law',
  'pre',
]);

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

export const getMembership = (anchor: string, base: string, knownBases: Set<string>): MembershipReason | null => {
  if (anchor === base) return 'exact';
  if (hasStrongContainment(anchor, base, knownBases)) return 'contains';
  if (anchor.includes(base) || base.includes(anchor)) return null;

  const score = scoreBaseSimilarity(anchor, base);
  return score >= 0.74 && hasStrongSimilarityEvidence(anchor, base) ? 'similar' : null;
};

export const getMembershipScore = (anchor: string, base: string, reason: MembershipReason) => {
  if (reason === 'exact') return 1;
  if (reason === 'contains') {
    const shorterLength = Math.min(anchor.length, base.length);
    const longerLength = Math.max(anchor.length, base.length);
    return Math.max(0.78, shorterLength / longerLength);
  }
  return scoreBaseSimilarity(anchor, base);
};

export const makePairKey = (left: string, right: string) => left <= right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
