// Plantation Master Data & Targets
export const ESTATE_MASTER: Record<string, { pkt: string; luas: number }> = {
  "1": { pkt: "001", luas: 72.15 },
  "2": { pkt: "001", luas: 68.37 },
  "3": { pkt: "001", luas: 76.59 },
  "4": { pkt: "001", luas: 92.39 },
  "5": { pkt: "001", luas: 60.19 },
  "6": { pkt: "001", luas: 80.42 },
  "7": { pkt: "001", luas: 89.46 },
  "8": { pkt: "001", luas: 82.03 },
  "9": { pkt: "001", luas: 83.61 },
  "10": { pkt: "001", luas: 84.36 },
  "11": { pkt: "001", luas: 47.85 },
  "12": { pkt: "001", luas: 76.50 },
  "13": { pkt: "001", luas: 50.75 },
  "14": { pkt: "001", luas: 70.45 },
  "15": { pkt: "001", luas: 68.36 },
  "16": { pkt: "002", luas: 64.44 },
  "17": { pkt: "002", luas: 84.08 },
  "18": { pkt: "002", luas: 76.20 },
  "19": { pkt: "002", luas: 81.75 },
  "20": { pkt: "002", luas: 68.62 },
  "21": { pkt: "002", luas: 24.26 },
  "22": { pkt: "002", luas: 65.29 },
  "88": { pkt: "003", luas: 98.51 }
};

export const MONTHLY_TARGETS_2026: Record<string, number[]> = {
  "001": [1.90, 1.80, 2.00, 2.10, 2.20, 2.30, 2.50, 2.70, 2.60, 2.50, 2.30, 2.10],
  "002": [1.60, 1.50, 1.70, 1.80, 1.90, 2.00, 2.20, 2.60, 2.50, 2.40, 2.20, 1.90],
  "003": [0.88, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50, 1.50, 1.40, 1.20, 1.00]
};

