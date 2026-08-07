import { logger } from '../utils/logger';

/**
 * Module d'analyse IA des posts Trump et de la veille news.
 *
 * Provider OpenAI-compatible configurable via l'environnement :
 *   TRUMP_AI_API_KEY   (ou OPENAI_API_KEY en secours) — clé API
 *   TRUMP_AI_BASE_URL  (défaut https://api.openai.com/v1) — URL compatible /chat/completions
 *   TRUMP_AI_MODEL     (défaut gpt-4o-mini)
 *   TRUMP_AI_TIMEOUT_MS (défaut 20000)
 *   TRUMP_AI_MIN_RELEVANCE (défaut 1) — filtre les posts/news jugés non pertinents
 *
 * Sans clé configurée, tout le scoring existant (criticité entraînée) reste
 * utilisé : le module retourne simplement null et les appelants font leur
 * fallback local.
 */

export interface TrumpAiAnalysis {
  /** Pertinence 0-10 : événement majeur / action présidentielle => élevé, communication routine => faible. */
  relevance: number;
  /** Résumé factuel en français (<= 140 caractères). */
  summary: string;
  /** Justification courte en français (<= 80 caractères). */
  reason: string;
  /** Vrai si événement majeur en cours (alerte). */
  breaking: boolean;
}

export interface TrumpAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  minRelevance: number;
  batchSize: number;
}

export interface AiScorablePost {
  tweetId: string;
  content: string;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MIN_RELEVANCE = 1;
const DEFAULT_BATCH_SIZE = 20;

export function getTrumpAiConfig(): TrumpAiConfig | null {
  const apiKey = process.env.TRUMP_AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.TRUMP_AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.TRUMP_AI_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.TRUMP_AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    minRelevance: Number(process.env.TRUMP_AI_MIN_RELEVANCE) || DEFAULT_MIN_RELEVANCE,
    batchSize: Number(process.env.TRUMP_AI_BATCH_SIZE) || DEFAULT_BATCH_SIZE,
  };
}

export function isTrumpAiEnabled(): boolean {
  return getTrumpAiConfig() !== null;
}

const SYSTEM_PROMPT = [
  'Tu es un analyste de veille politique francophone.',
  'Pour chaque post de Donald Trump (ou article de presse le concernant), évalue sa PERTINENCE',
  'pour un suivi personnel d\'actualité : décisions présidentielles, guerre, économie, justice,',
  'élections, événements graves = score élevé ; communication marketing, compliments, routine = score faible.',
  'Réponds UNIQUEMENT en JSON, sans autre texte : un tableau d\'objets avec les clés :',
  'index (entier, position dans la liste fournie), relevance (entier 0-10),',
  'summary (résumé factuel en français, max 140 caractères),',
  'reason (justification en français, max 80 caractères),',
  'breaking (booléen : vrai uniquement si événement majeur en cours ou nouvelle grave).',
].join(' ');

/**
 * Analyse une liste de posts via le provider OpenAI-compatible.
 * Retourne null si l'IA est indisponible (pas de clé, erreur réseau, JSON invalide) :
 * les appelants conservent alors leur scoring local.
 */
