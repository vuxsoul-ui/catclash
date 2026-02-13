#!/bin/bash
# Whale Options Monitor Runner

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv_whale" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv_whale
fi

# Activate virtual environment
source venv_whale/bin/activate

# Install dependencies
pip install -q -r requirements_whale.txt

# Run the monitor
echo "Starting Whale Options Monitor..."
python3 whale_monitor_advanced.py
