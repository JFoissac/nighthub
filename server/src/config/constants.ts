// Timeouts (in milliseconds)
export const TIMEOUTS = {
  SSE: 45_000,
  FETCH: 30_000,
  GQL: 10_000,
  RSS_PARSER: 10_000,
  PIPED_STREAM: 5_000,
  YOUTUBE_WATCH_PAGE: 5_000,
  NETWORK_RETRY_COOLDOWN: 2 * 60 * 1000,
} as const;

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  LIVE_SYNC: 2 * 60 * 1000,
  LIGHT_REFRESH: 5 * 60 * 1000,
  FETCH: 5 * 60 * 1000,
  LIVE_CACHE_MAX_AGE: 15 * 60 * 1000,
} as const;

// Fetch settings
export const FETCH_CONCURRENCY = 20;
export const FETCH_BATCH_DELAY_MS = 1200;
export const RESOLVE_BATCH_CONCURRENCY = 8;
export const PIPED_BATCH_CONCURRENCY = 10;
export const YOUTUBE_VIDEO_BATCH_SIZE = 50;

// SSE heartbeat
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000; // Initial interval
export const SSE_HEARTBEAT_MAX_INTERVAL_MS = 120_000; // Max interval (backoff cap)

// Retry backoff for handle resolution (in ms)
export const HANDLE_RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

// Network failure threshold for circuit breaker
export const RESOLVE_NETWORK_FAILURE_THRESHOLD = 8;
export const RESOLVE_LOG_INTERVAL_MS = 30_000;
export const RESOLVE_NETWORK_COOLDOWN_MS = 2 * 60 * 1000;

// RSS retry delays (in ms)
export const RSS_RETRY_DELAYS = [1_000, 2_000, 4_000];
export const RSS_MAX_RETRIES = 3;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Relevance scoring
export const RELEVANCE = {
  MAX_AGE_VIDEO_HOURS: 168, // 7 days
  MAX_AGE_NEWS_HOURS: 1,
  MAX_AGE_STREAM_HOURS: 48,
  MAX_AGE_TRUMP_HOURS: 12,
  MAX_AGE_DEFAULT_HOURS: 24,
  RECENCY_WEIGHT: 0.5,
  ENGAGEMENT_WEIGHT: 0.3,
  BASE_SCORE: 0.2,
} as const;
