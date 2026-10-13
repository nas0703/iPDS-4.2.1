import { detectEstateFromSeller, verifyReceiptEstate } from '../../../src/features/input/services/ocrService.js';

export async function runOcr3StepEstateVerificationTests() {
  console.log('\n----------------------------------------------------');
  console.log('MODULE: OCR 3-STEP ESTATE VERIFICATION & CROSS-BORDER TESTS');
  console.log('----------------------------------------------------');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
    }
  }

  // 1. Ujian Langkah 1: Semakan Sesi Semasa
  const sessionTunggal = verifyReceiptEstate('FPM_TUNGGAL', {
    kod_penjual_4digit: '5155',
    nama_penjual: '5-FELDA TUNGGAL',
  });
  assert(sessionTunggal.sessionEstateId === 'FPM_TUNGGAL', 'Langkah 1: Sesi login FPM Tunggal dikesan dengan tepat');
  assert(sessionTunggal.sessionCode === '5155', 'Langkah 1: Kod numeric sesi Tunggal ialah 5155');

  const sessionAdela = verifyReceiptEstate('FPM_ADELA', {
    kod_penjual_4digit: '5136',
    nama_penjual: '5-FELDA ADELA',
  });
  assert(sessionAdela.sessionEstateId === 'FPM_ADELA', 'Langkah 1: Sesi login FPM Adela dikesan dengan tepat');
  assert(sessionAdela.sessionCode === '5136', 'Langkah 1: Kod numeric sesi Adela ialah 5136');

  // 2. Ujian Langkah 2: Semakan 4-Digit Pertama pada Row Penjual
  const detectedTunggal = detectEstateFromSeller('5155-010-3-03', '5-FELDA TUNGGAL');
  assert(detectedTunggal?.estateId === 'FPM_TUNGGAL' && detectedTunggal?.code === '5155', 'Langkah 2: 4-digit "5155" pada row penjual mengecam Ladang Tunggal');

  const detectedAdela = detectEstateFromSeller('5136-020-4-04', '5-FELDA ADELA');
  assert(detectedAdela?.estateId === 'FPM_ADELA' && detectedAdela?.code === '5136', 'Langkah 2: 4-digit "5136" pada row penjual mengecam Ladang Adela');

  const detectedKledang = detectEstateFromSeller('5176-010-3-01', 'FELDA KLEDANG');
  assert(detectedKledang?.estateId === 'FPM_KLEDANG' && detectedKledang?.code === '5176', 'Langkah 2: 4-digit "5176" pada row penjual mengecam Ladang Kledang');

  const detectedSening = detectEstateFromSeller('5156-010-3-02', 'FELDA SENING');
  assert(detectedSening?.estateId === 'FPM_SENING' && detectedSening?.code === '5156', 'Langkah 2: 4-digit "5156" pada row penjual mengecam Ladang Sening');

  // 3. Ujian Langkah 3: Pengesahan Nama Penjual
  const nameVerifyTunggal = verifyReceiptEstate('FPM_TUNGGAL', {
    kod_akaun_bts: '5155-010-3-03',
    nama_penjual: '5-FELDA TUNGGAL',
  });
  assert(nameVerifyTunggal.step3NameCheck.matchedEstateId === 'FPM_TUNGGAL', 'Langkah 3: Nama "5-FELDA TUNGGAL" disahkan milik Ladang Tunggal');

  const nameVerifyAdela = verifyReceiptEstate('FPM_ADELA', {
    kod_akaun_bts: '5136-020-4-04',
    nama_penjual: '5-FELDA ADELA',
  });
  assert(nameVerifyAdela.step3NameCheck.matchedEstateId === 'FPM_ADELA', 'Langkah 3: Nama "5-FELDA ADELA" disahkan milik Ladang Adela');

  // 4. Ujian Kes Gambar Pengguna (IMG-20261012-WA0044.jpg)
  // Resit ditimbang di Kilang Sawit Adela (4039), tetapi baris penjual bermula 5155 & nama 5-FELDA TUNGGAL
  const realUserReceiptData = {
    no_resit: '01551869',
    no_akuan_terima: 'A00035758',
    kod_penjual: '5155',
    kod_penjual_4digit: '5155',
    kod_akaun_bts: '5155-010-3-03',
    nama_penjual: '5-FELDA TUNGGAL',
  };

  // 4a. Jika sesi Tunggal imbas resit Tunggal -> SEPADAN (MATCHED 3/3)
  const resultMatching = verifyReceiptEstate('FPM_TUNGGAL', realUserReceiptData);
  assert(resultMatching.status === 'MATCHED', 'Resit Tunggal sepadan dengan sesi Tunggal (MATCHED 3/3)');
  assert(resultMatching.isMatch === true, 'isMatch bernilai true untuk padanan sah');
  assert(resultMatching.detectedEstateId === 'FPM_TUNGGAL', 'Ladang dikesan adalah FPM_TUNGGAL walaupun ditimbang di Kilang Sawit Adela');

  // 4b. Jika sesi Adela imbas resit Tunggal -> TIDAK SEPADAN (MISMATCH & SEKATAN RENTAS LADANG)
  const resultMismatch = verifyReceiptEstate('FPM_ADELA', realUserReceiptData);
  assert(resultMismatch.status === 'MISMATCH', 'Resit Tunggal yang diimbas semasa sesi Adela dikesan sebagai MISMATCH');
  assert(resultMismatch.isMatch === false, 'isMatch bernilai false untuk menghalang percampuran pangkalan data');
  assert(resultMismatch.message.includes('SEKATAN PERSEMPADAN LADANG'), 'Mesej amaran sekatan persempadan ladang dijana');

  // 4c. Jika sesi Wilayah / HQ imbas resit Tunggal -> DIBENARKAN RENTAS LADANG
  const resultHq = verifyReceiptEstate('WILAYAH_JB', realUserReceiptData);
  assert(resultHq.status === 'CROSS_ESTATE_PERMITTED', 'Sesi Wilayah Johor Bahru dibenarkan mengimbas resit mana-mana ladang');
  assert(resultHq.isMatch === true, 'isMatch bernilai true untuk pegawai wilayah / Super Admin');

  return { passed, total };
}

if (process.env.RUN_STANDALONE) {
  runOcr3StepEstateVerificationTests().then(({ passed, total }) => {
    if (passed === total) {
      console.log(`\nALL ${total} TESTS PASSED!`);
      process.exit(0);
    } else {
      console.error(`\n${total - passed} TESTS FAILED!`);
      process.exit(1);
    }
  });
}
