import { compressImage } from "../../../utils/compressImage";
import { safeFetch } from "../../../utils/safeFetch";

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
  detected_estate_id?: string;
  detected_estate_name?: string;
  confidence: number;
}

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
  const resit = (noResit || '').trim().toUpperCase();
  const akaunBts = (kodAkaunBts || '').trim().toUpperCase();

  // 1. Semak kod projek 4-digit BTS (cth: 5136 daripada "5136-020-6-06") atau dari kod akaun siri BTS
  const projMatch = proj.match(/^\d{4}/) || akaunBts.match(/^\d{4}/);
  const projCode = projMatch ? projMatch[0] : (proj.length >= 4 ? proj.slice(0, 4) : '');
  if (projCode === '5155' || akaunBts.startsWith('5155')) return { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal', code: '5155' };
  if (projCode === '5136' || akaunBts.startsWith('5136')) return { estateId: 'FPM_ADELA', estateName: 'FPM Adela', code: '5136' };
  if (projCode === '5176' || akaunBts.startsWith('5176')) return { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang', code: '5176' };
  if (projCode === '5156' || akaunBts.startsWith('5156')) return { estateId: 'FPM_SENING', estateName: 'FPM Sening', code: '5156' };

  // 2. Semak No. Nota Hantaran
  if (nota.startsWith('5155') || nota.startsWith('155')) return { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal', code: '5155' };
  if (nota.startsWith('5136') || nota.startsWith('136')) return { estateId: 'FPM_ADELA', estateName: 'FPM Adela', code: '5136' };
  if (nota.startsWith('5176') || nota.startsWith('176')) return { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang', code: '5176' };
  if (nota.startsWith('5156') || nota.startsWith('156')) return { estateId: 'FPM_SENING', estateName: 'FPM Sening', code: '5156' };

  // 3. Semak kod penjual atau nama atau resit
  const fourDigitMatch = code.match(/^\d{4}/);
  const fourDigitCode = fourDigitMatch ? fourDigitMatch[0] : (code.length >= 4 ? code.slice(0, 4) : '');

  if (fourDigitCode === '5155' || name.includes('TUNGGAL') || resit.includes('TUNGGAL') || resit.startsWith('TGL-')) {
    return { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal', code: '5155' };
  }
  if (fourDigitCode === '5136' || name.includes('ADELA') || resit.includes('ADELA') || resit.startsWith('ADL-')) {
    return { estateId: 'FPM_ADELA', estateName: 'FPM Adela', code: '5136' };
  }
  if (fourDigitCode === '5176' || name.includes('KLEDANG') || resit.includes('KLEDANG') || resit.startsWith('KLD-')) {
    return { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang', code: '5176' };
  }
  if (fourDigitCode === '5156' || name.includes('SENING') || resit.includes('SENING') || resit.startsWith('SNG-')) {
    return { estateId: 'FPM_SENING', estateName: 'FPM Sening', code: '5156' };
  }

  return null;
}

export async function parseReceiptWithGemini(file: File): Promise<OCRResult> {
  const base64Data = await compressImage(file, 1600, 0.85);
  const payload = JSON.stringify({
    imageBase64: base64Data,
    mimeType: "image/jpeg", // Canvas compression outputs jpeg
    fileName: file.name
  });

  const endpoints = [
    "/api/ai/ocr-receipt",
    "/api/ocr-receipt"
  ];
  let response: Response | null = null;
  let lastStatus = 0;
  let lastErrorMessage = "";

  console.log(`[OCR_SERVICE] Memulakan pemprosesan imej resit. Saiz: ${(payload.length / 1024).toFixed(1)} KB`);

  for (const endpoint of endpoints) {
    try {
      console.log(`[OCR_SERVICE] Mencuba memanggil endpoint OCR: ${endpoint}`);
      response = await safeFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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

  // Double check estate info on client if not already populated
  if (!parsed.detected_estate_id) {
    const estateInfo = detectEstateFromSeller(parsed.kod_penjual, parsed.nama_penjual, parsed.kod_projek);
    if (estateInfo) {
      parsed.detected_estate_id = estateInfo.estateId;
      parsed.detected_estate_name = estateInfo.estateName;
    }
  }

  return parsed;
}

