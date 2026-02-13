"use client"

import { useState, useEffect } from "react"
import { Clock, Sun, Moon, TrendingUp, TrendingDown, Activity } from "lucide-react"

const MARKET_HOURS = {
  preMarket: { start: 4, end: 9.5 }, // 4:00 AM - 9:30 AM ET
  regular: { start: 9.5, end: 16 }, // 9:30 AM - 4:00 PM ET
  afterHours: { start: 16, end: 20 }, // 4:00 PM - 8:00 PM ET
  closed: { start: 20, end: 28 } // 8:00 PM - 4:00 AM next day
}

const PRE_MARKET_MOVERS = [
  { ticker: "NVDA", change: 2.4, price: 189.70, volume: "2.4M" },
  { ticker: "TSLA", change: -1.2, price: 248.30, volume: "1.8M" },
  { ticker: "RKLB", change: 5.7, price: 28.40, volume: "890K" },
]

export function MarketClock() {
  const [now, setNow] = useState(new Date())
  const [marketStatus, setMarketStatus] = useState("loading")
  const [timeUntil, setTimeUntil] = useState({ hours: 0, minutes: 0 })

  useEffect(() => {
    const updateMarketStatus = () => {
      const etNow = new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
      const etDate = new Date(etNow)
      const day = etDate.getDay() // 0 = Sunday, 6 = Saturday
      const hour = etDate.getHours()
      const minute = etDate.getMinutes()
      const timeDecimal = hour + minute / 60

      // Check if weekend
      if (day === 0 || day === 6) {
        setMarketStatus("weekend")
        // Time until Monday open
        const daysUntilMonday = day === 0 ? 1 : 2
        setTimeUntil({ hours: daysUntilMonday * 24 + 9, minutes: 30 })
        return
      }

      // Determine market status
      if (timeDecimal >= MARKET_HOURS.regular.start && timeDecimal < MARKET_HOURS.regular.end) {
        setMarketStatus("open")
        // Time until close
        const hoursUntilClose = MARKET_HOURS.regular.end - timeDecimal
        setTimeUntil({ 
          hours: Math.floor(hoursUntilClose), 
          minutes: Math.round((hoursUntilClose % 1) * 60) 
        })
      } else if (timeDecimal >= MARKET_HOURS.preMarket.start && timeDecimal < MARKET_HOURS.preMarket.end) {
        setMarketStatus("pre")
        const hoursUntilOpen = MARKET_HOURS.regular.start - timeDecimal
        setTimeUntil({ 
          hours: Math.floor(hoursUntilOpen), 
          minutes: Math.round((hoursUntilOpen % 1) * 60) 
        })
      } else if (timeDecimal >= MARKET_HOURS.afterHours.start && timeDecimal < MARKET_HOURS.afterHours.end) {
        setMarketStatus("after")
        const hoursUntilClose = MARKET_HOURS.afterHours.end - timeDecimal
        setTimeUntil({ 
          hours: Math.floor(hoursUntilClose), 
          minutes: Math.round((hoursUntilClose % 1) * 60) 
        })
      } else {
        setMarketStatus("closed")
        // Time until next open
        let hoursUntilOpen
        if (timeDecimal >= MARKET_HOURS.afterHours.end) {
          hoursUntilOpen = (24 - timeDecimal) + 9.5
        } else {
          hoursUntilOpen = MARKET_HOURS.regular.start - timeDecimal
        }
        setTimeUntil({ 
          hours: Math.floor(hoursUntilOpen), 
          minutes: Math.round((hoursUntilOpen % 1) * 60) 
        })
      }
    }

    updateMarketStatus()
    const timer = setInterval(() => {
      setNow(new Date())
      updateMarketStatus()
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  const getStatusConfig = () => {
    switch (marketStatus) {
      case "open":
        return { 
          color: "text-green-400", 
          bg: "bg-green-950", 
          border: "border-green-800",
          icon: Activity,
          label: "Market Open",
          sublabel: "Closes in"
        }
      case "pre":
        return { 
          color: "text-yellow-400", 
          bg: "bg-yellow-950", 
          border: "border-yellow-800",
          icon: Sun,
          label: "Pre-Market",
          sublabel: "Opens in"
        }
      case "after":
        return { 
          color: "text-orange-400", 
          bg: "bg-orange-950", 
          border: "border-orange-800",
          icon: Moon,
          label: "After Hours",
          sublabel: "Closes in"
        }
      case "weekend":
      case "closed":
        return { 
          color: "text-zinc-400", 
          bg: "bg-zinc-900", 
          border: "border-zinc-800",
          icon: Clock,
          label: "Market Closed",
          sublabel: "Opens in"
        }
      default:
        return { 
          color: "text-zinc-400", 
          bg: "bg-zinc-900", 
          border: "border-zinc-800",
          icon: Clock,
          label: "Loading...",
          sublabel: ""
        }
    }
  }

  const status = getStatusConfig()
  const StatusIcon = status.icon

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-blue-400" size={24} />
            Market Clock
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            NYSE/NASDAQ trading hours and pre-market movers
          </p>
        </div>
      </div>

      {/* Main Status Card */}
      <div className={`card-sleek p-6 border-2 ${status.border} ${status.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${status.bg} border ${status.border}`}>
              <StatusIcon className={status.color} size={32} />
            </div>
            <div>
              <h4 className={`text-2xl font-bold ${status.color}`}>
                {status.label}
              </h4>
              <p className="text-zinc-400">
                {status.sublabel}: {timeUntil.hours}h {timeUntil.minutes}m
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono">
              {now.toLocaleTimeString('en-US', { 
                timeZone: 'America/New_York',
                hour: '2-digit', 
                minute: '2-digit'
              })}
            </p>
            <p className="text-sm text-zinc-500">ET / Market Time</p>
          </div>
        </div>

        {/* Time Progress Bar */}
        {marketStatus === "open" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>9:30 AM</span>
              <span>4:00 PM</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${((new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) - new Date().setHours(9,30,0,0)) / (6.5 * 60 * 60 * 1000)) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trading Hours Schedule */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pre-Market", time: "4:00 - 9:30 AM", status: "pre", active: marketStatus === "pre" },
          { label: "Regular", time: "9:30 AM - 4:00 PM", status: "open", active: marketStatus === "open" },
          { label: "After Hours", time: "4:00 - 8:00 PM", status: "after", active: marketStatus === "after" },
          { label: "Extended", time: "8:00 PM - 4:00 AM", status: "closed", active: marketStatus === "closed" || marketStatus === "weekend" },
        ].map((session) => (
          <div 
            key={session.status}
            className={`p-4 rounded-xl border text-center transition-all ${
              session.active 
                ? 'bg-zinc-800 border-zinc-600' 
                : 'bg-zinc-950 border-zinc-800 opacity-60'
            }`}
          >
            <p className="font-medium text-sm">{session.label}</p>
            <p className="text-xs text-zinc-500 mt-1">{session.time}</p>
            {session.active && (
              <div className="mt-2 w-2 h-2 bg-green-400 rounded-full mx-auto animate-pulse"></div>
            )}
          </div>
        ))}
      </div>

      {/* Pre-Market Movers */}
      {(marketStatus === "pre" || marketStatus === "closed" || marketStatus === "weekend") && (
        <div className="card-sleek p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp size={18} className="text-green-400" />
              Pre-Market Movers
            </h4>
            <span className="text-xs text-zinc-500">Volume leaders</span>
          </div>
          <div className="space-y-3">
            {PRE_MARKET_MOVERS.map((stock) => (
              <div key={stock.ticker} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold">{stock.ticker}</span>
                  <span className="text-zinc-500 text-sm">${stock.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono font-bold ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change}%
                  </span>
                  <span className="text-xs text-zinc-600">Vol: {stock.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Stocks Pre-Market */}
      {(marketStatus === "pre" || marketStatus === "closed") && (
        <div className="card-sleek p-5 border border-blue-800 bg-blue-950/10">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-400" />
            Your Portfolio - Pre-Market Indication
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { ticker: "NVDA", indication: +1.2, price: 187.47 },
              { ticker: "ONDS", indication: -0.8, price: 9.61 },
              { ticker: "SLS", indication: +0.5, price: 3.75 },
              { ticker: "VOO", indication: +0.2, price: 636.67 },
            ].map((stock) => (
              <div key={stock.ticker} className="p-3 bg-zinc-950 rounded-lg text-center">
                <p className="font-mono font-bold">{stock.ticker}</p>
                <p className="text-lg font-mono">${stock.price.toFixed(2)}</p>
                <p className={`text-sm ${stock.indication >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stock.indication >= 0 ? '▲' : '▼'} {stock.indication > 0 ? '+' : ''}{stock.indication}%
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            *Indicative prices from pre-market trading. Final prices at market open may differ.
          </p>
        </div>
      )}
    </div>
  )
}
