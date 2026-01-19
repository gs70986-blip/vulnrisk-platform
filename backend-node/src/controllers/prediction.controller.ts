import { Request, Response } from 'express';
import { PredictionService } from '../services/prediction.service';

const predictionService = new PredictionService();

export const predict = async (req: Request, res: Response) => {
  try {
    const { sample_id, text_description, cvss_base_score, modelId } = req.body;

    if (!sample_id || !text_description) {
      return res.status(400).json({ error: 'sample_id and text_description are required' });
    }

    const prediction = await predictionService.predict(
      {
        sample_id,
        text_description,
        cvss_base_score,
      },
      modelId
    );

    res.json(prediction);
  } catch (error: any) {
    console.error('Error making prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to make prediction' });
  }
};

export const batchPredict = async (req: Request, res: Response) => {
  try {
    const { samples, modelId } = req.body;

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ error: 'samples array is required and must not be empty' });
    }

    // Validate each sample
    for (const sample of samples) {
      if (!sample.sample_id || !sample.text_description) {
        return res.status(400).json({ error: 'Each sample must have sample_id and text_description' });
      }
    }

    const predictions = await predictionService.batchPredict({ samples }, modelId);

    res.json({ predictions, count: predictions.length });
  } catch (error: any) {
    console.error('Error making batch prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to make batch prediction' });
  }
};

export const getPredictions = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await predictionService.getPredictions(limit, offset);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch predictions' });
  }
};

export const getPredictionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prediction = await predictionService.getPredictionById(id);
    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    res.json(prediction);
  } catch (error: any) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch prediction' });
  }
};

export const batchPredictFromFile = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { modelId } = req.body;
    const samples = await predictionService.parseFileToSamples(file.path, file.originalname);

    if (samples.length === 0) {
      return res.status(400).json({ error: 'No valid samples found in file' });
    }

    const predictions = await predictionService.batchPredict({ samples }, modelId);

    // Clean up uploaded file
    try {
      const fs = require('fs');
      fs.unlinkSync(file.path);
    } catch (err) {
      console.warn('Failed to delete uploaded file:', err);
    }

    res.json({ predictions, count: predictions.length });
  } catch (error: any) {
    console.error('Error making batch prediction from file:', error);
    res.status(500).json({ error: error.message || 'Failed to make batch prediction from file' });
  }
};

export const exportPredictions = async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv'; // csv, excel, json
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

    // Get all predictions for export
    const predictions = await predictionService.getAllPredictionsForExport(limit, offset);

    if (predictions.length === 0) {
      return res.status(404).json({ error: 'No predictions found to export' });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let filename: string;
    let contentType: string;
    let data: string | Buffer;

    switch (format.toLowerCase()) {
      case 'csv':
        filename = `predictions_${timestamp}.csv`;
        contentType = 'text/csv';
        data = await predictionService.exportToCSV(predictions);
        break;

      case 'excel':
      case 'xlsx':
        filename = `predictions_${timestamp}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        data = await predictionService.exportToExcel(predictions);
        break;

      case 'json':
        filename = `predictions_${timestamp}.json`;
        contentType = 'application/json';
        data = await predictionService.exportToJSON(predictions);
        break;

      default:
        return res.status(400).json({ error: 'Invalid format. Supported formats: csv, excel, json' });
    }

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8'));

    // Send file
    res.send(data);
  } catch (error: any) {
    console.error('Error exporting predictions:', error);
    res.status(500).json({ error: error.message || 'Failed to export predictions' });
  }
};







