'use client';

import React, { useState } from 'react';
import { Crown } from 'lucide-react';

interface Cat {
  id: string;
  name: string;
  image_url: string;
  votes?: number;
}

interface BattleCardProps {
  cat: Cat;
  isWinner?: boolean;
  isLoser?: boolean;
  votePercent?: number;
  voteColor?: string;
  disabled?: boolean;
  animDirection?: 'left' | 'right';
  onVote?: () => void;
  explosionText?: string;
}

export default function BattleCard({
  cat,
  isWinner,
  isLoser,
  votePercent = 50,
  voteColor = 'bg-blue-500',
  disabled,
  animDirection,
  onVote,
  explosionText = '+5 XP',
}: BattleCardProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const [showFloat, setShowFloat] = useState(false);

  const handleClick = () => {
    if (disabled || !onVote) return;
    
    setIsFlashing(true);
    setShowFloat(true);
    
    setTimeout(() => setIsFlashing(false), 250);
    setTimeout(() => setShowFloat(false), 1000);
    
    onVote();
  };

  const animClass = animDirection === 'left' 
    ? 'animate-slide-in-left' 
    : animDirection === 'right' 
    ? 'animate-slide-in-right' 
    : '';

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`relative group ${animClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* Card */}
      <div className={`relative h-40 rounded-xl overflow-hidden bg-white/5 transition-all ${
        isFlashing ? (voteColor.includes('blue') ? 'ring-4 ring-blue-500' : 'ring-4 ring-red-500') : ''
      } ${isWinner ? 'ring-2 ring-yellow-400' : ''} ${isLoser ? 'opacity-60 grayscale' : ''}`}>
        <img
          src={cat.image_url || '/cat-placeholder.svg'}
          alt={cat.name || ''}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
          }}
        />
        
        {/* Winner Crown */}
        {isWinner && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <Crown className="w-8 h-8 text-yellow-400 drop-shadow-lg" />
          </div>
        )}
      </div>
      
      {/* Name */}
      <p className="mt-2 font-bold text-center">{cat.name}</p>
      
      {/* Votes */}
      <p className="text-sm text-white/50 text-center">{cat.votes || 0} votes</p>
      
      {/* Vote Percentage Bar */}
      <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${voteColor} transition-all duration-500 ease-out`}
          style={{ width: `${votePercent}%` }}
        />
      </div>
      <p className="text-xs text-white/40 text-center mt-1">{votePercent}%</p>
      
      {/* Floating XP Explosion */}
      {showFloat && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-float-up pointer-events-none">
          <span className="text-yellow-400 font-bold text-lg drop-shadow-lg">{explosionText}</span>
        </div>
      )}
    </button>
  );
}
