#!/usr/bin/env bash
# ==============================================================================
# CymbalFintech Core Platform - Google Cloud Run Deployment Script
# Automated build and deployment using Google Cloud SDK (gcloud)
# ==============================================================================

set -euo pipefail

# 1. Configuration & Defaults
PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
REGION="${GCP_REGION:-southamerica-east1}" # São Paulo by default for Brazilian fintech demo
ALLOW_UNAUTHENTICATED="--allow-unauthenticated"

echo "=================================================================="
echo " CymbalFintech Cloud Run Deployment Automation"
echo "=================================================================="

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP project ID is not set. Please set GCP_PROJECT or configure gcloud:"
  echo "  export GCP_PROJECT=your-gcp-project-id"
  echo "  gcloud config set project your-gcp-project-id"
  exit 1
fi

echo "Deploying to Project: ${PROJECT_ID}"
echo "Deploying to Region:  ${REGION}"
echo ""

# 2. Enable Required GCP APIs
echo "==> Step 1: Enabling Required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

# 3. Deploy Microservices sequentially using Cloud Build packs / Dockerfiles
echo ""
echo "==> Step 2: Deploying Core Banking Service (Go)..."
gcloud run deploy cymbal-core-banking \
  --source=services/core-banking \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=8081 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

CORE_BANKING_URL=$(gcloud run services describe cymbal-core-banking --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "Core Banking deployed at: ${CORE_BANKING_URL}"

echo ""
echo "==> Step 3: Deploying Identity & KYC Service (Node.js)..."
gcloud run deploy cymbal-identity-service \
  --source=services/identity-service \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=8082 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

IDENTITY_URL=$(gcloud run services describe cymbal-identity-service --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "Identity Service deployed at: ${IDENTITY_URL}"

echo ""
echo "==> Step 4: Deploying Payments & PIX Service (Python)..."
gcloud run deploy cymbal-payments-service \
  --source=services/payments-service \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=8083 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

PAYMENTS_URL=$(gcloud run services describe cymbal-payments-service --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "Payments Service deployed at: ${PAYMENTS_URL}"

echo ""
echo "==> Step 5: Deploying Credit & Underwriting Service (Node.js)..."
gcloud run deploy cymbal-credit-service \
  --source=services/credit-service \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=8084 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

CREDIT_URL=$(gcloud run services describe cymbal-credit-service --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "Credit Service deployed at: ${CREDIT_URL}"

echo ""
echo "==> Step 6: Deploying Risk & Anti-Fraud Engine (Python)..."
gcloud run deploy cymbal-risk-engine \
  --source=services/risk-engine \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=8085 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --set-env-vars=PARTNER_HMAC_SECRET="cymbal_prod_cluster_secret_2026" \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

RISK_URL=$(gcloud run services describe cymbal-risk-engine --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "Risk Engine deployed at: ${RISK_URL}"

echo ""
echo "==> Step 7: Deploying Central Web Portal & BFF (Node.js)..."
gcloud run deploy cymbal-web-portal \
  --source=services/web-portal \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars="CORE_BANKING_URL=${CORE_BANKING_URL},IDENTITY_SERVICE_URL=${IDENTITY_URL},PAYMENTS_SERVICE_URL=${PAYMENTS_URL},CREDIT_SERVICE_URL=${CREDIT_URL},RISK_ENGINE_URL=${RISK_URL}" \
  ${ALLOW_UNAUTHENTICATED} \
  --quiet

PORTAL_URL=$(gcloud run services describe cymbal-web-portal --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")

echo ""
echo "=================================================================="
echo " CymbalFintech Core Platform Deployment Completed Successfully!   "
echo "=================================================================="
echo " Central Web Portal:  ${PORTAL_URL}"
echo " Core Banking API:    ${CORE_BANKING_URL}"
echo " Identity Service:    ${IDENTITY_URL}"
echo " Payments Service:    ${PAYMENTS_URL}"
echo " Credit Service:      ${CREDIT_URL}"
echo " Risk Engine:         ${RISK_URL}"
echo "=================================================================="
