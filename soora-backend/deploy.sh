#!/bin/bash
# =============================================
# Soora Backend - VPS Deployment Script
# Run this ON YOUR VPS
# =============================================
set -e

echo "=========================================="
echo "  Soora Backend - VPS Deploy"
echo "=========================================="

REPO_DIR="$HOME/soora-code"
BACKEND_DIR="$REPO_DIR/soora-backend"

# 1) Pull latest code
echo ""
echo "[1/5] Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# 2) Install backend dependencies
echo ""
echo "[2/5] Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production=false

# 3) Build TypeScript
echo ""
echo "[3/5] Building TypeScript..."
npm run build

# 4) Restart with PM2
echo ""
echo "[4/5] Restarting soora-backend with PM2..."
pm2 delete soora-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 5) Verify
echo ""
echo "[5/5] Verifying..."
sleep 3
curl -s http://localhost:4000/health && echo ""

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "  Backend: http://localhost:4000"
echo "  Health:  http://localhost:4000/health"
echo "=========================================="
