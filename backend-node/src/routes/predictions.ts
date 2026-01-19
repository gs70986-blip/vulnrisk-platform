import { Router } from 'express';
import * as predictionController from '../controllers/prediction.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// All prediction routes require authentication
router.use(authenticate);

// File upload configuration for batch prediction
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
    cb(null, 'batch-pred-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['.csv', '.json', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
    }
  },
});

router.post('/', predictionController.predict);
router.post('/batch', predictionController.batchPredict);
router.post('/batch/upload', upload.single('file'), predictionController.batchPredictFromFile);
router.get('/export', predictionController.exportPredictions);
router.get('/', predictionController.getPredictions);
router.get('/:id', predictionController.getPredictionById);

export default router;







