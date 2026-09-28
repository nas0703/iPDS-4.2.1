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
  const yields = await supabase.from('block_annual_yields').select('*').limit(5);
  console.log("block_annual_yields result:", yields.error ? yields.error.message : "Success (" + yields.data?.length + " records)");

  const annual = await supabase.from('annual_yield').select('*').limit(5);
  console.log("annual_yield result:", annual.error ? annual.error.message : "Success (" + annual.data?.length + " records)");
}

test();
