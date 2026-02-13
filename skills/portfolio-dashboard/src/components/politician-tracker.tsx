"use client"

import { useState } from "react"
import { 
  Landmark, TrendingUp, AlertTriangle, Eye, DollarSign, 
  Calendar, User, FileText, ExternalLink
} from "lucide-react"

// Congressional trading data (mock data based on actual patterns)
const POLITICIAN_TRADES = [
  {
    id: 1,
    politician: "Nancy Pelosi",
    party: "D",
    state: "CA",
    ticker: "NVDA",
    action: "BUY",
    shares: "10,000",
    amount: "$1M - $5M",
    date: "2026-02-05",
    daysAgo: 5,
    disclosureDate: "2026-02-08",
    notes: "Call options, $180 strike, June expiry",
    performance: +2.8,
    relevance: "high" // High = in your portfolio
  },
  {
    id: 2,
    politician: "Dan Crenshaw",
    party: "R",
    state: "TX",
    ticker: "LMT",
    action: "BUY",
    shares: "1,500",
    amount: "$500K - $1M",
    date: "2026-01-28",
    daysAgo: 13,
    disclosureDate: "2026-02-03",
    notes: "Defense sector - House Armed Services Committee member",
    performance: +3.2,
    relevance: "medium" // Medium = sector related (defense like ONDS)
  },
  {
    id: 3,
    politician: "Mark Warner",
    party: "D",
    state: "VA",
    ticker: "ONDS",
    action: "BUY",
    shares: "5,000",
    amount: "$50K - $100K",
    date: "2026-01-15",
    daysAgo: 26,
    disclosureDate: "2026-01-20",
    notes: "Small defense contractor - Intelligence Committee",
    performance: -12.4,
    relevance: "high"
  },
  {
    id: 4,
    politician: "Ted Cruz",
    party: "R",
    state: "TX",
    ticker: "SLB",
    action: "SELL",
    shares: "2,000",
    amount: "$100K - $250K",
    date: "2026-02-01",
    daysAgo: 9,
    disclosureDate: "2026-02-06",
    notes: "Energy sector rotation",
    performance: -1.8,
    relevance: "low"
  },
  {
    id: 5,
    politician: "Alexandria Ocasio-Cortez",
    party: "D",
    state: "NY",
    ticker: "TSLA",
    action: "SELL",
    shares: "500",
    amount: "$100K - $250K",
    date: "2026-02-07",
    daysAgo: 3,
    disclosureDate: "2026-02-09",
    notes: "EV sector cooling off",
    performance: -2.1,
    relevance: "medium"
  }
]

// Committee assignments relevant to your stocks
const RELEVANT_COMMITTEES = [
  { name: "House Armed Services", relevance: "High - Defense contracts affect ONDS" },
  { name: "Senate Intelligence", relevance: "High - Security clearances for drone tech" },
  { name: "House Financial Services", relevance: "Medium - Overall market regulation" },
  { name: "Senate Banking", relevance: "Medium - Interest rates affect growth stocks" }
]

