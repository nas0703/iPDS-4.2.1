/**
 * Utiliti Suara & Fonetik (Speech Synthesis TTS & STT) Bahasa Melayu
 * Mengandungi Kamus Singkatan Pintar (Acronym Expander) untuk sebutan penuh istilah ladang,
 * serta pemilihan enjin suara Neural/Natural untuk intonasi percakapan seperti Native Speaker.
 */

// Kamus Singkatan & Unit Rasmi Perladangan & Korporat
export const DEFAULT_ACRONYM_DICTIONARY: Record<string, string> = {
  // Unit & Sukatan
  'm/t': 'metrik tan',
  'M/t': 'metrik tan',
  'mt': 'metrik tan',
  'MT': 'metrik tan',
  't/ha': 'tan per hektar',
  'tan/ha': 'tan per hektar',
  'ha': 'hektar',
  'Ha': 'hektar',
  'kg': 'kilogram',
  'Kg': 'kilogram',
  'RM': 'Ringgit Malaysia',
  'rm': 'Ringgit Malaysia',
  '%': ' peratus',

  // Tempoh Masa & Analisis Korporat
  'YTD': 'Year to date, terkumpul tahun ini',
  'ytd': 'Year to date',
  'MTD': 'Month to date, terkumpul bulan ini',
  'mtd': 'Month to date',

  // Istilah Operasi Sawit & Kualiti
  'BTS': 'B T S, Buah Tandan Segar',
  'bts': 'Buah Tandan Segar',
  'KPG = KPA': 'K P G sama dengan K P A',
  'KPG=KPA': 'K P G sama dengan K P A',
  'KPG': 'K P G',
  'KPA': 'K P A',
  'ABW': 'A B W, Purata Berat Tandan',
  'BTP': 'Berat Tandan Purata',
  'OER': 'O E R, Kadar Perahan Minyak',
  'EFB': 'E F B, Tandan Kosong',
  
  // Dokumen & SOP Manual
  'KUK Siri 8': 'Buku Kadar Upah Kerja Siri lapan',
  'KUK': 'Kadar Upah Kerja',
  'MSL': 'Manual Sawit Lestari',
  'Manual Perolehan 2023 Pind. 2025': 'Manual Perolehan dua ribu dua puluh tiga, pindaan dua ribu dua puluh lima',
  'Manual Perolehan 2023': 'Manual Perolehan dua ribu dua puluh tiga',
  'Pind. 2025': 'Pindaan dua ribu dua puluh lima',
  'GAP': 'Amalan Pertanian Baik, G A P',
  'MSPO': 'M S P O, Pensijilan Minyak Sawit Mampan Malaysia',
  'IPM': 'Pengurusan Perosak Bersepadu, I P M',
  'LPO': 'L P O, Pesanan Belian Tempatan',
  'GRN': 'G R N, Goods Received Note, Nota Terima Barangan',
  'DO': 'D O, Delivery Order, Nota Hantaran',
  'WJP': 'Wang Jaminan Pelaksanaan',
  'DLP': 'Tempoh Liabiliti Kecacatan',
  'CPC': 'Sijil Siap Kerja',
  'CIDB': 'C I D B',

  // Jawatan & Sektor
  'FC': 'Field Controller',
  'PF': 'Pengurus Felda',
  'AFC': 'Assistant Field Controller',
  'FS': 'Field Supervisor',
  'EQI': 'Estate Quality Inspector',
  'PKT 1': 'Peringkat satu',
  'PKT 2': 'Peringkat dua',
  'PKT': 'Peringkat',
  'pkt': 'Peringkat',

  // Bahan Baja & Program 4T
  'MOP': 'M O P, Muriate of Potash',
  'NPK': 'N P K',
  'RP': 'Rock Phosphate',
  'P1': 'Pusingan satu',
  'P2': 'Pusingan dua',
  'P3': 'Pusingan tiga',
  'P4': 'Pusingan empat',

  // Singkatan Teks Umum
  'M/S': 'muka surat',
  'm/s': 'muka surat',
  'ms': 'muka surat',
  'No.': 'Nombor',
  'no.': 'Nombor',
  'cth:': 'contohnya,',
  'cth': 'contohnya',
  'dsb.': 'dan sebagainya.',
  'dsb': 'dan sebagainya',
  'dll.': 'dan lain-lain.',
  'dll': 'dan lain-lain'
};

