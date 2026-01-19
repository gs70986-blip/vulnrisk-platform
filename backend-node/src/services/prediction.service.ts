import prisma from '../db';
import axios from 'axios';
import { config } from '../config';
import path from 'path';
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { DatasetService } from './dataset.service';

export interface PredictionInput {
  sample_id: string;
  text_description: string;
  cvss_base_score?: number;
}

export interface BatchPredictionInput {
  samples: PredictionInput[];
}

export class PredictionService {
  private datasetService: DatasetService;

  constructor() {
    this.datasetService = new DatasetService();
  }

  async predict(input: PredictionInput, modelId?: string) {
    // Get active model if not specified
    let model;
    if (modelId) {
      model = await prisma.mLModel.findUnique({ where: { id: modelId } });
    } else {
      model = await prisma.mLModel.findFirst({ where: { isActive: true } });
    }

    if (!model) {
      throw new Error('No active model found. Please activate a model first.');
    }

    // Call ML service for prediction and risk calculation
    const mlRequest = {
      model_path: model.artifactPath,
      sample: {
        sample_id: input.sample_id,
        text_description: input.text_description,
        cvss_base_score: input.cvss_base_score,
      },
    };

    try {
      const response = await axios.post(`${config.mlServiceUrl}/predict`, mlRequest);

      const { p_vuln, risk_score, risk_level, cvss_base_score, explanation, meta } = response.data;

      // 使用 ML 服务返回的 CVSS（如果输入为空，ML 服务会返回估算值）
      const finalCvss = cvss_base_score ?? input.cvss_base_score;

      // Save prediction to database
      const prediction = await prisma.prediction.create({
        data: {
          modelId: model.id,
          sampleId: input.sample_id,
          textDescription: input.text_description,
          pVuln: p_vuln,
          cvss: finalCvss,  // 使用 ML 服务返回的 CVSS（包含估算值）
          riskScore: risk_score,
          riskLevel: risk_level,
          explanation: explanation || null,  // 保存 explanation 到数据库
          metadata: meta ? meta : null,  // 保存 meta 到数据库（JSON 字段）
        },
      });

      // Append input data to training dataset
      // IMPORTANT: Only append if AUTO_APPEND_TRAINING_DATA=true to prevent feedback loop pollution
      // Also skip if riskLevel is N/A/Uncertain or gatingReason indicates low similarity/OOD
      if (config.autoAppendTrainingData) {
        const gatingReason = meta?.reason;
        const shouldAppend = risk_level !== 'N/A' && 
                            risk_level !== 'Uncertain' && 
                            gatingReason !== 'LOW_SIMILARITY' && 
                            gatingReason !== 'OOD';
        
        if (shouldAppend) {
          try {
            await this.datasetService.appendToTrainingDataset({
              sample_id: input.sample_id,
              text_description: input.text_description,
              cvss_base_score: input.cvss_base_score,
              label: p_vuln > 0.5 ? 1 : 0,
            });
          } catch (error) {
            // Log error but don't fail the prediction if dataset append fails
            console.error('Failed to append to training dataset:', error);
          }
        } else {
          console.log(`Skipping training data append: riskLevel=${risk_level}, gatingReason=${gatingReason}`);
        }
      }

      // explanation 和 meta 已经存储在数据库中，直接返回即可
      return prediction;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`ML Service error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async batchPredict(input: BatchPredictionInput, modelId?: string) {
    // Get active model if not specified
    let model;
    if (modelId) {
      model = await prisma.mLModel.findUnique({ where: { id: modelId } });
    } else {
      model = await prisma.mLModel.findFirst({ where: { isActive: true } });
    }

    if (!model) {
      throw new Error('No active model found. Please activate a model first.');
    }

    // Call ML service for batch prediction
    const mlRequest = {
      model_path: model.artifactPath,
      samples: input.samples,
    };

    try {
      const response = await axios.post(`${config.mlServiceUrl}/predict/batch`, mlRequest, {
        timeout: 300000, // 5 minutes timeout
      });

      const predictions = response.data.predictions;

      // Save all predictions to database
      const savedPredictions = await Promise.all(
        predictions.map((pred: any) =>
          prisma.prediction.create({
            data: {
              modelId: model!.id,
              sampleId: pred.sample_id,
              textDescription: pred.text_description,
              pVuln: pred.p_vuln,
              cvss: pred.cvss_base_score ?? undefined,  // 使用 ML 服务返回的 CVSS（包含估算值）
              riskScore: pred.risk_score,
              riskLevel: pred.risk_level,
              explanation: pred.explanation || null,  // 保存 explanation 到数据库
              metadata: pred.meta ? pred.meta : null,  // 保存 meta 到数据库（JSON 字段）
            },
          })
        )
      );

      // Append all input samples to training dataset
      // IMPORTANT: Only append if AUTO_APPEND_TRAINING_DATA=true to prevent feedback loop pollution
      // Also skip samples where riskLevel is N/A/Uncertain or gatingReason indicates low similarity/OOD
      if (config.autoAppendTrainingData) {
        try {
          await Promise.all(
            input.samples.map((sample, index) => {
              const pred = predictions[index];
              const gatingReason = pred.meta?.reason;
              const shouldAppend = pred.risk_level !== 'N/A' && 
                                  pred.risk_level !== 'Uncertain' && 
                                  gatingReason !== 'LOW_SIMILARITY' && 
                                  gatingReason !== 'OOD';
              
              if (shouldAppend) {
                return this.datasetService.appendToTrainingDataset({
                  sample_id: sample.sample_id,
                  text_description: sample.text_description,
                  cvss_base_score: sample.cvss_base_score,
                  label: pred.p_vuln > 0.5 ? 1 : 0,
                });
              } else {
                console.log(`Skipping training data append for sample ${sample.sample_id}: riskLevel=${pred.risk_level}, gatingReason=${gatingReason}`);
                return Promise.resolve();
              }
            })
          );
        } catch (error) {
          // Log error but don't fail the batch prediction if dataset append fails
          console.error('Failed to append to training dataset:', error);
        }
      }

      return savedPredictions;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`ML Service error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async getPredictions(limit: number = 100, offset: number = 0) {
    const [data, total] = await Promise.all([
      prisma.prediction.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          model: {
            select: {
              id: true,
              type: true,
            },
          },
        },
      }),
      prisma.prediction.count(),
    ]);

