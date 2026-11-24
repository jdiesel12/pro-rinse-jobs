import { createClient } from '@supabase/supabase-js'

// Publishable key: safe to ship in the client. Row-level security protects the data.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://ldlocovxcrjtbtrzwnfo.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_QClubaMctoAA8xMRL3bglw_jeEu9qUq'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export const BUCKET = 'photos'
