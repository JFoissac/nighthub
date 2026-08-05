import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { TrumpCorpusEntry, TrumpScoringProfile } from './trump.scoring';
import {
  buildTrumpScoringProfileCooperative,
  createDefaultTrumpScoringProfile,
  mergeTrumpScoringProfiles,
  mergeTrumpScoringProfilesCooperative,
  yieldToEventLoop,
} from './trump.scoring';
import {
  loadTrumpArchiveCorpusFromPath,
  resolveTrumpArchiveDatasetPath,
} from './trump.archive';
import { logger } from '../utils/logger';

const DEFAULT_TRAINING_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface TrumpTrainingSnapshot {
  trainedAt: string;
  reason: string;
  datasetPath: string;
  archiveRecordCount: number;
  inferredRecordCount: number;
  profile: TrumpScoringProfile;
}

type TrumpTrainingServiceOptions = {
  datasetPath?: string | null;
  snapshotPath?: string;
  intervalMs?: number;
  log?: Pick<typeof logger, 'info' | 'warn' | 'error'>;
};

function normalizeContent(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCriticality(content: string): number | null {
  const lower = normalizeContent(content).toLowerCase();
  if (!lower) return null;

  if (
    /complete and total endorsement|re-election|telerally|thank you|great crowd|voter i\.d\.|acting director|will be taking over/.test(lower)
  ) {
    return 1;
  }

  if (/record .*exports?|trade deficit/.test(lower)) {
    return 2;
  }

  if (
    /nuclear|war|attacked|attack|bomb|bombardment|missile|blockade|100% tariffs?|all imports from china|secretary of state has resigned|secretary of defense has been fired/.test(lower)
  ) {
    return 10;
  }

  if (/sanctions|tariffs?|trade war|ceasefire|strikes?|troops|military|executive order/.test(lower)) {
    return 7;
  }

  if (/trade|economy|inflation|congress|court|hearing|deal/.test(lower)) {
    return 4;
  }

  return null;
}

export async function buildInferredTrumpTrainingCorpus(records: TrumpCorpusEntry[]): Promise<TrumpCorpusEntry[]> {
  const inferred: TrumpCorpusEntry[] = [];
  const seen = new Set<string>();
  let lastYieldAt = Date.now();

  for (const record of records) {
    const content = normalizeContent(record.content || '');
    if (!content) continue;

    const key = content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const criticality = inferCriticality(content);
    if (criticality === null) continue;

    inferred.push({
      content,
      likes: record.likes,
      retweets: record.retweets,
      tweetDate: record.tweetDate,
      criticality,
      isBreaking: criticality >= 8,
    });

    // Yield periodically so a large archive never freezes the event loop.
    if (Date.now() - lastYieldAt >= 25) {
      await yieldToEventLoop();
      lastYieldAt = Date.now();
    }
  }

  return inferred;
}

async function buildAnchorPhraseProfile(records: TrumpCorpusEntry[]): Promise<TrumpScoringProfile> {
  const learnedBoosts: Record<string, number> = {};

  const lowSignalAnchors = [
    { phrase: 'complete and total endorsement', weight: -1.8 },
    { phrase: 're-election', weight: -1.1 },
    { phrase: 'trade deficit', weight: -1.4 },
    { phrase: 'record exports', weight: -1.3 },
    { phrase: 'acting director', weight: -1.2 },
    { phrase: 'will be taking over', weight: -1.2 },
    { phrase: 'telerally', weight: -1.6 },
  ];

  const highSignalAnchors = [
    { phrase: 'respond immediately', weight: 1.1 },
    { phrase: 'our military assets', weight: 1.2 },
    { phrase: 'all imports from china', weight: 1.1 },
    { phrase: 'secretary of state has resigned', weight: 1.2 },
  ];

  const corpusText: string[] = [];
  let lastYieldAt = Date.now();
  for (const record of records) {
    corpusText.push(normalizeContent(record.content).toLowerCase());
    if (Date.now() - lastYieldAt >= 25) {
      await yieldToEventLoop();
      lastYieldAt = Date.now();
    }
  }

  for (const anchor of lowSignalAnchors) {
    if (corpusText.some((text) => text.includes(anchor.phrase))) {
      learnedBoosts[anchor.phrase] = anchor.weight;
    }
  }

  for (const anchor of highSignalAnchors) {
    if (corpusText.some((text) => text.includes(anchor.phrase))) {
      learnedBoosts[anchor.phrase] = anchor.weight;
    }
  }

  return { learnedBoosts };
}

function resolveDefaultSnapshotPath(): string {
  return resolve(process.cwd(), 'data/trump-trained-profile.json');
}

export class TrumpTrainingService {
  private timer: NodeJS.Timeout | null = null;
  private lastSnapshot: TrumpTrainingSnapshot | null = null;
  private persistedProfile: TrumpScoringProfile = createDefaultTrumpScoringProfile();
  private trainingPromise: Promise<TrumpTrainingSnapshot | null> | null = null;
  private readonly datasetPath: string | null;
  private readonly snapshotPath: string;
  private readonly intervalMs: number;
  private readonly log: Pick<typeof logger, 'info' | 'warn' | 'error'>;

  constructor(options: TrumpTrainingServiceOptions = {}) {
    this.datasetPath = options.datasetPath ?? resolveTrumpArchiveDatasetPath();
    this.snapshotPath = options.snapshotPath ?? resolveDefaultSnapshotPath();
    this.intervalMs = options.intervalMs ?? DEFAULT_TRAINING_INTERVAL_MS;
    this.log = options.log ?? logger;
    this.lastSnapshot = this.loadSnapshot();
    this.persistedProfile = this.lastSnapshot?.profile ?? createDefaultTrumpScoringProfile();
  }

  start(): void {
    if (this.timer) return;

    // A persisted snapshot is authoritative for live scoring — no need to
    // re-train from the raw archive at startup. Re-training still runs on the
    // interval below so the profile refreshes in the background over time.
    if (this.lastSnapshot) {
      this.log.info('[TrumpTrainer] Persisted snapshot found, skipping startup training', {
        trainedAt: this.lastSnapshot.trainedAt,
        snapshotPath: this.snapshotPath,
      } as any);
    } else {
      void this.trainNow('startup');
    }

    this.timer = setInterval(() => {
      void this.trainNow('interval');
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getPersistedProfile(): TrumpScoringProfile {
    return mergeTrumpScoringProfiles(createDefaultTrumpScoringProfile(), this.persistedProfile);
  }

  getSnapshot(): TrumpTrainingSnapshot | null {
    return this.lastSnapshot;
  }

  async trainNow(reason: string = 'manual'): Promise<TrumpTrainingSnapshot | null> {
    if (this.trainingPromise) return this.trainingPromise;

    this.trainingPromise = this.executeTraining(reason)
      .finally(() => {
        this.trainingPromise = null;
      });

    return this.trainingPromise;
  }

  private async executeTraining(reason: string): Promise<TrumpTrainingSnapshot | null> {
    if (!this.datasetPath || !existsSync(this.datasetPath)) {
      this.log.warn('[TrumpTrainer] Dataset not found, skipping background training', {
        datasetPath: this.datasetPath,
      } as any);
      return this.lastSnapshot;
    }

    // NOTE: loadTrumpArchiveCorpusFromPath parses the raw archive synchronously
    // (readFileSync + CSV/JSON parse). For the 31.7MB CSV this is ~1s of
    // uninterrupted work — it lives in trump.archive.ts (out of scope here) and
    // only runs on a background re-train, never at startup when a snapshot
    // exists. Every step after this yields to the event loop.
    const archiveRecords = loadTrumpArchiveCorpusFromPath(this.datasetPath);
    await yieldToEventLoop();

    const inferredCorpus = await buildInferredTrumpTrainingCorpus(archiveRecords);
    await yieldToEventLoop();

    const profile = await mergeTrumpScoringProfilesCooperative([
      await buildAnchorPhraseProfile(inferredCorpus),
      await buildTrumpScoringProfileCooperative(inferredCorpus),
    ]);

    const snapshot: TrumpTrainingSnapshot = {
      trainedAt: new Date().toISOString(),
      reason,
      datasetPath: this.datasetPath,
      archiveRecordCount: archiveRecords.length,
      inferredRecordCount: inferredCorpus.length,
      profile,
    };

    await mkdir(dirname(this.snapshotPath), { recursive: true });
    await writeFile(this.snapshotPath, JSON.stringify(snapshot, null, 2));

    this.lastSnapshot = snapshot;
    this.persistedProfile = profile;
    this.log.info('[TrumpTrainer] Background training snapshot updated', {
      reason,
      archiveRecordCount: snapshot.archiveRecordCount,
      inferredRecordCount: snapshot.inferredRecordCount,
      snapshotPath: this.snapshotPath,
    });

    return snapshot;
  }

  private loadSnapshot(): TrumpTrainingSnapshot | null {
    if (!existsSync(this.snapshotPath)) return null;

    try {
      const parsed = JSON.parse(readFileSync(this.snapshotPath, 'utf8')) as TrumpTrainingSnapshot;
      if (!parsed?.profile?.learnedBoosts) return null;
      return parsed;
    } catch (error) {
      this.log.warn('[TrumpTrainer] Failed to read persisted training snapshot', {
        error: error instanceof Error ? error.message : String(error),
        snapshotPath: this.snapshotPath,
      } as any);
      return null;
    }
  }
}

export function createTrumpTrainingService(options: TrumpTrainingServiceOptions = {}) {
  return new TrumpTrainingService(options);
}

export const trumpTrainingService = createTrumpTrainingService();
