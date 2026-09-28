import React, { useState, useEffect } from 'react';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { Worker, AttendanceRecord, WorkAssignment } from '../types';
import { getWorkers, getAttendanceForDate, getWorkAssignmentsForDate } from '../services';
import { printReport } from '../../../utils/printHelper';
import ExcelJS from 'exceljs';
import { 
  Calendar as CalendarIcon, Printer, Download, RefreshCw, Layers, Users, ShieldAlert, CheckSquare, Edit3, Trash2, CheckCircle2, UserCheck, AlertOctagon, FileSpreadsheet
} from 'lucide-react';

interface MusterChitViewProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

// Fixed metadata for activities based on paper & KUK Siri 8
const MUSTER_ACTIVITIES = [
  { id: 'MENUAI', label: 'MENUAI', matchKeywords: ['menuai', 'harvest', 'tuai', 'harvester', 'cantas', 'maic', 'aaic', 'bts'] },
  { id: 'MERUMPUT', label: 'MERUMPUT', matchKeywords: ['merumput', 'racun', 'sembur', 'rumput', 'tebas', 'bulatan', 'circle', 'dada', 'lorong', 'hamparan', 'blanket'] },
  { id: 'MEMBAJA', label: 'MEMBAJA', matchKeywords: ['membaja', 'baja', 'pembaja', 'spreader', 'separa mekanisasi', 'mekanisasi', 'tabur beg', 'angkut baja'] },
  { id: 'PRUNNING', label: 'PRUNNING', matchKeywords: ['pruning', 'prunning', 'pangkas', 'pemangkasan', 'pelepah'] },
  { id: 'SUSUN_PELEPAH', label: 'SUSUN PELEPAH', matchKeywords: ['susun pelepah', 'susun'] },
  { id: 'EFB', label: 'EFB', matchKeywords: ['efb', 'sawit kosong', 'tandan kosong', 'tandan', 'mulching'] },
  { id: 'MANCAH', label: 'MANCAH', matchKeywords: ['mancah', 'injection', 'trunk injection'] },
  { id: 'BENEFICIAL_PLANT', label: 'BENEFICIAL PLANT', matchKeywords: ['beneficial', 'bunga', 'plant', 'tanaman', 'turnera', 'faedah'] },
  { id: 'CUCI_CULVERT', label: 'CUCI CULVERT', matchKeywords: ['culvert', 'parit', 'longkang', 'cuci', 'pembetung'] },
  { id: 'KUTIP_BIJI', label: 'KUTIP BIJI', matchKeywords: ['kutip', 'biji', 'lerai', 'mengutip', 'relai'] },
  { id: 'MANDOR_LADANG', label: 'MANDOR LADANG', matchKeywords: ['mandor', 'penyelia', 'supervisor', 'penyeliaan'] },
  { id: 'EQI', label: 'EQI', matchKeywords: ['eqi', 'kualiti', 'gred', 'gredding', 'penggred', 'penggredan'] },
  { id: 'KAWALAN_PD', label: 'KAWALAN P&D', matchKeywords: ['p&d', 'kawalan', 'perosak', 'pd', 'bagworm', 'ulat', 'tikus'] },
  { id: 'LAIN_LAIN', label: 'LAIN-LAIN', matchKeywords: ['lain', 'am', 'pekerja', 'bancian', 'sulaman', 'ablasi', 'castration'] }
];

// Helper to determine sector code from block and peringkat identifier
const getSectorCodeFromBlock = (rawBlok: string, rawPeringkat?: string): string => {
  const b = (rawBlok || '').trim().toUpperCase();
  const p = (rawPeringkat || '').trim().toUpperCase();
  const upper = `${b} ${p}`.trim();

  if (!upper) return '1A';

  // Explicit LF 2 check
  if (upper.includes('LF 2') || upper.includes('LF2') || upper.includes('LF PKT 2') || upper.includes('LFPKT2') || upper.includes('PKT 2 LF') || upper.includes('PERINGKAT 2 LF')) {
    return 'LF2';
  }

  // Explicit LF 1 / LF PKT / Blok 88 / PKT 3 check
  if (
    upper.includes('LF 1') || upper.includes('LF1') || upper.includes('LF PKT 1') || upper.includes('LFPKT1') ||
    upper.includes('LF PKT') || upper.includes('LFPKT') || upper.includes('LF') ||
    upper.includes('88') || upper.includes('BLOK 88') || upper.includes('BLOK88') ||
    upper.includes('PKT 3') || upper.includes('PKT. 3') || upper.includes('PKT3')
  ) {
    return 'LF1';
  }

  // Explicit sector checks
  if (upper.includes('1A') || upper.includes('PKT 1A') || upper.includes('SEKTOR 1A')) return '1A';
  if (upper.includes('1B') || upper.includes('PKT 1B') || upper.includes('SEKTOR 1B')) return '1B';
  if (upper.includes('1C') || upper.includes('PKT 1C') || upper.includes('SEKTOR 1C')) return '1C';
  if (upper.includes('1D') || upper.includes('PKT 1D') || upper.includes('SEKTOR 1D')) return 'LF1';
  if (upper.includes('PKT 2') || upper.includes('PKT 002') || upper.includes('PKT2') || upper.includes('SEKTOR 2') || upper.includes('SEKTOR2') || upper.includes('PERINGKAT 2')) return '2';

  // Extract digits for standard block numbers
  const matches = upper.match(/\d+/g);
  if (!matches || matches.length === 0) return 'LF1';

  const num = parseInt(matches[0], 10);
  if (num === 88) return 'LF1';
  if ((num >= 1 && num <= 3) || num === 5 || num === 6 || num === 7) return '1A';
  if (num === 4 || (num >= 8 && num <= 12)) return '1B';
  if (num >= 13 && num <= 17) return '1C';
  if (num >= 18 && num <= 22) return '2';

  return 'LF1';
};

// Fixed sectors aligned with real FPM TUNGGAL Muster Chit document
const SECTORS = [
  { code: '1A', label: '1A', area: '447.18' },
  { code: '1B', label: '1B', area: '466.74' },
  { code: '1C', label: '1C', area: '338.08' },
  { code: '2', label: 'PKT 2', area: '316.12' },
  { code: 'LF1', label: 'LF PKT', area: '51.71' },
  { code: 'LF2', label: 'LF PKT 2', area: '46.80' }
];

// Staff Duty Options
const STAFF_DUTY_LIST = [
  { name: 'MUHAMAD KIROMIN BIN ISMADI', title: 'Field Supervisor (FS)', label: 'MUHAMAD KIROMIN BIN ISMADI - FS' },
  { name: 'MD SASHRIL BIN TUMIJAN', title: 'Field Supervisor (FS)', label: 'MD SASHRIL BIN TUMIJAN - FS' },
  { name: 'MUHAMMAD ADIB HAZIM BIN HADIRON', title: 'Field Supervisor (FS)', label: 'MUHAMMAD ADIB HAZIM BIN HADIRON - FS' },
  { name: 'AZUWAN BIN ALI', title: 'Assistant Field Controller (AFC)', label: 'AZUWAN BIN ALI - AFC' }
];

