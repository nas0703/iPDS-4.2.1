import * as pdfjs from 'pdfjs-dist';

/**
 * Client-side PDF text extractor with automatic Gemini Vision OCR for scanned books/documents
 * 
 * Flow:
 * 1. Fast Digital Text Extraction (pdfjs-dist standalone & standard)
 * 2. Automatic Scanned Document Detection: If text is missing or sparse (scanned book pages)
 * 3. Gemini Vision High-Precision OCR: Renders pages to canvas and extracts all text, tables & formulas via AI
 */

export interface ExtractedPage {
  pageNum: number;
  text: string;
  isOcr?: boolean;
}

export interface PdfExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
  success: boolean;
  isScannedDocument?: boolean;
}

/**
 * Pure JavaScript PDF text stream extractor (failsafe fallback for digital text)
 */
function extractTextPureJs(arrayBuffer: ArrayBuffer): ExtractedPage[] {
  const bytes = new Uint8Array(arrayBuffer);
  const pages: ExtractedPage[] = [];

  let binaryStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binaryStr += String.fromCharCode.apply(null, Array.from(chunk));
  }

  const pageSections = binaryStr.split(/\/Type\s*\/Page\b/);
  
  if (pageSections.length > 1) {
    for (let p = 1; p < pageSections.length; p++) {
      const section = pageSections[p];
      const textMatches: string[] = [];
      const btMatches = section.match(/BT[\s\S]*?ET/g) || [];
      
      for (const bt of btMatches) {
        const tjMatches = bt.match(/\((.*?)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
          const content = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
          if (content) textMatches.push(content);
        }
        
        const tjArrayMatches = bt.match(/\[(.*?)\]\s*TJ/g) || [];
        for (const tja of tjArrayMatches) {
          const innerTj = tja.match(/\((.*?)\)/g) || [];
          for (const it of innerTj) {
            const clean = it.slice(1, -1).trim();
            if (clean) textMatches.push(clean);
          }
        }
      }

      const combinedText = textMatches.join(' ').replace(/\s+/g, ' ').trim();
      if (combinedText.length > 5) {
        pages.push({ pageNum: p, text: combinedText });
      }
    }
  }

  return pages;
}

/**
 * Render a single PDF page into a JPEG base64 string
 */
async function renderPageToImageBase64(page: any, scale: number = 1.6): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }

  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.split(',')[1];
}

/**
 * Perform Gemini Vision OCR on an image of a scanned PDF page with client-side retry
 */
async function performGeminiOcrOnPage(
  imageBase64: string,
  pageNum: number,
  totalPages: number,
  fileName: string,
  category: string,
  maxRetries: number = 2
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('/api/ai/ocr-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          pageNum,
          totalPages,
          fileName,
          category
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.text || null;
      }

      if (res.status === 429 || res.status === 503) {
        const backoff = (attempt + 1) * 3000;
        console.warn(`OCR returned ${res.status} on page ${pageNum}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }
    } catch (err) {
      console.warn(`OCR network error on page ${pageNum} (attempt ${attempt + 1}):`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return null;
}

/**
 * Extract all pages from a PDF File or ArrayBuffer with automatic Scanned Document OCR
 */
export async function extractPdfTextClient(
  fileOrBuffer: File | ArrayBuffer,
  options?: {
    fileName?: string;
    category?: string;
    onProgress?: (current: number, total: number, message?: string) => void;
  }
): Promise<PdfExtractionResult> {
  const arrayBuffer = fileOrBuffer instanceof File
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;

  const fileName = options?.fileName || (fileOrBuffer instanceof File ? fileOrBuffer.name : 'Dokumen');
  const category = options?.category || 'Manual Rumpai Dan Kawalan';
  const onProgress = options?.onProgress;

  let pages: ExtractedPage[] = [];
  let totalPages = 1;
  let pdfDoc: any = null;

  // 1. Muatkan dokumen PDF menggunakan PDF.js
  try {
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
        useWorkerFetch: false,
      } as any);
      pdfDoc = await loadingTask.promise;
    }
  } catch (err1) {
    try {
      if (pdfjs && typeof pdfjs.getDocument === 'function') {
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
          disableFontFace: true,
        });
        pdfDoc = await loadingTask.promise;
      }
    } catch (err2) {
      console.warn("PDF.js load failed:", err2);
    }
  }

  // 2. Jika PDF.js berjaya dimuatkan, cuba ekstrak teks digital dahulu
  if (pdfDoc) {
    totalPages = pdfDoc.numPages || 1;
    let digitalTextCharCount = 0;

    for (let i = 1; i <= totalPages; i++) {
      onProgress?.(i, totalPages, `Membaca teks digital m/s ${i}/${totalPages}...`);
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageText && pageText.length > 5) {
          pages.push({ pageNum: i, text: pageText });
          digitalTextCharCount += pageText.length;
        }
      } catch (pageErr) {
        console.warn(`Error reading page ${i}:`, pageErr);
      }
    }

    const avgCharsPerPage = pages.length > 0 ? (digitalTextCharCount / totalPages) : 0;

    // 3. Kesan Adakah Dokumen Ini Buku/Dokumen Yang Diimbas (Scanned PDF)
    // Jika tiada teks langsung atau purata huruf kurang dari 40 huruf setiap muka surat,
    // dokumen ini disahkan adalah Imej Imbasan (Scanned Book) -> Aktifkan Gemini Vision OCR!
    const isScanned = pages.length === 0 || avgCharsPerPage < 40;

    if (isScanned) {
      console.log(`[OCR Engine] Dokumen "${fileName}" dikesan sebagai dokumen imbasan (Scanned PDF). Mengaktifkan Gemini Vision OCR...`);
      const ocrPages: ExtractedPage[] = [];

      for (let p = 1; p <= totalPages; p++) {
        onProgress?.(p, totalPages, `Gemini Vision AI OCR sedang membaca m/s ${p}/${totalPages} (Imej Imbasan)...`);
        try {
          const page = await pdfDoc.getPage(p);
          const imageBase64 = await renderPageToImageBase64(page, 1.6);
          const ocrText = await performGeminiOcrOnPage(imageBase64, p, totalPages, fileName, category);

          if (ocrText && ocrText.length > 5) {
            ocrPages.push({
              pageNum: p,
              text: ocrText,
              isOcr: true
            });
          } else {
            // Jika ada sedikit teks digital terdahulu, gunakan sebagai sandaran
            const existingDigital = pages.find(item => item.pageNum === p);
            if (existingDigital) {
              ocrPages.push(existingDigital);
            }
          }

          // Delay halus 1.2s antara muka surat bagi mengelakkan lonjakan kuota API (Rate Limit 429)
          if (p < totalPages) {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        } catch (ocrErr) {
          console.warn(`Gagal OCR m/s ${p}:`, ocrErr);
        }
      }

      if (ocrPages.length > 0) {
        return {
          pages: ocrPages,
          totalPages,
          success: true,
          isScannedDocument: true
        };
      }
    } else {
      // Teks digital lengkap sedia ada
      return {
        pages,
        totalPages,
        success: true,
        isScannedDocument: false
      };
    }
  }

  // 4. Pure JS fallback
  const pureJsPages = extractTextPureJs(arrayBuffer);
  if (pureJsPages.length > 0) {
    return {
      pages: pureJsPages,
      totalPages: pureJsPages.length,
      success: true,
      isScannedDocument: false
    };
  }

  return {
    pages: [],
    totalPages: 1,
    success: false
  };
}
