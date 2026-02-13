import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Submission } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client for client-side operations
export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseKey)

// Server client for server-side operations
export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Submission operations
export async function createSubmission(data: {
  image_url: string
  cat_name: string
  owner_ig?: string
}) {
  const { data: submission, error } = await supabaseBrowser
    .from('submissions')
    .insert([{ ...data, status: 'pending' }])
    .select()
    .single()

  if (error) throw error
  return submission as Submission
}

export async function getPendingSubmissions() {
  const { data, error } = await supabaseBrowser
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Submission[]
}

export async function getApprovedSubmissions(rarity?: string) {
  let query = supabaseBrowser
    .from('submissions')
    .select('*')
    .eq('status', 'approved')

  if (rarity && rarity !== 'all') {
    query = query.eq('rarity', rarity)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data as Submission[]
}

export async function approveSubmission(
  id: string,
  stats: {
    attack: number
    defense: number
    speed: number
    ability: string
    rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary'
  }
) {
  const { data, error } = await supabaseBrowser
    .from('submissions')
    .update({
      status: 'approved',
      ...stats,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Submission
}

export async function rejectSubmission(id: string) {
  const { error } = await supabaseBrowser
    .from('submissions')
    .update({ status: 'rejected' })
    .eq('id', id)

  if (error) throw error
}

// Vote operations
export async function voteForCat(catId: string, voterIp: string) {
  const { error } = await supabaseBrowser.from('votes').insert([
    {
      cat_id: catId,
      voter_ip: voterIp,
    },
  ])

  if (error) throw error

  // Increment vote count
  await supabaseBrowser.rpc('increment_vote_count', { cat_uuid: catId })
}

export async function hasVoted(catId: string, voterIp: string) {
  const { data, error } = await supabaseBrowser
    .from('votes')
    .select('*')
    .eq('cat_id', catId)
    .eq('voter_ip', voterIp)
    .maybeSingle()

  if (error) throw error
  return !!data
}

// Battle operations
export async function getRandomCatsForBattle() {
  const { data, error } = await supabaseBrowser
    .from('submissions')
    .select('*')
    .eq('status', 'approved')

  if (error) throw error
  
  if (!data || data.length < 2) return null

  // Shuffle and pick 2
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 2) as Submission[]
}

export async function recordBattle(
  catAId: string,
  catBId: string,
  winnerId: string
) {
  const { error } = await supabaseBrowser.from('battles').insert([
    {
      cat_a_id: catAId,
      cat_b_id: catBId,
      winner_id: winnerId,
    },
  ])

  if (error) throw error
}

// Leaderboard operations
export async function getTopCatsAllTime(limit = 10) {
  const { data, error } = await supabaseBrowser
    .from('submissions')
    .select('*')
    .eq('status', 'approved')
    .order('vote_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as Submission[]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getTopCatsThisWeek(limit = 10) {
  // TODO: Fix group query - Supabase JS client doesn't support .group()
  // For now return empty array
  return [] as Submission[]
}

// Storage operations
export async function uploadCatImage(file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { error: uploadError } = await supabaseBrowser.storage
    .from('cat-images')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabaseBrowser.storage
    .from('cat-images')
    .getPublicUrl(fileName)

  return publicUrl
}

// NSFW detection (using moderatecontent.com free API)
export async function checkNSFW(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.moderatecontent.com/moderate/?url=${encodeURIComponent(imageUrl)}`
    )
    const data = await response.json()
    return data.rating_label === 'adult'
  } catch (error) {
    console.error('NSFW check failed:', error)
    return false
  }
}

// Get cats for battle arena
export async function getBattleCats(limit = 10) {
  const { data, error } = await supabaseBrowser
    .from('submissions')
    .select('*')
    .eq('status', 'approved')
    .order('votes', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as Submission[]
}
