# VulnRisk ML Service

Python ML service for training models and making predictions.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start the service:
```bash
python app.py
```

## Environment Variables

- `MODELS_DIR`: Directory for storing trained models (default: /app/models)
- `DATA_DIR`: Directory for dataset files (default: /app/data)
- `RISK_ALPHA`: Weight for ML probability in risk calculation (default: 0.6)
- `RISK_BETA`: Weight for CVSS score in risk calculation (default: 0.4)

## API Endpoints

- `GET /health` - Health check
- `POST /train` - Train a new model
- `POST /predict` - Make a single prediction
- `POST /predict/batch` - Make batch predictions

















