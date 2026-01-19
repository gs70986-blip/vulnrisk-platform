# VulnRisk Backend

Node.js backend service for the VulnRisk platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Generate Prisma Client:
```bash
npx prisma generate
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

5. Start the server:
```bash
npm run dev
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 3000)
- `ML_SERVICE_URL`: ML service endpoint (default: http://localhost:5000)
- `NODE_ENV`: Environment (development/production)
- `GITHUB_TOKEN`: (Optional) GitHub Personal Access Token for API requests. Strongly recommended to avoid rate limiting. Without token, requests may be rate-limited by GitHub API.
- `AUTO_APPEND_TRAINING_DATA`: (Default: false) Enable automatic appending of prediction inputs to training dataset. Set to `true` to enable. **Warning**: Enabling this may cause feedback loop pollution if predictions contain non-vulnerability related text.















