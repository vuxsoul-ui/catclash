'use client'

import { useState, useEffect } from 'react'
import { Timer, Package, Zap } from 'lucide-react'

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    // Calculate next Monday at 12:00 PM
    const getNextDropDate = () => {
      const now = new Date()
      const nextMonday = new Date(now)
      nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7))
      nextMonday.setHours(12, 0, 0, 0)
      
      // If it's already past Monday 12pm, get next Monday
      if (nextMonday <= now) {
        nextMonday.setDate(nextMonday.getDate() + 7)
      }
      
      return nextMonday
    }

    const calculateTimeLeft = () => {
      const now = new Date()
      const nextDrop = getNextDropDate()
      const diff = nextDrop.getTime() - now.getTime()

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      }
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const pad = (num: number) => num.toString().padStart(2, '0')

  return (
    <div className="bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left side - Info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Package className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              Next Pack Drop
              <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </h3>
            <p className="text-slate-400 text-sm">Fresh battle cards dropping Monday at 12PM</p>
          </div>
        </div>

        {/* Right side - Countdown */}
        <div className="flex items-center gap-3">
          <Timer className="w-6 h-6 text-purple-400 hidden md:block" />
          
          <div className="flex gap-2">
            {/* Days */}
            <div className="bg-slate-900/80 rounded-lg p-3 min-w-[60px] text-center border border-slate-700">
              <div className="text-2xl md:text-3xl font-bold text-white">{pad(timeLeft.days)}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Days</div>
            </div>
            
            <div className="text-2xl font-bold text-slate-600 self-center">:</div>
            
            {/* Hours */}
            <div className="bg-slate-900/80 rounded-lg p-3 min-w-[60px] text-center border border-slate-700">
              <div className="text-2xl md:text-3xl font-bold text-white">{pad(timeLeft.hours)}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Hrs</div>
            </div>
            
            <div className="text-2xl font-bold text-slate-600 self-center">:</div>
            
            {/* Minutes */}
            <div className="bg-slate-900/80 rounded-lg p-3 min-w-[60px] text-center border border-slate-700">
              <div className="text-2xl md:text-3xl font-bold text-white">{pad(timeLeft.minutes)}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Min</div>
            </div>
            
            <div className="text-2xl font-bold text-slate-600 self-center">:</div>
            
            {/* Seconds */}
            <div className="bg-slate-900/80 rounded-lg p-3 min-w-[60px] text-center border border-purple-500/50 shadow-lg shadow-purple-500/10">
              <div className="text-2xl md:text-3xl font-bold text-purple-400">{pad(timeLeft.seconds)}</div>
              <div className="text-xs text-purple-500 uppercase tracking-wider">Sec</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
            style={{ width: `${((7 - timeLeft.days) / 7) * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Last Drop</span>
          <span className="text-purple-400 font-medium">FOMO building...</span>
          <span>Next Drop</span>
        </div>
      </div>
    </div>
  )
}
