import prisma from '../db';
import axios from 'axios';
import { config } from '../config';
import path from 'path';
import fs from 'fs/promises';

export interface TrainRequest {
  datasetId: string;
  modelType: 'RandomForest' | 'XGBoost';
  useSmote?: boolean;
  testSize?: number;
  randomState?: number;
}

export class ModelService {
  async trainModel(request: TrainRequest) {
    // Get dataset info
    const dataset = await prisma.dataset.findUnique({
      where: { id: request.datasetId },
    });

    if (!dataset) {
      throw new Error('Dataset not found');
    }

    // Use absolute path that ML service can access
    const dataFile = `/app/data/${request.datasetId}/data.json`;

    // Call ML service to train
    const mlRequest = {
      dataset_path: dataFile,
      model_type: request.modelType,
      use_smote: request.useSmote ?? false,
      test_size: request.testSize ?? 0.2,
      random_state: request.randomState ?? 42,
    };

    try {
      const response = await axios.post(`${config.mlServiceUrl}/train`, mlRequest, {
        timeout: 300000, // 5 minutes timeout for training
      });

      const { model_id, metrics, artifact_path, metadata } = response.data;

      // Save model metadata to database
      // Use model_id from ML service if provided, otherwise generate one
      const model = await prisma.mLModel.create({
        data: {
          id: model_id || undefined, // Let Prisma generate if not provided
          type: request.modelType,
          metrics: metrics || {},
          artifactPath: artifact_path || '',
          metadata: metadata || {},
        },
      });

      return model;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`ML Service error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async getModels() {
    return prisma.mLModel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    });
  }

  async getModelById(id: string) {
    return prisma.mLModel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    });
  }

  async activateModel(id: string) {
    // Deactivate all other models first
    await prisma.mLModel.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Activate the selected model
    return prisma.mLModel.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getActiveModel() {
    return prisma.mLModel.findFirst({
      where: { isActive: true },
    });
  }
}

