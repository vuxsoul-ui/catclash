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

function timedFetch(timeoutMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`supabase_fetch_timeout_${timeoutMs}`)), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createServerSupabaseClient(timeoutMs = 3500) {
  const { supabaseUrl, serviceKey } = getServerSupabaseConfig();
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: timedFetch(timeoutMs),
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
