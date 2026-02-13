#!/bin/bash
# Volume Spike Monitor - Cron Wrapper
# Run this script every 5 minutes via cron
# Example crontab entry:
# */5 * * * * cd /Users/charon/go && ./run_volume_monitor.sh >> volume_monitor.log 2>&1

cd "$(dirname "$0")"

echo "========================================="
echo "Volume Monitor Run: $(date)"
echo "========================================="

# Run the monitor
python3 volume_spike_monitor.py

# Process any pending alerts
if [ -f .volume_alerts.jsonl ]; then
    echo "Processing pending alerts..."
    python3 send_volume_alerts.py
fi

echo "Run complete: $(date)"
echo ""
