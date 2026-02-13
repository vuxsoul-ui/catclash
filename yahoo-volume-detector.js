#!/usr/bin/env node

/**
 * Volume Spike Detector using Yahoo Finance
 * Monitors ONDS, NVDA, SLS, VOO for volume spikes
 * Alert thresholds:
 * - ONDS >300K (3x normal ~100K)
 * - NVDA >400M (2.5x normal ~160M) 
 * - SLS >15M (3x normal ~5M)
 * - VOO >300K (3x normal ~100K)
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Stock configurations
const STOCKS = {
  'ONDS': { threshold: 300000, normal: 100000, multiplier: 3 },
  'NVDA': { threshold: 400000000, normal: 160000000, multiplier: 2.5 },
  'SLS': { threshold: 15000000, normal: 5000000, multiplier: 3 },
  'VOO': { threshold: 300000, normal: 100000, multiplier: 3 }
};

// Store for tracking data
const DATA_FILE = '/Users/charon/go/volume-tracker-data.json';

class YahooVolumeSpikeDetector {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (error) {
      console.log('Could not load previous data, starting fresh');
    }
    return { alerts: {}, history: {} };
  }

  saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Could not save data:', error.message);
    }
  }

  async getStockData(symbol) {
    try {
      // Use the yahoo-data-fetcher skill
      const result = execSync(`cd /Users/charon/go && node -e "
        const yahooFetcher = require('./yahoo-data-fetcher.js');
        yahooFetcher.getQuote('${symbol}').then(data => console.log(JSON.stringify(data))).catch(err => console.log(JSON.stringify({error: err.message})));
      "`, { encoding: 'utf8' });
      
      const data = JSON.parse(result.trim());
      return data.error ? null : data;
    } catch (error) {
      console.error(`Error fetching data for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getHistoricalVolume(symbol, days = 20) {
    try {
      // Use yahoo-data-fetcher for historical data
      const result = execSync(`cd /Users/charon/go && node -e "
        const yahooFetcher = require('./yahoo-data-fetcher.js');
        yahooFetcher.getHistorical('${symbol}', ${days}).then(data => console.log(JSON.stringify(data))).catch(err => console.log(JSON.stringify({error: err.message})));
      "`, { encoding: 'utf8' });
      
      const data = JSON.parse(result.trim());
      return data.error ? null : data;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}: ${error.message}`);
      return null;
    }
  }

  analyzePriceContext(currentPrice, previousClose, volumeSpike) {
    const priceChange = ((currentPrice - previousClose) / previousClose) * 100;
    
    let interpretation = '';
    let implications = '';
    
    if (priceChange > 3) {
      interpretation = volumeSpike > 4 ? '🚀 BULLISH BREAKOUT' : '📈 BULLISH';
      implications = 'Strong buying interest. Momentum continuation likely.';
    } else if (priceChange < -3) {
      interpretation = volumeSpike > 4 ? '🔴 BEARISH BREAKDOWN' : '📉 BEARISH';
      implications = 'Strong selling pressure. Further decline possible.';
    } else if (Math.abs(priceChange) < 1.5) {
      interpretation = '⚖️ NEUTRAL/CONSOLIDATION';
      implications = 'High volume but price stable. Watch for breakout direction.';
    } else {
      interpretation = priceChange > 0 ? '🟢 MILDLY BULLISH' : '🔴 MILDLY BEARISH';
      implications = 'Moderate volume spike with directional bias.';
    }
    
    return { interpretation, implications, priceChange };
  }

  async sendTelegramAlert(message) {
    try {
      // Use OpenClaw's message tool
      const cleanMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      execSync(`openclaw message send --to 8467656798 --message "${cleanMessage}"`, { stdio: 'inherit' });
      console.log(`Alert sent for volume spike`);
      return true;
    } catch (error) {
      console.error(`Failed to send Telegram alert: ${error.message}`);
      return false;
    }
  }

  shouldAlert(symbol) {
    const now = Date.now();
    const lastAlert = this.data.alerts[symbol] || 0;
    
    // Only alert once per 2 hours per stock to avoid spam
    return (now - lastAlert) > (2 * 60 * 60 * 1000);
  }

  async checkStock(symbol) {
    console.log(`🔍 Checking ${symbol}...`);
    
    const stockData = await this.getStockData(symbol);
    if (!stockData || !stockData.volume) {
      console.log(`❌ Could not get current data for ${symbol}`);
      return;
    }
    
    const historicalData = await this.getHistoricalVolume(symbol, 30);
    if (!historicalData || !historicalData.length) {
      console.log(`❌ Could not get historical data for ${symbol}`);
      return;
    }
    
    // Calculate 20-day average volume (skip weekends/holidays)
    const recentVolumes = historicalData.slice(-20).map(day => day.volume);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    const currentVolume = stockData.volume;
    const currentPrice = stockData.price;
    const previousClose = stockData.previousClose;
    const volumeRatio = currentVolume / avgVolume;
    
    const config = STOCKS[symbol];
    
    console.log(`${symbol}: Volume: ${currentVolume.toLocaleString()}, 20-day avg: ${Math.round(avgVolume).toLocaleString()}, Ratio: ${volumeRatio.toFixed(2)}x`);
    
    // Check if volume exceeds threshold
    if (currentVolume >= config.threshold && volumeRatio >= config.multiplier) {
      if (this.shouldAlert(symbol)) {
        const priceContext = this.analyzePriceContext(currentPrice, previousClose, volumeRatio);
        
        const alertMessage = `🔊 VOLUME SPIKE ALERT: ${symbol}

📊 Volume: ${currentVolume.toLocaleString()} (${volumeRatio.toFixed(1)}x average)
💰 Price: $${currentPrice.toFixed(2)} (${priceContext.priceChange >= 0 ? '+' : ''}${priceContext.priceChange.toFixed(2)}%)
📈 20-day avg volume: ${Math.round(avgVolume).toLocaleString()}

${priceContext.interpretation}
💡 ${priceContext.implications}

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
        
        const sent = await this.sendTelegramAlert(alertMessage);
        if (sent) {
          this.data.alerts[symbol] = Date.now();
          
          // Store alert history
          if (!this.data.history[symbol]) {
            this.data.history[symbol] = [];
          }
          this.data.history[symbol].push({
            timestamp: Date.now(),
            volume: currentVolume,
            avgVolume: avgVolume,
            ratio: volumeRatio,
            price: currentPrice,
            priceChange: priceContext.priceChange
          });
          
          // Keep only last 50 alerts per stock
          if (this.data.history[symbol].length > 50) {
            this.data.history[symbol] = this.data.history[symbol].slice(-50);
          }
        }
      } else {
        console.log(`⏸️  Alert already sent for ${symbol} recently`);
      }
    } else {
      console.log(`✅ ${symbol} volume normal`);
    }
    
    this.saveData();
  }

  async run() {
    console.log(`\n🚀 Volume Spike Detector started at ${new Date().toLocaleString()}`);
    console.log(`📈 Monitoring: ${Object.keys(STOCKS).join(', ')}\n`);
    
    for (const symbol of Object.keys(STOCKS)) {
      try {
        await this.checkStock(symbol);
      } catch (error) {
        console.error(`❌ Error checking ${symbol}: ${error.message}`);
      }
      
      // Small delay between stocks
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n✅ Volume check completed at ${new Date().toLocaleString()}`);
  }
}

// Create yahoo-data-fetcher.js if it doesn't exist
const yahooFetcherCode = `
const axios = require('axios');

class YahooDataFetcher {
  async getQuote(symbol) {
    try {
      const url = \`https://query1.finance.yahoo.com/v8/finance/chart/\${symbol}?interval=1d&range=1d\`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const result = response.data.chart.result[0];
      const meta = result.meta;
      const current = result.indicators.quote[0];
      
      return {
        symbol: symbol,
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        volume: current.volume[current.volume.length - 1],
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
      };
    } catch (error) {
      throw new Error(\`Failed to fetch quote for \${symbol}: \${error.message}\`);
    }
  }
  
  async getHistorical(symbol, days = 30) {
    try {
      const url = \`https://query1.finance.yahoo.com/v8/finance/chart/\${symbol}?interval=1d&range=\${days}d\`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      return timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        open: quotes.open[index],
        high: quotes.high[index],
        low: quotes.low[index],
        close: quotes.close[index],
        volume: quotes.volume[index]
      }));
    } catch (error) {
      throw new Error(\`Failed to fetch historical data for \${symbol}: \${error.message}\`);
    }
  }
}

module.exports = new YahooDataFetcher();
`;

// Write the yahoo data fetcher
fs.writeFileSync('/Users/charon/go/yahoo-data-fetcher.js', yahooFetcherCode);

// Run if called directly
if (require.main === module) {
  const detector = new YahooVolumeSpikeDetector();
  detector.run().catch(console.error);
}

module.exports = YahooVolumeSpikeDetector;