"use client"

import { useState } from "react"
import { 
  Play, AlertTriangle, TrendingDown, TrendingUp, DollarSign,
  Target, Shield, Zap, BarChart3, RefreshCcw
} from "lucide-react"

const CURRENT_PORTFOLIO = {
  NVDA: { shares: 60.34, price: 185.25, value: 11178, allocation: 65 },
  ONDS: { shares: 454.47, price: 9.69, value: 4404, allocation: 26 },
  SLS: { shares: 207.77, price: 3.73, value: 775, allocation: 5 },
  VOO: { shares: 1.43, price: 635.40, value: 908, allocation: 4 },
  totalValue: 17265
}

// Predefined market scenarios
const MARKET_SCENARIOS = [
  {
    id: "nvda-earnings-miss",
    name: "🚨 NVDA Earnings Miss",
    description: "NVDA misses earnings by 10%, stock drops 15%",
    impact: { NVDA: -15, ONDS: -2, SLS: -1, VOO: -1 },
    severity: "high",
    reason: "AI demand concerns, China restrictions"
  },
  {
    id: "nvda-earnings-beat",
    name: "🚀 NVDA Earnings Beat",
    description: "NVDA crushes earnings, Blackwell demand skyrockets",
    impact: { NVDA: 12, ONDS: 2, SLS: 1, VOO: 1 },
    severity: "high",
    reason: "Data center revenue exceeds expectations"
  },
  {
    id: "defense-boom",
    name: "🛡️ Defense Spending Surge",
    description: "Congress approves $50B additional defense budget",
    impact: { NVDA: 2, ONDS: 25, SLS: 0, VOO: 1 },
    severity: "medium",
    reason: "Geopolitical tensions rise, drone contracts awarded"
  },
  {
    id: "biotech-fda",
    name: "💊 SLS FDA Approval",
    description: "SLS gets accelerated approval for key drug",
    impact: { NVDA: 0, ONDS: 0, SLS: 150, VOO: 0 },
    severity: "high",
    reason: "Phase 3 data shows strong efficacy"
  },
  {
    id: "recession",
    name: "📉 Mild Recession",
    description: "Fed overtightens, GDP contracts 2 quarters",
    impact: { NVDA: -25, ONDS: -15, SLS: -20, VOO: -15 },
    severity: "high",
    reason: "Consumer spending drops, enterprise cuts AI spend"
  },
  {
    id: "soft-landing",
    name: "🛬 Soft Landing Success",
    description: "Fed nails the landing, inflation tames without recession",
    impact: { NVDA: 15, ONDS: 10, SLS: 5, VOO: 8 },
    severity: "medium",
    reason: "Rate cuts begin, growth stocks rally"
  },
  {
    id: "trade-war",
    name: "🇨🇳 US-China Trade War 2.0",
    description: "New tariffs on Chinese tech, semiconductor restrictions",
    impact: { NVDA: -20, ONDS: 5, SLS: -5, VOO: -3 },
    severity: "high",
    reason: "NVDA loses China revenue (20% of sales)"
  },
  {
    id: "nvda-20-drop",
    name: "📉 NVDA Drops 20% (Your Ask)",
    description: "NVDA hits technical support, margin calls trigger",
    impact: { NVDA: -20, ONDS: -5, SLS: -3, VOO: -2 },
    severity: "high",
    reason: "Profit taking after 300% run, rotation to value"
  }
]

