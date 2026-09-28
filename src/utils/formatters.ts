/**
 * Utility fungsi piawai untuk format nombor, mata wang (RM), metrik (Tan/Hektar), dan tarikh.
 * Standardized formatters for Malaysian locale (ms-MY).
 */

export const MALAY_MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun", 
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

export const MALAY_MONTHS_SHORT = [
  "Jan", "Feb", "Mac", "Apr", "Mei", "Jun", 
  "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"
];

/**
 * Format nombor angka berstruktur (cth: 1,234.56)
 */
export function formatNumber(
  value: number | string | null | undefined, 
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === '') return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  
  return new Intl.NumberFormat('ms-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format Ringgit Malaysia (cth: RM 1,234.50 atau 1,234.50)
 */
export function formatRM(
  value: number | string | null | undefined,
  showSymbol: boolean = true
): string {
  const formatted = formatNumber(value, 2);
  return showSymbol ? `RM ${formatted}` : formatted;
}

/**
 * Format Tan Metrik (MT)
 */
export function formatTan(
  value: number | string | null | undefined,
  decimals: number = 2,
  showUnit: boolean = false
): string {
  const formatted = formatNumber(value, decimals);
  return showUnit ? `${formatted} MT` : formatted;
}

/**
 * Format Hektar (Ha)
 */
export function formatHektar(
  value: number | string | null | undefined,
  decimals: number = 2,
  showUnit: boolean = false
): string {
  const formatted = formatNumber(value, decimals);
  return showUnit ? `${formatted} Ha` : formatted;
}

/**
 * Format Peratus (cth: 85.40%)
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals: number = 2
): string {
  const formatted = formatNumber(value, decimals);
  return `${formatted}%`;
}

/**
 * Tukar nombor bulan (1-12) atau string ("01"-"12") kepada nama bulan Bahasa Melayu
 */
export function getMalayMonthName(
  month: number | string,
  short: boolean = false
): string {
  let monthIdx = -1;
  if (typeof month === 'number') {
    monthIdx = month - 1;
  } else if (typeof month === 'string') {
    const parsed = parseInt(month, 10);
    if (!isNaN(parsed)) {
      monthIdx = parsed - 1;
    } else {
      // jika string seperti "Jan", "Feb"
      const lower = month.toLowerCase();
      monthIdx = MALAY_MONTHS_SHORT.findIndex(m => m.toLowerCase().startsWith(lower.slice(0, 3)));
    }
  }

  const monthsArray = short ? MALAY_MONTHS_SHORT : MALAY_MONTHS;
  if (monthIdx >= 0 && monthIdx < monthsArray.length) {
    return monthsArray[monthIdx];
  }
  return String(month);
}

/**
 * Format tarikh standard Bahasa Melayu (cth: "29 Ogos 2026", "29/08/2026")
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  formatType: 'full' | 'short' | 'iso' | 'monthYear' = 'full'
): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const monthNum = d.getMonth() + 1;
  const monthStr = String(monthNum).padStart(2, '0');
  const year = d.getFullYear();

  if (formatType === 'iso') {
    return `${year}-${monthStr}-${day}`;
  }
  if (formatType === 'short') {
    return `${day}/${monthStr}/${year}`;
  }
  if (formatType === 'monthYear') {
    return `${getMalayMonthName(monthNum)} ${year}`;
  }
  
  // full default
  return `${d.getDate()} ${getMalayMonthName(monthNum)} ${year}`;
}

export const MALAY_DAYS = [
  "Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"
];

/**
 * Dapatkan rentetan tarikh hari ini dalam format YYYY-MM-DD mengikut waktu Malaysia (Asia/Kuala_Lumpur)
 */
export function getTodayDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (_) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Menormalkan pelbagai format tarikh (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, dsb.) kepada format piawai YYYY-MM-DD
 */
export function normalizeDateToISO(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return getTodayDateString();
  const trimmed = dateStr.trim().split('T')[0].split(' ')[0]; // Strip time if attached
  
  // Format DD/MM/YYYY atau DD-MM-YYYY (4-digit year)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format DD/MM/YY atau DD-MM-YY (2-digit year cth: 03/09/26)
  const dmy2Match = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, '0');
    const month = dmy2Match[2].padStart(2, '0');
    const shortYear = parseInt(dmy2Match[3], 10);
    const fullYear = shortYear > 50 ? `19${shortYear}` : `20${shortYear.toString().padStart(2, '0')}`;
    return `${fullYear}-${month}-${day}`;
  }
  
  // Format YYYY/MM/DD atau YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format dengan nama bulan (cth: "03-Sep-2026", "3 Ogos 2026", "3 September 2026")
  const textMonthMatch = dateStr.trim().match(/^(\d{1,2})[\s\-\/]([a-zA-Z]+)[\s\-\/](\d{2,4})$/);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const rawMonth = textMonthMatch[2].toLowerCase();
    const rawYear = textMonthMatch[3];
    const fullYear = rawYear.length === 2 
      ? (parseInt(rawYear, 10) > 50 ? `19${rawYear}` : `20${rawYear}`) 
      : rawYear;

    const monthMap: { [key: string]: string } = {
      jan: '01', januari: '01', january: '01',
      feb: '02', februari: '02', february: '02',
      mac: '03', mar: '03', march: '03',
      apr: '04', april: '04',
      mei: '05', may: '05',
      jun: '06', june: '06',
      jul: '07', julai: '07', july: '07',
      ogo: '08', ogos: '08', aug: '08', august: '08',
      sep: '09', september: '09',
      okt: '10', oktober: '10', oct: '10', october: '10',
      nov: '11', november: '11',
      dis: '12', disember: '12', dec: '12', december: '12',
    };

    const foundMonth = monthMap[rawMonth] || Object.keys(monthMap).find(k => rawMonth.startsWith(k)) && monthMap[Object.keys(monthMap).find(k => rawMonth.startsWith(k))!];
    if (foundMonth) {
      return `${fullYear}-${foundMonth}-${day}`;
    }
  }
  
  // Fallback jika boleh diparsing oleh Date object
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return trimmed;
}

