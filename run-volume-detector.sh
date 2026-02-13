#!/bin/bash

# Volume Spike Detector Cron Script
# Runs during market hours: 9:30 AM - 4:00 PM EST, Monday-Friday

cd /Users/charon/go

# Check if market is open (simple check - could be enhanced with market calendar)
HOUR=$(date +%H)
MINUTE=$(date +%M)
DAY=$(date +%u) # 1=Monday, 5=Friday

# Market hours: 9:30-16:00 EST, Monday-Friday
if [ $DAY -le 5 ] && ([ $HOUR -gt 9 ] || [ $HOUR -eq 9 -a $MINUTE -ge 30 ]) && [ $HOUR -lt 16 ]; then
    echo "Market is open, running volume spike detector..."
    node yahoo-volume-detector.js >> /Users/charon/go/volume-detector.log 2>&1
else
    echo "Market is closed (HOUR: $HOUR, DAY: $DAY), skipping check"
fi