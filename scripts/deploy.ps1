# Pakistan Economic Dashboard - Azure Static Website Deploy Script
# Usage: pwsh scripts/deploy.ps1

$StorageAccount = "pakeconomydash"
$ResourceGroup  = "rg-pak-eco"
$Region         = "westus2"
$SubscriptionId = if ($env:AZURE_SUBSCRIPTION_ID) { $env:AZURE_SUBSCRIPTION_ID } else { "390ba656-47f7-435c-a233-8ba40bc2316f" }

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command $($Arguments -join ' ')"
    }
}

Write-Host "`n🇵🇰 Pakistan Economic Dashboard — Deploy to Azure" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

$ErrorActionPreference = "Stop"

# Step 0: Select the intended Azure subscription
Write-Host "🔐 Selecting Azure subscription..." -ForegroundColor Cyan
Invoke-Checked az account set --subscription $SubscriptionId

# Step 1: Build
Write-Host "📦 Building production bundle..." -ForegroundColor Cyan
Invoke-Checked npm run build

# Step 2: Check if storage account exists, create if not
$exists = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
if (-not $exists) {
    Write-Host "`n☁️  Creating Azure resources..." -ForegroundColor Cyan
    Invoke-Checked az group create --name $ResourceGroup --location $Region -o none
    Invoke-Checked az storage account create --name $StorageAccount --resource-group $ResourceGroup `
        --location $Region --sku Standard_LRS --kind StorageV2 --allow-blob-public-access true -o none
    Invoke-Checked az storage blob service-properties update --account-name $StorageAccount `
        --static-website --index-document index.html --404-document index.html -o none
    Write-Host "✅ Resources created" -ForegroundColor Green
}

# Step 3: Upload
Write-Host "`n🚀 Uploading to Azure Storage..." -ForegroundColor Cyan
Invoke-Checked az storage blob upload-batch --account-name $StorageAccount --source ./dist `
    --destination '$web' --overwrite -o none

# Step 4: Get URL
$url = az storage account show --name $StorageAccount `
    --query "primaryEndpoints.web" -o tsv
if ($LASTEXITCODE -ne 0) { throw "Failed to read static website endpoint" }
Write-Host "`n✅ Deployed successfully!" -ForegroundColor Green
Write-Host "🌐 Live at: $url" -ForegroundColor Yellow
Write-Host ""
