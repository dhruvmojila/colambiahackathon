#!/bin/bash
# ===== SignPulse AI — Cloud Run Deployment Script =====
# Usage: bash deploy.sh [PROJECT_ID] [REGION]
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. service-account.json in project root
#   3. APIs enabled: Cloud Run, Artifact Registry, Vertex AI

set -e

PROJECT_ID="${1:-waybackhome-xh3x47hr3fc1viubuy}"
REGION="${2:-us-central1}"
SERVICE_NAME="signpulse-ai"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying SignPulse AI to Cloud Run"
echo "   Project:  ${PROJECT_ID}"
echo "   Region:   ${REGION}"
echo "   Service:  ${SERVICE_NAME}"
echo ""

# Step 1: Set GCP project
echo "📋 Setting GCP project..."
gcloud config set project "${PROJECT_ID}"

# Step 2: Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# Step 3: Build and push the container using Cloud Build
echo "🏗️  Building container with Cloud Build..."
gcloud builds submit \
  --tag "${IMAGE_NAME}" \
  --timeout=1200s \
  --quiet

# Step 4: Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,GOOGLE_APPLICATION_CREDENTIALS=./service-account.json,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}" \
  --quiet

# Step 5: Get the URL
echo ""
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "🌐 SignPulse AI is live at: ${SERVICE_URL}"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