/**
 * Kira perbezaan hari antara tarikh sasaran dengan tarikh hari ini.
 * Nilai positif (>0) = Tarikh masa hadapan (Future date)
 * Nilai negatif (<0) = Tarikh masa lampau (Past date)
 * Nilai sifar (0) = Tarikh hari ini (Today)
 */
export function getDaysDifferenceFromToday(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const isoStr = normalizeDateToISO(dateStr);
  const parts = isoStr.split('-');
  if (parts.length !== 3) return 0;
  
  const targetYear = parseInt(parts[0], 10);
  const targetMonth = parseInt(parts[1], 10) - 1;
  const targetDay = parseInt(parts[2], 10);
  
  const targetDate = new Date(targetYear, targetMonth, targetDay);
  if (isNaN(targetDate.getTime())) return 0;
  
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = targetDate.getTime() - todayDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format tarikh lengkap berserta nama hari dalam Bahasa Melayu (cth: "Khamis, 3 September 2026")
 */
export function formatDateWithDay(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const iso = typeof dateInput === 'string' ? normalizeDateToISO(dateInput) : '';
  const d = typeof dateInput === 'string' && iso ? new Date(iso + 'T00:00:00') : (typeof dateInput === 'object' ? dateInput : new Date(dateInput as any));
  if (isNaN(d.getTime())) return '-';

  const dayName = MALAY_DAYS[d.getDay()] || '';
  const day = d.getDate();
  const monthNum = d.getMonth() + 1;
  const year = d.getFullYear();

  return `${dayName}, ${day} ${getMalayMonthName(monthNum)} ${year}`;
}

/**
 * Membersihkan dan mengekstrak kod blok standard.
 * PERHATIAN DOMAIN INDUSTRI SAWIT:
 * Pada resit FGV / FPM, kod akaun siri seperti "5136-020-6-06" mengandungi:
 * - Kod Projek/Ladang di permulaan (5136 = FPM Adela)
 * - Kod Blok di HUJUNG SEKALI (06 = Blok 6)
 * Baris seperti "5-FELDA ADELA" mengandungi digit kod syarikat/pembekal (iaitu 5), BUKAN nombor blok.
 */
export function cleanAndExtractBlockCode(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim().toUpperCase();
  if (!s) return '';

  // 1. Kesan kod akaun siri BTS FGV: cth "5136-020-6-06", "5156-115-Y-09", "5136-020-6-06 SKB: 1000"
  // Format: [Kod Ladang 4 digit]-[Peringkat]-[Kategori]-[Blok]
  // Digit di hujung sekali selepas tanda tolak terakhir adalah nombor blok sebenar (cth: "06")!
  const btsMatch = s.match(/\b\d{4}(?:-[0-9A-Z]+)+-([0-9]{1,3}[A-Z]?)\b/);
  if (btsMatch) {
    return btsMatch[1];
  }

  // 1b. Kesan format Peringkat dan Blok cth: "P2-01", "P2-1", "PKT 2-1", "PKT 2 BLOK 1", "P1-05"
  const pMatch = s.match(/^(?:P(?:KT)?\s*([12]))\s*[-:\s]\s*(?:BLOK\s*[-:]?\s*)?([0-9]{1,3}[A-Z]?)/i);
  if (pMatch) {
    return `P${pMatch[1]}-${pMatch[2]}`;
  }

  // 1c. Kesan format Lot Felda cth: "88F", "88 F", "F88", "5136 001 88 F", "5136-001-88-F"
  if (/\b(?:5136[-\s]+001[-\s]+(?:(?:3|88)[-\s]+)?(?:88\s*F|88|F88)|88\s*F|F\s*88)\b/i.test(s) || s === '88F' || s === '88 F' || s === 'F88') {
    return '88F';
  }

  // 2. Buang awalan "BLOK", "BLOCK", "B-" jika ada
  s = s.replace(/^(?:BLOK|BLOCK|B)\s*[-:]?\s*/i, '').trim();

  // 3. Jika teks mengandungi format syarikat/ladang seperti "5-FELDA ADELA", "5 - FELDA ADELA", atau nama ladang:
  // Digit di hadapan nama ladang/syarikat (cth: "5") adalah KOD SYARIKAT/PEMBEKAL, BUKAN kod blok!
  // Jangan sekali-kali pulangkan angka kod syarikat ini sebagai blok.
  if (/^[0-9]{1,3}\s*[-/ ]\s*(?:FELDA|LADANG|FPM|RANCANGAN|ADELA|TUNGGAL|KLEDANG|SENING)/i.test(s) || /(?:FELDA|LADANG|RANCANGAN)/i.test(s)) {
    return '';
  }

  // 4. Corak kod blok yang sah (cth "06", "6", "04B", "1F", "125Y", "128Y", "121V", "LF")
  const validSingleBlock = s.match(/^([0-9]{1,3}[A-Z]?|[1-9][A-Z]?|LF)$/i);
  if (validSingleBlock) {
    return validSingleBlock[1];
  }

  // 5. Sekiranya ada aksara tambahan di belakang nombor blok yang bersih
  const blockStartMatch = s.match(/^([0-9]{1,3}[A-Z]?)/);
  if (blockStartMatch && blockStartMatch[1]) {
    return blockStartMatch[1];
  }

  return s;
}

/**
 * Mengekstrak butiran lengkap daripada kod akaun bersiri BTS FGV (cth: "5136-010-3-03 SKB: 1000", "5136-020-4-04")
 * Format siri: [KOD_LADANG]-[KOD_PERINGKAT]-[KATEGORI]-[BLOK]
 * 
 * Pemetaan Khusus FPM ADELA (5136):
 * - "010" -> Peringkat 1 (PKT 001) Blok 1 - 9
 * - "011" -> Peringkat 1 (PKT 001) Blok 10 - 11
 * - "020" -> Peringkat 2 (PKT 002) Blok 1 - 6
 * - "001" -> Lot Felda / 88F (LOT FELDA)
 * - "125Y" / "1254" / "128Y" / "121V" -> Peringkat Tambahan (PKT 004)
 */
export function extractBtsSerialDetails(raw: string | null | undefined): {
  projectCode?: string;
  subCode?: string;
  peringkat?: string;
  blok?: string;
  rawSerial?: string;
  isAdela?: boolean;
} | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  const match = s.match(/\b(\d{4})[- ]([0-9A-Z]+)[- ]([0-9A-Z]+)[- ]([0-9]{1,3}[A-Z]?)\b/);
  if (!match) return null;

  const projectCode = match[1];
  const pktCode = match[2];
  const blockRaw = match[4];
  const bNum = parseInt(blockRaw, 10);
  const cleanBlok = isNaN(bNum) ? blockRaw : String(bNum);
  const isAdela = projectCode === '5136';

  let peringkat = "PKT 001";
  let resolvedBlok = cleanBlok;

  if (isAdela) {
    if (pktCode === "010") {
      peringkat = "PKT 001"; // Blok 1 - 9
      resolvedBlok = cleanBlok;
    } else if (pktCode === "011") {
      peringkat = "PKT 001"; // Blok 10 - 11
      resolvedBlok = cleanBlok;
    } else if (pktCode === "020") {
      peringkat = "PKT 002"; // Blok 1 - 6
      resolvedBlok = cleanBlok;
    } else if (pktCode === "001" || pktCode.includes("001") || s.includes("88 F") || s.includes("88F") || s.includes("F88") || cleanBlok === "88" || cleanBlok === "88F") {
      peringkat = "LOT FELDA"; // 88F - Lot Felda
      resolvedBlok = "88F";
    } else if (pktCode === "125Y" || pktCode === "1254" || pktCode === "128Y" || pktCode === "121V") {
      peringkat = "PKT 004"; // Peringkat Tambahan
      resolvedBlok = pktCode;
    }
  } else {
    if (pktCode === "020" || pktCode.includes("020")) {
      peringkat = "PKT 002";
    } else if (pktCode === "010" || pktCode.includes("010") || pktCode === "001") {
      peringkat = "PKT 001";
    }
  }

  return {
    projectCode,
    subCode: pktCode,
    peringkat,
    blok: resolvedBlok,
    rawSerial: match[0],
    isAdela,
  };
}


