#!/usr/bin/env python3
"""
Volume Spike Monitor for Stocks
Monitors ONDS, NVDA, SLS, VOO for volume spikes above thresholds
Uses only built-in Python libraries for portability
"""

import os
import json
import time
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Optional, List

# Alpaca API Configuration
ALPACA_API_KEY = "PKE4SFLVE6CW6SNWRMVREF33N3"
ALPACA_SECRET_KEY = "8LixqL1466MSqGrVdGknZiPKXq195AUsJ4MVMMTi1Zo6"
ALPACA_DATA_URL = "https://data.alpaca.markets"

# Telegram Configuration
TELEGRAM_CHAT_ID = "8467656798"

# Stock thresholds
THRESHOLDS = {
    "ONDS": 300_000,
    "NVDA": 400_000_000,
    "SLS": 15_000_000,
    "VOO": 300_000
}

# State file to track volume history
STATE_FILE = ".volume_monitor_state.json"
ALERT_LOG_FILE = ".volume_alerts.jsonl"

def load_state() -> Dict:
    """Load previous volume data from state file"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_state(state: Dict):
    """Save volume data to state file"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def make_api_request(url: str, headers: Dict = None) -> Optional[Dict]:
    """Make HTTP request using urllib"""
    try:
        req = urllib.request.Request(url)
        if headers:
            for key, value in headers.items():
                req.add_header(key, value)
        
        # Create SSL context that allows us to connect
        context = ssl.create_default_context()
        
        with urllib.request.urlopen(req, context=context, timeout=15) as response:
            data = response.read().decode('utf-8')
            return json.loads(data)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error body: {error_body}")
        except:
            pass
    except Exception as e:
        print(f"Request error: {e}")
    return None

def get_stock_data(symbol: str) -> Optional[Dict]:
    """Fetch latest snapshot data from Alpaca"""
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }
    
    url = f"{ALPACA_DATA_URL}/v2/stocks/{symbol}/snapshot"
    return make_api_request(url, headers)

def get_historical_bars(symbol: str, days: int = 20) -> List[Dict]:
    """Get historical daily bars for average volume calculation"""
    headers = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
    }
    
    end = datetime.now()
    start = end - timedelta(days=days + 5)  # Add buffer for weekends
    
    url = f"{ALPACA_DATA_URL}/v2/stocks/{symbol}/bars"
    params = f"?timeframe=1Day&start={start.strftime('%Y-%m-%d')}&end={end.strftime('%Y-%m-%d')}&limit={days}"
    
    result = make_api_request(url + params, headers)
    if result:
        return result.get("bars", [])
    return []

def calculate_average_volume(bars: List[Dict]) -> float:
    """Calculate average volume from historical bars, excluding recent extremes"""
    if not bars:
        return 0
    volumes = [bar.get("v", 0) for bar in bars]
    # Exclude today from average calculation
    if len(volumes) > 1:
        volumes = volumes[:-1]
    
    if not volumes:
        return 0
    
    # Remove top 10% highest volume days to avoid skewing from recent spikes
    volumes_sorted = sorted(volumes)
    trim_count = max(1, int(len(volumes_sorted) * 0.1))
    trimmed_volumes = volumes_sorted[:-trim_count] if len(volumes_sorted) > trim_count else volumes_sorted
    
    return sum(trimmed_volumes) / len(trimmed_volumes) if trimmed_volumes else 0

def get_price_change(snapshot: Dict) -> tuple:
    """Extract price change information from snapshot"""
    daily_bar = snapshot.get("dailyBar", {})
    prev_daily_bar = snapshot.get("prevDailyBar", {})
    
    current = daily_bar.get("c", 0)
    open_price = daily_bar.get("o", 0)
    prev_close = prev_daily_bar.get("c", 0)
    
    # Calculate change from previous close
    if prev_close > 0:
        change_pct = ((current - prev_close) / prev_close) * 100
        return current, change_pct, open_price
    
    # Fallback to change from open
    if open_price > 0:
        change_pct = ((current - open_price) / open_price) * 100
        return current, change_pct, open_price
    
    return current, 0, open_price

def interpret_spike(symbol: str, volume_ratio: float, price_change: float, current: float, open_price: float) -> str:
    """Provide trading interpretation based on volume spike and price action"""
    interpretations = []
    
    # Volume interpretation
    if volume_ratio > 10:
        interpretations.append("🔥 EXTREME volume spike - Unusual institutional activity detected")
    elif volume_ratio > 5:
        interpretations.append("📈 Major volume spike - Significant interest")
    elif volume_ratio > 3:
        interpretations.append("⚠️ Notable volume increase - Above normal activity")
    else:
        interpretations.append("📊 Elevated volume - Watch for continuation")
    
    # Price + Volume interpretation
    if price_change > 5 and volume_ratio > 3:
        interpretations.append("💪 Breakout pattern - High volume confirms bullish move")
    elif price_change > 2 and volume_ratio > 2:
        interpretations.append("🚀 Momentum building - Buyers in control")
    elif price_change < -5 and volume_ratio > 3:
        interpretations.append("😰 Capitulation selling - Heavy distribution")
    elif price_change < -2 and volume_ratio > 2:
        interpretations.append("📉 Distribution pattern - Selling pressure")
    elif abs(price_change) < 1 and volume_ratio > 3:
        interpretations.append("🤔 Potential reversal setup - High volume, price stagnant")
    
    # Additional context based on intraday action
    if current > 0 and open_price > 0:
        if current > open_price * 1.03 and volume_ratio > 2:
            interpretations.append("📊 Bullish intraday action - Closing strong")
        elif current < open_price * 0.97 and volume_ratio > 2:
            interpretations.append("📊 Bearish intraday action - Closing weak")
    
    # Symbol-specific context
    if symbol == "NVDA":
        interpretations.append("💻 AI/semiconductor sector - Watch for sector rotation")
    elif symbol == "VOO":
        interpretations.append("🏛️ S&P 500 ETF - Broad market implications")
    elif symbol == "ONDS":
        interpretations.append("💊 Small-cap biotech - High volatility expected")
    elif symbol == "SLS":
        interpretations.append("🧬 Clinical-stage biotech - News-driven catalyst likely")
    
    return "\n".join(interpretations)

