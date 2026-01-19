import app from './app';
import { config } from './config';
import { ensureDirectories } from './utils/ensureDirs';

const PORT = config.port;

// Ensure necessary directories exist
ensureDirectories().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`ML Service URL: ${config.mlServiceUrl}`);
  });
}).catch((error) => {
  console.error('Failed to ensure directories:', error);
  process.exit(1);
});

