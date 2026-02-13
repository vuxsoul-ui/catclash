"use client"

import { useState } from "react"
import { 
  Calculator, ArrowRight, TrendingUp, TrendingDown, 
  PieChart, DollarSign, AlertTriangle, RefreshCcw
} from "lucide-react"

// Current portfolio
const CURRENT_PORTFOLIO = {
  NVDA: { shares: 60.34, price: 185.25, value: 11178, cost: 11134, allocation: 65 },
  ONDS: { shares: 454.47, price: 9.69, value: 4404, cost: 5354, allocation: 26 },
  SLS: { shares: 207.77, price: 3.73, value: 775, cost: 896, allocation: 5 },
  VOO: { shares: 1.43, price: 635.40, value: 908, cost: 909, allocation: 4 },
  totalValue: 17265,
  totalCost: 18293,
  totalPnl: -1028
}

// Available actions
const AVAILABLE_STOCKS = [
  { ticker: "NVDA", name: "NVIDIA", price: 185.25 },
  { ticker: "ONDS", name: "Ondas Holdings", price: 9.69 },
  { ticker: "SLS", name: "SELLAS Life Sciences", price: 3.73 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", price: 635.40 },
  { ticker: "CASH", name: "Cash Position", price: 1 },
]

const TARGET_ALLOCATION = {
  NVDA: 35,
  ONDS: 25,
  SLS: 0,
  VOO: 35,
  CASH: 5
}

export function ScenarioCreator() {
  const [scenarios, setScenarios] = useState([])
  const [activeScenario, setActiveScenario] = useState({
    name: "Rebalance to Target",
    sell: { ticker: "NVDA", shares: 30 },
    buy: { ticker: "VOO", shares: 10 },
    holdCash: 2000
  })
  const [showResults, setShowResults] = useState(false)

  // Calculate scenario results
  const calculateScenario = () => {
    const sellStock = AVAILABLE_STOCKS.find(s => s.ticker === activeScenario.sell.ticker)
    const buyStock = AVAILABLE_STOCKS.find(s => s.ticker === activeScenario.buy.ticker)
    
    const proceeds = activeScenario.sell.shares * sellStock.price
    const cost = activeScenario.buy.shares * buyStock.price
    const remainingCash = proceeds - cost + activeScenario.holdCash
    
    // New portfolio values
    const newPortfolio = { ...CURRENT_PORTFOLIO }
    
    // Subtract sold shares
    if (activeScenario.sell.ticker !== "CASH") {
      newPortfolio[activeScenario.sell.ticker].shares -= activeScenario.sell.shares
      newPortfolio[activeScenario.sell.ticker].value -= proceeds
    }
    
    // Add bought shares
    if (activeScenario.buy.ticker !== "CASH") {
      if (!newPortfolio[activeScenario.buy.ticker]) {
        newPortfolio[activeScenario.buy.ticker] = { shares: 0, value: 0, cost: 0 }
      }
      newPortfolio[activeScenario.buy.ticker].shares += activeScenario.buy.shares
      newPortfolio[activeScenario.buy.ticker].value += cost
    }
    
    // Recalculate total and allocations
    const newTotal = Object.keys(newPortfolio)
      .filter(k => k !== 'totalValue' && k !== 'totalCost' && k !== 'totalPnl')
      .reduce((sum, ticker) => sum + (newPortfolio[ticker]?.value || 0), 0) + remainingCash
    
    return {
      proceeds,
      cost,
      remainingCash,
      newTotalValue: newTotal,
      newAllocations: Object.keys(newPortfolio)
        .filter(k => k !== 'totalValue' && k !== 'totalCost' && k !== 'totalPnl')
        .map(ticker => ({
          ticker,
          value: newPortfolio[ticker]?.value || 0,
          allocation: ((newPortfolio[ticker]?.value || 0) / newTotal * 100).toFixed(1)
        }))
    }
  }

  const results = showResults ? calculateScenario() : null

  const getAllocationColor = (current, target) => {
    const diff = Math.abs(current - target)
    if (diff <= 5) return "text-green-400"
    if (diff <= 10) return "text-yellow-400"
    return "text-red-400"
  }

  const presetScenarios = [
    {
      name: "🎯 Rebalance to Target",
      desc: "Sell 30 NVDA → Buy 10 VOO",
      sell: { ticker: "NVDA", shares: 30 },
      buy: { ticker: "VOO", shares: 10 },
      holdCash: 0
    },
    {
      name: "💰 Harvest SLS Loss",
      desc: "Sell all SLS → Buy ONDS dip",
      sell: { ticker: "SLS", shares: 207.77 },
      buy: { ticker: "ONDS", shares: 80 },
      holdCash: 0
    },
    {
      name: "🚀 Double Down on ONDS",
      desc: "Sell 15 NVDA → 150 more ONDS",
      sell: { ticker: "NVDA", shares: 15 },
      buy: { ticker: "ONDS", shares: 286 },
      holdCash: 0
    },
    {
      name: "🏛️ Conservative Shift",
      desc: "Sell 50 NVDA → All into VOO",
      sell: { ticker: "NVDA", shares: 50 },
      buy: { ticker: "VOO", shares: 14 },
      holdCash: 500
    }
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="text-blue-400" size={24} />
            Scenario Creator
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            Simulate portfolio changes before you trade
          </p>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {presetScenarios.map((scenario, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveScenario(scenario)
              setShowResults(true)
            }}
            className={`p-4 text-left rounded-xl border transition-all ${
              activeScenario.name === scenario.name 
                ? 'bg-blue-950/30 border-blue-500' 
                : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <h4 className="font-bold mb-1">{scenario.name}</h4>
            <p className="text-sm text-zinc-500">{scenario.desc}</p>
          </button>
        ))}
      </div>

      {/* Custom Scenario Builder */}
      <div className="card-sleek p-5">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <RefreshCcw size={18} />
          Custom Scenario
        </h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sell Side */}
          <div className="space-y-3">
            <label className="text-sm text-zinc-500">Sell</label>
            <select 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3"
              value={activeScenario.sell.ticker}
              onChange={(e) => setActiveScenario({
                ...activeScenario,
                sell: { ...activeScenario.sell, ticker: e.target.value }
              })}
            >
              {AVAILABLE_STOCKS.filter(s => CURRENT_PORTFOLIO[s.ticker]).map(stock => (
                <option key={stock.ticker} value={stock.ticker}>
                  {stock.ticker} - {stock.name} (${stock.price})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={activeScenario.sell.shares}
              onChange={(e) => setActiveScenario({
                ...activeScenario,
                sell: { ...activeScenario.sell, shares: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono"
              placeholder="Shares to sell"
            />
            <p className="text-sm text-zinc-500">
              You own: {CURRENT_PORTFOLIO[activeScenario.sell.ticker]?.shares.toFixed(2) || 0} shares
            </p>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowRight className="text-zinc-600 hidden md:block" size={32} />
            <ArrowRight className="text-zinc-600 md:hidden rotate-90" size={32} />
          </div>

          {/* Buy Side */}
          <div className="space-y-3">
            <label className="text-sm text-zinc-500">Buy</label>
            <select 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3"
              value={activeScenario.buy.ticker}
              onChange={(e) => setActiveScenario({
                ...activeScenario,
                buy: { ...activeScenario.buy, ticker: e.target.value }
              })}
            >
              {AVAILABLE_STOCKS.map(stock => (
                <option key={stock.ticker} value={stock.ticker}>
                  {stock.ticker} - {stock.name} (${stock.price})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={activeScenario.buy.shares}
              onChange={(e) => setActiveScenario({
                ...activeScenario,
                buy: { ...activeScenario.buy, shares: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono"
              placeholder="Shares to buy"
            />
          </div>
        </div>

        <button 
          onClick={() => setShowResults(true)}
          className="w-full mt-4 btn-sleek bg-blue-950/30 border-blue-800"
        >
          Calculate Scenario
        </button>
      </div>

      {/* Results */}
      {showResults && results && (
        <div className="card-sleek p-6 border-2 border-blue-800 bg-blue-950/10">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
            <PieChart className="text-blue-400" size={20} />
            Scenario Results
          </h4>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-zinc-950 rounded-xl">
              <p className="text-sm text-zinc-500 mb-1">Proceeds from Sale</p>
              <p className="text-2xl font-bold text-green-400 font-mono">
                +${results.proceeds.toFixed(0)}
              </p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl">
              <p className="text-sm text-zinc-500 mb-1">Cost of Purchase</p>
              <p className="text-2xl font-bold text-red-400 font-mono">
                -${results.cost.toFixed(0)}
              </p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl">
              <p className="text-sm text-zinc-500 mb-1">New Portfolio Value</p>
              <p className="text-2xl font-bold font-mono">
                ${results.newTotalValue.toFixed(0)}
              </p>
            </div>
          </div>

          {/* New Allocation Chart */}
          <div className="space-y-3">
            <h5 className="font-medium text-sm text-zinc-400">New Allocation</h5>
            {results.newAllocations
              .sort((a, b) => parseFloat(b.allocation) - parseFloat(a.allocation))
              .map((pos) => {
                const target = TARGET_ALLOCATION[pos.ticker] || 0
                const current = parseFloat(pos.allocation)
                return (
                  <div key={pos.ticker} className="flex items-center gap-4">
                    <span className="w-16 font-mono font-bold">{pos.ticker}</span>
                    <div className="flex-1 h-6 bg-zinc-900 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(current * 2, 100)}%` }}
                      />
                      {/* Target marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white"
                        style={{ left: `${Math.min(target * 2, 100)}%` }}
                      />
                    </div>
                    <div className="w-32 text-right">
                      <span className={`font-mono font-bold ${getAllocationColor(current, target)}`}>
                        {current}%
                      </span>
                      <span className="text-zinc-600 text-xs ml-2">/ {target}%</span>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Risk Assessment */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
              <div>
                <h5 className="font-medium text-yellow-400 mb-2">Risk Assessment</h5>
                <ul className="space-y-1 text-sm text-zinc-400">
                  {activeScenario.sell.ticker === "NVDA" && (
                    <li>• Reducing NVDA concentration lowers single-stock risk</li>
                  )}
                  {activeScenario.buy.ticker === "VOO" && (
                    <li>• Adding VOO increases diversification and reduces volatility</li>
                  )}
                  {activeScenario.buy.ticker === "ONDS" && (
                    <li>• Increasing ONDS adds defense sector exposure (good for geopolitical hedge)</li>
                  )}
                  {results.remainingCash > 1000 && (
                    <li>• Holding ${results.remainingCash.toFixed(0)} cash provides dry powder for future opportunities</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button className="flex-1 btn-sleek bg-green-950/30 border-green-800">
              <DollarSign size={16} className="inline mr-2" />
              Execute in Broker
            </button>
            <button 
              onClick={() => setShowResults(false)}
              className="px-6 btn-sleek"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Current vs Target Comparison */}
      <div className="card-sleek p-5">
        <h4 className="font-medium mb-4">Current vs Target Allocation</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(TARGET_ALLOCATION).map(([ticker, target]) => {
            const current = CURRENT_PORTFOLIO[ticker]?.allocation || 0
            const diff = current - target
            return (
              <div key={ticker} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <span className="font-mono">{ticker}</span>
                <div className="flex items-center gap-4">
                  <span className={diff > 5 ? "text-red-400" : diff < -5 ? "text-green-400" : "text-zinc-400"}>
                    {current}%
                  </span>
                  <ArrowRight size={14} className="text-zinc-600" />
                  <span className="text-zinc-500">{target}%</span>
                  {diff !== 0 && (
                    <span className={`text-xs ${diff > 0 ? "text-red-400" : "text-green-400"}`}>
                      {diff > 0 ? "↓" : "↑"} {Math.abs(diff).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
