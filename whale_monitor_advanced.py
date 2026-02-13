#!/usr/bin/env python3
"""
Advanced Whale Options Flow Monitor
Uses multiple data sources including web scraping for real-time flow
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
import aiohttp
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Stock configurations
STOCKS = {
    'ONDS': {'price': 8.48, 'note': 'Takeover rumors', 'sector': 'Tech'},
    'NVDA': {'price': None, 'note': 'Feb 25 earnings', 'sector': 'Semiconductors'},
    'SLS': {'price': 3.52, 'note': 'Biotech - low volume normally', 'sector': 'Biotech'},
    'VOO': {'price': None, 'note': 'Institutional hedging', 'sector': 'ETF'}
}

# Alert thresholds
THRESHOLDS = {
    'block_trade': 500000,      # $500K
    'mega_trade': 1000000,      # $1M
    'unusual_volume': 3,        # 3x average
    'volume_spike': 5,          # 5x volume
    'call_put_high': 3.0,       # Call/Put > 3
    'call_put_low': 0.33        # Put/Call > 3 (inverse)
}

# Specific stock alerts
SPECIFIC_ALERTS = {
    'ONDS': {
        'call_above': 20,      # Calls >$20 = takeover speculation
        'put_below': 8,        # Puts <$8 = downside bets
    },
    'NVDA': {
        'call_above': 180,     # Institutional sweeps
        'earnings': '2025-02-25'
    },
    'SLS': {
        'any_activity': True   # ANY unusual activity
    }
}

@dataclass
class OptionsFlow:
    symbol: str
    strike: float
    expiration: str
    option_type: str
    premium: float
    volume: int
    open_interest: int
    implied_volatility: float = 0
    delta: float = 0
    timestamp: str = ""
    exchange: str = ""
    
    def is_otm(self, underlying_price: float) -> bool:
        if self.option_type == 'CALL':
            return self.strike > underlying_price
        else:
            return self.strike < underlying_price

class OptionsDataSource:
    """Base class for options data sources"""
    
    async def fetch_flow(self, symbol: str) -> List[OptionsFlow]:
        raise NotImplementedError

class YahooFinanceSource(OptionsDataSource):
    """Fetch options data from Yahoo Finance"""
    
    BASE_URL = "https://query1.finance.yahoo.com/v7/finance/options/"
    
    async def fetch_flow(self, symbol: str) -> List[OptionsFlow]:
        flows = []
        try:
            url = f"{self.BASE_URL}{symbol}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=15) as resp:
                    if resp.status != 200:
                        return flows
                    data = await resp.json()
            
            result = data.get('optionChain', {}).get('result', [{}])[0]
            quote = result.get('quote', {})
            underlying_price = quote.get('regularMarketPrice', 0)
            
            options_data = result.get('options', [])
            
            for opt_group in options_data:
                for opt_type, contracts in [('CALL', opt_group.get('calls', [])), 
                                            ('PUT', opt_group.get('puts', []))]:
                    for contract in contracts:
                        volume = contract.get('volume', 0) or 0
                        if volume == 0:
                            continue
                            
                        strike = contract.get('strike', 0)
                        last_price = contract.get('lastPrice', 0)
                        oi = contract.get('openInterest', 0) or 0
                        iv = contract.get('impliedVolatility', 0) or 0
                        
                        # Calculate premium
                        premium = volume * 100 * last_price
                        
                        # Only include significant trades
                        if premium >= 100000:  # $100K minimum
                            flow = OptionsFlow(
                                symbol=symbol,
                                strike=strike,
                                expiration=contract.get('expiration', ''),
                                option_type=opt_type,
                                premium=premium,
                                volume=volume,
                                open_interest=oi,
                                implied_volatility=iv,
                                timestamp=datetime.now().isoformat()
                            )
                            flows.append(flow)
                            
        except Exception as e:
            logger.error(f"YahooFinance error for {symbol}: {e}")
            
        return sorted(flows, key=lambda x: x.premium, reverse=True)

class AlphaVantageSource(OptionsDataSource):
    """Alpha Vantage API (requires API key)"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.base_url = "https://www.alphavantage.co/query"
    
    async def fetch_flow(self, symbol: str) -> List[OptionsFlow]:
        if not self.api_key:
            return []
        
        flows = []
        try:
            url = f"{self.base_url}?function=HISTORICAL_OPTIONS&symbol={symbol}&apikey={self.api_key}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=15) as resp:
                    if resp.status != 200:
                        return flows
                    data = await resp.json()
            
            # Parse Alpha Vantage format
            for entry in data.get('data', []):
                volume = int(entry.get('volume', 0))
                if volume < 100:
                    continue
                    
                premium = volume * 100 * float(entry.get('strike', 0))  # Approximation
                
                flow = OptionsFlow(
                    symbol=symbol,
                    strike=float(entry.get('strike', 0)),
                    expiration=entry.get('expiration', ''),
                    option_type=entry.get('type', 'CALL').upper(),
                    premium=premium,
                    volume=volume,
                    open_interest=int(entry.get('open_interest', 0)),
                    timestamp=entry.get('timestamp', datetime.now().isoformat())
                )
                flows.append(flow)
                
        except Exception as e:
            logger.error(f"AlphaVantage error for {symbol}: {e}")
            
        return flows

