import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeTrumpPostsWithAi,
  getTrumpAiConfig,
  isTrumpAiEnabled,
  parseAiJsonResponse,
  scoreTrumpNewsHeuristically,
} from './trump.ai';

describe('trump.ai — configuration', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv };
    delete process.env.TRUMP_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.TRUMP_AI_BASE_URL;
    delete process.env.TRUMP_AI_MODEL;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('returns null config when no API key', () => {
    expect(getTrumpAiConfig()).toBeNull();
    expect(isTrumpAiEnabled()).toBe(false);
  });

  it('uses TRUMP_AI_API_KEY when set', () => {
    process.env.TRUMP_AI_API_KEY = 'sk-test';
    const config = getTrumpAiConfig();
    expect(config?.apiKey).toBe('sk-test');
    expect(isTrumpAiEnabled()).toBe(true);
  });

  it('falls back to OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'sk-openai';
    expect(getTrumpAiConfig()?.apiKey).toBe('sk-openai');
  });

  it('applies defaults for base URL and model', () => {
    process.env.TRUMP_AI_API_KEY = 'sk-test';
    const config = getTrumpAiConfig();
    expect(config?.baseUrl).toBe('https://api.openai.com/v1');
    expect(config?.model).toBe('gpt-4o-mini');
    expect(config?.minRelevance).toBe(1);
  });

  it('honors custom base URL and model', () => {
    process.env.TRUMP_AI_API_KEY = 'sk-test';
    process.env.TRUMP_AI_BASE_URL = 'https://llm.local/v1/';
    process.env.TRUMP_AI_MODEL = 'qwen-72b';
    const config = getTrumpAiConfig();
    expect(config?.baseUrl).toBe('https://llm.local/v1');
    expect(config?.model).toBe('qwen-72b');
  });
});

describe('parseAiJsonResponse', () => {
  it('parses a plain JSON array', () => {
    const out = parseAiJsonResponse('[{"index":0,"relevance":8,"summary":"s","reason":"r","breaking":true}]');
    expect(out[0].relevance).toBe(8);
  });

  it('tolerates markdown code fences', () => {
    const out = parseAiJsonResponse('```json\n[{"index":1,"relevance":3}]\n```');
    expect(out[0].index).toBe(1);
  });

  it('tolerates prose around the array', () => {
    const out = parseAiJsonResponse('Voici : [{"index":2,"relevance":5}] Fin.');
    expect(out[0].relevance).toBe(5);
  });

  it('throws when no array is present', () => {
    expect(() => parseAiJsonResponse('pas de json ici')).toThrow();
  });
});

describe('analyzeTrumpPostsWithAi', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv };
    process.env.TRUMP_AI_API_KEY = 'sk-test';
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.unstubAllGlobals();
  });

  it('returns null when no API key is configured', async () => {
    delete process.env.TRUMP_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await analyzeTrumpPostsWithAi([{ tweetId: '1', content: 'hello' }]);
    expect(result).toBeNull();
  });

  it('calls the OpenAI-compatible endpoint and maps analyses by tweetId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify([
          { index: 0, relevance: 9, summary: 'Frappe militaire annoncée', reason: 'Événement majeur', breaking: true },
          { index: 1, relevance: 2, summary: 'Merci pour le soutien', reason: 'Routine', breaking: false },
        ]) } }],
      }),
    });

    const result = await analyzeTrumpPostsWithAi(
      [
        { tweetId: 'a', content: 'We launched strikes on Iran' },
        { tweetId: 'b', content: 'Thank you for the support!' },
      ],
      fetchMock as any,
    );

    expect(result).not.toBeNull();
    expect(result!.get('a')?.relevance).toBe(9);
    expect(result!.get('a')?.breaking).toBe(true);
    expect(result!.get('b')?.relevance).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body).model).toBe('gpt-4o-mini');
  });

  it('clamps relevance to 0-10', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify([
          { index: 0, relevance: 42, summary: '', reason: '', breaking: false },
        ]) } }],
      }),
    });

    const result = await analyzeTrumpPostsWithAi([{ tweetId: 'a', content: 'x' }], fetchMock as any);
    expect(result!.get('a')?.relevance).toBe(10);
  });

  it('forces breaking when relevance >= 8', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify([
          { index: 0, relevance: 8, summary: 's', reason: 'r', breaking: false },
        ]) } }],
      }),
    });

    const result = await analyzeTrumpPostsWithAi([{ tweetId: 'a', content: 'x' }], fetchMock as any);
    expect(result!.get('a')?.breaking).toBe(true);
  });

  it('falls back to null on HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const result = await analyzeTrumpPostsWithAi([{ tweetId: 'a', content: 'x' }], fetchMock as any);
    expect(result).toBeNull();
  });

  it('falls back to null on invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
    });
    const result = await analyzeTrumpPostsWithAi([{ tweetId: 'a', content: 'x' }], fetchMock as any);
    expect(result).toBeNull();
  });
});

describe('scoreTrumpNewsHeuristically — fallback sans IA', () => {
  it('scores 0 for unrelated news', () => {
    const { criticality } = scoreTrumpNewsHeuristically('Le marché des crypto monte', '');
    expect(criticality).toBe(0);
  });

  it('flags an assassination attempt as breaking and critical', () => {
    const { criticality, breaking } = scoreTrumpNewsHeuristically(
      'Tirs lors d\'un meeting de Donald Trump en Pennsylvanie',
      'Le président a été évacué par le Secret Service.',
    );
    expect(criticality).toBeGreaterThanOrEqual(7);
    expect(breaking).toBe(true);
  });

  it('flags war/shooting keywords as breaking', () => {
    const { breaking } = scoreTrumpNewsHeuristically('Trump annonce des frappes militaires en Iran', '');
    expect(breaking).toBe(true);
  });

  it('collects matched keywords', () => {
    const { matchedKeywords } = scoreTrumpNewsHeuristically('Trump frappe l\'Iran, guerre imminente', '');
    expect(matchedKeywords).toContain('frappe');
    expect(matchedKeywords).toContain('guerre');
    expect(matchedKeywords.length).toBeLessThanOrEqual(8);
  });

  it('keeps moderate politics news non-breaking but scored', () => {
    const { criticality, breaking } = scoreTrumpNewsHeuristically('Trump signe un décret sur les tarifs douaniers', '');
    expect(criticality).toBeGreaterThan(0);
    expect(criticality).toBeLessThan(7);
    expect(breaking).toBe(false);
  });

  it('caps criticality at 10', () => {
    const { criticality } = scoreTrumpNewsHeuristically(
      'Guerre nucléaire : Trump lance des missiles, frappes massives, invasion, état d\'urgence, tirs et bombes',
      'shooting attack nuclear war missiles strike',
    );
    expect(criticality).toBeLessThanOrEqual(10);
  });
});
