#!/usr/bin/env bash
# ==============================================================================
# CymbalFintech Core - CodeMender GCP & Workload Identity Federation (WIF) Setup
# Sets up keyless authentication (OIDC) between GitHub Actions and Google Cloud
# ==============================================================================

set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE} CodeMender GCP & GitHub Actions WIF Provisioning Automation      ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# 1. Project & Repository Auto-detection
DETECTED_PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
DEFAULT_REPO="gustavomlapa/cymbal-fintech-core"

# Try detecting git origin if available
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ORIGIN_URL=$(git config --get remote.origin.url || true)
  if [[ "$ORIGIN_URL" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    DEFAULT_REPO="${BASH_REMATCH[1]}"
  fi
fi

# Interactive confirmation / inputs
if [ -t 0 ] || { [ -c /dev/tty ] && exec < /dev/tty 2>/dev/null; }; then
  if [ -n "$DETECTED_PROJECT" ]; then
    read -r -p "Enter Google Cloud Project ID [default: ${DETECTED_PROJECT}]: " USER_PROJECT
    PROJECT_ID="${USER_PROJECT:-$DETECTED_PROJECT}"
  else
    read -r -p "Enter Google Cloud Project ID: " PROJECT_ID
  fi

  read -r -p "Enter GitHub Repository (owner/repo) [default: ${DEFAULT_REPO}]: " USER_REPO
  GITHUB_REPO="${USER_REPO:-$DEFAULT_REPO}"
else
  PROJECT_ID="${DETECTED_PROJECT}"
  GITHUB_REPO="${DEFAULT_REPO}"
fi

if [ -z "${PROJECT_ID:-}" ]; then
  echo -e "${RED}Error: GCP project ID is required. Please set GCP_PROJECT or run gcloud config set project <id>.${NC}"
  exit 1
fi

if [ -z "${GITHUB_REPO:-}" ]; then
  echo -e "${RED}Error: GitHub repository is required.${NC}"
  exit 1
fi

echo ""
echo -e "Configuring CodeMender WIF for:"
echo -e "  - GCP Project : ${GREEN}${PROJECT_ID}${NC}"
echo -e "  - GitHub Repo : ${GREEN}${GITHUB_REPO}${NC}"
echo ""

# Configuration identifiers
SA_NAME="codemender-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="codemender-pool"
POOL_DISPLAY="CodeMender Actions Pool"
PROVIDER_ID="github-provider"
PROVIDER_DISPLAY="GitHub Actions OIDC Provider"

# 2. Get Project Number
echo -e "${BLUE}==> Step 1: Retrieving GCP Project Number...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
echo -e "Project Number: ${GREEN}${PROJECT_NUMBER}${NC}"

# 3. Enable Required Google Cloud APIs
echo ""
echo -e "${BLUE}==> Step 2: Enabling Required GCP APIs...${NC}"
gcloud services enable \
  aiplatform.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}" --quiet

# 4. Create Service Account (Idempotent)
echo ""
echo -e "${BLUE}==> Step 3: Checking / Creating Service Account '${SA_NAME}'...${NC}"
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo -e "Service account '${SA_EMAIL}' already exists."
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="CodeMender GitHub Actions Runner" \
    --description="Used by GitHub Actions to execute CodeMender (cm verify / cm fix)" \
    --quiet
  echo -e "Created service account: ${GREEN}${SA_EMAIL}${NC}"
fi

# 5. Grant Vertex AI User Role
echo ""
echo -e "${BLUE}==> Step 4: Granting Vertex AI User role to '${SA_EMAIL}'...${NC}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet >/dev/null
echo -e "${GREEN}Assigned role 'roles/aiplatform.user'.${NC}"

# 6. Create Workload Identity Pool (Idempotent)
echo ""
echo -e "${BLUE}==> Step 5: Setting up Workload Identity Pool '${POOL_ID}'...${NC}"
if gcloud iam workload-identity-pools describe "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" >/dev/null 2>&1; then
  echo -e "Workload Identity Pool '${POOL_ID}' already exists."
else
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="${POOL_DISPLAY}" \
    --description="Pool for CodeMender GitHub Actions runners" \
    --quiet
  echo -e "Created pool: ${GREEN}${POOL_ID}${NC}"
fi

# 7. Create Workload Identity Provider (Idempotent)
echo ""
echo -e "${BLUE}==> Step 6: Setting up Workload Identity Provider '${PROVIDER_ID}'...${NC}"
if gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  echo -e "Workload Identity Provider '${PROVIDER_ID}' already exists."
else
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="${PROVIDER_DISPLAY}" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'" \
    --quiet
  echo -e "Created OIDC provider: ${GREEN}${PROVIDER_ID}${NC}"
fi

# 8. Grant Workload Identity User on the Service Account
echo ""
echo -e "${BLUE}==> Step 7: Binding GitHub Repo to Service Account Impersonation...${NC}"
PRINCIPAL_SET="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${PRINCIPAL_SET}" \
  --quiet >/dev/null

echo -e "${GREEN}Linked principal '${PRINCIPAL_SET}' to '${SA_EMAIL}'.${NC}"

# 9. Output exact values for GitHub Repository Variables
WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN} Provisioning Complete! Zero secret keys needed.                   ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "Configure the following ${YELLOW}Variables${NC} in your GitHub repository:"
echo -e "👉 ${BLUE}https://github.com/${GITHUB_REPO}/settings/variables/actions${NC}"
echo ""
echo -e "------------------------------------------------------------------"
echo -e "Variable Name:            Value:"
echo -e "------------------------------------------------------------------"
echo -e "GCP_PROJECT_ID            ${GREEN}${PROJECT_ID}${NC}"
echo -e "GCP_WIF_PROVIDER          ${GREEN}${WIF_PROVIDER_RESOURCE}${NC}"
echo -e "GCP_WIF_SERVICE_ACCOUNT   ${GREEN}${SA_EMAIL}${NC}"
echo -e "------------------------------------------------------------------"
echo ""
echo -e "${YELLOW}Note:${NC} These values are non-sensitive identifiers and can safely be stored"
echo -e "as GitHub Actions Variables (or Secrets if preferred)."
echo ""
