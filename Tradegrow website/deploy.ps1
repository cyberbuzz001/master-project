# TradeGrow Trust Portal — Production Deploy Script
$ErrorActionPreference = "Stop"

Write-Host "==> 1. Building static production bundle..." -ForegroundColor Cyan
node build/build.js
node build/check-links.js
node build/check-a11y.js

Write-Host "==> 2. Packing distribution bundle..." -ForegroundColor Cyan
$tarFile = "trust_dist.tar.gz"
if (Test-Path $tarFile) { Remove-Item $tarFile }
tar -czf $tarFile -C dist .

Write-Host "==> 3. Uploading to VPS (200.234.34.4)..." -ForegroundColor Cyan
scp -i "$HOME/.ssh/tradegrow_key" -o StrictHostKeyChecking=no $tarFile root@200.234.34.4:/tmp/trust_dist.tar.gz

Write-Host "==> 4. Extracting and reloading web server..." -ForegroundColor Cyan
ssh -i "$HOME/.ssh/tradegrow_key" -o StrictHostKeyChecking=no root@200.234.34.4 "mkdir -p /var/www/trust.tradegrowx.in && tar -xzf /tmp/trust_dist.tar.gz -C /var/www/trust.tradegrowx.in && rm -f /tmp/trust_dist.tar.gz && nginx -t && systemctl reload nginx"

Remove-Item $tarFile
Write-Host "==> Successfully deployed to https://trust.tradegrowx.in/ !" -ForegroundColor Green
