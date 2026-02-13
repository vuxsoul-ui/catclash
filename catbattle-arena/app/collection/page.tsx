'use client'

import { useState } from 'react'
import Link from 'next/link'

const mockCollection = [
  { id: 1, name: 'Whiskers', rarity: 'Legendary', level: 15, collected: true },
  { id: 2, name: 'Mittens', rarity: 'Epic', level: 12, collected: true },
  { id: 3, name: 'Shadow', rarity: 'Rare', level: 8, collected: true },
  { id: 4, name: 'Luna', rarity: 'Legendary', level: 10, collected: false },
  { id: 5, name: 'Oliver', rarity: 'Common', level: 5, collected: true },
  { id: 6, name: 'Bella', rarity: 'Epic', level: 7, collected: false },
]

const rarityColors: Record<string, string> = {
  Common: 'border-gray-500',
  Rare: 'border-blue-500',
  Epic: 'border-purple-500',
  Legendary: 'border-yellow-500',
}

const rarityBg: Record<string, string> = {
  Common: 'bg-gray-500/20',
  Rare: 'bg-blue-500/20',
  Epic: 'bg-purple-500/20',
  Legendary: 'bg-yellow-500/20',
}

export default function CollectionPage() {
  const [filter, setFilter] = useState('all')

  const collected = mockCollection.filter(c => c.collected)
  const stats = {
    Common: collected.filter(c => c.rarity === 'Common').length,
    Rare: collected.filter(c => c.rarity === 'Rare').length,
    Epic: collected.filter(c => c.rarity === 'Epic').length,
    Legendary: collected.filter(c => c.rarity === 'Legendary').length,
  }

  const filtered = filter === 'all' 
    ? mockCollection 
    : mockCollection.filter(c => c.rarity === filter)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">📚 Your Collection</h1>
      
      {/* Stats */}
      <div className="flex justify-center gap-4 mb-6 flex-wrap">
        {Object.entries(stats).map(([rarity, count]) => (
          <div key={rarity} className={`px-4 py-2 rounded-lg ${rarityBg[rarity]}`}>
            <span className="text-sm">{rarity}: {count}</span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="max-w-md mx-auto mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span>Collection Progress</span>
          <span>{collected.length}/{mockCollection.length}</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${(collected.length / mockCollection.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 justify-center">
        {['all', 'Common', 'Rare', 'Epic', 'Legendary'].map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === r ? 'bg-purple-600' : 'bg-slate-800'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {filtered.map((cat) => (
          <div 
            key={cat.id} 
            className={`bg-slate-800 rounded-xl p-4 border-2 ${rarityColors[cat.rarity]} ${!cat.collected ? 'opacity-50' : ''}`}
          >
            <div className="h-24 bg-slate-700 rounded-lg mb-3 flex items-center justify-center text-2xl">
              {cat.collected ? '🐱' : '?'}
            </div>
            <h3 className="font-bold text-sm">{cat.collected ? cat.name : '???'}</h3>
            <p className="text-xs text-slate-400">{cat.rarity}</p>
            {cat.collected && (
              <p className="text-xs text-yellow-400">Lv.{cat.level}</p>
            )}
          </div>
        ))}
      </div>

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back to Home</Link>
    </div>
  )
}
