-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "artifactPath" TEXT NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "textDescription" TEXT,
    "pVuln" DOUBLE PRECISION NOT NULL,
    "cvss" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictions_modelId_idx" ON "predictions"("modelId");

-- CreateIndex
CREATE INDEX "predictions_sampleId_idx" ON "predictions"("sampleId");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ml_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

















