import prisma from '../db';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import path from 'path';

export interface DatasetRow {
  sample_id: string;
  text_description: string;
  cvss_base_score?: number;
  label?: number;
}

export class DatasetService {
  async uploadDataset(name: string, filePath: string, fileType: 'csv' | 'json'): Promise<any> {
    let data: DatasetRow[];
    let schema: any;

    if (fileType === 'csv') {
      const content = await fs.readFile(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
          // Try to cast to number for cvss_base_score
          if (context.column === 'cvss_base_score' && value) {
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
          }
          // Try to cast to number for label
          if (context.column === 'label' && value) {
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          }
          return value;
        },
      });
      data = records;
    } else {
      const content = await fs.readFile(filePath, 'utf-8');
      data = JSON.parse(content);
    }

    // Analyze schema
    if (data.length > 0) {
      const firstRow = data[0] as Record<string, any>;
      schema = {
        fields: Object.keys(firstRow).map(key => ({
          name: key,
          type: this.inferType(firstRow[key]),
        })),
        recordCount: data.length,
      };
    } else {
      schema = { fields: [], recordCount: 0 };
    }

    // Save dataset metadata to database
    const dataset = await prisma.dataset.create({
      data: {
        name,
        schema,
        recordCount: data.length,
      },
    });

    // Save raw data to file for ML service
    // Use absolute path that ML service can access via shared volume
    const datasetDir = path.join('/app/data', dataset.id);
    await fs.mkdir(datasetDir, { recursive: true });
    const dataFile = path.join(datasetDir, 'data.json');
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));

    return {
      ...dataset,
      dataFile,
    };
  }

  async getDatasets() {
    return prisma.dataset.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDatasetById(id: string) {
    return prisma.dataset.findUnique({
      where: { id },
    });
  }

  async preprocessDataset(id: string) {
    const dataset = await this.getDatasetById(id);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const dataFile = path.join('/app/data', id, 'data.json');
    const data = JSON.parse(await fs.readFile(dataFile, 'utf-8'));

    // Validate required fields
    const requiredFields = ['sample_id', 'text_description'];
    for (const row of data) {
      for (const field of requiredFields) {
        if (!row[field]) {
          throw new Error(`Missing required field: ${field} in row with sample_id: ${row.sample_id || 'unknown'}`);
        }
      }
    }

    return {
      datasetId: id,
      recordCount: data.length,
      fields: Object.keys(data[0] || {}),
    };
  }

  /**
   * Get or create the training dataset from predictions
   */
  async getOrCreateTrainingDataset() {
    const datasetName = 'Training Data from Predictions';
    
    // Try to find existing dataset
    let dataset = await prisma.dataset.findFirst({
      where: { name: datasetName },
    });

    if (!dataset) {
      // Create new dataset
      const schema = {
        fields: [
          { name: 'sample_id', type: 'string' },
          { name: 'text_description', type: 'string' },
          { name: 'cvss_base_score', type: 'number' },
          { name: 'label', type: 'number' },
        ],
        recordCount: 0,
      };

      dataset = await prisma.dataset.create({
        data: {
          name: datasetName,
          schema,
          recordCount: 0,
        },
      });

      // Create data file with empty array
      const datasetDir = path.join('/app/data', dataset.id);
      await fs.mkdir(datasetDir, { recursive: true });
      const dataFile = path.join(datasetDir, 'data.json');
      await fs.writeFile(dataFile, JSON.stringify([], null, 2));
    }

    return dataset;
  }

  /**
   * Append a sample to the training dataset
   */
  async appendToTrainingDataset(sample: DatasetRow) {
    const dataset = await this.getOrCreateTrainingDataset();
    const dataFile = path.join('/app/data', dataset.id, 'data.json');

    // Read existing data
    let data: DatasetRow[] = [];
    try {
      const content = await fs.readFile(dataFile, 'utf-8');
      data = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      data = [];
    }

    // Check if sample_id already exists to avoid duplicates
    const existingIndex = data.findIndex((row) => row.sample_id === sample.sample_id);
    if (existingIndex >= 0) {
      // Update existing record
      data[existingIndex] = sample;
    } else {
      // Append new record
      data.push(sample);
    }

    // Write back to file
    await fs.writeFile(dataFile, JSON.stringify(data, null, 2));

    // Update dataset metadata
    await prisma.dataset.update({
      where: { id: dataset.id },
      data: {
        recordCount: data.length,
        updatedAt: new Date(),
      },
    });

    return dataset;
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      // Check if it's a date string
      if (!isNaN(Date.parse(value)) && value.includes('-')) return 'date';
      return 'string';
    }
    return 'unknown';
  }
}

