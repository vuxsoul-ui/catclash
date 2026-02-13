#!/usr/bin/env python3
"""
Whale Alert Sender
Reads alerts from whale_alerts.jsonl and sends to Telegram
This can be called by the main agent or run as a companion process
"""

import json
import sys
from pathlib import Path
from datetime import datetime

def read_pending_alerts(log_path: str = '/Users/charon/go/whale_alerts.jsonl', clear_after: bool = False):
    """Read pending alerts from the log file"""
    path = Path(log_path)
    if not path.exists():
        return []
    
    alerts = []
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    alerts.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    
    if clear_after:
        path.write_text('')
    
    return alerts

def format_alert_for_telegram(alert: dict) -> str:
    """Format alert as Telegram message"""
    priority_emoji = {
        'CRITICAL': '⛔',
        'HIGH': '🔴',
        'MEDIUM': '🟡',
        'LOW': '🟢'
    }.get(alert.get('priority'), '⚪')
    
    alert_type = alert.get('alert_type', 'UNKNOWN')
    symbol = alert.get('symbol', 'UNKNOWN')
    
    type_emoji = {
        'MEGA_WHALE': '🐋🐋🐋',
        'BLOCK_TRADE': '🐋',
        'EXPIRATION_CLUSTER': '🎯',
        'BULLISH_RATIO_SPIKE': '🟢',
        'BEARISH_RATIO_SPIKE': '🔴',
        'ONDS_TAKEOVER_RUMOR': '🔥',
        'NVDA_INSTITUTIONAL_SWEEP': '🚀',
        'SLS_CATALYST_LEAK': '🧬',
        'VOO_INSTITUTIONAL_HEDGE': '🛡️'
    }.get(alert_type, '📢')
    
    msg = f"{type_emoji} {priority_emoji} <b>{alert_type}</b>\n"
    msg += f"Stock: <code>${symbol}</code>\n"
    msg += "─" * 25 + "\n"
    msg += alert.get('message', '')
    
    if alert.get('implications'):
        msg += f"\n📊 <b>Smart Money:</b>\n{alert['implications']}\n"
    
    return msg

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Send whale alerts to Telegram')
    parser.add_argument('--read', action='store_true', help='Read and format all pending alerts')
    parser.add_argument('--clear', action='store_true', help='Clear log after reading')
    parser.add_argument('--count', action='store_true', help='Count pending alerts')
    
    args = parser.parse_args()
    
    log_path = '/Users/charon/go/whale_alerts.jsonl'
    
    if args.count:
        alerts = read_pending_alerts(log_path, clear_after=False)
        print(f"Pending alerts: {len(alerts)}")
        return
    
    if args.read:
        alerts = read_pending_alerts(log_path, clear_after=args.clear)
        
        if not alerts:
            print("No pending alerts")
            return
        
        print(f"Found {len(alerts)} alerts:\n")
        for alert in alerts:
            print(format_alert_for_telegram(alert))
            print("\n" + "="*50 + "\n")
        
        return
    
    # Default: show help
    parser.print_help()

if __name__ == '__main__':
    main()
