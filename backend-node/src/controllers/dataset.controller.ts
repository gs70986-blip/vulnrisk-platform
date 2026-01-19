import { Request, Response } from 'express';
import { DatasetService } from '../services/dataset.service';

const datasetService = new DatasetService();

export const uploadDataset = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const name = req.body.name || file.originalname;
    const fileType = file.mimetype === 'application/json' ? 'json' : 'csv';

    const dataset = await datasetService.uploadDataset(name, file.path, fileType);

    res.status(201).json(dataset);
  } catch (error: any) {
    console.error('Error uploading dataset:', error);
    res.status(500).json({ error: error.message || 'Failed to upload dataset' });
  }
};

export const getDatasets = async (req: Request, res: Response) => {
  try {
    const datasets = await datasetService.getDatasets();
    res.json(datasets);
  } catch (error: any) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch datasets' });
  }
};

export const getDatasetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dataset = await datasetService.getDatasetById(id);
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json(dataset);
  } catch (error: any) {
    console.error('Error fetching dataset:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dataset' });
  }
};

export const preprocessDataset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await datasetService.preprocessDataset(id);
    res.json(result);
  } catch (error: any) {
    console.error('Error preprocessing dataset:', error);
    res.status(500).json({ error: error.message || 'Failed to preprocess dataset' });
  }
};

















