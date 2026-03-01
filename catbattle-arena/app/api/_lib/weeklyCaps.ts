export function utcWeekStartIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day; // ISO week starts Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString();
}
