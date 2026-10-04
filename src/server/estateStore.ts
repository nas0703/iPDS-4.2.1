import fs from 'fs';
import path from 'path';
import { normalizeEstateId } from '../config/estateRegistry.js';

let DATA_DIR = path.join(process.cwd(), 'data');
if (process.env.VERCEL || process.env.NOW_REGION) {
  DATA_DIR = '/tmp';
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (_) {}

const ESTATE_MAP_FILE = path.join(DATA_DIR, 'receipt_estate_map.json');

// In-memory cache for fast lookup
let estateMap: Record<string, string> = {};

// Load persistent map from disk
function loadMap() {
  if (fs.existsSync(ESTATE_MAP_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ESTATE_MAP_FILE, 'utf-8'));
      if (data && typeof data === 'object') {
        estateMap = { ...estateMap, ...data };
      }
    } catch (e) {
      console.warn("Could not read receipt_estate_map:", e);
    }
  }
}

// Save map to disk
function saveMap() {
  try {
    fs.writeFileSync(ESTATE_MAP_FILE, JSON.stringify(estateMap, null, 2), 'utf-8');
  } catch (e) {
    console.warn("Could not save receipt_estate_map:", e);
  }
}

// Initial load
loadMap();

export function setReceiptEstate(noResit: string, estateId: string) {
  if (!noResit) return;
  const key = String(noResit).trim().toUpperCase();
  const normalizedEstate = estateId?.trim().toUpperCase() || 'FPM_TUNGGAL';
  estateMap[key] = normalizedEstate;
  saveMap();
}

export function getReceiptEstate(record: any): string {
  if (!record) return 'FPM_TUNGGAL';

  const noResit = String(record.no_resit || '').trim().toUpperCase();
  const nota = String(record.no_nota_hantaran || '').trim();
  const kodPenjual = String(record.kod_penjual || '').trim();
  const namaPenjual = String(record.nama_penjual || '').toUpperCase();
  const noAkaun = String(record.no_akaun_terima || '').toUpperCase();
  const blok = String(record.blok || '').trim().toUpperCase();

  // 1. Strict metadata check FIRST (overrides misclassified rawEstate)
  // Tunggal: 155 / 5155
  if (
    nota.startsWith('155') || 
    nota.startsWith('5155') || 
    kodPenjual.startsWith('5155') || 
    kodPenjual.includes('5155') || 
    namaPenjual.includes('TUNGGAL') || 
    noAkaun.includes('TUNGGAL') || 
    noResit.includes('TGL') || 
    noResit.includes('TUNGGAL') ||
    noResit.startsWith('TGL-')
  ) {
    return 'FPM_TUNGGAL';
  }

  // Adela: 136 / 5136
  if (
    nota.startsWith('136') || 
    nota.startsWith('5136') || 
    kodPenjual.startsWith('5136') || 
    kodPenjual.includes('5136') || 
    namaPenjual.includes('ADELA') || 
    noAkaun.includes('ADELA') || 
    noResit.includes('ADL') || 
    noResit.includes('ADELA') ||
    noResit.startsWith('ADL-') ||
    ['1F', '2F', '125Y', '128Y', '121V'].includes(blok)
  ) {
    return 'FPM_ADELA';
  }

  // Kledang: 176 / 5176
  if (
    nota.startsWith('176') || 
    nota.startsWith('5176') || 
    kodPenjual.startsWith('5176') || 
    kodPenjual.includes('5176') || 
    namaPenjual.includes('KLEDANG') || 
    noAkaun.includes('KLEDANG') || 
    noResit.includes('KLD') || 
    noResit.includes('KLEDANG') ||
    noResit.startsWith('KLD-')
  ) {
    return 'FPM_KLEDANG';
  }

  // Sening: 156 / 5156
  if (
    nota.startsWith('156') || 
    nota.startsWith('5156') || 
    kodPenjual.startsWith('5156') || 
    kodPenjual.includes('5156') || 
    namaPenjual.includes('SENING') || 
    noAkaun.includes('SENING') || 
    noResit.includes('SNG') || 
    noResit.includes('SENING') ||
    noResit.startsWith('SNG-')
  ) {
    return 'FPM_SENING';
  }

  // 2. Lookup in persistent receipt -> estate map
  if (noResit && estateMap[noResit]) {
    return estateMap[noResit];
  }

  // 3. Explicit estate_id in record object
  const rawEstate = String(record.estate_id || '').trim().toUpperCase();
  if (rawEstate) {
    const normalized = normalizeEstateId(rawEstate);
    if (normalized) return normalized;
    if (rawEstate === 'FPM_ADELA' || rawEstate === 'ADELA' || rawEstate === 'ADL' || rawEstate === '5136') return 'FPM_ADELA';
    if (rawEstate === 'FPM_KLEDANG' || rawEstate === 'KLEDANG' || rawEstate === 'KLD' || rawEstate === '5176') return 'FPM_KLEDANG';
    if (rawEstate === 'FPM_SENING' || rawEstate === 'SENING' || rawEstate === 'SNG' || rawEstate === '5156') return 'FPM_SENING';
    if (rawEstate === 'FPM_TUNGGAL' || rawEstate === 'TUNGGAL' || rawEstate === 'TGL' || rawEstate === '5155') return 'FPM_TUNGGAL';
    return rawEstate;
  }

  return 'FPM_TUNGGAL';
}

export function getAllEstateMappings(): Record<string, string> {
  return { ...estateMap };
}
