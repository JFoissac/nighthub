import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import apiRoutes from './routes/api.routes';
import { prisma } from './db/prisma.client';
import { aggregatorService, trumpTrainingService, youtubeService } from './services/backend.runtime';

const app = express();

// Compression middleware
app.use(compression());

// CORS configuration with environment-based origins
app.use(cors({
  origin: config.cors.origins,
  credentials: config.cors.credentials,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  },
});

// Rate limiting - strict (for expensive operations)
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for this operation.' },
  handler: (req, res, next, options) => {
    logger.warn('Strict rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  },
});

// Apply general rate limiter to API routes
app.use('/api', generalLimiter);

// Health routes (no rate limiting needed)
app.use('/health', healthRoutes);

// Auth routes (apply strict limiter due to OAuth operations)
app.use('/api/auth', strictLimiter, authRoutes);

// API routes
app.use('/api', apiRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler
let isShuttingDown = false;
const connections = new Set<import('net').Socket>();

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  connections.forEach((socket) => {
    socket.destroy();
  });

  // Stop aggregator cron jobs
  aggregatorService.stop();
  trumpTrainingService.stop();

  // Close database connection
  await prisma.$disconnect();

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Database connected', { url: config.database.url });

    // Listen FIRST so the server accepts connections and /health responds
    // immediately. All heavy background work (cache pre-warm, Trump training,
    // aggregator refresh) is scheduled AFTER the server is listening.
    const server = app.listen(config.port, () => {
      logger.info('Server started', {
        port: config.port,
        env: config.nodeEnv,
        corsOrigins: config.cors.origins,
      });

      // --- Background tasks (never block boot or the event loop) ---
      youtubeService.cleanOrphanChannelIds().catch((e: unknown) => logger.error('Clean orphan channel IDs failed', e));

      // Fire-and-forget cache warm-up (skips itself when the DB cache is fresh)
      youtubeService.preWarmCache().catch((e: unknown) => logger.warn('Pre-warm failed', { error: e }));

      // Trump training: loads the persisted snapshot synchronously in its
      // constructor (fast), re-trains asynchronously in the background with
      // periodic yields — never freezes the event loop.
      trumpTrainingService.start();

      aggregatorService.refreshAll().catch((e: unknown) => logger.error('Aggregator initial data fetch failed', e));

      // Warm the dashboard snapshot in the background so the first page load
      // is served instantly from cache (the Angular dev server takes ~12s to
      // build anyway — the snapshot is ready by the time the browser connects).
      aggregatorService.getDashboardData().catch((e: unknown) => logger.warn('Dashboard pre-warm failed', { error: e }));

      aggregatorService.start();
      logger.info('Aggregator cron jobs started');
      logger.info('Background tasks scheduled (clean-orphans, pre-warm, trump training, aggregator)');
    });

    // Track connections for graceful shutdown
    server.on('connection', (socket) => {
      connections.add(socket);
      socket.on('close', () => {
        connections.delete(socket);
      });
    });

    // Apply strict rate limiter to expensive endpoints
    app.post('/api/refresh/all', strictLimiter);
    app.post('/api/refresh/twitch', strictLimiter);
    app.post('/api/auth/logout', strictLimiter);

  } catch (error) {
    logger.error('Server failed to start', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();

export default app;
