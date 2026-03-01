'use client'

import { Share2 } from 'lucide-react'

interface InstagramShareProps {
  catName: string
  catStats: {
    attack: number
    defense: number
    speed: number
    rarity: string
  }
}

export default function InstagramShare({ catName, catStats }: InstagramShareProps) {
  const handleShare = () => {
    // Try to open Instagram Stories
    const text = `Check out ${catName} on CatClash Arena! ⚔️\n\nAttack: ${catStats.attack}\nDefense: ${catStats.defense}\nSpeed: ${catStats.speed}\nRarity: ${catStats.rarity}\n\nVote for them at catclash.org!`
    
    // Check if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    
    if (isMobile) {
      // Try Instagram URL scheme
      window.location.href = `instagram-stories://share?text=${encodeURIComponent(text)}`
      
      // Fallback after 1 second
      setTimeout(() => {
        alert('Screenshot this card and share to your Instagram Story! 📸')
      }, 1000)
    } else {
      // Desktop fallback
      alert('Screenshot this card and share to your Instagram Story! 📸')
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all"
    >
      <Share2 className="w-4 h-4" />
      Share to Story
    </button>
  )
}
