'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'

interface StreakData {
  count: number
  lastVoteDate: string
}

export default function DailyStreak() {
  const [streak, setStreak] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('battleStreak')
    const today = new Date().toDateString()
    
    if (stored) {
      const data: StreakData = JSON.parse(stored)
      const lastDate = new Date(data.lastVoteDate).toDateString()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      if (lastDate === today) {
        setStreak(data.count)
      } else if (lastDate === yesterday.toDateString()) {
        setStreak(data.count)
      } else {
        setStreak(0)
      }
    }
  }, [])

  useEffect(() => {
    if (streak >= 30) setMessage('UNSTOPPABLE!')
    else if (streak >= 14) setMessage('Battle Legend!')
    else if (streak >= 7) setMessage('On Fire!')
    else if (streak >= 3) setMessage('Heating Up!')
    else if (streak > 0) setMessage('Keep it going!')
    else setMessage('Start your streak today!')
  }, [streak])

  return (
    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/50 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 rounded-full p-2">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-400">{streak} Day Streak</div>
            <div className="text-sm text-orange-200">{message}</div>
          </div>
        </div>
        {streak > 0 && (
          <div className="text-4xl">
            {streak >= 30 ? '👑' : streak >= 14 ? '🏆' : streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '✨'}
          </div>
        )}
      </div>
    </div>
  )
}