class WhaleAlertEngine:
    """Detect whale activity patterns"""
    
    def __init__(self):
        self.volume_history: Dict[str, List[int]] = defaultdict(list)
        self.price_cache: Dict[str, float] = {}
        
    def update_price(self, symbol: str, price: float):
        self.price_cache[symbol] = price
        
    def detect_whale_activity(self, symbol: str, flows: List[OptionsFlow]) -> List[Dict]:
        """Detect various whale activity patterns"""
        alerts = []
        price = self.price_cache.get(symbol, STOCKS.get(symbol, {}).get('price', 0))
        
        if not flows:
            return alerts
            
        # 1. Block trade detection
        for flow in flows:
            if flow.premium >= THRESHOLDS['block_trade']:
                alert = self._create_block_alert(symbol, flow, price)
                alerts.append(alert)
        
        # 2. Same expiration clustering
        exp_groups = defaultdict(list)
        for flow in flows:
            exp_groups[flow.expiration].append(flow)
        
        for exp, group in exp_groups.items():
            total_premium = sum(f.premium for f in group)
            if total_premium >= THRESHOLDS['mega_trade']:
                alert = self._create_cluster_alert(symbol, exp, group)
                alerts.append(alert)
        
        # 3. Call/Put ratio analysis
        calls = sum(f.volume for f in flows if f.option_type == 'CALL')
        puts = sum(f.volume for f in flows if f.option_type == 'PUT')
        
        if puts > 0 and calls > 0:
            ratio = calls / puts
            if ratio >= THRESHOLDS['call_put_high'] or ratio <= THRESHOLDS['call_put_low']:
                alert = self._create_ratio_alert(symbol, ratio, calls, puts)
                alerts.append(alert)
        
        # 4. OTM sweep detection
        otm_flows = [f for f in flows if f.is_otm(price)]
        otm_premium = sum(f.premium for f in otm_flows)
        if otm_premium >= THRESHOLDS['block_trade']:
            alert = self._create_otm_alert(symbol, otm_flows, otm_premium, price)
            alerts.append(alert)
        
        # 5. Stock-specific alerts
        specific = self._check_specific_alerts(symbol, flows, price)
        alerts.extend(specific)
        
        return alerts
    
    def _create_block_alert(self, symbol: str, flow: OptionsFlow, price: float) -> Dict:
        is_mega = flow.premium >= THRESHOLDS['mega_trade']
        
        alert = {
            'type': 'MEGA_WHALE' if is_mega else 'BLOCK_TRADE',
            'priority': 'HIGH' if is_mega else 'MEDIUM',
            'symbol': symbol,
            'strike': flow.strike,
            'expiration': flow.expiration,
            'option_type': flow.option_type,
            'premium': flow.premium,
            'volume': flow.volume,
            'open_interest': flow.open_interest,
            'implied_vol': flow.implied_volatility,
            'moneyness': 'OTM' if flow.is_otm(price) else 'ITM',
            'timestamp': flow.timestamp
        }
        
        # Add smart money context
        alert['implications'] = self._get_implications(symbol, flow, price)
        
        return alert
    
    def _create_cluster_alert(self, symbol: str, expiration: str, flows: List[OptionsFlow]) -> Dict:
        total_premium = sum(f.premium for f in flows)
        calls = [f for f in flows if f.option_type == 'CALL']
        puts = [f for f in flows if f.option_type == 'PUT']
        
        return {
            'type': 'EXPIRATION_CLUSTER',
            'priority': 'HIGH',
            'symbol': symbol,
            'expiration': expiration,
            'total_premium': total_premium,
            'num_contracts': len(flows),
            'calls': len(calls),
            'puts': len(puts),
            'strike_range': f"${min(f.strike for f in flows):.2f}-${max(f.strike for f in flows):.2f}",
            'implications': f"Multi-strike positioning for {expiration} = Major directional bet"
        }
    
    def _create_ratio_alert(self, symbol: str, ratio: float, calls: int, puts: int) -> Dict:
        if ratio >= THRESHOLDS['call_put_high']:
            return {
                'type': 'BULLISH_RATIO_SPIKE',
                'priority': 'MEDIUM',
                'symbol': symbol,
                'call_put_ratio': round(ratio, 2),
                'calls_volume': calls,
                'puts_volume': puts,
                'implications': f"Heavy call buying ({ratio:.1f}x puts) = Bullish sentiment"
            }
        else:
            put_call_ratio = 1 / ratio
            return {
                'type': 'BEARISH_RATIO_SPIKE',
                'priority': 'MEDIUM',
                'symbol': symbol,
                'put_call_ratio': round(put_call_ratio, 2),
                'calls_volume': calls,
                'puts_volume': puts,
                'implications': f"Heavy put buying ({put_call_ratio:.1f}x calls) = Bearish/Hedging"
            }
    
    def _create_otm_alert(self, symbol: str, flows: List[OptionsFlow], total_premium: float, price: float) -> Dict:
        calls = [f for f in flows if f.option_type == 'CALL']
        puts = [f for f in flows if f.option_type == 'PUT']
        
        return {
            'type': 'OTM_SWEEP',
            'priority': 'HIGH',
            'symbol': symbol,
            'total_premium': total_premium,
            'num_contracts': len(flows),
            'otm_calls': len(calls),
            'otm_puts': len(puts),
            'implications': "OTM positioning = Expecting large move, lower cost leverage"
        }
    
    def _check_specific_alerts(self, symbol: str, flows: List[OptionsFlow], price: float) -> List[Dict]:
        alerts = []
        
        if symbol == 'ONDS' and 'ONDS' in SPECIFIC_ALERTS:
            cfg = SPECIFIC_ALERTS['ONDS']
            for flow in flows:
                if flow.option_type == 'CALL' and flow.strike > cfg['call_above']:
                    alerts.append({
                        'type': 'ONDS_TAKEOVER_RUMOR',
                        'priority': 'CRITICAL',
                        'symbol': symbol,
                        'strike': flow.strike,
                        'premium': flow.premium,
                        'implications': f"🚨 CALL BUYING >${cfg['call_above']} - Takeover rumors!"
                    })
                elif flow.option_type == 'PUT' and flow.strike < cfg['put_below']:
                    alerts.append({
                        'type': 'ONDS_DOWNSIDE_BET',
                        'priority': 'HIGH',
                        'symbol': symbol,
                        'strike': flow.strike,
                        'premium': flow.premium,
                        'implications': f"🚨 PUT BUYING <${cfg['put_below']} - Downside protection"
                    })
        
        elif symbol == 'NVDA' and 'NVDA' in SPECIFIC_ALERTS:
            cfg = SPECIFIC_ALERTS['NVDA']
            for flow in flows:
                if flow.option_type == 'CALL' and flow.strike > cfg['call_above']:
                    alerts.append({
                        'type': 'NVDA_INSTITUTIONAL_SWEEP',
                        'priority': 'HIGH',
                        'symbol': symbol,
                        'strike': flow.strike,
                        'premium': flow.premium,
                        'implications': f"🚨 NVDA call sweep >${cfg['call_above']} - Institutional positioning"
                    })
        
        elif symbol == 'SLS' and 'SLS' in SPECIFIC_ALERTS:
            # Any significant activity in SLS is unusual
            total_premium = sum(f.premium for f in flows)
            if total_premium >= 100000:  # Lower threshold for SLS
                alerts.append({
                    'type': 'SLS_CATALYST_LEAK',
                    'priority': 'CRITICAL',
                    'symbol': symbol,
                    'total_premium': total_premium,
                    'implications': "🚨 SLS unusual activity - Potential catalyst leak (normally low volume)"
                })
        
        elif symbol == 'VOO':
            # Check for protective puts
            puts = [f for f in flows if f.option_type == 'PUT']
            put_premium = sum(f.premium for f in puts)
            if put_premium >= THRESHOLDS['block_trade']:
                alerts.append({
                    'type': 'VOO_INSTITUTIONAL_HEDGE',
                    'priority': 'HIGH',
                    'symbol': symbol,
                    'put_premium': put_premium,
                    'implications': "🚨 VOO protective put buying - Institutional hedging during market stress"
                })
        
        return alerts
    
    def _get_implications(self, symbol: str, flow: OptionsFlow, price: float) -> str:
        """Generate smart money implications"""
        implications = []
        
        if flow.option_type == 'CALL':
            if flow.is_otm(price):
                implications.append(f"OTM call buying = Leveraged bullish bet, expecting +{((flow.strike/price-1)*100):.0f}% move")
            else:
                implications.append("ITM call buying = Direct bullish exposure")
            
            if symbol == 'NVDA':
                implications.append("Earnings play or AI momentum continuation")
            elif symbol == 'ONDS':
                implications.append("Possible M&A speculation or major contract")
                
        else:  # PUT
            if flow.is_otm(price):
                implications.append(f"OTM put buying = Crash protection, expecting -{((1-flow.strike/price)*100):.0f}% move")
            else:
                implications.append("ITM put buying = Direct bearish exposure")
            
            if symbol == 'VOO':
                implications.append("Market stress hedging by institutions")
            elif symbol == 'ONDS':
                implications.append("Downside protection against deal risk")
        
        return " | ".join(implications)

