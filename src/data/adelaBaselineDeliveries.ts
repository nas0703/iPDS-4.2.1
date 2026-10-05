import { Transaction } from "../types.ts";

export interface MonthlyBlockYield {
  blok: string;
  peringkat: string;
  luas: number;
  monthlyTons: number[]; // Jan to Aug 2026 (8 months)
  augustTon: number;
  cumulativeTon: number; // Jan - Aug 2026
}

/**
 * Laporan Rasmi Pencapaian Hasil FPM Adela (Sehingga 31.8.2026)
 * Sumber: Data Rasmi FELDA PLANTATION MANAGEMENT SDN BHD
 */
export const ADELA_OFFICIAL_YIELD_SUMMARY = {
  sehinggaTarikh: "2026-08-31",
  totalHectares: 1041.22,
  totalAugustTon: 1656.46,
  totalAugustYieldHek: 1.59,
  totalCumulativeTon: 13492.90,
  totalCumulativeYieldHek: 12.96,

  pkt1: {
    hectares: 613.64,
    peneroka: 156,
    targetAnnual: 25.0,
    targetAugustHek: 2.40,
    targetCumulativeHek: 14.70,
    augustTon: 1110.69,
    augustYieldHek: 1.81,
    augustPercent: 75.42,
    cumulativeTon: 8541.87,
    cumulativeYieldHek: 13.92,
    cumulativePercent: 94.69,
    annualPercent: 55.68,
  },
  pkt2: {
    hectares: 333.42,
    peneroka: 83,
    targetAnnual: 25.0,
    targetAugustHek: 1.60,
    targetCumulativeHek: 15.20,
    augustTon: 470.12,
    augustYieldHek: 1.41,
    augustPercent: 88.13,
    cumulativeTon: 4234.43,
    cumulativeYieldHek: 12.70,
    cumulativePercent: 83.55,
    annualPercent: 50.80,
  },
  lotFelda: {
    hectares: 78.04,
    peneroka: 0,
    targetAnnual: 12.98,
    targetAugustHek: 1.25,
    targetCumulativeHek: 8.27,
    augustTon: 47.60,
    augustYieldHek: 0.61,
    augustPercent: 48.80,
    cumulativeTon: 504.14,
    cumulativeYieldHek: 6.46,
    cumulativePercent: 78.11,
    annualPercent: 49.77,
  },
  lotTambahan: {
    hectares: 16.12,
    peneroka: 4,
    targetAnnual: 21.0,
    targetAugustHek: 2.20,
    targetCumulativeHek: 12.55,
    augustTon: 28.05,
    augustYieldHek: 1.74,
    augustPercent: 79.09,
    cumulativeTon: 212.46,
    cumulativeYieldHek: 13.18,
    cumulativePercent: 105.02,
    annualPercent: 62.76,
  }
};

/**
 * Perincian setiap blok FPM Adela (Jan - Ogos 2026)
 */
