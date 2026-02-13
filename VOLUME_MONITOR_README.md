# Volume Spike Monitor

Real-time volume spike monitoring for ONDS, NVDA, SLS, VOO stocks using Alpaca API.

## Stocks Monitored

| Symbol | Threshold | Description |
|--------|-----------|-------------|
| ONDS   | >300K     | Small-cap biotech |
| NVDA   | >400M     | AI/Semiconductor leader |
| SLS    | >15M      | Clinical-stage biotech |
| VOO    | >300K     | S&P 500 ETF |

## How It Works

1. **Checks every 5 minutes** during market hours
2. Compares current volume against:
   - Fixed threshold (configurable per stock)
   - 20-day adjusted average volume (top 10% spike days excluded)
3. Sends Telegram alerts with:
   - Volume comparison
   - Price action context
   - Trading interpretation

## Setup

### 1. Install

```bash
cd /Users/charon/go
chmod +x run_volume_monitor.sh send_volume_alerts.py volume_spike_monitor.py
```

### 2. Add to Cron (runs every 5 minutes)

```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * cd /Users/charon/go && ./run_volume_monitor.sh >> volume_monitor.log 2>&1
```

### 3. Or run manually

```bash
# Single check
python3 volume_spike_monitor.py

# With alert sending
./run_volume_monitor.sh
```

## Files

- `volume_spike_monitor.py` - Main monitoring script
- `send_volume_alerts.py` - Telegram alert sender
- `run_volume_monitor.sh` - Cron wrapper script
- `.volume_monitor_state.json` - Volume history state
- `.volume_alerts.jsonl` - Pending alerts queue
- `.volume_alerts_sent.jsonl` - Sent alerts log
- `volume_monitor.log` - Runtime logs

## Telegram Alerts

Alerts are sent to: `8467656798`

Alert includes:
- 🚨 Volume spike notification
- 📊 Volume analysis (current vs average vs threshold)
- 💰 Price action (current price, % change)
- 📝 Trading interpretation (breakouts, reversals, etc.)

## Configuration

Edit thresholds in `volume_spike_monitor.py`:

```python
THRESHOLDS = {
    "ONDS": 300_000,
    "NVDA": 400_000_000,
    "SLS": 15_000_000,
    "VOO": 300_000
}
```

## API Keys

Uses Alpaca Paper Trading API:
- Key: `PKE4SFLVE6CW6SNWRMVREF33N3`
- Secret: `8LixqL1466MSqGrVdGknZiPKXq195AUsJ4MVMMTi1Zo6`

## Logs

View recent activity:
```bash
tail -f volume_monitor.log
```

View sent alerts:
```bash
cat .volume_alerts_sent.jsonl | tail -20
```
