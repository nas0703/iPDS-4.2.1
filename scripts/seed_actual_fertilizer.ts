
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const progressData = [
  { blok_code: "1", entry_date: "2026-04-03", total_beg_completed: 527 },
  { blok_code: "2", entry_date: "2026-04-06", total_beg_completed: 510 },
  { blok_code: "3", entry_date: "2026-04-09", total_beg_completed: 586 },
  { blok_code: "4", entry_date: "2026-04-11", total_beg_completed: 688 },
  { blok_code: "8", entry_date: "2026-03-19", total_beg_completed: 610 },
  { blok_code: "9", entry_date: "2026-03-17", total_beg_completed: 607 },
  { blok_code: "10", entry_date: "2026-03-26", total_beg_completed: 617 },
  { blok_code: "11", entry_date: "2026-03-27", total_beg_completed: 364 },
  { blok_code: "12", entry_date: "2026-04-01", total_beg_completed: 567 },
  { blok_code: "5", entry_date: "2026-04-14", total_beg_completed: 440 },
  { blok_code: "6", entry_date: "2026-04-16", total_beg_completed: 611 },
  { blok_code: "7", entry_date: "2026-04-18", total_beg_completed: 594 },
  { blok_code: "13", entry_date: "2026-04-21", total_beg_completed: 373 },
  { blok_code: "14", entry_date: "2026-04-22", total_beg_completed: 528 },
];

async function seed() {
  console.log("Seeding actual progress data via local API...");
  for (const item of progressData) {
    const payload = {
      ...item,
      pus: 1,
      interval_name: "FEB",
      fertilizer_type: "COMPACT FELDA 12",
      workers_count: 10,
      productivity_beg_per_worker: parseFloat((item.total_beg_completed / 10).toFixed(2)),
      target_beg_for_selected_pus: item.total_beg_completed,
      note: "Auto-seeded from Mandur Izad report"
    };

    try {
      const res = await fetch('http://localhost:3000/api/fertilizer/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        console.log(`Successfully recorded: Blok ${item.blok_code}`);
      } else if (res.status === 409) {
        console.log(`Blok ${item.blok_code} already exists.`);
      } else {
        const err = await res.json();
        console.error(`Error for Blok ${item.blok_code}:`, err.error);
      }
    } catch (err: any) {
      console.error(`Connection failed for Blok ${item.blok_code}:`, err.message);
    }
  }
  console.log("Process completed.");
}

seed();
