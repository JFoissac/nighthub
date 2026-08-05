import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TrumpCorpusEntry } from './trump.scoring';

function coerceText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringifyMedia(attachments: unknown): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const first = attachments[0] as { type?: string } | undefined;
  const type = first?.type || 'media';
  return `[${type}]`;
}

export function parseTruthSocialArchiveJson(payload: unknown): TrumpCorpusEntry[] {
  if (!Array.isArray(payload)) return [];

  const records: TrumpCorpusEntry[] = [];

  for (const entry of payload as any[]) {
    const content =
      coerceText(entry?.post) ||
      coerceText(entry?.content) ||
      coerceText(entry?.text) ||
      stringifyMedia(entry?.media_attachments);

    if (!content) continue;

    records.push({
      content,
      likes: Number(entry?.favourites_count || entry?.favorites_count || 0),
      retweets: Number(entry?.reblogs_count || entry?.reposts_count || 0),
      tweetDate: entry?.created_at || entry?.createdAt || undefined,
    });
  }

  return records;
}

export function parseTrumpArchiveJson(payload: unknown): TrumpCorpusEntry[] {
  if (!Array.isArray(payload)) return [];

  const records: TrumpCorpusEntry[] = [];

  for (const entry of payload as any[]) {
    const content =
      coerceText(entry?.text) ||
      coerceText(entry?.tweet) ||
      coerceText(entry?.content) ||
      coerceText(entry?.full_text);

    if (!content) continue;

    records.push({
      content,
      likes: Number(entry?.favorites || entry?.likes || 0),
      retweets: Number(entry?.retweets || entry?.reposts || 0),
      tweetDate: entry?.date || entry?.created_at || undefined,
    });
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseTrumpArchiveCsv(csv: string): TrumpCorpusEntry[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());

  const records: TrumpCorpusEntry[] = [];

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
    const content =
      coerceText(record.text) ||
      coerceText(record.tweet) ||
      coerceText(record.content) ||
      coerceText(record.full_text);

    if (!content) continue;

    records.push({
      content,
      likes: Number(record.favorites || record.favorite_count || record.likes || 0),
      retweets: Number(record.retweets || record.repost_count || 0),
      tweetDate: record.date || record.created_at || undefined,
    });
  }

  return records;
}

function readArchiveFile(path: string): string | null {
  if (!path || !existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function loadTrumpArchiveCorpusFromPath(path: string): TrumpCorpusEntry[] {
  const payload = readArchiveFile(path);
  if (!payload) return [];

  if (path.endsWith('.csv')) {
    return parseTrumpArchiveCsv(payload);
  }

  const parsed = JSON.parse(payload);
  return parseTrumpArchiveJson(parsed);
}

export function resolveTrumpTwitterArchiveJsonPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.TRUMP_TWITTER_ARCHIVE_JSON,
    resolve(process.cwd(), 'docs/tweets_01-08-2021.json'),
    resolve(process.cwd(), '../docs/tweets_01-08-2021.json'),
  ].filter((value): value is string => Boolean(value));

  const match = candidates.find((candidate) => existsSync(candidate));
  return match || null;
}

export function resolveTrumpArchiveDatasetPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.TRUMP_ARCHIVE_DATASET_PATH,
    process.env.TRUMP_TWITTER_ARCHIVE_CSV,
    resolve(process.cwd(), 'docs/djt_posts_dec2025.csv'),
    resolve(process.cwd(), '../docs/djt_posts_dec2025.csv'),
    resolveTrumpTwitterArchiveJsonPath(),
  ].filter((value): value is string => Boolean(value));

  const match = candidates.find((candidate) => existsSync(candidate));
  return match || null;
}

export function loadTrumpArchiveCorpusFromEnv(): TrumpCorpusEntry[] {
  const truthJson = readArchiveFile(process.env.TRUMP_TRUTHSOCIAL_ARCHIVE_JSON || '');
  const twitterCsv = readArchiveFile(process.env.TRUMP_TWITTER_ARCHIVE_CSV || '');
  const twitterJson = readArchiveFile(process.env.TRUMP_TWITTER_ARCHIVE_JSON || '');

  const records: TrumpCorpusEntry[] = [];

  if (truthJson) {
    records.push(...parseTruthSocialArchiveJson(JSON.parse(truthJson)));
  }

  if (twitterCsv) {
    records.push(...parseTrumpArchiveCsv(twitterCsv));
  }

  if (twitterJson) {
    records.push(...parseTrumpArchiveJson(JSON.parse(twitterJson)));
  }

  return records;
}
