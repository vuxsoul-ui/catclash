'use client'

import { useState, useEffect } from 'react'
import { Flame, Award, Trophy, Zap, Crown } from 'lucide-react'

interface StreakData {
  currentStreak: number
  lastVoteDate: string | null
  longestStreak: number
}

const getMotivationalMessage = (streak: number): string => {
  if (streak === 0) return "Start your streak today!"
  if (streak === 1) return "First day! Keep it going!"
  if (streak < 3) return "Building momentum!"
  if (streak < 5) return "You're on fire! 🔥"
  if (streak < 7) return "Unstoppable! Keep voting!"
  if (streak < 14) return "Legendary streak! 👑"
  if (streak < 30) return "You're a CatBattle master!"
  return "ULTIMATE CHAMPION! 🏆"
}

const getStreakIcon = (streak: number) => {
  if (streak >= 30) return Crown
  if (streak >= 14) return Trophy
  if (streak >= 7) return Zap
  if (streak >= 3) return Award
  return Flame
}

const getStreakColor = (streak: number): string => {
  if (streak >= 30) return 'from-yellow-400 via-amber-500 to-yellow-600'
  if (streak >= 14) return 'from-purple-400 via-pink-500 to-purple-600'
  if (streak >= 7) return 'from-orange-400 via-red-500 to-orange-600'
  if (streak >= 3) return 'from-blue-400 via-cyan-500 to-blue-600'
  return 'from-red-400 via-orange-500 to-red-600'
}

export default function DailyStreak() {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    lastVoteDate: null,
    longestStreak: 0,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Load streak from localStorage
    const stored = localStorage.getItem('catbattle-streak')
    const today = new Date().toDateString()
    
    if (stored) {
      const data: StreakData = JSON.parse(stored)
      const lastVote = data.lastVoteDate
      
      if (lastVote) {
        const lastDate = new Date(lastVote)
        const todayDate = new Date(today)
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 0) {
          // Already voted today, keep streak
          setStreakData(data)
        } else if (diffDays === 1) {
          // Voted yesterday, streak continues (but hasn't voted today yet)
          setStreakData(data)
        } else {
          // Missed a day, reset streak
          const resetData = {
            currentStreak: 0,
            lastVoteDate: null,
            longestStreak: data.longestStreak,
          }
          setStreakData(resetData)
          localStorage.setItem('catbattle-streak', JSON.stringify(resetData))
        }
      }
    }
  }, [])

  const simulateVote = () => {
    const today = new Date().toDateString()
    const newStreak = streakData.currentStreak + 1
    
    const newData: StreakData = {
      currentStreak: newStreak,
      lastVoteDate: today,
      longestStreak: Math.max(newStreak, streakData.longestStreak),
    }
    
    setStreakData(newData)
    localStorage.setItem('catbattle-streak', JSON.stringify(newData))
  }

  if (!mounted) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-pulse">
        <div className="h-16 bg-slate-700 rounded"></div>
      </div>
    )
  }

  const StreakIcon = getStreakIcon(streakData.currentStreak)
  const gradientColors = getStreakColor(streakData.currentStreak)
  const message = getMotivationalMessage(streakData.currentStreak)

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Streak Counter */}
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 bg-gradient-to-br ${gradientColors} rounded-xl flex items-center justify-center shadow-lg`}>
            <StreakIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{streakData.currentStreak}</span>
              <span className="text-slate-400">day{streakData.currentStreak !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className={`w-4 h-4 ${streakData.currentStreak > 0 ? 'text-orange-500 fill-orange-500' : 'text-slate-600'}`} />
              <span className="text-sm text-slate-400">current streak</span>
            </div>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="text-center md:text-left flex-1">
          <p className={`text-lg font-semibold bg-gradient-to-r ${gradientColors} bg-clip-text text-transparent`}>
            {message}
          </p>
          {streakData.longestStreak > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Best streak: <span className="text-slate-300">{streakData.longestStreak} days</span>
            </p>
          )}
        </div>

        {/* Streak Progress Dots */}
        <div className="flex items-center gap-1">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < streakData.currentStreak % 7 || (streakData.currentStreak > 0 && i === 0 && streakData.currentStreak % 7 === 0)
                  ? `bg-gradient-to-br ${gradientColors}`
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Vote to continue button (demo purposes) */}
      {streakData.lastVoteDate !== new Date().toDateString() && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
          <p className="text-sm text-slate-400">Vote today to keep your streak alive!</p>
          <button
            onClick={simulateVote}
            className="text-sm bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Vote Now
          </button>
        </div>
      )}
    </div>
  )
}
