import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client Initialization]: Missing Supabase public environment config variables.');
}

/**
 * Returns a typed Supabase client scoped to the authenticated user.
 * Injects Clerk JWT session token through the supported accessToken mechanism.
 */
export function getSupabaseUserClient(clerkTokenOrFetcher?: string | (() => Promise<string | null>)) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is not loaded.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => {
      if (typeof clerkTokenOrFetcher === 'function') {
        const token = await clerkTokenOrFetcher();
        return token || '';
      }
      return clerkTokenOrFetcher || '';
    },
    auth: {
      persistSession: false, // Clerk maintains sessions
    },
  });
}

/**
 * Returns a trusted Supabase client powered by the service_role key.
 * SERVER-ONLY. Bypasses Row Level Security policies for background syncing (e.g. Clerk webhooks).
 * This client is never imported or bundled into client-side code.
 */
export function getSupabaseServiceClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Security Violation: getSupabaseServiceClient must never be executed on the browser client.');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role configurations are missing or not running in a server context.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
}
