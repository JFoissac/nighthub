import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAggregatorCronJobs } from './aggregator.cron';

describe('createAggregatorCronJobs', () => {
  const schedule = vi.fn();
  const stop = vi.fn();
  const logger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;

  const aggregatorService = {
    refreshAll: vi.fn().mockResolvedValue(undefined),
    refreshTwitch: vi.fn().mockResolvedValue(undefined),
    refreshTrump: vi.fn().mockResolvedValue(undefined),
  };

  const youtubeService = {
    verifyAndCleanLiveStreams: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    schedule.mockImplementation((_expression: string, task: () => void) => ({ stop, task }));
  });

  it('registers the expected cron expressions and callbacks', async () => {
    const jobs = createAggregatorCronJobs({
      aggregatorService,
      youtubeService,
      scheduler: { schedule },
      log: logger,
      shouldRun: () => true,
    });

    expect(schedule.mock.calls.map(([expression]) => expression)).toEqual([
      '*/30 * * * *',
      '*/5 * * * *',
      '*/5 * * * *',
      '*/15 * * * *',
    ]);
    expect(logger.info).toHaveBeenCalledWith('Aggregator cron jobs initialized');

    const callbacks = schedule.mock.calls.map(([, task]) => task as () => void);
    callbacks[0]();
    callbacks[1]();
    callbacks[2]();
    callbacks[3]();

    expect(aggregatorService.refreshAll).toHaveBeenCalledTimes(1);
    expect(aggregatorService.refreshTwitch).toHaveBeenCalledTimes(1);
    expect(youtubeService.verifyAndCleanLiveStreams).toHaveBeenCalledTimes(1);
    expect(aggregatorService.refreshTrump).toHaveBeenCalledTimes(1);

    jobs.stop();
    expect(stop).toHaveBeenCalled();
  });

  it('skips work when shouldRun returns false', () => {
    createAggregatorCronJobs({
      aggregatorService,
      youtubeService,
      scheduler: { schedule },
      log: logger,
      shouldRun: () => false,
    });

    const callbacks = schedule.mock.calls.map(([, task]) => task as () => void);
    for (const callback of callbacks) {
      callback();
    }

    expect(aggregatorService.refreshAll).not.toHaveBeenCalled();
    expect(aggregatorService.refreshTwitch).not.toHaveBeenCalled();
    expect(youtubeService.verifyAndCleanLiveStreams).not.toHaveBeenCalled();
    expect(aggregatorService.refreshTrump).not.toHaveBeenCalled();
  });
});
