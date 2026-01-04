#!/bin/bash
# Daily sync script for health-tracker-v2
cd /Users/ai2025/health-tracker-v2

# Load env
source .env

# Call sync API
curl -s -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"weeks": 16}' >> /tmp/health-sync.log 2>&1

echo "[$(date)] Sync completed" >> /tmp/health-sync.log
