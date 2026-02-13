import { Crown, Trophy } from 'lucide-react'

export default function CatOfTheWeek() {
  return (
    <div className="relative">
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-4 py-2 rounded-full font-bold text-sm z-10">
        <Crown className="w-5 h-5" />
        CAT OF THE WEEK
      </div>
      
      <div className="bg-gradient-to-br from-purple-900/50 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-6 pt-10">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-48 h-48 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              [Cat Image]
            </div>
            <div className="absolute -bottom-3 -right-3 bg-yellow-500 text-black rounded-full p-2">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-yellow-400 mb-2">Shadow</h2>
            <p className="text-slate-400 mb-4">@shadowthecat</p>
            
            <div className="flex gap-6 justify-center md:justify-start">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">2,847</div>
                <div className="text-xs text-slate-500">votes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">15</div>
                <div className="text-xs text-slate-500">wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">Legendary</div>
                <div className="text-xs text-slate-500">rarity</div>
              </div>
            </div>
            
            <div className="mt-4 inline-flex items-center gap-2 text-yellow-500">
              <span>👑</span>
              <span className="font-medium">Reigning Champion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
