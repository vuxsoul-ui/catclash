"use client"

import { useState, useEffect } from "react"
import { User, Plus, Trash2, Save, RotateCcw } from "lucide-react"

const DEFAULT = {
  name: "Kai's Portfolio",
  positions: [
    { ticker: "NVDA", shares: 60.34, cost: 184.51 },
    { ticker: "ONDS", shares: 454.47, cost: 11.78 },
    { ticker: "SLS", shares: 207.77, cost: 4.31 },
    { ticker: "VOO", shares: 1.43, cost: 636.11 },
  ]
}

export function PortfolioSetup() {
  const [isOpen, setIsOpen] = useState(false)
  const [portfolio, setPortfolio] = useState(DEFAULT)
  const [newTicker, setNewTicker] = useState("")
  const [newShares, setNewShares] = useState("")
  const [newCost, setNewCost] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("userPortfolio")
    if (saved) {
      try {
        setPortfolio(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  const savePortfolio = () => {
    localStorage.setItem("userPortfolio", JSON.stringify(portfolio))
    window.location.reload()
  }

  const resetToDefault = () => {
    if (confirm("Reset to demo portfolio?")) {
      localStorage.removeItem("userPortfolio")
      window.location.reload()
    }
  }

  const addPosition = () => {
    if (!newTicker || !newShares || !newCost) return
    setPortfolio({
      ...portfolio,
      positions: [...portfolio.positions, {
        ticker: newTicker.toUpperCase(),
        shares: parseFloat(newShares),
        cost: parseFloat(newCost)
      }]
    })
    setNewTicker("")
    setNewShares("")
    setNewCost("")
  }

  const removePosition = (index) => {
    const newPositions = [...portfolio.positions]
    newPositions.splice(index, 1)
    setPortfolio({ ...portfolio, positions: newPositions })
  }

  const updatePosition = (index, field, value) => {
    const newPositions = [...portfolio.positions]
    newPositions[index] = { ...newPositions[index], [field]: field === "ticker" ? value.toUpperCase() : parseFloat(value) || 0 }
    setPortfolio({ ...portfolio, positions: newPositions })
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg">
        <User size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Portfolio Setup</h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg text-2xl">×</button>
            </div>

            <div className="p-6 space-y-6">
              <input
                type="text"
                value={portfolio.name}
                onChange={(e) => setPortfolio({ ...portfolio, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3"
                placeholder="Portfolio Name"
              />

              <div className="space-y-2">
                {portfolio.positions.map((pos, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-zinc-950 rounded-lg">
                    <input type="text" value={pos.ticker} onChange={(e) => updatePosition(idx, "ticker", e.target.value)} className="w-20 bg-transparent font-mono font-bold" />
                    <input type="number" step="0.01" value={pos.shares} onChange={(e) => updatePosition(idx, "shares", e.target.value)} className="flex-1 bg-transparent" placeholder="Shares" />
                    <input type="number" step="0.01" value={pos.cost} onChange={(e) => updatePosition(idx, "cost", e.target.value)} className="flex-1 bg-transparent" placeholder="Cost Basis" />
                    <button onClick={() => removePosition(idx)} className="p-2 text-red-400 hover:bg-red-950 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono" placeholder="Ticker" />
                <input type="number" step="0.01" value={newShares} onChange={(e) => setNewShares(e.target.value)} className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3" placeholder="Shares" />
                <input type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3" placeholder="Cost" />
                <button onClick={addPosition} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg"><Plus size={20} /></button>
              </div>

              <div className="flex gap-3">
                <button onClick={savePortfolio} className="flex-1 py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white">
                  Save & Apply
                </button>
                <button onClick={resetToDefault} className="px-6 py-3 border border-zinc-700 rounded-lg hover:bg-zinc-800 flex items-center gap-2">
                  <RotateCcw size={18} /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
