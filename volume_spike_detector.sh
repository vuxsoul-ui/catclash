#!/bin/bash

# Volume Spike Detector for ONDS, NVDA, SLS, VOO
# Monitors for unusual volume spikes using Alpaca API

API_KEY="PKE4SFLVE6CW6SNWRMVREF33N3"
API_SECRET="8LixqL1466MSqGrVdGknZiPKXq195AUsJ4MVMMTi1Zo6"
ALERT_CHAT_ID="8467656798"

# Stock configuration
# Format: SYMBOL:NORMAL_VOLUME:ALERT_MULTIPLIER:ALERT_VOLUME
declare -A STOCKS=(
    ["ONDS"]="100000:3:300000"
    ["NVDA"]="160000000:2.5:400000000"
    ["SLS"]="5000000:3:15000000"
    ["VOO"]="100000:3:300000"
)

# Get current date for timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")

# Fetch stock snapshots
RESPONSE=$(curl -s -X GET \
    -H "APCA-API-KEY-ID: $API_KEY" \
    -H "APCA-API-SECRET-KEY: $API_SECRET" \
    "https://data.alpaca.markets/v2/stocks/snapshots?symbols=ONDS,NVDA,SLS,VOO&feed=iex")

# Check if API call was successful
if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch data from Alpaca API"
    exit 1
fi

# Process each stock
ALERTS=()

for SYMBOL in "${!STOCKS[@]}"; do
    IFS=':' read -r NORMAL_VOLUME ALERT_MULTIPLIER ALERT_VOLUME <<< "${STOCKS[$SYMBOL]}"
    
    # Extract data from JSON response using jq
    LATEST_VOLUME=$(echo "$RESPONSE" | jq -r ".snapshots.\"$SYMBOL\".dailyBar.volume // 0")
    LATEST_PRICE=$(echo "$RESPONSE" | jq -r ".snapshots.\"$SYMBOL\".latestTrade.p // 0")
    PREV_CLOSE=$(echo "$RESPONSE" | jq -r ".snapshots.\"$SYMBOL\".prevDailyBar.c // 0")
    
    # Skip if data is missing or invalid
    if [ "$LATEST_VOLUME" = "null" ] || [ "$LATEST_VOLUME" = "0" ]; then
        echo "$TIMESTAMP - $SYMBOL: No volume data available"
        continue
    fi
    
    # Calculate volume ratio
    VOLUME_RATIO=$(echo "scale=2; $LATEST_VOLUME / $NORMAL_VOLUME" | bc -l)
    
    echo "$TIMESTAMP - $SYMBOL: Volume=$LATEST_VOLUME, Normal=$NORMAL_VOLUME, Ratio=${VOLUME_RATIO}x"
    
    # Check if volume exceeds alert threshold
    if (( $(echo "$LATEST_VOLUME > $ALERT_VOLUME" | bc -l) )); then
        # Calculate price change
        if [ "$PREV_CLOSE" != "null" ] && [ "$PREV_CLOSE" != "0" ]; then
            PRICE_CHANGE=$(echo "scale=2; (($LATEST_PRICE - $PREV_CLOSE) / $PREV_CLOSE) * 100" | bc -l)
            PRICE_DIRECTION=$(if (( $(echo "$PRICE_CHANGE > 0" | bc -l) )); then echo "UP"; elif (( $(echo "$PRICE_CHANGE < 0" | bc -l) )); then echo "DOWN"; else echo "FLAT"; fi)
        else
            PRICE_CHANGE="N/A"
            PRICE_DIRECTION="UNKNOWN"
        fi
        
        # Interpret the volume spike
        case "$PRICE_DIRECTION" in
            "UP")
                INTERPRETATION="Institutional buying (bullish)"
                TRADING_IMPLICATION="Consider buying momentum"
                ;;
            "DOWN")
                INTERPRETATION="Distribution (bearish)"
                TRADING_IMPLICATION="Consider selling pressure"
                ;;
            "FLAT")
                INTERPRETATION="Potential reversal"
                TRADING_IMPLICATION="Watch for breakout direction"
                ;;
            *)
                INTERPRETATION="Unclear - monitor closely"
                TRADING_IMPLICATION="Wait for confirmation"
                ;;
        esac
        
        # Create alert message
        ALERT_MSG="🔊 VOLUME SPIKE ALERT: $SYMBOL

📊 Volume: $(printf "%'d" $LATEST_VOLUME) vs $(printf "%'d" $NORMAL_VOLUME) normal (${VOLUME_RATIO}x)
💰 Price: $$LATEST_PRICE (${PRICE_CHANGE}% ${PRICE_DIRECTION})

🎯 Interpretation: $INTERPRETATION
📈 Trading Implication: $TRADING_IMPLICATION

⏰ $TIMESTAMP"
        
        ALERTS+=("$ALERT_MSG")
        echo "$TIMESTAMP - ALERT TRIGGERED for $SYMBOL"
    fi
done

# Send alerts if any were triggered
if [ ${#ALERTS[@]} -gt 0 ]; then
    for ALERT in "${ALERTS[@]}"; do
        # Send to Telegram
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"chat_id\":\"$ALERT_CHAT_ID\",\"text\":\"$ALERT\",\"parse_mode\":\"Markdown\"}" \
            "https://api.telegram.org/bot/sendMessage" || echo "Failed to send Telegram alert"
    done
fi

echo "$TIMESTAMP - Volume check completed"