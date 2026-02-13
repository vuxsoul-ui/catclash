'use client'

import { useState } from 'react'
import Link from 'next/link'
import DailyStreak from './components/DailyStreak'
import LevelUpAnimation from '../components/LevelUpAnimation'

const catA = { 
  id: 1, 
  name: 'Whiskers', 
  rarity: 'Legendary', 
  attack: 95, 
  defense: 80,
  level: 5,
  xp: 45,
  xpToNext: 100
}
const catB = { 
  id: 2, 
  name: 'Mittens', 
  rarity: 'Epic', 
  attack: 75, 
  defense: 85,
  level: 3,
  xp: 80,
  xpToNext: 100
}

interface CatProgress {
  level: number
  xp: number
  attack: number
  defense: number
  speed: number
  rarity: string
}

export default function BattlePage() {
  const [voted, setVoted] = useState(false)
  const [catAProgress, setCatAProgress] = useState<CatProgress>({
    level: catA.level,
    xp: catA.xp,
    attack: catA.attack,
    defense: catA.defense,
    speed: 70,
    rarity: catA.rarity
  })
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState({
    level: 0,
    statGains: { attack: 0, defense: 0, speed: 0 },
    evolved: false,
    newRarity: ''
  })

  const checkEvolution = (level: number, currentRarity: string): { evolved: boolean; newRarity: string } => {
    const evolutions: Record<string, { level: number; chance: number; next: string }> = {
      'Common': { level: 5, chance: 0.5, next: 'Rare' },
      'Rare': { level: 10, chance: 0.3, next: 'Epic' },
      'Epic': { level: 20, chance: 0.1, next: 'Legendary' }
    }

    const evo = evolutions[currentRarity]
    if (evo && level >= evo.level && Math.random() < evo.chance) {
      return { evolved: true, newRarity: evo.next }
    }
    return { evolved: false, newRarity: currentRarity }
  }

  const awardXP = (winnerId: number) => {
    console.log('Winner:', winnerId)
    const xpGain = 25 // Winner gets more
    const newXp = catAProgress.xp + xpGain
    
    if (newXp >= catAProgress.level * 100) {
      // Level up!
      const newLevel = catAProgress.level + 1
      const remainingXp = newXp - (catAProgress.level * 100)
      
      // Distribute stat points
      const statGains = {
        attack: Math.floor(Math.random() * 3) + 1,
        defense: Math.floor(Math.random() * 3) + 1,
        speed: Math.floor(Math.random() * 3) + 1
      }

      // Check evolution
      const { evolved, newRarity } = checkEvolution(newLevel, catAProgress.rarity)

      setLevelUpData({
        level: newLevel,
        statGains,
        evolved,
        newRarity
      })
      setShowLevelUp(true)

      setCatAProgress(prev => ({
        ...prev,
        level: newLevel,
        xp: remainingXp,
        attack: prev.attack + statGains.attack,
        defense: prev.defense + statGains.defense,
        speed: prev.speed + statGains.speed,
        rarity: evolved ? newRarity : prev.rarity
      }))
    } else {
      setCatAProgress(prev => ({ ...prev, xp: newXp }))
    }

    setVoted(true)
    setTimeout(() => setVoted(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4 text-center">Battle Arena</h1>
      
      <DailyStreak />
      
      {voted && (
        <div className="text-center text-green-400 mb-4">+25 XP! Vote recorded!</div>
      )}

      {showLevelUp && (
        <LevelUpAnimation
          level={levelUpData.level}
          statGains={levelUpData.statGains}
          evolved={levelUpData.evolved}
          newRarity={levelUpData.newRarity}
          onComplete={() => setShowLevelUp(false)}
        />
      )}

      <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
        {/* Cat A */}
        <button
          onClick={() => awardXP(catA.id)}
          className="bg-slate-800 rounded-xl p-6 w-64 hover:scale-105 transition-transform"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-yellow-400 font-bold">Lv. {catAProgress.level}</span>
            <span className="text-xs text-slate-400">XP: {catAProgress.xp}/{catAProgress.level * 100}</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full mb-4">
            <div 
              className="h-full bg-yellow-500 rounded-full"
              style={{ width: `${(catAProgress.xp / (catAProgress.level * 100)) * 100}%` }}
            />
          </div>
          <div className="h-48 bg-slate-700 rounded-lg mb-4 flex items-center justify-center text-slate-500">
            [Cat A]
          </div>
          <h3 className="text-xl font-bold">{catA.name}</h3>
          <span className="text-yellow-500">{catAProgress.rarity}</span>
          <div className="mt-4 text-sm">
            <div>Attack: {catAProgress.attack}</div>
            <div>Defense: {catAProgress.defense}</div>
          </div>
          <div className="mt-4 bg-purple-600 py-2 rounded font-bold">Vote (+25 XP)</div>
        </button>

        <div className="text-4xl font-bold text-purple-400">VS</div>

        {/* Cat B */}
        <button
          onClick={() => awardXP(catB.id)}
          className="bg-slate-800 rounded-xl p-6 w-64 hover:scale-105 transition-transform"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-yellow-400 font-bold">Lv. {catB.level}</span>
          </div>
          <div className="h-48 bg-slate-700 rounded-lg mb-4 flex items-center justify-center text-slate-500">
            [Cat B]
          </div>
          <h3 className="text-xl font-bold">{catB.name}</h3>
          <span className="text-purple-500">{catB.rarity}</span>
          <div className="mt-4 text-sm">
            <div>Attack: {catB.attack}</div>
            <div>Defense: {catB.defense}</div>
          </div>
          <div className="mt-4 bg-purple-600 py-2 rounded font-bold">Vote (+25 XP)</div>
        </button>
      </div>

      <Link href="/" className="block text-center mt-12 text-slate-400">← Back</Link>
    </div>
  )
}
