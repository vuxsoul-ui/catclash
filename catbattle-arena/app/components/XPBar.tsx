'use client'

interface XPBarProps {
  level: number
  xp: number
  xpToNext: number
}

export default function XPBar({ level, xp, xpToNext }: XPBarProps) {
  const progress = Math.min((xp / xpToNext) * 100, 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-yellow-400 font-bold">Lv. {level}</span>
        <span className="text-slate-400">{xp}/{xpToNext} XP</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
