#!/usr/bin/env python3
"""
Send Volume Alerts to Telegram
Processes alert queue and sends via OpenClaw message tool
"""

import json
import subprocess
import os
from datetime import datetime

ALERT_FILE = ".volume_alerts.jsonl"
ALERT_FILE_SENT = ".volume_alerts_sent.jsonl"

def send_telegram_message(chat_id: str, message: str) -> bool:
    """Send message using OpenClaw CLI"""
    try:
        result = subprocess.run(
            ["openclaw", "message", "send", "--target", chat_id, "--message", message],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error sending message: {e}")
        return False

def process_alerts():
    """Process pending alerts"""
    if not os.path.exists(ALERT_FILE):
        print("No pending alerts")
        return
    
    pending = []
    sent = []
    
    # Read pending alerts
    with open(ALERT_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                alert = json.loads(line)
                pending.append(alert)
            except json.JSONDecodeError:
                continue
    
    if not pending:
        print("No valid alerts to process")
        return
    
    print(f"Found {len(pending)} pending alerts")
    
    # Process each alert
    for alert in pending:
        chat_id = alert.get("chat_id")
        message = alert.get("message")
        
        if not chat_id or not message:
            continue
        
        print(f"Sending alert to {chat_id}...")
        
        if send_telegram_message(chat_id, message):
            print("  ✓ Sent successfully")
            alert["sent_at"] = datetime.now().isoformat()
            sent.append(alert)
        else:
            print("  ✗ Failed to send")
    
    # Clear pending file
    os.remove(ALERT_FILE)
    
    # Append to sent file
    if sent:
        with open(ALERT_FILE_SENT, 'a') as f:
            for alert in sent:
                f.write(json.dumps(alert) + "\n")
        print(f"Sent {len(sent)} alerts")

if __name__ == "__main__":
    process_alerts()
