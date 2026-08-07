import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Health check failed - DB unreachable', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

export default router;