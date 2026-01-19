# VulnRisk - Vulnerability Risk Assessment Platform

A full-stack application for predicting software vulnerabilities and calculating risk scores using machine learning.

## Architecture

- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL
- **ML Service**: Python with scikit-learn, XGBoost, and imbalanced-learn
- **Frontend**: Vue 3 + TypeScript + Element Plus + ECharts
- **Database**: PostgreSQL

## Features

- **Dataset Management**: Upload and preprocess CSV/JSON datasets
- **Model Training**: Train RandomForest or XGBoost models with optional SMOTE
- **Risk Prediction**: Predict vulnerability probability and calculate risk scores
- **Risk Assessment**: Combines ML predictions with CVSS scores using configurable weights
- **Web Dashboard**: Interactive UI for managing datasets, models, and viewing predictions

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) Node.js 18+ and Python 3.10+ for local development

### Running with Docker Compose

1. Clone the repository and navigate to the project directory

2. Start all services:
```bash
docker-compose up -d
```

3. Initialize the database (first time only):
```bash
docker-compose exec backend-node npx prisma migrate deploy
```

4. Access the application:
   - Frontend: http://localhost
   - Backend API: http://localhost:3000
   - ML Service: http://localhost:5000

### Development Setup

#### Backend

```bash
cd backend-node
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

#### ML Service

```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

#### Frontend

```bash
cd frontend-vue
npm install
npm run dev
```

## API Endpoints

### Datasets
- `POST /api/datasets` - Upload dataset (CSV/JSON)
- `GET /api/datasets` - List all datasets
- `GET /api/datasets/:id` - Get dataset details
- `POST /api/datasets/:id/preprocess` - Preprocess dataset

### Models
- `POST /api/models/train` - Train a new model
- `GET /api/models` - List all models
- `GET /api/models/:id` - Get model details
- `POST /api/models/:id/activate` - Activate a model

### Predictions
- `POST /api/predictions` - Make a single prediction
- `POST /api/predictions/batch` - Make batch predictions
- `GET /api/predictions` - List predictions
- `GET /api/predictions/:id` - Get prediction details

## Risk Calculation

The risk score is calculated using the formula:

```
if CVSS exists:
    risk = alpha * P(vuln) + beta * (CVSS / 10)
else:
    risk = P(vuln)
```

Default values: `alpha = 0.6`, `beta = 0.4`

Risk levels:
- **Low**: < 0.40
- **Medium**: 0.40 - 0.69
- **High**: 0.70 - 0.89
- **Critical**: ≥ 0.90

## Dataset Format

The dataset should contain the following fields:

```json
{
  "sample_id": "string",
  "text_description": "string (required)",
  "cvss_base_score": "number (0-10, optional)",
  "label": "0 | 1 (required for training)"
}
```

## Documentation

- [English Documentation](./README.md)
- [中文使用文档](./README_CN.md)

## License

MIT

