type FairCat = {
  id?: string | null;
  owner_id?: string | null;
  owner_username?: string | null;
};

type FairMatch = {
  match_id?: string | null;
  id?: string | null;
  cat_a?: FairCat | null;
  cat_b?: FairCat | null;
};

function normalizeOwnerKey(cat?: FairCat | null): string | null {
  if (!cat) return null;
  const ownerId = String(cat.owner_id || "").trim();
  if (ownerId) return `id:${ownerId}`;
  const ownerUsername = String(cat.owner_username || "").trim().toLowerCase();
  if (ownerUsername) return `u:${ownerUsername}`;
  return null;
}

function ownerKeys(match: FairMatch): string[] {
  const keys = new Set<string>();
  const a = normalizeOwnerKey(match.cat_a);
  const b = normalizeOwnerKey(match.cat_b);
  if (a) keys.add(a);
  if (b) keys.add(b);
  return Array.from(keys);
}

export function pickFairMatches<T extends FairMatch>(
  matches: T[],
  targetCount: number,
  opts?: { maxPerOwner?: number; avoidSameOwnerMatch?: boolean }
): T[] {
  const desired = Math.max(0, Number(targetCount || 0));
  if (desired === 0 || matches.length === 0) return [];

  const maxPerOwner =
    typeof opts?.maxPerOwner === "number" && opts.maxPerOwner > 0
      ? Math.floor(opts.maxPerOwner)
      : Number.POSITIVE_INFINITY;
  const avoidSameOwnerMatch = opts?.avoidSameOwnerMatch ?? true;

  const picked: T[] = [];
  const pickedIds = new Set<string>();
  const seenOwners = new Set<string>();
  const ownerCount = new Map<string, number>();
  const unique = matches.filter((m) => {
    const id = String(m.match_id || m.id || "").trim();
    if (!id) return true;
    if (pickedIds.has(id)) return false;
    pickedIds.add(id);
    return true;
  });
  pickedIds.clear();

  const wouldExceedOwnerCap = (owners: string[]) => {
    if (!Number.isFinite(maxPerOwner)) return false;
    for (const k of owners) {
      const next = (ownerCount.get(k) || 0) + 1;
      if (next > maxPerOwner) return true;
    }
    return false;
  };

  const sameOwnerMatch = (m: FairMatch) => {
    const a = normalizeOwnerKey(m.cat_a);
    const b = normalizeOwnerKey(m.cat_b);
    return Boolean(a && b && a === b);
  };

  const accept = (m: T) => {
    const id = String(m.match_id || m.id || "").trim();
    if (id && pickedIds.has(id)) return false;
    if (avoidSameOwnerMatch && sameOwnerMatch(m)) return false;
    const owners = ownerKeys(m);
    if (wouldExceedOwnerCap(owners)) return false;
    picked.push(m);
    if (id) pickedIds.add(id);
    for (const key of owners) {
      seenOwners.add(key);
      ownerCount.set(key, (ownerCount.get(key) || 0) + 1);
    }
    return true;
  };

  const select = (minFreshOwners: number) => {
    for (const m of unique) {
      if (picked.length >= desired) return;
      const owners = ownerKeys(m);
      const freshOwners = owners.filter((k) => !seenOwners.has(k)).length;
      if (freshOwners < minFreshOwners) continue;
      accept(m);
    }
  };

  // Passes prioritize owner diversity before falling back to remaining candidates.
  select(2);
  select(1);
  select(0);

  if (picked.length < desired) {
    for (const m of unique) {
      if (picked.length >= desired) break;
      accept(m);
    }
  }

  if (picked.length === 0 && matches.length > 0 && !avoidSameOwnerMatch) {
    return unique.slice(0, desired);
  }
  return picked.slice(0, desired);
}
