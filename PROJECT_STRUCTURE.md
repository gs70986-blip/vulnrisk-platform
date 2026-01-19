# VulnRisk Project Structure

Complete codebase structure following the specification.

## Directory Structure

```
vulnrisk/
├── backend-node/              # Node.js + TypeScript Backend
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (Dataset, MLModel, Prediction)
│   │   └── migrations/        # Database migrations
│   ├── src/
│   │   ├── app.ts            # Express app setup
│   │   ├── server.ts         # Server entry point
│   │   ├── config/           # Configuration
│   │   ├── db/               # Prisma client
│   │   ├── routes/           # API routes
│   │   │   ├── datasets.ts
│   │   │   ├── models.ts
│   │   │   ├── predictions.ts
│   │   │   └── health.ts
│   │   ├── controllers/      # Route handlers
│   │   │   ├── dataset.controller.ts
│   │   │   ├── model.controller.ts
│   │   │   └── prediction.controller.ts
│   │   ├── services/         # Business logic
│   │   │   ├── dataset.service.ts
│   │   │   ├── model.service.ts
│   │   │   ├── prediction.service.ts
│   │   │   └── risk.service.ts
│   │   └── utils/            # Utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── ml-service/               # Python ML Service
│   ├── train.py             # Model training script
│   ├── predict.py           # Prediction script
│   ├── risk.py              # Risk calculation module
│   ├── app.py               # Flask API server
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile
│
├── frontend-vue/            # Vue 3 Frontend
│   ├── src/
│   │   ├── views/           # Page components
│   │   │   ├── Datasets.vue
│   │   │   ├── Models.vue
│   │   │   ├── Predictions.vue
│   │   │   └── Report.vue
│   │   ├── services/        # API client
│   │   │   └── api.ts
│   │   ├── router/          # Vue Router
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml       # Docker Compose configuration
├── config.yaml              # Global configuration
├── README.md               # Main documentation
├── sample_dataset.json     # Sample training data
├── start.sh                # Startup script (Linux/Mac)
└── start.bat               # Startup script (Windows)
```

## Key Features Implemented

### 1. Database (Prisma + PostgreSQL)
- ✅ Dataset model with schema storage
- ✅ MLModel model with metrics and metadata
- ✅ Prediction model with risk scores
- ✅ Complete migrations

### 2. Backend APIs (Node.js + Express)
- ✅ Dataset management (upload, list, preprocess)
- ✅ Model training (RandomForest, XGBoost)
- ✅ Predictions (single and batch)
- ✅ Health check endpoint
- ✅ Full error handling

### 3. ML Service (Python)
- ✅ Full training pipeline with TF-IDF preprocessing
- ✅ Support for RandomForest and XGBoost
- ✅ SMOTE for class imbalance
- ✅ Complete evaluation metrics (accuracy, precision, recall, F1, ROC-AUC)
- ✅ Risk calculation with alpha/beta weights
- ✅ Batch prediction support

### 4. Risk Calculation
- ✅ Formula: `risk = alpha * P(vuln) + beta * (CVSS/10)`
- ✅ Default: alpha=0.6, beta=0.4
- ✅ Risk level mapping: Low, Medium, High, Critical

### 5. Frontend (Vue 3)
- ✅ Dataset upload and management
- ✅ Model training interface
- ✅ Prediction interface
- ✅ Risk report with charts (ECharts)
- ✅ Feature importance visualization

### 6. Docker Integration
- ✅ PostgreSQL service
- ✅ Backend service
- ✅ ML service
- ✅ Frontend service (Nginx)
- ✅ Shared volumes for data/models
- ✅ Service dependencies configured

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

## Running the Application

### Quick Start (Docker)
```bash
docker-compose up -d
```

### Manual Start
1. Start PostgreSQL
2. Start ML service: `cd ml-service && python app.py`
3. Start backend: `cd backend-node && npm run dev`
4. Start frontend: `cd frontend-vue && npm run dev`

## Technology Stack

- **Backend**: Node.js 18+, TypeScript, Express.js, Prisma ORM
- **ML Service**: Python 3.10+, scikit-learn, XGBoost, imbalanced-learn
- **Frontend**: Vue 3, TypeScript, Element Plus, ECharts
- **Database**: PostgreSQL 15
- **Deployment**: Docker, Docker Compose

## Notes

- All ML logic is fully implemented (not simplified)
- Risk calculation follows the exact formula from specification
- All services communicate via Docker service names
- Data and models are persisted via Docker volumes

















