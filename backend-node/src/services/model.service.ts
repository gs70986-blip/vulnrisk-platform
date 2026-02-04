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
    const allModels = await prisma.mLModel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    });

    // 过滤掉 Stage B 严重度模型（不在前端显示）
    return allModels.filter(model => {
      const metadata = model.metadata as any;
      const isSeverityModel = metadata?.model_function === 'severity' || 
                             model.id.startsWith('sev_model_');
      return !isSeverityModel;
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
    // 检查要激活的模型是否是 Stage B 严重度模型
    const targetModel = await prisma.mLModel.findUnique({
      where: { id },
    });

    if (!targetModel) {
      throw new Error(`Model not found: ${id}`);
    }

    // 检查是否是 Stage B 严重度模型（通过 metadata.model_function 或 id 判断）
    const metadata = targetModel.metadata as any;
    const isSeverityModel = metadata?.model_function === 'severity' || 
                           targetModel.id.startsWith('sev_model_');

    if (isSeverityModel) {
      throw new Error('Severity models (Stage B) cannot be activated/deactivated manually. They are always active.');
    }

    // Deactivate all other models first (但保留 Stage B 严重度模型激活)
    await prisma.mLModel.updateMany({
      where: { 
        isActive: true,
        // 排除 Stage B 严重度模型
        NOT: {
          OR: [
            { id: { startsWith: 'sev_model_' } },
            // 也可以通过 metadata 判断
          ]
        }
      },
      data: { isActive: false },
    });

    // 同时确保所有 Stage B 严重度模型保持激活
    await prisma.mLModel.updateMany({
      where: {
        OR: [
          { id: { startsWith: 'sev_model_' } },
        ]
      },
      data: { isActive: true },
    });

    // Activate the selected model
    return prisma.mLModel.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getActiveModel() {
    // 获取激活的 Stage A 模型（适用性模型）
    return prisma.mLModel.findFirst({
      where: { 
        isActive: true,
        // 排除 Stage B 严重度模型
        NOT: {
          OR: [
            { id: { startsWith: 'sev_model_' } },
          ]
        }
      },
    });
  }

  async getActiveSeverityModel() {
    // 获取激活的 Stage B 严重度模型（应该始终有一个激活）
    return prisma.mLModel.findFirst({
      where: { 
        isActive: true,
        OR: [
          { id: { startsWith: 'sev_model_' } },
        ]
      },
    });
  }
}