def send_telegram_alert(message: str):
    """Send alert via Telegram by writing to a file for OpenClaw to process"""
    timestamp = datetime.now().isoformat()
    
    # Log the alert
    alert_entry = {
        "timestamp": timestamp,
        "chat_id": TELEGRAM_CHAT_ID,
        "message": message
    }
    
    with open(ALERT_LOG_FILE, "a") as f:
        f.write(json.dumps(alert_entry) + "\n")
    
    print(f"Alert logged to {ALERT_LOG_FILE}")
    print(f"Message preview: {message[:100]}...")

def format_volume(volume: int) -> str:
    """Format volume with appropriate suffix"""
    if volume >= 1_000_000_000:
        return f"{volume/1_000_000_000:.2f}B"
    elif volume >= 1_000_000:
        return f"{volume/1_000_000:.2f}M"
    elif volume >= 1_000:
        return f"{volume/1_000:.2f}K"
    return str(volume)

def check_stock(symbol: str, state: Dict) -> Optional[str]:
    """Check a single stock for volume spike"""
    threshold = THRESHOLDS.get(symbol, 0)
    
    print(f"Checking {symbol}...")
    
    # Get current data
    snapshot = get_stock_data(symbol)
    if not snapshot:
        print(f"  No snapshot data available for {symbol}")
        return None
    
    # Extract current volume from daily bar
    daily_bar = snapshot.get("dailyBar", {})
    current_volume = daily_bar.get("v", 0)
    current_price = daily_bar.get("c", 0)
    
    print(f"  Current volume: {format_volume(current_volume)}, Threshold: {format_volume(threshold)}")
    
    # Get historical data for average
    hist_bars = get_historical_bars(symbol, days=20)
    avg_volume = calculate_average_volume(hist_bars)
    
    print(f"  Average volume (20d): {format_volume(avg_volume)}")
    
    # Store in state
    symbol_state = state.get(symbol, {})
    symbol_state["last_volume"] = current_volume
    symbol_state["last_check"] = datetime.now().isoformat()
    symbol_state["avg_volume"] = avg_volume
    state[symbol] = symbol_state
    
    # Check if volume exceeds threshold
    if current_volume < threshold:
        print(f"  Below threshold - no alert")
        return None
    
    # Check if we already alerted for this volume level (avoid duplicates)
    last_alert_volume = symbol_state.get("last_alert_volume", 0)
    if current_volume <= last_alert_volume * 1.1:  # 10% buffer
        print(f"  Already alerted for similar volume - skipping")
        return None
    
    # Update last alert volume
    symbol_state["last_alert_volume"] = current_volume
    
    # Calculate metrics
    volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0
    price, change_pct, open_price = get_price_change(snapshot)
    
    # Format alert message
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S PST")
    
    message = f"""🚨 VOLUME SPIKE ALERT: {symbol} 🚨
⏰ {timestamp}

📊 Volume Analysis:
• Current Volume: {format_volume(current_volume)}
• 20-Day Avg Volume: {format_volume(avg_volume)}
• Spike Ratio: {volume_ratio:.1f}x average
• Threshold: {format_volume(threshold)}

💰 Price Action:
• Current Price: ${price:.2f}
• Change: {change_pct:+.2f}%

📝 Trading Interpretation:
{interpret_spike(symbol, volume_ratio, change_pct, price, open_price)}

⚡ Action: Monitor for continuation or reversal"""
    
    return message

def main():
    """Main monitoring function"""
    print(f"[{datetime.now()}] Starting volume spike check...")
    print(f"Monitoring: {', '.join(THRESHOLDS.keys())}")
    print("-" * 50)
    
    # Load previous state
    state = load_state()
    
    # Check each stock
    alerts_sent = 0
    for symbol in THRESHOLDS.keys():
        try:
            alert = check_stock(symbol, state)
            if alert:
                print(f"  ✓ Volume spike detected for {symbol}!")
                send_telegram_alert(alert)
                alerts_sent += 1
            print()
        except Exception as e:
            print(f"  ✗ Error checking {symbol}: {e}")
            import traceback
            traceback.print_exc()
        
        # Small delay between requests to avoid rate limiting
        time.sleep(1)
    
    # Save state
    save_state(state)
    
    print("-" * 50)
    print(f"[{datetime.now()}] Check complete. Alerts sent: {alerts_sent}")

if __name__ == "__main__":
    main()
