'use client'

import { Share2, X } from 'lucide-react'

interface Cat {
  id: number
  name: string
  rarity: string
  attack: number
  defense: number
  speed: number
}

interface InstagramShareProps {
  cat: Cat
  onClose: () => void
}

export default function InstagramShare({ cat, onClose }: InstagramShareProps) {
  const handleShare = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    
    if (isMobile) {
      window.location.href = 'instagram-stories://share'
      setTimeout(() => {
        alert(`Screenshot ${cat.name}'s card and share to your Story! 🐱`)
      }, 1000)
    } else {
      alert(`Screenshot ${cat.name}'s card and share to your Story! 🐱`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Share to Story</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="bg-slate-700 rounded-xl p-4 mb-4 text-center">
          <div className="text-6xl mb-2">🐱</div>
          <h4 className="text-2xl font-bold">{cat.name}</h4>
          <p className="text-purple-400">{cat.rarity}</p>
          <div className="flex justify-center gap-4 mt-2 text-sm">
            <span>ATK: {cat.attack}</span>
            <span>DEF: {cat.defense}</span>
            <span>SPD: {cat.speed}</span>
          </div>
        </div>
        
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-bold"
        >
          <Share2 className="w-5 h-5" />
          Open Instagram
        </button>
      </div>
    </div>
  )
}
