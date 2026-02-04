import prisma from '../db';
import axios from 'axios';
import { config } from '../config';
import path from 'path';
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

export interface PredictionInput {
  sample_id: string;
  text_description: string;
  cvss_base_score?: number;
}

export interface BatchPredictionInput {
  samples: PredictionInput[];
}

export class PredictionService {

  async predict(input: PredictionInput, modelId?: string) {
    // Get active Stage A model if not specified (排除 Stage B 严重度模型)
    let model;
    if (modelId) {
      model = await prisma.mLModel.findUnique({ where: { id: modelId } });
    } else {
      model = await prisma.mLModel.findFirst({ 
        where: { 
          isActive: true,
          NOT: {
            OR: [
              { id: { startsWith: 'sev_model_' } },
            ]
          }
        } 
      });
    }

    if (!model) {
      throw new Error('No active Stage A (applicability) model found. Please activate a model first.');
    }

    // Call ML service for prediction and risk calculation
    // 强制使用两阶段预测：传递 app_model_path 和 sev_model_path
    // 从 model.artifactPath 提取模型路径（如果是 Stage A 模型）
    const appModelPath = model.artifactPath;  // Stage A 模型路径
    const sevModelPath = '/app/models/sev_model_001';  // Stage B 模型路径（固定）
    
    const mlRequest = {
      // 不再传递 model_path，改为传递两阶段模型路径
      app_model_path: appModelPath,
      sev_model_path: sevModelPath,
      app_threshold: 0.5,  // 默认阈值
      sample: {
        sample_id: input.sample_id,
        text_description: input.text_description,
        cvss_base_score: input.cvss_base_score,
      },
    };

    try {
      const response = await axios.post(`${config.mlServiceUrl}/predict`, mlRequest);

      const { 
        p_vuln, 
        p_vuln_raw,  // 原始预测值
        risk_score, 
        risk_level, 
        cvss_base_score, 
        explanation, 
        meta,
        is_clipped,  // 是否被裁剪
        reliability,  // 可靠性
        warnings,  // 警告信息
        // 两阶段模型新字段
        pApplicable,
        applicable,
        severityLevel,
        severityProbs,
        riskScore: two_stage_risk_score,
      } = response.data;

      // 使用 ML 服务返回的 CVSS（如果输入为空，ML 服务会返回估算值）
      const finalCvss = cvss_base_score ?? input.cvss_base_score;
      
      // 优先使用两阶段模型的字段，否则使用旧字段
      const finalRiskScore = two_stage_risk_score ?? risk_score ?? 0;
      const finalRiskLevel = severityLevel ?? (risk_level === 'N/A' ? 'Unknown' : risk_level);
      const finalPVuln = p_vuln ?? (severityProbs ? 
        (severityProbs.High || 0) + (severityProbs.Critical || 0) : 
        p_vuln);

      // 构建扩展的metadata，包含新字段
      const extendedMeta = {
        ...(meta || {}),
        p_vuln_raw: p_vuln_raw,  // 原始预测值
        is_clipped: is_clipped || false,  // 是否被裁剪
        reliability: reliability || 'Medium',  // 可靠性
        warnings: warnings || [],  // 警告信息
        // 两阶段模型字段
        pApplicable: pApplicable ?? null,
        applicable: applicable ?? true,
        severityLevel: severityLevel ?? null,
        severityProbs: severityProbs ?? null,
      };

      // Save prediction to database
      const prediction = await prisma.prediction.create({
        data: {
          modelId: model.id,
          sampleId: input.sample_id,
          textDescription: input.text_description,
          pVuln: finalPVuln,
          cvss: finalCvss,  // 使用 ML 服务返回的 CVSS（包含估算值）
          riskScore: finalRiskScore,  // 如果为null，使用0（向后兼容）
          riskLevel: finalRiskLevel,  // 将N/A映射为Unknown
          explanation: explanation || null,  // 保存 explanation 到数据库
          metadata: extendedMeta,  // 保存扩展的meta到数据库（JSON 字段）
        },
      });

      // 返回时添加新字段到响应中（用于前端直接访问）
      return {
        ...prediction,
        pVulnRaw: p_vuln_raw,
        isClipped: is_clipped || false,
        reliability: reliability || response.data.reliability || 'Medium',
        warnings: warnings || [],
        // 两阶段模型字段
        pApplicable: pApplicable ?? null,
        applicable: applicable ?? true,
        severityLevel: severityLevel ?? null,
        severityProbs: severityProbs ?? null,
        // 系统级处理字段
        notes: response.data.notes || null,
        inputType: response.data.inputType || 'normal',
        modelInfo: response.data.modelInfo || null,
        meta: extendedMeta,  // 同时提供meta字段（向后兼容）
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`ML Service error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async batchPredict(input: BatchPredictionInput, modelId?: string) {
    // Get active Stage A model if not specified (排除 Stage B 严重度模型)
    let model;
    if (modelId) {
      model = await prisma.mLModel.findUnique({ where: { id: modelId } });
    } else {
      // 获取激活的 Stage A 模型（排除 Stage B 严重度模型）
      model = await prisma.mLModel.findFirst({ 
        where: { 
          isActive: true,
          NOT: {
            OR: [
              { id: { startsWith: 'sev_model_' } },
            ]
          }
        } 
      });
    }

    if (!model) {
      throw new Error('No active Stage A (applicability) model found. Please activate a model first.');
    }

    // Call ML service for batch prediction
    // 强制使用两阶段预测：传递 app_model_path 和 sev_model_path
    const appModelPath = model.artifactPath;  // Stage A 模型路径
    const sevModelPath = '/app/models/sev_model_001';  // Stage B 模型路径（固定）
    
    const mlRequest = {
      // 不再传递 model_path，改为传递两阶段模型路径
      app_model_path: appModelPath,
      sev_model_path: sevModelPath,
      app_threshold: 0.5,  // 默认阈值
      samples: input.samples,
    };

    try {
      const response = await axios.post(`${config.mlServiceUrl}/predict/batch`, mlRequest, {
        timeout: 300000, // 5 minutes timeout
      });

      const predictions = response.data.predictions;

      // Save all predictions to database
      const savedPredictions = await Promise.all(
        predictions.map((pred: any) => {
          // 构建扩展的metadata
          const extendedMeta = {
            ...(pred.meta || {}),
            p_vuln_raw: pred.p_vuln_raw ?? pred.pApplicable ?? null,
            is_clipped: pred.is_clipped || false,
            reliability: pred.reliability || 'Medium',
            warnings: pred.warnings || [],
            // 两阶段模型字段
            pApplicable: pred.pApplicable ?? null,
            applicable: pred.applicable ?? true,
            severityLevel: pred.severityLevel ?? null,
            severityProbs: pred.severityProbs ?? null,
          };

          // 计算 pVuln：优先使用 pVuln，否则从 severityProbs 计算（High + Critical 的概率），最后使用 pApplicable
          const finalPVuln = pred.pVuln ?? pred.p_vuln ?? (pred.severityProbs ? 
            ((pred.severityProbs.High || 0) + (pred.severityProbs.Critical || 0)) : 
            (pred.pApplicable ?? 0.5));

          // 获取 riskScore 和 riskLevel：优先使用两阶段模型的字段
          const finalRiskScore = pred.riskScore ?? pred.risk_score ?? 0;
          const finalRiskLevel = pred.riskLevel ?? pred.severityLevel ?? 
            (pred.risk_level === 'N/A' || pred.risk_level === 'Unknown' ? 'Unknown' : pred.risk_level) ?? 
            'Unknown';

          // 获取 textDescription：从原始样本中获取
          const originalSample = input.samples.find((s: any) => s.sample_id === pred.sample_id);
          const textDescription = pred.text_description ?? originalSample?.text_description ?? null;

          return prisma.prediction.create({
            data: {
              modelId: model!.id,
              sampleId: pred.sample_id,
              textDescription: textDescription,
              pVuln: finalPVuln,
              cvss: pred.cvss_base_score ?? pred.cvss ?? undefined,
              riskScore: finalRiskScore,
              riskLevel: finalRiskLevel,
              explanation: pred.explanation || null,
              metadata: extendedMeta,
            },
          });
        })
      );

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

    // 将 metadata 映射为 meta，并提取新字段
    const dataWithMeta = data.map((pred: any) => {
      const meta = pred.metadata as any || {};
      return {
        ...pred,
        pVulnRaw: meta.p_vuln_raw ?? pred.pVuln,  // 如果没有原始值，使用pVuln
        isClipped: meta.is_clipped || false,
        reliability: meta.reliability || 'Medium',
        warnings: meta.warnings || [],
        // 两阶段模型字段
        pApplicable: meta.pApplicable ?? null,
        applicable: meta.applicable ?? true,
        severityLevel: meta.severityLevel ?? pred.riskLevel,
        severityProbs: meta.severityProbs ?? null,
        meta: meta,  // 将 metadata 映射为 meta
      };
    });

    return {
      data: dataWithMeta,
      total,
    };
  }

  async getPredictionById(id: string) {
    const prediction = await prisma.prediction.findUnique({
      where: { id },
      include: {
        model: true,
      },
    });

    if (!prediction) {
      return null;
    }

    // 从metadata中提取新字段，添加到响应中
    const meta = prediction.metadata as any || {};
    return {
      ...prediction,
      pVulnRaw: meta.p_vuln_raw ?? prediction.pVuln,  // 如果没有原始值，使用pVuln
      isClipped: meta.is_clipped || false,
      reliability: meta.reliability || 'Medium',
      warnings: meta.warnings || [],
      // 两阶段模型字段
      pApplicable: meta.pApplicable ?? null,
      applicable: meta.applicable ?? true,
      severityLevel: meta.severityLevel ?? prediction.riskLevel,
      severityProbs: meta.severityProbs ?? null,
      meta: meta,  // 同时提供meta字段（向后兼容）
    };
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