import { safeStorage } from './safeStorage';

const STORAGE_CUSTOM_ACRONYMS_KEY = 'fpmsb_custom_speech_acronyms_v1';

// Dapatkan kamus gabungan (Lalai + Kustom Pengguna)
export function getActiveAcronymDictionary(): Record<string, string> {
  const custom = safeStorage.getJSON<Record<string, string>>(STORAGE_CUSTOM_ACRONYMS_KEY, {});
  return { ...DEFAULT_ACRONYM_DICTIONARY, ...(custom || {}) };
}

// Simpan atau kemaskini sebutan singkatan kustom
export function saveCustomAcronym(shortForm: string, fullSpokenText: string) {
  if (!shortForm.trim()) return;
  const current = safeStorage.getJSON<Record<string, string>>(STORAGE_CUSTOM_ACRONYMS_KEY, {});
  current[shortForm.trim()] = fullSpokenText.trim();
  safeStorage.setJSON(STORAGE_CUSTOM_ACRONYMS_KEY, current);
}

// Tukar teks bertulis kepada sebutan penuh yang lancar dan natural untuk didengar
export function expandAcronymsForSpeech(text: string, customDict?: Record<string, string>): string {
  if (!text) return '';
  const dict = customDict || getActiveAcronymDictionary();

  let expanded = text;

  // 1. Gantikan frasa kompaun khas & kod blok dahulu
  expanded = expanded
    .replace(/\bB(\d+)\b/gi, 'Blok $1')
    .replace(/\bB\s+(\d+)\b/gi, 'Blok $1')
    .replace(/\bKPG\s*=\s*KPA\b/gi, 'K P G sama dengan K P A')
    .replace(/\bt\/ha\b/gi, ' tan per hektar')
    .replace(/\bM\/t\b/gi, ' metrik tan')
    .replace(/\bm\/t\b/gi, ' metrik tan')
    .replace(/\bM\/S\b/gi, ' muka surat ')
    .replace(/\bm\/s\b/gi, ' muka surat ');

  // 2. Padankan singkatan berdasarkan sempadan perkataan (Word Boundaries)
  // Susun kunci daripada yang paling panjang ke paling pendek untuk elak salah ganti
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const replacement = dict[key];
    if (!replacement) continue;

    // Abaikan gantian jika sudah diganti
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Gunakan regex sempadan perkataan (\b) jika alphanumeric
    const isAlphaNum = /^[a-zA-Z0-9]+$/.test(key);
    const regex = isAlphaNum 
      ? new RegExp(`\\b${escapedKey}\\b`, 'g') 
      : new RegExp(escapedKey, 'g');

    expanded = expanded.replace(regex, ` ${replacement} `);
  }

  // 3. Formatkan simbol dan nombor untuk intonasi perbualan semula jadi
  expanded = expanded
    .replace(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/g, '$1 haribulan $2 $3')
    .replace(/[-—–]/g, ' ')
    .replace(/±\s*(\d+)/g, 'lebih kurang $1')
    .replace(/~\s*(\d+)/g, 'anggaran $1')
    .replace(/\s+/g, ' ')
    .trim();

  return expanded;
}

