'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Loader2, Check, X, Shield } from 'lucide-react';
import Link from 'next/link';

interface Cat {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
  ability: string;
  created_at: string;
}

export default function AdminPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showSecretInput, setShowSecretInput] = useState(true);

  async function loadPending() {
    try {
      const res = await fetch('/api/cats/pending');
      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error || 'Failed to load');
      } else {
        setCats(data.cats || []);
        setShowSecretInput(false);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(catId: string) {
    setProcessing(catId);
    try {
      const res = await fetch('/api/admin/cats/approve', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({ catId })
      });
      
      if (res.ok) {
        setCats(prev => prev.filter(c => c.id !== catId));
      } else {
        const data = await res.json();
        setError(data.error || 'Approve failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(catId: string) {
    setProcessing(catId);
    try {
      const res = await fetch('/api/admin/cats/reject', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({ catId })
      });
      
      if (res.ok) {
        setCats(prev => prev.filter(c => c.id !== catId));
      } else {
        const data = await res.json();
        setError(data.error || 'Reject failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setProcessing(null);
    }
  }

  if (showSecretInput) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h1 className="text-2xl font-bold">Admin Access</h1>
          </div>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Enter admin secret"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white mb-4"
          />
          <button
            onClick={loadPending}
            className="w-full py-3 rounded-xl bg-white text-black font-bold"
          >
            Access Admin Panel
          </button>
          <Link href="/" className="block text-center mt-4 text-white/60 hover:text-white">
            ← Back to Arena
          </Link>
        </div>
      </div>
    );
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

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
            {cats.length} Pending
          </span>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/20 text-red-200">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cats.map((cat) => (
            <div key={cat.id} className="glass rounded-2xl overflow-hidden">
              <div className="relative h-48 bg-white/5">
                <Image src={cat.image_url} alt={cat.name} fill className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://placekitten.com/300/300'; }} />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{cat.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10">{cat.rarity}</span>
                </div>
                <p className="text-sm text-white/50 mb-2">{cat.ability}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/40 mb-4">
                  <div>ATK: {cat.stats?.attack}</div>
                  <div>DEF: {cat.stats?.defense}</div>
                  <div>SPD: {cat.stats?.speed}</div>
                  <div>CHA: {cat.stats?.charisma}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(cat.id)}
                    disabled={processing === cat.id}
                    className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(cat.id)}
                    disabled={processing === cat.id}
                    className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/60">No pending cats to moderate!</p>
          </div>
        )}
      </div>
    </div>
  );
}