    // 将 metadata 映射为 meta，以匹配前端和 ML 服务的响应格式
    const dataWithMeta = data.map((pred: any) => ({
      ...pred,
      meta: pred.metadata || null,  // 将 metadata 映射为 meta
    }));

    return {
      data: dataWithMeta,
      total,
    };
  }

  async getPredictionById(id: string) {
    return prisma.prediction.findUnique({
      where: { id },
      include: {
        model: true,
      },
    });
  }

  async getPredictionsByModelId(modelId: string, limit: number = 100, offset: number = 0) {
    return prisma.prediction.findMany({
      where: { modelId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllPredictionsForExport(limit?: number, offset?: number) {
    const predictions = await prisma.prediction.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        model: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    return predictions.map((pred) => ({
      id: pred.id,
      sampleId: pred.sampleId,
      textDescription: pred.textDescription || '',
      pVuln: pred.pVuln,
      cvss: pred.cvss,
      riskScore: pred.riskScore,
      riskLevel: pred.riskLevel,
      modelType: pred.model?.type || 'Unknown',
      createdAt: pred.createdAt.toISOString(),
    }));
  }

  async exportToCSV(predictions: any[]): Promise<string> {
    if (predictions.length === 0) {
      return 'ID,Sample ID,Text Description,P(vuln),CVSS,Risk Score,Risk Level,Model Type,Created At\n';
    }

    const headers = ['ID', 'Sample ID', 'Text Description', 'P(vuln)', 'CVSS', 'Risk Score', 'Risk Level', 'Model Type', 'Created At'];
    const rows = predictions.map((pred) => {
      const escapeCSV = (str: any) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      return [
        escapeCSV(pred.id),
        escapeCSV(pred.sampleId),
        escapeCSV(pred.textDescription),
        escapeCSV(pred.pVuln?.toFixed(4) || ''),
        escapeCSV(pred.cvss?.toFixed(1) || ''),
        escapeCSV(pred.riskScore?.toFixed(4) || ''),
        escapeCSV(pred.riskLevel),
        escapeCSV(pred.modelType),
        escapeCSV(pred.createdAt),
      ].join(',');
    });

    return headers.join(',') + '\n' + rows.join('\n');
  }

  async exportToExcel(predictions: any[]): Promise<Buffer> {
    const XLSX = require('xlsx');
    
    const data = predictions.map((pred) => ({
      'ID': pred.id,
      'Sample ID': pred.sampleId,
      'Text Description': pred.textDescription || '',
      'P(vuln)': pred.pVuln?.toFixed(4) || '',
      'CVSS': pred.cvss?.toFixed(1) || '',
      'Risk Score': pred.riskScore?.toFixed(4) || '',
      'Risk Level': pred.riskLevel,
      'Model Type': pred.modelType,
      'Created At': pred.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Predictions');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportToJSON(predictions: any[]): Promise<string> {
    return JSON.stringify(predictions, null, 2);
  }

  async parseFileToSamples(filePath: string, originalName: string): Promise<PredictionInput[]> {
    const ext = path.extname(originalName).toLowerCase();
    let samples: any[] = [];

    try {
      if (ext === '.json') {
        // Parse JSON file
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // Handle both { "samples": [...] } and [...] formats
        if (Array.isArray(data)) {
          samples = data;
        } else if (data.samples && Array.isArray(data.samples)) {
          samples = data.samples;
        } else {
          throw new Error('Invalid JSON format. Expected array or { "samples": [...] }');
        }
      } else if (ext === '.csv') {
        // Parse CSV file
        const content = await fs.readFile(filePath, 'utf-8');
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          cast: (value, context) => {
            // Try to cast to number for cvss_base_score
            if (context.column === 'cvss_base_score' && value) {
              const num = parseFloat(value);
              return isNaN(num) ? undefined : num;
            }
            return value;
          },
        });
        samples = records;
      } else if (ext === '.xlsx' || ext === '.xls') {
        // Parse Excel file
        try {
          const XLSX = require('xlsx');
          const workbook = XLSX.readFile(filePath);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          samples = XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
          throw new Error('Failed to parse Excel file. Please ensure the file is a valid Excel file.');
        }
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      // Validate and normalize samples
      const validSamples: PredictionInput[] = [];
      for (const sample of samples) {
        // Try to find sample_id and text_description fields (case-insensitive)
        const sampleId = sample.sample_id || sample.sampleId || sample['Sample ID'] || sample['sample ID'] || sample.id || sample.ID;
        const textDescription = sample.text_description || sample.textDescription || sample['Text Description'] || sample['text description'] || sample.description || sample.Description;
        const cvssBaseScore = sample.cvss_base_score !== undefined ? sample.cvss_base_score : 
                             (sample.cvssBaseScore !== undefined ? sample.cvssBaseScore :
                             (sample['CVSS Base Score'] !== undefined ? sample['CVSS Base Score'] :
                             (sample['cvss base score'] !== undefined ? sample['cvss base score'] :
                             (sample.cvss !== undefined ? sample.cvss : undefined))));

        if (sampleId && textDescription) {
          validSamples.push({
            sample_id: String(sampleId),
            text_description: String(textDescription),
            cvss_base_score: cvssBaseScore !== undefined ? parseFloat(String(cvssBaseScore)) : undefined,
          });
        }
      }

      if (validSamples.length === 0) {
        throw new Error('No valid samples found. Each row must have sample_id (or id) and text_description (or description) fields.');
      }

      return validSamples;
    } catch (error: any) {
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }
}

