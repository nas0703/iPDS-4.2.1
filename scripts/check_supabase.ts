
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function check() {
  const { data, error } = await supabase.from('hantaran_hasil').select('*').eq('peringkat', 'BAJA').limit(10);
  if (error) {
    console.error("hantaran_hasil error:", error.message);
  } else {
    console.log("hantaran_hasil BAJA found:", data.length);
  }

  const { data: b, error: e } = await supabase.from('fertilizer_daily_entries').select('*').limit(1);
  if (e) {
    console.error("fertilizer_daily_entries error:", e.message);
  } else {
    console.log("fertilizer_daily_entries ok");
  }

  const { data: m, error: me } = await supabase.from('fertilizer_master_schedule').select('*').limit(1);
  if (me) {
    console.error("fertilizer_master_schedule error:", me.message);
  } else {
    console.log("fertilizer_master_schedule ok");
  }
}
check();
