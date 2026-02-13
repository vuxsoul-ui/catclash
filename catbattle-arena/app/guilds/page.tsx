'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flame, Droplets, TreePine, Zap } from 'lucide-react'

const guilds = [
  { id: 'flame', name: 'House Flame', icon: Flame, color: 'from-red-500 to-orange-500', members: 142, wins: 1234 },
  { id: 'ocean', name: 'House Ocean', icon: Droplets, color: 'from-blue-500 to-cyan-500', members: 138, wins: 1198 },
  { id: 'forest', name: 'House Forest', icon: TreePine, color: 'from-green-500 to-emerald-500', members: 156, wins: 1256 },
  { id: 'storm', name: 'House Storm', icon: Zap, color: 'from-purple-500 to-violet-500', members: 129, wins: 1102 },
]

export default function GuildsPage() {
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null)

  const sortedGuilds = [...guilds].sort((a, b) => b.wins - a.wins)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">⚔️ Choose Your Guild</h1>
      <p className="text-center text-slate-400 mb-8">Join a house and compete for glory!</p>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {sortedGuilds.map((guild, idx) => {
          const Icon = guild.icon
          return (
            <button
              key={guild.id}
              onClick={() => setSelectedGuild(guild.id)}
              className={`relative bg-gradient-to-br ${guild.color} rounded-2xl p-6 text-left transition-all hover:scale-105 ${
                selectedGuild === guild.id ? 'ring-4 ring-white' : ''
              }`}
            >
              {idx === 0 && (
                <div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
                  #1
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{guild.name}</h3>
                  <div className="flex gap-4 text-sm mt-1">
                    <span>{guild.members} members</span>
                    <span>{guild.wins} wins</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedGuild && (
        <div className="text-center mt-8">
          <button className="bg-white text-black font-bold py-3 px-8 rounded-xl hover:bg-slate-200">
            Join {guilds.find(g => g.id === selectedGuild)?.name}
          </button>
        </div>
      )}

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back to Home</Link>
    </div>
  )
}
