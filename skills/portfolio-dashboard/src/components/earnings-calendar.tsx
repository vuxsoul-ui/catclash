"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, TrendingUp, AlertTriangle, Zap, Target } from "lucide-react"

// Earnings data for portfolio stocks
const EARNINGS_DATA = {
  NVDA: {
    ticker: "NVDA",
    company: "NVIDIA",
    date: "2026-02-26", // Estimated - Q4 FY2025
    time: "After Market Close",
    epsEstimate: 0.85,
    epsPrevious: 0.81,
    revenueEstimate: 38.5, // Billions
    revenuePrevious: 35.1,
    daysAway: null, // Calculated
    historical: [
      { quarter: "Q3 FY25", date: "2025-11-20", eps: 0.81, estimate: 0.74, surprise: "+9.5%", reaction: "+3.2%" },
      { quarter: "Q2 FY25", date: "2025-08-28", eps: 0.68, estimate: 0.64, surprise: "+6.3%", reaction: "+1.8%" },
      { quarter: "Q1 FY25", date: "2025-05-28", eps: 0.60, estimate: 0.55, surprise: "+9.1%", reaction: "+5.4%" },
      { quarter: "Q4 FY24", date: "2025-02-26", eps: 0.52, estimate: 0.46, surprise: "+13.0%", reaction: "+8.2%" },
    ],
    whisper: 0.88, // Wall Street whisper number
    optionsActivity: "High call volume - $220 strike",
    keyTopics: ["Blackwell chip ramp", "Data center revenue", "China export controls", "AI demand sustainability"]
  },
  ONDS: {
    ticker: "ONDS",
    company: "Ondas Holdings",
    date: "2026-03-13", // Estimated
    time: "Pre-Market",
    epsEstimate: -0.23,
    epsPrevious: -0.28,
    revenueEstimate: 12.5, // Millions
    revenuePrevious: 8.2,
    daysAway: null,
    historical: [
      { quarter: "Q3 2025", date: "2025-11-14", eps: -0.28, estimate: -0.32, surprise: "+12.5%", reaction: "+2.1%" },
      { quarter: "Q2 2025", date: "2025-08-15", eps: -0.35, estimate: -0.38, surprise: "+7.9%", reaction: "-1.2%" },
    ],
    whisper: -0.21,
    optionsActivity: "Low volume",
    keyTopics: ["Defense contract updates", "Drone delivery progress", "Cash runway", "FDA timeline updates"]
  },
  SLS: {
    ticker: "SLS",
    company: "SELLAS Life Sciences",
    date: "2026-03-27", // Estimated
    time: "Pre-Market",
    epsEstimate: -0.15,
    epsPrevious: -0.18,
    revenueEstimate: 0.5, // Millions
    revenuePrevious: 0.3,
    daysAway: null,
    historical: [
      { quarter: "Q3 2025", date: "2025-11-12", eps: -0.18, estimate: -0.20, surprise: "+10%", reaction: "-5.4%" },
    ],
    whisper: -0.14,
    optionsActivity: "Minimal",
    keyTopics: ["Clinical trial updates", "Partnership discussions", "Cash position", "Regulatory pathway"]
  },
  VOO: {
    ticker: "VOO",
    company: "Vanguard S&P 500 ETF",
    date: null, // ETFs don't have earnings
    time: null,
    note: "ETF - No earnings reports"
  }
}

