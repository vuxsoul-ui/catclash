'use client';

import React from 'react';
import { Check, Target, Trophy, Zap } from 'lucide-react';

interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  icon: React.ReactNode;
}

interface DailyQuestsProps {
  streak: number;
  votesToday: number;
  checkedIn: boolean;
}

export default function DailyQuests({ streak, votesToday, checkedIn }: DailyQuestsProps) {
  const quests: Quest[] = [
    {
      id: 'checkin',
      title: 'Daily Check-in',
      description: 'Claim your daily streak',
      reward: 10 + (streak * 2),
      completed: checkedIn,
      icon: <Zap className="w-4 h-4 text-yellow-400" />,
    },
    {
      id: 'votes',
      title: 'Battle Voter',
      description: 'Vote in 5 matches',
      reward: 25,
      completed: votesToday >= 5,
      icon: <Target className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'streak',
      title: 'Streak Keeper',
      description: 'Maintain a 3+ day streak',
      reward: 50,
      completed: streak >= 3,
      icon: <Trophy className="w-4 h-4 text-orange-400" />,
    },
  ];

  const completedCount = quests.filter(q => q.completed).length;
  const totalReward = quests.reduce((sum, q) => sum + (q.completed ? q.reward : 0), 0);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Daily Quests</h3>
        <span className="text-sm text-white/50">{completedCount}/{quests.length} Complete</span>
      </div>
      
      <div className="space-y-3">
        {quests.map((quest) => (
          <div 
            key={quest.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              quest.completed 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-white/5 border border-white/10'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              quest.completed ? 'bg-green-500/20' : 'bg-white/10'
            }`}>
              {quest.completed ? <Check className="w-5 h-5 text-green-400" /> : quest.icon}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${quest.completed ? 'text-green-400' : ''}`}>{quest.title}</p>
              <p className="text-xs text-white/50">{quest.description}</p>
            </div>
            <span className={`text-sm font-bold ${quest.completed ? 'text-green-400' : 'text-yellow-400'}`}>
              +{quest.reward} XP
            </span>
          </div>
        ))}
      </div>
      
      {completedCount === quests.length && (
        <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
          <p className="text-yellow-400 font-bold">All Quests Complete! 🎉</p>
          <p className="text-sm text-white/60">+{totalReward} XP earned today</p>
        </div>
      )}
    </div>
  );
}
