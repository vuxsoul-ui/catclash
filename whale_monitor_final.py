#!/usr/bin/env python3
"""
Whale Options Flow Monitor - Production Version
Monitors ONDS, NVDA, SLS, VOO for whale options activity
Uses yfinance for reliable data fetching
"""

import asyncio
import json
import time
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/Users/charon/go/whale_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

# Stock configuration
STOCKS = {
    'ONDS': {
        'price': 8.48, 
        'note': 'Takeover rumors',
        'alerts': {
            'call_above': 20,  # Calls >$20 = takeover speculation
            'put_below': 8     # Puts <$8 = downside bets
        }
    },
    'NVDA': {
        'price': None, 
        'note': 'Feb 25 earnings',
        'alerts': {
            'call_above': 180,  # Institutional sweeps
            'earnings_date': '2025-02-25'
        }
    },
    'SLS': {
        'price': 3.52, 
        'note': 'Biotech - low volume normally',
        'alerts': {
            'any_unusual': True  # ANY activity is unusual
        }
    },
    'VOO': {
        'price': None, 
        'note': 'Institutional hedging',
        'alerts': {
            'protective_puts': True
        }
    }
}

# Alert thresholds
THRESHOLDS = {
    'block_trade': 500000,      # $500K
    'mega_trade': 1000000,      # $1M
    'volume_spike': 5,          # 5x average
    'call_put_high': 3.0,
    'call_put_low': 0.33
}

@dataclass
class WhaleAlert:
    alert_type: str
    priority: str
    symbol: str
    message: str
    details: Dict[str, Any]
    timestamp: str
    implications: str = ""

