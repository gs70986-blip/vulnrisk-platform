import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import prisma from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check ML service
    let mlServiceHealthy = false;
    try {
      const response = await axios.get(`${config.mlServiceUrl}/health`, { timeout: 5000 });
      mlServiceHealthy = response.status === 200;
    } catch (error) {
      // ML service might be down
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        mlService: mlServiceHealthy ? 'ok' : 'unavailable',
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      error: error.message,
    });
  }
});

export default router;

















