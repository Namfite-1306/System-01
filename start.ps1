$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) { npm ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'Không cài được dependencies.' } }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Không đóng gói được giao diện đăng nhập.' }
node --env-file-if-exists=.env server.mjs