class WhaleOptionsMonitor:
    def __init__(self):
        self.alert_cooldowns: Dict[str, datetime] = {}
        self.volume_history: Dict[str, List[int]] = defaultdict(list)
        self.alert_log_path = Path('/Users/charon/go/whale_alerts.jsonl')
        self.stats = {'checks': 0, 'alerts': 0, 'errors': 0}
        
    def _get_cooldown_key(self, alert: WhaleAlert) -> str:
        """Generate cooldown key for rate limiting"""
        return f"{alert.symbol}_{alert.alert_type}_{alert.details.get('strike', '')}"
    
    def _is_on_cooldown(self, alert: WhaleAlert) -> bool:
        """Check if alert is on cooldown"""
        key = self._get_cooldown_key(alert)
        last_time = self.alert_cooldowns.get(key)
        if not last_time:
            return False
        # 5 minute cooldown per unique alert
        return (datetime.now() - last_time) < timedelta(minutes=5)
    
    def _set_cooldown(self, alert: WhaleAlert):
        """Set cooldown for alert"""
        key = self._get_cooldown_key(alert)
        self.alert_cooldowns[key] = datetime.now()
    
    def _log_alert(self, alert: WhaleAlert):
        """Log alert to file for main agent to process"""
        entry = {
            'timestamp': alert.timestamp,
            'chat_id': '8467656798',
            'alert_type': alert.alert_type,
            'priority': alert.priority,
            'symbol': alert.symbol,
            'message': alert.message,
            'details': alert.details,
            'implications': alert.implications
        }
        
        with open(self.alert_log_path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
        
        # Also print for visibility
        self._print_alert(alert)
    
    def _print_alert(self, alert: WhaleAlert):
        """Print alert to console"""
        emojis = {
            'CRITICAL': '⛔',
            'HIGH': '🔴', 
            'MEDIUM': '🟡',
            'LOW': '🟢'
        }
        emoji = emojis.get(alert.priority, '⚪')
        
        print(f"\n{'='*70}")
        print(f"{emoji} WHALE ALERT: {alert.alert_type}")
        print(f"{'='*70}")
        print(f"Symbol: ${alert.symbol}")
        print(f"Priority: {alert.priority}")
        print(f"Time: {alert.timestamp}")
        print(f"{'-'*70}")
        print(alert.message)
        if alert.implications:
            print(f"{'-'*70}")
            print(f"Smart Money: {alert.implications}")
        print(f"{'='*70}\n")
    
    def fetch_options_data(self, symbol: str) -> Tuple[Optional[float], List[Dict]]:
        """Fetch options data using yfinance"""
        try:
            import yfinance as yf
            
            ticker = yf.Ticker(symbol)
            
            # Get current price
            info = ticker.info
            current_price = info.get('regularMarketPrice') or info.get('currentPrice')
            
            # Get options chain
            expiry_dates = ticker.options
            if not expiry_dates:
                return current_price, []
            
            all_flows = []
            
            # Check first 3 expirations for activity
            for expiry in expiry_dates[:3]:
                try:
                    chain = ticker.option_chain(expiry)
                    
                    for opt_type, df in [('CALL', chain.calls), ('PUT', chain.puts)]:
                        for _, row in df.iterrows():
                            volume = row.get('volume', 0) or 0
                            if volume < 10:  # Skip low volume
                                continue
                            
                            strike = row.get('strike', 0)
                            last_price = row.get('lastPrice', 0)
                            oi = row.get('openInterest', 0) or 0
                            iv = row.get('impliedVolatility', 0) or 0
                            
                            # Calculate notional value
                            notional = volume * 100 * last_price
                            
                            if notional >= 50000:  # $50K minimum
                                flow = {
                                    'symbol': symbol,
                                    'strike': strike,
                                    'expiration': expiry,
                                    'option_type': opt_type,
                                    'volume': volume,
                                    'open_interest': oi,
                                    'last_price': last_price,
                                    'notional': notional,
                                    'implied_vol': iv,
                                    'timestamp': datetime.now().isoformat()
                                }
                                all_flows.append(flow)
                except Exception as e:
                    logger.debug(f"Error fetching {expiry}: {e}")
                    continue
            
            return current_price, sorted(all_flows, key=lambda x: x['notional'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error fetching {symbol}: {e}")
            self.stats['errors'] += 1
            return None, []
    
    def analyze_flows(self, symbol: str, current_price: float, flows: List[Dict]) -> List[WhaleAlert]:
        """Analyze flows for whale activity"""
        alerts = []
        
        if not flows:
            return alerts
        
        stock_config = STOCKS.get(symbol, {})
        specific_alerts = stock_config.get('alerts', {})
        
        # 1. Block trade detection
        for flow in flows:
            notional = flow['notional']
            
            if notional >= THRESHOLDS['block_trade']:
                is_mega = notional >= THRESHOLDS['mega_trade']
                alert_type = 'MEGA_WHALE' if is_mega else 'BLOCK_TRADE'
                priority = 'CRITICAL' if is_mega else 'HIGH'
                
                # Check OTM status
                is_otm = self._is_otm(flow, current_price)
                
                message = f"""
Strike: ${flow['strike']:.2f} {'(OTM)' if is_otm else '(ITM)'}
Type: {flow['option_type']}
Expiration: {flow['expiration']}
Premium: ${notional:,.0f}
Volume: {flow['volume']:,} contracts
OI: {flow['open_interest']:,}
IV: {flow['implied_vol']:.1%}
"""
                
                implications = self._get_implications(symbol, flow, current_price)
                
                # Check specific alerts
                special_note = ""
                if symbol == 'ONDS':
                    if flow['option_type'] == 'CALL' and flow['strike'] > specific_alerts.get('call_above', 20):
                        special_note = "🚨 TAKEOVER RUMOR: ONDS calls >$20 strike!"
                        priority = 'CRITICAL'
                    elif flow['option_type'] == 'PUT' and flow['strike'] < specific_alerts.get('put_below', 8):
                        special_note = "🚨 DOWNSIDE BET: ONDS puts <$8 strike!"
                
                elif symbol == 'NVDA' and flow['option_type'] == 'CALL' and flow['strike'] > specific_alerts.get('call_above', 180):
                    special_note = "🚨 INSTITUTIONAL SWEEP: NVDA calls >$180!"
                
                elif symbol == 'SLS':
                    special_note = "🚨 UNUSUAL ACTIVITY: SLS normally low volume!"
                    priority = 'CRITICAL'
                
                elif symbol == 'VOO' and flow['option_type'] == 'PUT':
                    special_note = "🚨 INSTITUTIONAL HEDGE: VOO protective puts!"
                
                if special_note:
                    message = special_note + "\n" + message
                
                alert = WhaleAlert(
                    alert_type=alert_type,
                    priority=priority,
                    symbol=symbol,
                    message=message,
                    details=flow,
                    timestamp=datetime.now().isoformat(),
                    implications=implications
                )
                alerts.append(alert)
        
        # 2. Same-expiration clustering
        exp_groups = defaultdict(list)
        for flow in flows:
            exp_groups[flow['expiration']].append(flow)
        
        for exp, group in exp_groups.items():
            total_premium = sum(f['notional'] for f in group)
            if total_premium >= THRESHOLDS['mega_trade']:
                calls = [f for f in group if f['option_type'] == 'CALL']
                puts = [f for f in group if f['option_type'] == 'PUT']
                
                strikes = [f['strike'] for f in group]
                strike_range = f"${min(strikes):.2f}-${max(strikes):.2f}"
                
                message = f"""
Expiration: {exp}
Total Premium: ${total_premium:,.0f}
Contracts: {len(group)}
Calls: {len(calls)} | Puts: {len(puts)}
Strike Range: {strike_range}
"""
                
                implications = f"Multi-strike positioning for {exp} = Major directional bet"
                
                alert = WhaleAlert(
                    alert_type='EXPIRATION_CLUSTER',
                    priority='HIGH',
                    symbol=symbol,
                    message=message,
                    details={
                        'expiration': exp,
                        'total_premium': total_premium,
                        'contracts': len(group),
                        'calls': len(calls),
                        'puts': len(puts),
                        'strike_range': strike_range
                    },
                    timestamp=datetime.now().isoformat(),
                    implications=implications
                )
                alerts.append(alert)
        
        # 3. Call/Put ratio
        calls_vol = sum(f['volume'] for f in flows if f['option_type'] == 'CALL')
        puts_vol = sum(f['volume'] for f in flows if f['option_type'] == 'PUT')
        
        if puts_vol > 0 and calls_vol > 0:
            ratio = calls_vol / puts_vol
            if ratio >= THRESHOLDS['call_put_high'] or ratio <= THRESHOLDS['call_put_low']:
                if ratio >= THRESHOLDS['call_put_high']:
                    alert_type = 'BULLISH_RATIO_SPIKE'
                    direction = 'BULLISH'
                    implications = f"Heavy call buying ({ratio:.1f}x puts) = Bullish sentiment"
                else:
                    alert_type = 'BEARISH_RATIO_SPIKE'
                    direction = 'BEARISH'
                    put_call_ratio = 1 / ratio
                    implications = f"Heavy put buying ({put_call_ratio:.1f}x calls) = Bearish/Hedging"
                
                message = f"""
Call Volume: {calls_vol:,}
Put Volume: {puts_vol:,}
Call/Put Ratio: {ratio:.2f}
Direction: {direction}
"""
                
                alert = WhaleAlert(
                    alert_type=alert_type,
                    priority='MEDIUM',
                    symbol=symbol,
                    message=message,
                    details={
                        'calls_volume': calls_vol,
                        'puts_volume': puts_vol,
                        'ratio': ratio
                    },
                    timestamp=datetime.now().isoformat(),
                    implications=implications
                )
                alerts.append(alert)
        
        return alerts
    
    def _is_otm(self, flow: Dict, current_price: float) -> bool:
        """Check if option is OTM"""
        if flow['option_type'] == 'CALL':
            return flow['strike'] > current_price
        else:
            return flow['strike'] < current_price
    
    def _get_implications(self, symbol: str, flow: Dict, price: float) -> str:
        """Generate smart money implications"""
        parts = []
        opt_type = flow['option_type']
        is_otm = self._is_otm(flow, price)
        
        if opt_type == 'CALL':
            if is_otm:
                pct = ((flow['strike'] / price - 1) * 100) if price > 0 else 0
                parts.append(f"OTM call buying = Leveraged bullish bet, expecting +{pct:.0f}% move")
            else:
                parts.append("ITM call buying = Direct bullish exposure")
            
            if symbol == 'NVDA':
                parts.append("Earnings play or AI momentum continuation")
            elif symbol == 'ONDS':
                parts.append("Possible M&A speculation or major contract win")
        
        else:  # PUT
            if is_otm:
                pct = ((1 - flow['strike'] / price) * 100) if price > 0 else 0
                parts.append(f"OTM put buying = Crash protection, expecting -{pct:.0f}% move")
            else:
                parts.append("ITM put buying = Direct bearish exposure")
            
            if symbol == 'VOO':
                parts.append("Market stress hedging by institutions")
            elif symbol == 'ONDS':
                parts.append("Downside protection against deal risk")
        
        return " | ".join(parts)
    
    def scan_symbol(self, symbol: str) -> List[WhaleAlert]:
        """Scan a single symbol"""
        logger.info(f"Scanning {symbol}...")
        
        current_price, flows = self.fetch_options_data(symbol)
        
        if current_price:
            STOCKS[symbol]['price'] = current_price
        
        if not flows:
            logger.info(f"  No significant flow found")
            return []
        
        logger.info(f"  Found {len(flows)} significant flows")
        for f in flows[:3]:
            logger.info(f"    {f['option_type']} ${f['strike']:.2f} | ${f['notional']:,.0f} | Vol: {f['volume']}")
        
        alerts = self.analyze_flows(symbol, current_price or 0, flows)
        return alerts
    
    def send_alert(self, alert: WhaleAlert) -> bool:
        """Send alert with cooldown check"""
        if self._is_on_cooldown(alert):
            return False
        
        self._log_alert(alert)
        self._set_cooldown(alert)
        self.stats['alerts'] += 1
        return True
    
    def run_scan(self):
        """Run one monitoring scan"""
        self.stats['checks'] += 1
        
        print(f"\n{'='*70}")
        print(f"🐋 WHALE OPTIONS SCAN #{self.stats['checks']}")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")
        
        for symbol in STOCKS:
            alerts = self.scan_symbol(symbol)
            
            for alert in alerts:
                sent = self.send_alert(alert)
                if sent:
                    logger.info(f"  Alert sent: {alert.alert_type}")
                else:
                    logger.info(f"  Alert on cooldown: {alert.alert_type}")
            
            time.sleep(1)  # Be nice to APIs
        
        print(f"\n{'='*70}")
        print(f"📊 Scan complete. Total alerts: {self.stats['alerts']}")
        print(f"{'='*70}\n")
    
    def run(self, interval: int = 300):
        """Run continuous monitoring"""
        print("\n" + "="*70)
        print("🐋 WHALE OPTIONS FLOW MONITOR")
        print("="*70)
        print(f"Monitoring: {', '.join(STOCKS.keys())}")
        print(f"Interval: {interval}s (5 minutes)")
        print(f"Alert target: telegram:8467656798")
        print(f"Block threshold: ${THRESHOLDS['block_trade']:,}")
        print(f"Mega threshold: ${THRESHOLDS['mega_trade']:,}")
        print("="*70 + "\n")
        
        while True:
            try:
                self.run_scan()
            except Exception as e:
                logger.error(f"Scan error: {e}")
                self.stats['errors'] += 1
            
            print(f"⏳ Next scan in {interval} seconds...")
            time.sleep(interval)


def main():
    monitor = WhaleOptionsMonitor()
    try:
        monitor.run()
    except KeyboardInterrupt:
        print("\n\n👋 Monitor stopped")
        print(f"Final stats: {monitor.stats}")


if __name__ == "__main__":
    main()
