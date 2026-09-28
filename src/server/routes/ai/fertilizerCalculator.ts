/**
 * Calculates dynamic fertilizer (pembajaan) progress from Supabase tables
 * fertilizer_daily_entries & fertilizer_master_schedule or client payload.
 */

export interface FertilizerStatusEntry {
  pusingan?: string | number;
  pusingan_no?: string | number;
  bilangan_beg?: string | number;
  bil_beg?: string | number;
  beg_ditabur?: string | number;
  jumlah_beg?: string | number;
  [key: string]: unknown;
}

export interface FertilizerStatusMaster {
  pusingan_1_target?: string | number;
  target_p1?: string | number;
  pusingan_2_target?: string | number;
  target_p2?: string | number;
  pusingan_3_target?: string | number;
  target_p3?: string | number;
  pusingan_4_target?: string | number;
  target_p4?: string | number;
  [key: string]: unknown;
}

export async function getCalculatedFertilizerStatus(
  supabase: unknown,
  clientEntries?: FertilizerStatusEntry[],
  clientMaster?: FertilizerStatusMaster[]
) {
  let masterData: FertilizerStatusMaster[] = [];
  let entriesData: FertilizerStatusEntry[] = [];

  if (Array.isArray(clientEntries) && clientEntries.length > 0) {
    entriesData = clientEntries;
  }
  if (Array.isArray(clientMaster) && clientMaster.length > 0) {
    masterData = clientMaster;
  }

  if (supabase && typeof supabase === 'object' && 'from' in (supabase as Record<string, unknown>)) {
    try {
      const client = supabase as { from: (table: string) => { select: (cols: string) => Promise<{ data: unknown[] | null }> } };
      if (entriesData.length === 0) {
        const { data: eData } = await client.from('fertilizer_daily_entries').select('*');
        if (eData && Array.isArray(eData)) entriesData = eData as FertilizerStatusEntry[];
      }
      if (masterData.length === 0) {
        const { data: mData } = await client.from('fertilizer_master_schedule').select('*');
        if (mData && Array.isArray(mData)) masterData = mData as FertilizerStatusMaster[];
      }
    } catch (e) {
      console.warn('Fertilizer fetch error in AI route:', e);
    }
  }

  // Baseline target bags per PUS (from 2026 fertilizer program master: P1: 12503, P2: 9009, P3: 9009, P4: 9812)
  let targetP1 = 12503;
  let targetP2 = 9009;
  let targetP3 = 9009;
  let targetP4 = 9812;

  if (masterData && masterData.length > 0) {
    const p1Sum = masterData.reduce((acc, r) => acc + (parseFloat(String(r.pusingan_1_target || r.target_p1 || '0')) || 0), 0);
    const p2Sum = masterData.reduce((acc, r) => acc + (parseFloat(String(r.pusingan_2_target || r.target_p2 || '0')) || 0), 0);
    const p3Sum = masterData.reduce((acc, r) => acc + (parseFloat(String(r.pusingan_3_target || r.target_p3 || '0')) || 0), 0);
    const p4Sum = masterData.reduce((acc, r) => acc + (parseFloat(String(r.pusingan_4_target || r.target_p4 || '0')) || 0), 0);
    if (p1Sum > 0) targetP1 = p1Sum;
    if (p2Sum > 0) targetP2 = p2Sum;
    if (p3Sum > 0) targetP3 = p3Sum;
    if (p4Sum > 0) targetP4 = p4Sum;
  }

  let actualP1 = 0;
  let actualP2 = 0;
  let actualP3 = 0;
  let actualP4 = 0;

  if (entriesData && entriesData.length > 0) {
    entriesData.forEach(entry => {
      const p = String(entry.pusingan || entry.pusingan_no || '').trim();
      const bags = parseFloat(String(entry.bilangan_beg || entry.bil_beg || entry.beg_ditabur || entry.jumlah_beg || '0')) || 0;
      if (p === '1' || p.includes('P1') || p.includes('Pusingan 1')) actualP1 += bags;
      else if (p === '2' || p.includes('P2') || p.includes('Pusingan 2')) actualP2 += bags;
      else if (p === '3' || p.includes('P3') || p.includes('Pusingan 3')) actualP3 += bags;
      else if (p === '4' || p.includes('P4') || p.includes('Pusingan 4')) actualP4 += bags;
    });
  }

  let pct1 = targetP1 > 0 ? (actualP1 / targetP1) * 100 : 0;
  let pct2 = targetP2 > 0 ? (actualP2 / targetP2) * 100 : 0;
  let pct3 = targetP3 > 0 ? (actualP3 / targetP3) * 100 : 0;
  let pct4 = targetP4 > 0 ? (actualP4 / targetP4) * 100 : 0;

  const p1PctStr = `${Math.min(100, Math.round(pct1 * 10) / 10)}%`;
  const p2PctStr = `${Math.min(100, Math.round(pct2 * 10) / 10)}%`;
  const p3PctStr = `${Math.min(100, Math.round(pct3 * 10) / 10)}%`;
  const p4PctStr = `${Math.min(100, Math.round(pct4 * 10) / 10)}%`;

  const getStatusLabel = (pct: number) => {
    if (pct >= 100) return 'Selesai';
    if (pct > 0) return 'Sedang Berjalan';
    return 'Belum Mula';
  };

  const p1Full = `${p1PctStr} (${getStatusLabel(pct1)})`;
  const p2Full = `${p2PctStr} (${getStatusLabel(pct2)})`;
  const p3Full = `${p3PctStr} (${getStatusLabel(pct3)})`;
  const p4Full = `${p4PctStr} (${getStatusLabel(pct4)})`;

  const statusMsg = `Pusingan 1: ${p1Full}, Pusingan 2: ${p2Full}, Pusingan 3: ${p3Full}, Pusingan 4: ${p4Full}. Total disiapkan: P1 (${actualP1}/${targetP1} beg), P2 (${actualP2}/${targetP2} beg), P3 (${actualP3}/${targetP3} beg), P4 (${actualP4}/${targetP4} beg).`;

  return {
    pusingan1: p1Full,
    pusingan2: p2Full,
    pusingan3: p3Full,
    pusingan4: p4Full,
    p1PctStr,
    p2PctStr,
    p3PctStr,
    p4PctStr,
    actualP1, actualP2, actualP3, actualP4,
    targetP1, targetP2, targetP3, targetP4,
    status: statusMsg
  };
}

