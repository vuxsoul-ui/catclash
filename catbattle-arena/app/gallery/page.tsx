'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Share2 } from 'lucide-react'
import InstagramShare from './components/InstagramShare'

const mockCats = [
  { id: 1, name: 'Whiskers', rarity: 'Legendary', attack: 95, defense: 80, speed: 70 },
  { id: 2, name: 'Mittens', rarity: 'Epic', attack: 75, defense: 85, speed: 60 },
  { id: 3, name: 'Shadow', rarity: 'Rare', attack: 65, defense: 70, speed: 90 },
  { id: 4, name: 'Luna', rarity: 'Legendary', attack: 88, defense: 92, speed: 75 },
  { id: 5, name: 'Oliver', rarity: 'Common', attack: 45, defense: 50, speed: 55 },
  { id: 6, name: 'Bella', rarity: 'Epic', attack: 82, defense: 78, speed: 85 },
]

const rarityColors: Record<string, string> = {
  Common: 'bg-gray-500',
  Rare: 'bg-blue-500',
  Epic: 'bg-purple-500',
  Legendary: 'bg-yellow-500',
}

export default function GalleryPage() {
  const [filter, setFilter] = useState('all')
  const [shareCat, setShareCat] = useState<typeof mockCats[0] | null>(null)
  
  const cats = filter === 'all' ? mockCats : mockCats.filter(c => c.rarity === filter)

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Battle Card Gallery</h1>
      
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'Common', 'Rare', 'Epic', 'Legendary'].map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-4 py-2 rounded ${filter === r ? 'bg-purple-600' : 'bg-slate-700'}`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cats.map((cat) => (
          <div key={cat.id} className="bg-slate-800 rounded-xl p-4 group relative">
            {/* Share Button */}
            <button
              onClick={() => setShareCat(cat)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-slate-700/80 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
              title="Share to Instagram Story"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>

            <Link href={`/cat/${cat.id}`}>
              <div className="h-48 bg-slate-700 rounded-lg mb-4 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-600 transition-colors">
                <div className="text-center">
                  <span className="text-6xl">🐱</span>
                  <p className="text-sm mt-2">{cat.name}</p>
                </div>
              </div>
            </Link>
            <span className={`inline-block px-2 py-1 rounded text-xs ${rarityColors[cat.rarity]}`}>
              {cat.rarity}
            </span>
            <Link href={`/cat/${cat.id}`}>
              <h3 className="text-xl font-bold mt-2 hover:text-purple-400 transition-colors cursor-pointer">{cat.name}</h3>
            </Link>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Attack</span><span>{cat.attack}</span></div>
              <div className="flex justify-between"><span>Defense</span><span>{cat.defense}</span></div>
              <div className="flex justify-between"><span>Speed</span><span>{cat.speed}</span></div>
            </div>
            
            {/* Mobile share button (always visible) */}
            <button
              onClick={() => setShareCat(cat)}
              className="mt-4 w-full py-2 bg-slate-700 hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all md:hidden"
            >
              <Share2 className="w-4 h-4" />
              Share to Story
            </button>
          </div>
        ))}
      </div>
      
      <Link href="/" className="block text-center mt-8 text-slate-400">← Back</Link>

      {/* Instagram Share Modal */}
      {shareCat && (
        <InstagramShare 
          cat={shareCat} 
          onClose={() => setShareCat(null)} 
        />
      )}
    </div>
  )
}
