"use client"

import { useState } from "react"
import { 
  TrendingDown, Calculator, AlertTriangle, CheckCircle, 
  DollarSign, Calendar, ArrowRight, Info
} from "lucide-react"

// Portfolio data with tax loss calculations
const PORTFOLIO_TAX_DATA = {
  taxYear: 2026,
  filingStatus: "Single", // or "Married", "Head of Household"
  taxBracket: 24, // Estimated federal bracket
  stateTaxRate: 9.3, // California (can be customized)
  
  positions: [
    {
      ticker: "SLS",
      shares: 207.77,
      costBasis: 4.31,
      currentPrice: 3.73,
      unrealizedLoss: 120.53,
      lossPercent: -13.5,
      daysHeld: 145,
      qualified: true, // Held > 1 year = long term
      washSaleRisk: false,
      recommendation: "HARVEST"
    },
    {
      ticker: "ONDS",
      shares: 454.47,
      costBasis: 11.78,
      currentPrice: 9.69,
      unrealizedLoss: 682.42,
      lossPercent: -17.7,
      daysHeld: 45,
      qualified: false, // Short term
      washSaleRisk: false,
      recommendation: "HOLD"
    },
    {
      ticker: "NVDA",
      shares: 60.34,
      costBasis: 184.51,
      currentPrice: 185.25,
      unrealizedGain: 44.65,
      gainPercent: 0.4,
      daysHeld: 89,
      qualified: false,
      recommendation: null
    },
    {
      ticker: "VOO",
      shares: 1.43,
      costBasis: 636.11,
      currentPrice: 635.40,
      unrealizedLoss: 1.02,
      lossPercent: -0.1,
      daysHeld: 200,
      qualified: true,
      recommendation: null
    }
  ],
  
  harvestedThisYear: 0, // Losses already harvested in 2026
  harvestedLastYear: 0, // Losses from 2025 carried forward
}

