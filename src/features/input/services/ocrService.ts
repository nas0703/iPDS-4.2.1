import { compressImage } from "../../../utils/compressImage";
import { safeFetch } from "../../../utils/safeFetch";
import { getActiveEstateId, getActiveEstateConfig } from "../../../utils/estateContext";
import { getEstateConfig } from "../../../config/estateRegistry";

export interface EstateVerificationResult {
  sessionEstateId: string;
  sessionEstateName: string;
  sessionCode: string;
  seller4DigitCode: string;
  sellerName: string;
  detectedEstateId: string;
  detectedEstateName: string;
  detectedCode: string;
  status: 'MATCHED' | 'MISMATCH' | 'CROSS_ESTATE_PERMITTED' | 'UNKNOWN';
  isMatch: boolean;
  message: string;
  step1Session: {
    estateId: string;
    estateName: string;
    code: string;
  };
  step2CodeCheck: {
    code: string;
    matchedEstateId: string | null;
    matchedEstateName: string | null;
  };
  step3NameCheck: {
    sellerName: string;
    matchedEstateId: string | null;
    matchedEstateName: string | null;
  };
}

export interface OCRResult {
  tarikh?: string;
  masa_masuk?: string;
  no_resit?: string;
  no_lori?: string;
  no_nota_hantaran?: string;
  no_akuan_terima?: string;
  no_akaun_terima?: string;
  kpg?: number;
  kpa?: number;
  blok?: string;
  peringkat?: string;
  tan?: number;
  muda?: number;
  no_seal?: string;
  rm_mt?: number;
  is_efb?: boolean;
  kod_penjual?: string;
  nama_penjual?: string;
  kod_projek?: string;
  kod_akaun_bts?: string;
  kod_penjual_4digit?: string;
  detected_estate_id?: string;
  detected_estate_name?: string;
  estate_verification?: EstateVerificationResult;
  confidence: number;
}