class TelegramAlerter:
    """Handles sending alerts to Telegram via main agent"""
    
    def __init__(self, chat_id: str = "8467656798"):
        self.chat_id = chat_id
        self.alert_history: List[Dict] = []
        self.cooldowns: Dict[str, datetime] = {}
        
    async def send_alert(self, alert: Dict) -> bool:
        """Send alert with cooldown to avoid spam"""
        # Cooldown key based on alert type and symbol
        cooldown_key = f"{alert.get('symbol')}_{alert.get('type')}"
        
        now = datetime.now()
        last_alert = self.cooldowns.get(cooldown_key)
        
        # 2 minute cooldown per alert type
        if last_alert and (now - last_alert) < timedelta(minutes=2):
            return False
        
        message = self._format_message(alert)
        
        # Log the alert (main agent will pick this up)
        self._log_alert(message, alert)
        
        self.cooldowns[cooldown_key] = now
        self.alert_history.append({'time': now, 'alert': alert})
        
        return True
    
    def _format_message(self, alert: Dict) -> str:
        """Format alert for Telegram"""
        symbol = alert.get('symbol', 'UNKNOWN')
        alert_type = alert.get('type', 'UNKNOWN')
        priority = alert.get('priority', 'LOW')
        
        # Emoji mapping
        emojis = {
            'MEGA_WHALE': '🐋🐋🐋',
            'BLOCK_TRADE': '🐋',
            'EXPIRATION_CLUSTER': '🎯',
            'BULLISH_RATIO_SPIKE': '🟢',
            'BEARISH_RATIO_SPIKE': '🔴',
            'OTM_SWEEP': '⚡',
            'ONDS_TAKEOVER_RUMOR': '🔥',
            'ONDS_DOWNSIDE_BET': '🔻',
            'NVDA_INSTITUTIONAL_SWEEP': '🚀',
            'SLS_CATALYST_LEAK': '🧬',
            'VOO_INSTITUTIONAL_HEDGE': '🛡️'
        }
        
        emoji = emojis.get(alert_type, '📢')
        priority_emoji = {'CRITICAL': '⛔', 'HIGH': '🔴', 'MEDIUM': '🟡', 'LOW': '🟢'}.get(priority, '⚪')
        
        msg = f"{emoji} {priority_emoji} {alert_type}\n"
        msg += f"Stock: ${symbol}\n"
        msg += "─" * 30 + "\n"
        
        # Add relevant fields
        if 'strike' in alert:
            msg += f"Strike: ${alert['strike']:.2f}\n"
        if 'expiration' in alert:
            msg += f"Expiration: {alert['expiration']}\n"
        if 'option_type' in alert:
            msg += f"Type: {alert['option_type']}\n"
        if 'premium' in alert:
            msg += f"Premium: ${alert['premium']:,.0f}\n"
        if 'volume' in alert:
            msg += f"Volume: {alert['volume']:,} contracts\n"
        if 'call_put_ratio' in alert:
            msg += f"Call/Put Ratio: {alert['call_put_ratio']}\n"
        if 'total_premium' in alert:
            msg += f"Total Premium: ${alert['total_premium']:,.0f}\n"
        if 'moneyness' in alert:
            msg += f"Moneyness: {alert['moneyness']}\n"
        
        msg += "─" * 30 + "\n"
        
        if 'implications' in alert:
            msg += f"📊 Smart Money:\n{alert['implications']}\n"
        
        return msg
    
    def _log_alert(self, message: str, alert: Dict):
        """Log alert for main agent to send"""
        alert_entry = {
            'timestamp': datetime.now().isoformat(),
            'chat_id': self.chat_id,
            'message': message,
            'raw_alert': alert
        }
        
        # Write to alert log file
        with open('/Users/charon/go/whale_alerts.log', 'a') as f:
            f.write(json.dumps(alert_entry) + '\n')
        
        # Also print for immediate visibility
        print(f"\n{'='*60}")
        print(f"🚨 WHALE ALERT - Send to telegram:{self.chat_id}")
        print(f"{'='*60}")
        print(message)
        print(f"{'='*60}\n")

