# ===== SignPulse AI — Cloud Run Deployment Script (PowerShell) =====
# Usage: .\deploy.ps1 [PROJECT_ID] [REGION]

param(
    [string]$PROJECT_ID = "waybackhome-xh3x47hr3fc1viubuy",
    [string]$REGION = "us-central1"
)

$SERVICE_NAME = "signpulse-ai"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "🚀 Deploying SignPulse AI to Cloud Run" -ForegroundColor Cyan
Write-Host "   Project:  $PROJECT_ID"
Write-Host "   Region:   $REGION"
Write-Host "   Service:  $SERVICE_NAME`n"

# Step 1: Set GCP project
Write-Host "📋 Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
Write-Host "🔧 Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com `
    artifactregistry.googleapis.com `
    aiplatform.googleapis.com `
    cloudbuild.googleapis.com `
    texttospeech.googleapis.com `
    --quiet

# Step 3: Build and deploy (using --source . like your working command)
Write-Host "🏗️  Building and deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
    --source . `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --timeout 300 `
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION" `
    --quiet

# Step 4: Get the URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 SignPulse AI is live at: $SERVICE_URL" -ForegroundColor Green
Write-Host "`nTo view logs:"
Write-Host "  gcloud run services logs read $SERVICE_NAME --region $REGION"