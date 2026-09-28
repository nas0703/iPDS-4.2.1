import { getSupabase } from './src/server/db.js';

async function main() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("Supabase client could not be initialized");
    process.exit(1);
  }

  const queries = [
    { table: 'hujan_rekod', dateCol: 'tarikh' },
    { table: 'merumput_daily_entries', dateCol: 'tarikh' },
    { table: 'merumput_progress', dateCol: 'tarikh' }
  ];

  for (const q of queries) {
    try {
      const { data, error } = await supabase
        .from(q.table)
        .select(q.dateCol)
        .order(q.dateCol, { ascending: false })
        .limit(10);

      if (error) {
        console.log(`Table ${q.table}: Error - ${error.message}`);
      } else {
        console.log(`\nTable ${q.table} (Top 10 dates sorted alphabetically descending in DB):`);
        console.log(data);
      }
    } catch (e: any) {
      console.log(`Table ${q.table}: Exception - ${e.message}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});


