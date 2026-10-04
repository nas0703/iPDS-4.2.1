/**
 * FPM Multi-Estate & Organizational Hierarchy Registry
 * 
 * Hierarchy:
 * FPM Wilayah Johor Bahru (Regional Controller - RC)
 * └── Zon Adela (Operation Controller - OC)
 *     ├── 1. FPM Tunggal (Field Controller - FC)
 *     ├── 2. FPM Kledang (Field Controller - FC)
 *     ├── 3. FPM Adela (Field Controller - FC)
 *     └── 4. FPM Sening (Field Controller - FC)
 */

export const ESTATE_CHANGED_EVENT = "ipds_active_estate_changed";

export interface EstateBlockInfo {
  blok: string;
  luas: number; // in Hectares
  pkt: "001" | "002" | "003" | "004" | string; // PKT 1, PKT 2, Lot Felda, Lot Tambahan
  peneroka: number;
  target_mt: number;
  target_hek: number;
}

export interface EstateConfig {
  id: string; // e.g. 'FPM_TUNGGAL'
  name: string; // e.g. 'FPM Tunggal'
  shortName: string; // e.g. 'Tunggal'
  code: string; // e.g. 'TGL'
  zoneId: string; // e.g. 'ZON_ADELA'
  zoneName: string; // e.g. 'Zon Adela'
  regionId: string; // e.g. 'WILAYAH_JB'
  regionName: string; // e.g. 'FPM Wilayah Johor Bahru'
  millName: string; // Default processing mill (e.g. Kilang Sawit Adela)
  totalHectares: number;
  annualTargetPkt1: number;
  annualTargetPkt2: number;
  annualTargetFelda: number;
  annualTargetLotTambahan?: number;
  monthlyTargets2026: Record<string, number[]>; // PKT '001', '002', '003', etc. -> 12 months array
  pktLabels?: Record<string, { full: string; badge: string; short: string }>;
  blocks: Record<string, EstateBlockInfo>;
  status: "active" | "standby";
  isStandby: boolean;
  standbyNote?: string;
}

export interface ZoneConfig {
  id: string;
  name: string;
  regionId: string;
  estates: string[]; // List of estate IDs
}

export interface RegionConfig {
  id: string;
  name: string;
  zones: string[]; // List of zone IDs
}

// 1. REGION CONFIGURATION
export const REGIONS: Record<string, RegionConfig> = {
  WILAYAH_JB: {
    id: "WILAYAH_JB",
    name: "FPM Wilayah Johor Bahru",
    zones: [
      "ZON_ADELA",
      "ZON_SEPAKAT",
      "ZON_LAW",
      "ZON_TENGGAROH",
      "ZON_TAIB_ANDAK"
    ],
  },
};

// 2. ZONE CONFIGURATION
export const ZONES: Record<string, ZoneConfig> = {
  ZON_ADELA: {
    id: "ZON_ADELA",
    name: "Zon Adela",
    regionId: "WILAYAH_JB",
    estates: ["FPM_TUNGGAL", "FPM_KLEDANG", "FPM_ADELA", "FPM_SENING"],
  },
  ZON_SEPAKAT: {
    id: "ZON_SEPAKAT",
    name: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    estates: [
      "FPM_SG_MAS",
      "FPM_PAPAN_TIMUR",
      "FPM_SEMENCHU",
      "FPM_AIR_TAWAR_1",
      "FPM_AIR_TAWAR_2",
      "FPM_AIR_TAWAR_3",
      "FPM_AIR_TAWAR_4",
      "FPM_AIR_TAWAR_5",
      "FPM_PASAK"
    ],
  },
  ZON_LAW: {
    id: "ZON_LAW",
    name: "Zon LAW",
    regionId: "WILAYAH_JB",
    estates: [
      "FPM_LOK_HENG_TIMUR",
      "FPM_LOK_HENG_BARAT",
      "FPM_LOK_HENG_SELATAN",
      "FPM_BUKIT_WAHA",
      "FPM_SIMPANG_WAHA",
      "FPM_APING_TIMUR",
      "FPM_APING_BARAT"
    ],
  },
  ZON_TENGGAROH: {
    id: "ZON_TENGGAROH",
    name: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    estates: [
      "FPM_TENGGAROH_1",
      "FPM_TENGGAROH_2",
      "FPM_TENGGAROH_3",
      "FPM_TENGGAROH_4",
      "FPM_TENGGAROH_5",
      "FPM_TENGGAROH_6",
      "FPM_TENGGAROH_7",
      "FPM_TENGGAROH_TIMUR",
      "FPM_TENGGAROH_SELATAN"
    ],
  },
  ZON_TAIB_ANDAK: {
    id: "ZON_TAIB_ANDAK",
    name: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    estates: [
      "FPM_BUKIT_RAMUN",
      "FPM_BUKIT_BESAR",
      "FPM_SG_SAYONG",
      "FPM_PENGGELI_TIMUR",
      "FPM_SG_SIBOL",
      "FPM_INAS_UTARA",
      "FPM_LINGGIU",
      "FPM_PASIR_RAJA",
      "FPM_ULU_TEBRAU",
      "FPM_TAIB_ANDAK",
      "FPM_ENDAU"
    ],
  },
};

