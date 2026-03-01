import type { SupabaseClient } from '@supabase/supabase-js';

export type GuildId = 'sun' | 'moon';
export const GUILDS: GuildId[] = ['sun', 'moon'];

function daySeed(day: string, guild: GuildId): number {
  let hash = 17;
  const raw = `${day}:${guild}`;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) % 1000003;
  return hash;
}

function fallbackGuild(stats: { attack?: number; defense?: number; speed?: number; charisma?: number; chaos?: number }): GuildId {
  const sunScore = (stats.attack || 0) + (stats.speed || 0);
  const moonScore = (stats.defense || 0) + (stats.charisma || 0) + (stats.chaos || 0);
  return sunScore >= moonScore ? 'sun' : 'moon';
}

export async function computeGuildStandings(supabase: SupabaseClient, guestId?: string | null) {
  const [profilesRes, catsRes] = await Promise.all([
    supabase.from('profiles').select('id, guild').in('guild', GUILDS),
    supabase.from('cats').select('id, user_id, wins, attack, defense, speed, charisma, chaos').eq('status', 'approved'),
  ]);

  const profileGuildMap: Record<string, GuildId> = {};
  for (const p of profilesRes.data || []) {
    if (p.guild === 'sun' || p.guild === 'moon') profileGuildMap[p.id] = p.guild;
  }

  const stats: Record<GuildId, { members: number; cats: number; wins: number; power: number; daily_value: number }> = {
    sun: { members: 0, cats: 0, wins: 0, power: 0, daily_value: 0 },
    moon: { members: 0, cats: 0, wins: 0, power: 0, daily_value: 0 },
  };
  const memberSets: Record<GuildId, Set<string>> = { sun: new Set(), moon: new Set() };

  for (const profile of profilesRes.data || []) {
    if (profile.guild === 'sun' || profile.guild === 'moon') {
      const guild = profile.guild as GuildId;
      memberSets[guild].add(profile.id);
    }
  }

  for (const cat of catsRes.data || []) {
    const guild = profileGuildMap[cat.user_id] || fallbackGuild(cat);
    const totalPower = (cat.attack || 0) + (cat.defense || 0) + (cat.speed || 0) + (cat.charisma || 0) + (cat.chaos || 0);
    stats[guild].cats += 1;
    stats[guild].wins += cat.wins || 0;
    stats[guild].power += totalPower;
    memberSets[guild].add(cat.user_id);
  }

  stats.sun.members = memberSets.sun.size;
  stats.moon.members = memberSets.moon.size;

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const nextRefreshAt = tomorrow.toISOString();

  for (const guild of GUILDS) {
    const base = stats[guild].wins * 3 + stats[guild].members * 5 + Math.round(stats[guild].power / Math.max(1, stats[guild].cats));
    const variance = (daySeed(today, guild) % 26) + 5;
    stats[guild].daily_value = base + variance;
  }

  const standings = GUILDS.map((guild) => ({
    guild,
    members: stats[guild].members,
    cats: stats[guild].cats,
    wins: stats[guild].wins,
    avg_power: Math.round(stats[guild].power / Math.max(1, stats[guild].cats)),
    daily_value: stats[guild].daily_value,
  })).sort((a, b) => b.daily_value - a.daily_value);

  const leaderGuild = (standings[0]?.guild || null) as GuildId | null;
  let pledgedGuild: GuildId | null = null;
  if (guestId) {
    const { data: me } = await supabase.from('profiles').select('guild').eq('id', guestId).maybeSingle();
    if (me?.guild === 'sun' || me?.guild === 'moon') pledgedGuild = me.guild;
  }

  return { day: today, nextRefreshAt, standings, leaderGuild, pledgedGuild };
}

