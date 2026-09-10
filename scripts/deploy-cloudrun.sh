#!/usr/bin/env bash
# ==============================================================================
# CymbalFintech Core Platform - Google Cloud Run Deployment Script
# Automated build and deployment using Google Cloud SDK (gcloud)
# ==============================================================================

set -euo pipefail

# 1. Configuration & Interactive Confirmation
DETECTED_PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
DEFAULT_REGION="${GCP_REGION:-southamerica-east1}" # São Paulo by default for Brazilian fintech demo
ALLOW_UNAUTHENTICATED="--allow-unauthenticated"

echo "=================================================================="
echo " CymbalFintech Cloud Run Deployment Automation"
echo "=================================================================="

# Prompt for Project ID & Region if running interactively
if [ -t 0 ] || { [ -c /dev/tty ] && exec < /dev/tty 2>/dev/null; }; then
  if [ -n "$DETECTED_PROJECT" ]; then
    read -r -p "Enter GCP Project ID [default: ${DETECTED_PROJECT}]: " USER_PROJECT
    PROJECT_ID="${USER_PROJECT:-$DETECTED_PROJECT}"
  else
    read -r -p "Enter GCP Project ID: " PROJECT_ID
  fi

  read -r -p "Enter GCP Region [default: ${DEFAULT_REGION}]: " USER_REGION
  REGION="${USER_REGION:-$DEFAULT_REGION}"

  echo ""
  echo "Target Deployment Configuration:"
  echo "  - Google Cloud Project ID : ${PROJECT_ID}"
  echo "  - Region                 : ${REGION}"
  echo ""
  read -r -p "Do you want to proceed with deployment? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Deployment aborted by user."
    exit 0
  fi
else
  PROJECT_ID="${DETECTED_PROJECT}"
  REGION="${DEFAULT_REGION}"
fi

if [ -z "${PROJECT_ID:-}" ]; then
  echo "Error: GCP project ID is not set. Please provide a valid project ID."
  exit 1
fi

echo ""
echo "Proceeding with deployment to Project '${PROJECT_ID}' in Region '${REGION}'..."
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

