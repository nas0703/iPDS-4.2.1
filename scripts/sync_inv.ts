import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
);

async function sync() {
  const { data: invs } = await supabase.from('fertilizer_inventory').select('*');
  const { data: trans } = await supabase.from('fertilizer_inventory_transactions').select('*');

  if (!invs || !trans) return;

  for (const inv of invs) {
    const invTrans = trans.filter((t: any) => t.inventory_id === inv.id);
    let total = 0;
    if (inv.name === 'FELDA ORGANIC') {
      for (const t of invTrans) {
        if (t.type === 'IN') total += t.quantity;
        if (t.type === 'OUT') total -= t.quantity;
      }
      console.log(`Setting FELDA ORGANIC to ${total}`);
      await supabase.from('fertilizer_inventory').update({ quantity: total }).eq('id', inv.id);
    }
  }
}
sync();