// Calculate days away
const calculateDaysAway = (dateStr) => {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  const diffTime = target - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function EarningsCalendar() {
  const [now, setNow] = useState(new Date())
  
  // Update countdown every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Calculate days away for each stock
  const stocksWithDays = Object.entries(EARNINGS_DATA).map(([ticker, data]) => ({
    ...data,
    daysAway: calculateDaysAway(data.date),
    isUpcoming: data.date && calculateDaysAway(data.date) <= 30 && calculateDaysAway(data.date) >= 0
  })).filter(s => s.date) // Filter out VOO (no earnings)

  // Sort by closest date
  stocksWithDays.sort((a, b) => a.daysAway - b.daysAway)

  const getUrgencyColor = (days) => {
    if (days <= 3) return "text-red-400 bg-red-950"
    if (days <= 7) return "text-orange-400 bg-orange-950"
    if (days <= 14) return "text-yellow-400 bg-yellow-950"
    return "text-zinc-400 bg-zinc-900"
  }

  const getUrgencyBorder = (days) => {
    if (days <= 3) return "border-red-500"
    if (days <= 7) return "border-orange-500"
    if (days <= 14) return "border-yellow-500"
    return "border-zinc-700"
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="text-purple-400" size={24} />
            Earnings Calendar
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            Upcoming earnings for your portfolio
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
          <Clock size={14} className="text-zinc-400" />
          <span className="text-xs text-zinc-400">{now.toLocaleDateString()} {now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} PST</span>
        </div>
      </div>

      {/* Earnings Cards */}
      <div className="space-y-4">
        {stocksWithDays.map((stock) => (
          <div 
            key={stock.ticker}
            className={`card-sleek p-5 border-2 ${getUrgencyBorder(stock.daysAway)} transition-all hover:border-white`}
          >
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              {/* Left: Stock Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-mono font-bold text-2xl">{stock.ticker}</h4>
                    <p className="text-zinc-500 text-sm">{stock.company}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getUrgencyColor(stock.daysAway)}`}>
                    {stock.daysAway === 0 ? "TODAY!" : 
                     stock.daysAway === 1 ? "TOMORROW" :
                     `${stock.daysAway} days away`}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-zinc-950 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Date</p>
                    <p className="font-medium">{new Date(stock.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Time</p>
                    <p className="font-medium text-sm">{stock.time}</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">EPS Est</p>
                    <p className="font-medium font-mono">${stock.epsEstimate}</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Rev Est</p>
                    <p className="font-medium font-mono">${stock.ticker === 'NVDA' ? stock.revenueEstimate + 'B' : stock.revenueEstimate + 'M'}</p>
                  </div>
                </div>

                {/* Whisper vs Estimate */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-zinc-500" />
                    <span className="text-zinc-500">Whisper:</span>
                    <span className={`font-mono font-bold ${stock.whisper > stock.epsEstimate ? 'text-green-400' : 'text-red-400'}`}>
                      ${stock.whisper}
                    </span>
                    {stock.whisper > stock.epsEstimate && (
                      <span className="text-xs text-green-400">↑ Higher than estimate</span>
                    )}
                  </div>
                </div>

                {/* Key Topics */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {stock.keyTopics.map((topic, idx) => (
                    <span key={idx} className="px-2 py-1 bg-zinc-950 rounded text-xs text-zinc-400 border border-zinc-800">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Historical Performance */}
              {stock.historical && stock.historical.length > 0 && (
                <div className="lg:w-72 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                  <h5 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <TrendingUp size={14} />
                    Historical Earnings
                  </h5>
                  <div className="space-y-2">
                    {stock.historical.slice(0, 3).map((earnings, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">{earnings.quarter}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-zinc-300">${earnings.eps}</span>
                          <span className={`text-xs ${earnings.surprise.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                            {earnings.surprise}
                          </span>
                          <span className={`text-xs ${earnings.reaction.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                            {earnings.reaction}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Options Activity */}
            <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2 text-sm">
              <Zap size={14} className="text-yellow-500" />
              <span className="text-zinc-500">Options Activity:</span>
              <span className="text-zinc-300">{stock.optionsActivity}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      {stocksWithDays.some(s => s.daysAway <= 3) && (
        <div className="card-sleek p-5 border border-red-500 bg-red-950/20">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="text-red-400" size={24} />
            <h4 className="font-bold text-red-400">Earnings Alerts</h4>
          </div>
          <ul className="space-y-2 text-sm">
            {stocksWithDays.filter(s => s.daysAway <= 3).map(s => (
              <li key={s.ticker} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                <span className="font-mono font-bold">{s.ticker}</span>
                <span className="text-zinc-400">earnings in {s.daysAway === 0 ? 'today' : `${s.daysAway} day${s.daysAway > 1 ? 's' : ''}`} - consider position sizing</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>≤ 3 days (High volatility expected)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>≤ 7 days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>≤ 14 days</span>
        </div>
      </div>
    </div>
  )
}
