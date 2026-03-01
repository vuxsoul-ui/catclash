/**
 * One-time username backfill for legacy default usernames.
 *
 * Run:
 * ARE_YOU_SURE=true node scripts/backfillDefaultUsernames.ts
 */

import { createClient } from '@supabase/supabase-js';
import { backfillDefaultUsernames } from '../app/api/_lib/username-autofill';

async function main() {
  if (String(process.env.ARE_YOU_SURE || '').toLowerCase() !== 'true') {
    console.error('Refusing to run. Set ARE_YOU_SURE=true');
    process.exit(1);
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await backfillDefaultUsernames(sb, 50000);
  console.log('Username backfill complete');
  console.log(`Scanned profiles: ${result.scanned}`);
  console.log(`Updated usernames: ${result.changed}`);
}

main().catch((e) => {
  console.error('Username backfill failed:', e);
  process.exit(1);
});

