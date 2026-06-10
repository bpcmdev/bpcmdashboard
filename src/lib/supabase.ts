import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://malstqryqfodnqlvrgmn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bW1KPwLhliEqNpQXQtlA6w_pOj7RvQ2';

// Persist the auth session so authenticated RPC calls (e.g. ct_overservice_*_secure)
// pick up the logged-in user's JWT instead of falling back to the anon role.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