// Cari suara Bahasa Melayu / Nusantara berkualiti tinggi (Natural / Neural priority)
export function getBestMalayVoice(voices?: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const list = voices && voices.length > 0 ? voices : window.speechSynthesis.getVoices();
  if (!list || list.length === 0) return null;

  // 1. Keutamaan Pertama: Suara Natural / Neural Bahasa Melayu (ms-MY)
  const naturalMs = list.find(v => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    const isMalay = lang === 'ms-my' || lang === 'ms' || lang.startsWith('ms-') || name.includes('malay');
    const isNatural = name.includes('natural') || name.includes('online') || name.includes('neural') || name.includes('yasmin') || name.includes('osmin');
    return isMalay && isNatural;
  });
  if (naturalMs) return naturalMs;

  // 2. Keutamaan Kedua: Suara Rasmi Bahasa Melayu (ms-MY / ms / zlm / Google Bahasa Melayu)
  const msExact = list.find(v => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    return (
      lang === 'ms-my' || 
      lang === 'ms' || 
      lang.startsWith('ms-') ||
      name.includes('bahasa melayu') ||
      name.includes('malay (malaysia)') ||
      name.includes('yasmin') ||
      name.includes('osmin') ||
      name.includes('google bahasa melayu')
    );
  });
  if (msExact) return msExact;

  // 3. Keutamaan Ketiga: Suara Natural / Neural Bahasa Indonesia (id-ID) - Fonetik Nusantara sangat sedap didengar
  const naturalId = list.find(v => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    const isIndo = lang === 'id-id' || lang === 'id' || lang.startsWith('id-') || name.includes('indonesia');
    const isNatural = name.includes('natural') || name.includes('online') || name.includes('neural') || name.includes('gadis') || name.includes('ardi');
    return isIndo && isNatural;
  });
  if (naturalId) return naturalId;

  // 4. Keutamaan Keempat: Suara Bahasa Indonesia standard
  const idVoice = list.find(v => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    return (
      lang === 'id-id' || 
      lang === 'id' || 
      lang.startsWith('id-') ||
      name.includes('indonesia') ||
      name.includes('gadis') ||
      name.includes('ardi')
    );
  });
  if (idVoice) return idVoice;

  // 5. Default sistem
  return list[0] || null;
}

// Bersihkan teks daripada simbol Markdown, jadual, dan gantikan singkatan secara automatik
export function sanitizeMalaySpeechText(text: string): string {
  if (!text) return '';
  
  // 1. Padamkan format markdown & simbol visual
  let cleaned = text
    .replace(/[━═─-]{3,}/g, '. ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*#_`~>]/g, ' ')
    .replace(/\[.*?\]/g, '')
    .replace(/🥇|🥈|🥉/g, '')
    .replace(/🏛️|📊|🌴|⚠️|🥭|🎯|🌱|🧠|⚡|🟢|🟡|🔴|📈|📌|👉|💵|✂️|🚛|💰|📋|🏆|💡/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/-{3,}/g, ' ');

  // 2. Kembangkan semua singkatan (M/t -> metrik tan, YTD -> Year to date, ha -> hektar, dll)
  cleaned = expandAcronymsForSpeech(cleaned);

  // 3. Bersihkan jarak berlebihan
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Mainkan audio Text-to-Speech dalam Bahasa Melayu dengan jeda intonasi optimum
export function speakMalayText(
  text: string, 
  options?: {
    rate?: number;
    pitch?: number;
    voice?: SpeechSynthesisVoice | null;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  try {
    window.speechSynthesis.cancel();
    const cleanText = sanitizeMalaySpeechText(text);
    if (!cleanText) return null;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ms-MY';
    utterance.rate = options?.rate ?? 0.95; // 0.95 adalah kelajuan emas untuk intonasi native speaker
    utterance.pitch = options?.pitch ?? 1.0;

    const bestVoice = options?.voice || getBestMalayVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
      if (bestVoice.lang) utterance.lang = bestVoice.lang;
    }

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = options.onError;

    // Failsafe simpan rujukan ke window bagi mengelakkan Garbage Collection pelayar
    (window as any).__currentMalaySpeechUtterance = utterance;

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.error('Ralat speakMalayText:', err);
    if (options?.onError) options.onError(err);
    return null;
  }
}

