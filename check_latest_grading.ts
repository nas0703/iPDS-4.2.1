import { getSupabase } from './src/server/db.js';

async function main() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("Supabase client could not be initialized");
    process.exit(1);
  }

  // Fetch count
  const { count, error } = await supabase
    .from('penggredan_rekod')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error("Error fetching count:", error);
    process.exit(1);
  }

  console.log(`Current total record count in penggredan_rekod: ${count}`);

  // Fetch latest record by created_at
  const { data: latest, error: latError } = await supabase
    .from('penggredan_rekod')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (latError) {
    console.error("Error fetching latest record:", latError);
  } else {
    console.log("Absolute latest record in penggredan_rekod:");
    console.log(JSON.stringify(latest, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});


