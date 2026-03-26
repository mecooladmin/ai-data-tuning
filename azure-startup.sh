#!/bin/bash
# Azure App Service startup script
# Set this as the startup command in Azure:
#   bash azure-startup.sh
set -e

echo "[startup] Running database migrations..."
# pnpm --filter @workspace/db run migrate

echo "[startup] Starting server..."
cd artifacts/api-server
NODE_ENV=production node --enable-source-maps ./dist/index.mjs
