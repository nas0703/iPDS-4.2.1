export interface PlatformGradingData {
  id: string;
  platformNo: number; // e.g. 1, 2, 3
  
  // Counts
  tandanDiGred: number;
  tandanDiTinggal: number;
  tandanDiBawa: number;
  
  // Reject
  rejectMuda: number;
  rejectMudaUnit: 'T' | 'B';
  rejectPeram: number;
  rejectPeramUnit: 'T' | 'B';
  
  // Penalti
  penaltiMengkal: number;
  penaltiMengkalUnit: 'T' | 'B';
  penaltiBusuk: number;
  penaltiBusukUnit: 'T' | 'B';
  penaltiKosong: number;
  penaltiKosongUnit: 'T' | 'B';
  
  // Other Parameters
  kotor: number;
  lama: number;
  dura: number;
  tangkaiPanjang: number; // T.Panjang (Dipotong)
  masak: number;
  seranganTikus: number;
  
  notes?: string;
}

export interface BlockGradingSession {
  id: string;
  tajuk: string; // e.g. "*JPPK KS 𝘼𝘿𝙀𝙇𝘼*"
  program: string; // e.g. "𝙏𝙖𝙨𝙠 𝙁𝙤𝙧𝙘𝙚 𝙂𝙧𝙖𝙙𝙞𝙣𝙜"
  jenisGrading: string; // e.g. "𝙂𝙧𝙖𝙙𝙞𝙣𝙜 𝘿𝙞 𝙡𝙖𝙙𝙖𝙣𝙜"
  tarikh: string; // e.g. "05/08/26"
  ladang: string; // e.g. "FPMTunggal"
  peringkatBlok: string; // e.g. "02/17"
  noLori: string; // e.g. "JGK 1917"
  namaPenggred: string; // e.g. "GIANTARA"
  gradingTaskId?: string;
  platforms: PlatformGradingData[];
  createdAt: string;
  _isPendingSync?: boolean;
}

export { normalizeLorryNo } from '../../../utils/gradingRules';