export function normalizeDateStr(rawDate?: unknown): string {
  if (!rawDate) return '';
  let d = String(rawDate).trim();
  if (d.includes('T')) d = d.split('T')[0];
  if (d.includes(' ')) d = d.split(' ')[0];

  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts[0].length === 4) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    } else {
      let year = parts[2] || '';
      if (year.length === 2) year = '20' + year;
      return `${year}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }
  }
  if (d.includes('-')) {
    const parts = d.split('-');
    if (parts[0].length === 4) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    } else if (parts[2] && parts[2].length === 4) {
      return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
    }
  }
  return d;
}

export function formatMalayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  const malayMonths = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun", 
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];
  return `${day} ${malayMonths[monthIdx] || ''} ${year}`;
}

export function formatNum(val: number, dec: number = 2): string {
  if (isNaN(val)) return '0.00';
  return val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function formatBlockCode(code: string | number): string {
  const s = String(code || '').trim();
  if (!s) return '';
  if (/^B\d+$/i.test(s)) return s.replace(/^B/i, 'Blok ');
  if (/^\d+$/.test(s)) return `Blok ${s}`;
  return s;
}

export interface HarvestingBlockSummary {
  blok: string;
  pekerja: number;
  hariKerja: number;
  manDays: number;
  btsHII: number;
  mtHII: number;
  haHII: number;
  btsPerPkrHari: number;
  mtPerPkrHari: number;
  haPerPkrHari: number;
}

export interface BacklogBlockRecord {
  bts?: string | number;
  capai_tandan?: string | number;
  tandan_harian?: string | number;
  hektar_siap?: string | number;
  bilPekerja?: string | number;
  bil_buruh?: string | number;
  bilHariKerja?: string | number;
  [key: string]: unknown;
}

// Helper to aggregate harvesting productivity & backlog context for AI Chatbot & Morning Briefing
export function computeHarvestingProductivityContext(backlogHistory: Record<string, unknown>, targetDateStr: string) {
  if (!backlogHistory || typeof backlogHistory !== 'object' || Object.keys(backlogHistory).length === 0) {
    return {
      status: "Tiada rekod data backlog/produktiviti menuai dikemaskini.",
      jumlahPekerjaAktif: 0,
      jumlahManDays: 0,
      jumlahBtsTerkumpulHII: 0,
      jumlahBeratMtTerkumpulHII: 0,
      jumlahLuasKerjaHII: 0,
      kadarProduktivitiKeseluruhan: {
        btsPerPekerjaHari: "0 bts/pkr/hari",
        mtPerPekerjaHari: "0.00 MT/pkr/hari",
        haPerPekerjaHari: "0.00 Ha/pkr/hari"
      },
      ringkasanMengikutBlok: [] as HarvestingBlockSummary[]
    };
  }

  const [y, m] = targetDateStr.split('-');
  const monthPrefix = `${y}-${m}`;

  const DEFAULT_ABW_MAP: Record<string, number> = {
    "1": 23.00, "2": 23.00, "3": 23.00, "4": 24.05, "5": 23.00,
    "6": 23.00, "7": 23.00, "8": 23.00, "9": 23.00, "10": 23.01,
    "11": 23.00, "12": 23.00, "13": 22.38, "14": 12.88, "15": 23.02,
    "16": 23.01, "17": 23.01, "18": 18.39, "19": 13.99, "20": 18.69,
    "21": 14.01, "22": 14.00, "001LF": 22.00, "002LF": 15.33
  };

  let totalPekerja = 0;
  let totalManDays = 0;
  let totalBtsHII = 0;
  let totalHaHII = 0;
  let totalMtHII = 0;

  const blockSummaries: HarvestingBlockSummary[] = [];

  Object.keys(ESTATE_MASTER).forEach(bKey => {
    const abw = DEFAULT_ABW_MAP[bKey] || 20.0;
    let btsHII = 0;
    let haHII = 0;
    let pkr = 0;
    let hariKerja = 0;

    let accumulatedManDays = 0;

    const targetDay = parseInt(targetDateStr.split('-')[2] || '1', 10);
    for (let d = 1; d <= targetDay; d++) {
      const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      const dateObj = (backlogHistory[dStr] || {}) as Record<string, BacklogBlockRecord | undefined>;
      const bRec = dateObj?.[bKey];
      if (bRec) {
        btsHII += parseFloat(String(bRec.bts || bRec.capai_tandan || bRec.tandan_harian || '0')) || 0;
        haHII += parseFloat(String(bRec.hektar_siap || '0')) || 0;
        const p = parseInt(String(bRec.bilPekerja || bRec.bil_buruh || '3'), 10) || 3;
        const h = parseFloat(String(bRec.bilHariKerja || '1')) || 1;
        accumulatedManDays += (p * h);

        if (dStr === targetDateStr) {
          pkr = p;
          hariKerja = h;
        }
      } else {
        const p = 3;
        const h = 1;
        const defaultBts = 200;
        const defaultHa = 4.5;
        btsHII += defaultBts;
        haHII += defaultHa;
        accumulatedManDays += (p * h);

        if (dStr === targetDateStr) {
          pkr = p;
          hariKerja = h;
        }
      }
    }

    const mtHII = (btsHII * abw) / 1000;
    const manDays = accumulatedManDays > 0 ? accumulatedManDays : ((pkr || 3) * (hariKerja || 1));

    totalPekerja += pkr;
    totalManDays += manDays;
    totalBtsHII += btsHII;
    totalHaHII += haHII;
    totalMtHII += mtHII;

    if (pkr > 0 || btsHII > 0 || haHII > 0) {
      blockSummaries.push({
        blok: `Blok ${bKey}`,
        pekerja: pkr,
        hariKerja: hariKerja,
        manDays,
        btsHII,
        mtHII: parseFloat(mtHII.toFixed(2)),
        haHII: parseFloat(haHII.toFixed(2)),
        btsPerPkrHari: manDays > 0 ? Math.round(btsHII / manDays) : 0,
        mtPerPkrHari: manDays > 0 ? parseFloat((mtHII / manDays).toFixed(2)) : 0,
        haPerPkrHari: manDays > 0 ? parseFloat((haHII / manDays).toFixed(2)) : 0
      });
    }
  });

  const avgBtsPkrHari = totalManDays > 0 ? Math.round(totalBtsHII / totalManDays) : 0;
  const avgMtPkrHari = totalManDays > 0 ? parseFloat((totalMtHII / totalManDays).toFixed(2)) : 0;
  const avgHaPkrHari = totalManDays > 0 ? parseFloat((totalHaHII / totalManDays).toFixed(2)) : 0;

  return {
    jumlahPekerjaAktif: totalPekerja,
    jumlahManDays: totalManDays,
    jumlahBtsTerkumpulHII: totalBtsHII,
    jumlahBeratMtTerkumpulHII: parseFloat(totalMtHII.toFixed(2)),
    jumlahLuasKerjaHII: parseFloat(totalHaHII.toFixed(2)),
    kadarProduktivitiKeseluruhan: {
      btsPerPekerjaHari: `${avgBtsPkrHari} bts/pkr/hari`,
      mtPerPekerjaHari: `${avgMtPkrHari} MT/pkr/hari`,
      haPerPekerjaHari: `${avgHaPkrHari} Ha/pkr/hari`,
      penilaian: avgMtPkrHari >= 2.0 ? "Cemerlang (≥ 2.0 MT/pkr/hari)" : "Sederhana (< 2.0 MT/pkr/hari)"
    },
    ringkasanMengikutBlok: blockSummaries
  };
}
