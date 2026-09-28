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

async function checkMonthlyData() {
  console.log("Checking hantaran_hasil group by month for 2026...");
  const { data, error } = await supabase
    .from('hantaran_hasil')
    .select('id, tarikh, tan, created_at');

  if (error) {
    console.error("Error fetching hantaran_hasil:", error.message);
    return;
  }

  const counts: Record<string, { count: number; totalTan: number }> = {};
  
  for (const row of data || []) {
    if (row.tarikh) {
      const month = row.tarikh.substring(0, 7); // YYYY-MM
      if (!counts[month]) {
        counts[month] = { count: 0, totalTan: 0 };
      }
      counts[month].count++;
      counts[month].totalTan += Number(row.tan || 0);
    }
  }

  console.log("=== MONTHLY STATS FROM DATABASE ===");
  console.log(JSON.stringify(counts, null, 2));
}

checkMonthlyData();
