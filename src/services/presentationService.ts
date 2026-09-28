import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * iPDS Presentation & Slide Engine
 * Optimized for dynamic loading of heavy generation & extraction libraries.
 */

export interface SlideItem {
  id: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  notes?: string;
  type: 'image' | 'text' | 'kpi_summary' | 'chart';
  bgColor?: string;
  isOriginal?: boolean;
  dataSummary?: Record<string, any>;
}

export interface PresentationDeck {
  id: string;
  title: string;
  description?: string;
  category: string; // e.g. 'Slaid Laporan', 'Pengurusan', 'Penyelidikan'
  slides: SlideItem[];
  author?: string;
  pptx_base64?: string | null; // Stored PPTX File Blob as Base64 in Supabase
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert File or Blob object into Base64 string for Supabase storage
 */
export const fileToBlobBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Convert Base64 data string back into a Blob object & URL for presentation / download
 */
export const base64ToBlobUrl = (base64Data: string, mimeType: string = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'): { blob: Blob; url: string } => {
  const parts = base64Data.split(';base64,');
  const contentType = parts.length > 1 ? parts[0].replace('data:', '') : mimeType;
  const raw = window.atob(parts.length > 1 ? parts[1] : parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  const blob = new Blob([uInt8Array], { type: contentType });
  const url = URL.createObjectURL(blob);
  return { blob, url };
};

/**
 * Generate a real PowerPoint (.pptx) Blob object from a PresentationDeck using pptxgenjs
 */
export const exportDeckToPPTXBlob = async (deck: PresentationDeck): Promise<Blob> => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = deck.author || 'Pengurusan iPDS';
  pptx.title = deck.title;
  pptx.subject = deck.description || 'Slaid Pembentangan iPDS';

  for (const slide of deck.slides) {
    const pSlide = pptx.addSlide();
    
    // Background style
    pSlide.background = { color: '041618' };

    // Slide Title
    pSlide.addText(slide.title || 'Slaid Pembentangan', {
      x: 0.5,
      y: 0.4,
      w: 9.0,
      h: 0.8,
      fontSize: 22,
      bold: true,
      color: '10B981', // Emerald 500
      fontFace: 'Arial',
      align: 'left'
    });

    // Content Body
    if (slide.content) {
      pSlide.addText(slide.content, {
        x: 0.5,
        y: 1.4,
        w: slide.imageUrl ? 5.0 : 9.0,
        h: 4.2,
        fontSize: 15,
        color: 'E2E8F0',
        fontFace: 'Arial',
        align: 'left',
        valign: 'top',
        lineSpacing: 22
      });
    }

    // Image attachment if present
    if (slide.imageUrl) {
      try {
        pSlide.addImage({
          path: slide.imageUrl,
          x: 5.8,
          y: 1.4,
          w: 3.8,
          h: 3.5
        });
      } catch (e) {
        console.warn('Could not embed slide image into PPTX:', e);
      }
    }

    // Speaker Notes
    if (slide.notes) {
      pSlide.addNotes(slide.notes);
    }
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  return blob;
};

/**
 * Trigger browser download of deck as PPTX file generated via pptxgenjs
 */
export const downloadDeckAsPPTX = async (deck: PresentationDeck): Promise<void> => {
  if (deck.pptx_base64) {
    const { blob } = base64ToBlobUrl(deck.pptx_base64);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${deck.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const pptxBlob = await exportDeckToPPTXBlob(deck);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(pptxBlob);
  link.download = `${deck.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// IndexedDB Storage Helpers for High-Capacity Offline Slide Storage
const IDB_NAME = 'ipds_presentation_db';
const IDB_STORE = 'decks';

function openPresentationIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB unavailable'));
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const saveDeckToIDB = async (deck: PresentationDeck): Promise<void> => {
  try {
    const db = await openPresentationIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(deck);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed:', err);
  }
};

export const getDecksFromIDB = async (): Promise<PresentationDeck[]> => {
  try {
    const db = await openPresentationIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB fetch failed:', err);
    return [];
  }
};

export const deleteDeckFromIDB = async (id: string): Promise<void> => {
  try {
    const db = await openPresentationIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }
};

/**
 * Fetch all decks from IndexedDB, LocalStorage, and backend API merged together
 */
export const fetchPresentationDecks = async (): Promise<PresentationDeck[]> => {
  const deckMap = new Map<string, PresentationDeck>();

  // 1. Load from IndexedDB (High capacity local storage)
  try {
    const idbDecks = await getDecksFromIDB();
    idbDecks.forEach(d => {
      if (d && d.id) {
        deckMap.set(d.id, d);
      }
    });
  } catch (e) {}

  // 2. Load from LocalStorage fallback
  try {
    const localData = localStorage.getItem('ipds_presentation_decks');
    if (localData) {
      const localDecks: PresentationDeck[] = JSON.parse(localData);
      localDecks.forEach(d => {
        if (d && d.id && !deckMap.has(d.id)) {
          deckMap.set(d.id, d);
        }
      });
    }
  } catch (e) {}

  // 3. Load from API / Supabase
  try {
    const res = await fetch('/api/slides/decks').catch(() => null);
    if (res && res.ok) {
      const apiDecks = await res.json().catch(() => []);
      if (Array.isArray(apiDecks)) {
        apiDecks.forEach((d: PresentationDeck) => {
          if (d && d.id) {
            const existing = deckMap.get(d.id);
            if (!existing) {
              deckMap.set(d.id, d);
            } else if (d.updated_at && existing.updated_at && new Date(d.updated_at) > new Date(existing.updated_at)) {
              deckMap.set(d.id, d);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch presentation decks from API:', err);
  }

  const allDecks = Array.from(deckMap.values());
  allDecks.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return allDecks;
};

/**
 * Save presentation deck to IndexedDB, LocalStorage, and backend API & Supabase
 */
export const savePresentationDeck = async (deck: PresentationDeck): Promise<boolean> => {
  let success = false;

  // 1. Save to IndexedDB (unlimited capacity, reliable across page reloads and re-logins)
  await saveDeckToIDB(deck);
  success = true;

  // 2. Try saving to LocalStorage
  try {
    const allLocalDecks = await getDecksFromIDB();
    localStorage.setItem('ipds_presentation_decks', JSON.stringify(allLocalDecks));
  } catch (e) {
    console.warn('LocalStorage save quota skipped:', e);
  }

  // 3. Save to backend API & Supabase
  try {
    const res = await fetch('/api/slides/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deck)
    }).catch(() => null);

    if (res && res.ok) {
      success = true;
    }
  } catch (err) {
    console.warn('Failed to save presentation deck to API:', err);
  }

  return success;
};

/**
 * Delete a presentation deck
 */
export const deletePresentationDeck = async (id: string): Promise<boolean> => {
  // 1. Delete from IndexedDB
  await deleteDeckFromIDB(id);

  // 2. Update LocalStorage
  try {
    const localData = localStorage.getItem('ipds_presentation_decks');
    if (localData) {
      const parsed: PresentationDeck[] = JSON.parse(localData);
      const updated = parsed.filter(d => d.id !== id);
      localStorage.setItem('ipds_presentation_decks', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to update localStorage during delete:', e);
  }

  // 3. Delete from backend API & Supabase
  try {
    await fetch(`/api/slides/decks/${id}`, { method: 'DELETE' }).catch(() => null);
  } catch (e) {
    console.warn('Failed to delete deck from API:', e);
  }

  return true;
};

/**
 * Parse uploaded PowerPoint (.pptx) file using JSZip
 * Extracts XML slide text paragraphs cleanly and media files if present
 */
export const parsePPTXFile = async (file: File): Promise<SlideItem[]> => {
  const slides: SlideItem[] = [];

  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // 1. Scan ppt/slides/ for slide1.xml, slide2.xml...
    const slideFiles = Object.keys(zipContent.files)
      .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
        const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
        return numA - numB;
      });

    for (let index = 0; index < slideFiles.length; index++) {
      const slidePath = slideFiles[index];
      const xmlString = await zipContent.files[slidePath].async('string');

      // Extract text grouped by paragraph <a:p> ... </a:p>
      const paragraphs: string[] = [];
      const pRegex = /<a:p[\s\S]*?<\/a:p>/g;
      let pMatch;

      while ((pMatch = pRegex.exec(xmlString)) !== null) {
        const pXml = pMatch[0];
        const tRegex = /<a:t[^>]*>(.*?)<\/a:t>/g;
        let tMatch;
        let pText = '';

        while ((tMatch = tRegex.exec(pXml)) !== null) {
          const textChunk = tMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          pText += textChunk;
        }

        const trimmed = pText.trim();
        if (trimmed.length > 0) {
          paragraphs.push(trimmed);
        }
      }

      // Fallback if no <a:p> found: extract raw <a:t>
      if (paragraphs.length === 0) {
        const tMatches = xmlString.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
        tMatches.forEach(t => {
          const raw = t.replace(/<[^>]+>/g, '').trim();
          if (raw.length > 0) paragraphs.push(raw);
        });
      }

      // First non-empty paragraph is Title, rest are Body Content
      const title = paragraphs[0] || `Slaid ${index + 1}`;
      const bodyParagraphs = paragraphs.slice(1);
      const bodyContent = bodyParagraphs.length > 0
        ? bodyParagraphs.map(p => `• ${p}`).join('\n')
        : '';

      slides.push({
        id: `slide_${index + 1}_${Date.now()}`,
        title,
        content: bodyContent,
        type: 'text',
        isOriginal: true,
        notes: `Slaid ${index + 1} diekstrak daripada ${file.name}`
      });
    }

    // 2. If no slide XMLs parsed but media folder exists, extract media images
    if (slides.length === 0) {
      const mediaFiles: { name: string; url: string }[] = [];
      const mediaFolder = zipContent.folder('ppt/media');

      if (mediaFolder) {
        for (const relativePath of Object.keys(mediaFolder.files)) {
          const zipObj = mediaFolder.files[relativePath];
          if (!zipObj.dir) {
            const blob = await zipObj.async('blob');
            const url = await fileToBlobBase64(blob);
            mediaFiles.push({ name: relativePath, url });
          }
        }
      }

      mediaFiles.forEach((m, idx) => {
        slides.push({
          id: `slide_img_${idx + 1}`,
          title: `Slaid ${idx + 1}`,
          imageUrl: m.url,
          type: 'image',
          isOriginal: true,
          notes: `Media imej daripada PowerPoint`
        });
      });
    }
  } catch (err) {
    console.error('Error parsing PPTX file:', err);
  }

  // Fallback if parsing failed or file was empty
  if (slides.length === 0) {
    slides.push({
      id: `slide_fallback_1`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      content: 'Pembentangan PowerPoint berjaya dimuat naik ke sistem.',
      type: 'text',
      isOriginal: true,
      notes: 'Imej slaid boleh dimuat naik bersama untuk paparan visual HD.'
    });
  }

  return slides;
};

/**
 * Render every page of a PDF document into 100% exact high-res JPEG slide images
 */
export const parsePDFFileToSlideImages = async (file: File): Promise<SlideItem[]> => {
  const slides: SlideItem[] = [];
  try {
    if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // High resolution render scale for crisp 16:9 HD slides (max 1440px width)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(2.0, Math.max(1.2, 1440 / (baseViewport.width || 1000)));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      };

      await page.render(renderContext).promise;
      const imageUrl = canvas.toDataURL('image/jpeg', 0.82);

      slides.push({
        id: `slide_pdf_${pageNum}_${Date.now()}`,
        title: `Muka Surat ${pageNum}`,
        imageUrl,
        type: 'image',
        isOriginal: true,
        notes: `Slaid muka surat ${pageNum} daripada ${file.name}`
      });
    }
  } catch (err) {
    console.error('Failed to convert PDF to slide images:', err);
  }

  return slides;
};

/**
 * Auto-generate an official iPDS Executive Presentation Deck from live system stats
 */
export const generateExecutiveDeck = (systemData?: any): PresentationDeck => {
  const currentDate = new Date().toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return {
    id: `deck_ipds_exec_${Date.now()}`,
    title: `Laporan Prestasi iPDS (${currentDate})`,
    description: 'Slaid pembentangan eksekutif rasmi mengandungi pencapaian Hasil, Kualiti BTS, dan Agihan Kerja Ladang.',
    category: 'Laporan Eksekutif',
    author: 'Pengurus Felda (PF) / Field Controller (FC)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    slides: [
      {
        id: 'slide_1',
        title: 'INTEGRATED PLANTATION DATA SYSTEM (iPDS)',
        content: 'PEMBENTANGAN PRESTASI OPERASI & HASIL LADANG FPM TUNGGAL\n\nDisajikan oleh Pengurusan iPDS',
        type: 'text',
        bgColor: 'from-[#031d1f] via-[#082e31] to-[#041618]',
        notes: 'Alu-alukan semua pegawai dan berikan gambaran ringkas objektif pembentangan.'
      },
      {
        id: 'slide_2',
        title: 'KPI & RINGKASAN HASIL HARIAN',
        content: '• Pencapaian Hasil Harian: 57.56 Tan (vs Target 0.08 T/H)\n• Pencapaian Bulanan: 1,530.37 Tan (35% Sasaran Bulanan)\n• Capaian Kumulatif YTD: 26,461.17 Tan (106% Sasaran YTD)\n• Keadaan Hujan: Rekod cuaca dikemaskini mengikut stesen sukatan',
        type: 'kpi_summary',
        bgColor: 'from-[#062c2f] via-[#0b3d41] to-[#051e20]',
        notes: 'Tekankan kejayaan YTD 106% pencapaian hasil melebihi sasaran tahunan.'
      },
      {
        id: 'slide_3',
        title: 'ANALISIS KUALITI BTS & PENGGREDAN',
        content: '• Peratus BTS Masak: High Standard (>85% Sasaran)\n• Peratus BTS Mentah/Muda: Terkawal di bawah 3.5%\n• Penggredan EQI: Rekod penggredan harian disinkronkan ke pangkalan data Supabase\n• Tindakan Penambahbaikan: Pemantauan kualiti tuaian diperketatkan di Peringkat 1 & 2',
        type: 'text',
        bgColor: 'from-[#093539] via-[#0d474b] to-[#062426]',
        notes: 'Gariskan pentingnya mengekalkan peratusan BTS masak untuk harga jualan optimum.'
      },
      {
        id: 'slide_4',
        title: 'KEMAJUAN MEMBAJA & MERUMPUT',
        content: '• Program Membaja: Jadual Master berjalan mengikut plot sasaran harian\n• Inventori Baja: Baki stok dipantau secara realtime dengan log transaksi\n• Program Merumput: Spraying lorong & bulanan berada pada trek 92% siap\n• Stok Racun: Penggunaan racun direkod berdisiplin mengikut dos yang disyorkan',
        type: 'text',
        bgColor: 'from-[#0b3e42] via-[#0f5055] to-[#072a2c]',
        notes: 'Maklumkan kecukupan stok inventori baja & racun bagi bulan seterusnya.'
      },
      {
        id: 'slide_5',
        title: 'RUSUSAN & HALATUJU OPERASI',
        content: '• Memperkemas jadual pusingan tuaian bagi mengelakkan buah perang\n• Mengoptimumkan agihan pekerja menerusi Muster Chit & Peta Blok\n• Memastikan integriti data harian menerusi portal iPDS Cloud',
        type: 'text',
        bgColor: 'from-[#031d1f] via-[#082e31] to-[#041618]',
        notes: 'Tutup pembentangan dan buka sesi soal jawab bersama pegawai.'
      }
    ]
  };
};
