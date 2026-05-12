# Heliora Fast GCP Deployment Script
Write-Host "🚀 Starting Heliora Fast Deployment to GCP..." -ForegroundColor Cyan

$PROJECT_ID = "oneclaw-486705"

# Ensure we are on the right project
Write-Host "Setting gcloud project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Submit the build
Write-Host "Submitting Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --config cloudbuild.yaml .

Write-Host "✅ Deployment Triggered! Check the GCP Console for progress." -ForegroundColor Green
Write-Host "Backend: https://heliora-backend-40377961468.asia-east1.run.app"
Write-Host "Frontend: https://heliora-frontend-40377961468.asia-east1.run.app"
