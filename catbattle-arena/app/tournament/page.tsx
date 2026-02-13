'use client'

import { useState } from 'react'
import Link from 'next/link'

const tournamentCats = [
  { id: 1, name: 'Whiskers', level: 15, attack: 120, defense: 95 },
  { id: 2, name: 'Mittens', level: 12, attack: 98, defense: 102 },
  { id: 3, name: 'Shadow', level: 8, attack: 75, defense: 68 },
  { id: 4, name: 'Luna', level: 10, attack: 88, defense: 92 },
  { id: 5, name: 'Oliver', level: 5, attack: 45, defense: 50 },
  { id: 6, name: 'Bella', level: 7, attack: 65, defense: 70 },
  { id: 7, name: 'Max', level: 9, attack: 82, defense: 78 },
  { id: 8, name: 'Lucy', level: 6, attack: 55, defense: 60 },
]

export default function TournamentPage() {
  const [currentRound] = useState(1)
  const [votes, setVotes] = useState<Record<number, number>>({})

  const rounds = ['Round 1', 'Quarter Finals', 'Semi Finals', 'Finals']

  const handleVote = (matchId: number, catId: number) => {
    setVotes({ ...votes, [matchId]: catId })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">🏆 Tournament</h1>
      <p className="text-center text-slate-400 mb-6">16 cats enter. 1 champion emerges.</p>

      {/* Progress */}
      <div className="flex justify-center gap-2 mb-8">
        {rounds.map((round, idx) => (
          <div
            key={round}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              idx + 1 === currentRound ? 'bg-purple-600' : 'bg-slate-800'
            }`}
          >
            {round}
          </div>
        ))}
      </div>

      {/* Bracket */}
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {tournamentCats.filter((_, i) => i < 4).map((cat, idx) => {
            const matchId = idx
            const opponent = tournamentCats[idx + 4]
            return (
              <div key={matchId} className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => handleVote(matchId, cat.id)}
                    className={`flex-1 p-3 rounded-lg text-left transition-all ${
                      votes[matchId] === cat.id ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-bold">{cat.name}</div>
                    <div className="text-xs text-slate-400">Lv.{cat.level}</div>
                  </button>
                  
                  <span className="text-slate-500 font-bold">VS</span>
                  
                  <button
                    onClick={() => handleVote(matchId, opponent.id)}
                    className={`flex-1 p-3 rounded-lg text-left transition-all ${
                      votes[matchId] === opponent.id ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-bold">{opponent.name}</div>
                    <div className="text-xs text-slate-400">Lv.{opponent.level}</div>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-center mt-8">
        <button className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-xl hover:bg-yellow-400">
          Submit Bracket
        </button>
      </div>

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back to Home</Link>
    </div>
  )
}
