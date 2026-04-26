import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import apiRoutes from './routes/api.routes';
import { prisma } from './db/prisma.client';
import { aggregatorService } from './services/aggregator.service';
import { youtubeService } from './services/youtube.service';

const app = express();

app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('[Database] Connected to SQLite');

    youtubeService.cleanOrphanChannelIds().catch(console.error);
    aggregatorService.refreshAll();
    console.log('[Aggregator] Initial data fetch started');

    app.listen(config.port, () => {
      console.log(`[Server] Running on http://localhost:${config.port}`);
      console.log(`[Environment] ${config.nodeEnv}`);
      aggregatorService.start();
      console.log('[Aggregator] Cron jobs started');
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;