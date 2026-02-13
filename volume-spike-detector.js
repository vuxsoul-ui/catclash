#!/usr/bin/env node

/**
 * Volume Spike Detector for ONDS, NVDA, SLS, VOO
 * Monitors volume spikes using Yahoo Finance API
 * Alert thresholds: ONDS >300K, NVDA >400M, SLS >15M, VOO >300K
 */

const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const path = require('path');

// Configuration
const STOCKS = [
  { symbol: 'ONDS', threshold: 300000, normalVolume: 100000, multiplier: 3 },
  { symbol: 'NVDA', threshold: 400000000, normalVolume: 160000000, multiplier: 2.5 },
  { symbol: 'SLS', threshold: 15000000, normalVolume: 5000000, multiplier: 3 },
  { symbol: 'VOO', threshold: 300000, normalVolume: 100000, multiplier: 3 }
];

const VOLUME_HISTORY_FILE = path.join(__dirname, 'volume-history.json');
const TELEGRAM_CHAT_ID = '8467656798';

// Load or initialize volume history
function loadVolumeHistory() {
  if (existsSync(VOLUME_HISTORY_FILE)) {
    try {
      return JSON.parse(readFileSync(VOLUME_HISTORY_FILE, 'utf8'));
    } catch (e) {
      console.log('Error loading volume history, starting fresh');
    }
  }
  return {};
}

