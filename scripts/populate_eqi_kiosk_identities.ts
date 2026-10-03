import bcrypt from 'bcryptjs';
import { getPrivilegedSupabase } from '../src/server/db.js';
import { syncKioskIdentitiesFromSupabase } from '../src/server/services/credentials.loader.js';

const EQI_ACCOUNTS = [
  {
    estate_id: 'FPM_TUNGGAL',
    operator_id: 'EQI-TGL-01',
    operator_name: 'Pemeriksa Kualiti Gred (EQI Tunggal)',
    app_role: 'eqi',
    kiosk_id: 'kiosk-eqi-tunggal',
    station_name: 'Ramp Penggredan Tunggal',
    staff_no: '999999'
  },
  {
    estate_id: 'FPM_ADELA',
    operator_id: 'EQI-ADL-01',
    operator_name: 'Pemeriksa Kualiti Gred (EQI Adela)',
    app_role: 'eqi',
    kiosk_id: 'kiosk-eqi-adela',
    station_name: 'Ramp Penggredan Adela',
    staff_no: '999999'
  },
  {
    estate_id: 'FPM_KLEDANG',
    operator_id: 'EQI-KLD-01',
    operator_name: 'Pemeriksa Kualiti Gred (EQI Kledang)',
    app_role: 'eqi',
    kiosk_id: 'kiosk-eqi-kledang',
    station_name: 'Ramp Penggredan Kledang',
    staff_no: '999999'
  },
  {
    estate_id: 'FPM_SENING',
    operator_id: 'EQI-SNG-01',
    operator_name: 'Pemeriksa Kualiti Gred (EQI Sening)',
    app_role: 'eqi',
    kiosk_id: 'kiosk-eqi-sening',
    station_name: 'Ramp Penggredan Sening',
    staff_no: '999999'
  },
  {
    estate_id: 'WILAYAH_JB',
    operator_id: 'EQI-WJB-01',
    operator_name: 'Pemeriksa Kualiti Gred (EQI Wilayah JB)',
    app_role: 'eqi',
    kiosk_id: 'kiosk-eqi-wjb',
    station_name: 'Pusat Kawalan Kualiti Wilayah JB',
    staff_no: '999999'
  }
];

async function main() {
  const supabase = getPrivilegedSupabase();
  if (!supabase) {
    console.error('Supabase client not available!');
    process.exit(1);
  }

  console.log(`Starting migration of ${EQI_ACCOUNTS.length} EQI accounts to kiosk_identities...`);

  const saltRounds = 10;
  for (const account of EQI_ACCOUNTS) {
    const staffNoHash = bcrypt.hashSync(account.staff_no.trim(), saltRounds);

    const record = {
      estate_id: account.estate_id,
      operator_id: account.operator_id,
      operator_name: account.operator_name,
      app_role: account.app_role,
      kiosk_id: account.kiosk_id,
      station_name: account.station_name,
      staff_no_hash: staffNoHash,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('kiosk_identities')
      .upsert(record, { onConflict: 'estate_id,operator_id' });

    if (error) {
      console.error(`[ERROR] Failed to upsert ${account.operator_name} (${account.estate_id}):`, error.message);
    } else {
      console.log(`✓ [SUCCESS] ${account.operator_name} (${account.estate_id}) -> Staff No: ${account.staff_no}`);
    }
  }

  const syncedCount = await syncKioskIdentitiesFromSupabase();
  console.log(`Sync completed: ${syncedCount} total kiosk identities currently active in server memory.`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