class WhaleOptionsMonitor:
    """Main monitoring orchestrator"""
    
    def __init__(self):
        self.sources: List[OptionsDataSource] = [
            YahooFinanceSource()
        ]
        self.alert_engine = WhaleAlertEngine()
        self.alerter = TelegramAlerter()
        self.stats = {
            'checks': 0,
            'alerts_sent': 0,
            'start_time': datetime.now()
        }
        
    async def fetch_price(self, symbol: str) -> Optional[float]:
        """Fetch current stock price"""
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        result = data.get('chart', {}).get('result', [{}])[0]
                        meta = result.get('meta', {})
                        return meta.get('regularMarketPrice')
        except Exception as e:
            logger.error(f"Price fetch error for {symbol}: {e}")
        return None
    
    async def monitor_symbol(self, symbol: str) -> List[Dict]:
        """Monitor a single symbol"""
        all_flows = []
        
        # Get current price
        price = await self.fetch_price(symbol)
        if price:
            self.alert_engine.update_price(symbol, price)
            STOCKS[symbol]['price'] = price
        
        # Fetch from all sources
        for source in self.sources:
            try:
                flows = await source.fetch_flow(symbol)
                all_flows.extend(flows)
            except Exception as e:
                logger.error(f"Source error: {e}")
        
        # Deduplicate by (strike, expiration, type)
        seen = set()
        unique_flows = []
        for flow in all_flows:
            key = (flow.strike, flow.expiration, flow.option_type)
            if key not in seen:
                seen.add(key)
                unique_flows.append(flow)
        
        # Detect whale activity
        alerts = self.alert_engine.detect_whale_activity(symbol, unique_flows)
        
        return alerts
    
    async def run_cycle(self):
        """Run one monitoring cycle"""
        self.stats['checks'] += 1
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"\n{'='*70}")
        print(f"🐋 WHALE SCAN #{self.stats['checks']} | {timestamp}")
        print(f"{'='*70}")
        
        for symbol in STOCKS:
            print(f"\n📊 {symbol} (${STOCKS[symbol].get('price', 'N/A')}) - {STOCKS[symbol]['note']}")
            print("-" * 50)
            
            alerts = await self.monitor_symbol(symbol)
            
            if alerts:
                print(f"  🚨 {len(alerts)} whale activity detected!")
                for alert in alerts:
                    sent = await self.alerter.send_alert(alert)
                    if sent:
                        self.stats['alerts_sent'] += 1
                        print(f"    ✅ Alert sent: {alert['type']}")
                    else:
                        print(f"    ⏸️ Alert cooldown: {alert['type']}")
            else:
                print("  ✓ No whale activity")
        
        # Print stats
        runtime = datetime.now() - self.stats['start_time']
        print(f"\n{'='*70}")
        print(f"📈 Stats: {self.stats['checks']} scans | {self.stats['alerts_sent']} alerts | Runtime: {runtime}")
        print(f"{'='*70}\n")
    
    async def run(self, interval: int = 300):
        """Run continuous monitoring"""
        print("\n" + "="*70)
        print("🐋 WHALE OPTIONS FLOW MONITOR")
        print("="*70)
        print(f"Stocks: {', '.join(STOCKS.keys())}")
        print(f"Interval: {interval}s (5 minutes)")
        print(f"Alert Target: telegram:{self.alerter.chat_id}")
        print(f"Thresholds: Block=${THRESHOLDS['block_trade']:,} | Mega=${THRESHOLDS['mega_trade']:,}")
        print("="*70 + "\n")
        
        while True:
            try:
                await self.run_cycle()
            except Exception as e:
                logger.error(f"Cycle error: {e}")
                print(f"⚠️ Error in cycle: {e}")
            
            print(f"⏳ Next scan in {interval} seconds...")
            await asyncio.sleep(interval)


if __name__ == "__main__":
    monitor = WhaleOptionsMonitor()
    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        print("\n\n👋 Monitor stopped by user")
        print(f"📊 Final stats: {monitor.stats}")
