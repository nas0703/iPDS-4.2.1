import fs from 'fs';
import path from 'path';

function getUUID(): string {
  // Pure JavaScript UUID v4 generator (no crypto dependency to prevent Vercel crashes)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let DATA_DIR = path.join(process.cwd(), 'data');

if (process.env.VERCEL || process.env.NOW_REGION) {
  DATA_DIR = '/tmp'; // Use /tmp for serverless environments
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Could not create local data directory, running in-memory or readonly fallback:", err);
}

let HANTARAN_FILE = path.join(DATA_DIR, 'hantaran.json');
let MERUMPUT_PROGRESS_FILE = path.join(DATA_DIR, 'merumput_progress.json');
let MERUMPUT_INVENTORY_FILE = path.join(DATA_DIR, 'merumput_inventory.json');
let MERUMPUT_TRANSACTIONS_FILE = path.join(DATA_DIR, 'merumput_transactions.json');

// Re-assign for Vercel just in case
if (process.env.VERCEL) {
  HANTARAN_FILE = path.join(DATA_DIR, 'hantaran.json');
  MERUMPUT_PROGRESS_FILE = path.join(DATA_DIR, 'merumput_progress.json');
  MERUMPUT_INVENTORY_FILE = path.join(DATA_DIR, 'merumput_inventory.json');
  MERUMPUT_TRANSACTIONS_FILE = path.join(DATA_DIR, 'merumput_transactions.json');
}

export function getLocalHantaran() {
  if (fs.existsSync(HANTARAN_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HANTARAN_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading hantaran file", e);
    }
  }
  return [];
}

export function saveLocalHantaran(data: any[]) {
  try {
    fs.writeFileSync(HANTARAN_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing hantaran file", e);
  }
}

export function getInitialSeedData(estateId: string = 'FPM_TUNGGAL') {
  const seed: any[] = [];

  if (estateId === 'FPM_ADELA') {
    const adelaBlocks = [
      // Pkt 1 (Blok 1 - 11, Total 613.64 Ha)
      { blok: "1", luas: 30.46 },
      { blok: "2", luas: 58.07 },
      { blok: "3", luas: 45.91 },
      { blok: "4", luas: 57.89 },
      { blok: "5", luas: 60.05 },
      { blok: "6", luas: 64.64 },
      { blok: "7", luas: 68.17 },
      { blok: "8", luas: 77.53 },
      { blok: "9", luas: 64.04 },
      { blok: "10", luas: 63.01 },
      { blok: "11", luas: 23.87 },
      // Pkt 2 (Blok 12 - 17, Total 333.42 Ha)
      { blok: "12", luas: 59.93 },
      { blok: "13", luas: 60.47 },
      { blok: "14", luas: 40.40 },
      { blok: "15", luas: 48.41 },
      { blok: "16", luas: 67.76 },
      { blok: "17", luas: 56.45 },
      // Lot FELDA (Total 78.04 Ha)
      { blok: "1F", luas: 39.81 },
      { blok: "2F", luas: 38.23 },
      // Lot Tambahan (Total 16.12 Ha)
      { blok: "125Y", luas: 8.06 },
      { blok: "128Y", luas: 4.04 },
      { blok: "121V", luas: 4.02 },
    ];

    adelaBlocks.forEach(({ blok, luas }) => {
      // PUS 1
      seed.push({ id: getUUID(), blok, luas, pusingan: 1, jenis: "BULATAN & LORONG", tarikh_mula: "2026-05-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_ADELA', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      seed.push({ id: getUUID(), blok, luas, pusingan: 1, jenis: "DADA (R&S)", tarikh_mula: "2026-05-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_ADELA', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

      // PUS 2
      seed.push({ id: getUUID(), blok, luas, pusingan: 2, jenis: "BULATAN & LORONG", tarikh_mula: "2026-08-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_ADELA', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      seed.push({ id: getUUID(), blok, luas, pusingan: 2, jenis: "DADA (R&S)", tarikh_mula: "2026-08-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_ADELA', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    });

    return seed;
  }

  const tunggalBlocks = [
    { blok: "1", luas: 72.15 }, { blok: "2", luas: 68.37 }, { blok: "3", luas: 76.59 },
    { blok: "4", luas: 92.39 }, { blok: "5", luas: 60.19 }, { blok: "6", luas: 80.42 },
    { blok: "7", luas: 89.46 }, { blok: "8", luas: 82.03 }, { blok: "9", luas: 83.61 },
    { blok: "10", luas: 84.36 }, { blok: "11", luas: 47.85 }, { blok: "12", luas: 76.50 },
    { blok: "13", luas: 50.75 }, { blok: "14", luas: 70.44 }, { blok: "15", luas: 68.36 },
    { blok: "16", luas: 64.44 }, { blok: "17", luas: 84.08 }, { blok: "18", luas: 76.20 },
    { blok: "19", luas: 81.75 }, { blok: "20", luas: 68.62 }, { blok: "21", luas: 24.26 },
    { blok: "22", luas: 65.29 }, { blok: "LF", luas: 98.51 }
  ];

  tunggalBlocks.forEach(({ blok, luas }) => {
    // PUS 1
    seed.push({ id: getUUID(), blok, luas, pusingan: 1, jenis: "BULATAN & LORONG", tarikh_mula: "2026-05-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_TUNGGAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    seed.push({ id: getUUID(), blok, luas, pusingan: 1, jenis: "DADA (R&S)", tarikh_mula: "2026-05-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_TUNGGAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

    // PUS 2
    seed.push({ id: getUUID(), blok, luas, pusingan: 2, jenis: "BULATAN & LORONG", tarikh_mula: "2026-08-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_TUNGGAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    seed.push({ id: getUUID(), blok, luas, pusingan: 2, jenis: "DADA (R&S)", tarikh_mula: "2026-08-01", tarikh_siap: null, hek_siap: 0, workers_count: 0, estate_id: 'FPM_TUNGGAL', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  });
  return seed;
}

export function getLocalMerumputProgress(estateId: string = 'FPM_TUNGGAL') {
  if (fs.existsSync(MERUMPUT_PROGRESS_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(MERUMPUT_PROGRESS_FILE, 'utf-8'));
      if (stored && Array.isArray(stored) && stored.length > 0) {
        // Migration: Ensure LF has "2026-01-10" instead of older date to reflect overdue
        let isModified = false;
        const migrated = stored.map((item: any) => {
          if (item.blok === "LF" && item.pusingan === 1 && item.jenis === "BULATAN & LORONG" && item.tarikh_mula === "2026-02-05") {
            isModified = true;
            return {
              ...item,
              tarikh_mula: "2026-01-10",
              tarikh_siap: "2026-01-10",
              updated_at: new Date().toISOString()
            };
          }
          return item;
        });
        if (isModified) {
          saveLocalMerumputProgress(migrated);
          return migrated;
        }

        // Check if records for requested estate exist
        const hasEstateRecords = stored.some((item: any) => 
          estateId === 'FPM_TUNGGAL' ? (!item.estate_id || item.estate_id === 'FPM_TUNGGAL') : item.estate_id === estateId
        );
        if (!hasEstateRecords) {
          const newEstateSeed = getInitialSeedData(estateId);
          const combined = [...stored, ...newEstateSeed];
          saveLocalMerumputProgress(combined);
          return combined;
        }

        return stored;
      }
    } catch (e) {
      console.error("Error reading merumput data", e);
    }
  }
  
  const initial = [...getInitialSeedData('FPM_TUNGGAL'), ...getInitialSeedData('FPM_ADELA')];
  saveLocalMerumputProgress(initial);
  return initial;
}

export function saveLocalMerumputProgress(data: any[]) {
  try {
    fs.writeFileSync(MERUMPUT_PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing merumput data", e);
  }
}

export function getLocalMerumputInventory() {
  if (fs.existsSync(MERUMPUT_INVENTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MERUMPUT_INVENTORY_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading merumput inventory", e);
    }
  }
  const defaultInv = [
    { id: getUUID(), name: "GLYPHOSATE 41%", quantity: 0, unit: "LITER", type: "RACUN" },
    { id: getUUID(), name: "METSULFURON", quantity: 0, unit: "KG", type: "RACUN" }
  ];
  saveLocalMerumputInventory(defaultInv);
  return defaultInv;
}

export function saveLocalMerumputInventory(data: any[]) {
  try {
    fs.writeFileSync(MERUMPUT_INVENTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing merumput inventory", e);
  }
}

export function getLocalMerumputTransactions() {
  if (fs.existsSync(MERUMPUT_TRANSACTIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MERUMPUT_TRANSACTIONS_FILE, 'utf-8'));
    } catch (e) {
      console.error("Error reading merumput transactions", e);
    }
  }
  return [];
}

export function saveLocalMerumputTransactions(data: any[]) {
  try {
    fs.writeFileSync(MERUMPUT_TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing merumput transactions", e);
  }
}

export function getLocalEstateJson(prefix: string, estateId: string = 'FPM_TUNGGAL', defaultValue: any = null) {
  const safeEstate = (estateId || 'FPM_TUNGGAL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(DATA_DIR, `${prefix}_${safeEstate}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`Error reading ${filePath}`, e);
    }
  }
  // Fallback to non-estate file if Tunggal
  if (safeEstate === 'FPM_TUNGGAL') {
    const legacyPath = path.join(DATA_DIR, `${prefix}.json`);
    if (fs.existsSync(legacyPath)) {
      try {
        return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
      } catch (e) {}
    }
  }
  return defaultValue;
}

export function saveLocalEstateJson(prefix: string, estateId: string = 'FPM_TUNGGAL', data: any) {
  try {
    const safeEstate = (estateId || 'FPM_TUNGGAL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(DATA_DIR, `${prefix}_${safeEstate}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    if (safeEstate === 'FPM_TUNGGAL') {
      const legacyPath = path.join(DATA_DIR, `${prefix}.json`);
      fs.writeFileSync(legacyPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error(`Error saving local estate json for ${prefix} (${estateId})`, e);
  }
}

