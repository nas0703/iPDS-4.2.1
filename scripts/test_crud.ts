import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Credentials missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing connection and querying tables...");
  
  // 1. Test fetching hantaran_hasil
  const hantaran = await supabase.from('hantaran_hasil').select('*').limit(1);
  console.log("hantaran_hasil fetch result err:", hantaran.error ? hantaran.error.message : "None");

  // 2. Test fetching merumput_progress
  const merumput = await supabase.from('merumput_progress').select('*').limit(1);
  console.log("merumput_progress fetch result err:", merumput.error ? merumput.error.message : "None");

  // 3. Test fetching fertilizer_master_schedule
  const master = await supabase.from('fertilizer_master_schedule').select('*').limit(1);
  console.log("fertilizer_master_schedule fetch result err:", master.error ? master.error.message : "None");

  // 4. Test fetching fertilizer_daily_entries
  const entries = await supabase.from('fertilizer_daily_entries').select('*').limit(1);
  console.log("fertilizer_daily_entries fetch result err:", entries.error ? entries.error.message : "None");

  // 5. Try inserting a merumput_progress test record with a JS UUID
  const testId = '11111111-2222-3333-4444-555555555555';
  const { data, error } = await supabase.from('merumput_progress').insert([{
    id: testId,
    blok: 'TEST_BLOK',
    luas: 20.0,
    pusingan: 99,
    jenis: 'TEST_JENIS',
    tarikh_mula: '2026-06-17',
    hek_siap: 0,
    workers_count: 0
  }]).select();

  console.log("merumput_progress insert with UUID result err:", error ? error.message : "None", "Inserted:", !!data);

  // Clean up
  if (!error) {
    const delRes = await supabase.from('merumput_progress').delete().eq('id', testId);
    console.log("Cleanup delete err:", delRes.error ? delRes.error.message : "None");
  }
}

test();
