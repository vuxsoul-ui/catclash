import { NextResponse } from 'next/server';

export async function requireUsername(
  supabase: any,
  userId: string,
  actionLabel: string
): Promise<{ ok: true; username: string } | { ok: false; response: NextResponse }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // Fail open for profile lookup failures so users are not incorrectly blocked
    // by transient read issues or profile table visibility mismatches.
    console.warn('[requireUsername] profile lookup failed, allowing request:', error.message || error);
    return { ok: true, username: '' };
  }

  const username = String(profile?.username || '').trim();
  if (!username) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: `Set a username before you can ${actionLabel}.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, username };
}
