#!/bin/bash

# Health Tracker - Cron Setup Script
# Sets up daily sync at 9 AM local time

PROJECT_DIR="/Users/ai2025/health-tracker-v2"
CRON_JOB="0 9 * * * cd $PROJECT_DIR && /usr/local/bin/npx ts-node scripts/sync.ts >> $PROJECT_DIR/logs/sync.log 2>&1"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "health-tracker-v2.*sync.ts"; then
    echo "Cron job already exists. Updating..."
    # Remove existing job
    crontab -l 2>/dev/null | grep -v "health-tracker-v2.*sync.ts" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job installed successfully!"
echo "Schedule: Every day at 9:00 AM"
echo "Logs: $PROJECT_DIR/logs/sync.log"
echo ""
echo "To verify: crontab -l"
echo "To remove: crontab -l | grep -v 'health-tracker-v2' | crontab -"
