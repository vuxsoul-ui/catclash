'use client'

import { useState } from 'react'
import Link from 'next/link'

const mockPending = [
  { id: 1, name: 'New Cat 1', submitted: '2 min ago' },
  { id: 2, name: 'New Cat 2', submitted: '5 min ago' },
]

export default function AdminPage() {
  const [pending, setPending] = useState(mockPending)

  const approve = (id: number) => {
    setPending(pending.filter(p => p.id !== id))
    alert(`Approved cat ${id}!`)
  }

  const reject = (id: number) => {
    setPending(pending.filter(p => p.id !== id))
    alert(`Rejected cat ${id}`)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Queue</h1>
      
      {pending.length === 0 ? (
        <p className="text-slate-400">No pending submissions</p>
      ) : (
        <div className="space-y-4">
          {pending.map((cat) => (
            <div key={cat.id} className="bg-slate-800 p-4 rounded-lg flex items-center gap-4">
              <div className="w-20 h-20 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-500">
                [img]
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{cat.name}</h3>
                <p className="text-sm text-slate-400">Submitted {cat.submitted}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approve(cat.id)}
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject(cat.id)}
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-500"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/" className="block text-center mt-8 text-slate-400">← Back</Link>
    </div>
  )
}
