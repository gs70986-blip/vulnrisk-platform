import { Router } from 'express';
import * as modelController from '../controllers/model.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All model routes require authentication (both admin and regular users can access)
// Note: Models are pre-trained by the system, so all authenticated users should be able to view and activate them
router.use(authenticate);

router.post('/train', modelController.trainModel);
router.get('/', modelController.getModels);
router.get('/:id', modelController.getModelById);
router.post('/:id/activate', modelController.activateModel);

export default router;








