'use client'

import { useEffect, useState } from 'react'

interface LevelUpAnimationProps {
  level: number
  statGains: { attack: number; defense: number; speed: number }
  evolved: boolean
  newRarity?: string
  onComplete: () => void
}

export default function LevelUpAnimation({ level, statGains, evolved, newRarity, onComplete }: LevelUpAnimationProps) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false)
      setTimeout(onComplete, 500)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                fontSize: `${Math.random() * 20 + 10}px`,
              }}
            >
              {['🎉', '✨', '🎊', '⭐', '💫'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-900 to-slate-900 border-2 border-yellow-500 rounded-3xl p-8 text-center max-w-md animate-pulse">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-4xl font-bold text-yellow-400 mb-2">LEVEL UP!</h2>
        <div className="text-6xl font-bold text-white mb-4">{level}</div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-slate-400 mb-2">Stat Gains:</p>
          <div className="flex justify-center gap-4">
            <span className="text-red-400">+{statGains.attack} ATK</span>
            <span className="text-blue-400">+{statGains.defense} DEF</span>
            <span className="text-green-400">+{statGains.speed} SPD</span>
          </div>
        </div>

        {evolved && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500 rounded-xl p-4 mb-4">
            <p className="text-yellow-400 font-bold">✨ EVOLUTION! ✨</p>
            <p className="text-white">Your cat evolved to {newRarity}!</p>
          </div>
        )}

        <button
          onClick={onComplete}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-xl"
        >
          Awesome!
        </button>
      </div>
    </div>
  )
}
