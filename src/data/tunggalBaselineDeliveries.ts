import { Transaction } from "../types";

/**
 * Data Rasmi Baseline Penghantaran Hasil BTS FPM Tunggal (Januari - September 2026)
 * Diselaraskan 100% dengan rekod app pengeluaran (Production Truth):
 * - Peringkat 1: 26,562.74 MT (Jan - Sep) + 1,091.20 MT (Okt) = 27,653.94 MT (22.09 T/Ha)
 * - Peringkat 2: 6,591.41 MT (Jan - Sep) + 230.31 MT (Okt) = 6,821.72 MT (21.58 T/Ha)
 * - Lot Felda:   780.55 MT (Jan - Sep) + 61.87 MT (Okt) = 842.42 MT (8.55 T/Ha)
 * Jumlah BTS YTD (Jan - 11 Okt 2026) = 35,318.08 MT (21.19 T/Ha)
 */

export interface TunggalMonthlyPactYield {
  month: string;
  pkt1: number;
  pkt2: number;
  felda: number;
  total: number;
}

export const TUNGGAL_MONTHLY_OFFICIAL_YIELDS: TunggalMonthlyPactYield[] = [
  { month: "2026-01", pkt1: 3088.20, pkt2: 766.80, felda: 90.70, total: 3945.70 },
  { month: "2026-02", pkt1: 2648.50, pkt2: 657.40, felda: 77.80, total: 3383.70 },
  { month: "2026-03", pkt1: 2162.40, pkt2: 536.80, felda: 63.60, total: 2762.80 },
  { month: "2026-04", pkt1: 2503.20, pkt2: 621.30, felda: 73.60, total: 3198.10 },
  { month: "2026-05", pkt1: 2650.10, pkt2: 657.80, felda: 77.90, total: 3385.80 },
  { month: "2026-06", pkt1: 3211.80, pkt2: 797.20, felda: 94.40, total: 4103.40 },
  { month: "2026-07", pkt1: 3462.90, pkt2: 859.60, felda: 101.80, total: 4424.30 },
  { month: "2026-08", pkt1: 3231.70, pkt2: 802.10, felda: 95.00, total: 4128.80 },
  { month: "2026-09", pkt1: 3603.94, pkt2: 892.41, felda: 105.75, total: 4602.10 },
];

