#!/bin/bash

# Volume Spike Detector for ONDS, NVDA, SLS, VOO
# Uses Alpaca API to monitor for unusual volume activity

API_KEY="PKE4SFLVE6CW6SNWRMVREF33N3"
API_SECRET="8LixqL1466MSqGrVdGknZiPKXq195AUsJ4MVMMTi1Zo6"
ALERT_TARGET="8467656798"

# Stock thresholds (volume and multipliers)
declare -A NORMAL_VOLUME=(
    ["ONDS"]="100000"
    ["NVDA"]="160000000"
    ["SLS"]="5000000"
    ["VOO"]="100000"
)

declare -A ALERT_MULTIPLIER=(
    ["ONDS"]="3"
    ["NVDA"]="2.5"
    ["SLS"]="3"
    ["VOO"]="3"
)

# Get current data from Alpaca
get_stock_data() {
    local symbols="ONDS,NVDA,SLS,VOO"
    local url="https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols}&feed=iex"
    
    curl -s -X GET \
        -H "APCA-API-KEY-ID: ${API_KEY}" \
        -H "APCA-API-SECRET-KEY: ${API_SECRET}" \
        "${url}"
}

# Calculate percentage change
calc_pct_change() {
    local current=$1
    previous=$2
    echo "scale=2; (($current - $previous) / $previous) * 100" | bc
}

# Send Telegram alert
send_alert() {
    local symbol=$1
    local current_volume=$2
    local normal_volume=$3
    local volume_multiplier=$4
    local price_change_pct=$5
    local interpretation=$6
    local trading_implication=$7
    
    local message="🚨 VOLUME SPIKE ALERT: ${symbol}

📊 Volume: $(printf "%,d" ${current_volume}) vs $(printf "%,d" ${normal_volume}) avg (${volume_multiplier}x normal)
💰 Price: ${price_change_pct}% change

🔍 Interpretation: ${interpretation}
⚡ Trading Implication: ${trading_implication}

Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"

    # Use OpenClaw message system to send alert
    openclaw message send --target "${ALERT_TARGET}" --message "${message}"
}

# Main monitoring logic
main() {
    echo "Volume Spike Monitor - $(date)"
    
    # Get current stock data
    local data=$(get_stock_data)
    if [[ -z "$data" || "$data" == *"error"* ]]; then
        echo "Error fetching data from Alpaca API"
        return 1
    fi
    
    # Process each stock
    for symbol in ONDS NVDA SLS VOO; do
        # Extract current volume and price data (simplified parsing)
        # Note: This is a basic implementation - you'd need proper JSON parsing
        local current_volume=$(echo "$data" | grep -o "\"${symbol}\".*" | head -1 | grep -o '"v":[0-9]*' | head -1 | cut -d: -f2)
        local current_price=$(echo "$data" | grep -o "\"${symbol}\".*" | head -1 | grep -o '"c":[0-9.]*' | head -1 | cut -d: -f2)
        
        if [[ -n "$current_volume" && "$current_volume" -gt 0 ]]; then
            local normal_vol=${NORMAL_VOLUME[$symbol]}
            local alert_mult=${ALERT_MULTIPLIER[$symbol]}
            local alert_threshold=$(echo "$normal_vol * $alert_mult" | bc)
            
            echo "${symbol}: Volume $(printf "%,d" ${current_volume}) vs $(printf "%,d" ${normal_vol}) normal"
            
            # Check if volume exceeds threshold
            if [[ "$current_volume" -gt "$alert_threshold" ]]; then
                local volume_multiplier=$(echo "scale=1; $current_volume / $normal_vol" | bc)
                
                # Calculate price change (simplified - would need previous close)
                local price_change_pct="0.0" # Placeholder
                
                # Determine interpretation based on price action
                local interpretation=""
                local trading_implication=""
                
                if (( $(echo "$price_change_pct > 0" | bc -l) )); then
                    interpretation="Institutional buying activity detected"
                    trading_implication="Bullish signal - consider momentum continuation"
                elif (( $(echo "$price_change_pct < 0" | bc -l) )); then
                    interpretation="Distribution pattern - institutional selling"
                    trading_implication="Bearish signal - potential downside pressure"
                else
                    interpretation="High volume with flat price action"
                    trading_implication="Potential reversal signal - watch for breakout direction"
                fi
                
                send_alert "$symbol" "$current_volume" "$normal_vol" "$volume_multiplier" "$price_change_pct" "$interpretation" "$trading_implication"
                echo "Alert sent for ${symbol}"
            fi
        fi
    done
    
    echo "Volume check completed"
}

# Run the monitor
main