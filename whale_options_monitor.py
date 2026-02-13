#!/usr/bin/env python3
"""
Whale Options Flow Monitor
Monitors ONDS, NVDA, SLS, VOO for unusual options activity
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import aiohttp
import requests

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
STOCKS = {
    'ONDS': {'price': 8.48, 'note': 'Takeover rumors'},
    'NVDA': {'price': None, 'note': 'Feb 25 earnings'},
    'SLS': {'price': 3.52, 'note': 'Biotech - low volume normally'},
    'VOO': {'price': None, 'note': 'Institutional hedging'}
}

ALERT_THRESHOLDS = {
    'block_trade_notional': 500000,  # $500K
    'unusual_volume_mult': 3,        # 3x average
    'single_trade_premium': 1000000, # $1M
    'volume_spike_mult': 5,          # 5x volume
    'call_put_ratio_high': 3,
    'call_put_ratio_low': 0.33
}

# Specific alerts
SPECIFIC_ALERTS = {
    'ONDS': {
        'call_strike_above': 20,  # Call buying >$20 strike
        'put_strike_below': 8     # Put buying <$8
    },
    'NVDA': {
        'call_strike_above': 180,  # Call sweeps >$180
        'earnings_date': '2025-02-25'
    }
}

TELEGRAM_CHAT_ID = "8467656798"

@dataclass
class OptionsFlow:
    symbol: str
    strike: float
    expiration: str
    option_type: str  # CALL or PUT
    premium: float
    volume: int
    open_interest: int
    size: int
    price: float
    timestamp: str
    sentiment: str = ""
    
class WhaleOptionsMonitor:
    def __init__(self):
        self.flow_history: Dict[str, List[OptionsFlow]] = {s: [] for s in STOCKS}
        self.volume_baselines: Dict[str, float] = {}
        self.last_alert_time: Dict[str, datetime] = {}
        
    async def fetch_options_chain(self, symbol: str) -> Optional[Dict]:
        """Fetch options chain data from free sources"""
        try:
            # Try yfinance-based approach
            url = f"https://query1.finance.yahoo.com/v7/finance/options/{symbol}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data
            return None
        except Exception as e:
            logger.error(f"Error fetching options for {symbol}: {e}")
            return None
    
    async def fetch_stock_price(self, symbol: str) -> Optional[float]:
        """Fetch current stock price"""
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        result = data.get('chart', {}).get('result', [{}])[0]
                        meta = result.get('meta', {})
                        price = meta.get('regularMarketPrice')
                        if price:
                            return float(price)
            return None
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            return None
    
    def analyze_options_data(self, symbol: str, data: Dict) -> List[OptionsFlow]:
        """Analyze options data for whale activity"""
        flows = []
        
        try:
            result = data.get('optionChain', {}).get('result', [{}])[0]
            quote = result.get('quote', {})
            current_price = quote.get('regularMarketPrice', 0)
            
            # Update baseline price
            if current_price:
                STOCKS[symbol]['price'] = current_price
            
            options = result.get('options', [])
            
            for option_group in options:
                calls = option_group.get('calls', [])
                puts = option_group.get('puts', [])
                
                for contract in calls + puts:
                    strike = contract.get('strike', 0)
                    volume = contract.get('volume', 0)
                    open_interest = contract.get('openInterest', 0)
                    last_price = contract.get('lastPrice', 0)
                    
                    # Calculate notional value
                    notional = volume * 100 * last_price
                    
                    # Check for whale activity
                    if notional >= ALERT_THRESHOLDS['block_trade_notional'] and volume > 0:
                        flow = OptionsFlow(
                            symbol=symbol,
                            strike=strike,
                            expiration=contract.get('expiration', ''),
                            option_type='CALL' if contract in calls else 'PUT',
                            premium=notional,
                            volume=volume,
                            open_interest=open_interest,
                            size=volume,
                            price=last_price,
                            timestamp=datetime.now().isoformat(),
                            sentiment=self._determine_sentiment(contract, current_price, 'CALL' if contract in calls else 'PUT')
                        )
                        flows.append(flow)
                        
        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
            
        return flows
    
    def _determine_sentiment(self, contract: Dict, current_price: float, option_type: str) -> str:
        """Determine if trade is bullish/bearish/neutral"""
        strike = contract.get('strike', 0)
        
        if option_type == 'CALL':
            if strike > current_price * 1.05:
                return "BULLISH (OTM)"
            elif strike < current_price * 0.95:
                return "BULLISH (ITM)"
            else:
                return "NEUTRAL"
        else:  # PUT
            if strike < current_price * 0.95:
                return "BEARISH (OTM)"
            elif strike > current_price * 1.05:
                return "BEARISH (ITM)"
            else:
                return "NEUTRAL"
    
    def check_whale_conditions(self, symbol: str, flows: List[OptionsFlow]) -> List[Dict]:
        """Check for whale activity conditions"""
        alerts = []
        
        # Group by expiration for cluster detection
        expirations = {}
        for flow in flows:
            exp = flow.expiration
            if exp not in expirations:
                expirations[exp] = []
            expirations[exp].append(flow)
        
        # Check for same-expiration clusters
        for exp, exp_flows in expirations.items():
            total_premium = sum(f.premium for f in exp_flows)
            if total_premium >= ALERT_THRESHOLDS['single_trade_premium']:
                call_count = sum(1 for f in exp_flows if f.option_type == 'CALL')
                put_count = len(exp_flows) - call_count
                
                alerts.append({
                    'type': 'CLUSTER',
                    'symbol': symbol,
                    'expiration': exp,
                    'total_premium': total_premium,
                    'call_count': call_count,
                    'put_count': put_count,
                    'details': f"Same-expiration cluster detected: ${total_premium:,.0f} total premium"
                })
        
        # Check individual flows
        for flow in flows:
            # Block trade check
            if flow.premium >= ALERT_THRESHOLDS['block_trade_notional']:
                alert = {
                    'type': 'BLOCK_TRADE',
                    'symbol': symbol,
                    'strike': flow.strike,
                    'expiration': flow.expiration,
                    'option_type': flow.option_type,
                    'premium': flow.premium,
                    'volume': flow.volume,
                    'sentiment': flow.sentiment
                }
                
                # Specific checks for ONDS
                if symbol == 'ONDS':
                    if flow.option_type == 'CALL' and flow.strike > SPECIFIC_ALERTS['ONDS']['call_strike_above']:
                        alert['special_note'] = "🚨 TAKEOVER RUMOR ALERT: ONDS calls >$20 strike"
                    elif flow.option_type == 'PUT' and flow.strike < SPECIFIC_ALERTS['ONDS']['put_strike_below']:
                        alert['special_note'] = "🚨 DOWNSIDE BET ALERT: ONDS puts <$8 strike"
                
                # Specific checks for NVDA
                if symbol == 'NVDA' and flow.option_type == 'CALL' and flow.strike > SPECIFIC_ALERTS['NVDA']['call_strike_above']:
                    alert['special_note'] = "🚨 NVDA institutional call sweep >$180"
                
                # Specific checks for SLS
                if symbol == 'SLS':
                    alert['special_note'] = "🚨 SLS UNUSUAL ACTIVITY - Potential catalyst leak (normally low volume)"
                
                # High premium alert
                if flow.premium >= ALERT_THRESHOLDS['single_trade_premium']:
                    alert['type'] = 'MEGA_WHALE'
                
                alerts.append(alert)
        
        # Calculate call/put ratio
        calls = sum(f.volume for f in flows if f.option_type == 'CALL')
        puts = sum(f.volume for f in flows if f.option_type == 'PUT')
        
        if puts > 0:
            ratio = calls / puts
            if ratio >= ALERT_THRESHOLDS['call_put_ratio_high']:
                alerts.append({
                    'type': 'CALL_PUT_RATIO',
                    'symbol': symbol,
                    'ratio': ratio,
                    'direction': 'BULLISH_SPIKE',
                    'details': f"Call/Put ratio spike: {ratio:.2f} (>3.0)"
                })
            elif ratio <= ALERT_THRESHOLDS['call_put_ratio_low']:
                alerts.append({
                    'type': 'CALL_PUT_RATIO',
                    'symbol': symbol,
                    'ratio': ratio,
                    'direction': 'BEARISH_SPIKE',
                    'details': f"Put/Call ratio spike: {1/ratio:.2f} (>3.0)"
                })
        
        return alerts
    
    async def send_alert(self, alert: Dict):
        """Send alert to Telegram"""
        try:
            # Format alert message
            msg = self._format_alert_message(alert)
            
            # Send via Telegram (via main agent)
            logger.info(f"ALERT: {msg}")
            print(f"\n{'='*60}\n📢 WHALE ALERT\n{'='*60}\n{msg}\n{'='*60}\n")
            
        except Exception as e:
            logger.error(f"Error sending alert: {e}")
    
    def _format_alert_message(self, alert: Dict) -> str:
        """Format alert for Telegram"""
        symbol = alert.get('symbol', 'UNKNOWN')
        alert_type = alert.get('type', 'UNKNOWN')
        
        if alert_type == 'BLOCK_TRADE' or alert_type == 'MEGA_WHALE':
            emoji = "🐋" if alert_type == 'BLOCK_TRADE' else "🐋🐋🐋"
            msg = f"{emoji} {alert_type} ALERT: ${symbol}\n\n"
            msg += f"Strike: ${alert.get('strike', 0):.2f}\n"
            msg += f"Type: {alert.get('option_type', 'N/A')}\n"
            msg += f"Expiration: {alert.get('expiration', 'N/A')}\n"
            msg += f"Premium: ${alert.get('premium', 0):,.0f}\n"
            msg += f"Volume: {alert.get('volume', 0):,} contracts\n"
            msg += f"Sentiment: {alert.get('sentiment', 'N/A')}\n\n"
            
            if 'special_note' in alert:
                msg += f"⚠️ {alert['special_note']}\n\n"
            
            # Smart money implications
            msg += "📊 Smart Money Implications:\n"
            if alert.get('option_type') == 'CALL':
                if 'BULLISH' in alert.get('sentiment', ''):
                    msg += "- Institutional bullish positioning\n"
                    if symbol == 'NVDA':
                        msg += "- Potential earnings play or momentum continuation\n"
                    elif symbol == 'ONDS':
                        msg += "- Possible takeover speculation or major contract win\n"
            else:  # PUT
                if 'BEARISH' in alert.get('sentiment', ''):
                    msg += "- Institutional bearish positioning/hedging\n"
                    if symbol == 'VOO':
                        msg += "- Market stress hedging detected\n"
                else:
                    msg += "- Protective put buying / risk management\n"
            
        elif alert_type == 'CLUSTER':
            msg = f"🎯 CLUSTER ALERT: ${symbol}\n\n"
            msg += f"Expiration: {alert.get('expiration', 'N/A')}\n"
            msg += f"Total Premium: ${alert.get('total_premium', 0):,.0f}\n"
            msg += f"Calls: {alert.get('call_count', 0)}\n"
            msg += f"Puts: {alert.get('put_count', 0)}\n\n"
            msg += "📊 Multiple strikes at same expiration = directional bet\n"
            
        elif alert_type == 'CALL_PUT_RATIO':
            direction = alert.get('direction', '')
            emoji = "🟢" if direction == 'BULLISH_SPIKE' else "🔴"
            msg = f"{emoji} CALL/PUT RATIO ALERT: ${symbol}\n\n"
            msg += f"Ratio: {alert.get('ratio', 0):.2f}\n"
            msg += f"Direction: {direction}\n\n"
            if direction == 'BULLISH_SPIKE':
                msg += "📊 Heavy call buying = Bullish sentiment\n"
            else:
                msg += "📊 Heavy put buying = Bearish sentiment / Hedging\n"
        else:
            msg = f"📢 ALERT: {alert_type} for ${symbol}\n{json.dumps(alert, indent=2, default=str)}"
        
        return msg
    
    async def monitor_once(self):
        """Run one monitoring cycle"""
        logger.info("=" * 60)
        logger.info(f"Starting whale options scan at {datetime.now()}")
        logger.info("=" * 60)
        
        for symbol in STOCKS:
            logger.info(f"\n📊 Analyzing {symbol}...")
            
            # Fetch current price
            price = await self.fetch_stock_price(symbol)
            if price:
                logger.info(f"  Current price: ${price:.2f}")
                STOCKS[symbol]['price'] = price
            
            # Fetch options data
            data = await self.fetch_options_chain(symbol)
            if not data:
                logger.warning(f"  Could not fetch options data for {symbol}")
                continue
            
            # Analyze for whale activity
            flows = self.analyze_options_data(symbol, data)
            
            if flows:
                logger.info(f"  Found {len(flows)} significant options flows")
                for flow in flows[:5]:  # Show top 5
                    logger.info(f"    {flow.option_type} ${flow.strike} | Vol: {flow.volume} | Premium: ${flow.premium:,.0f} | {flow.sentiment}")
                
                # Check for whale conditions
                alerts = self.check_whale_conditions(symbol, flows)
                
                for alert in alerts:
                    # Rate limiting - don't alert more than once per minute for same alert type
                    alert_key = f"{symbol}_{alert['type']}"
                    last_time = self.last_alert_time.get(alert_key)
                    now = datetime.now()
                    
                    if not last_time or (now - last_time) > timedelta(minutes=1):
                        await self.send_alert(alert)
                        self.last_alert_time[alert_key] = now
            else:
                logger.info(f"  No significant whale activity detected")
        
        logger.info("\n" + "=" * 60)
        logger.info("Scan complete")
        logger.info("=" * 60 + "\n")
    
    async def run(self, interval_seconds: int = 300):
        """Run continuous monitoring"""
        logger.info(f"🚀 Whale Options Monitor Started")
        logger.info(f"Monitoring: {', '.join(STOCKS.keys())}")
        logger.info(f"Check interval: {interval_seconds} seconds (5 minutes)")
        logger.info(f"Alert target: telegram:{TELEGRAM_CHAT_ID}")
        
        while True:
            try:
                await self.monitor_once()
            except Exception as e:
                logger.error(f"Error in monitoring cycle: {e}")
            
            logger.info(f"⏳ Sleeping for {interval_seconds} seconds...")
            await asyncio.sleep(interval_seconds)


if __name__ == "__main__":
    monitor = WhaleOptionsMonitor()
    try:
        asyncio.run(monitor.run())
    except KeyboardInterrupt:
        logger.info("\n👋 Monitor stopped by user")