// Helper functions to persist extra Muster Chit configuration per date
const saveLocalMusterChitData = (dateStr: string, data: Record<string, any>) => {
  try {
    const key = `fpm_muster_chit_extra_${dateStr}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const updated = { ...existing, ...data };
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving muster chit extra to localStorage', e);
  }
};

const getLocalMusterChitData = (dateStr: string) => {
  try {
    const key = `fpm_muster_chit_extra_${dateStr}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading muster chit extra from localStorage', e);
  }
  return null;
};

export const MusterChitView: React.FC<MusterChitViewProps> = ({ isDarkMode, onShowToast }) => {
  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);
  const [loading, setLoading] = useState(false);

  // Core Data loaded from Supabase for calculations
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);

  // Local editable grids for Muster Chit cells
  // Matrix structure: grid[activityId][sectorCode] = count
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>(() => {
    const initialGrid: Record<string, Record<string, number>> = {};
    MUSTER_ACTIVITIES.forEach(act => {
      initialGrid[act.id] = {};
      SECTORS.forEach(sec => {
        initialGrid[act.id][sec.code] = 0;
      });
    });
    return initialGrid;
  });

  // Additional editable fields to make it perfectly customisable
  const [perluMap, setPerluMap] = useState<Record<string, number>>({});
  const [catitanMap, setCatitanMap] = useState<Record<string, string>>({});

  // Kategori Pekerja editable summary states
  const [kategoriSummary, setKategoriSummary] = useState(() => {
    const activeEstate = getActiveEstateId();
    if (activeEstate === 'FPM_TUNGGAL') {
      return {
        tempatan: { total: 4, present: 3 },
        tki: { total: 20, present: 20 },
        tkin: { total: 9, present: 9 },
        tkn: { total: 1, present: 1 },
        kontraktor: { total: 60, present: 60 }
      };
    }
    return {
      tempatan: { total: 0, present: 0 },
      tki: { total: 0, present: 0 },
      tkin: { total: 0, present: 0 },
      tkn: { total: 0, present: 0 },
      kontraktor: { total: 0, present: 0 }
    };
  });

  // Absent reasons states
  const [absentReasons, setAbsentReasons] = useState({
    sakit: 0,
    ponteng: 1,
    lain: 0
  });

  // List of absent workers' names
  const [absentWorkers, setAbsentWorkers] = useState<string[]>([]);

  // Additional Notes / Catatan
  const [customNotes, setCustomNotes] = useState('');

  // Signature names (editable)
  const [preparedBy, setPreparedBy] = useState('MUHAMMAD ADIB HAZIM BIN HADIRON');
  const [preparedTitle, setPreparedTitle] = useState('Field Supervisor (FS)');
  const [verifiedBy, setVerifiedBy] = useState('MD NASRUDDIN BIN BHSERANI');
  const [verifiedTitle, setVerifiedTitle] = useState('FIELD CONTROLLER');

  // Load and auto-compute data
  const handleRefreshAndCompute = async () => {
    try {
      setLoading(true);
      const allWorkers = await getWorkers();
      const rawAttendance = await getAttendanceForDate(selectedDate);
      const rawAssignments = await getWorkAssignmentsForDate(selectedDate);

      setWorkers(allWorkers);
      setAttendance(rawAttendance);
      setAssignments(rawAssignments);

      // 1. Reset Local Grid
      const newGrid: Record<string, Record<string, number>> = {};
      MUSTER_ACTIVITIES.forEach(act => {
        newGrid[act.id] = {};
        SECTORS.forEach(sec => {
          newGrid[act.id][sec.code] = 0;
        });
      });

      // 2. Populate Grid from actual Assignments
      rawAssignments.forEach(asg => {
        const workerObj = asg.worker || allWorkers.find(w => String(w.id) === String(asg.worker_id));
        const roleLower = (workerObj?.role || '').toLowerCase();
        const kumpulanLower = (workerObj?.kumpulan || '').toLowerCase();
        const typeLower = (asg.work_type || '').toLowerCase();
        
        const isMandor = 
          roleLower.includes('mandor') || roleLower.includes('mandur') || 
          roleLower.includes('supervisor') || roleLower.includes('penyelia') ||
          kumpulanLower.includes('mandor') || kumpulanLower.includes('mandur') || 
          kumpulanLower.includes('supervisor') || kumpulanLower.includes('penyelia') ||
          typeLower.includes('mandor') || typeLower.includes('mandur') || 
          typeLower.includes('supervisor') || typeLower.includes('penyelia');

        const isEQI =
          roleLower.includes('eqi') || roleLower.includes('penggred') || roleLower.includes('gredding') ||
          kumpulanLower.includes('eqi') || kumpulanLower.includes('penggred') || kumpulanLower.includes('gredding') ||
          typeLower.includes('eqi') || typeLower.includes('penggred') || typeLower.includes('gredding');

        let actMatch;
        if (isMandor) {
          actMatch = MUSTER_ACTIVITIES.find(act => act.id === 'MANDOR_LADANG') || MUSTER_ACTIVITIES[MUSTER_ACTIVITIES.length - 1];
        } else if (isEQI) {
          actMatch = MUSTER_ACTIVITIES.find(act => act.id === 'EQI') || MUSTER_ACTIVITIES[MUSTER_ACTIVITIES.length - 1];
        } else {
          // Find which activity matches best based on work_type
          actMatch = MUSTER_ACTIVITIES.find(act => {
            return act.matchKeywords.some(keyword => typeLower.includes(keyword));
          }) || MUSTER_ACTIVITIES[MUSTER_ACTIVITIES.length - 1]; // Fallback to Lain-lain
        }

        const sectorCode = getSectorCodeFromBlock(asg.blok || '', asg.peringkat || '');

        newGrid[actMatch.id][sectorCode] = (newGrid[actMatch.id][sectorCode] || 0) + 1;
      });

      setGrid(newGrid);

      // 3. Populate Absent Workers Names from Attendance Status !== 'Hadir'
      const absents = rawAttendance
        .filter(att => att.status !== 'Hadir')
        .map(att => att.worker?.name || 'Pekerja Asing');
      setAbsentWorkers(absents);

      // Count absent status
      const sickCount = rawAttendance.filter(att => att.status === 'Sakit').length;
      const pontengCount = rawAttendance.filter(att => att.status === 'Tidak Hadir').length;
      const cutiCount = rawAttendance.filter(att => att.status === 'Cuti').length;

      setAbsentReasons({
        sakit: sickCount,
        ponteng: pontengCount,
        lain: cutiCount
      });

      // 4. Calculate Kategori Pekerja automatically based on actual workers list and attendance
      const localKategori = {
        tempatan: { total: 0, present: 0 },
        tki: { total: 0, present: 0 },
        tkin: { total: 0, present: 0 },
        tkn: { total: 0, present: 0 },
        kontraktor: { total: 0, present: 0 }
      };

      // Scan all active workers
      const activeWorkersList = allWorkers.filter(w => w.is_active !== false);
      activeWorkersList.forEach(w => {
        const country = (w.negara_asal || '').toLowerCase();
        const role = (w.role || '').toLowerCase();
        const attRec = rawAttendance.find(att => String(att.worker_id) === String(w.id));
        const hasAssignment = rawAssignments.some(asg => String(asg.worker_id || asg.worker?.id) === String(w.id));
        const isPresent = attRec ? attRec.status === 'Hadir' : hasAssignment;

        let category: keyof typeof localKategori = 'tki'; // Default fallback

        if (country.includes('malaysia')) {
          category = 'tempatan';
        } else if (country.includes('indonesia')) {
          category = 'tki';
        } else if (country.includes('nepal')) {
          category = 'tkn';
        } else if (country.includes('bangladesh') || country.includes('india') || country.includes('nepal')) {
          category = 'tkin';
        }

        // If explicitly contractor
        if (role.includes('kontraktor') || role.includes('contractor')) {
          category = 'kontraktor';
        }

        localKategori[category].total += 1;
        if (isPresent) {
          localKategori[category].present += 1;
        }
      });

      // Check local storage overrides for this specific date
      const savedExtra = getLocalMusterChitData(selectedDate);
      if (savedExtra) {
        if (savedExtra.kontraktorCount !== undefined) {
          localKategori.kontraktor = {
            total: savedExtra.kontraktorCount,
            present: savedExtra.kontraktorCount
          };
        }
        if (savedExtra.preparedBy) setPreparedBy(savedExtra.preparedBy);
        if (savedExtra.preparedTitle) setPreparedTitle(savedExtra.preparedTitle);
        if (savedExtra.customNotes) setCustomNotes(savedExtra.customNotes);
        if (savedExtra.absentReasons) setAbsentReasons(savedExtra.absentReasons);
      }

      // Adjust with default baseline from paper if local database is empty
      if (activeWorkersList.length === 0 && (!savedExtra || savedExtra.kontraktorCount === undefined)) {
        const activeEstate = getActiveEstateId();
        if (activeEstate === 'FPM_TUNGGAL') {
          setKategoriSummary({
            tempatan: { total: 4, present: 3 },
            tki: { total: 20, present: 20 },
            tkin: { total: 9, present: 9 },
            tkn: { total: 1, present: 1 },
            kontraktor: { total: 60, present: 60 }
          });
        } else {
          setKategoriSummary({
            tempatan: { total: 0, present: 0 },
            tki: { total: 0, present: 0 },
            tkin: { total: 0, present: 0 },
            tkn: { total: 0, present: 0 },
            kontraktor: { total: 0, present: 0 }
          });
        }
      } else {
        setKategoriSummary(localKategori);
      }

      onShowToast('success', 'Muster Chit berjaya dihitung secara automatik berdasarkan rekod hari ini!');
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat atau mengira Muster Chit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefreshAndCompute();

    const handleEstateChange = () => {
      handleRefreshAndCompute();
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, [selectedDate]);

  // Handle cell value changes manually (for manual adjustments)
  const handleCellChange = (activityId: string, sectorCode: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setGrid(prev => ({
      ...prev,
      [activityId]: {
        ...prev[activityId],
        [sectorCode]: num >= 0 ? num : 0
      }
    }));
  };

  // Get total per activity row
  const getActivityTotal = (activityId: string) => {
    return SECTORS.reduce((sum, sec) => sum + (grid[activityId]?.[sec.code] || 0), 0);
  };

  // Get total per sector column
  const getSectorTotal = (sectorCode: string) => {
    return MUSTER_ACTIVITIES.reduce((sum, act) => sum + (grid[act.id]?.[sectorCode] || 0), 0);
  };

  // Sum of all sectors totals
  const getGrandTotalActual = () => {
    return SECTORS.reduce((sum, sec) => sum + getSectorTotal(sec.code), 0);
  };

  // Formatting date to Indonesian/Malay layout
  const formatDateMalay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getMonthNameYear = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = [
      'JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 
      'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handlePrint = () => {
    printReport({
      title: 'MUSTER CHIT',
      subtitle: `TARIKH: ${formatDateMalay(selectedDate)} | BULAN: ${getMonthNameYear(selectedDate)}`,
      orientation: 'landscape',
      elementId: 'muster-chit-report-area'
    });
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Muster Chit');

      // Configure A4 Print Settings (Landscape fits 12 columns perfectly)
      worksheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.3,
          bottom: 0.3,
          header: 0.2,
          footer: 0.2
        }
      };

      // Fills & Borders & Fonts
      const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Dark Slate
      };
      const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };

      const subHeaderFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' } // Light Slate
      };
      const subHeaderFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF0F172A' } };

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };

      // ROW 1: Company Name Header
      worksheet.mergeCells('A1:L1');
      const r1 = worksheet.getCell('A1');
      r1.value = 'FELDA PLANTATION MANAGEMENT SDN. BHD.';
      r1.font = { name: 'Arial', size: 12, bold: true };
      r1.alignment = { horizontal: 'center', vertical: 'middle' };

      // ROW 2: Estate Name
      worksheet.mergeCells('A2:L2');
      const r2 = worksheet.getCell('A2');
      r2.value = 'FPM TUNGGAL';
      r2.font = { name: 'Arial', size: 10, bold: true };
      r2.alignment = { horizontal: 'center', vertical: 'middle' };

      // ROW 3: Report Title
      worksheet.mergeCells('A3:L3');
      const r3 = worksheet.getCell('A3');
      r3.value = 'MUSTER CHIT';
      r3.font = { name: 'Arial', size: 11, bold: true, underline: true };
      r3.alignment = { horizontal: 'center', vertical: 'middle' };

      // ROW 5: Bulan & Tarikh Header Info
      worksheet.getCell('A5').value = `BULAN : ${getMonthNameYear(selectedDate)}`;
      worksheet.getCell('A5').font = { name: 'Arial', size: 9, bold: true };

      worksheet.getCell('D5').value = `TARIKH : ${formatDateMalay(selectedDate)}`;
      worksheet.getCell('D5').font = { name: 'Arial', size: 9, bold: true };

      // ROW 7 & 8: Main Table Header Setup
      worksheet.mergeCells('A7:A8');
      worksheet.getCell('A7').value = 'BIL';

      worksheet.mergeCells('B7:B8');
      worksheet.getCell('B7').value = 'JENIS AKTIVITI';

      worksheet.mergeCells('C7:D7');
      worksheet.getCell('C7').value = 'JUMLAH PEKERJA';
      worksheet.getCell('C8').value = 'PERLU';
      worksheet.getCell('D8').value = 'ADA';

      worksheet.mergeCells('E7:J7');
      worksheet.getCell('E7').value = 'KEHADIRAN PEKERJA SEBENAR';

      SECTORS.forEach((sec, idx) => {
        const colLetter = String.fromCharCode(69 + idx); // E, F, G, H, I, J
        worksheet.getCell(`${colLetter}8`).value = `${sec.label}\n${sec.area}`;
      });

      worksheet.mergeCells('K7:K8');
      worksheet.getCell('K7').value = 'JUMLAH\n1666.63';

      worksheet.mergeCells('L7:L8');
      worksheet.getCell('L7').value = 'CATATAN';

      // Apply styles to headers
      ['A7', 'B7', 'C7', 'E7', 'K7', 'L7'].forEach(cellRef => {
        const cell = worksheet.getCell(cellRef);
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      });

      ['C8', 'D8', 'E8', 'F8', 'G8', 'H8', 'I8', 'J8'].forEach(cellRef => {
        const cell = worksheet.getCell(cellRef);
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      });

      // ROWS 9 to 22: Activity Data
      let totalPerluSum = 0;
      let totalAdaSum = 0;
      const sectorSums: Record<string, number> = {};
      SECTORS.forEach(s => { sectorSums[s.code] = 0; });

      MUSTER_ACTIVITIES.forEach((act, idx) => {
        const rowNum = 9 + idx;
        const rowSectors = SECTORS.map(sec => grid[act.id]?.[sec.code] || 0);
        const rowSectorSum = rowSectors.reduce((a, b) => a + b, 0);

        rowSectors.forEach((val, i) => {
          sectorSums[SECTORS[i].code] += val;
        });

        const perluVal = perluMap[act.id] || 0;
        const adaVal = rowSectorSum;

        totalPerluSum += perluVal;
        totalAdaSum += adaVal;

        const row = worksheet.getRow(rowNum);
        row.values = [
          idx + 1,
          act.label,
          perluVal || '',
          adaVal || '',
          ...rowSectors.map(v => v || ''),
          rowSectorSum || '',
          catitanMap[act.id] || ''
        ];

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 8 };
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: colNumber === 2 || colNumber === 12 ? 'left' : 'center',
            vertical: 'middle'
          };
        });
      });

      // ROW 23: JUMLAH Total Row
      const totalRow = worksheet.getRow(23);
      totalRow.values = [
        '',
        'JUMLAH',
        totalPerluSum || '',
        totalAdaSum || '',
        ...SECTORS.map(sec => sectorSums[sec.code] || ''),
        totalAdaSum || '',
        ''
      ];

      totalRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.fill = subHeaderFill;
        cell.border = thinBorder;
        cell.alignment = {
          horizontal: colNumber === 2 ? 'left' : 'center',
          vertical: 'middle'
        };
      });

      // Calculate Contractor vs Ladang Breakdown per Activity
      const kontraktorByAct: Record<string, number> = {};
      MUSTER_ACTIVITIES.forEach(act => {
        kontraktorByAct[act.id] = 0;
      });

      assignments.forEach(asg => {
        const workerObj = asg.worker || workers.find(w => String(w.id) === String(asg.worker_id));
        const roleLower = (workerObj?.role || '').toLowerCase();
        const isKontraktor = roleLower.includes('kontraktor') || roleLower.includes('contractor');

        if (isKontraktor) {
          const typeLower = (asg.work_type || '').toLowerCase();
          const actMatch = MUSTER_ACTIVITIES.find(act => {
            return act.matchKeywords.some(keyword => typeLower.includes(keyword));
          }) || MUSTER_ACTIVITIES[MUSTER_ACTIVITIES.length - 1];

          kontraktorByAct[actMatch.id] = (kontraktorByAct[actMatch.id] || 0) + 1;
        }
      });

      // ROW 25: Section Titles for Bottom Side-by-Side Tables
      worksheet.mergeCells('A25:D25');
      const catTitle = worksheet.getCell('A25');
      catTitle.value = 'PEKERJA & KEHADIRAN';
      catTitle.font = subHeaderFont;
      catTitle.fill = subHeaderFill;
      catTitle.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('F25:H25');
      const kontHeader = worksheet.getCell('F25');
      kontHeader.value = 'PEKERJA KONTRAKTOR';
      kontHeader.font = subHeaderFont;
      kontHeader.fill = subHeaderFill;
      kontHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('I25:K25');
      const ladangHeader = worksheet.getCell('I25');
      ladangHeader.value = 'PEKERJA LADANG';
      ladangHeader.font = subHeaderFont;
      ladangHeader.fill = subHeaderFill;
      ladangHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      // ROW 26: Subheaders for Kategori Pekerja Table
      worksheet.mergeCells('A26:B26');
      worksheet.getCell('A26').value = 'PEKERJA';
      worksheet.getCell('C26').value = 'JUMLAH PEKERJA';
      worksheet.getCell('D26').value = 'JUMLAH KEHADIRAN';

      ['A26', 'C26', 'D26'].forEach(cellRef => {
        const c = worksheet.getCell(cellRef);
        c.font = { name: 'Arial', size: 8, bold: true };
        c.border = thinBorder;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Populate Kategori Rows (27 to 31)
      const katData = [
        ['TEMPATAN', kategoriSummary.tempatan.total, kategoriSummary.tempatan.present],
        ['TKI LADANG', kategoriSummary.tki.total, kategoriSummary.tki.present],
        ['TKIN LADANG', kategoriSummary.tkin.total, kategoriSummary.tkin.present],
        ['TKN LADANG', kategoriSummary.tkn.total, kategoriSummary.tkn.present],
        ['PEKERJA KONTRAKTOR', kategoriSummary.kontraktor.total, kategoriSummary.kontraktor.present],
      ];

      katData.forEach((kd, i) => {
        const rNum = 27 + i;
        worksheet.mergeCells(`A${rNum}:B${rNum}`);
        worksheet.getCell(`A${rNum}`).value = kd[0];
        worksheet.getCell(`C${rNum}`).value = kd[1];
        worksheet.getCell(`D${rNum}`).value = kd[2];

        [`A${rNum}`, `C${rNum}`, `D${rNum}`].forEach(cellRef => {
          const c = worksheet.getCell(cellRef);
          c.font = { name: 'Arial', size: 8 };
          c.border = thinBorder;
          c.alignment = { horizontal: cellRef.startsWith('A') ? 'left' : 'center', vertical: 'middle' };
        });
      });

      // Kategori Total (Row 32)
      worksheet.mergeCells('A32:B32');
      worksheet.getCell('A32').value = 'JUMLAH';
      worksheet.getCell('C32').value = (Object.values(kategoriSummary) as { total: number; present: number }[]).reduce((s, c) => s + c.total, 0);
      worksheet.getCell('D32').value = (Object.values(kategoriSummary) as { total: number; present: number }[]).reduce((s, c) => s + c.present, 0);

      ['A32', 'C32', 'D32'].forEach(cellRef => {
        const c = worksheet.getCell(cellRef);
        c.font = { name: 'Arial', size: 8, bold: true };
        c.border = thinBorder;
        c.fill = subHeaderFill;
        c.alignment = { horizontal: cellRef.startsWith('A') ? 'left' : 'center', vertical: 'middle' };
      });

      // TIDAK HADIR Sub-table (Rows 34 to 38)
      worksheet.mergeCells('A34:B34');
      worksheet.getCell('A34').value = 'TIDAK HADIR';
      worksheet.getCell('C34').value = 'JUMLAH';

      ['A34', 'C34'].forEach(cellRef => {
        const c = worksheet.getCell(cellRef);
        c.font = { name: 'Arial', size: 8, bold: true };
        c.border = thinBorder;
        c.fill = subHeaderFill;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const absentData = [
        ['1. SAKIT ( MC )', absentReasons.sakit],
        ['2. PONTENG', absentReasons.ponteng],
        ['3. LAIN-LAIN', absentReasons.lain],
      ];

      absentData.forEach((ad, i) => {
        const rNum = 35 + i;
        worksheet.mergeCells(`A${rNum}:B${rNum}`);
        worksheet.getCell(`A${rNum}`).value = ad[0];
        worksheet.getCell(`C${rNum}`).value = ad[1];

        [`A${rNum}`, `C${rNum}`].forEach(cellRef => {
          const c = worksheet.getCell(cellRef);
          c.font = { name: 'Arial', size: 8 };
          c.border = thinBorder;
          c.alignment = { horizontal: cellRef.startsWith('A') ? 'left' : 'center', vertical: 'middle' };
        });
      });

      // Total Absent (Row 38)
      worksheet.mergeCells('A38:B38');
      worksheet.getCell('A38').value = 'JUMLAH';
      worksheet.getCell('C38').value = absentReasons.sakit + absentReasons.ponteng + absentReasons.lain;

      ['A38', 'C38'].forEach(cellRef => {
        const c = worksheet.getCell(cellRef);
        c.font = { name: 'Arial', size: 8, bold: true };
        c.border = thinBorder;
        c.fill = subHeaderFill;
        c.alignment = { horizontal: cellRef.startsWith('A') ? 'left' : 'center', vertical: 'middle' };
      });

      // Contractor vs Ladang Worker Breakdown by Activity (Rows 26 to 39, Total Row 40)
      MUSTER_ACTIVITIES.forEach((act, idx) => {
        const rNum = 26 + idx;
        // Kontraktor
        worksheet.mergeCells(`F${rNum}:G${rNum}`);
        worksheet.getCell(`F${rNum}`).value = act.label;
        const kontCount = kontraktorByAct[act.id] || (act.id === 'MENUAI' && kategoriSummary.kontraktor.present ? kategoriSummary.kontraktor.present : '');
        worksheet.getCell(`H${rNum}`).value = kontCount || '';

        // Ladang
        worksheet.mergeCells(`I${rNum}:J${rNum}`);
        worksheet.getCell(`I${rNum}`).value = act.label;
        const ladangCount = (SECTORS.map(sec => grid[act.id]?.[sec.code] || 0)).reduce((a, b) => a + b, 0);
        worksheet.getCell(`K${rNum}`).value = ladangCount || '';

        [`F${rNum}`, `H${rNum}`, `I${rNum}`, `K${rNum}`].forEach(cellRef => {
          const c = worksheet.getCell(cellRef);
          c.font = { name: 'Arial', size: 8 };
          c.border = thinBorder;
          c.alignment = { horizontal: cellRef.startsWith('F') || cellRef.startsWith('I') ? 'left' : 'center', vertical: 'middle' };
        });
      });

      // Total Contractor vs Ladang (Row 40)
      const r40 = 40;
      worksheet.mergeCells(`F${r40}:G${r40}`);
      worksheet.getCell(`F${r40}`).value = 'JUMLAH';
      const totKont = Object.values(kontraktorByAct).reduce((a, b) => a + b, 0) || kategoriSummary.kontraktor.present;
      worksheet.getCell(`H${r40}`).value = totKont || '';

      worksheet.mergeCells(`I${r40}:J${r40}`);
      worksheet.getCell(`I${r40}`).value = 'JUMLAH';
      worksheet.getCell(`K${r40}`).value = totalAdaSum || '';

      [`F${r40}`, `H${r40}`, `I${r40}`, `K${r40}`].forEach(cellRef => {
        const c = worksheet.getCell(cellRef);
        c.font = { name: 'Arial', size: 8, bold: true };
        c.border = thinBorder;
        c.fill = subHeaderFill;
        c.alignment = { horizontal: cellRef.startsWith('F') || cellRef.startsWith('I') ? 'left' : 'center', vertical: 'middle' };
      });

      // NAMA PEKERJA YANG TIDAK HADIR (Row 42 onwards)
      worksheet.getCell('A42').value = 'NAMA PEKERJA YANG TIDAK HADIR :';
      worksheet.getCell('A42').font = { name: 'Arial', size: 9, bold: true };

      if (absentWorkers.length > 0) {
        absentWorkers.forEach((name, i) => {
          const rNum = 43 + i;
          worksheet.getCell(`A${rNum}`).value = `${i + 1}) ${name}`;
          worksheet.getCell(`A${rNum}`).font = { name: 'Arial', size: 8, bold: true };
        });
      } else {
        worksheet.getCell('A43').value = 'Semua pekerja hadir.';
        worksheet.getCell('A43').font = { name: 'Arial', size: 8, italic: true };
      }

      // SIGNATURE SECTION (Row 48 onwards)
      const sigStart = 48 + Math.max(absentWorkers.length, 1);
      worksheet.getCell(`A${sigStart}`).value = 'DISEDIAKAN OLEH :';
      worksheet.getCell(`A${sigStart}`).font = { name: 'Arial', size: 8, bold: true };

      worksheet.getCell(`I${sigStart}`).value = 'DISAHKAN OLEH :';
      worksheet.getCell(`I${sigStart}`).font = { name: 'Arial', size: 8, bold: true };

      const lineRow = sigStart + 3;
      worksheet.getCell(`A${lineRow}`).value = '....................................................................';
      worksheet.getCell(`I${lineRow}`).value = '....................................................................';

      const nameRow = lineRow + 1;
      worksheet.getCell(`A${nameRow}`).value = preparedBy;
      worksheet.getCell(`A${nameRow}`).font = { name: 'Arial', size: 9, bold: true };

      worksheet.getCell(`I${nameRow}`).value = verifiedBy;
      worksheet.getCell(`I${nameRow}`).font = { name: 'Arial', size: 9, bold: true };

      const titleRow = nameRow + 1;
      worksheet.getCell(`A${titleRow}`).value = preparedTitle;
      worksheet.getCell(`A${titleRow}`).font = { name: 'Arial', size: 8 };

      worksheet.getCell(`I${titleRow}`).value = verifiedTitle;
      worksheet.getCell(`I${titleRow}`).font = { name: 'Arial', size: 8 };

      const companyRow = titleRow + 1;
      worksheet.getCell(`A${companyRow}`).value = 'FPMSB TUNGGAL';
      worksheet.getCell(`A${companyRow}`).font = { name: 'Arial', size: 8 };

      worksheet.getCell(`I${companyRow}`).value = 'FPMSB TUNGGAL';
      worksheet.getCell(`I${companyRow}`).font = { name: 'Arial', size: 8 };

      const locRow = companyRow + 1;
      worksheet.getCell(`A${locRow}`).value = '81900 KOTA TINGGI JOHOR';
      worksheet.getCell(`A${locRow}`).font = { name: 'Arial', size: 8 };

      worksheet.getCell(`I${locRow}`).value = '81900 KOTA TINGGI JOHOR';
      worksheet.getCell(`I${locRow}`).font = { name: 'Arial', size: 8 };

      // Set Column Widths for precise A4 print layout
      worksheet.columns = [
        { width: 5 },   // A: BIL
        { width: 22 },  // B: JENIS AKTIVITI
        { width: 9 },   // C: PERLU
        { width: 9 },   // D: ADA
        { width: 10 },  // E: 1A
        { width: 10 },  // F: 1B
        { width: 10 },  // G: 1C
        { width: 10 },  // H: 1D
        { width: 10 },  // I: 2
        { width: 12 },  // J: LAIN-LAIN
        { width: 11 },  // K: JUMLAH
        { width: 18 }   // L: CATATAN
      ];

      // Download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Muster_Chit_FPM_TUNGGAL_${selectedDate}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      onShowToast('success', 'Fail Excel Muster Chit (A4 Format) berjaya dimuat turun!');
    } catch (err) {
      console.error('Error exporting Muster Chit Excel:', err);
      onShowToast('error', 'Gagal memuat turun fail Excel.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Printable CSS Styles Integration */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            font-size: 10px !important;
          }
          .no-print {
            display: none !important;
          }
          input, select, textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            font-weight: bold !important;
            text-align: center !important;
          }
          .card-wrapper {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Control Row (Hidden on Print) */}
      <div className={`p-5 rounded-3xl border no-print ${
        isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'
      } flex flex-col md:flex-row gap-4 items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Layers size={20} />
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Rumusan Muster Chit
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
              Rumusan Harian Aktiviti, Kehadiran Sebenar & Blok Kerja Ladang
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Date Picker */}
          <div className="relative flex-1 sm:flex-initial">
            <CalendarIcon className="absolute left-3 top-2.5 text-slate-400" size={13} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full sm:w-36 pl-8 pr-2.5 py-2 border rounded-xl outline-none text-[10px] font-black uppercase tracking-wider ${
                isDarkMode 
                  ? 'bg-slate-800 border-white/10 text-white focus:border-indigo-500' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'
              }`}
            />
          </div>

          {/* Sync Button */}
          <button
            onClick={handleRefreshAndCompute}
            disabled={loading}
            className={`py-2 px-3 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 ${
              isDarkMode 
                ? 'bg-slate-800/80 hover:bg-slate-800 border-white/10 text-slate-300' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
            }`}
            title="Muat semula dan kira berdasarkan kehadiran & tugasan sistem"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Kira Automatik</span>
          </button>

          {/* Excel Download Button (Compact & Modern) */}
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-[10px] uppercase tracking-wider py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm hover:shadow cursor-pointer border border-emerald-400/30"
            title="Muat Turun Excel (.xlsx)"
          >
            <FileSpreadsheet size={13} className="text-emerald-100" />
            <span>Muat Turun Excel</span>
          </button>
        </div>
      </div>

      {/* Main Muster Chit Wrapper (Optimised and Printable) */}
      <div id="muster-chit-report-area" className={`p-6 md:p-8 rounded-3xl border card-wrapper print-area ${
        isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-white border-slate-200 shadow-md'
      } space-y-6 text-slate-800 dark:text-slate-100`}>
        
        {/* DOCUMENT HEADER */}
        <div className="text-center border-b pb-5 border-slate-200 dark:border-white/5">
          <h2 className="text-sm font-black tracking-widest uppercase text-slate-900 dark:text-white">
            FELDA PLANTATION MANAGEMENT SDN. BHD.
          </h2>
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 mt-1">
            ESTATE: FPM TUNGGAL
          </h3>
          <h1 className="text-md font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 mt-2 border-y py-1.5 border-dashed border-slate-300 dark:border-slate-800 max-w-sm mx-auto">
            MUSTER CHIT
          </h1>

          {/* Info Badge Grid */}
          <div className="grid grid-cols-2 max-w-md mx-auto mt-4 text-[10px] font-black uppercase text-left tracking-wide">
            <div className="flex items-center gap-2 border-r border-slate-200 dark:border-white/5 px-4 justify-center">
              <span className="text-slate-400">BULAN:</span>
              <span className="text-slate-900 dark:text-white font-black">{getMonthNameYear(selectedDate)}</span>
            </div>
            <div className="flex items-center gap-2 px-4 justify-center">
              <span className="text-slate-400">TARIKH:</span>
              <span className="text-slate-900 dark:text-white font-mono font-black text-xs">
                {formatDateMalay(selectedDate)}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 1: KEHADIRAN PEKERJA SEBENAR (GRID GRID SYSTEM) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <CheckSquare size={14} />
              I. Kehadiran & Blok Pekerja Sebenar
            </h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase no-print">
              *Klik dalam mana-mana kotak untuk menukar atau menambah nilai secara manual.
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 font-black uppercase text-[9px] tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-2.5 text-center w-8 border-r border-slate-200 dark:border-white/10">BIL</th>
                  <th className="py-2 px-3 border-r border-slate-200 dark:border-white/10">JENIS AKTIVITI</th>
                  <th className="py-2 px-2.5 text-center w-16 border-r border-slate-200 dark:border-white/10">PERLU</th>
                  <th className="py-2 px-2.5 text-center w-16 border-r border-slate-200 dark:border-white/10">ADA</th>
                  {SECTORS.map(sec => (
                    <th key={sec.code} className="py-2 px-2 text-center border-r border-slate-200 dark:border-white/10">
                      <div className="font-black text-slate-900 dark:text-white font-mono">{sec.label || sec.code}</div>
                      <div className="text-[7px] text-slate-400 font-bold tracking-tight font-sans leading-none">{sec.area}</div>
                    </th>
                  ))}
                  <th className="py-2 px-3 text-center w-20 border-r border-slate-200 dark:border-white/10">JUMLAH</th>
                  <th className="py-2 px-3 w-32">CATITAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-black uppercase">
                {MUSTER_ACTIVITIES.map((act, index) => {
                  const actualRowSum = getActivityTotal(act.id);
                  const perluCount = perluMap[act.id] || 0;
                  const catitanVal = catitanMap[act.id] || '';

                  return (
                    <tr 
                      key={act.id} 
                      className={`${
                        actualRowSum > 0 
                          ? 'bg-indigo-500/5 dark:bg-indigo-500/10' 
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/10'
                      } transition-colors`}
                    >
                      <td className="py-1.5 px-2.5 text-center border-r border-slate-200 dark:border-white/10 text-slate-400 font-mono text-[9px]">
                        {index + 1}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 dark:border-white/10 font-bold text-slate-800 dark:text-slate-200 text-[10px]">
                        {act.label}
                      </td>
                      {/* Perlu Field */}
                      <td className="py-1 px-1 border-r border-slate-200 dark:border-white/10 text-center">
                        <input
                          type="number"
                          min="0"
                          value={perluCount || ''}
                          placeholder="-"
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setPerluMap(prev => ({ ...prev, [act.id]: val }));
                          }}
                          className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-[10px] text-slate-700 dark:text-white p-0.5 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                        />
                      </td>
                      {/* Ada Field (Dynamically set or default to same as row sum) */}
                      <td className="py-1 px-1 border-r border-slate-200 dark:border-white/10 text-center text-slate-500 font-mono">
                        {actualRowSum || '-'}
                      </td>
                      {/* Sector Cells */}
                      {SECTORS.map(sec => {
                        const cellVal = grid[act.id]?.[sec.code] || 0;
                        return (
                          <td key={sec.code} className="py-1 px-1 border-r border-slate-200 dark:border-white/10 text-center">
                            <input
                              type="number"
                              min="0"
                              value={cellVal || ''}
                              placeholder="-"
                              onChange={(e) => handleCellChange(act.id, sec.code, e.target.value)}
                              className={`w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-[10px] p-0.5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 ${
                                cellVal > 0 ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400 dark:text-slate-600'
                              }`}
                            />
                          </td>
                        );
                      })}
                      {/* Row Total */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs">
                        {actualRowSum || '-'}
                      </td>
                      {/* Catitan */}
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          value={catitanVal}
                          placeholder="-"
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setCatitanMap(prev => ({ ...prev, [act.id]: val }));
                          }}
                          className="w-full bg-transparent outline-none focus:bg-indigo-500/10 rounded font-bold text-[9px] p-0.5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 placeholder-slate-400 text-slate-700 dark:text-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })}

                {/* TABLE FOOTER / SUMS */}
                <tr className="bg-slate-100 dark:bg-slate-900 font-black text-[11px] text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-white/20">
                  <td colSpan={2} className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-white/10">
                    JUMLAH BESAR:
                  </td>
                  <td className="py-2 px-1 text-center border-r border-slate-200 dark:border-white/10 font-mono">
                    {(Object.values(perluMap) as number[]).reduce((s, c) => s + c, 0) || '-'}
                  </td>
                  <td className="py-2 px-1 text-center border-r border-slate-200 dark:border-white/10 font-mono">
                    {getGrandTotalActual() || '-'}
                  </td>
                  {SECTORS.map(sec => {
                    const secSum = getSectorTotal(sec.code);
                    return (
                      <td key={sec.code} className="py-2 px-1 text-center border-r border-slate-200 dark:border-white/10 font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {secSum || '-'}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-white/10 font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                    {getGrandTotalActual() || '-'}
                  </td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: CATEGORIES, ABSENTS & SUB-TABLES (TWO COLUMNS LAYOUT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3">
          
          {/* LEFT: KATEGORI PEKERJA & ABSENT REASONS (7/12 width) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* KATEGORI PEKERJA TABLE */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users size={12} className="text-emerald-500" />
                A. Kategori Pekerja & Kehadiran (Sistem vs Manual)
              </h4>
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 font-black text-[8px] tracking-wider text-slate-500 uppercase">
                      <th className="py-2 px-4 border-r border-slate-200 dark:border-white/10">PEKERJA</th>
                      <th className="py-2 px-4 text-center border-r border-slate-200 dark:border-white/10 w-28">JUMLAH PEKERJA</th>
                      <th className="py-2 px-4 text-center w-28">JUMLAH KEHADIRAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-black uppercase">
                    {[
                      { key: 'tempatan', label: 'TEMPATAN' },
                      { key: 'tki', label: 'TKI LADANG' },
                      { key: 'tkin', label: 'TKIN LADANG' },
                      { key: 'tkn', label: 'TKN LADANG' },
                      { key: 'kontraktor', label: 'PEKERJA KONTRAKTOR' }
                    ].map(row => {
                      const summaryItem = kategoriSummary[row.key as keyof typeof kategoriSummary] || { total: 0, present: 0 };
                      return (
                        <tr key={row.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="py-1.5 px-4 border-r border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">{row.label}</td>
                          <td className="py-1 px-3 border-r border-slate-200 dark:border-white/10 text-center">
                            <input
                              type="number"
                              min="0"
                              value={summaryItem.total || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setKategoriSummary(prev => ({
                                  ...prev,
                                  [row.key]: { ...prev[row.key as keyof typeof kategoriSummary], total: val }
                                }));
                              }}
                              className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono"
                            />
                          </td>
                          <td className="py-1 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={summaryItem.present || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setKategoriSummary(prev => ({
                                  ...prev,
                                  [row.key]: { ...prev[row.key as keyof typeof kategoriSummary], present: val }
                                }));
                              }}
                              className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-indigo-600 dark:text-indigo-400"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 dark:bg-slate-900 font-black border-t border-slate-300 dark:border-white/20">
                      <td className="py-2 px-4 border-r border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">JUMLAH KESELURUHAN:</td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-white/10 font-mono text-slate-900 dark:text-white">
                        {(Object.values(kategoriSummary) as { total: number; present: number }[]).reduce((s, c) => s + c.total, 0)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-indigo-600 dark:text-indigo-400">
                        {(Object.values(kategoriSummary) as { total: number; present: number }[]).reduce((s, c) => s + c.present, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* TIDAK HADIR BREAKDOWN */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldAlert size={12} className="text-rose-500" />
                B. Rumusan Ketidakhadiran (Sebab)
              </h4>
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 font-black text-[8px] tracking-wider text-slate-500 uppercase">
                      <th className="py-2 px-4 border-r border-slate-200 dark:border-white/10">KATEGORI MASALAH</th>
                      <th className="py-2 px-4 text-center w-36">JUMLAH PEKERJA TIDAK HADIR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-black uppercase">
                    <tr>
                      <td className="py-1.5 px-4 border-r border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">1. SAKIT / CUTI SAKIT ( MC )</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={absentReasons.sakit || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setAbsentReasons(prev => ({ ...prev, sakit: val }));
                          }}
                          className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-rose-500"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-4 border-r border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">2. PONTENG (ABSENT WITHOUT LEAVE)</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={absentReasons.ponteng || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setAbsentReasons(prev => ({ ...prev, ponteng: val }));
                          }}
                          className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-rose-500"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-4 border-r border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200">3. LAIN-LAIN SEBAB (CUTI, PELEPASAN, DLL)</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={absentReasons.lain || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setAbsentReasons(prev => ({ ...prev, lain: val }));
                          }}
                          className="w-full bg-transparent text-center outline-none focus:bg-indigo-500/10 rounded font-black font-mono text-rose-500"
                        />
                      </td>
                    </tr>
                    <tr className="bg-slate-100 dark:bg-slate-900 font-black border-t border-slate-300 dark:border-white/20">
                      <td className="py-2 px-4 border-r border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">JUMLAH TIDAK HADIR:</td>
                      <td className="py-2 px-3 text-center font-mono text-rose-500 font-black text-xs">
                        {absentReasons.sakit + absentReasons.ponteng + absentReasons.lain}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT: DETAILED ABSENT WORKER NAMES & CONTRACTORS DIVISION (5/12 width) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* ABSENT WORKERS NAMES LIST */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertOctagon size={12} className="text-amber-500" />
                C. Senarai Nama Pekerja Tidak Hadir Hari Ini
              </h4>
              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200'
              } space-y-2`}>
                {absentWorkers.length === 0 ? (
                  <p className="text-[10px] text-slate-400 font-black uppercase text-center py-4">
                    🎉 Tiada pekerja tidak hadir. Kehadiran 100%!
                  </p>
                ) : (
                  <div className="max-h-[140px] overflow-y-auto space-y-1 font-black text-[9px] uppercase tracking-wide">
                    {absentWorkers.map((name, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                          isDarkMode ? 'bg-slate-950/80 border-white/5' : 'bg-white border-slate-100'
                        } text-slate-700 dark:text-slate-300`}
                      >
                        <span className="text-slate-400 font-mono">{idx + 1})</span>
                        <span className="truncate">{name}</span>
                        <span className="ml-auto bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded text-[7px] font-black tracking-wide uppercase">
                          ABCENT
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Absent Add Trigger (no-print) */}
                <div className="flex gap-2 no-print pt-2">
                  <input
                    type="text"
                    id="new-absent-worker-name"
                    placeholder="Tambah Nama Pekerja Tidak Hadir..."
                    className={`flex-1 px-3 py-2 border rounded-xl outline-none text-[9px] font-bold uppercase ${
                      isDarkMode 
                        ? 'bg-slate-950 border-white/5 text-white' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.currentTarget;
                        const name = target.value.trim().toUpperCase();
                        if (name) {
                          setAbsentWorkers(prev => [...prev, name]);
                          target.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('new-absent-worker-name') as HTMLInputElement;
                      if (input) {
                        const name = input.value.trim().toUpperCase();
                        if (name) {
                          setAbsentWorkers(prev => [...prev, name]);
                          input.value = '';
                        }
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            {/* PEKERJA KONTRAKTOR vs PEKERJA LADANG QUICK CHECKS */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserCheck size={12} className="text-indigo-500" />
                D. Ringkasan Pecahan Tugas Kerja Ladang
              </h4>
              <div className={`p-4 rounded-2xl border ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200'
              } space-y-3 font-black text-[9px] uppercase tracking-wide`}>
                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Kotak 1: PEKERJA KONTRAKTOR (Editable) */}
                  <div className="p-3 bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-center space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">1. PEKERJA KONTRAKTOR</p>
                      <span className="text-[7px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold no-print">EDIT MANUAL</span>
                    </div>

                    {/* Numeric Input & Increment/Decrement */}
                    <div className="flex items-center justify-center gap-1.5 my-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = kategoriSummary.kontraktor.present || 0;
                          const newCount = Math.max(0, current - 1);
                          const updated = {
                            ...kategoriSummary,
                            kontraktor: { total: newCount, present: newCount }
                          };
                          setKategoriSummary(updated);
                          saveLocalMusterChitData(selectedDate, { kontraktorCount: newCount });
                        }}
                        className="no-print w-7 h-7 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 active:scale-95 text-indigo-600 dark:text-indigo-300 font-black text-base flex items-center justify-center transition-all cursor-pointer"
                        title="Kurangkan Pekerja Kontraktor"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={kategoriSummary.kontraktor.present}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          const newCount = Math.max(0, val);
                          const updated = {
                            ...kategoriSummary,
                            kontraktor: { total: newCount, present: newCount }
                          };
                          setKategoriSummary(updated);
                          saveLocalMusterChitData(selectedDate, { kontraktorCount: newCount });
                        }}
                        className="w-20 text-center text-xl font-black text-indigo-600 dark:text-indigo-300 font-mono bg-white dark:bg-slate-900 border border-indigo-500/30 rounded-lg py-0.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const current = kategoriSummary.kontraktor.present || 0;
                          const newCount = current + 1;
                          const updated = {
                            ...kategoriSummary,
                            kontraktor: { total: newCount, present: newCount }
                          };
                          setKategoriSummary(updated);
                          saveLocalMusterChitData(selectedDate, { kontraktorCount: newCount });
                        }}
                        className="no-print w-7 h-7 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 active:scale-95 text-indigo-600 dark:text-indigo-300 font-black text-base flex items-center justify-center transition-all cursor-pointer"
                        title="Tambah Pekerja Kontraktor"
                      >
                        +
                      </button>
                    </div>

                    <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold">
                      MENUAI : <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black">{kategoriSummary.kontraktor.present}</span> ORANG
                    </p>
                  </div>

                  {/* PEKERJA LADANG */}
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center">
                    <p className="text-[8px] text-slate-400 font-bold">PEKERJA LADANG</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                      {getGrandTotalActual() || 0}
                    </p>
                    <p className="text-[7px] text-slate-400 font-bold mt-0.5">TERAGIH : {getGrandTotalActual()} ORANG</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] text-slate-400 font-bold mb-1 uppercase">Nota Tambahan / Catatan Lapangan</label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCustomNotes(val);
                      saveLocalMusterChitData(selectedDate, { customNotes: val });
                    }}
                    placeholder="Contoh: CUACA SEPANJANG HARI CERAH, KUTIPAN BIJI LERAI DIJALANKAN DENGAN LANCAR..."
                    className={`w-full p-2.5 border rounded-xl outline-none font-bold text-[9px] resize-none ${
                      isDarkMode 
                        ? 'bg-slate-950 border-white/5 text-white focus:border-indigo-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* SIGNATURE / DISAHKAN OLEH ROW */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-white/5 text-center font-black uppercase text-[10px]">
          {/* Kotak 2: Prepared By Block with Direct Staff Selection Dropdown */}
          <div className="space-y-3">
            <p className="text-slate-400 text-[9px] font-bold">2. DISEDIAKAN OLEH :</p>
            <div className="max-w-xs mx-auto space-y-2 pt-4">
              
              {/* Dropdown pilihan nama staff bertugas - Box Utama */}
              <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-950/40 border-2 border-indigo-500/30 rounded-xl text-center space-y-1 shadow-sm hover:border-indigo-500 transition-all">
                <p className="text-[7px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider no-print">
                  PILIH STAFF BERTUGAS (KLIK DROPDOWN)
                </p>

                <div className="relative flex items-center justify-center">
                  <select
                    value={preparedBy}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = STAFF_DUTY_LIST.find(s => s.name === val);
                      if (found) {
                        setPreparedBy(found.name);
                        setPreparedTitle(found.title);
                        saveLocalMusterChitData(selectedDate, {
                          preparedBy: found.name,
                          preparedTitle: found.title
                        });
                      } else {
                        setPreparedBy(val);
                        saveLocalMusterChitData(selectedDate, { preparedBy: val });
                      }
                    }}
                    className="w-full bg-transparent text-center font-black text-[10px] sm:text-[11px] text-indigo-700 dark:text-indigo-200 outline-none uppercase cursor-pointer py-1 px-2 pr-6 appearance-none border-b border-dashed border-indigo-400/50"
                  >
                    {!STAFF_DUTY_LIST.some(s => s.name === preparedBy) && preparedBy && (
                      <option value={preparedBy} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold">
                        {preparedBy}
                      </option>
                    )}
                    {STAFF_DUTY_LIST.map((staff, idx) => (
                      <option key={idx} value={staff.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold py-1.5">
                        {staff.name}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-1 pointer-events-none text-indigo-500 dark:text-indigo-400 text-[10px] font-black no-print">
                    ▼
                  </span>
                </div>
              </div>

              {/* Title & Company Details */}
              <div className="space-y-0.5 pt-1">
                <input
                  type="text"
                  value={preparedTitle}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setPreparedTitle(val);
                    saveLocalMusterChitData(selectedDate, { preparedTitle: val });
                  }}
                  placeholder="JAWATAN STAFF"
                  className="w-full bg-transparent text-center outline-none text-[8px] font-black text-slate-500 uppercase"
                />
                <p className="text-[8px] font-bold text-slate-400 leading-none">FPMSB TUNGGAL</p>
                <p className="text-[7px] font-bold text-slate-400 leading-none">81900 KOTA TINGGI JOHOR</p>
              </div>
            </div>
          </div>

          {/* Verified By Block */}
          <div className="space-y-16">
            <p className="text-slate-400 text-[9px] font-bold">DISAHKAN OLEH :</p>
            <div className="max-w-xs mx-auto space-y-1.5">
              <input
                type="text"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value.toUpperCase())}
                className="w-full bg-transparent text-center border-b border-dotted border-slate-400 outline-none text-[10px] font-black pb-0.5 text-slate-800 dark:text-white"
              />
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={verifiedTitle}
                  onChange={(e) => setVerifiedTitle(e.target.value.toUpperCase())}
                  className="w-full bg-transparent text-center outline-none text-[8px] font-black text-slate-500"
                />
                <p className="text-[8px] font-bold text-slate-400 leading-none">FPMSB TUNGGAL</p>
                <p className="text-[7px] font-bold text-slate-400 leading-none">81900 KOTA TINGGI JOHOR</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
