
const axios = require('axios');

class YahooDataFetcher {
  async getQuote(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
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
      throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`);
    }
  }
  
  async getHistorical(symbol, days = 30) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
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
      throw new Error(`Failed to fetch historical data for ${symbol}: ${error.message}`);
    }
  }
}

module.exports = new YahooDataFetcher();