export function PortfolioSimulatorV2() {
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [customImpact, setCustomImpact] = useState({
    NVDA: 0,
    ONDS: 0,
    SLS: 0,
    VOO: 0
  })
  const [showCustom, setShowCustom] = useState(false)

  const calculateScenario = (impacts) => {
    let newTotal = 0
    const newPositions = {}
    
    Object.keys(CURRENT_PORTFOLIO).forEach(ticker => {
      if (ticker !== 'totalValue') {
        const current = CURRENT_PORTFOLIO[ticker]
        const change = impacts[ticker] || 0
        const newPrice = current.price * (1 + change / 100)
        const newValue = current.shares * newPrice
        newPositions[ticker] = {
          ...current,
          newPrice,
          newValue,
          change,
          changeAmount: newValue - current.value
        }
        newTotal += newValue
      }
    })
    
    return {
      positions: newPositions,
      totalValue: newTotal,
      totalChange: newTotal - CURRENT_PORTFOLIO.totalValue,
      totalChangePct: ((newTotal - CURRENT_PORTFOLIO.totalValue) / CURRENT_PORTFOLIO.totalValue * 100)
    }
  }

  const results = selectedScenario 
    ? calculateScenario(MARKET_SCENARIOS.find(s => s.id === selectedScenario)?.impact || {})
    : showCustom 
      ? calculateScenario(customImpact)
      : null

  const getSeverityColor = (severity) => {
    if (severity === 'high') return 'text-red-400 border-red-800 bg-red-950/20'
    if (severity === 'medium') return 'text-yellow-400 border-yellow-800 bg-yellow-950/20'
    return 'text-green-400 border-green-800 bg-green-950/20'
  }

  const getImpactColor = (change) => {
    if (change <= -20) return 'text-red-500'
    if (change < 0) return 'text-red-400'
    if (change >= 20) return 'text-green-500'
    if (change > 0) return 'text-green-400'
    return 'text-zinc-400'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Play className="text-green-400" size={24} />
            Portfolio Simulator v2
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            "What if" scenarios to stress-test your portfolio
          </p>
        </div>
      </div>

      {/* Current Portfolio Snapshot */}
      <div className="card-sleek p-5 bg-zinc-950/50">
        <h4 className="text-sm font-medium text-zinc-400 mb-3">Current Portfolio</h4>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(CURRENT_PORTFOLIO).filter(([k]) => k !== 'totalValue').map(([ticker, data]) => (
            <div key={ticker} className="text-center">
              <p className="font-mono font-bold">{ticker}</p>
              <p className="text-sm text-zinc-500">${data.value.toLocaleString()}</p>
              <p className="text-xs text-zinc-600">({data.allocation}%)</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold font-mono">${CURRENT_PORTFOLIO.totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Target size={18} className="text-zinc-500" />
          Select Market Scenario
        </h4>
        
        <div className="grid md:grid-cols-2 gap-3">
          {MARKET_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => {
                setSelectedScenario(scenario.id)
                setShowCustom(false)
              }}
              className={`p-4 text-left rounded-xl border transition-all ${
                selectedScenario === scenario.id
                  ? 'bg-zinc-800 border-zinc-600 ring-2 ring-blue-500/20'
                  : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-bold text-sm">{scenario.name}</h5>
                <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(scenario.severity)}`}>
                  {scenario.severity}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-2">{scenario.description}</p>
              <p className="text-xs text-zinc-600">{scenario.reason}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Scenario Toggle */}
      <button
        onClick={() => {
          setShowCustom(!showCustom)
          setSelectedScenario(null)
        }}
        className="w-full p-4 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-all"
      >
        {showCustom ? '−' : '+'} Create Custom Scenario
      </button>

      {/* Custom Scenario Builder */}
      {showCustom && (
        <div className="card-sleek p-5">
          <h4 className="font-medium mb-4">Custom Impact Percentages</h4>
          <div className="grid md:grid-cols-4 gap-4">
            {Object.keys(customImpact).map(ticker => (
              <div key={ticker}>
                <label className="text-sm text-zinc-500 mb-2 block">{ticker}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    value={customImpact[ticker]}
                    onChange={(e) => setCustomImpact({
                      ...customImpact,
                      [ticker]: parseInt(e.target.value)
                    })}
                    className="flex-1"
                  />
                  <span className={`font-mono w-16 text-right ${getImpactColor(customImpact[ticker])}`}>
                    {customImpact[ticker] > 0 ? '+' : ''}{customImpact[ticker]}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className={`card-sleek p-6 border-2 ${
          results.totalChange >= 0 ? 'border-green-800 bg-green-950/10' : 'border-red-800 bg-red-950/10'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-lg flex items-center gap-2">
              {results.totalChange >= 0 ? (
                <TrendingUp className="text-green-400" size={24} />
              ) : (
                <TrendingDown className="text-red-400" size={24} />
              )}
              Projected Outcome
            </h4>
            <button 
              onClick={() => {setSelectedScenario(null); setShowCustom(false)}}
              className="p-2 hover:bg-zinc-800 rounded-lg"
            >
              <RefreshCcw size={16} />
            </button>
          </div>

          {/* Total Change */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-zinc-950 rounded-xl text-center">
              <p className="text-sm text-zinc-500 mb-1">New Portfolio Value</p>
              <p className="text-3xl font-bold font-mono">${results.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl text-center">
              <p className="text-sm text-zinc-500 mb-1">Total Change</p>
              <p className={`text-3xl font-bold font-mono ${results.totalChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {results.totalChange >= 0 ? '+' : ''}${results.totalChange.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl text-center">
              <p className="text-sm text-zinc-500 mb-1">% Change</p>
              <p className={`text-3xl font-bold font-mono ${results.totalChangePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {results.totalChangePct >= 0 ? '+' : ''}{results.totalChangePct.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Position Breakdown */}
          <div className="space-y-3">
            <h5 className="font-medium text-sm text-zinc-400">Position-Level Impact</h5>
            {Object.entries(results.positions).map(([ticker, data]) => (
              <div key={ticker} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold w-16">{ticker}</span>
                  <div>
                    <p className="text-sm">${data.newValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    <p className="text-xs text-zinc-500">
                      Was: ${data.value.toLocaleString()} → Now: ${data.newPrice.toFixed(2)}/share
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-bold ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change}%
                  </p>
                  <p className={`text-sm ${data.changeAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.changeAmount >= 0 ? '+' : ''}${data.changeAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Risk Warning */}
          {results.totalChangePct <= -20 && (
            <div className="mt-6 p-4 bg-red-950/30 border border-red-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <div>
                <h5 className="font-medium text-red-400">⚠️ Severe Portfolio Impact</h5>
                <p className="text-sm text-zinc-400 mt-1">
                  This scenario shows a {results.totalChangePct.toFixed(0)}% loss. Consider:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-500">
                  <li>• Increasing diversification away from single-stock risk</li>
                  <li>• Setting stop losses to limit downside</li>
                  <li>• Maintaining cash reserves for buying opportunities</li>
                </ul>
              </div>
            </div>
          )}

          {/* Opportunity Alert */}
          {results.totalChangePct >= 20 && (
            <div className="mt-6 p-4 bg-green-950/30 border border-green-800 rounded-xl flex items-start gap-3">
              <Zap className="text-green-400 shrink-0" size={20} />
              <div>
                <h5 className="font-medium text-green-400">🚀 Strong Upside Scenario</h5>
                <p className="text-sm text-zinc-400 mt-1">
                  This scenario shows a +{results.totalChangePct.toFixed(0)}% gain. Consider:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-500">
                  <li>• Taking some profits if this plays out (rebalance to targets)</li>
                  <li>• Not FOMO-ing in - this is a simulation, not a prediction</li>
                  <li>• Dollar-cost averaging works both ways</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="card-sleek p-5 border border-zinc-800">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Shield size={18} className="text-zinc-500" />
          Stress Testing Tips
        </h4>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• Test your portfolio against -20% NVDA moves regularly</li>
          <li>• If any single scenario would cost you &gt;$3,000, consider rebalancing</li>
          <li>• Best portfolios survive the worst-case scenarios</li>
          <li>• Use this tool before major events (earnings, Fed meetings)</li>
        </ul>
      </div>
    </div>
  )
}