// Default monthly targets for FPM estates in 2026
export const DEFAULT_MONTHLY_TARGETS_2026: Record<string, number[]> = {
  "001": [1.90, 1.80, 2.10, 1.90, 2.00, 2.20, 2.50, 2.70, 2.90, 2.95, 2.75, 2.40],
  "002": [1.60, 1.50, 1.80, 2.00, 2.30, 2.30, 2.70, 2.60, 2.70, 2.80, 3.00, 2.70],
  "003": [0.98, 0.78, 0.88, 0.88, 0.90, 1.00, 1.02, 1.50, 1.60, 1.60, 1.28, 1.35],
};

// 3. COMPLETE ESTATES REGISTRY FOR ZON ADELA
export const ESTATES_REGISTRY: Record<string, EstateConfig> = {
  // 0. WILAYAH JOHOR BAHRU (HQ)
  WILAYAH_JB: {
    id: "WILAYAH_JB",
    name: "FPM Wilayah Johor Bahru",
    shortName: "Wilayah JB",
    code: "WJB",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 6835.45,
    annualTargetPkt1: 28.0,
    annualTargetPkt2: 28.0,
    annualTargetFelda: 20.0,
    monthlyTargets2026: DEFAULT_MONTHLY_TARGETS_2026,
    status: "active",
    isStandby: false,
    blocks: {},
  },

  // 1. FPM TUNGGAL
  FPM_TUNGGAL: {
    id: "FPM_TUNGGAL",
    name: "FPM Tunggal",
    shortName: "Tunggal",
    code: "TGL",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 1563.15,
    annualTargetPkt1: 28.0,
    annualTargetPkt2: 28.0,
    annualTargetFelda: 11.99,
    monthlyTargets2026: DEFAULT_MONTHLY_TARGETS_2026,
    status: "active",
    isStandby: false,
    blocks: {
      "1": { blok: "1", luas: 72.1498, target_mt: 137.08, target_hek: 1.9, pkt: "001", peneroka: 18 },
      "2": { blok: "2", luas: 68.3738, target_mt: 129.91, target_hek: 1.9, pkt: "001", peneroka: 17 },
      "3": { blok: "3", luas: 76.594, target_mt: 145.53, target_hek: 1.9, pkt: "001", peneroka: 19 },
      "4": { blok: "4", luas: 92.3907, target_mt: 175.54, target_hek: 1.9, pkt: "001", peneroka: 23 },
      "5": { blok: "5", luas: 60.1871, target_mt: 114.36, target_hek: 1.9, pkt: "001", peneroka: 15 },
      "6": { blok: "6", luas: 80.4161, target_mt: 152.79, target_hek: 1.9, pkt: "001", peneroka: 20 },
      "7": { blok: "7", luas: 89.462, target_mt: 169.98, target_hek: 1.9, pkt: "001", peneroka: 22 },
      "8": { blok: "8", luas: 82.026, target_mt: 155.85, target_hek: 1.9, pkt: "001", peneroka: 20 },
      "9": { blok: "9", luas: 83.614, target_mt: 158.87, target_hek: 1.9, pkt: "001", peneroka: 22 },
      "10": { blok: "10", luas: 84.357, target_mt: 160.28, target_hek: 1.9, pkt: "001", peneroka: 21 },
      "11": { blok: "11", luas: 47.8496, target_mt: 90.91, target_hek: 1.9, pkt: "001", peneroka: 12 },
      "12": { blok: "12", luas: 76.497, target_mt: 145.34, target_hek: 1.9, pkt: "001", peneroka: 19 },
      "13": { blok: "13", luas: 50.75, target_mt: 96.43, target_hek: 1.9, pkt: "001", peneroka: 13 },
      "14": { blok: "14", luas: 70.445, target_mt: 133.85, target_hek: 1.9, pkt: "001", peneroka: 18 },
      "15": { blok: "15", luas: 68.357, target_mt: 129.88, target_hek: 1.9, pkt: "001", peneroka: 17 },
      "16": { blok: "16", luas: 64.4435, target_mt: 122.44, target_hek: 1.9, pkt: "001", peneroka: 16 },
      "17": { blok: "17", luas: 84.077, target_mt: 159.75, target_hek: 1.9, pkt: "001", peneroka: 21 },
      "18": { blok: "18", luas: 76.197, target_mt: 121.92, target_hek: 1.6, pkt: "002", peneroka: 19 },
      "19": { blok: "19", luas: 81.75, target_mt: 130.80, target_hek: 1.6, pkt: "002", peneroka: 21 },
      "20": { blok: "20", luas: 68.621, target_mt: 109.79, target_hek: 1.6, pkt: "002", peneroka: 17 },
      "21": { blok: "21", luas: 24.264, target_mt: 38.82, target_hek: 1.6, pkt: "002", peneroka: 6 },
      "22": { blok: "22", luas: 65.29, target_mt: 104.46, target_hek: 1.6, pkt: "002", peneroka: 16 },
      "88": { blok: "88", luas: 98.51, target_mt: 86.69, target_hek: 0.88, pkt: "003", peneroka: 0 },
    },
  },

  // 2. FPM KLEDANG (STATUS: STANDBY UNTUK MENERIMA DATA SET ASAS)
  FPM_KLEDANG: {
    id: "FPM_KLEDANG",
    name: "FPM Kledang",
    shortName: "Kledang",
    code: "KLD",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026). Sedia menerima pendaftaran blok.",
    blocks: {},
  },

  // 3. FPM ADELA
  FPM_ADELA: {
    id: "FPM_ADELA",
    name: "FPM Adela",
    shortName: "Adela",
    code: "ADL",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 1041.22, // Pkt 1 (613.64 Ha) + Pkt 2 (333.42 Ha) + Lot Tambahan (16.12 Ha) + Lot Felda (78.04 Ha) = 1,041.22 Ha
    annualTargetPkt1: 25.0,
    annualTargetPkt2: 25.0,
    annualTargetFelda: 12.98,
    annualTargetLotTambahan: 21.0,
    status: "active",
    isStandby: false,
    monthlyTargets2026: {
      "001": [1.80, 1.60, 1.80, 1.40, 1.80, 1.70, 2.20, 2.40, 2.90, 2.70, 2.40, 2.30], // Pkt 1 (Total: 25.00 T/Hek, Jan: 1.80)
      "002": [2.20, 2.20, 2.10, 2.00, 1.80, 1.70, 1.60, 1.60, 2.30, 2.40, 2.45, 2.65], // Pkt 2 (Total: 25.00 T/Hek, Jan: 2.20)
      "003": [0.97, 0.93, 0.91, 0.93, 0.96, 1.06, 1.11, 1.24, 1.24, 1.18, 1.23, 1.22], // 1F Felda (Total: 12.98 T/Hek, Jan: 0.97)
      "003_2F": [1.01, 0.95, 0.94, 0.95, 1.00, 1.14, 1.19, 1.26, 1.27, 1.03, 0.98, 1.26], // 2F Felda (Total: 12.98 T/Hek, Jan: 1.01)
      "004": [1.40, 1.15, 1.40, 1.30, 1.50, 1.70, 1.90, 2.20, 2.30, 2.25, 2.00, 1.90], // Lot Tambahan 125Y/128Y/121V (Total: 21.00 T/Hek, Jan: 1.40)
    },
    blocks: {
      // Pkt 1 (Blok 1 - 11, Total 613.6 Hektar, 156 Peneroka)
      "1": { blok: "1", luas: 30.46, target_mt: 57.87, target_hek: 1.9, pkt: "001", peneroka: 8 },
      "2": { blok: "2", luas: 58.07, target_mt: 110.33, target_hek: 1.9, pkt: "001", peneroka: 15 },
      "3": { blok: "3", luas: 45.91, target_mt: 87.23, target_hek: 1.9, pkt: "001", peneroka: 12 },
      "4": { blok: "4", luas: 57.89, target_mt: 110.00, target_hek: 1.9, pkt: "001", peneroka: 15 },
      "5": { blok: "5", luas: 60.05, target_mt: 114.10, target_hek: 1.9, pkt: "001", peneroka: 15 },
      "6": { blok: "6", luas: 64.64, target_mt: 122.82, target_hek: 1.9, pkt: "001", peneroka: 16 },
      "7": { blok: "7", luas: 68.17, target_mt: 129.52, target_hek: 1.9, pkt: "001", peneroka: 17 },
      "8": { blok: "8", luas: 77.53, target_mt: 147.31, target_hek: 1.9, pkt: "001", peneroka: 20 },
      "9": { blok: "9", luas: 64.04, target_mt: 121.68, target_hek: 1.9, pkt: "001", peneroka: 16 },
      "10": { blok: "10", luas: 63.01, target_mt: 119.72, target_hek: 1.9, pkt: "001", peneroka: 16 },
      "11": { blok: "11", luas: 23.87, target_mt: 45.35, target_hek: 1.9, pkt: "001", peneroka: 6 },

      // Pkt 2 (Blok 1 - 6, Total 333.4 Hektar, 83 Peneroka - mapped to 12-17 for numerical uniqueness)
      "12": { blok: "12", luas: 59.93, target_mt: 95.89, target_hek: 1.6, pkt: "002", peneroka: 15 },
      "13": { blok: "13", luas: 60.47, target_mt: 96.75, target_hek: 1.6, pkt: "002", peneroka: 15 },
      "14": { blok: "14", luas: 40.40, target_mt: 64.64, target_hek: 1.6, pkt: "002", peneroka: 10 },
      "15": { blok: "15", luas: 48.41, target_mt: 77.46, target_hek: 1.6, pkt: "002", peneroka: 12 },
      "16": { blok: "16", luas: 67.76, target_mt: 108.42, target_hek: 1.6, pkt: "002", peneroka: 17 },
      "17": { blok: "17", luas: 56.45, target_mt: 90.32, target_hek: 1.6, pkt: "002", peneroka: 14 },

      // Lot FELDA (1F & 2F, Total 78.04 Hektar)
      "1F": { blok: "1F", luas: 39.81, target_mt: 44.19, target_hek: 1.11, pkt: "003", peneroka: 0 },
      "2F": { blok: "2F", luas: 38.23, target_mt: 45.49, target_hek: 1.19, pkt: "003", peneroka: 0 },

      // Lot Tambahan (125Y, 128Y, 121V, Total 16.16 Hektar, 4 Peneroka)
      "125Y": { blok: "125Y", luas: 8.06, target_mt: 15.31, target_hek: 1.9, pkt: "004", peneroka: 2 },
      "128Y": { blok: "128Y", luas: 4.08, target_mt: 7.75, target_hek: 1.9, pkt: "004", peneroka: 1 },
      "121V": { blok: "121V", luas: 4.02, target_mt: 7.64, target_hek: 1.9, pkt: "004", peneroka: 1 },
    },
  },

  // 4. FPM SENING (STATUS: STANDBY UNTUK MENERIMA DATA SET ASAS)
  FPM_SENING: {
    id: "FPM_SENING",
    name: "FPM Sening",
    shortName: "Sening",
    code: "SNG",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026). Sedia menerima pendaftaran blok.",
    blocks: {},
  },

  // ==========================================
  // ZON SEPAKAT (9 LADANG)
  // ==========================================
  FPM_SG_MAS: {
    id: "FPM_SG_MAS",
    name: "FPM Sg. Mas",
    shortName: "Sg. Mas",
    code: "SGM",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_PAPAN_TIMUR: {
    id: "FPM_PAPAN_TIMUR",
    name: "FPM Papan Timur",
    shortName: "Papan Timur",
    code: "PPT",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_SEMENCHU: {
    id: "FPM_SEMENCHU",
    name: "FPM Semenchu",
    shortName: "Semenchu",
    code: "SMC",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_AIR_TAWAR_1: {
    id: "FPM_AIR_TAWAR_1",
    name: "FPM Air Tawar 1",
    shortName: "Air Tawar 1",
    code: "AT1",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_AIR_TAWAR_2: {
    id: "FPM_AIR_TAWAR_2",
    name: "FPM Air Tawar 2",
    shortName: "Air Tawar 2",
    code: "AT2",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_AIR_TAWAR_3: {
    id: "FPM_AIR_TAWAR_3",
    name: "FPM Air Tawar 3",
    shortName: "Air Tawar 3",
    code: "AT3",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_AIR_TAWAR_4: {
    id: "FPM_AIR_TAWAR_4",
    name: "FPM Air Tawar 4",
    shortName: "Air Tawar 4",
    code: "AT4",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_AIR_TAWAR_5: {
    id: "FPM_AIR_TAWAR_5",
    name: "FPM Air Tawar 5",
    shortName: "Air Tawar 5",
    code: "AT5",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_PASAK: {
    id: "FPM_PASAK",
    name: "FPM Pasak",
    shortName: "Pasak",
    code: "PSK",
    zoneId: "ZON_SEPAKAT",
    zoneName: "Zon Sepakat",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },

  // ==========================================
  // ZON LAW (7 LADANG)
  // ==========================================
  FPM_LOK_HENG_TIMUR: {
    id: "FPM_LOK_HENG_TIMUR",
    name: "FPM Lok Heng Timur",
    shortName: "Lok Heng Timur",
    code: "LHT",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_LOK_HENG_BARAT: {
    id: "FPM_LOK_HENG_BARAT",
    name: "FPM Lok Heng Barat",
    shortName: "Lok Heng Barat",
    code: "LHB",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_LOK_HENG_SELATAN: {
    id: "FPM_LOK_HENG_SELATAN",
    name: "FPM Lok Heng Selatan",
    shortName: "Lok Heng Selatan",
    code: "LHS",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_BUKIT_WAHA: {
    id: "FPM_BUKIT_WAHA",
    name: "FPM Bukit Waha",
    shortName: "Bukit Waha",
    code: "BWH",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_SIMPANG_WAHA: {
    id: "FPM_SIMPANG_WAHA",
    name: "FPM Simpang Waha",
    shortName: "Simpang Waha",
    code: "SWH",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_APING_TIMUR: {
    id: "FPM_APING_TIMUR",
    name: "FPM Aping Timur",
    shortName: "Aping Timur",
    code: "APT",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_APING_BARAT: {
    id: "FPM_APING_BARAT",
    name: "FPM Aping Barat",
    shortName: "Aping Barat",
    code: "APB",
    zoneId: "ZON_LAW",
    zoneName: "Zon LAW",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },

  // ==========================================
  // ZON TENGGAROH (9 LADANG)
  // ==========================================
  FPM_TENGGAROH_1: {
    id: "FPM_TENGGAROH_1",
    name: "FPM Tenggaroh 1",
    shortName: "Tenggaroh 1",
    code: "TG1",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_2: {
    id: "FPM_TENGGAROH_2",
    name: "FPM Tenggaroh 2",
    shortName: "Tenggaroh 2",
    code: "TG2",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_3: {
    id: "FPM_TENGGAROH_3",
    name: "FPM Tenggaroh 3",
    shortName: "Tenggaroh 3",
    code: "TG3",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_4: {
    id: "FPM_TENGGAROH_4",
    name: "FPM Tenggaroh 4",
    shortName: "Tenggaroh 4",
    code: "TG4",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_5: {
    id: "FPM_TENGGAROH_5",
    name: "FPM Tenggaroh 5",
    shortName: "Tenggaroh 5",
    code: "TG5",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_6: {
    id: "FPM_TENGGAROH_6",
    name: "FPM Tenggaroh 6",
    shortName: "Tenggaroh 6",
    code: "TG6",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_7: {
    id: "FPM_TENGGAROH_7",
    name: "FPM Tenggaroh 7",
    shortName: "Tenggaroh 7",
    code: "TG7",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_TIMUR: {
    id: "FPM_TENGGAROH_TIMUR",
    name: "FPM Tenggaroh Timur",
    shortName: "Tenggaroh Timur",
    code: "TGT",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TENGGAROH_SELATAN: {
    id: "FPM_TENGGAROH_SELATAN",
    name: "FPM Tenggaroh Selatan",
    shortName: "Tenggaroh Selatan",
    code: "TGS",
    zoneId: "ZON_TENGGAROH",
    zoneName: "Zon Tenggaroh",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },

  // ==========================================
  // ZON TAIB ANDAK (11 LADANG)
  // ==========================================
  FPM_BUKIT_RAMUN: {
    id: "FPM_BUKIT_RAMUN",
    name: "FPM Bukit Ramun",
    shortName: "Bukit Ramun",
    code: "BRM",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_BUKIT_BESAR: {
    id: "FPM_BUKIT_BESAR",
    name: "FPM Bukit Besar",
    shortName: "Bukit Besar",
    code: "BBS",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_SG_SAYONG: {
    id: "FPM_SG_SAYONG",
    name: "FPM Sg. Sayong",
    shortName: "Sg. Sayong",
    code: "SSY",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_PENGGELI_TIMUR: {
    id: "FPM_PENGGELI_TIMUR",
    name: "FPM Penggeli Timur",
    shortName: "Penggeli Timur",
    code: "PGT",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_SG_SIBOL: {
    id: "FPM_SG_SIBOL",
    name: "FPM Sg. Sibol",
    shortName: "Sg. Sibol",
    code: "SSB",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_INAS_UTARA: {
    id: "FPM_INAS_UTARA",
    name: "FPM Inas Utara",
    shortName: "Inas Utara",
    code: "INU",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_LINGGIU: {
    id: "FPM_LINGGIU",
    name: "FPM Linggiu",
    shortName: "Linggiu",
    code: "LGQ",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_PASIR_RAJA: {
    id: "FPM_PASIR_RAJA",
    name: "FPM Pasir Raja",
    shortName: "Pasir Raja",
    code: "PSR",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_ULU_TEBRAU: {
    id: "FPM_ULU_TEBRAU",
    name: "FPM Ulu Tebrau",
    shortName: "Ulu Tebrau",
    code: "UTB",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_TAIB_ANDAK: {
    id: "FPM_TAIB_ANDAK",
    name: "FPM Taib Andak",
    shortName: "Taib Andak",
    code: "TBA",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
  FPM_ENDAU: {
    id: "FPM_ENDAU",
    name: "FPM Endau",
    shortName: "Endau",
    code: "END",
    zoneId: "ZON_TAIB_ANDAK",
    zoneName: "Zon Taib Andak",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Wilayah JB",
    totalHectares: 0,
    annualTargetPkt1: 0,
    annualTargetPkt2: 0,
    annualTargetFelda: 0,
    monthlyTargets2026: {},
    status: "standby",
    isStandby: true,
    standbyNote: "Mod Standby: Menunggu penyerahan data set asas (Keluasan Blok, Bilangan Peneroka, & Sasaran Bulanan 2026).",
    blocks: {},
  },
};

const CUSTOM_MASTER_KEY_PREFIX = "fpm_custom_master_data_";

/**
 * Get estate metadata by ID with robust fallback and localStorage override support
 */
export function getEstateConfig(estateId?: string | null): EstateConfig {
  const cleanId = (estateId || "FPM_TUNGGAL").trim().toUpperCase();
  const baseConfig = (ESTATES_REGISTRY && (ESTATES_REGISTRY[cleanId] || ESTATES_REGISTRY["FPM_TUNGGAL"])) || {
    id: "FPM_TUNGGAL",
    name: "FPM Tunggal",
    shortName: "Tunggal",
    code: "TGL",
    zoneId: "ZON_ADELA",
    zoneName: "Zon Adela",
    regionId: "WILAYAH_JB",
    regionName: "FPM Wilayah Johor Bahru",
    millName: "Kilang Sawit Adela",
    totalHectares: 1563.15,
    annualTargetPkt1: 28.0,
    annualTargetPkt2: 28.0,
    annualTargetFelda: 11.99,
    monthlyTargets2026: DEFAULT_MONTHLY_TARGETS_2026,
    status: "active",
    isStandby: false,
    blocks: {}
  };

  // Handle WILAYAH_JB aggregated configuration
  if (cleanId === "WILAYAH_JB" || cleanId === "WJB" || cleanId === "0001") {
    const combinedBlocks: Record<string, EstateBlockInfo> = {};
    const activeEstateKeys = ["FPM_TUNGGAL", "FPM_ADELA", "FPM_KLEDANG", "FPM_SENING"];
    
    activeEstateKeys.forEach((key) => {
      const estate = ESTATES_REGISTRY[key];
      if (estate && estate.blocks) {
        Object.entries(estate.blocks).forEach(([blkKey, blkInfo]) => {
          const uniqueKey = `${estate.code}_${blkKey}`;
          combinedBlocks[uniqueKey] = {
            ...blkInfo,
            blok: `${estate.shortName} B${blkInfo.blok || blkKey}`,
          };
        });
      }
    });

    return {
      ...baseConfig,
      name: "FPM Wilayah Johor Bahru",
      shortName: "Wilayah JB",
      code: "WJB",
      blocks: combinedBlocks,
      totalHectares: baseConfig.totalHectares || 6835.45,
      status: "active",
      isStandby: false,
    };
  }

  // Check if there's any custom/imported master dataset in localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${CUSTOM_MASTER_KEY_PREFIX}${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.blocks && Object.keys(parsed.blocks).length > 0) {
          const totalHectares = Object.values(parsed.blocks as Record<string, EstateBlockInfo>).reduce(
            (acc, curr) => acc + (Number(curr.luas) || 0),
            0
          );
          const sanitizedCode = parsed.code === "0001" ? "WJB" : (parsed.code || baseConfig.code);
          const sanitizedName = (parsed.name && parsed.name.toLowerCase().includes("ibu pejabat")) 
            ? "FPM Wilayah Johor Bahru" 
            : (parsed.name || baseConfig.name);

          return {
            ...baseConfig,
            ...parsed,
            code: sanitizedCode,
            name: sanitizedName,
            totalHectares: parsed.totalHectares || totalHectares,
            status: "active",
            isStandby: false,
            standbyNote: undefined,
          };
        }
      }
    } catch (e) {
      console.warn("Failed to parse custom estate master data", e);
    }
  }

  return baseConfig;
}

/**
 * Check if an estate is currently in standby mode (waiting for master data)
 */
export function isEstateInStandby(estateId?: string | null): boolean {
  const cfg = getEstateConfig(estateId);
  return !!cfg.isStandby || cfg.status === "standby" || Object.keys(cfg.blocks).length === 0;
}

/**
 * Save custom master dataset for an estate (e.g. from Excel/CSV import or manual entry)
 */
export function saveCustomEstateMasterData(
  estateId: string,
  data: {
    blocks: Record<string, EstateBlockInfo>;
    totalHectares?: number;
    annualTargetPkt1?: number;
    annualTargetPkt2?: number;
    annualTargetFelda?: number;
    monthlyTargets2026?: Record<string, number[]>;
  }
): void {
  if (typeof window === "undefined") return;
  const cleanId = estateId.trim().toUpperCase();
  try {
    const totalHectares =
      data.totalHectares ||
      Object.values(data.blocks).reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);

    const payload = {
      ...data,
      totalHectares,
      status: "active",
      isStandby: false,
    };
    localStorage.setItem(`${CUSTOM_MASTER_KEY_PREFIX}${cleanId}`, JSON.stringify(payload));
    
    // Dispatch estate changed event to notify all listeners
    window.dispatchEvent(
      new CustomEvent(ESTATE_CHANGED_EVENT, {
        detail: { estateId: cleanId, config: getEstateConfig(cleanId) },
      })
    );
  } catch (err) {
    console.error("Failed to save custom master data:", err);
  }
}

/**
 * Reset estate master data back to original standby state
 */
export function resetCustomEstateMasterData(estateId: string): void {
  if (typeof window === "undefined") return;
  const cleanId = estateId.trim().toUpperCase();
  try {
    localStorage.removeItem(`${CUSTOM_MASTER_KEY_PREFIX}${cleanId}`);
    window.dispatchEvent(
      new CustomEvent(ESTATE_CHANGED_EVENT, {
        detail: { estateId: cleanId, config: getEstateConfig(cleanId) },
      })
    );
  } catch (err) {
    console.error("Failed to reset custom master data:", err);
  }
}

/**
 * Get all available estates in array format
 */
export function getAllEstatesList(): EstateConfig[] {
  return Object.values(ESTATES_REGISTRY).map((e) => getEstateConfig(e.id));
}

/**
 * Get estates belonging to a specific zone
 */
export function getEstatesInZone(zoneId: string = "ZON_ADELA"): EstateConfig[] {
  return Object.values(ESTATES_REGISTRY)
    .filter((e) => e.zoneId === zoneId)
    .map((e) => getEstateConfig(e.id));
}

// Map 4-Digit Numeric Estate & Region Codes to Estate IDs & Names
export const ESTATE_NUMERIC_CODES: Record<string, { id: string; name: string; shortName: string; code: string }> = {
  "WJB": { id: "WILAYAH_JB", name: "FPM WILAYAH JOHOR BAHRU", shortName: "Wilayah JB", code: "WJB" },
  "0001": { id: "WILAYAH_JB", name: "FPM WILAYAH JOHOR BAHRU", shortName: "Wilayah JB", code: "WJB" },
  // Zon Adela
  "5155": { id: "FPM_TUNGGAL", name: "LADANG FPM TUNGGAL", shortName: "Tunggal", code: "5155" },
  "5136": { id: "FPM_ADELA", name: "LADANG FPM ADELA", shortName: "Adela", code: "5136" },
  "5176": { id: "FPM_KLEDANG", name: "LADANG FPM KLEDANG", shortName: "Kledang", code: "5176" },
  "5156": { id: "FPM_SENING", name: "LADANG FPM SENING", shortName: "Sening", code: "5156" },
};

/**
 * Robust normalizer for Estate ID across all system formats (code, id, name)
 */
export function normalizeEstateId(codeOrId?: string | null): string {
  if (!codeOrId) return "FPM_TUNGGAL";
  const val = String(codeOrId).trim().toUpperCase();
  if (val === "0001" || val === "WJB" || val.includes("WILAYAH") || val === "WILAYAH_JB" || val === "FPM_WILAYAH_JB") return "WILAYAH_JB";
  
  // Zon Adela
  if (val === "5136" || val.includes("ADELA") || val === "ADL") return "FPM_ADELA";
  if (val === "5176" || val.includes("KLEDANG") || val === "KLD") return "FPM_KLEDANG";
  if (val === "5156" || val.includes("SENING") || val === "SNG") return "FPM_SENING";
  if (val === "5155" || val.includes("TUNGGAL") || val === "TGL") return "FPM_TUNGGAL";

  // Zon Sepakat
  if (val.includes("SG_MAS") || val.includes("SG. MAS") || val.includes("SUNGAI MAS") || val === "SGM") return "FPM_SG_MAS";
  if (val.includes("PAPAN_TIMUR") || val.includes("PAPAN TIMUR") || val === "PPT") return "FPM_PAPAN_TIMUR";
  if (val.includes("SEMENCHU") || val === "SMC") return "FPM_SEMENCHU";
  if (val.includes("AIR_TAWAR_1") || val.includes("AIR TAWAR 1") || val === "AT1") return "FPM_AIR_TAWAR_1";
  if (val.includes("AIR_TAWAR_2") || val.includes("AIR TAWAR 2") || val === "AT2") return "FPM_AIR_TAWAR_2";
  if (val.includes("AIR_TAWAR_3") || val.includes("AIR TAWAR 3") || val === "AT3") return "FPM_AIR_TAWAR_3";
  if (val.includes("AIR_TAWAR_4") || val.includes("AIR TAWAR 4") || val === "AT4") return "FPM_AIR_TAWAR_4";
  if (val.includes("AIR_TAWAR_5") || val.includes("AIR TAWAR 5") || val === "AT5") return "FPM_AIR_TAWAR_5";
  if (val.includes("PASAK") || val === "PSK") return "FPM_PASAK";

  // Zon LAW
  if (val.includes("LOK_HENG_TIMUR") || val.includes("LOK HENG TIMUR") || val === "LHT") return "FPM_LOK_HENG_TIMUR";
  if (val.includes("LOK_HENG_BARAT") || val.includes("LOK HENG BARAT") || val === "LHB") return "FPM_LOK_HENG_BARAT";
  if (val.includes("LOK_HENG_SELATAN") || val.includes("LOK HENG SELATAN") || val === "LHS") return "FPM_LOK_HENG_SELATAN";
  if (val.includes("BUKIT_WAHA") || val.includes("BUKIT WAHA") || val === "BWH") return "FPM_BUKIT_WAHA";
  if (val.includes("SIMPANG_WAHA") || val.includes("SIMPANG WAHA") || val === "SWH") return "FPM_SIMPANG_WAHA";
  if (val.includes("APING_TIMUR") || val.includes("APING TIMUR") || val === "APT") return "FPM_APING_TIMUR";
  if (val.includes("APING_BARAT") || val.includes("APING BARAT") || val === "APB") return "FPM_APING_BARAT";

  // Zon Tenggaroh
  if (val.includes("TENGGAROH_1") || val.includes("TENGGAROH 1") || val === "TG1") return "FPM_TENGGAROH_1";
  if (val.includes("TENGGAROH_2") || val.includes("TENGGAROH 2") || val === "TG2") return "FPM_TENGGAROH_2";
  if (val.includes("TENGGAROH_3") || val.includes("TENGGAROH 3") || val === "TG3") return "FPM_TENGGAROH_3";
  if (val.includes("TENGGAROH_4") || val.includes("TENGGAROH 4") || val === "TG4") return "FPM_TENGGAROH_4";
  if (val.includes("TENGGAROH_5") || val.includes("TENGGAROH 5") || val === "TG5") return "FPM_TENGGAROH_5";
  if (val.includes("TENGGAROH_6") || val.includes("TENGGAROH 6") || val === "TG6") return "FPM_TENGGAROH_6";
  if (val.includes("TENGGAROH_7") || val.includes("TENGGAROH 7") || val === "TG7") return "FPM_TENGGAROH_7";
  if (val.includes("TENGGAROH_TIMUR") || val.includes("TENGGAROH TIMUR") || val === "TGT") return "FPM_TENGGAROH_TIMUR";
  if (val.includes("TENGGAROH_SELATAN") || val.includes("TENGGAROH SELATAN") || val === "TGS") return "FPM_TENGGAROH_SELATAN";

  // Zon Taib Andak
  if (val.includes("BUKIT_RAMUN") || val.includes("BUKIT RAMUN") || val === "BRM") return "FPM_BUKIT_RAMUN";
  if (val.includes("BUKIT_BESAR") || val.includes("BUKIT BESAR") || val === "BBS") return "FPM_BUKIT_BESAR";
  if (val.includes("SG_SAYONG") || val.includes("SG. SAYONG") || val.includes("SUNGAI SAYONG") || val === "SSY") return "FPM_SG_SAYONG";
  if (val.includes("PENGGELI_TIMUR") || val.includes("PENGGELI TIMUR") || val === "PGT") return "FPM_PENGGELI_TIMUR";
  if (val.includes("SG_SIBOL") || val.includes("SG. SIBOL") || val.includes("SUNGAI SIBOL") || val === "SSB") return "FPM_SG_SIBOL";
  if (val.includes("INAS_UTARA") || val.includes("INAS UTARA") || val === "INU") return "FPM_INAS_UTARA";
  if (val.includes("LINGGIU") || val === "LGQ") return "FPM_LINGGIU";
  if (val.includes("PASIR_RAJA") || val.includes("PASIR RAJA") || val === "PSR") return "FPM_PASIR_RAJA";
  if (val.includes("ULU_TEBRAU") || val.includes("ULU TEBRAU") || val === "UTB") return "FPM_ULU_TEBRAU";
  if (val.includes("TAIB_ANDAK") || val.includes("TAIB ANDAK") || val === "TBA") return "FPM_TAIB_ANDAK";
  if (val.includes("ENDAU") || val === "END") return "FPM_ENDAU";

  return val;
}

/**
 * Get standard 4-digit estate code from Estate ID
 */
export function getEstateCodeFromId(estateId?: string | null): string {
  const norm = normalizeEstateId(estateId);
  if (norm === "WILAYAH_JB") return "WJB";
  if (norm === "FPM_ADELA") return "5136";
  if (norm === "FPM_KLEDANG") return "5176";
  if (norm === "FPM_SENING") return "5156";
  return "5155";
}

/**
 * Check if a user role has authority to view or switch multiple estates.
 *
 * `isSuperAdminOverride` is set by the canonical client predicate
 * (rbacService.isSuperAdmin) so that the FC Tunggal retains cross-estate
 * authority independently of the currently selected UI estate.
 */
export function canSwitchEstates(role?: string | null, isSuperAdminOverride = false): boolean {
  if (isSuperAdminOverride) return true;
  if (!role) return false;
  const r = role.toLowerCase().trim();
  if (["superadmin", "super_admin", "admin"].includes(r)) return true;
  return ["rc", "oc", "pf"].includes(r);
}

/**
 * Get list of accessible estates based on user role and assigned estate
 */
export function getAccessibleEstatesForUser(
  role?: string | null,
  userEstateId?: string | null,
  isSuperAdminOverride = false
): EstateConfig[] {
  if (isSuperAdminOverride || (role && ["superadmin", "super_admin", "admin"].includes(role.toLowerCase().trim()))) {
    return getAllEstatesList();
  }
  if (!role) return [getEstateConfig(userEstateId)];
  const r = role.toLowerCase().trim();

  // Regional Controller (RC) has access to all estates in Wilayah Johor Bahru
  if (r === "rc") {
    return getAllEstatesList();
  }

  // Operation Controller (OC) has access to all estates in Zon Adela
  if (r === "oc") {
    return getEstatesInZone("ZON_ADELA");
  }

  // Pengurus Felda (PF) has multi-estate audit view
  if (r === "pf") {
    return getEstatesInZone("ZON_ADELA");
  }

  // Estate-level staff (FC, AFC, FS, Staff, Mandur, EQI) are locked to their own estate
  const currentEstate = getEstateConfig(userEstateId);
  return [currentEstate];
}

/**
 * Get block master data for an estate (with fallback)
 */
export function getEstateBlockMasterData(estateId?: string | null): Record<string, EstateBlockInfo> {
  const config = getEstateConfig(estateId);
  return config.blocks;
}

/**
 * Helper to get block area in hectares
 */
export function getBlockArea(blok: string, estateId?: string | null): number {
  const blocks = getEstateBlockMasterData(estateId);
  return blocks[blok]?.luas || 1.0;
}

/**
 * Helper to safely resolve active estate ID inside registry functions
 */
function resolveCurrentEstateId(estateId?: string | null): string {
  if (estateId) return estateId.trim().toUpperCase();
  if (typeof window !== 'undefined') {
    const wId = (window as any).__IPDS_ACTIVE_ESTATE_ID__;
    if (wId) return String(wId).trim().toUpperCase();
    try {
      const stored = sessionStorage.getItem('ipds_active_estate_id') || localStorage.getItem('ipds_active_estate_id');
      if (stored) return stored.trim().toUpperCase();
    } catch (_) {}
  }
  return "FPM_TUNGGAL";
}

/**
 * Get display name for a Peringkat code (e.g. '001', '002', '003', '004')
 * strictly checking whether the estate locks '003' to 'LOT FELDA' (Adela & Tunggal)
 * or treats '003' as 'PKT 003' / standard Peringkat 3 for other estates.
 */
export function getPktDisplayName(pktCode: string, estateId?: string | null): string {
  const cleanId = resolveCurrentEstateId(estateId);
  const isAdelaOrTunggal = cleanId === "FPM_ADELA" || cleanId === "FPM_TUNGGAL";

  if (pktCode === "001") return "PKT 001";
  if (pktCode === "002") return "PKT 002";
  if (pktCode === "003") {
    return isAdelaOrTunggal ? "LOT FELDA" : "PKT 003";
  }
  if (pktCode === "004") return cleanId === "FPM_ADELA" ? "PKT 004 (Lot Tambahan)" : "PKT 004";
  return `PKT ${pktCode}`;
}

/**
 * Get short badge name for a Peringkat code (e.g. 'P1', 'P2', 'Lot Felda' vs 'P3')
 */
export function getPktBadgeName(pktCode: string, estateId?: string | null): string {
  const cleanId = resolveCurrentEstateId(estateId);
  const isAdelaOrTunggal = cleanId === "FPM_ADELA" || cleanId === "FPM_TUNGGAL";

  if (pktCode === "001") return "P1";
  if (pktCode === "002") return "P2";
  if (pktCode === "003") {
    return isAdelaOrTunggal ? "Lot Felda" : "P3";
  }
  if (pktCode === "004") return cleanId === "FPM_ADELA" ? "Lot" : "P4";
  return pktCode;
}

/**
 * Check whether a code represents Lot Felda for the specific estate
 */
export function isEstateFeldaPkt(pktCode: string, estateId?: string | null): boolean {
  const cleanId = resolveCurrentEstateId(estateId);
  const isAdelaOrTunggal = cleanId === "FPM_ADELA" || cleanId === "FPM_TUNGGAL";
  return isAdelaOrTunggal && pktCode === "003";
}

/**
 * Re-export estateContext helpers for backward compatibility
 */
export { getActiveEstateId, setRuntimeEstateId, getActiveEstateConfig } from '../utils/estateContext';