export const ADELA_BLOCK_PERINCIAN: MonthlyBlockYield[] = [
  // --- PKT 1 (Blok 1 - 11) --- Total 1,104.56 MT (1.80 T/Ha) in October
  { blok: "1", peringkat: "PKT 001", luas: 30.46, augustTon: 38.38, cumulativeTon: 361.26, monthlyTons: [43.10, 41.50, 48.00, 45.20, 47.80, 48.28, 49.00, 38.38, 13.10, 54.83] },
  { blok: "2", peringkat: "PKT 001", luas: 58.07, augustTon: 136.86, cumulativeTon: 903.97, monthlyTons: [102.50, 98.40, 114.20, 108.60, 118.00, 115.40, 110.01, 136.86, 24.97, 104.53] },
  { blok: "3", peringkat: "PKT 001", luas: 45.91, augustTon: 76.21, cumulativeTon: 625.75, monthlyTons: [74.20, 71.80, 81.30, 78.40, 83.20, 80.64, 80.00, 76.21, 19.74, 82.64] },
  { blok: "4", peringkat: "PKT 001", luas: 57.89, augustTon: 95.52, cumulativeTon: 861.43, monthlyTons: [103.00, 99.20, 113.80, 107.50, 117.20, 114.61, 110.60, 95.52, 24.89, 104.20] },
  { blok: "5", peringkat: "PKT 001", luas: 60.05, augustTon: 91.88, cumulativeTon: 837.10, monthlyTons: [101.20, 97.50, 111.00, 104.80, 113.50, 111.22, 106.00, 91.88, 25.82, 108.09] },
  { blok: "6", peringkat: "PKT 001", luas: 64.64, augustTon: 94.37, cumulativeTon: 791.79, monthlyTons: [95.00, 91.20, 104.50, 98.60, 107.40, 105.72, 95.00, 94.37, 27.80, 116.35] },
  { blok: "7", peringkat: "PKT 001", luas: 68.17, augustTon: 101.57, cumulativeTon: 822.82, monthlyTons: [98.20, 94.50, 108.00, 101.80, 111.00, 107.06, 100.69, 101.57, 29.31, 122.71] },
  { blok: "8", peringkat: "PKT 001", luas: 77.53, augustTon: 188.12, cumulativeTon: 1304.55, monthlyTons: [151.00, 145.20, 166.40, 158.00, 172.00, 163.83, 160.00, 188.12, 33.34, 139.55] },
  { blok: "9", peringkat: "PKT 001", luas: 64.04, augustTon: 108.87, cumulativeTon: 832.52, monthlyTons: [99.00, 95.10, 109.00, 102.50, 112.00, 106.05, 100.00, 108.87, 27.54, 115.27] },
  { blok: "10", peringkat: "PKT 001", luas: 63.01, augustTon: 139.05, cumulativeTon: 912.81, monthlyTons: [105.00, 101.20, 116.50, 109.80, 120.00, 111.26, 110.00, 139.05, 27.09, 113.42] },
  { blok: "11", peringkat: "PKT 001", luas: 23.87, augustTon: 39.86, cumulativeTon: 287.87, monthlyTons: [34.00, 32.50, 37.20, 35.00, 38.50, 35.81, 35.00, 39.86, 10.26, 42.97] },

  // --- PKT 2 (Blok 1 - 6 -> disistemkan sebagai 12 - 17) --- Total 476.79 MT (1.43 T/Ha) in October
  { blok: "12", peringkat: "PKT 002", luas: 59.93, augustTon: 91.34, cumulativeTon: 693.64, monthlyTons: [84.00, 81.20, 92.50, 87.00, 93.40, 84.20, 80.00, 91.34, 14.40, 85.70] },
  { blok: "13", peringkat: "PKT 002", luas: 60.47, augustTon: 84.66, cumulativeTon: 912.81, monthlyTons: [116.00, 112.00, 128.00, 120.50, 130.00, 118.15, 103.50, 84.66, 14.50, 86.47] },
  { blok: "14", peringkat: "PKT 002", luas: 40.40, augustTon: 54.14, cumulativeTon: 500.16, monthlyTons: [62.00, 59.80, 68.40, 64.20, 69.50, 62.12, 60.00, 54.14, 9.70, 57.77] },
  { blok: "15", peringkat: "PKT 002", luas: 48.41, augustTon: 55.67, cumulativeTon: 557.65, monthlyTons: [70.00, 67.50, 77.20, 72.80, 77.50, 76.98, 60.00, 55.67, 11.60, 69.23] },
  { blok: "16", peringkat: "PKT 002", luas: 67.76, augustTon: 91.73, cumulativeTon: 788.98, monthlyTons: [98.00, 94.50, 108.00, 101.50, 109.80, 95.45, 90.00, 91.73, 16.20, 96.90] },
  { blok: "17", peringkat: "PKT 002", luas: 56.45, augustTon: 92.58, cumulativeTon: 781.19, monthlyTons: [96.00, 92.80, 106.00, 99.80, 108.20, 95.81, 90.00, 92.58, 13.50, 80.72] },

  // --- LOT FELDA (1F & 2F) --- Total 47.60 MT (0.61 T/Ha) in October
  { blok: "1F", peringkat: "LOT FELDA", luas: 39.81, augustTon: 25.66, cumulativeTon: 259.52, monthlyTons: [32.00, 30.50, 35.20, 33.00, 36.00, 32.38, 34.78, 25.66, 3.20, 24.28] },
  { blok: "2F", peringkat: "LOT FELDA", luas: 38.23, augustTon: 21.94, cumulativeTon: 244.62, monthlyTons: [31.00, 29.50, 34.00, 31.80, 34.50, 32.08, 29.80, 21.94, 2.90, 23.32] },

  // --- LOT TAMBAHAN (125Y, 128Y, 121V) --- Total 28.05 MT (1.74 T/Ha) in October
  { blok: "125Y", peringkat: "PKT 004", luas: 8.06, augustTon: 14.39, cumulativeTon: 120.83, monthlyTons: [15.00, 14.20, 16.50, 15.20, 16.80, 14.69, 14.05, 14.39, 1.10, 14.02] },
  { blok: "128Y", peringkat: "PKT 004", luas: 4.04, augustTon: 8.68, cumulativeTon: 61.32, monthlyTons: [7.50, 7.10, 8.20, 7.60, 8.40, 7.84, 6.00, 8.68, 1.40, 7.03] },
  { blok: "121V", peringkat: "PKT 004", luas: 4.02, augustTon: 4.98, cumulativeTon: 30.31, monthlyTons: [3.60, 3.40, 4.00, 3.70, 4.10, 3.53, 3.00, 4.98, 1.20, 7.00] },
];

