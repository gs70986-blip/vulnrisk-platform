import { Request, Response } from 'express';
import { ModelService } from '../services/model.service';

const modelService = new ModelService();

export const trainModel = async (req: Request, res: Response) => {
  try {
    const { datasetId, modelType, useSmote, testSize, randomState } = req.body;

    if (!datasetId || !modelType) {
      return res.status(400).json({ error: 'datasetId and modelType are required' });
    }

    if (!['RandomForest', 'XGBoost'].includes(modelType)) {
      return res.status(400).json({ error: 'modelType must be RandomForest or XGBoost' });
    }

    const model = await modelService.trainModel({
      datasetId,
      modelType,
      useSmote,
      testSize,
      randomState,
    });

    res.status(201).json(model);
  } catch (error: any) {
    console.error('Error training model:', error);
    res.status(500).json({ error: error.message || 'Failed to train model' });
  }
};

export const getModels = async (req: Request, res: Response) => {
  try {
    const models = await modelService.getModels();
    res.json(models);
  } catch (error: any) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch models' });
  }
};

export const getModelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const model = await modelService.getModelById(id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json(model);
  } catch (error: any) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch model' });
  }
};

export const activateModel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const model = await modelService.activateModel(id);
    res.json(model);
  } catch (error: any) {
    console.error('Error activating model:', error);
    res.status(500).json({ error: error.message || 'Failed to activate model' });
  }
};

















