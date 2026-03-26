import { createClient } from '@supabase/supabase-js';

let didLogConfig = false;

function cleanEnv(value: string | undefined): string {
  return String(value || '').replace(/\n/g, '').trim();
}

export function getServerSupabaseConfig() {
  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!didLogConfig) {
    didLogConfig = true;
    console.error('[SUPABASE CHECK]', {
      url: supabaseUrl,
      key_prefix: serviceKey ? serviceKey.slice(0, 10) : null,
    });
  }

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return { supabaseUrl, serviceKey };
}

export function createServerSupabaseClient() {
  const { supabaseUrl, serviceKey } = getServerSupabaseConfig();
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function logInvalidSupabaseKey(error: unknown) {
  const message = String((error as any)?.message || error || '');
  if (message.toLowerCase().includes('invalid api key')) {
    const { supabaseUrl, serviceKey } = getServerSupabaseConfig();
    console.error('[CRITICAL] INVALID SUPABASE KEY', {
      url: supabaseUrl,
      key_prefix: serviceKey.slice(0, 10),
    });
  }
}
