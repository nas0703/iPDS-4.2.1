import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

async function testDelete() {
  const { data, error } = await supabase
    .from('fertilizer_inventory_transactions')
    .delete()
    .eq('id', '6bfea464-3bed-4116-a3f4-e57b737a2ff0');
  console.log("Error:", error);
  console.log("Data:", data);
}
testDelete();
