import cron from 'node-cron';
import { logger } from '../utils/logger';

type CronScheduler = {
  schedule: (expression: string, task: () => void) => { stop?: () => void } | void;
};

type CronDeps = {
  aggregatorService: {
    refreshAll: () => Promise<void>;
    refreshTwitch: () => Promise<void>;
    refreshTrump: () => Promise<void>;
  };
  youtubeService: {
    verifyAndCleanLiveStreams: () => Promise<void>;
  };
  shouldRun?: () => boolean;
  scheduler?: CronScheduler;
  log?: typeof logger;
};

export function createAggregatorCronJobs(deps: CronDeps) {
  const scheduler = deps.scheduler ?? cron;
  const log = deps.log ?? logger;
  const jobs: Array<{ stop?: () => void } | void> = [];
  const shouldRun = deps.shouldRun ?? (() => true);

  jobs.push(scheduler.schedule('*/30 * * * *', () => {
    if (!shouldRun()) return;
    log.info('Cron: Refreshing all data');
    deps.aggregatorService.refreshAll();
  }));

  jobs.push(scheduler.schedule('*/5 * * * *', () => {
    if (!shouldRun()) return;
    log.debug('Cron: Checking Twitch streams');
    deps.aggregatorService.refreshTwitch();
  }));

  jobs.push(scheduler.schedule('*/5 * * * *', () => {
    if (!shouldRun()) return;
    log.debug('Cron: Verifying YouTube live streams');
    deps.youtubeService.verifyAndCleanLiveStreams().catch((e) => log.error('Verify live streams failed', e));
  }));

  jobs.push(scheduler.schedule('*/15 * * * *', () => {
    if (!shouldRun()) return;
    log.debug('Cron: Refreshing Trump tweets');
    deps.aggregatorService.refreshTrump();
  }));

  log.info('Aggregator cron jobs initialized');

  return {
    stop() {
      for (const job of jobs) {
        job?.stop?.();
      }
    },
  };
}
