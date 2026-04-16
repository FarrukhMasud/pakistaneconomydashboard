# Pakistan Economic Dashboard - Azure Static Website Deploy Script
# Usage: pwsh scripts/deploy.ps1

$StorageAccount = "pakeconomicdash"
$ResourceGroup  = "rg-pak-eco"
$Region         = "westus2"

Write-Host "`n🇵🇰 Pakistan Economic Dashboard — Deploy to Azure" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

# Step 1: Build
Write-Host "📦 Building production bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed" -ForegroundColor Red; exit 1 }

# Step 2: Check if storage account exists, create if not
$exists = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
if (-not $exists) {
    Write-Host "`n☁️  Creating Azure resources..." -ForegroundColor Cyan
    az group create --name $ResourceGroup --location $Region -o none
    az storage account create --name $StorageAccount --resource-group $ResourceGroup `
        --location $Region --sku Standard_LRS --kind StorageV2 --allow-blob-public-access true -o none
    az storage blob service-properties update --account-name $StorageAccount `
        --static-website --index-document index.html --404-document index.html -o none
    Write-Host "✅ Resources created" -ForegroundColor Green
}

# Step 3: Upload
Write-Host "`n🚀 Uploading to Azure Storage..." -ForegroundColor Cyan
az storage blob upload-batch --account-name $StorageAccount --source ./dist `
    --destination '$web' --overwrite -o none

# Step 4: Get URL
$url = az storage account show --name $StorageAccount `
    --query "primaryEndpoints.web" -o tsv
Write-Host "`n✅ Deployed successfully!" -ForegroundColor Green
Write-Host "🌐 Live at: $url" -ForegroundColor Yellow
Write-Host ""
