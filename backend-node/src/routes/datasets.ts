import { Router } from 'express';
import * as datasetController from '../controllers/dataset.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// All dataset routes require admin access
router.use(authenticate);
router.use(requireAdmin);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json', 'application/vnd.ms-excel'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and JSON files are allowed.'));
    }
  },
});

router.post('/', upload.single('file'), datasetController.uploadDataset);
router.get('/', datasetController.getDatasets);
router.get('/:id', datasetController.getDatasetById);
router.post('/:id/preprocess', datasetController.preprocessDataset);

export default router;