const CANONICAL_ESTATE_CODES: Record<string, { estateId: string; estateName: string; code: string }> = {
  '5155': { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal', code: '5155' },
  '5136': { estateId: 'FPM_ADELA', estateName: 'FPM Adela', code: '5136' },
  '5176': { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang', code: '5176' },
  '5156': { estateId: 'FPM_SENING', estateName: 'FPM Sening', code: '5156' },
};

export function detectEstateFromSeller(
  kodPenjual?: string,
  namaPenjual?: string,
  kodProjek?: string,
  noNotaHantaran?: string,
  noResit?: string,
  kodAkaunBts?: string
): { estateId: string; estateName: string; code: string } | null {
  const code = (kodPenjual || '').trim();
  const name = (namaPenjual || '').toUpperCase();
  const proj = (kodProjek || '').trim();
  const nota = (noNotaHantaran || '').trim();
  const akaunBts = (kodAkaunBts || '').trim().toUpperCase();

  // LANGKAH 2: Semak 4 digit pertama pada row Penjual / akaun BTS
  // Contoh: "5155-010-3-03" -> 5155 (Tunggal), "5136-020-4-04" -> 5136 (Adela)
  const projMatch = proj.match(/^\d{4}/) || akaunBts.match(/^\d{4}/) || code.match(/^\d{4}/);
  const fourDigitCode = projMatch ? projMatch[0] : (proj.length >= 4 ? proj.slice(0, 4) : '');

  if (fourDigitCode && CANONICAL_ESTATE_CODES[fourDigitCode]) {
    return CANONICAL_ESTATE_CODES[fourDigitCode];
  }

  // LANGKAH 3: Semak / sahkan nama penjual (FELDA TUNGGAL vs FELDA ADELA vs KLEDANG vs SENING)
  if (name.includes('TUNGGAL')) return CANONICAL_ESTATE_CODES['5155'];
  if (name.includes('ADELA')) return CANONICAL_ESTATE_CODES['5136'];
  if (name.includes('KLEDANG')) return CANONICAL_ESTATE_CODES['5176'];
  if (name.includes('SENING')) return CANONICAL_ESTATE_CODES['5156'];

  // Semak No. Nota Hantaran
  if (nota.startsWith('5155') || nota.startsWith('155')) return CANONICAL_ESTATE_CODES['5155'];
  if (nota.startsWith('5136') || nota.startsWith('136')) return CANONICAL_ESTATE_CODES['5136'];
  if (nota.startsWith('5176') || nota.startsWith('176')) return CANONICAL_ESTATE_CODES['5176'];
  if (nota.startsWith('5156') || nota.startsWith('156')) return CANONICAL_ESTATE_CODES['5156'];

  return null;
}

/**
 * 3-Langkah Pengesahan Ladang Resit (Session -> 4-Digit Row Penjual -> Nama Penjual)
 * 1. Semak sesi pengguna login (Tunggal vs Adela dll)
 * 2. Semak 4 digit pertama row Penjual (5155 vs 5136 dll)
 * 3. Verify nama penjual (FELDA TUNGGAL vs FELDA ADELA dll)
 */
export function verifyReceiptEstate(
  sessionEstateId: string,
  ocrData: {
    kod_penjual?: string;
    nama_penjual?: string;
    kod_projek?: string;
    kod_akaun_bts?: string;
    kod_penjual_4digit?: string;
    no_nota_hantaran?: string;
    no_resit?: string;
  }
): EstateVerificationResult {
  const normSession = (sessionEstateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const sessionConfig = getEstateConfig(normSession);
  const sessionCode = normSession === 'FPM_ADELA' ? '5136' :
    normSession === 'FPM_KLEDANG' ? '5176' :
    normSession === 'FPM_SENING' ? '5156' :
    (normSession === 'WILAYAH_JB' || normSession === 'ALL') ? 'WJB' : '5155';

  // LANGKAH 2: 4-digit kod dari baris Penjual
  const candidate4Digit = (ocrData.kod_penjual_4digit || '').trim() ||
    (ocrData.kod_projek || '').trim().slice(0, 4) ||
    ((ocrData.kod_akaun_bts || '').match(/^\d{4}/)?.[0] || '') ||
    ((ocrData.kod_penjual || '').match(/^\d{4}/)?.[0] || '');

  const step2Matched = candidate4Digit && CANONICAL_ESTATE_CODES[candidate4Digit]
    ? CANONICAL_ESTATE_CODES[candidate4Digit]
    : null;

  // LANGKAH 3: Nama Penjual
  const rawSellerName = (ocrData.nama_penjual || '').trim().toUpperCase();
  let step3Matched: { estateId: string; estateName: string; code: string } | null = null;
  if (rawSellerName.includes('TUNGGAL')) step3Matched = CANONICAL_ESTATE_CODES['5155'];
  else if (rawSellerName.includes('ADELA')) step3Matched = CANONICAL_ESTATE_CODES['5136'];
  else if (rawSellerName.includes('KLEDANG')) step3Matched = CANONICAL_ESTATE_CODES['5176'];
  else if (rawSellerName.includes('SENING')) step3Matched = CANONICAL_ESTATE_CODES['5156'];

  const detected = step2Matched || step3Matched || detectEstateFromSeller(
    ocrData.kod_penjual,
    ocrData.nama_penjual,
    ocrData.kod_projek,
    ocrData.no_nota_hantaran,
    ocrData.no_resit,
    ocrData.kod_akaun_bts
  ) || CANONICAL_ESTATE_CODES['5155'];

  const isCrossEstateSession = normSession === 'WILAYAH_JB' || normSession === 'ALL' || normSession === 'WJB' || normSession === '0001';
  const isMatch = isCrossEstateSession || detected.estateId === normSession;

  let status: EstateVerificationResult['status'] = 'MATCHED';
  let message = '';

  if (isCrossEstateSession) {
    status = 'CROSS_ESTATE_PERMITTED';
    message = `🌐 Akses Wilayah / HQ: Resit dikesan untuk ${detected.estateName} (Kod 4-Digit: ${detected.code} | Penjual: ${ocrData.nama_penjual || detected.estateName}).`;
  } else if (isMatch) {
    status = 'MATCHED';
    message = `✅ Pengesahan Ladang Sepadan (3/3): Sesi login [${sessionConfig.name}] sepadan dengan Kod Penjual [${detected.code}] & Nama Penjual [${ocrData.nama_penjual || detected.estateName}].`;
  } else {
    status = 'MISMATCH';
    message = `⛔ SEKATAN PERSEMPADAN LADANG: Sesi aktif anda ialah [${sessionConfig.name}], tetapi resit dikesan milik [${detected.estateName}] (Kod 4-Digit: ${detected.code} | Nama Penjual: ${ocrData.nama_penjual || detected.estateName}). Pemasukan rentas ladang disekat!`;
  }

  return {
    sessionEstateId: normSession,
    sessionEstateName: sessionConfig.name,
    sessionCode,
    seller4DigitCode: candidate4Digit || detected.code,
    sellerName: ocrData.nama_penjual || detected.estateName,
    detectedEstateId: detected.estateId,
    detectedEstateName: detected.estateName,
    detectedCode: detected.code,
    status,
    isMatch,
    message,
    step1Session: {
      estateId: normSession,
      estateName: sessionConfig.name,
      code: sessionCode,
    },
    step2CodeCheck: {
      code: candidate4Digit,
      matchedEstateId: step2Matched?.estateId || null,
      matchedEstateName: step2Matched?.estateName || null,
    },
    step3NameCheck: {
      sellerName: ocrData.nama_penjual || '',
      matchedEstateId: step3Matched?.estateId || null,
      matchedEstateName: step3Matched?.estateName || null,
    },
  };
}

export async function parseReceiptWithGemini(file: File, explicitSessionEstateId?: string): Promise<OCRResult> {
  const currentSessionEstateId = explicitSessionEstateId || getActiveEstateId();
  const base64Data = await compressImage(file, 1600, 0.85);
  const payload = JSON.stringify({
    imageBase64: base64Data,
    mimeType: "image/jpeg", // Canvas compression outputs jpeg
    fileName: file.name,
    sessionEstateId: currentSessionEstateId,
    activeEstateId: currentSessionEstateId,
  });

  const endpoints = [
    "/api/ai/ocr-receipt",
    "/api/ocr-receipt"
  ];
  let response: Response | null = null;
  let lastStatus = 0;
  let lastErrorMessage = "";

  console.log(`[OCR_SERVICE] Memulakan pemprosesan imej resit. Sesi: ${currentSessionEstateId}, Saiz: ${(payload.length / 1024).toFixed(1)} KB`);

  for (const endpoint of endpoints) {
    try {
      console.log(`[OCR_SERVICE] Mencuba memanggil endpoint OCR: ${endpoint}`);
      response = await safeFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-estate-id": currentSessionEstateId,
        },
        body: payload,
        timeoutMs: 35000
      });

      lastStatus = response.status;
      console.log(`[OCR_SERVICE] Respons diterima dari ${endpoint} dengan status: ${response.status}`);

      if (response.ok) {
        console.log(`[OCR_SERVICE] Kejayaan! Endpoint ${endpoint} berjaya memberikan respons 200 OK`);
        break;
      }

      // Read error message from response (JSON or text)
      try {
        const textData = await response.text();
        try {
          const errJson = JSON.parse(textData);
          if (errJson.error) {
            lastErrorMessage = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
          } else if (response.status === 404) {
            lastErrorMessage = "Laluan API OCR tidak dijumpai (404).";
          }
        } catch {
          if (response.status === 404) {
            lastErrorMessage = "Laluan API OCR tidak dijumpai (404).";
          } else if (textData && textData.length < 300 && !textData.includes('<html')) {
            lastErrorMessage = textData.trim();
          } else {
            lastErrorMessage = `Ralat pelayan (Status ${response.status}).`;
          }
        }
      } catch {
        lastErrorMessage = response.status === 404 ? "Laluan API OCR tidak dijumpai (404)." : `Ralat pelayan (Status ${response.status}).`;
      }

      // If 404 or 500 server error on primary, try fallback endpoint
      if (response.status === 404 || response.status >= 500) {
        console.warn(`[OCR_SERVICE] Status ${response.status} di ${endpoint}: ${lastErrorMessage}`);
        continue;
      }

      break;
    } catch (err: any) {
      lastErrorMessage = err?.message || "Ralat rangkaian semasa menghubungi pelayan.";
    }
  }

  if (!response || !response.ok) {
    const errorMsg = lastErrorMessage || (lastStatus ? `Ralat pelayan (Kod ${lastStatus}).` : "Gagal menyambung ke perkhidmatan OCR.");
    throw new Error(errorMsg);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Gagal mengekstrak data daripada resit.");
  }

  const parsed = result.data as OCRResult;

  // Lakukan Semakan 3-Langkah di Klien untuk integriti penuh
  const clientVerification = verifyReceiptEstate(currentSessionEstateId, parsed);
  parsed.estate_verification = clientVerification;
  parsed.detected_estate_id = clientVerification.detectedEstateId;
  parsed.detected_estate_name = clientVerification.detectedEstateName;
  parsed.kod_penjual_4digit = clientVerification.seller4DigitCode;

  return parsed;
}