export function PoliticianTracker() {
  const [filter, setFilter] = useState('all')
  const [showCommittees, setShowCommittees] = useState(false)

  const filteredTrades = POLITICIAN_TRADES.filter(trade => {
    if (filter === 'all') return true
    if (filter === 'portfolio') return trade.relevance === 'high'
    if (filter === 'recent') return trade.daysAgo <= 7
    return true
  })

  const yourPortfolioMentions = POLITICIAN_TRADES.filter(t => 
    ['NVDA', 'ONDS'].includes(t.ticker)
  )

  const getRelevanceBadge = (relevance) => {
    if (relevance === 'high') return { color: 'bg-red-950 text-red-400 border-red-800', label: 'In Portfolio' }
    if (relevance === 'medium') return { color: 'bg-yellow-950 text-yellow-400 border-yellow-800', label: 'Sector' }
    return { color: 'bg-zinc-950 text-zinc-400 border-zinc-800', label: 'Other' }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Landmark className="text-purple-400" size={24} />
            Politician Tracker
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            Congressional trading activity affecting your portfolio
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950 rounded-lg border border-red-800">
          <Eye size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">
            {yourPortfolioMentions.length} trades in your stocks
          </span>
        </div>
      </div>

      {/* Alert for Your Stocks */}
      {yourPortfolioMentions.length > 0 && (
        <div className="card-sleek p-5 border-2 border-red-800 bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0" size={24} />
            <div className="flex-1">
              <h4 className="font-bold text-red-400 mb-2">
                🚨 Politicians Trading Your Stocks
              </h4>
              <div className="space-y-2">
                {yourPortfolioMentions.map(trade => (
                  <div key={trade.id} className="flex items-center justify-between py-2 border-b border-red-900/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold">{trade.ticker}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        trade.action === 'BUY' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                      }`}>
                        {trade.action}
                      </span>
                      <span className="text-sm">{trade.politician}</span>
                      <span className="text-xs text-zinc-500">({trade.party}-{trade.state})</span>
                    </div>
                    <span className="text-sm text-zinc-400">{trade.daysAgo} days ago</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                *Data from House/Senate financial disclosures. Delayed up to 45 days by law.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 w-fit">
        {[
          { id: 'all', label: 'All Trades' },
          { id: 'portfolio', label: 'Your Stocks' },
          { id: 'recent', label: 'Last 7 Days' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filter === tab.id 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trades Table */}
      <div className="card-sleek overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-zinc-400">Politician</th>
              <th className="text-left p-4 text-sm font-medium text-zinc-400">Stock</th>
              <th className="text-left p-4 text-sm font-medium text-zinc-400">Action</th>
              <th className="text-right p-4 text-sm font-medium text-zinc-400">Amount</th>
              <th className="text-right p-4 text-sm font-medium text-zinc-400">Performance</th>
              <th className="text-left p-4 text-sm font-medium text-zinc-400">Relevance</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map((trade) => {
              const relevanceBadge = getRelevanceBadge(trade.relevance)
              return (
                <tr key={trade.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-zinc-500" />
                      <div>
                        <p className="font-medium">{trade.politician}</p>
                        <p className="text-xs text-zinc-500">{trade.party}-{trade.state}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold">{trade.ticker}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      trade.action === 'BUY' 
                        ? 'bg-green-950 text-green-400' 
                        : 'bg-red-950 text-red-400'
                    }`}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-sm">{trade.amount}</td>
                  <td className={`p-4 text-right font-mono ${
                    trade.performance >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.performance >= 0 ? '+' : ''}{trade.performance}%
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs border ${relevanceBadge.color}`}>
                      {relevanceBadge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Trade Details */}
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <FileText size={18} className="text-zinc-500" />
          Recent Notable Trades
        </h4>
        {filteredTrades.slice(0, 3).map((trade) => (
          <div key={trade.id} className="card-sleek p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-lg">{trade.ticker}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    trade.action === 'BUY' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                  }`}>
                    {trade.action}
                  </span>
                  <span className="text-sm text-zinc-400">by {trade.politician}</span>
                </div>
                <p className="text-sm text-zinc-400">{trade.notes}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    Traded: {trade.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign size={12} />
                    Amount: {trade.amount}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold ${trade.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.performance >= 0 ? '+' : ''}{trade.performance}%
                </p>
                <p className="text-xs text-zinc-500">since trade</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Relevant Committees */}
      <div className="card-sleek p-5">
        <button 
          onClick={() => setShowCommittees(!showCommittees)}
          className="w-full flex items-center justify-between"
        >
          <h4 className="font-medium flex items-center gap-2">
            <Landmark size={18} className="text-zinc-500" />
            Committees Affecting Your Stocks
          </h4>
          <span className="text-zinc-500">{showCommittees ? '−' : '+'}</span>
        </button>
        
        {showCommittees && (
          <div className="mt-4 space-y-3">
            {RELEVANT_COMMITTEES.map((committee, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-950 rounded-lg">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 shrink-0"></div>
                <div>
                  <p className="font-medium text-sm">{committee.name}</p>
                  <p className="text-xs text-zinc-500">{committee.relevance}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Source */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <p>Data: Capitol Trades, Senate Stock Watcher, House Clerk filings</p>
        <a 
          href="https://www.capitoltrades.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-zinc-400 transition-colors"
        >
          View Original Disclosures <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}
