import { Router } from 'express';
import * as githubController from '../controllers/github.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All GitHub routes require authentication
router.use(authenticate);

router.post('/fetch', githubController.fetchGitHubContent);
router.post('/fetch-batch', githubController.batchFetchGitHubContent);

export default router;

