import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://malstqryqfodnqlvrgmn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bW1KPwLhliEqNpQXQtlA6w_pOj7RvQ2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
