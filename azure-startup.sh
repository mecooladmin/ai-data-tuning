#!/bin/bash
# Azure App Service startup script
# Set this as the startup command in Azure:
#   bash azure-startup.sh
set -e

echo "[startup] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[startup] Building API server..."
pnpm --filter @workspace/api-server run build

echo "[startup] Building frontend..."
BASE_PATH="/" pnpm --filter @workspace/pipeline-ui run build

echo "[startup] Copying frontend build to api-server/frontend/..."
mkdir -p artifacts/api-server/frontend
cp -r artifacts/pipeline-ui/dist/public/. artifacts/api-server/frontend/

echo "[startup] Starting server..."
cd artifacts/api-server
NODE_ENV=production node --enable-source-maps ./dist/index.mjs