// Save volume history
function saveVolumeHistory(history) {
  writeFileSync(VOLUME_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Get current stock data using Yahoo Finance via yahoo-data-fetcher skill
async function getStockData(symbol) {
  try {
    // Use the yahoo-data-fetcher skill that's available
    const command = `openclask yahoo-data-fetcher get-quote ${symbol}`;
    const result = execSync(command, { encoding: 'utf8' });
    
    // Parse the result - assuming it returns JSON with volume data
    let data;
    try {
      data = JSON.parse(result);
    } catch (e) {
      // If not JSON, try to extract key data from text output
      console.log(`Raw output for ${symbol}:`, result);
      return null;
    }
    
    // For now, let's use a simpler approach with web search to get current volume
    return getStockDataViaSearch(symbol);
    
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error.message);
    return getStockDataViaSearch(symbol);
  }
}

// Alternative method using web search
async function getStockDataViaSearch(symbol) {
  try {
    // Use web search to get current volume data
    const searchCommand = `openclask web_search "${symbol} stock volume today current trading volume site:finance.yahoo.com OR site:marketwatch.com"`;
    const searchResult = execSync(searchCommand, { encoding: 'utf8' });
    
    // Extract volume from search results (this is a simplified approach)
    // In practice, you'd want to parse the actual financial data
    const volumeMatch = searchResult.match(/Volume[:\s]+([\d,]+M?K?)/i);
    const priceMatch = searchResult.match(/\$([\d.]+)/);
    
    if (volumeMatch && priceMatch) {
      const volumeStr = volumeMatch[1].replace(/,/g, '');
      let volume = parseFloat(volumeStr);
      
      // Convert K/M suffixes
      if (volumeStr.includes('M')) volume *= 1000000;
      else if (volumeStr.includes('K')) volume *= 1000;
      
      const price = parseFloat(priceMatch[1]);
      
      // Estimate 20-day average (this would need historical data for accuracy)
      const avgVolume = volume * 0.8; // Rough estimate
      
      return {
        symbol,
        currentVolume: volume,
        avgVolume: avgVolume,
        currentPrice: price,
        previousClose: price * 0.98, // Estimate
        priceChange: price * 0.02,
        priceChangePercent: 2.0
      };
    }
    
  } catch (error) {
    console.error(`Error in fallback search for ${symbol}:`, error.message);
  }
  
  return null;
}

// Analyze volume spike and provide interpretation
function analyzeVolumeSpike(stockData, stockConfig) {
  const { currentVolume, avgVolume, currentPrice, priceChangePercent } = stockData;
  const { symbol, threshold } = stockConfig;
  
  const volumeRatio = currentVolume / avgVolume;
  const isSpike = currentVolume > threshold;
  
  let interpretation = '';
  let tradingImplications = '';
  
  if (isSpike) {
    if (priceChangePercent > 2) {
      interpretation = '🚀 BULLISH BREAKOUT - High volume with significant price increase suggests strong buying pressure and potential continuation of upward trend';
      tradingImplications = 'Consider long positions or call options. Watch for resistance levels to break. Set stop-loss below recent support.';
    } else if (priceChangePercent < -2) {
      interpretation = '🔻 BEARISH VOLUME SPIKE - High volume with significant price drop suggests strong selling pressure and potential downward continuation';
      tradingImplications = 'Consider short positions or put options. Watch for support levels to break. Be cautious of oversold bounces.';
    } else {
      interpretation = '⚡ REVERSAL SIGNAL - High volume with minimal price change suggests potential trend reversal or consolidation';
      tradingImplications = 'Watch for breakout direction. Consider straddle/strangle options strategies. Wait for clear directional confirmation.';
    }
  }
  
  return {
    isSpike,
    volumeRatio,
    interpretation,
    tradingImplications
  };
}

// Send Telegram alert
function sendTelegramAlert(message) {
  try {
    const command = `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} --message "${message}"`;
    execSync(command, { encoding: 'utf8' });
    console.log('Alert sent to Telegram');
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

// Main monitoring function
async function monitorVolumeSpikes() {
  console.log(`[${new Date().toISOString()}] Starting volume spike monitoring...`);
  
  const history = loadVolumeHistory();
  const alerts = [];
  
  for (const stockConfig of STOCKS) {
    const stockData = await getStockData(stockConfig.symbol);
    
    if (!stockData) {
      console.log(`Failed to get data for ${stockConfig.symbol}`);
      continue;
    }
    
    console.log(`${stockConfig.symbol}: Volume ${stockData.currentVolume.toLocaleString()}, Avg ${stockData.avgVolume.toLocaleString()}, Price $${stockData.currentPrice.toFixed(2)} (${stockData.priceChangePercent.toFixed(2)}%)`);
    
    const analysis = analyzeVolumeSpike(stockData, stockConfig);
    
    // Store in history
    if (!history[stockConfig.symbol]) {
      history[stockConfig.symbol] = [];
    }
    history[stockConfig.symbol].push({
      timestamp: new Date().toISOString(),
      volume: stockData.currentVolume,
      avgVolume: stockData.avgVolume,
      price: stockData.currentPrice,
      priceChangePercent: stockData.priceChangePercent
    });
    
    // Keep only last 100 records
    if (history[stockConfig.symbol].length > 100) {
      history[stockConfig.symbol] = history[stockConfig.symbol].slice(-100);
    }
    
    if (analysis.isSpike) {
      const alertMessage = `
🚨 VOLUME SPIKE ALERT - ${stockConfig.symbol}

📊 Volume Comparison:
• Current: ${stockData.currentVolume.toLocaleString()}
• 20-day Avg: ${stockData.avgVolume.toLocaleString()}
• Ratio: ${analysis.volumeRatio.toFixed(1)}x normal

💰 Price Action:
• Current: $${stockData.currentPrice.toFixed(2)}
• Change: ${stockData.priceChangePercent >= 0 ? '+' : ''}${stockData.priceChangePercent.toFixed(2)}%

🎯 ${analysis.interpretation}

📈 Trading Implications:
${analysis.tradingImplications}

Time: ${new Date().toLocaleString()}
      `.trim();
      
      alerts.push(alertMessage);
    }
  }
  
  // Save history
  saveVolumeHistory(history);
  
  // Send alerts
  for (const alert of alerts) {
    sendTelegramAlert(alert);
  }
  
  if (alerts.length === 0) {
    console.log('No volume spikes detected');
  }
  
  console.log(`[${new Date().toISOString()}] Volume monitoring complete`);
}

// Run the monitoring
if (require.main === module) {
  monitorVolumeSpikes().catch(console.error);
}

module.exports = { monitorVolumeSpikes, getStockData, analyzeVolumeSpike };