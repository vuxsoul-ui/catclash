'use client'

import { useState } from 'react'
import Link from 'next/link'

const leaderboard = [
  { rank: 1, name: 'Whiskers', votes: 1234, rarity: 'Legendary', level: 15, attack: 120, defense: 95, speed: 88 },
  { rank: 2, name: 'Mittens', votes: 987, rarity: 'Epic', level: 12, attack: 98, defense: 102, speed: 75 },
  { rank: 3, name: 'Shadow', votes: 756, rarity: 'Rare', level: 8, attack: 75, defense: 68, speed: 92 },
  { rank: 4, name: 'Fluffy', votes: 543, rarity: 'Common', level: 5, attack: 45, defense: 52, speed: 48 },
  { rank: 5, name: 'Pumpkin', votes: 432, rarity: 'Common', level: 3, attack: 38, defense: 41, speed: 35 },
]

const rarityColors: Record<string, string> = {
  Common: 'text-gray-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
  Legendary: 'text-yellow-400',
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'votes' | 'power'>('votes')

  const sortedByPower = [...leaderboard].sort((a, b) => 
    (b.attack + b.defense + b.speed) - (a.attack + a.defense + a.speed)
  )

  const displayList = tab === 'votes' ? leaderboard : sortedByPower

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Leaderboard</h1>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => setTab('votes')}
          className={`px-6 py-2 rounded-lg font-medium ${tab === 'votes' ? 'bg-purple-600' : 'bg-slate-700'}`}
        >
          By Votes
        </button>
        <button
          onClick={() => setTab('power')}
          className={`px-6 py-2 rounded-lg font-medium ${tab === 'power' ? 'bg-purple-600' : 'bg-slate-700'}`}
        >
          By Power
        </button>
      </div>
      
      <div className="max-w-lg mx-auto">
        {displayList.map((cat, index) => {
          const totalPower = cat.attack + cat.defense + cat.speed
          const displayRank = tab === 'power' ? index + 1 : cat.rank
          
          return (
            <div
              key={cat.name}
              className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg mb-3"
            >
              <div className="text-2xl font-bold w-8">#{displayRank}</div>
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xs">
                [img]
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{cat.name}</span>
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Lv.{cat.level}</span>
                </div>
                <div className={`text-sm ${rarityColors[cat.rarity]}`}>{cat.rarity}</div>
              </div>
              <div className="text-right">
                {tab === 'votes' ? (
                  <>
                    <div className="font-bold">{cat.votes}</div>
                    <div className="text-xs text-slate-400">votes</div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-purple-400">{totalPower}</div>
                    <div className="text-xs text-slate-400">power</div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back</Link>
    </div>
  )
}
