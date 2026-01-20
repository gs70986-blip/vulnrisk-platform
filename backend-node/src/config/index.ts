import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vulnrisk',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  jwtSecret: (process.env.JWT_SECRET || 'your-secret-key-change-in-production') as string,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  // Note: AUTO_APPEND_TRAINING_DATA feature has been removed to prevent model pollution
};








