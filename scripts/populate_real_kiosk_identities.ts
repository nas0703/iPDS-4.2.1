import { getPrivilegedSupabase } from '../src/server/db.js';
import { hashStaffNo, normalizeStaffNo } from '../src/server/services/credentials.loader.js';

interface KioskIdentityInput {
  staff_no: string;
  operator_id: string;
  operator_name: string;
  app_role: string;
  estate_id: string;
  kiosk_id: string;
  station_name: string;
  is_active: boolean;
}

const REAL_STAFF: KioskIdentityInput[] = [
  // FPM TUNGGAL (7 Kakitangan)
  {
    staff_no: '2401199',
    operator_id: 'FC-2401199',
    operator_name: 'MD NASRUDDIN BIN BHSERAN',
    app_role: 'fc', // Super Admin per AGENTS.md §1
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-fc-tunggal',
    station_name: 'Pusat Kawalan Ladang Tunggal',
    is_active: true
  },
  {
    staff_no: '2401859',
    operator_id: 'AFC-TGL-2401859',
    operator_name: 'AZUWAN BIN ALI',
    app_role: 'afc',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-afc-tgl',
    station_name: 'Pejabat Ladang Tunggal',
    is_active: true
  },
  {
    staff_no: '2401723',
    operator_id: 'STF-TGL-2401723',
    operator_name: 'NURULJANNAH BINTI AHMAD',
    app_role: 'staff',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-staff-tgl',
    station_name: 'Stesen Timbang Tunggal',
    is_active: true
  },
  {
    staff_no: '2403532',
    operator_id: 'FS-TGL-2403532',
    operator_name: 'MUHAMMAD KIROMIN BIN ISMADI',
    app_role: 'fs',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-fs-tgl1',
    station_name: 'Stesen Timbang Tunggal',
    is_active: true
  },
  {
    staff_no: '2403468',
    operator_id: 'FS-TGL-2403468',
    operator_name: 'MUHAMMAD ADIB HAZIM BIN HADIRON',
    app_role: 'fs',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-fs-tgl2',
    station_name: 'Pos Kawalan Tunggal',
    is_active: true
  },
  {
    staff_no: '2403644',
    operator_id: 'FS-TGL-2403644',
    operator_name: 'MD SASHRIL BIN TUMIJAN',
    app_role: 'fs',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-fs-tgl3',
    station_name: 'Pos Kawalan Tunggal',
    is_active: true
  },
  {
    staff_no: '2401739',
    operator_id: 'MDR-TGL-2401739',
    operator_name: 'NUR SYAZANA BINTI SALWEY',
    app_role: 'mandur',
    estate_id: 'FPM_TUNGGAL',
    kiosk_id: 'kiosk-mdr-tgl',
    station_name: 'Lapangan Tunggal',
    is_active: true
  },

  // FPM ADELA (5 Kakitangan)
  {
    staff_no: '2402950',
    operator_id: 'MGR-ADL-2402950',
    operator_name: 'Muhammad Taufik Bin Mohd Jamal',
    app_role: 'pf',
    estate_id: 'FPM_ADELA',
    kiosk_id: 'kiosk-mgmt-adela',
    station_name: 'Pejabat Pentadbiran Adela',
    is_active: true
  },
  {
    staff_no: '2402003',
    operator_id: 'AFC-ADL-2402003',
    operator_name: 'Mohammed Harris Fadilah Bin Masseran',
    app_role: 'afc',
    estate_id: 'FPM_ADELA',
    kiosk_id: 'kiosk-afc-adela',
    station_name: 'Pejabat Pentadbiran Adela',
    is_active: true
  },
  {
    staff_no: '2402583',
    operator_id: 'FS-ADL-2402583',
    operator_name: 'Mohammad Hazhari Bin Robani',
    app_role: 'fs',
    estate_id: 'FPM_ADELA',
    kiosk_id: 'kiosk-fs-adela',
    station_name: 'Stesen Timbang Adela',
    is_active: true
  },
  {
    staff_no: '2401543',
    operator_id: 'STF-ADL-2401543',
    operator_name: 'Norashidah Binti Abu Bakar',
    app_role: 'staff',
    estate_id: 'FPM_ADELA',
    kiosk_id: 'kiosk-staff-adela1',
    station_name: 'Kaunter Pentadbiran Adela',
    is_active: true
  },
  {
    staff_no: '2403854',
    operator_id: 'STF-ADL-2403854',
    operator_name: 'Nur Aisyah Binti Mohd Nazib',
    app_role: 'staff',
    estate_id: 'FPM_ADELA',
    kiosk_id: 'kiosk-staff-adela2',
    station_name: 'Kaunter Pentadbiran Adela',
    is_active: true
  }
];

async function run() {
  const supabase = getPrivilegedSupabase();
  if (!supabase) {
    console.error('ERROR: Could not get privileged Supabase client');
    process.exit(1);
  }

  console.log(`Starting migration of ${REAL_STAFF.length} staff to kiosk_identities...`);

  // Clean up temporary test operator if exists
  await supabase.from('kiosk_identities').delete().eq('operator_id', 'OPR-UJI-01');

  let successCount = 0;
  for (const staff of REAL_STAFF) {
    const canonicalStaffNo = normalizeStaffNo(staff.staff_no);
    const staffNoHash = hashStaffNo(canonicalStaffNo);

    const record = {
      operator_id: staff.operator_id,
      staff_no_hash: staffNoHash,
      app_role: staff.app_role,
      estate_id: staff.estate_id,
      kiosk_id: staff.kiosk_id,
      station_name: staff.station_name,
      operator_name: staff.operator_name,
      is_active: staff.is_active,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('kiosk_identities')
      .upsert(record, { onConflict: 'estate_id,operator_id' });

    if (error) {
      console.error(`Failed to upsert ${staff.operator_name} (${staff.staff_no}):`, error.message);
    } else {
      console.log(`✓ [SUCCESS] ${staff.operator_name} (${staff.estate_id}) -> Staff No: ${staff.staff_no}`);
      successCount++;
    }
  }

  console.log(`\nMigration completed: ${successCount}/${REAL_STAFF.length} staff successfully provisioned in Supabase.`);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
