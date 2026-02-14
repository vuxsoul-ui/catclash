'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Cat {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
  ability: string;
  power: number;
  cat_level: number;
}

export default function GalleryPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCats();
  }, []);

  async function loadCats() {
    try {
      const res = await fetch('/api/cats/approved');
      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error || 'Failed to load cats');
      } else {
        setCats(data.cats || []);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function getRarityColor(rarity: string): string {
    const colors: Record<string, string> = {
      'Common': 'border-gray-500 text-gray-400',
      'Rare': 'border-blue-500 text-blue-400',
      'Epic': 'border-purple-500 text-purple-400',
      'Legendary': 'border-yellow-500 text-yellow-400',
      'Mythic': 'border-red-500 text-red-400',
      'God-Tier': 'border-pink-500 text-pink-400'
    };
    return colors[rarity] || 'border-gray-500 text-gray-400';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Cat Gallery</h1>
          <p className="text-white/60">Meet the warriors</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/20 text-red-200 text-center">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cats.map((cat) => (
            <div key={cat.id} className={`glass rounded-2xl overflow-hidden border-2 ${getRarityColor(cat.rarity)}`}>
              <div className="relative h-48 bg-white/5">
              <img
  src={cat.image_url || "https://placekitten.com/300/300"}
  alt={cat.name || ""}
  className="w-full h-full object-cover"
  onError={(e) => {
    (e.currentTarget as HTMLImageElement).src = "https://placekitten.com/300/300";
  }}
/>

              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{cat.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded border ${getRarityColor(cat.rarity)}`}>{cat.rarity}</span>
                </div>
                <p className="text-sm text-white/50 mb-2">{cat.ability}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/40">
                  <div>ATK: {cat.stats?.attack || 0}</div>
                  <div>DEF: {cat.stats?.defense || 0}</div>
                  <div>SPD: {cat.stats?.speed || 0}</div>
                  <div>CHA: {cat.stats?.charisma || 0}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between">
                  <span className="text-sm text-white/60">Power: {cat.power || 0}</span>
                  <span className="text-xs text-white/40">Lvl {cat.cat_level || 1}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && cats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/60 mb-4">No approved cats yet!</p>
            <Link href="/submit" className="inline-block px-6 py-3 bg-white text-black rounded-xl font-bold">
              Submit the first cat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
