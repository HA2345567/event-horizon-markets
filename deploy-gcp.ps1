# Heliora Fast GCP Deployment Script
Write-Host "🚀 Starting Heliora Fast Deployment to GCP..." -ForegroundColor Cyan

$PROJECT_ID = "oneclaw-486705"

# Ensure we are on the right project
Write-Host "Setting gcloud project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Load environment variables from backend/.env
if (Test-Path "backend/.env") {
    $envVars = Get-Content "backend/.env" | Where-Object { $_ -match "=" -and $_ -notmatch "^#" }
    foreach ($line in $envVars) {
        $parts = $line.Split('=', 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        if ($key -eq "DATABASE_URL") { $DATABASE_URL = $value }
        if ($key -eq "GEMINI_API_KEY") { $GEMINI_API_KEY = $value }
    }
}

# Default production values if not found in .env
if (-not $DATABASE_URL) {
    Write-Error "DATABASE_URL not found in backend/.env"
    exit 1
}

$VITE_API_URL = "https://heliora-backend-40377961468.asia-east1.run.app"
$VITE_PRIVY_APP_ID = "cmooj9sxq009x0djo8i0uld15"

$SUBSTITUTIONS = "_DATABASE_URL=$DATABASE_URL,_GEMINI_API_KEY=$GEMINI_API_KEY,_GEMINI_MODEL=gemini-3-flash-preview,_VITE_API_URL=$VITE_API_URL,_VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID"

# Submit the build
Write-Host "Submitting Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --config cloudbuild.yaml `
    --service-account="projects/oneclaw-486705/serviceAccounts/vertex-express@oneclaw-486705.iam.gserviceaccount.com" `
    --substitutions="$SUBSTITUTIONS" .



Write-Host "✅ Deployment Triggered! Check the GCP Console for progress." -ForegroundColor Green
Write-Host "Backend: https://heliora-backend-40377961468.asia-east1.run.app"
Write-Host "Frontend: https://heliora-frontend-40377961468.asia-east1.run.app"