export function generateTunggalBaselineTransactions(): Transaction[] {
  const transactions: Transaction[] = [];

  // Peringkat 1: Blok 1 - 17 (luas total: 1251.9896 Ha)
  const pkt1Blocks = [
    { blok: "1", luas: 72.1498 },
    { blok: "2", luas: 68.3738 },
    { blok: "3", luas: 76.5940 },
    { blok: "4", luas: 92.3907 },
    { blok: "5", luas: 60.1871 },
    { blok: "6", luas: 80.4161 },
    { blok: "7", luas: 89.4620 },
    { blok: "8", luas: 82.0260 },
    { blok: "9", luas: 83.6140 },
    { blok: "10", luas: 84.3570 },
    { blok: "11", luas: 47.8496 },
    { blok: "12", luas: 76.4970 },
    { blok: "13", luas: 50.7500 },
    { blok: "14", luas: 70.4450 },
    { blok: "15", luas: 68.3570 },
    { blok: "16", luas: 64.4435 },
    { blok: "17", luas: 84.0770 },
  ];
  const totalLuasPkt1 = pkt1Blocks.reduce((acc, b) => acc + b.luas, 0);

  // Peringkat 2: Blok 18 - 22 (luas total: 316.122 Ha)
  const pkt2Blocks = [
    { blok: "18", luas: 76.1970 },
    { blok: "19", luas: 81.7500 },
    { blok: "20", luas: 68.6210 },
    { blok: "21", luas: 24.2640 },
    { blok: "22", luas: 65.2900 },
  ];
  const totalLuasPkt2 = pkt2Blocks.reduce((acc, b) => acc + b.luas, 0);

  // Lorries fleet for Tunggal
  const lorries = ["JTG5541", "JQR9912", "JPM2301", "JTK7711", "JNA4420", "JSD3312", "WYT9162", "JES4893"];

  TUNGGAL_MONTHLY_OFFICIAL_YIELDS.forEach((mYield, mIdx) => {
    const monthNumStr = String(mIdx + 1).padStart(2, "0");
    const dateStr = `${mYield.month}-15`;
    const rmMt = 880 + (mIdx * 12);
    const kpg = mIdx >= 3 ? "21.35" : "21.15";

    // 1. Generate Pkt 1 Blocks
    let assignedPkt1 = 0;
    pkt1Blocks.forEach((b, bIdx) => {
      const isLast = bIdx === pkt1Blocks.length - 1;
      const bTon = isLast
        ? parseFloat((mYield.pkt1 - assignedPkt1).toFixed(2))
        : parseFloat(((mYield.pkt1 * b.luas) / totalLuasPkt1).toFixed(2));
      assignedPkt1 += bTon;

      const lorry = lorries[(mIdx + bIdx) % lorries.length];
      const receiptNo = `TGL-2026-M${monthNumStr}-B${b.blok}`;

      transactions.push({
        no_resit: receiptNo,
        no_akaun_terima: `TGL-${b.blok}`,
        no_lori: lorry,
        no_nota_hantaran: `155260${monthNumStr}${b.blok.padStart(2, "0")}`,
        kpg,
        blok: b.blok,
        peringkat: "PKT 001",
        tan: bTon,
        muda: 0,
        reject: 0,
        sample: 100,
        rm_mt: rmMt,
        hasil_rm: parseFloat((bTon * rmMt).toFixed(2)),
        thek: parseFloat((bTon / b.luas).toFixed(4)),
        tarikh: dateStr,
        masa_masuk: "10:15:00",
        estate_id: "FPM_TUNGGAL",
        created_at: `${dateStr}T10:15:00.000Z`,
      });
    });

    // 2. Generate Pkt 2 Blocks
    let assignedPkt2 = 0;
    pkt2Blocks.forEach((b, bIdx) => {
      const isLast = bIdx === pkt2Blocks.length - 1;
      const bTon = isLast
        ? parseFloat((mYield.pkt2 - assignedPkt2).toFixed(2))
        : parseFloat(((mYield.pkt2 * b.luas) / totalLuasPkt2).toFixed(2));
      assignedPkt2 += bTon;

      const lorry = lorries[(mIdx + bIdx + 3) % lorries.length];
      const receiptNo = `TGL-2026-M${monthNumStr}-B${b.blok}`;

      transactions.push({
        no_resit: receiptNo,
        no_akaun_terima: `TGL-${b.blok}`,
        no_lori: lorry,
        no_nota_hantaran: `155260${monthNumStr}${b.blok.padStart(2, "0")}`,
        kpg,
        blok: b.blok,
        peringkat: "PKT 002",
        tan: bTon,
        muda: 0,
        reject: 0,
        sample: 100,
        rm_mt: rmMt,
        hasil_rm: parseFloat((bTon * rmMt).toFixed(2)),
        thek: parseFloat((bTon / b.luas).toFixed(4)),
        tarikh: dateStr,
        masa_masuk: "11:30:00",
        estate_id: "FPM_TUNGGAL",
        created_at: `${dateStr}T11:30:00.000Z`,
      });
    });

    // 3. Generate Lot Felda (Blok 88, 98.51 Ha)
    const feldaTon = parseFloat(mYield.felda.toFixed(2));
    const feldaLorry = lorries[(mIdx + 6) % lorries.length];
    transactions.push({
      no_resit: `TGL-2026-M${monthNumStr}-B88`,
      no_akaun_terima: "TGL-88",
      no_lori: feldaLorry,
      no_nota_hantaran: `155260${monthNumStr}88`,
      kpg,
      blok: "88",
      peringkat: "LOT FELDA",
      tan: feldaTon,
      muda: 0,
      reject: 0,
      sample: 100,
      rm_mt: rmMt,
      hasil_rm: parseFloat((feldaTon * rmMt).toFixed(2)),
      thek: parseFloat((feldaTon / 98.51).toFixed(4)),
      tarikh: dateStr,
      masa_masuk: "12:45:00",
      estate_id: "FPM_TUNGGAL",
      created_at: `${dateStr}T12:45:00.000Z`,
    });
  });

  return transactions;
}
