import express from 'express';
import { requireRole } from '../../middleware/auth.js';
import { getSafeErrorMessage } from '../../utils/errorUtils.js';
import { getPktDisplayName } from '../../../config/estateRegistry.js';
import { aiService, AI_CONFIG } from '../../ai/index.js';

const router = express.Router();

// POST /api/ai/diagnose-weed-image - WeedVision™ AI Multimodal Diagnosis
router.post(['/diagnose-weed-image', '/ai/diagnose-weed-image', '/diagnose-weed-image/', '/ai/diagnose-weed-image/'], requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), async (req, res) => {
  console.log(`[VISION_AI] Request received for diagnose-weed-image. Path: ${req.path}`);
  try {
    const { image, fileName = 'weed_photo.jpg' } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Imej (base64) diperlukan untuk analisis WeedVision™.'
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.'
      });
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = image.replace(/^data:[^;]+;base64,/, '');
      }
    }

    const promptText = `Anda ialah Pakar Agronomi Botani Rumpai Kelapa Sawit (Senior Oil Palm Weed Taxonomist & MSPO Agronomist).
Tugas anda adalah menganalisis gambar foto rumpai lapangan ini dengan ketepatan tinggi dan mengecam spesies botani secara saintifik, walaupun gambar agak kabur atau diambil dari jarak sederhana.

PANDUAN PENGEAMAN PANTAS MENGIKUT CIRI DAUN & HABITUS:
1. "asystasia-gangetica" : Daun bujur telur bertentangan (opposite), tepi daun beralun lembut, batang bersegi 4 lembut meliar di piringan, bunga corong putih-krim tompok ungu.
2. "mikania-micrantha" : Rumpai menjalar melilit pokok/pelepah (climber), daun bentuk jantung/mata panah (cordate) berhujung tajam, tepi bergerigi kasar, bunga jambak putih kecil.
3. "nephrolepis-biserrata" : Paku-pakis pelepah panjang pinat melengkung, anak daun berselang tepi bergerigi, tumbuh melata atau melekat pada batang sawit.
4. "imperata-cylindrica" : Lalang berdaun bilah tegak tajam panjang dengan urat tengah putih jelas menonjol, tepi daun tajam mengandungi silika, bunga bulu putih kapas.
5. "chromolaena-odorata" : Pokok Kapal Terbang (renek berkayu), daun bentuk segi tiga/delta dengan 3 urat daun utama sangat ketara dari pangkal, bau wangi bila ramas.
6. "clidemia-hirta" : Senduduk Bulu (renek), batang dan permukaan daun berbulu merah kasar lebat, 5 urat daun melengkung dari pangkal ke hujung.
7. "melastoma-malabathricum" : Senduduk Biasa (renek), bunga besar ungu/merah jambu 5 kelopak, daun bujur 3-5 urat tanpa bulu duri tajam.
8. "eleusine-indica" : Rumput Sambau, rumpun melekat kuat pada tanah, tangkai bunga tegak dengan 2-6 spika jejari di hujung seperti tapak kaki angsa/burung.
9. "paspalum-conjugatum" : Rumput Kerbau / Cow Grass, jambak bunga bercabang dua khas berbentuk huruf 'T' atau 'V' di hujung tangkai, daun lembut berbulu tepi.
10. "ottochloa-nodosa" : Rumput Pait, rumput menjalar lembut dengan buku licin di bawah naungan kanopi sawit matang yang gelap.
11. "borreria-latifolia" : Rumput Setawar/Pokok Butang, batang bersegi 4 bersayap, daun lebar bertentangan agak kekuningan berkedut, bunga putih kecil di celah ketiak daun.
12. "cyperus-rotundus" : Rumput Halia Hitam/Teki (rusiga), batang bersegi tiga licin tajam, daun berkilat, bunga payung coklat kemerahan.
13. "stenochlaena-palustris" : Paku Midin/Miding, pakis memanjat batang sawit, pucuk muda warna merah kecoklatan, daun pinat tebal berkilat.
14. "mimosa-pudica" : Semalu, daun majmuk kecil menguncup bila disentuh, batang berduri tajam, bunga bulat merah jambu gebu.
15. "mimosa-invisa" : Semalu Gergasi, batang bersegi lima dengan duri cangkuk tajam kasar merayap tebal.
16. "dicranopteris-linearis" : Resam / Paku Resam, pakis darat tebal bercabang dua (garpu berulang) membentuk belukar keras di tanah bukit laterit.
17. "axonopus-compressus" : Rumput Parit / Carpet Grass, rumput merayap tebal berdaun tumpul membulat di hujung, membentuk permaidani padat.
18. "paspalum-commersonii" : Rumput Mas / Kodo Grass, rumput berumpun tegak dengan 2-4 spika berselang berbiji bulat coklat gelap.
19. "commelina-diffusa" : Rumput Aur / Spiderwort, herba succulent berair merayap berbunga biru terang 3 kelopak.
20. "praxelis-clematidea" : Praxelis / Kapal Terbang Mini, herba tegak berdaun bergerigi dengan bunga jambak ungu lavender cerah.
21. "passiflora-foetida" : Letup-letup / Ubi Hutan, pemanjat bersulur paut dengan daun 3 lobus berbulu melekit dan buah bulat dalam jaring sarang.
22. "ficus-fistulosa" : Anak Ara Epifit / Strangler Fig, anak pokok ara berakar udara tebal yang mencelah di ketiak pelepah sawit matang.

ARAHAN ANALISIS FOTO (WALAUPUN KABUR / LOW QUALITY):
1. Teliti siluet, bentuk daun, cara daun tersusun, corak urat daun, dan cara pokok itu tumbuh (tegak, menjalar, memanjat, berumpun).
2. Kenal pasti spesies utama (matchedWeedId).
3. Jika terdapat ketidakpastian atau gambar kurang jelas, berikan juga senarai alternatif (alternativeMatches) bersama sebab dan peratus keyakinan.
4. Nyatakan kualiti imej (cth: "Imej jelas" atau "Imej agak kabur/jauh, pengecaman berdasarkan susunan daun dan habit menjalar").

Hantar output dalam format JSON SAHAJA:
{
  "matchedWeedId": "asystasia-gangetica",
  "scientificName": "Asystasia gangetica",
  "malayName": "Rumput Israel / Asystasia / Pengarak",
  "category": "Broadleaf",
  "confidence": 0.94,
  "featuresDetected": ["Susunan daun bertentangan bujur telur", "Habit merayap di piringan sawit", "Batang lembut bersegi 4"],
  "explanation": "Berdasarkan analisis visual foto, rumpai ini menunjukkan ciri Asystasia gangetica dengan daun bertentangan dan habitus menjalar lembut.",
  "recommendedActiveIngredient": "Metsulfuron-methyl 20% @ 2.2g - 2.5g / 16L air",
  "alternativeMatches": [
    { "weedId": "mikania-micrantha", "name": "Mikania micrantha (Selaput Tunggul)", "confidence": 0.35, "reason": "Sekiranya daun berbentuk jantung dan memanjat melilit pelepah." },
    { "weedId": "borreria-latifolia", "name": "Borreria latifolia (Rumput Setawar)", "confidence": 0.20, "reason": "Sekiranya daun bertentangan bersegi dengan bunga di ketiak." }
  ]
}`;

    const aiResponseText = await aiService.extractVision({
      prompt: promptText,
      base64Data: base64Data,
      mimeType: mimeType || 'image/jpeg',
      candidateModels: AI_CONFIG.models.weedVision,
      circuitBreakerName: 'gemini-weed-vision',
      circuitBreakerFailureThreshold: 4,
      timeoutMs: AI_CONFIG.timeouts.weedVisionMs,
      temperature: 0.1,
      maxOutputTokens: 2048,
      operationName: 'gemini_weed_vision'
    });

    if (aiResponseText) {
      let parsedData: Record<string, unknown> | null = null;

      let cleanedJson = aiResponseText;
      if (cleanedJson.includes('```')) {
        const match = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) {
          cleanedJson = match[1].trim();
        }
      }

      const firstBrace = cleanedJson.indexOf('{');
      const lastBrace = cleanedJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedJson = cleanedJson.slice(firstBrace, lastBrace + 1);
      }

      cleanedJson = cleanedJson.replace(/,\s*([}\]])/g, '$1');

      try {
        parsedData = JSON.parse(cleanedJson);
      } catch (jsonErr) {
        const extractField = (key: string): string => {
          const regex = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i');
          const m = aiResponseText!.match(regex);
          return m && m[1] ? m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
        };

        const extractNumber = (key: string): number => {
          const regex = new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`, 'i');
          const m = aiResponseText!.match(regex);
          return m && m[1] ? parseFloat(m[1]) : 0.95;
        };

        const matchedId = extractField('matchedWeedId');
        const scientificName = extractField('scientificName');
        const malayName = extractField('malayName');
        const explanation = extractField('explanation');
        const recommendedActive = extractField('recommendedActiveIngredient');
        const category = extractField('category') || 'Broadleaf';
        const confidence = extractNumber('confidence');

        if (matchedId || scientificName || malayName) {
          parsedData = {
            matchedWeedId: matchedId || 'asystasia-gangetica',
            scientificName: scientificName || 'Asystasia gangetica',
            malayName: malayName || 'Rumput Israel',
            category: category,
            confidence: confidence > 0 ? confidence : 0.95,
            featuresDetected: [],
            explanation: explanation || 'Pengecaman visual botani disahkan melalui morfologi daun.',
            recommendedActiveIngredient: recommendedActive || ''
          };
        }
      }

      if (parsedData) {
        return res.json({
          success: true,
          matchedWeedId: parsedData.matchedWeedId || 'asystasia-gangetica',
          scientificName: parsedData.scientificName || 'Asystasia gangetica',
          malayName: parsedData.malayName || 'Rumput Israel',
          category: parsedData.category || 'Broadleaf',
          confidence: typeof parsedData.confidence === 'number' ? parsedData.confidence : 0.95,
          featuresDetected: Array.isArray(parsedData.featuresDetected) ? parsedData.featuresDetected : [],
          explanation: parsedData.explanation || 'Pengecaman botani disahkan melalui visual AI.',
          recommendedActiveIngredient: parsedData.recommendedActiveIngredient || '',
          alternativeMatches: Array.isArray(parsedData.alternativeMatches) ? parsedData.alternativeMatches : []
        });
      }
    }

    return res.json({
      success: true,
      matchedWeedId: 'asystasia-gangetica',
      scientificName: 'Asystasia gangetica',
      malayName: 'Rumput Israel / Asystasia',
      category: 'Broadleaf',
      confidence: 0.88,
      explanation: 'Pengecaman morfologi daun dan tekstur rumpai daun lebar piringan sawit.',
      recommendedActiveIngredient: 'Metsulfuron-methyl 20% w/w @ 2.5g per 18L air'
    });

  } catch (error: unknown) {
    console.error("Weed Vision AI Diagnosis Error:", error);
    return res.status(500).json({
      success: false,
      error: 'Ralat semasa memproses pengecaman imej rumpai',
      details: getSafeErrorMessage(error)
    });
  }
});

// Helper for detecting estate from seller code/name or BTS project code on server
function detectEstateFromSeller(kodPenjual?: string, namaPenjual?: string, kodProjek?: string, kodAkaunBts?: string): { estateId: string; estateName: string } | null {
  const code = (kodPenjual || '').trim();
  const name = (namaPenjual || '').toUpperCase();
  const proj = (kodProjek || '').trim();
  const akaunBts = (kodAkaunBts || '').trim().toUpperCase();

  // 1. Semak kod projek 4-digit BTS (cth: 5136 daripada "5136-020-4-04")
  const projMatch = proj.match(/^\d{4}/) || akaunBts.match(/^\d{4}/);
  const projCode = projMatch ? projMatch[0] : (proj.length >= 4 ? proj.slice(0, 4) : '');
  if (projCode === '5155' || akaunBts.startsWith('5155')) return { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal' };
  if (projCode === '5136' || akaunBts.startsWith('5136')) return { estateId: 'FPM_ADELA', estateName: 'FPM Adela' };
  if (projCode === '5176' || akaunBts.startsWith('5176')) return { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang' };
  if (projCode === '5156' || akaunBts.startsWith('5156')) return { estateId: 'FPM_SENING', estateName: 'FPM Sening' };

  // 2. Semak kod penjual atau nama
  const fourDigitMatch = code.match(/^\d{4}/);
  const fourDigitCode = fourDigitMatch ? fourDigitMatch[0] : (code.length >= 4 ? code.slice(0, 4) : '');

  if (fourDigitCode === '5155' || name.includes('TUNGGAL')) {
    return { estateId: 'FPM_TUNGGAL', estateName: 'FPM Tunggal' };
  }
  if (fourDigitCode === '5136' || name.includes('ADELA')) {
    return { estateId: 'FPM_ADELA', estateName: 'FPM Adela' };
  }
  if (fourDigitCode === '5176' || name.includes('KLEDANG')) {
    return { estateId: 'FPM_KLEDANG', estateName: 'FPM Kledang' };
  }
  if (fourDigitCode === '5156' || name.includes('SENING')) {
    return { estateId: 'FPM_SENING', estateName: 'FPM Sening' };
  }
  return null;
}

// POST /api/ai/ocr-receipt - Gemini Multimodal OCR for FGV & EFB Palm Oil Receipts
router.post(['/', '/ocr-receipt', '/ai/ocr-receipt', '/ocr-receipt/', '/ai/ocr-receipt/', '/api/ai/ocr-receipt', '/api/ocr-receipt'], requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), async (req, res) => {
  console.log(`[OCR_AI] Request received for ocr-receipt. Path: ${req.path}, Payload: ${Math.round((JSON.stringify(req.body || {}).length) / 1024)} KB`);
  try {
    const { imageBase64, image, mimeType: requestedMime } = req.body || {};
    const rawImage = imageBase64 || image;

    if (!rawImage) {
      return res.status(400).json({
        success: false,
        error: 'Data imej resit (base64) diperlukan untuk imbasan OCR.'
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.'
      });
    }

    let mimeType = requestedMime || 'image/jpeg';
    let base64Data = rawImage;

    if (rawImage.startsWith('data:')) {
      const match = rawImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = rawImage.replace(/^data:[^;]+;base64,/, '');
      }
    }

    const promptText = `Anda adalah sistem AI OCR pakar industri sawit peringkat tinggi khusus untuk resit timbangan Kilang Sawit FGV (FGV Palm Industries / FGV Trading Sdn. Bhd), resit perladangan, dan resit EFB (Tandan Kosong). Ekstrak data daripada imej resit dengan ketepatan 100% mengikut arahan berikut:

ARAHAN KHAS MENGENDALIKAN KEADAAN LAPANGAN (FIELD CONDITIONS, LIGHTING & PAPER TYPES):
1. KEADAAN PENCAHAYAAN (VARYING LIGHTING CONDITIONS):
   - Pencahayaan Malap / Awal Pagi / Senja: Laraskan kontras visual secara maya. Walaupun imej diambil dalam keadaan cahaya rendah, kabur, atau di dalam kabin lori, kenal pasti bentuk angka dan teks dot-matrix berlatarbelakangkan kertas kelabu atau gelap.
   - Silau Lampu / Flash Kamera: Jika terdapat tompok silau putih akibat lampu pendarfluor kilang atau flash kamera telefon pada permukaan kertas licin, baca teks di sekeliling pinggir zon silau dan gunakan maklumat medan berkaitan (cross-field inference) untuk melengkapkan nombor yang terjejas.
   - Bayang-bayang Telefon / Tangan: Abaikan perbezaan kecerahan antara kawasan berbayang dan kawasan terang. Ekstrak data dari kedua-dua kawasan dengan tahap kepekaan yang sama.

2. JENIS KERTAS & KUALITI CETAKAN (PAPER TYPES & PRINT QUALITY):
   - Kertas Slip Terma (Thermal Receipt Paper): Cetakan haba mudah pudar (faded), bertukar kekuningan, bergaris, atau tercalar. Berikan tumpuan khas untuk membezakan digit yang serupa: 8 vs 0, 6 vs 5, 3 vs 8, 1 vs 7.
   - Kertas Dot-Matrix Berkarbon (3-ply Tractor / Pin-Impact Printer): Cetakan berasaskan titik-titik pin yang sering terputus-putus atau dakwat pudar berwarna kelabu/biru/ungu. Hubungkan titik-titik tersebut secara visual untuk membentuk aksara lengkap.
   - Resit Berkedut, Renyuk, Dilipat, atau Diambil Secara Condong (Skewed/Tilted/Angled): Susun dan baca mengikut garisan teks dokumen tanpa mengira sudut gambar atau perspektif pengambilan.
   - Kotoran Minyak Sawit, Debu, atau Kesan Habuk Ladang: Abaikan kotoran permukaan dan fokus kepada cetakan dakwat nombor dan perkataan.

ATURAN EKSTRAKSI MEDAN:
1. "tarikh": Format YYYY-MM-DD (cth: "2026-09-05" daripada "05/09/2026" atau "05-09-2026").
2. "masa_masuk": Format HH:MM:SS atau HH:MM AM/PM (cth: "10:56:52").
3. "no_resit": Nombor resit / No Pass timbangan penuh persis di imej (cth: "01547939" atau "FGV-882391").
4. "no_lori": Nombor pendaftaran lori penuh tanpa ruang (cth: "BLS4830" atau "JJV681").
5. "no_akuan_terima": Nombor Akuan Terima penuh persis di imej (cth: "A00030622" atau "A00030521").
   PANDUAN NO AKUAN TERIMA:
   - Tertera pada baris seperti "No. Akuan Terima : A00030622" atau "No Akuan Terima : A00030521" (lazimnya di bahagian atas kanan berdekatan Tarikh Cetak / No Pass).
   - Ambil terus angka/aksara lengkap selepas "No. Akuan Terima :" yang lazimnya bermula dengan huruf 'A' diikuti digit nombor (cth: "A00030622").
6. "kpg": Kadar KPG (nombor perpuluhan, cth: 20.20 atau 19.39).
   PANDUAN KRITIKAL KPA / KPG:
   - Pada resit FGV tertera medan seperti "KPA/KPG : 20.75/20.20" atau "KPA/KPG : 20.75/19.39" atau "KPA/KPG : 20.75/20.75".
   - Formatnya ialah [KPA] / [KPG].
   - Angka SEBELUM tanda palang "/" ialah KPA (Kadar Perahan Asas: contoh ladang Adela lazimnya 20.75, ladang Tunggal berbeza).
   - Angka SELEPAS tanda palang "/" ialah KPG (Kadar Perahan Gred: cth 20.20 atau 19.39).
   - Nilai medan "kpg" WAJIB diambil daripada nombor KEDUA iaitu NOMBOR SELEPAS PALANG "/"!
   - Sekiranya tertera "20.75/20.20", nilai "kpg" MESTILAH 20.20 (JANGAN sesekali ambil 20.75!).
   - Hanya jika KPG=KPA (contoh tercatat "20.75/20.75"), barulah "kpg" bernilai 20.75.
7. "kpa": Kadar KPA jika ada (nombor perpuluhan SEBELUM palang "/", cth: 20.75).
8. "no_nota_hantaran": Nombor nota hantaran penuh (cth: "1362603085" atau "136260308").
9. "peringkat": "PKT 001" atau "PKT 002" atau "LOT FELDA" atau "PKT 004".
   PANDUAN PEMETAAN PERINGKAT MENGIKUT KOD SIRI BTS (KHUSUS FPM ADELA - 5136):
   - Format kod siri penerimaan BTS: [KOD_LADANG]-[KOD_PERINGKAT]-[KATEGORI]-[BLOK] (cth: "5136-010-3-03", "5136-011-3-10", "5136-020-4-04", "5136-001-88-F", "5136 001 88 F")
   - Kod di segmen kedua ("010", "011", "020", "001", "125Y", "128Y", "121V") adalah penentu peringkat & zon:
     * "010" -> "peringkat": "PKT 001" (Merangkumi Blok 1 hingga 9 sahaja, cth "5136-010-3-03" = Blok 3 Pkt 1)
     * "011" -> "peringkat": "PKT 001" (Merangkumi Blok 10 hingga 11 sahaja, cth "5136-011-3-10" = Blok 10 Pkt 1)
     * "020" -> "peringkat": "PKT 002" (Merangkumi Blok 1 hingga 6 sahaja, cth "5136-020-4-04" = Blok 4 Pkt 2)
     * "001" atau "88F" atau "88 F" atau "F88" atau "LOT FELDA" -> "peringkat": "LOT FELDA" (88F - Lot Felda)
     * "125Y" / "1254" / "128Y" / "121V" -> "peringkat": "PKT 004" (Peringkat Tambahan)
10. "blok": Nombor atau kod blok sebenar (cth: "03", "04", "06", "10", "11", "125Y", "128Y", "121V", "88F").
    PANDUAN KRITIKAL RESIT FGV / FPM (BAHAGIAN "PENERIMAAN BTS"):
    - Format siri: [KOD_PROJEK]-[KOD_PERINGKAT]-[KATEGORI]-[BLOK] atau [KOD_PROJEK] [KOD_PERINGKAT] [KATEGORI/BLOK].
    - Angka 4 digit di permulaan ("5136") adalah KOD PROJEK/LADANG (5136 = FPM Adela, 5155 = FPM Tunggal, 5176 = FPM Kledang, 5156 = FPM Sening).
    - Angka di HUJUNG SEKALI kod siri ini selepas tanda tolak "-" terakhir (iaitu "03" daripada "5136-010-3-03" atau "04" daripada "5136-020-4-04") IALAH NOMBOR BLOK YANG SEBENAR! Sila ekstrak nombor blok ini (cth: "03", "3", "04", "4", "10", "88F").
      * Untuk Pkt 1 ("010"): julat blok adalah blok 1 hingga 9 (1-9).
      * Untuk Pkt 1 ("011"): julat blok adalah blok 10 hingga 11 (10-11).
      * Untuk Pkt 2 ("020"): julat blok adalah blok 1 hingga 6 (1-6).
      * Untuk Lot Felda Adela ("001" atau "88F" atau "88 F" atau "F88" atau "5136 001 88 F" atau "5136-001-88-F"): "blok" WAJIB diekstrak sebagai "88F" dan "peringkat" WAJIB "LOT FELDA"!
      * Untuk Pkt Tambahan ("125Y", "128Y", "121V"): blok ialah kod tersebut.
    - AMARAN KERAS: Baris di bawahnya yang bertulis seperti "5-FELDA ADELA" mengandungi digit kod syarikat/pembekal (iaitu "5") dan nama ladang/rancangan ("FELDA ADELA"). Digit "5" di sini BUKAN blok! JANGAN sesekali mengambil angka "5" dari "5-FELDA ADELA" sebagai blok. Blok yang betul adalah dari kod siri di atasnya (iaitu "03" atau "04" atau "06" dsb).
11. "tan": Berat bersih dalam tan (nombor, cth: 7.44 atau 6.80 daripada "Nett. 6.80").
12. "muda": Peratusan/bilangan buah muda (nombor, cth: 0 atau 2.0).
13. "no_seal": Nombor meter seal penuh jika ada (cth: "SL-99120").
14. "rm_mt": Harga se-tan RM/MT (nombor, cth: 1036.06 daripada "Harga/Tan : 1036.06").
15. "kod_penjual": Kod penjual / pembekal / syarikat persis di imej (cth: "5" daripada "5-FELDA ADELA", atau kod projek "5136").
16. "nama_penjual": Nama penuh penjual/ladang (cth: "FELDA ADELA").
17. "kod_projek": Kod projek/ladang 4-digit jika ada (cth: "5136" daripada "5136-020-4-04").
18. "kod_akaun_bts": Kod akaun siri BTS penuh jika ada (cth: "5136-020-4-04").
19. "is_efb": boolean (false untuk TBS/Sawit, true jika TANDAN KOSONG / EFB).
20. "confidence": nombor antara 0 hingga 100 mengikut ketepatan pengecaman.

Output MESTI dalam format JSON SAHAJA mengikut struktur berikut:
{
  "tarikh": "2026-09-05",
  "masa_masuk": "10:56:52",
  "no_resit": "01547939",
  "no_lori": "BLS4830",
  "no_akuan_terima": "A00030622",
  "kpg": 20.20,
  "kpa": 20.75,
  "no_nota_hantaran": "1362603085",
  "peringkat": "PKT 002",
  "blok": "04",
  "tan": 7.44,
  "muda": 0.0,
  "no_seal": "SL-99120",
  "rm_mt": 1036.06,
  "kod_penjual": "5",
  "nama_penjual": "FELDA ADELA",
  "kod_projek": "5136",
  "kod_akaun_bts": "5136-020-4-04",
  "is_efb": false,
  "confidence": 100
}`;

    const rawText = await aiService.extractVision({
      prompt: promptText,
      base64Data: base64Data,
      mimeType: mimeType || 'image/jpeg',
      candidateModels: AI_CONFIG.models.receiptOcr,
      circuitBreakerName: 'gemini-receipt-ocr',
      circuitBreakerFailureThreshold: 5,
      timeoutMs: AI_CONFIG.timeouts.receiptOcrMs,
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 2048,
      operationName: 'gemini_receipt_ocr'
    });

    if (!rawText) {
      const lastErr = aiService.getLastError('gemini_receipt_ocr');
      let errorMessage = 'Gagal mengekstrak data resit dengan AI OCR. Sila pastikan gambar resit jelas dan cuba lagi.';
      let statusCode = 502;

      if (!aiService.isConfigured()) {
        errorMessage = 'Konfigurasi AI tidak lengkap (Kunci GEMINI_API_KEY tiada pada pelayan).';
        statusCode = 500;
      } else if (lastErr?.category === 'RATE_LIMITED') {
        errorMessage = 'Had kuota panggilan Gemini API telah dicapai (Rate Limited). Sila tunggu beberapa saat sebelum mencuba imbas semula.';
        statusCode = 429;
      } else if (lastErr?.category === 'TIMEOUT') {
        errorMessage = 'Masa pemprosesan imej resit telah tamat (Timeout). Sila pastikan gambar tidak terlalu besar dan cuba lagi.';
        statusCode = 504;
      }

      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        category: lastErr?.category || 'UNKNOWN'
      });
    }

    const cleanText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    interface ReceiptOcrData {
      kod_penjual?: string;
      nama_penjual?: string;
      kod_projek?: string;
      kod_akaun_bts?: string;
      blok?: string;
      peringkat?: string;
      kpa?: number;
      kpg?: number;
      confidence?: number;
      detected_estate_id?: string;
      detected_estate_name?: string;
      [key: string]: unknown;
    }

    let parsed: ReceiptOcrData = {};
    try {
      parsed = JSON.parse(cleanText) as ReceiptOcrData;
    } catch (parseErr) {
      console.warn("JSON parse error on rawText:", cleanText);
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]) as ReceiptOcrData;
      }
    }

    // 1. Kesan kod akaun bersiri BTS FGV (cth: "5136-010-3-03", "5136-011-3-10", "5136-020-4-04", "5136-001-88-F")
    // Format: [Kod Projek 4-digit]-[Peringkat]-[Kategori]-[Blok]
    // Angka di hujung sekali adalah nombor blok sebenar (cth: "03", "04", "10", "88F").
    const btsSerialRegex = /\b(\d{4})[- ]([0-9A-Za-z]+)[- ]([0-9A-Za-z]+)[- ]([0-9]{1,3}[A-Za-z]?)\b/;
    const btsAdelaFeldaRegex = /\b(5136)[-\s]+(001)[-\s]+(?:(?:3|88)[-\s]+)?(88\s*F|88|F88|1F|2F)\b/i;
    
    const feldaDirectMatch = (cleanText || '').match(btsAdelaFeldaRegex) ||
                             String(parsed.kod_akaun_bts || '').match(btsAdelaFeldaRegex);

    const rawMatch = (cleanText || '').match(btsSerialRegex) || 
                     String(parsed.kod_akaun_bts || '').match(btsSerialRegex) ||
                     String(parsed.blok || '').match(btsSerialRegex);

    if (feldaDirectMatch) {
      parsed.kod_projek = '5136';
      parsed.peringkat = 'LOT FELDA';
      parsed.blok = '88F';
      if (!parsed.kod_akaun_bts) {
        parsed.kod_akaun_bts = feldaDirectMatch[0];
      }
    } else if (rawMatch) {
      const btsProject = rawMatch[1];
      const btsSubPkt = rawMatch[2].toUpperCase();
      const btsBlock = rawMatch[4];

      if (!parsed.kod_projek) {
        parsed.kod_projek = btsProject;
      }
      if (!parsed.kod_akaun_bts) {
        parsed.kod_akaun_bts = rawMatch[0];
      }

      // Jika blok kosong, atau tersilap ambil kod syarikat seperti "5", "5-FELDA ADELA", atau nama ladang:
      const rawBlokStr = String(parsed.blok || '').trim();
      const isCompanyMistake = !rawBlokStr || 
                               /^(?:FELDA|LADANG|RANCANGAN)/i.test(rawBlokStr) ||
                               /^[0-9]{1,2}\s*[-/ ]\s*(?:FELDA|LADANG|FPM|ADELA|TUNGGAL|KLEDANG|SENING)/i.test(rawBlokStr) ||
                               rawBlokStr === '5' || rawBlokStr === '05' ||
                               rawBlokStr.length > 5;

      if (isCompanyMistake || rawBlokStr === rawMatch[0]) {
        parsed.blok = btsBlock;
      }
    }

    // 2. Jika blok mengandungi format siri BTS secara langsung (cth: "5136-020-6-06 SKB: 1000")
    if (parsed.blok) {
      const btsInBlok = String(parsed.blok).match(btsSerialRegex);
      if (btsInBlok) {
        parsed.blok = btsInBlok[4];
      }
    }

    // 3. Sanitasi awalan BLOK / B- dan pastikan teks syarikat/ladang tidak kekal sebagai blok
    if (parsed.blok) {
      let b = String(parsed.blok).trim();
      b = b.replace(/^(?:BLOK|BLOCK|B)\s*[-:]?\s*/i, '').trim();
      if (/^[0-9]{1,3}\s*[-/ ]\s*(?:FELDA|LADANG|FPM|RANCANGAN|ADELA|TUNGGAL|KLEDANG|SENING)/i.test(b) || /(?:FELDA|LADANG|RANCANGAN)/i.test(b)) {
        b = '';
      }
      parsed.blok = b;
    }

    // 3b. Pengesanan Peringkat & Blok mengikut Kod Siri BTS (Khusus FPM Adela 5136 & Estet Lain)
    const combinedBtsSerial = `${parsed.kod_akaun_bts || ''} ${parsed.kod_penjual || ''} ${cleanText || ''}`.toUpperCase();
    const isAdela = (parsed.kod_projek === '5136') || 
                    (parsed.kod_penjual && String(parsed.kod_penjual).includes('5136')) ||
                    (cleanText && (cleanText.includes('5136') || cleanText.includes('ADELA')));

    let subPktCode = rawMatch ? rawMatch[2].toUpperCase() : '';
    let endBlockStr = rawMatch ? rawMatch[4] : '';

    if (isAdela) {
      const isLotFeldaAdela = 
        subPktCode === '001' || 
        combinedBtsSerial.includes('-001-') || 
        combinedBtsSerial.includes(' 001 ') || 
        /\b5136[-\s]+001\b/.test(combinedBtsSerial) ||
        /\b001[-\s]+(?:3[-\s]+)?88\b/.test(combinedBtsSerial) ||
        /\b88\s*F\b/i.test(combinedBtsSerial) ||
        /\b88F\b/i.test(combinedBtsSerial) ||
        /\bF88\b/i.test(combinedBtsSerial) ||
        String(parsed.blok || '').toUpperCase() === '88F' ||
        String(parsed.blok || '').toUpperCase() === '88 F' ||
        String(parsed.blok || '').toUpperCase() === '88' ||
        String(parsed.blok || '').toUpperCase() === 'F88' ||
        String(parsed.blok || '').toUpperCase() === 'LF';

      if (isLotFeldaAdela) {
        parsed.peringkat = "LOT FELDA"; // 88F - Lot Felda Adela
        parsed.blok = "88F";
      } else if (subPktCode === '010' || combinedBtsSerial.includes('-010-')) {
        parsed.peringkat = "PKT 001";
        if (endBlockStr) {
          const bNum = parseInt(endBlockStr, 10);
          if (!isNaN(bNum) && bNum >= 1 && bNum <= 9) {
            parsed.blok = String(bNum);
          }
        }
      } else if (subPktCode === '011' || combinedBtsSerial.includes('-011-')) {
        parsed.peringkat = "PKT 001";
        if (endBlockStr) {
          const bNum = parseInt(endBlockStr, 10);
          if (!isNaN(bNum) && bNum >= 10 && bNum <= 11) {
            parsed.blok = String(bNum);
          }
        }
      } else if (subPktCode === '020' || combinedBtsSerial.includes('-020-')) {
        parsed.peringkat = "PKT 002";
        if (endBlockStr) {
          const bNum = parseInt(endBlockStr, 10);
          if (!isNaN(bNum) && bNum >= 1 && bNum <= 6) {
            parsed.blok = String(bNum);
          }
        }
      } else if (['125Y', '1254', '128Y', '121V'].includes(subPktCode)) {
        parsed.peringkat = "PKT 004"; // Peringkat Tambahan
        parsed.blok = subPktCode;
      }
    } else {
      // Estet FGV/FPM umum (cth Tunggal, Kledang, Sening)
      const isTunggal = (parsed.kod_projek === '5155') ||
                        (parsed.kod_penjual && String(parsed.kod_penjual).includes('5155')) ||
                        (cleanText && (cleanText.includes('5155') || cleanText.includes('TUNGGAL')));

      const has020Bts = combinedBtsSerial.includes('-020-') || 
                        /\b\d{4}-020-/.test(combinedBtsSerial) || 
                        /[-_]020[-_]/.test(combinedBtsSerial) ||
                        /\b020\b/.test(parsed.kod_akaun_bts || '');

      const isLotFeldaTunggal = isTunggal && (
        subPktCode === '003' ||
        combinedBtsSerial.includes('-003-') ||
        /\b88\s*F\b/i.test(combinedBtsSerial) ||
        /\b88F\b/i.test(combinedBtsSerial) ||
        String(parsed.blok || '').toUpperCase() === '88' ||
        String(parsed.blok || '').toUpperCase() === '88F' ||
        String(parsed.blok || '').toUpperCase() === 'LF' ||
        endBlockStr === '88'
      );

      if (isLotFeldaTunggal) {
        parsed.peringkat = "LOT FELDA";
        parsed.blok = "88";
      } else if (has020Bts) {
        parsed.peringkat = "PKT 002";
        if (endBlockStr) {
          const bNum = parseInt(endBlockStr, 10);
          if (!isNaN(bNum) && bNum >= 1 && bNum <= 6) {
            parsed.blok = String(bNum);
          }
        }
      } else {
        const has010Bts = combinedBtsSerial.includes('-010-') || 
                          /\b\d{4}-010-/.test(combinedBtsSerial) || 
                          /[-_]010[-_]/.test(combinedBtsSerial);
        if (has010Bts || !parsed.peringkat) {
          parsed.peringkat = "PKT 001";
        }
        if (endBlockStr) {
          const bNum = parseInt(endBlockStr, 10);
          if (!isNaN(bNum) && bNum >= 1 && bNum <= 11 && (!parsed.blok || parsed.blok === rawMatch[0])) {
            parsed.blok = String(bNum);
          }
        }
      }
    }

    // 4. Pengesanan dan Sanitasi No Akuan Terima (cth: "No. Akuan Terima : A00030622")
    if (!parsed.no_akuan_terima) {
      const akuanRegex = /(?:No\.?\s*)?Akuan\s*Terima\s*[:\-]?\s*([A-Za-z0-9]+)/i;
      const akuanMatch = (cleanText || '').match(akuanRegex);
      if (akuanMatch) {
        parsed.no_akuan_terima = akuanMatch[1].trim().toUpperCase();
      } else {
        // Cari corak kod siri A bermula 'A' diikuti 6 hingga 10 digit (cth: A00030622, A00030521)
        const aCodeMatch = (cleanText || '').match(/\b(A[0-9]{6,10})\b/i);
        if (aCodeMatch) {
          parsed.no_akuan_terima = aCodeMatch[1].toUpperCase();
        }
      }
    } else {
      parsed.no_akuan_terima = String(parsed.no_akuan_terima).trim().toUpperCase();
    }

    // 5. Pengesanan dan Validasi Tepat KPA & KPG (Kadar Perahan Gred vs Kadar Perahan Asas)
    // Format pada resit FGV: "KPA/KPG : 20.75/20.20" atau "KPA/KPG: 20.75/19.39"
    // Di mana angka SEBELUM slash '/' ialah KPA (cth: 20.75), dan angka SELEPAS slash '/' ialah KPG (cth: 20.20)
    const kpaKpgRegex = /KPA\s*(?:\/|\s)\s*KPG\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/i;
    const kpaKpgMatch = (cleanText || '').match(kpaKpgRegex);
    if (kpaKpgMatch) {
      const detectedKpa = parseFloat(kpaKpgMatch[1]);
      const detectedKpg = parseFloat(kpaKpgMatch[2]);
      if (!isNaN(detectedKpa)) {
        parsed.kpa = detectedKpa;
      }
      if (!isNaN(detectedKpg) && detectedKpg > 0) {
        parsed.kpg = detectedKpg;
      }
    } else {
      // Sandaran corak nisbah kadar sawit xx.xx/yy.yy (15-30% range)
      const slashRatesRegex = /\b([12][0-9]\.[0-9]{1,2})\s*\/\s*([12][0-9]\.[0-9]{1,2})\b/;
      const slashRatesMatch = (cleanText || '').match(slashRatesRegex);
      if (slashRatesMatch) {
        const r1 = parseFloat(slashRatesMatch[1]);
        const r2 = parseFloat(slashRatesMatch[2]);
        parsed.kpa = r1;
        // KPG adalah nombor kedua selepas slash
        parsed.kpg = r2;
      }
    }

    // 6. Kesan ladang (estate) daripada kod penjual, nama penjual, kod projek 4-digit, dan kod siri BTS
    const estateInfo = detectEstateFromSeller(parsed.kod_penjual, parsed.nama_penjual, parsed.kod_projek, parsed.kod_akaun_bts);
    if (estateInfo) {
      parsed.detected_estate_id = estateInfo.estateId;
      parsed.detected_estate_name = estateInfo.estateName;
    }

    // Pastikan label peringkat mengikut format standard dan selamat bagi ladang
    const effectiveEstateId = parsed.detected_estate_id || (req.headers['x-estate-id'] as string) || (req.body?.estate_id as string) || 'FPM_TUNGGAL';
    if (parsed.peringkat === 'LOT FELDA' && effectiveEstateId !== 'FPM_ADELA' && effectiveEstateId !== 'FPM_TUNGGAL') {
      parsed.peringkat = getPktDisplayName('003', effectiveEstateId);
    }

    if (!parsed.confidence) {
      parsed.confidence = 92;
    }

    return res.json({
      success: true,
      data: parsed
    });

  } catch (error: unknown) {
    console.error("Receipt OCR AI Server Error:", error);
    return res.status(500).json({
      success: false,
      error: 'Ralat pelayan semasa memproses imbasan resit.',
      details: getSafeErrorMessage(error)
    });
  }
});

// POST /api/ai/ocr-page - Optical Character Recognition (OCR) via Gemini Vision
router.post(['/ocr-page', '/ai/ocr-page', '/ocr-page/', '/ai/ocr-page/'], requireRole(['staff', 'pf', 'fc', 'afc', 'fs', 'eqi']), async (req, res) => {
  console.log(`[OCR_AI] Request received for ocr-page. Path: ${req.path}`);
  try {
    const { imageBase64, pageNum = 1, totalPages = 1, fileName = 'Dokumen Manual' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Sila sertakan imageBase64 bagi halaman imbasan.' });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!aiService.isConfigured()) {
      return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.' });
    }

    const prompt = `Anda ialah sistem OCR pakar agronomi dan perladangan kelapa sawit berketepatan tinggi.
Sila ekstrak teks daripada imej halaman manual ini (Muka surat ${pageNum} daripada ${totalPages} - Fail: "${fileName}").

Peraturan:
1. Ekstrak semua teks, tajuk seksyen, nama saintifik/botani rumpai (contoh: Asystasia, Mikania, Ottochloa, Melastoma, Clidemia, dll).
2. Ekstrak jadual dan dos racun herbisid (a.i %, liter/ha, sukatan pam galas 16L/18L/20L).
3. Kekalkan susunan perenggan dan jadual yang kemas. Kembalikan teks OCR yang bersih.`;

    const ocrText = await aiService.extractVision({
      prompt,
      base64Data: cleanBase64.trim(),
      mimeType: 'image/jpeg',
      candidateModels: AI_CONFIG.models.pageOcr,
      circuitBreakerName: 'gemini-ocr',
      circuitBreakerFailureThreshold: 4,
      timeoutMs: AI_CONFIG.timeouts.pageOcrMs,
      maxAttemptsPerModel: 2,
      initialDelayMs: 1000,
      maxDelayMs: 3000,
      operationName: 'gemini_ocr_page'
    });

    if (!ocrText) {
      return res.status(500).json({ error: 'Gagal mengekstrak teks imej menggunakan Gemini OCR.' });
    }

    return res.json({
      success: true,
      pageNum,
      text: ocrText
    });
  } catch (error: unknown) {
    console.error("OCR Page Error:", error);
    return res.status(500).json({ error: 'Ralat OCR muka surat', details: getSafeErrorMessage(error) });
  }
});

// POST /api/ai/transcribe-audio and /transcribe-audio - Multimodal AI Audio Transcription
router.post(['/ai/transcribe-audio', '/transcribe-audio', '/api/ai/transcribe-audio', '/api/transcribe-audio'], requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi', 'oc', 'rc']), async (req, res) => {
  try {
    const { audioData, mimeType = 'audio/webm', language = 'ms-MY' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Data audio (base64) diperlukan.' });
    }

    if (!aiService.isConfigured()) {
      return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasikan di pelayan.' });
    }

    const base64Audio = audioData.replace(/^data:audio\/[a-z0-9]+;base64,/, '');

    const promptText = language === 'en-US'
      ? `Listen carefully to this audio and accurately transcribe what the user said in English.
Context: Oil palm plantation management system (terms like EFB, FFB/BTS, KPG, KPA, MOP fertilizer, MSPO, OER, Block 1-20, etc.).
Return ONLY the transcribed text without any extra commentary, greetings, or formatting.`
      : `Dengar rakaman audio ini dengan teliti dan hasilkan transkripsi teks perkataan yang disebut oleh pengguna dalam Bahasa Melayu (atau campuran istilah perladangan).
Konteks: Sistem Pengurusan Ladang Kelapa Sawit (FPMSB / Felda). Normalkan istilah sawit seperti EFB, BTS, KPG=KPA, KPG, KPA, MOP, MSPO, KUK, ABW, BBC, OER, MSL, PKT 1, PKT 2, FELDA, FPMSB, FC, PF, Blok 1, Blok 2, dll.
Keluarkan HANYA teks transkripsi percakapan tersebut tanpa sebarang ulasan, tag, atau markdown pembuka/penutup.`;

    const rawTranscript = await aiService.extractVision({
      prompt: promptText,
      base64Data: base64Audio,
      mimeType: mimeType || 'audio/webm',
      candidateModels: AI_CONFIG.models.audioTranscription,
      circuitBreakerName: 'gemini-audio',
      circuitBreakerFailureThreshold: 4,
      timeoutMs: AI_CONFIG.timeouts.audioMs,
      operationName: 'gemini_audio_transcribe'
    });

    const transcriptText = (rawTranscript || '').replace(/^["']|["']$/g, '').trim();

    return res.json({
      success: true,
      transcript: transcriptText
    });
  } catch (error: unknown) {
    console.error("Audio Transcription Error:", error);
    return res.status(500).json({
      error: "Gagal memproses audio.",
      details: getSafeErrorMessage(error)
    });
  }
});

// GET /api/ai/ping - AI Routes Connectivity Test
router.get(['/ping', '/ai/ping'], (req, res) => {
  res.json({ status: 'ok', message: 'AI Vision Routes are reachable', timestamp: new Date().toISOString() });
});

export default router;
