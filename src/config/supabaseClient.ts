/**
 * iPDS v3.8 — Client Architecture: Canonical Browser Supabase Client Export
 * 
 * DESIGN PRINCIPLES:
 * 1. BROWSER ONLY: Consumes public Supabase Anon key; NEVER exposes Service Role key.
 * 2. RE-EXPORT: Consolidates client imports from '../services/supabaseClient' for zero-drift backward compatibility.
 * 3. ZERO v3.5 DISRUPTION: Does not mutate shared schemas or credentials.
 */

export { supabase, updateSupabaseClient, isSupabaseReady } from '../services/supabaseClient';



