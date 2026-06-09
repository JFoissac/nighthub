export interface TrumpCorpusEntry {
  content: string;
  criticality?: number;
  isBreaking?: boolean;
  likes?: number;
  retweets?: number;
  tweetDate?: Date | string;
  type?: string;
  keywords?: string;
}

export interface TrumpScoringProfile {
  learnedBoosts: Record<string, number>;
}

const COUNTRY_AND_GEOPOLITICAL_TERMS = [
  'iran', 'china', 'russia', 'north korea', 'ukraine', 'israel', 'nato',
  'taiwan', 'gaza', 'palestine', 'eu', 'europe', 'canada', 'mexico',
  'venezuela', 'syria', 'afghanistan', 'pakistan', 'india',
];

const HIGH_IMPACT_PHRASES = [
  'nuclear', 'war', 'attack', 'attacked', 'attacking', 'strike', 'strikes',
  'shot down', 'bomb', 'bombs', 'missile', 'missiles', 'invasion', 'invade',
  'military response', 'respond to this attack', 'respond immediately', 'emergency',
  'martial law', 'shutdown', 'crisis', 'assault',
];

const ECONOMIC_IMPACT_PHRASES = [
  'tariff', 'tariffs', 'sanctions', 'trade war', 'trade deficit', 'export controls',
  'export ban', 'import ban', 'embargo', 'blockade', 'freeze', 'halt', 'blocked',
  'blocking', 'massive sales', 'mass sales', 'massive selling', 'sell off',
];

const EXECUTIVE_ACTION_PHRASES = [
  'executive order', 'signed', 'ordered', 'effective immediately', 'immediately',
  'fired', 'fire', 'firing', 'dismissed', 'dismiss', 'removed', 'resign', 'resigned',
  'resignation', 'terminated', 'termination',
];

const OFFICE_TERMS = [
  'secretary', 'director', 'chairman', 'chair', 'general', 'ambassador', 'administrator',
  'deputy', 'adviser', 'advisor', 'judge', 'parliamentarian', 'senator', 'governor',
  'treasury', 'defense', 'state', 'homeland', 'intelligence', 'fbi', 'cia', 'pentagon',
];

const BASE_HIGH_WEIGHTS = new Map<string, number>([
  ['nuclear', 4],
  ['war', 4],
  ['attack', 4],
  ['attacked', 4],
  ['attacking', 4],
  ['strike', 4],
  ['strikes', 4],
  ['shot down', 5],
  ['bomb', 4],
  ['bombs', 4],
  ['missile', 4],
  ['missiles', 4],
  ['invasion', 4],
  ['invade', 4],
  ['emergency', 3],
  ['martial law', 5],
  ['shutdown', 3],
  ['crisis', 3],
  ['tariff', 4],
  ['tariffs', 4],
  ['sanctions', 4],
  ['export controls', 4],
  ['export ban', 4],
  ['import ban', 4],
  ['embargo', 4],
  ['blockade', 4],
  ['fired', 4],
  ['fire', 4],
  ['dismissed', 4],
  ['removed', 4],
  ['resign', 4],
  ['resigned', 4],
  ['resignation', 4],
  ['terminated', 4],
]);

const BASE_MEDIUM_WEIGHTS = new Map<string, number>([
  ['deal', 2],
  ['trade', 2],
  ['economy', 2],
  ['inflation', 2],
  ['billion', 2],
  ['trillion', 2],
  ['tax', 2],
  ['regulation', 2],
  ['congress', 2],
  ['senate', 2],
  ['house', 2],
  ['supreme court', 2],
  ['election', 2],
  ['vote', 2],
  ['investigation', 2],
  ['hearing', 1],
  ['testimony', 1],
  ['ceasefire', 2],
  ['wall street', 1],
  ['federal reserve', 1],
  ['ukraine', 2],
  ['israel', 2],
  ['nato', 2],
  ['china', 1],
  ['russia', 1],
  ['iran', 1],
]);

const NOISE_PHRASES = [
  'rt:',
  'repost',
  'subscribe',
  'link in bio',
];

const LEARNING_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'would', 'have', 'has',
  'had', 'been', 'are', 'is', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'as',
  'we', 'i', 'you', 'they', 'them', 'our', 'your', 'their', 'it', 'a', 'an', 'or', 'be',
  'after', 'before', 'now', 'today', 'tonight', 'tomorrow', 'immediately', 'effective',
  'great', 'very', 'more', 'all', 'any', 'also', 'just', 'into', 'over', 'under',
]);

