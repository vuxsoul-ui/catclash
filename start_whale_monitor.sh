#!/bin/bash
# Whale Options Monitor Runner
# Runs the whale options flow monitor with proper environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure log files exist
touch whale_monitor.log

echo "=========================================="
echo "🐋 Whale Options Monitor"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi

# Run monitor directly (using system yfinance if available)
echo "Starting monitor..."
echo "Logs: whale_monitor.log"
echo "Alerts: whale_alerts.jsonl"
echo ""

python3 whale_monitor_final.py