export async function analyzeTrumpPostsWithAi(
  posts: AiScorablePost[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, TrumpAiAnalysis> | null> {
  const config = getTrumpAiConfig();
  if (!config) return null;
  if (posts.length === 0) return new Map();

  const result = new Map<string, TrumpAiAnalysis>();
  const batches: AiScorablePost[][] = [];
  for (let i = 0; i < posts.length; i += config.batchSize) {
    batches.push(posts.slice(i, i + config.batchSize));
  }

  for (const batch of batches) {
    try {
      const analyses = await analyzeBatch(batch, config, fetchImpl);
      batch.forEach((post, i) => {
        const a = analyses[i];
        if (a) result.set(post.tweetId, a);
      });
    } catch (error) {
      logger.warn('[TrumpAI] Batch analysis failed, falling back to local scoring', {
        error: error instanceof Error ? error.message : String(error),
        batchSize: batch.length,
      });
      return null;
    }
  }

  return result;
}

async function analyzeBatch(
  batch: AiScorablePost[],
  config: TrumpAiConfig,
  fetchImpl: typeof fetch,
): Promise<TrumpAiAnalysis[]> {
  const payload = batch.map((post, i) => ({
    index: i,
    text: post.content.substring(0, 500),
  }));

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyse ces ${payload.length} éléments : ${JSON.stringify(payload)}` },
      ],
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI provider returned empty content');

  const parsed = parseAiJsonResponse(content);
  const byIndex = new Map<number, TrumpAiAnalysis>();
  parsed.forEach((a) => {
    if (typeof a?.index === 'number') byIndex.set(a.index, normalizeAnalysis(a));
  });

  return batch.map((_post, i) => {
    const a = byIndex.get(i);
    if (!a) throw new Error(`AI response missing index ${i}`);
    return normalizeAnalysis(a);
  });
}

/** Parse et normalise la réponse JSON du provider (tolère les code fences et le bruit). */
export function parseAiJsonResponse(raw: string): Array<Partial<TrumpAiAnalysis> & { index?: number }> {
  const cleaned = raw
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response is not a JSON array');
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeAnalysis(a: Partial<TrumpAiAnalysis> & { index?: number }): TrumpAiAnalysis {
  const relevance = Math.max(0, Math.min(10, Math.round(Number(a.relevance) || 0)));
  return {
    relevance,
    summary: String(a.summary || '').substring(0, 140),
    reason: String(a.reason || '').substring(0, 80),
    breaking: Boolean(a.breaking) || relevance >= 8,
  };
}

/* ------------------------------------------------------------------ */
/* Fallback heuristique (sans IA) pour la veille « Trump TV / News »   */
/* ------------------------------------------------------------------ */

export const NEWS_BREAKING_KEYWORDS = [
  'assassinat', 'tir', 'tirs', 'fusillade', 'frappe', 'frappes', 'guerre',
  'war', 'shooting', 'shot', 'assassination', 'attack', 'attaque', 'strike',
  'missile', 'missiles', 'nuclear', 'nucléaire', 'impeachment', 'destitution',
  'indicted', 'inculp', 'arrest', 'arrestation', 'verdict', 'convict',
  'martial law', 'invasion', 'crisis', 'emergency', 'urgence',
  'coup d\'état', 'coup d\'etat', 'sanctions', 'resign', 'démission',
  'fired', 'bomb', 'bombe',
];

export const NEWS_HIGH_KEYWORDS = [
  'military', 'armée', 'militaire', 'troops', 'russia', 'russie', 'ukraine',
  'iran', 'china', 'chine', 'tariff', 'tarifs', 'executive order', 'décret',
  'court', 'tribunal', 'trial', 'procès', 'justice', 'election', 'élection',
  'vote', 'congress', 'congrès', 'supreme court', 'deport', 'expulsion',
  'border', 'frontière', 'economy', 'économie', 'inflation', 'crash',
  'nato', 'otan', 'israel', 'israël', 'ceasefire', 'trêve',
];

/** Mots-clés de contexte politique US : autorisent un article sans mention explicite du nom. */
export const NEWS_CONTEXT_KEYWORDS = [
  'president', 'président', 'white house', 'maison blanche', 'presidency',
  'mar-a-lago', 'maga', 'trump', 'donald trump', 'americ', 'etats-unis',
  'états-unis', 'washington',
];

/**
 * Score heuristique 0-10 d'une dépêche : événements graves (tirs, frappes,
 * guerre...) montent vite, le contexte politique modéré monte lentement.
 */
export function scoreTrumpNewsHeuristically(title: string, summary: string): {
  criticality: number;
  breaking: boolean;
  matchedKeywords: string[];
} {
  const text = `${title} ${summary}`.toLowerCase();
  const matchedBreaking = NEWS_BREAKING_KEYWORDS.filter((kw) => text.includes(kw));
  const matchedHigh = NEWS_HIGH_KEYWORDS.filter((kw) => text.includes(kw));

  let score = 0;
  matchedBreaking.forEach((kw) => {
    score += kw.length <= 4 ? 3 : 2.5;
  });
  matchedHigh.forEach((kw) => {
    score += 1;
  });

  // Un titre explicite « Trump » + sujet majeur renforce le score
  const inTitle = `${title}`.toLowerCase();
  const nameInTitle = NEWS_CONTEXT_KEYWORDS.some((kw) => inTitle.includes(kw));
  if (nameInTitle && matchedBreaking.length > 0) score += 1;

  const criticality = Math.max(0, Math.min(10, Math.round(score)));
  const breaking = criticality >= 7 || matchedBreaking.some((kw) =>
    ['assassinat', 'tir', 'tirs', 'fusillade', 'frappe', 'frappes', 'guerre', 'war',
      'shooting', 'shot', 'assassination', 'attack', 'attaque', 'strike', 'missile',
      'missiles', 'nuclear', 'nucléaire', 'bomb', 'bombe'].includes(kw),
  );

  const matchedKeywords = [...matchedBreaking, ...matchedHigh].slice(0, 8);
  return { criticality, breaking, matchedKeywords };
}