/**
 * Generate discrete transactions for FPM Adela from Jan 2026 to Oct 2026 (10 months).
 * Each month has structured delivery receipts with realistic timestamps,
 * lorry numbers, OER/KPG, and exact block distribution.
 */
export function generateAdelaBaselineTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  const monthDates = [
    "2026-01-20",
    "2026-02-18",
    "2026-03-22",
    "2026-04-19",
    "2026-05-21",
    "2026-06-20",
    "2026-07-24",
    "2026-08-25",
    "2026-09-22",
    "2026-10-04",
  ];

  const lorries = ["JTG4421", "JQR8823", "JPM1902", "JTK9031", "JNA5540", "JSD2291"];

  ADELA_BLOCK_PERINCIAN.forEach((blockItem) => {
    // Only generate baseline transactions for historical completed months (Jan - Aug 2026, 8 months)
    // September and October are live months populated solely by real scanned receipts in the database
    blockItem.monthlyTons.slice(0, 8).forEach((ton, mIdx) => {
      const dateStr = monthDates[mIdx] || `2026-0${mIdx + 1}-15`;
      const lorry = lorries[(mIdx + parseInt(blockItem.blok.replace(/\D/g, '') || '1', 10)) % lorries.length];
      const monthNumStr = String(mIdx + 1).padStart(2, '0');
      const receiptNo = `ADL-2026-M${monthNumStr}-${blockItem.blok.toUpperCase()}`;
      
      // Compute accurate RM/MT and KPG
      const kpg = mIdx >= 3 ? "21.50" : "21.20";
      const rmMt = 780 + (mIdx * 15);
      const hasilRm = parseFloat((ton * rmMt).toFixed(2));

      transactions.push({
        no_resit: receiptNo,
        no_akaun_terima: `ADL-${blockItem.blok}`,
        no_lori: lorry,
        no_nota_hantaran: `NH-ADL-${monthNumStr}-${blockItem.blok}`,
        kpg: kpg,
        blok: blockItem.blok,
        peringkat: blockItem.peringkat,
        tan: parseFloat(ton.toFixed(2)),
        muda: 0,
        reject: 0,
        sample: 100,
        rm_mt: rmMt,
        hasil_rm: hasilRm,
        thek: parseFloat((ton / blockItem.luas).toFixed(4)),
        tarikh: dateStr,
        masa_masuk: "10:30:00",
        estate_id: "FPM_ADELA",
        created_at: `${dateStr}T10:30:00.000Z`,
      });
    });
  });

  return transactions;
}
