import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadTrumpArchiveCorpusFromEnv,
  parseTrumpArchiveJson,
  parseTruthSocialArchiveJson,
  parseTrumpArchiveCsv,
} from './trump.archive';

describe('Trump archive ingestion', () => {
  it('parses truth social archive json into training corpus entries', () => {
    const records = parseTruthSocialArchiveJson([
      {
        post: 'Iran attacked our military assets and we will respond immediately.',
        is_repost: false,
        created_at: '2026-06-10T10:00:00.000Z',
        reblogs_count: 123,
        favourites_count: 456,
      },
      {
        post: '',
        content: '',
        media_attachments: [{ type: 'image', url: 'https://cdn.example.com/image.jpg' }],
      },
    ]);

    expect(records).toHaveLength(2);
    expect(records[0].content).toContain('Iran attacked our military assets');
    expect(records[1].content).toContain('[image]');
  });

  it('parses trump archive csv rows into training corpus entries', () => {
    const csv = [
      'date,text,isRetweet,favorites,retweets',
      '"2020-01-01","Complete and Total Endorsement for somebody",false,10,2',
      '"2020-01-02","100% tariffs on all imports from China",false,500,120',
    ].join('\n');

    const records = parseTrumpArchiveCsv(csv);

    expect(records).toHaveLength(2);
    expect(records[0].content).toContain('Complete and Total Endorsement');
    expect(records[1].content).toContain('100% tariffs');
  });

  it('parses the local twitter archive json rows into training corpus entries', () => {
    const records = parseTrumpArchiveJson([
      {
        id: 1,
        text: 'Republicans and Democrats have both created our economic problems.',
        favorites: 49,
        retweets: 255,
        date: '2011-08-02 18:07:48',
      },
      {
        id: 2,
        text: 'Complete and Total Endorsement for Re-Election.',
        favorites: 10,
        retweets: 2,
        date: '2020-01-01 10:00:00',
      },
    ]);

    expect(records).toHaveLength(2);
    expect(records[0].content).toContain('economic problems');
    expect(records[1].content).toContain('Complete and Total Endorsement');
  });

  it('loads archive corpora from env-backed local files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trump-archive-'));
    const truthPath = join(dir, 'truth.json');
    const tweetsPath = join(dir, 'tweets.csv');
    const tweetsJsonPath = join(dir, 'tweets.json');

    writeFileSync(
      truthPath,
      JSON.stringify([{ post: 'Naval blockade now in effect.', created_at: '2026-06-10T10:00:00.000Z' }]),
    );
    writeFileSync(
      tweetsPath,
      ['date,text,isRetweet', '"2020-01-01","Thank you Michigan",false'].join('\n'),
    );
    writeFileSync(
      tweetsJsonPath,
      JSON.stringify([{ text: 'Record exports help shrink trade deficit.', favorites: 20, retweets: 4 }]),
    );

    process.env.TRUMP_TRUTHSOCIAL_ARCHIVE_JSON = truthPath;
    process.env.TRUMP_TWITTER_ARCHIVE_CSV = tweetsPath;
    process.env.TRUMP_TWITTER_ARCHIVE_JSON = tweetsJsonPath;

    const records = loadTrumpArchiveCorpusFromEnv();

    expect(records.length).toBe(3);
    expect(records.some((record) => record.content.includes('Naval blockade'))).toBe(true);
    expect(records.some((record) => record.content.includes('Thank you Michigan'))).toBe(true);
    expect(records.some((record) => record.content.includes('Record exports help shrink trade deficit'))).toBe(true);

    rmSync(dir, { recursive: true, force: true });
    delete process.env.TRUMP_TRUTHSOCIAL_ARCHIVE_JSON;
    delete process.env.TRUMP_TWITTER_ARCHIVE_CSV;
    delete process.env.TRUMP_TWITTER_ARCHIVE_JSON;
  });
});
