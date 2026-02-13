'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Target, Share2, Eye, CheckCircle } from 'lucide-react'

interface Quest {
  id: string
  title: string
  description: string
  target: number
  current: number
  reward: number
  icon: typeof Target
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([
    { id: '1', title: 'Battle Veteran', description: 'Vote in 5 battles', target: 5, current: 2, reward: 50, icon: Target },
    { id: '2', title: 'Social Cat', description: 'Share a cat to your Story', target: 1, current: 0, reward: 25, icon: Share2 },
    { id: '3', title: 'Explorer', description: 'View 10 cat profiles', target: 10, current: 4, reward: 15, icon: Eye },
  ])

  const completeQuest = (questId: string) => {
    setQuests(quests.map(q => 
      q.id === questId ? { ...q, current: q.target } : q
    ))
    alert('Quest completed! +XP')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">📜 Daily Quests</h1>
      <p className="text-center text-slate-400 mb-8">Complete quests for bonus XP! Resets daily at midnight.</p>

      <div className="max-w-md mx-auto space-y-4">
        {quests.map((quest) => {
          const Icon = quest.icon
          const isComplete = quest.current >= quest.target
          const progress = (quest.current / quest.target) * 100

          return (
            <div key={quest.id} className={`rounded-xl p-4 ${isComplete ? 'bg-green-900/30 border border-green-500/50' : 'bg-slate-800'}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${isComplete ? 'bg-green-500' : 'bg-purple-600'}`}>
                  {isComplete ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">{quest.title}</h3>
                  <p className="text-sm text-slate-400">{quest.description}</p>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{quest.current}/{quest.target}</span>
                      <span className="text-yellow-400">+{quest.reward} XP</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {isComplete && (
                    <button 
                      onClick={() => completeQuest(quest.id)}
                      className="mt-3 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 px-4 rounded-lg"
                    >
                      Claim Reward
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back to Home</Link>
    </div>
  )
}
