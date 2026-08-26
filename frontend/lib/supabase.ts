import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Client Initialization]: Missing Supabase public environment config variables.');
}

/**
 * Returns a typed Supabase client scoped to the authenticated user.
 * Injects Clerk JWT session token into global headers so Row Level Security policies evaluate safely.
 */
export function getSupabaseUserClient(clerkToken?: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is not loaded.');
  }

  const globalHeaders: Record<string, string> = {};
  if (clerkToken) {
    globalHeaders['Authorization'] = `Bearer ${clerkToken}`;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: globalHeaders,
    },
    auth: {
      persistSession: false, // Turn off storage/cookies caching since Clerk maintains sessions
    },
  });
}

/**
 * Returns a trusted Supabase client powered by the service_role key.
 * SERVER-ONLY. Bypasses Row Level Security policies for background syncing (e.g. Clerk webhooks).
 */
export function getSupabaseServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role configurations are missing or not running in a server context.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
}
