import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';

import authRoutes from './routes/auth';
import datasetRoutes from './routes/datasets';
import modelRoutes from './routes/models';
import predictionRoutes from './routes/predictions';
import healthRoutes from './routes/health';
import githubRoutes from './routes/github';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/github', githubRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'VulnRisk API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      datasets: '/api/datasets',
      models: '/api/models',
      predictions: '/api/predictions',
      health: '/api/health',
      github: '/api/github',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

export default app;