const DEFAULT_PROFILE: TrumpScoringProfile = {
  learnedBoosts: {},
};

function normalizeContent(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripUrls(content: string): string {
  return content.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
}

function isNoiseOnly(content: string): boolean {
  const text = normalizeContent(content).toLowerCase();
  if (!text) return true;
  if (NOISE_PHRASES.some((phrase) => text.includes(phrase))) {
    const tokens = text.replace(/https?:\/\/\S+/g, ' ').match(/[a-z0-9]+/gi) || [];
    if (tokens.length <= 3) return true;
  }

  const withoutUrls = stripUrls(text);
  const tokens = withoutUrls.match(/[a-z0-9]+/gi) || [];
  if (tokens.length === 0) return true;
  if (tokens.length <= 2 && !/[!?$%]/.test(withoutUrls)) return true;
  return false;
}

function countOccurrences(text: string, phrase: string): number {
  if (!phrase) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
  return matches ? matches.length : 0;
}

function hasPhrase(text: string, phrase: string): boolean {
  return countOccurrences(text, phrase) > 0;
}

function getTopBoosts(record: TrumpCorpusEntry): number {
  const criticality = record.criticality ?? 0;
  if (criticality >= 9 || record.isBreaking) return 1.5;
  if (criticality >= 7) return 1.1;
  if (criticality >= 5) return 0.4;
  if (criticality <= 2) return -0.4;
  return 0;
}

function collectFeaturePhrases(text: string): string[] {
  const phrases = [
    ...HIGH_IMPACT_PHRASES,
    ...ECONOMIC_IMPACT_PHRASES,
    ...EXECUTIVE_ACTION_PHRASES,
    ...BASE_HIGH_WEIGHTS.keys(),
    ...BASE_MEDIUM_WEIGHTS.keys(),
    ...COUNTRY_AND_GEOPOLITICAL_TERMS,
    ...OFFICE_TERMS,
  ];

  return phrases.filter((phrase) => hasPhrase(text, phrase));
}

function tokenizeForLearning(text: string): string[] {
  return stripUrls(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s%-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !LEARNING_STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function extractLearnedPhrases(text: string): string[] {
  const tokens = tokenizeForLearning(text);
  if (tokens.length < 2) return [];

  const phrases = new Set<string>();
  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const phrase = tokens.slice(i, i + size).join(' ').trim();
      if (phrase.length < 8) continue;
      if (collectFeaturePhrases(phrase).length > 0) continue;
      phrases.add(phrase);
    }
  }

  return [...phrases];
}

export function createDefaultTrumpScoringProfile(): TrumpScoringProfile {
  return {
    learnedBoosts: { ...DEFAULT_PROFILE.learnedBoosts },
  };
}

export function buildTrumpScoringProfile(records: TrumpCorpusEntry[]): TrumpScoringProfile {
  const boostAccumulator = new Map<string, number>();

  for (const record of records) {
    const normalized = normalizeContent(record.content || '').toLowerCase();
    if (!normalized) continue;

    const weight = getTopBoosts(record);
    if (weight === 0) continue;

    for (const phrase of collectFeaturePhrases(normalized)) {
      boostAccumulator.set(phrase, (boostAccumulator.get(phrase) || 0) + weight);
    }

    if (weight > 0) {
      for (const phrase of extractLearnedPhrases(normalized)) {
        boostAccumulator.set(phrase, (boostAccumulator.get(phrase) || 0) + (weight * 0.7));
      }
    }
  }

  const learnedBoosts: Record<string, number> = {};
  for (const [phrase, total] of boostAccumulator.entries()) {
    const clamped = Math.max(-1.5, Math.min(2.5, Number(total.toFixed(2))));
    if (Math.abs(clamped) >= 0.35) {
      learnedBoosts[phrase] = clamped;
    }
  }

  return { learnedBoosts };
}

function scoreTariffs(text: string): number {
  const amountMatch = text.match(/\b(\d{1,3})\s?(%|percent)\s*(tariffs?|duties?|levies?)\b/);
  const plainTariff = /\btariffs?\b/.test(text);

  if (amountMatch) {
    const amount = Number(amountMatch[1]);
    if (amount >= 100) return 10;
    if (amount >= 50) return 9;
    if (amount >= 25) return 8;
    if (amount >= 10) return 7;
    return 6;
  }

  if (plainTariff) {
    if (/massive|huge|across the board|all imports|all goods|all products/.test(text)) return 9;
    return 7;
  }

  return 0;
}

function scoreLeadershipChange(text: string): number {
  const executive = EXECUTIVE_ACTION_PHRASES.some((phrase) => hasPhrase(text, phrase));
  if (!executive) return 0;

  const officeHit = OFFICE_TERMS.some((phrase) => hasPhrase(text, phrase));
  const topOfficeHit = [
    'secretary of state',
    'secretary of defense',
    'director of national intelligence',
    'national security',
    'pentagon',
    'treasury',
    'fbi',
    'cia',
  ].some((phrase) => hasPhrase(text, phrase));

  if (topOfficeHit) return 10;
  if (officeHit) return 9;
  return 7;
}

function scoreMilitaryEscalation(text: string): number {
  const highSignal = HIGH_IMPACT_PHRASES.some((phrase) => hasPhrase(text, phrase));
  if (!highSignal) return 0;

  const geopoliticalHit = COUNTRY_AND_GEOPOLITICAL_TERMS.some((phrase) => hasPhrase(text, phrase));
  if (hasPhrase(text, 'shot down') || (geopoliticalHit && hasPhrase(text, 'attack'))) return 10;
  if ((geopoliticalHit && hasPhrase(text, 'war')) || (geopoliticalHit && hasPhrase(text, 'strike'))) return 9;
  if (hasPhrase(text, 'military') || hasPhrase(text, 'bomb') || hasPhrase(text, 'missiles')) return 8;
  return 7;
}

function scoreEconomicShock(text: string): number {
  const tariffScore = scoreTariffs(text);
  if (tariffScore > 0) return tariffScore;

  const economicHit = ECONOMIC_IMPACT_PHRASES.some((phrase) => hasPhrase(text, phrase));
  if (!economicHit) return 0;

  if (hasPhrase(text, 'export controls') || hasPhrase(text, 'embargo') || hasPhrase(text, 'blockade')) {
    if (hasPhrase(text, 'massive') || hasPhrase(text, 'all') || hasPhrase(text, 'china') || hasPhrase(text, 'russia')) {
      return 9;
    }
    return 8;
  }

  if (hasPhrase(text, 'sanctions') || hasPhrase(text, 'trade war')) return 8;
  return 6;
}

function scorePatternBoosts(text: string): number {
  let score = 0;
  const exclamations = (text.match(/!/g) || []).length;
  score += Math.min(2, exclamations * 0.5);

  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  score += Math.min(1, capsWords * 0.25);

  if (/\$[0-9]/.test(text)) score += 0.5;
  if (/\b\d{1,3}\s?(billion|trillion|million)\b/i.test(text)) score += 0.75;
  if (/\b\d{1,3}%\b/.test(text)) score += 0.5;

  return score;
}

function scoreEngagement(likes?: number, retweets?: number): number {
  const engagement = (likes || 0) + ((retweets || 0) * 1.2);
  if (engagement >= 25000) return 1.5;
  if (engagement >= 10000) return 1;
  if (engagement >= 3000) return 0.5;
  return 0;
}

export function scoreTrumpContent(
  rawContent: string,
  profile: TrumpScoringProfile = createDefaultTrumpScoringProfile(),
  meta: { likes?: number; retweets?: number } = {},
): number {
  const content = normalizeContent(rawContent);
  const lower = content.toLowerCase();

  if (isNoiseOnly(content)) return 0;

  let score = 0;
  score += scoreMilitaryEscalation(lower);
  score += scoreEconomicShock(lower);
  score += scoreLeadershipChange(lower);

  for (const [phrase, weight] of BASE_HIGH_WEIGHTS.entries()) {
    if (hasPhrase(lower, phrase)) score += weight;
  }
  for (const [phrase, weight] of BASE_MEDIUM_WEIGHTS.entries()) {
    if (hasPhrase(lower, phrase)) score += weight;
  }

  for (const [phrase, boost] of Object.entries(profile.learnedBoosts)) {
    if (hasPhrase(lower, phrase)) score += boost;
  }

  score += scorePatternBoosts(content);
  score += scoreEngagement(meta.likes, meta.retweets);

  const lengthPenalty = stripUrls(lower).length < 25 ? 1 : 0;
  score -= lengthPenalty;

  if (score <= 0) return 0;

  if (score >= 12) return 10;
  if (score >= 10) return 10;
  if (score >= 9) return 9;
  return Math.max(0, Math.round(score));
}