export function TaxLossHarvesting() {
  const [showDetails, setShowDetails] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  
  // Calculate totals
  const shortTermLosses = PORTFOLIO_TAX_DATA.positions
    .filter(p => p.unrealizedLoss && !p.qualified)
    .reduce((sum, p) => sum + p.unrealizedLoss, 0)
    
  const longTermLosses = PORTFOLIO_TAX_DATA.positions
    .filter(p => p.unrealizedLoss && p.qualified)
    .reduce((sum, p) => sum + p.unrealizedLoss, 0)
    
  const totalHarvestable = shortTermLosses + longTermLosses
  
  // Tax savings calculation (simplified)
  const federalSavings = totalHarvestable * (PORTFOLIO_TAX_DATA.taxBracket / 100)
  const stateSavings = totalHarvestable * (PORTFOLIO_TAX_DATA.stateTaxRate / 100)
  const totalSavings = federalSavings + stateSavings
  
  // Strategy recommendations
  const strategies = [
    {
      title: "Harvest SLS Loss",
      loss: 120.53,
      taxSavings: 40.34,
      action: "Sell SLS → Wait 31 days → Buy similar biotech (XBI) OR rebuy SLS after wash sale period",
      timeframe: "Before Dec 31, 2026",
      risk: "Low - SLS is speculative, tax savings guaranteed"
    },
    {
      title: "Hold ONDS (for now)",
      loss: 682.42,
      taxSavings: 227.88,
      action: "Wait for defense contract news, then harvest if no catalyst",
      timeframe: "Monitor through March earnings",
      risk: "Medium - Could recover, but $228 tax savings is significant"
    }
  ]
  
  const getLossColor = (loss: number) => {
    if (loss > 500) return "text-red-400"
    if (loss > 100) return "text-orange-400"
    return "text-yellow-400"
  }
  
  const getRecommendationColor = (rec: string) => {
    if (rec === "HARVEST") return "bg-green-950 text-green-400 border-green-800"
    if (rec === "HOLD") return "bg-blue-950 text-blue-400 border-blue-800"
    return "bg-zinc-950 text-zinc-400 border-zinc-800"
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="text-green-400" size={24} />
            Tax Loss Harvesting
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            Optimize your tax bill before Dec 31, 2026
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950 rounded-lg border border-red-800">
          <Calendar size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">324 days left</span>
        </div>
      </div>
      
      {/* Tax Savings Summary Card */}
      <div className="card-sleek p-6 border-2 border-green-800 bg-green-950/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-zinc-400 text-sm">Total Tax Savings Available</p>
            <p className="text-4xl font-bold text-green-400 mt-1">
              ${totalSavings.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Federal (${federalSavings.toFixed(0)}) + State (${stateSavings.toFixed(0)})
            </p>
          </div>
          <div className="text-right">
            <p className="text-zinc-400 text-sm">Harvestable Losses</p>
            <p className="text-2xl font-bold text-red-400">-${totalHarvestable.toFixed(0)}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Short-Term Losses</p>
            <p className={`font-mono font-bold ${getLossColor(shortTermLosses)}`}>
              -${shortTermLosses.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-600">Against ordinary income (up to $3,000)</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Long-Term Losses</p>
            <p className={`font-mono font-bold ${getLossColor(longTermLosses)}`}>
              -${longTermLosses.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-600">Offset capital gains first</p>
          </div>
        </div>
      </div>
      
      {/* Positions Table */}
      <div className="card-sleek overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h4 className="font-medium">Positions with Losses</h4>
          <span className="text-xs text-zinc-500">Click for details</span>
        </div>
        <div className="divide-y divide-zinc-800">
          {PORTFOLIO_TAX_DATA.positions
            .filter(p => p.unrealizedLoss && p.unrealizedLoss > 10)
            .map((position) => (
            <div 
              key={position.ticker}
              className="p-4 hover:bg-zinc-900/50 cursor-pointer transition-colors"
              onClick={() => setSelectedPosition(selectedPosition === position.ticker ? null : position.ticker)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-mono font-bold text-lg">{position.ticker}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${getRecommendationColor(position.recommendation || '')}`}>
                      {position.recommendation || 'MONITOR'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-bold ${getLossColor(position.unrealizedLoss)}`}>
                    -${position.unrealizedLoss.toFixed(0)}
                  </p>
                  <p className="text-xs text-zinc-500">{position.lossPercent?.toFixed(1)}%</p>
                </div>
              </div>
              
              {selectedPosition === position.ticker && (
                <div className="mt-4 pt-4 border-t border-zinc-800 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shares</span>
                    <span className="font-mono">{position.shares}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cost Basis</span>
                    <span className="font-mono">${position.costBasis}/share</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Current Price</span>
                    <span className="font-mono">${position.currentPrice}/share</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Holding Period</span>
                    <span className={position.qualified ? "text-green-400" : "text-yellow-400"}>
                      {position.daysHeld} days ({position.qualified ? "Long-term" : "Short-term"})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Tax Savings if Harvested</span>
                    <span className="font-mono text-green-400">
                      +${(position.unrealizedLoss * ((PORTFOLIO_TAX_DATA.taxBracket + PORTFOLIO_TAX_DATA.stateTaxRate) / 100)).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Strategy Recommendations */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <CheckCircle size={18} className="text-green-400" />
          Recommended Strategies
        </h4>
        
        {strategies.map((strategy, idx) => (
          <div key={idx} className="card-sleek p-5 border-l-4 border-l-green-500">
            <div className="flex items-start justify-between mb-3">
              <h5 className="font-bold">{strategy.title}</h5>
              <span className="text-green-400 font-mono font-bold">
                Save ${strategy.taxSavings.toFixed(0)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="text-zinc-400">{strategy.action}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-zinc-500">
                  <Calendar size={12} />
                  {strategy.timeframe}
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                  <Info size={12} />
                  {strategy.risk}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Wash Sale Warning */}
      <div className="card-sleek p-5 border border-yellow-800 bg-yellow-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
          <div>
            <h5 className="font-medium text-yellow-400 mb-1">⚠️ Wash Sale Rule Warning</h5>
            <p className="text-sm text-zinc-400">
              If you sell at a loss and buy the same (or "substantially identical") security within 
              30 days, the loss is disallowed. If you harvest SLS:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-500">
              <li>• Wait 31 days before rebuying SLS</li>
              <li>• Or buy a similar biotech ETF (XBI) immediately</li>
              <li>• Your spouse cannot buy SLS in their account either</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-3">
        <button className="flex-1 btn-sleek flex items-center justify-center gap-2 bg-red-950/30 border-red-800 hover:bg-red-900/30">
          <TrendingDown size={16} />
          Harvest SLS Loss
        </button>
        <button className="flex-1 btn-sleek flex items-center justify-center gap-2">
          <DollarSign size={16} />
          Calculate Scenarios
        </button>
      </div>
      
      {/* Disclaimer */}
      <p className="text-xs text-zinc-600 text-center">
        Not tax advice. Consult a CPA. Calculations based on 24% federal + 9.3% CA state rates.
        Wash sale rules apply to all accounts including IRAs.
      </p>
    </div>
  )
}
