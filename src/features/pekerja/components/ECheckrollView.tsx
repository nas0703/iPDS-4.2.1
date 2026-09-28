import React, { useState, useEffect, useMemo } from 'react';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { Worker, CheckrollJobRow, CheckrollDeduction, CheckrollRecord } from '../types';
import { getWorkers, getWorkAssignmentsForMonth } from '../services';
import ExcelJS from 'exceljs';
import { 
  User, Calendar, DollarSign, Plus, Trash2, Save, Download, Printer, 
  ChevronLeft, ChevronRight, Search, RefreshCw, CheckCircle2, AlertCircle, FileSpreadsheet, Tag, ShieldCheck
} from 'lucide-react';

interface ECheckrollViewProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

// Default KUK Siri 8 / RAG Rate Mapping
const KUK_JOB_MAPPINGS: Record<string, { code: string; unit: string; rate: number; colorClass: string }> = {
  // Penuaian & Pengangkutan
  'MENUAI BTS (MANUAL / CANTAS)': { code: 'MN', unit: 'tan', rate: 38.00, colorClass: 'bg-purple-600 text-white' },
  'MENUAI': { code: 'MN', unit: 'tan', rate: 38.00, colorClass: 'bg-purple-600 text-white' },
  'MENUAI (UMUM)': { code: 'MN', unit: 'tan', rate: 38.00, colorClass: 'bg-purple-600 text-white' },
  'PENGANGKUTAN DALAMAN (MAIC / AAIC)': { code: 'PT', unit: 'tan', rate: 14.00, colorClass: 'bg-purple-700 text-white' },
  'MENGANGKUT BTS': { code: 'BT', unit: 'tan', rate: 12.00, colorClass: 'bg-purple-800 text-white' },
  'MENGUTIP BIJI LERAI': { code: 'BR', unit: 'guni', rate: 20.00, colorClass: 'bg-orange-500 text-white' },
  'KUTIP BIJI': { code: 'BR', unit: 'guni', rate: 20.00, colorClass: 'bg-orange-500 text-white' },

  // Pembajaan
  'MEMBAJA (SEPARA MEKANISASI)': { code: 'MB-SM', unit: 'beg', rate: 1.25, colorClass: 'bg-emerald-600 text-white' },
  'MEMBAJA (MEKANISASI PENUH / SPREADER)': { code: 'MB-MP', unit: 'hektar', rate: 18.00, colorClass: 'bg-emerald-700 text-white' },
  'MEMBAJA (MANUAL / TABUR BEG)': { code: 'MB', unit: 'beg', rate: 1.50, colorClass: 'bg-emerald-600 text-white' },
  'MEMBAJA': { code: 'MB', unit: 'beg', rate: 1.25, colorClass: 'bg-emerald-600 text-white' },
  'MEMBAJA (UMUM)': { code: 'MB', unit: 'beg', rate: 1.25, colorClass: 'bg-emerald-600 text-white' },
  'MENGANGKUT BAJA': { code: 'AB', unit: 'tan', rate: 12.00, colorClass: 'bg-emerald-800 text-white' },
  'TABUR EFB (MULCHING)': { code: 'EF', unit: 'tan', rate: 15.00, colorClass: 'bg-yellow-600 text-white' },
  'TABUR EFB': { code: 'EF', unit: 'tan', rate: 15.00, colorClass: 'bg-yellow-600 text-white' },
  'EFB': { code: 'EF', unit: 'tan', rate: 15.00, colorClass: 'bg-yellow-600 text-white' },

  // Merumput & Kawalan Rumpai
  'MERUMPUT (BULATAN / CIRCLE)': { code: 'MR-B', unit: 'hektar', rate: 18.00, colorClass: 'bg-amber-500 text-white' },
  'MERUMPUT (DADA / LORONG TUAI)': { code: 'MR-D', unit: 'hektar', rate: 15.00, colorClass: 'bg-amber-600 text-white' },
  'MERUMPUT (HAMPARAN / BLANKET)': { code: 'MR-H', unit: 'hektar', rate: 28.00, colorClass: 'bg-amber-700 text-white' },
  'MERUMPUT (JALAN PERTANIAN / PARIT / PAGAR)': { code: 'MR-J', unit: 'meter', rate: 1.50, colorClass: 'bg-amber-800 text-white' },
  'MERUMPUT': { code: 'MR', unit: 'hektar', rate: 12.00, colorClass: 'bg-amber-500 text-white' },
  'MERUMPUT (UMUM)': { code: 'MR', unit: 'hektar', rate: 12.00, colorClass: 'bg-amber-500 text-white' },
  'SEMBURAN RACUN KIMIA': { code: 'RC', unit: 'hektar', rate: 28.00, colorClass: 'bg-rose-600 text-white' },
  'SEMBURAN RACUN': { code: 'RC', unit: 'hektar', rate: 28.00, colorClass: 'bg-rose-600 text-white' },
  'MENYEMBUR RACUN': { code: 'RC', unit: 'hektar', rate: 28.00, colorClass: 'bg-rose-600 text-white' },
  'MERUMPUT / MENYEMBUR RACUN': { code: 'ME', unit: 'hektar', rate: 25.00, colorClass: 'bg-teal-600 text-white' },

  // Penyelenggaraan Pokok & P&D
  'PANGKAS PELEPAH (PRUNING)': { code: 'PP', unit: 'hektar', rate: 175.00, colorClass: 'bg-blue-600 text-white' },
  'PANGKAS PELEPAH': { code: 'PP', unit: 'hektar', rate: 175.00, colorClass: 'bg-blue-600 text-white' },
  'PRUNING': { code: 'PP', unit: 'hektar', rate: 175.00, colorClass: 'bg-blue-600 text-white' },
  'SUSUN PELEPAH': { code: 'SP', unit: 'pokok', rate: 0.30, colorClass: 'bg-indigo-500 text-white' },
  'MANCAH / KAWALAN P&D (TRUNK INJECTION)': { code: 'MC', unit: 'pokok', rate: 1.80, colorClass: 'bg-violet-600 text-white' },
  'MANCAH / KAWALAN P&D': { code: 'MC', unit: 'pokok', rate: 0.50, colorClass: 'bg-violet-600 text-white' },
  'MANCAH': { code: 'MC', unit: 'pokok', rate: 0.50, colorClass: 'bg-violet-600 text-white' },
  'KAWALAN P&D': { code: 'PD', unit: 'pokok', rate: 1.80, colorClass: 'bg-pink-600 text-white' },
  'SULAMAN / TANAM SEMULA': { code: 'SL', unit: 'pokok', rate: 4.50, colorClass: 'bg-emerald-700 text-white' },
  'SULAMAN': { code: 'SL', unit: 'pokok', rate: 4.50, colorClass: 'bg-emerald-700 text-white' },
  'ABLASI (CASTRATION)': { code: 'AB', unit: 'pokok', rate: 0.50, colorClass: 'bg-teal-700 text-white' },

  // Kerja Am Operasi & Kawalan Kualiti
  'CUCI PARIT / LONGKANG / PEMBETUNG': { code: 'CP', unit: 'meter', rate: 2.00, colorClass: 'bg-teal-600 text-white' },
  'CUCI PARIT / LONGKANG': { code: 'CP', unit: 'meter', rate: 2.00, colorClass: 'bg-teal-600 text-white' },
  'CUCI PARIT': { code: 'CP', unit: 'meter', rate: 2.00, colorClass: 'bg-teal-600 text-white' },
  'TUMBUHAN FAEDAH (BENEFICIAL PLANT)': { code: 'BP', unit: 'meter', rate: 2.50, colorClass: 'bg-emerald-500 text-white' },
  'BANCIAN POKOK': { code: 'BC', unit: 'pokok', rate: 0.40, colorClass: 'bg-blue-500 text-white' },
  'MENANAM ANAK SAWIT / KEMUDAHAN ASAS': { code: 'TN', unit: 'pokok', rate: 3.50, colorClass: 'bg-teal-600 text-white' },
  'PENGGREDAN (EQI - PENGGREDAN BTS)': { code: 'GD', unit: 'hari', rate: 45.00, colorClass: 'bg-cyan-600 text-white' },
  'PENGGREDAN (EQI)': { code: 'GD', unit: 'hari', rate: 45.00, colorClass: 'bg-cyan-600 text-white' },
  'PENGGREDAN / GREDDING': { code: 'GD', unit: 'hari', rate: 45.00, colorClass: 'bg-cyan-600 text-white' },
  'GREDDING': { code: 'GD', unit: 'hari', rate: 45.00, colorClass: 'bg-cyan-600 text-white' },
  'PENYELIAAN / MANDOR': { code: 'MD', unit: 'hari', rate: 65.00, colorClass: 'bg-indigo-600 text-white' },
  'PEKERJA AM OPERASI': { code: 'AM', unit: 'hari', rate: 40.00, colorClass: 'bg-slate-600 text-white' },
  'PEKERJA AM': { code: 'AM', unit: 'hari', rate: 40.00, colorClass: 'bg-slate-600 text-white' }
};

// Fuzzy matcher for KUK Job mapping
const getKukMapping = (rawType: string) => {
  const upper = (rawType || '').trim().toUpperCase();
  if (KUK_JOB_MAPPINGS[upper]) return KUK_JOB_MAPPINGS[upper];

  // Fuzzy search by keywords
  if (upper.includes('BULATAN')) return KUK_JOB_MAPPINGS['MERUMPUT (BULATAN / CIRCLE)'];
  if (upper.includes('DADA') || upper.includes('LORONG')) return KUK_JOB_MAPPINGS['MERUMPUT (DADA / LORONG TUAI)'];
  if (upper.includes('HAMPARAN')) return KUK_JOB_MAPPINGS['MERUMPUT (HAMPARAN / BLANKET)'];
  if (upper.includes('SEPARA MEKANISASI')) return KUK_JOB_MAPPINGS['MEMBAJA (SEPARA MEKANISASI)'];
  if (upper.includes('MEKANISASI PENUH') || upper.includes('SPREADER')) return KUK_JOB_MAPPINGS['MEMBAJA (MEKANISASI PENUH / SPREADER)'];
  if (upper.includes('BAJA')) return KUK_JOB_MAPPINGS['MEMBAJA'];
  if (upper.includes('RUMPUT')) return KUK_JOB_MAPPINGS['MERUMPUT'];
  if (upper.includes('RACUN')) return KUK_JOB_MAPPINGS['SEMBURAN RACUN KIMIA'];
  if (upper.includes('TUAI') || upper.includes('HARVEST')) return KUK_JOB_MAPPINGS['MENUAI BTS (MANUAL / CANTAS)'];
  if (upper.includes('PRUNING') || upper.includes('PANGKAS')) return KUK_JOB_MAPPINGS['PANGKAS PELEPAH (PRUNING)'];
  if (upper.includes('EFB')) return KUK_JOB_MAPPINGS['TABUR EFB (MULCHING)'];
  if (upper.includes('EQI') || upper.includes('GRED')) return KUK_JOB_MAPPINGS['PENGGREDAN (EQI - PENGGREDAN BTS)'];
  if (upper.includes('PARIT') || upper.includes('CULVERT') || upper.includes('LONGKANG')) return KUK_JOB_MAPPINGS['CUCI PARIT / LONGKANG / PEMBETUNG'];
  if (upper.includes('MANDOR') || upper.includes('PENYELIA')) return KUK_JOB_MAPPINGS['PENYELIAAN / MANDOR'];

  return {
    code: upper.substring(0, 2) || 'AM',
    unit: 'unit',
    rate: 25.00,
    colorClass: 'bg-slate-600 text-white'
  };
};

// Helper to construct checkroll job rows from real DB work assignments
const buildJobRowsFromAssignments = (workerAssignments: any[]): CheckrollJobRow[] => {
  if (!workerAssignments || workerAssignments.length === 0) return [];

  const jobGroup: Record<string, { [day: number]: number }> = {};

  workerAssignments.forEach(a => {
    const dateDay = parseInt(a.date.split('-')[2], 10);
    if (isNaN(dateDay)) return;

    const rawWorkType = (a.work_type || 'Pekerja Am').trim().toUpperCase();
    if (!jobGroup[rawWorkType]) {
      jobGroup[rawWorkType] = {};
    }

    const qty = typeof a.quantity === 'number' && a.quantity > 0 
      ? a.quantity 
      : (typeof a.hasil === 'number' && a.hasil > 0 ? a.hasil : 1);

    jobGroup[rawWorkType][dateDay] = (jobGroup[rawWorkType][dateDay] || 0) + qty;
  });

  return Object.keys(jobGroup).map((wt, idx) => {
    const mapped = getKukMapping(wt);

    return {
      id: `job-${idx}-${Date.now()}`,
      code: mapped.code,
      work_type: wt,
      unit: mapped.unit,
      rate: mapped.rate,
      dailyQuantities: jobGroup[wt]
    };
  });
};

export const ECheckrollView: React.FC<ECheckrollViewProps> = ({ isDarkMode, onShowToast }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Date selection (default to current year and month, e.g. "2026-05")
  const getCurrentYearMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [estateCode, setEstateCode] = useState('FPM TUNGGAL / BLOK 01, 02');

  // Rows and deductions state
  const [jobRows, setJobRows] = useState<CheckrollJobRow[]>([]);
  const [deductions, setDeductions] = useState<CheckrollDeduction[]>([]);

  // Signatures & payment info
  const [preparedBy, setPreparedBy] = useState('Penyelia Ladang');
  const [reviewedBy, setReviewedBy] = useState('Ketua Kerani');
  const [approvedBy, setApprovedBy] = useState('Pengurus Ladang');
  const [paymentDate, setPaymentDate] = useState('');

  // Fetch worker list
  const fetchWorkersList = async () => {
    try {
      setLoading(true);
      const data = await getWorkers();
      setWorkers(data || []);
      setSelectedWorkerIndex(0);
    } catch (err: any) {
      console.error('Error loading workers for checkroll:', err);
      onShowToast('error', 'Gagal memuatkan senarai pekerja.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkersList();

    const handleEstateChange = () => {
      fetchWorkersList();
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  const selectedWorker = useMemo(() => {
    if (workers.length === 0) return null;
    return workers[selectedWorkerIndex] || workers[0];
  }, [workers, selectedWorkerIndex]);

  // Number of days in the selected month
  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return 31;
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  // Identify which days are Sundays (weekend)
  const sundayDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const sundays: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m - 1, day);
      if (d.getDay() === 0) { // Sunday
        sundays.push(day);
      }
    }
    return sundays;
  }, [selectedMonth, daysInMonth]);

  // Helper to construct local storage key
  const getStorageKey = (workerId: string, month: string) => {
    const estate = getActiveEstateId();
    return `fpm_checkroll_${estate}_${workerId}_${month}`;
  };

  // Generate or load checkroll data when selected worker or month changes
  useEffect(() => {
    if (!selectedWorker) return;

    const storageKey = getStorageKey(selectedWorker.id, selectedMonth);
    const savedDataStr = localStorage.getItem(storageKey);

    if (savedDataStr) {
      try {
        const parsed: CheckrollRecord = JSON.parse(savedDataStr);
        setJobRows(parsed.jobRows || []);
        setDeductions(parsed.deductions || []);
        if (parsed.estate_code) setEstateCode(parsed.estate_code);
        if (parsed.prepared_by) setPreparedBy(parsed.prepared_by);
        if (parsed.reviewed_by) setReviewedBy(parsed.reviewed_by);
        if (parsed.approved_by) setApprovedBy(parsed.approved_by);
        if (parsed.payment_date) setPaymentDate(parsed.payment_date);
        return;
      } catch (e) {
        console.error('Failed to parse saved checkroll data:', e);
      }
    }

    // If no saved data, auto-populate from Tugasan Kerja / default template
    loadTaskAssignmentsForWorker(selectedWorker.id, selectedMonth);
  }, [selectedWorker, selectedMonth]);

  // Load task assignments from Tugasan Kerja (work_assignments) for this worker
  const loadTaskAssignmentsForWorker = async (workerId: string, monthStr: string) => {
    const [yearStr, mStr] = monthStr.split('-');
    try {
      const assignments = await getWorkAssignmentsForMonth(yearStr, mStr);
      const workerAssignments = assignments.filter(a => a.worker_id === workerId || a.worker?.id === workerId);

      if (workerAssignments.length > 0) {
        // Group assignments by work_type
        const jobGroup: Record<string, { [day: number]: number }> = {};
        
        workerAssignments.forEach(a => {
          const dateDay = parseInt(a.date.split('-')[2], 10);
          const rawWorkType = (a.work_type || 'Pekerja Am').trim().toUpperCase();
          if (!jobGroup[rawWorkType]) {
            jobGroup[rawWorkType] = {};
          }
          // Default count per assignment day if not explicitly numbered
          jobGroup[rawWorkType][dateDay] = (jobGroup[rawWorkType][dateDay] || 0) + 1;
        });

        const newJobRows: CheckrollJobRow[] = Object.keys(jobGroup).map((wt, idx) => {
          const mapped = KUK_JOB_MAPPINGS[wt] || {
            code: wt.substring(0, 2).toUpperCase(),
            unit: 'unit',
            rate: 25.00,
            colorClass: 'bg-slate-600 text-white'
          };

          return {
            id: `job-${idx}-${Date.now()}`,
            code: mapped.code,
            work_type: wt.charAt(0) + wt.slice(1).toLowerCase(),
            unit: mapped.unit,
            rate: mapped.rate,
            dailyQuantities: jobGroup[wt]
          };
        });

        setJobRows(newJobRows);
        setDeductions([]);
        onShowToast('success', `Tugasan Kerja bagi ${selectedWorker?.name} berjaya diimport ke E-Checkroll.`);
      } else {
        // Default sample checkroll template matching the standard sample image
        const sampleRows: CheckrollJobRow[] = [
          {
            id: 'job-mb-1',
            code: 'MB',
            work_type: 'Membaja',
            unit: 'beg',
            rate: 1.20,
            dailyQuantities: { 2: 20, 6: 15, 11: 30, 16: 25, 20: 20, 23: 15, 27: 20, 30: 25 }
          },
          {
            id: 'job-mr-2',
            code: 'MR',
            work_type: 'Merumput',
            unit: 'hektar',
            rate: 12.00,
            dailyQuantities: { 2: 0.5, 6: 0.7, 11: 0.5, 16: 0.6, 20: 0.5, 23: 0.6, 27: 0.5, 30: 0.6 }
          },
          {
            id: 'job-pp-3',
            code: 'PP',
            work_type: 'Pangkas Pelepah',
            unit: 'hektar',
            rate: 175.00,
            dailyQuantities: { 2: 0.6, 6: 0.5, 11: 0.6, 16: 0.5, 20: 0.6, 23: 0.5, 27: 0.6, 30: 0.5 }
          },
          {
            id: 'job-mn-4',
            code: 'MN',
            work_type: 'Menuai',
            unit: 'tan',
            rate: 38.00,
            dailyQuantities: { 2: 8.5, 6: 7.2, 11: 9.1, 16: 8.0, 20: 8.6, 23: 7.8, 27: 8.9, 30: 9.0 }
          }
        ];
        setJobRows(sampleRows);
        setDeductions([]);
      }
    } catch (err) {
      console.error('Error auto-populating checkroll:', err);
    }
  };

  // Save Checkroll to Local Storage
  const handleSaveCheckroll = () => {
    if (!selectedWorker) return;
    const storageKey = getStorageKey(selectedWorker.id, selectedMonth);
    const dataToSave: CheckrollRecord = {
      worker_id: selectedWorker.id,
      month: selectedMonth,
      estate_code: estateCode,
      jobRows,
      deductions,
      prepared_by: preparedBy,
      reviewed_by: reviewedBy,
      approved_by: approvedBy,
      payment_date: paymentDate
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      onShowToast('success', `Rekod E-Checkroll ${selectedWorker.name} (${selectedMonth}) berjaya disimpan!`);
    } catch (e: any) {
      onShowToast('error', 'Gagal menyimpan E-Checkroll: ' + e.message);
    }
  };

  // Add new job row
  const handleAddJobRow = () => {
    const newRow: CheckrollJobRow = {
      id: `job-custom-${Date.now()}`,
      code: 'AM',
      work_type: 'Pekerja Am',
      unit: 'hari',
      rate: 40.00,
      dailyQuantities: {}
    };
    setJobRows(prev => [...prev, newRow]);
  };

  // Update cell daily quantity
  const handleQuantityChange = (rowId: string, day: number, valStr: string) => {
    const val = parseFloat(valStr);
    setJobRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const updatedQty = { ...row.dailyQuantities };
      if (isNaN(val) || val <= 0) {
        delete updatedQty[day];
      } else {
        updatedQty[day] = val;
      }
      return { ...row, dailyQuantities: updatedQty };
    }));
  };

  // Update job details (type, code, rate, unit)
  const handleUpdateJobDetails = (rowId: string, field: keyof CheckrollJobRow, value: any) => {
    setJobRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      if (field === 'work_type') {
        const rawUpper = String(value).toUpperCase().trim();
        const mapped = KUK_JOB_MAPPINGS[rawUpper] || {
          code: String(value).substring(0, 2).toUpperCase(),
          unit: 'unit',
          rate: row.rate,
          colorClass: 'bg-slate-600 text-white'
        };
        return {
          ...row,
          work_type: value,
          code: mapped.code,
          unit: mapped.unit,
          rate: mapped.rate
        };
      }

      return { ...row, [field]: value };
    }));
  };

  // Delete job row
  const handleDeleteJobRow = (rowId: string) => {
    setJobRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Add deduction row
  const handleAddDeduction = () => {
    const newDed: CheckrollDeduction = {
      id: `ded-${Date.now()}`,
      description: 'Potongan Pinjaman / Kantin',
      amount: 0.00
    };
    setDeductions(prev => [...prev, newDed]);
  };

  // Update deduction
  const handleUpdateDeduction = (id: string, field: keyof CheckrollDeduction, val: any) => {
    setDeductions(prev => prev.map(d => {
      if (d.id !== id) return d;
      return { ...d, [field]: val };
    }));
  };

  // Delete deduction
  const handleDeleteDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  // Calculations
  const calculatedRows = useMemo(() => {
    return jobRows.map(row => {
      let totalQty = 0;
      Object.values(row.dailyQuantities).forEach(q => {
        if (typeof q === 'number' && !isNaN(q)) {
          totalQty += q;
        }
      });
      // Round totalQty to 2 decimals
      totalQty = Math.round(totalQty * 100) / 100;
      const totalAmount = Math.round((totalQty * (row.rate || 0)) * 100) / 100;

      return {
        ...row,
        totalQty,
        totalAmount
      };
    });
  }, [jobRows]);

  const jumlahKasar = useMemo(() => {
    return calculatedRows.reduce((acc, row) => acc + row.totalAmount, 0);
  }, [calculatedRows]);

  const jumlahPotongan = useMemo(() => {
    return deductions.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  }, [deductions]);

  const jumlahBersih = useMemo(() => {
    return Math.max(0, jumlahKasar - jumlahPotongan);
  }, [jumlahKasar, jumlahPotongan]);

  // Navigation 1-by-1 worker
  const filteredWorkers = useMemo(() => {
    if (!searchTerm.trim()) return workers;
    const term = searchTerm.toLowerCase();
    return workers.filter(w => 
      w.name.toLowerCase().includes(term) || 
      w.worker_no.toLowerCase().includes(term) ||
      (w.kumpulan && w.kumpulan.toLowerCase().includes(term))
    );
  }, [workers, searchTerm]);

  const handlePrevWorker = () => {
    if (selectedWorkerIndex > 0) {
      setSelectedWorkerIndex(selectedWorkerIndex - 1);
    }
  };

  const handleNextWorker = () => {
    if (selectedWorkerIndex < filteredWorkers.length - 1) {
      setSelectedWorkerIndex(selectedWorkerIndex + 1);
    }
  };

  // Month label format e.g. "Mei 2026"
  const monthDisplayLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    return dateObj.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Helper to load or construct checkroll record for any worker
  const getCheckrollRecordForWorker = (w: Worker, monthStr: string): CheckrollRecord => {
    // 1. If currently selected worker in UI, return live UI state
    if (selectedWorker && w.id === selectedWorker.id) {
      return {
        worker_id: w.id,
        month: monthStr,
        estate_code: estateCode,
        jobRows,
        deductions,
        prepared_by: preparedBy,
        reviewed_by: reviewedBy,
        approved_by: approvedBy,
        payment_date: paymentDate
      };
    }

    // 2. If saved in localStorage, return saved data
    const storageKey = getStorageKey(w.id, monthStr);
    const savedDataStr = localStorage.getItem(storageKey);

    if (savedDataStr) {
      try {
        const parsed: CheckrollRecord = JSON.parse(savedDataStr);
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved checkroll data:', e);
      }
    }

    // 3. Fallback to empty checkroll record if no data
    return {
      worker_id: w.id,
      month: monthStr,
      estate_code: estateCode,
      jobRows: [],
      deductions: [],
      prepared_by: preparedBy,
      reviewed_by: reviewedBy,
      approved_by: approvedBy,
      payment_date: paymentDate
    };
  };

  // Helper to build a styled single-worker checkroll worksheet
  const buildWorkerCheckrollSheet = (
    sheet: ExcelJS.Worksheet,
    workerObj: Worker,
    mDisplayLabel: string,
    estateCodeStr: string,
    jobRowsInput: CheckrollJobRow[],
    deductionsInput: CheckrollDeduction[],
    prepBy: string,
    revBy: string,
    appBy: string,
    payDate: string,
    sundaysList: number[]
  ) => {
    sheet.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    sheet.views = [{ showGridLines: true }];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    const darkGreenBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF047857' } },
      left: { style: 'thin', color: { argb: 'FF047857' } },
      bottom: { style: 'thin', color: { argb: 'FF047857' } },
      right: { style: 'thin', color: { argb: 'FF047857' } }
    };

    const styleRange = (
      startCol: number,
      startRow: number,
      endCol: number,
      endRow: number,
      style: {
        font?: Partial<ExcelJS.Font>;
        fill?: ExcelJS.Fill;
        border?: Partial<ExcelJS.Borders>;
        alignment?: Partial<ExcelJS.Alignment>;
        numFmt?: string;
      }
    ) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.getCell(r, c);
          if (style.font) cell.font = style.font;
          if (style.fill) cell.fill = style.fill;
          if (style.border) cell.border = style.border;
          if (style.alignment) cell.alignment = style.alignment;
          if (style.numFmt) cell.numFmt = style.numFmt;
        }
      }
    };

    const outlineRegion = (
      startCol: number,
      startRow: number,
      endCol: number,
      endRow: number,
      borderStyle: ExcelJS.BorderStyle = 'medium',
      borderColor: string = 'FF047857'
    ) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.getCell(r, c);
          const borderObj: Partial<ExcelJS.Borders> = { ...cell.border };
          if (r === startRow) borderObj.top = { style: borderStyle, color: { argb: borderColor } };
          if (r === endRow) borderObj.bottom = { style: borderStyle, color: { argb: borderColor } };
          if (c === startCol) borderObj.left = { style: borderStyle, color: { argb: borderColor } };
          if (c === endCol) borderObj.right = { style: borderStyle, color: { argb: borderColor } };
          cell.border = borderObj;
        }
      }
    };

    // Calculate row amounts
    const computedJobRows = jobRowsInput.map(row => {
      let totalQty = 0;
      Object.values(row.dailyQuantities || {}).forEach(q => {
        if (typeof q === 'number' && !isNaN(q)) {
          totalQty += q;
        }
      });
      totalQty = Math.round(totalQty * 100) / 100;
      const totalAmount = Math.round((totalQty * (row.rate || 0)) * 100) / 100;
      return { ...row, totalQty, totalAmount };
    });

    const sumKasar = computedJobRows.reduce((acc, row) => acc + row.totalAmount, 0);
    const sumPotongan = deductionsInput.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const sumBersih = Math.max(0, sumKasar - sumPotongan);

    // 1. Header Banner
    sheet.mergeCells('A1:AK1');
    sheet.getCell('A1').value = 'CHECKROLL PEKERJA / PRODUKTIVITI & BAYARAN';
    styleRange(1, 1, 37, 1, {
      font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });

    sheet.mergeCells('A2:AK2');
    sheet.getCell('A2').value = '— Rekod bulanan bagi seorang pekerja —';
    styleRange(1, 2, 37, 2, {
      font: { name: 'Arial', size: 10, italic: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });

    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 10; // Spacer

    // 2. Info Boxes
    sheet.mergeCells('A4:D4');
    sheet.getCell('A4').value = '  Nama Pekerja:';
    sheet.mergeCells('E4:M4');
    sheet.getCell('E4').value = workerObj.name.toUpperCase();

    sheet.mergeCells('A5:D5');
    sheet.getCell('A5').value = '  No. Passport:';
    sheet.mergeCells('E5:M5');
    sheet.getCell('E5').value = (workerObj.worker_no || 'TIDAK DIISI').toUpperCase();

    styleRange(1, 4, 4, 4, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
    });
    styleRange(5, 4, 13, 4, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
    });
    styleRange(1, 5, 4, 5, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
    });
    styleRange(5, 5, 13, 5, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
    });
    outlineRegion(1, 4, 13, 5, 'medium', 'FFEF4444');

    sheet.mergeCells('U4:X4');
    sheet.getCell('U4').value = '  Bulan:';
    sheet.mergeCells('Y4:AK4');
    sheet.getCell('Y4').value = mDisplayLabel.toUpperCase();

    sheet.mergeCells('U5:X5');
    sheet.getCell('U5').value = '  Kod Ladang / Blok:';
    sheet.mergeCells('Y5:AK5');
    sheet.getCell('Y5').value = estateCodeStr.toUpperCase();

    styleRange(21, 4, 24, 4, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
    });
    styleRange(25, 4, 37, 4, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
    });
    styleRange(21, 5, 24, 5, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
    });
    styleRange(25, 5, 37, 5, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
    });
    outlineRegion(21, 4, 37, 5, 'medium', 'FF10B981');

    sheet.getRow(4).height = 20;
    sheet.getRow(5).height = 20;
    sheet.getRow(6).height = 12; // Spacer

    // 3. Table Header (Rows 7 & 8)
    sheet.mergeCells('A7:A8');
    sheet.getCell('A7').value = 'BIL.';

    sheet.mergeCells('B7:B8');
    sheet.getCell('B7').value = 'JENIS KERJA';

    sheet.mergeCells('C7:AG7');
    sheet.getCell('C7').value = 'TARIKH (KUANTITI KERJA)';

    sheet.mergeCells('AH7:AH8');
    sheet.getCell('AH7').value = 'JUMLAH\nKUANTITI';

    sheet.mergeCells('AI7:AI8');
    sheet.getCell('AI7').value = 'KADAR\nBAYARAN';

    sheet.mergeCells('AJ7:AJ8');
    sheet.getCell('AJ7').value = 'JUMLAH\nPRODUKTIVITI';

    sheet.mergeCells('AK7:AK8');
    sheet.getCell('AK7').value = 'JUMLAH\nBAYARAN\n(RM)';

    styleRange(1, 7, 37, 8, {
      font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      border: darkGreenBorder,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    });

    for (let day = 1; day <= 31; day++) {
      const colLetter = sheet.getColumn(2 + day).letter;
      const cell = sheet.getCell(`${colLetter}8`);
      cell.value = day;
      
      const isSunday = sundaysList.includes(day);
      if (isSunday) {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
      } else {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      }
      cell.border = darkGreenBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    sheet.getRow(7).height = 22;
    sheet.getRow(8).height = 20;

    // 4. Data Rows (Row 9+)
    computedJobRows.forEach((row, idx) => {
      const rowNum = 9 + idx;

      sheet.getCell(rowNum, 1).value = idx + 1;
      styleRange(1, rowNum, 1, rowNum, {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });

      sheet.getCell(rowNum, 2).value = `[${row.code}] ${row.work_type} (unit: ${row.unit})`;
      styleRange(2, rowNum, 2, rowNum, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });

      for (let day = 1; day <= 31; day++) {
        const colIdx = 2 + day;
        const qty = row.dailyQuantities[day];
        const cell = sheet.getCell(rowNum, colIdx);
        
        if (qty !== undefined && qty !== null) {
          cell.value = qty;
          cell.font = { name: 'Arial', size: 10, bold: true };
        } else {
          cell.value = '';
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (sundaysList.includes(day)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
        }
        cell.border = thinBorder;
      }

      sheet.getCell(rowNum, 34).value = row.totalQty;
      styleRange(34, rowNum, 34, rowNum, {
        font: { name: 'Arial', size: 11, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });

      sheet.getCell(rowNum, 35).value = `RM${(row.rate || 0).toFixed(2)} / ${row.unit}`;
      styleRange(35, rowNum, 35, rowNum, {
        font: { name: 'Arial', size: 9 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });

      sheet.getCell(rowNum, 36).value = row.totalQty;
      styleRange(36, rowNum, 36, rowNum, {
        font: { name: 'Arial', size: 11, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });

      sheet.getCell(rowNum, 37).value = row.totalAmount;
      sheet.getCell(rowNum, 37).numFmt = '"RM " #,##0.00';
      styleRange(37, rowNum, 37, rowNum, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });

      sheet.getRow(rowNum).height = 24;
    });

    // 5. Bottom Cards
    const cardStartRow = 9 + computedJobRows.length + 2;

    // CARD 1: RINGKASAN BAYARAN
    sheet.mergeCells(`A${cardStartRow}:M${cardStartRow}`);
    sheet.getCell(`A${cardStartRow}`).value = '1  RINGKASAN BAYARAN';
    styleRange(1, cardStartRow, 13, cardStartRow, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      alignment: { horizontal: 'left', vertical: 'middle' }
    });

    const sub1Row = cardStartRow + 1;
    sheet.getCell(`A${sub1Row}`).value = 'BIL.';
    sheet.mergeCells(`B${sub1Row}:I${sub1Row}`);
    sheet.getCell(`B${sub1Row}`).value = 'JENIS KERJA';
    sheet.mergeCells(`J${sub1Row}:M${sub1Row}`);
    sheet.getCell(`J${sub1Row}`).value = 'JUMLAH BAYARAN (RM)';

    styleRange(1, sub1Row, 1, sub1Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'middle' } });
    styleRange(2, sub1Row, 9, sub1Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'left', vertical: 'middle' } });
    styleRange(10, sub1Row, 13, sub1Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'right', vertical: 'middle' } });

    computedJobRows.forEach((r, idx) => {
      const curR = sub1Row + 1 + idx;
      sheet.getCell(`A${curR}`).value = idx + 1;
      styleRange(1, curR, 1, curR, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });

      sheet.mergeCells(`B${curR}:I${curR}`);
      sheet.getCell(`B${curR}`).value = `[${r.code}] ${r.work_type}`;
      styleRange(2, curR, 9, curR, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

      sheet.mergeCells(`J${curR}:M${curR}`);
      sheet.getCell(`J${curR}`).value = r.totalAmount;
      sheet.getCell(`J${curR}`).numFmt = '"RM " #,##0.00';
      styleRange(10, curR, 13, curR, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });
    });

    const card1TotalRow = sub1Row + 1 + computedJobRows.length;
    sheet.mergeCells(`A${card1TotalRow}:I${card1TotalRow}`);
    sheet.getCell(`A${card1TotalRow}`).value = 'JUMLAH KASAR';
    styleRange(1, card1TotalRow, 9, card1TotalRow, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

    sheet.mergeCells(`J${card1TotalRow}:M${card1TotalRow}`);
    sheet.getCell(`J${card1TotalRow}`).value = sumKasar;
    sheet.getCell(`J${card1TotalRow}`).numFmt = '"RM " #,##0.00';
    styleRange(10, card1TotalRow, 13, card1TotalRow, { font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });

    outlineRegion(1, cardStartRow, 13, card1TotalRow, 'medium', 'FF065F46');

    // CARD 2: POTONGAN
    sheet.mergeCells(`O${cardStartRow}:AA${cardStartRow}`);
    sheet.getCell(`O${cardStartRow}`).value = '2  POTONGAN';
    styleRange(15, cardStartRow, 27, cardStartRow, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }, alignment: { horizontal: 'left', vertical: 'middle' } });

    const sub2Row = cardStartRow + 1;
    sheet.getCell(`O${sub2Row}`).value = 'BIL.';
    sheet.mergeCells(`P${sub2Row}:W${sub2Row}`);
    sheet.getCell(`P${sub2Row}`).value = 'JENIS POTONGAN';
    sheet.mergeCells(`X${sub2Row}:AA${sub2Row}`);
    sheet.getCell(`X${sub2Row}`).value = 'AMAUN (RM)';

    styleRange(15, sub2Row, 15, sub2Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'middle' } });
    styleRange(16, sub2Row, 23, sub2Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'left', vertical: 'middle' } });
    styleRange(24, sub2Row, 27, sub2Row, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } }, border: thinBorder, alignment: { horizontal: 'right', vertical: 'middle' } });

    const maxSummaryRows = Math.max(computedJobRows.length, deductionsInput.length, 4);
    for (let i = 0; i < maxSummaryRows; i++) {
      const curR = sub2Row + 1 + i;
      const ded = deductionsInput[i];

      sheet.getCell(`O${curR}`).value = i + 1;
      styleRange(15, curR, 15, curR, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });

      sheet.mergeCells(`P${curR}:W${curR}`);
      sheet.getCell(`P${curR}`).value = ded ? ded.description : '-';
      styleRange(16, curR, 23, curR, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

      sheet.mergeCells(`X${curR}:AA${curR}`);
      sheet.getCell(`X${curR}`).value = ded ? (Number(ded.amount) || 0) : '-';
      if (ded) sheet.getCell(`X${curR}`).numFmt = '"RM " #,##0.00';
      styleRange(24, curR, 27, curR, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });
    }

    const card2TotalRow = sub2Row + 1 + maxSummaryRows;
    sheet.mergeCells(`O${card2TotalRow}:W${card2TotalRow}`);
    sheet.getCell(`O${card2TotalRow}`).value = 'JUMLAH POTONGAN';
    styleRange(15, card2TotalRow, 23, card2TotalRow, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

    sheet.mergeCells(`X${card2TotalRow}:AA${card2TotalRow}`);
    sheet.getCell(`X${card2TotalRow}`).value = sumPotongan;
    sheet.getCell(`X${card2TotalRow}`).numFmt = '"RM " #,##0.00';
    styleRange(24, card2TotalRow, 27, card2TotalRow, { font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });

    outlineRegion(15, cardStartRow, 27, card2TotalRow, 'medium', 'FF065F46');

    // CARD 3: RINGKASAN AKHIR
    sheet.mergeCells(`AC${cardStartRow}:AK${cardStartRow}`);
    sheet.getCell(`AC${cardStartRow}`).value = '3  RINGKASAN AKHIR';
    styleRange(29, cardStartRow, 37, cardStartRow, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }, alignment: { horizontal: 'left', vertical: 'middle' } });

    const r1 = cardStartRow + 1;
    sheet.mergeCells(`AC${r1}:AG${r1}`);
    sheet.getCell(`AC${r1}`).value = 'Jumlah Kasar';
    styleRange(29, r1, 33, r1, { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

    sheet.mergeCells(`AH${r1}:AK${r1}`);
    sheet.getCell(`AH${r1}`).value = sumKasar;
    sheet.getCell(`AH${r1}`).numFmt = '"RM " #,##0.00';
    styleRange(34, r1, 37, r1, { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });

    const r2 = cardStartRow + 2;
    sheet.mergeCells(`AC${r2}:AG${r2}`);
    sheet.getCell(`AC${r2}`).value = '(-) Jumlah Potongan';
    styleRange(29, r2, 33, r2, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });

    sheet.mergeCells(`AH${r2}:AK${r2}`);
    sheet.getCell(`AH${r2}`).value = sumPotongan;
    sheet.getCell(`AH${r2}`).numFmt = '"RM " #,##0.00';
    styleRange(34, r2, 37, r2, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });

    const rBigStart = cardStartRow + 3;
    const rBigEnd = cardStartRow + 4;

    sheet.mergeCells(`AC${rBigStart}:AF${rBigEnd}`);
    sheet.getCell(`AC${rBigStart}`).value = 'JUMLAH BERSIH\nDIBAYAR';
    styleRange(29, rBigStart, 32, rBigEnd, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    });

    sheet.mergeCells(`AG${rBigStart}:AK${rBigEnd}`);
    sheet.getCell(`AG${rBigStart}`).value = sumBersih;
    sheet.getCell(`AG${rBigStart}`).numFmt = '"RM " #,##0.00';
    styleRange(33, rBigStart, 37, rBigEnd, {
      font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FF047857' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });

    outlineRegion(29, cardStartRow, 37, rBigEnd, 'medium', 'FF065F46');

    // 6. Footer Signatures
    const sigStartRow = Math.max(card1TotalRow, card2TotalRow, rBigEnd) + 3;

    sheet.mergeCells(`A${sigStartRow}:I${sigStartRow}`);
    sheet.getCell(`A${sigStartRow}`).value = 'Disediakan oleh';
    styleRange(1, sigStartRow, 9, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`A${sigStartRow + 3}:I${sigStartRow + 3}`);
    sheet.getCell(`A${sigStartRow + 3}`).value = `Nama: ${prepBy.toUpperCase()}`;
    styleRange(1, sigStartRow + 3, 9, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`A${sigStartRow + 4}:I${sigStartRow + 4}`);
    sheet.getCell(`A${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(1, sigStartRow + 4, 9, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(1, sigStartRow, 9, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.mergeCells(`K${sigStartRow}:S${sigStartRow}`);
    sheet.getCell(`K${sigStartRow}`).value = 'Disemak oleh';
    styleRange(11, sigStartRow, 19, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`K${sigStartRow + 3}:S${sigStartRow + 3}`);
    sheet.getCell(`K${sigStartRow + 3}`).value = `Nama: ${revBy.toUpperCase()}`;
    styleRange(11, sigStartRow + 3, 19, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`K${sigStartRow + 4}:S${sigStartRow + 4}`);
    sheet.getCell(`K${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(11, sigStartRow + 4, 19, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(11, sigStartRow, 19, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.mergeCells(`U${sigStartRow}:AC${sigStartRow}`);
    sheet.getCell(`U${sigStartRow}`).value = 'Diluluskan oleh';
    styleRange(21, sigStartRow, 29, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`U${sigStartRow + 3}:AC${sigStartRow + 3}`);
    sheet.getCell(`U${sigStartRow + 3}`).value = `Nama: ${appBy.toUpperCase()}`;
    styleRange(21, sigStartRow + 3, 29, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`U${sigStartRow + 4}:AC${sigStartRow + 4}`);
    sheet.getCell(`U${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(21, sigStartRow + 4, 29, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(21, sigStartRow, 29, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.mergeCells(`AE${sigStartRow}:AK${sigStartRow}`);
    sheet.getCell(`AE${sigStartRow}`).value = 'Tarikh Pembayaran';
    styleRange(31, sigStartRow, 37, sigStartRow, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`AE${sigStartRow + 1}:AK${sigStartRow + 3}`);
    sheet.getCell(`AE${sigStartRow + 1}`).value = payDate ? payDate : '____ / ____ / ________';
    styleRange(31, sigStartRow + 1, 37, sigStartRow + 3, { font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FF047857' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`AE${sigStartRow + 4}:AK${sigStartRow + 4}`);
    sheet.getCell(`AE${sigStartRow + 4}`).value = '( hh / bb / tttt )';
    styleRange(31, sigStartRow + 4, 37, sigStartRow + 4, { font: { name: 'Arial', size: 9, italic: true, color: { argb: 'FF047857' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }, alignment: { horizontal: 'center', vertical: 'middle' } });
    outlineRegion(31, sigStartRow, 37, sigStartRow + 4, 'medium', 'FF047857');

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 28;
    for (let day = 1; day <= 31; day++) {
      sheet.getColumn(2 + day).width = 4.2;
    }
    sheet.getColumn(34).width = 14;
    sheet.getColumn(35).width = 16;
    sheet.getColumn(36).width = 14;
    sheet.getColumn(37).width = 20;
  };

  // Helper to build Master Summary Sheet for all workers
  const buildMasterSummarySheet = (
    sheet: ExcelJS.Worksheet,
    workersList: Worker[],
    mDisplayLabel: string,
    selectedMonthStr: string,
    estateCodeStr: string,
    prepBy: string,
    revBy: string,
    appBy: string,
    getRecordFn?: (w: Worker) => CheckrollRecord
  ) => {
    sheet.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    sheet.views = [{ showGridLines: true }];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    const darkGreenBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF047857' } },
      left: { style: 'thin', color: { argb: 'FF047857' } },
      bottom: { style: 'thin', color: { argb: 'FF047857' } },
      right: { style: 'thin', color: { argb: 'FF047857' } }
    };

    const styleRange = (startCol: number, startRow: number, endCol: number, endRow: number, style: any) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.getCell(r, c);
          if (style.font) cell.font = style.font;
          if (style.fill) cell.fill = style.fill;
          if (style.border) cell.border = style.border;
          if (style.alignment) cell.alignment = style.alignment;
          if (style.numFmt) cell.numFmt = style.numFmt;
        }
      }
    };

    const outlineRegion = (startCol: number, startRow: number, endCol: number, endRow: number, borderStyle: ExcelJS.BorderStyle = 'medium', borderColor: string = 'FF047857') => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.getCell(r, c);
          const borderObj: Partial<ExcelJS.Borders> = { ...cell.border };
          if (r === startRow) borderObj.top = { style: borderStyle, color: { argb: borderColor } };
          if (r === endRow) borderObj.bottom = { style: borderStyle, color: { argb: borderColor } };
          if (c === startCol) borderObj.left = { style: borderStyle, color: { argb: borderColor } };
          if (c === endCol) borderObj.right = { style: borderStyle, color: { argb: borderColor } };
          cell.border = borderObj;
        }
      }
    };

    // 1. Header Banner
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'LAPORAN RINGKASAN CHECKROLL KESELURUHAN PEKERJA';
    styleRange(1, 1, 9, 1, {
      font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });

    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = '— Ringkasan Bulanan Produktiviti & Bayaran Gaji Semua Pekerja Ladang —';
    styleRange(1, 2, 9, 2, {
      font: { name: 'Arial', size: 10, italic: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    });

    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 10; // Spacer

    // 2. Metadata Box
    sheet.mergeCells('A4:D4');
    sheet.getCell('A4').value = `  Bulan & Tahun:  ${mDisplayLabel.toUpperCase()}`;
    sheet.mergeCells('E4:I4');
    sheet.getCell('E4').value = `  Kod Ladang / Blok:  ${estateCodeStr.toUpperCase()}`;

    sheet.mergeCells('A5:D5');
    sheet.getCell('A5').value = `  Jumlah Pekerja:  ${workersList.length} Orang`;
    sheet.mergeCells('E5:I5');
    sheet.getCell('E5').value = `  Status Laporan:  DISAHKAN & LENGKAP`;

    styleRange(1, 4, 9, 5, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
      alignment: { horizontal: 'left', vertical: 'middle' }
    });
    outlineRegion(1, 4, 9, 5, 'medium', 'FF10B981');

    sheet.getRow(4).height = 20;
    sheet.getRow(5).height = 20;
    sheet.getRow(6).height = 12; // Spacer

    // 3. Table Header
    const headers = [
      'BIL.',
      'NAMA PEKERJA',
      'NO. PASSPORT / ID',
      'WARGANEGARA / PERANAN',
      'HARI BEKERJA',
      'JUMLAH KASAR (RM)',
      'JUMLAH POTONGAN (RM)',
      'JUMLAH BERSIH (RM)',
      'CATATAN / STATUS'
    ];

    headers.forEach((h, i) => {
      sheet.getCell(7, i + 1).value = h;
    });

    styleRange(1, 7, 9, 7, {
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
      border: darkGreenBorder,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    });
    sheet.getRow(7).height = 26;

    let grandKasar = 0;
    let grandPotongan = 0;
    let grandBersih = 0;

    // 4. Data Rows
    workersList.forEach((w, idx) => {
      const rNum = 8 + idx;
      const rec = getRecordFn ? getRecordFn(w) : getCheckrollRecordForWorker(w, selectedMonthStr);

      let kasar = 0;
      const daysWorkedSet = new Set<number>();
      (rec.jobRows || []).forEach(r => {
        let qSum = 0;
        Object.entries(r.dailyQuantities || {}).forEach(([dayStr, q]) => {
          if (typeof q === 'number' && q > 0) {
            qSum += q;
            daysWorkedSet.add(Number(dayStr));
          }
        });
        kasar += Math.round((qSum * (r.rate || 0)) * 100) / 100;
      });

      const potongan = (rec.deductions || []).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
      const bersih = Math.max(0, kasar - potongan);

      grandKasar += kasar;
      grandPotongan += potongan;
      grandBersih += bersih;

      sheet.getCell(rNum, 1).value = idx + 1;
      sheet.getCell(rNum, 2).value = w.name.toUpperCase();
      sheet.getCell(rNum, 3).value = (w.worker_no || '-').toUpperCase();
      sheet.getCell(rNum, 4).value = `${(w.negara_asal || 'MALAYSIA').toUpperCase()} / ${(w.role || 'PEKERJA').toUpperCase()}`;
      sheet.getCell(rNum, 5).value = `${daysWorkedSet.size} Hari`;

      sheet.getCell(rNum, 6).value = kasar;
      sheet.getCell(rNum, 6).numFmt = '"RM " #,##0.00';

      sheet.getCell(rNum, 7).value = potongan;
      sheet.getCell(rNum, 7).numFmt = '"RM " #,##0.00';

      sheet.getCell(rNum, 8).value = bersih;
      sheet.getCell(rNum, 8).numFmt = '"RM " #,##0.00';

      sheet.getCell(rNum, 9).value = 'LULUS / DIBAYAR';

      styleRange(1, rNum, 1, rNum, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });
      styleRange(2, rNum, 2, rNum, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } }, alignment: { horizontal: 'left', vertical: 'middle' }, border: thinBorder });
      styleRange(3, rNum, 3, rNum, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });
      styleRange(4, rNum, 4, rNum, { font: { name: 'Arial', size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });
      styleRange(5, rNum, 5, rNum, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });

      styleRange(6, rNum, 6, rNum, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });
      styleRange(7, rNum, 7, rNum, { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } }, alignment: { horizontal: 'right', vertical: 'middle' }, border: thinBorder });
      styleRange(8, rNum, 8, rNum, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });
      styleRange(9, rNum, 9, rNum, { font: { name: 'Arial', size: 9, italic: true, color: { argb: 'FF047857' } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: thinBorder });

      sheet.getRow(rNum).height = 22;
    });

    // 5. Total Row
    const totalR = 8 + workersList.length;
    sheet.mergeCells(`A${totalR}:E${totalR}`);
    sheet.getCell(`A${totalR}`).value = 'JUMLAH KESELURUHAN (RM)';
    styleRange(1, totalR, 5, totalR, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF065F46' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: darkGreenBorder
    });

    sheet.getCell(totalR, 6).value = grandKasar;
    sheet.getCell(totalR, 6).numFmt = '"RM " #,##0.00';
    styleRange(6, totalR, 6, totalR, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: darkGreenBorder
    });

    sheet.getCell(totalR, 7).value = grandPotongan;
    sheet.getCell(totalR, 7).numFmt = '"RM " #,##0.00';
    styleRange(7, totalR, 7, totalR, {
      font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFDC2626' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: darkGreenBorder
    });

    sheet.getCell(totalR, 8).value = grandBersih;
    sheet.getCell(totalR, 8).numFmt = '"RM " #,##0.00';
    styleRange(8, totalR, 8, totalR, {
      font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FF047857' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: darkGreenBorder
    });

    sheet.getCell(totalR, 9).value = ' - ';
    styleRange(9, totalR, 9, totalR, {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: darkGreenBorder
    });

    sheet.getRow(totalR).height = 26;

    // 6. Signatures Footer
    const sigStartRow = totalR + 3;

    sheet.mergeCells(`A${sigStartRow}:B${sigStartRow}`);
    sheet.getCell(`A${sigStartRow}`).value = 'Disediakan oleh';
    styleRange(1, sigStartRow, 2, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`A${sigStartRow + 3}:B${sigStartRow + 3}`);
    sheet.getCell(`A${sigStartRow + 3}`).value = `Nama: ${prepBy.toUpperCase()}`;
    styleRange(1, sigStartRow + 3, 2, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`A${sigStartRow + 4}:B${sigStartRow + 4}`);
    sheet.getCell(`A${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(1, sigStartRow + 4, 2, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(1, sigStartRow, 2, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.mergeCells(`D${sigStartRow}:E${sigStartRow}`);
    sheet.getCell(`D${sigStartRow}`).value = 'Disemak oleh';
    styleRange(4, sigStartRow, 5, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`D${sigStartRow + 3}:E${sigStartRow + 3}`);
    sheet.getCell(`D${sigStartRow + 3}`).value = `Nama: ${revBy.toUpperCase()}`;
    styleRange(4, sigStartRow + 3, 5, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`D${sigStartRow + 4}:E${sigStartRow + 4}`);
    sheet.getCell(`D${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(4, sigStartRow + 4, 5, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(4, sigStartRow, 5, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.mergeCells(`G${sigStartRow}:H${sigStartRow}`);
    sheet.getCell(`G${sigStartRow}`).value = 'Diluluskan oleh';
    styleRange(7, sigStartRow, 8, sigStartRow, { font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' } });

    sheet.mergeCells(`G${sigStartRow + 3}:H${sigStartRow + 3}`);
    sheet.getCell(`G${sigStartRow + 3}`).value = `Nama: ${appBy.toUpperCase()}`;
    styleRange(7, sigStartRow + 3, 8, sigStartRow + 3, { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });

    sheet.mergeCells(`G${sigStartRow + 4}:H${sigStartRow + 4}`);
    sheet.getCell(`G${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
    styleRange(7, sigStartRow + 4, 8, sigStartRow + 4, { font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }, alignment: { horizontal: 'left', vertical: 'middle' } });
    outlineRegion(7, sigStartRow, 8, sigStartRow + 4, 'thin', 'FF9CA3AF');

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 22;
    sheet.getColumn(4).width = 24;
    sheet.getColumn(5).width = 16;
    sheet.getColumn(6).width = 22;
    sheet.getColumn(7).width = 22;
    sheet.getColumn(8).width = 24;
    sheet.getColumn(9).width = 22;
  };

  // Export Checkroll Keseluruhan (Master Summary Sheet + All Worker Sheets)
  const handleExportAllWorkersExcel = async () => {
    if (workers.length === 0) {
      onShowToast('error', 'Tiada pekerja dijumpai untuk dieksport.');
      return;
    }

    try {
      onShowToast('success', 'Sedang membina fail Excel Checkroll Keseluruhan...');

      // Fetch DB work assignments for selectedMonth for all workers
      const [yearStr, mStr] = selectedMonth.split('-');
      let monthAssignments: any[] = [];
      try {
        monthAssignments = await getWorkAssignmentsForMonth(yearStr, mStr);
      } catch (err) {
        console.error('Error fetching month assignments for Excel export:', err);
      }

      const assignmentsByWorker: Record<string, any[]> = {};
      monthAssignments.forEach(a => {
        const wId = a.worker_id || a.worker?.id;
        if (wId) {
          if (!assignmentsByWorker[wId]) assignmentsByWorker[wId] = [];
          assignmentsByWorker[wId].push(a);
        }
      });

      const getRecordForWorker = (w: Worker): CheckrollRecord => {
        // 1. If currently selected worker in UI, return live UI state
        if (selectedWorker && w.id === selectedWorker.id) {
          return {
            worker_id: w.id,
            month: selectedMonth,
            estate_code: estateCode,
            jobRows,
            deductions,
            prepared_by: preparedBy,
            reviewed_by: reviewedBy,
            approved_by: approvedBy,
            payment_date: paymentDate
          };
        }

        // 2. If saved in localStorage, return saved data
        const storageKey = getStorageKey(w.id, selectedMonth);
        const savedDataStr = localStorage.getItem(storageKey);
        if (savedDataStr) {
          try {
            return JSON.parse(savedDataStr);
          } catch (e) {
            console.error('Error parsing saved checkroll:', e);
          }
        }

        // 3. If work assignments exist in DB for this worker
        const wAssignments = assignmentsByWorker[w.id] || [];
        if (wAssignments.length > 0) {
          return {
            worker_id: w.id,
            month: selectedMonth,
            estate_code: estateCode,
            jobRows: buildJobRowsFromAssignments(wAssignments),
            deductions: [],
            prepared_by: preparedBy,
            reviewed_by: reviewedBy,
            approved_by: approvedBy,
            payment_date: paymentDate
          };
        }

        // 4. Fallback empty checkroll
        return {
          worker_id: w.id,
          month: selectedMonth,
          estate_code: estateCode,
          jobRows: [],
          deductions: [],
          prepared_by: preparedBy,
          reviewed_by: reviewedBy,
          approved_by: approvedBy,
          payment_date: paymentDate
        };
      };

      const workbook = new ExcelJS.Workbook();

      // 1. Sheet 1: Master Summary Sheet
      const masterSheet = workbook.addWorksheet('RINGKASAN_KESELURUHAN');
      buildMasterSummarySheet(
        masterSheet,
        workers,
        monthDisplayLabel,
        selectedMonth,
        estateCode,
        preparedBy,
        reviewedBy,
        approvedBy,
        getRecordForWorker
      );

      // 2. Individual Worksheets for Each Worker
      workers.forEach((w, idx) => {
        const rec = getRecordForWorker(w);
        const safeName = w.name.replace(/[\\/?*\[\]:]/g, '_').trim().substring(0, 22);
        const sheetTitle = `${idx + 1}. ${safeName}`;

        const workerSheet = workbook.addWorksheet(sheetTitle);
        buildWorkerCheckrollSheet(
          workerSheet,
          w,
          monthDisplayLabel,
          rec.estate_code || estateCode,
          rec.jobRows || [],
          rec.deductions || [],
          rec.prepared_by || preparedBy,
          rec.reviewed_by || reviewedBy,
          rec.approved_by || approvedBy,
          rec.payment_date || paymentDate,
          sundayDays
        );
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const fileName = `Checkroll_Keseluruhan_Pekerja_${selectedMonth}.xlsx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      onShowToast('success', `Fail Excel "${fileName}" berjaya dimuat turun!`);
    } catch (err: any) {
      console.error('Error exporting all workers Excel checkroll:', err);
      onShowToast('error', 'Gagal memuat turun Checkroll Keseluruhan: ' + err.message);
    }
  };

  // Export Checkroll to Excel via ExcelJS (Matching the Attachment Screenshot Exactly)
  const handleExportExcel = async () => {
    if (!selectedWorker) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Checkroll Pekerja', {
        pageSetup: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
      });

      // Show gridlines explicitly
      sheet.views = [{ showGridLines: true }];

      // Helper for borders
      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };

      const darkGreenBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF047857' } },
        left: { style: 'thin', color: { argb: 'FF047857' } },
        bottom: { style: 'thin', color: { argb: 'FF047857' } },
        right: { style: 'thin', color: { argb: 'FF047857' } }
      };

      // Helper to style range of merged cells completely
      const styleRange = (
        startCol: number,
        startRow: number,
        endCol: number,
        endRow: number,
        style: {
          font?: Partial<ExcelJS.Font>;
          fill?: ExcelJS.Fill;
          border?: Partial<ExcelJS.Borders>;
          alignment?: Partial<ExcelJS.Alignment>;
          numFmt?: string;
        }
      ) => {
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cell = sheet.getCell(r, c);
            if (style.font) cell.font = style.font;
            if (style.fill) cell.fill = style.fill;
            if (style.border) cell.border = style.border;
            if (style.alignment) cell.alignment = style.alignment;
            if (style.numFmt) cell.numFmt = style.numFmt;
          }
        }
      };

      // Helper to draw outer outline around a rectangular region
      const outlineRegion = (
        startCol: number,
        startRow: number,
        endCol: number,
        endRow: number,
        borderStyle: ExcelJS.BorderStyle = 'medium',
        borderColor: string = 'FF047857'
      ) => {
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cell = sheet.getCell(r, c);
            const curB = cell.border || {};
            const newB: Partial<ExcelJS.Borders> = { ...curB };

            if (r === startRow) newB.top = { style: borderStyle, color: { argb: borderColor } };
            if (r === endRow) newB.bottom = { style: borderStyle, color: { argb: borderColor } };
            if (c === startCol) newB.left = { style: borderStyle, color: { argb: borderColor } };
            if (c === endCol) newB.right = { style: borderStyle, color: { argb: borderColor } };

            cell.border = newB;
          }
        }
      };

      // 1. Title Banner (A1:AK1 & A2:AK2)
      sheet.mergeCells('A1:AK1');
      sheet.getCell('A1').value = 'CHECKROLL PEKERJA / PRODUKTIVITI & BAYARAN';
      styleRange(1, 1, 37, 1, {
        font: { name: 'Arial', size: 18, bold: true, color: { argb: 'FF0B4F26' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      sheet.getRow(1).height = 30;

      sheet.mergeCells('A2:AK2');
      sheet.getCell('A2').value = '— Rekod bulanan bagi seorang pekerja —';
      styleRange(1, 2, 37, 2, {
        font: { name: 'Arial', size: 11, italic: true, color: { argb: 'FF047857' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      sheet.getRow(2).height = 18;

      sheet.getRow(3).height = 10; // Blank spacer row 3

      // 2. Top Info Boxes (Rows 4 & 5)
      // Left Box: A4:M5 (Nama Pekerja & No Passport)
      sheet.mergeCells('A4:C4');
      sheet.getCell('A4').value = '  Nama Pekerja:';
      sheet.mergeCells('D4:M4');
      sheet.getCell('D4').value = selectedWorker.name.toUpperCase();

      sheet.mergeCells('A5:C5');
      sheet.getCell('A5').value = '  No. Passport:';
      sheet.mergeCells('D5:M5');
      sheet.getCell('D5').value = (selectedWorker.worker_no || 'TIDAK DIISI').toUpperCase();

      styleRange(1, 4, 3, 4, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
      });
      styleRange(4, 4, 13, 4, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
      });
      styleRange(1, 5, 3, 5, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
      });
      styleRange(4, 5, 13, 5, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }
      });
      outlineRegion(1, 4, 13, 5, 'medium', 'FFEF4444');

      // Right Box: U4:AK5 (Bulan & Kod Ladang / Blok)
      sheet.mergeCells('U4:X4');
      sheet.getCell('U4').value = '  Bulan:';
      sheet.mergeCells('Y4:AK4');
      sheet.getCell('Y4').value = monthDisplayLabel.toUpperCase();

      sheet.mergeCells('U5:X5');
      sheet.getCell('U5').value = '  Kod Ladang / Blok:';
      sheet.mergeCells('Y5:AK5');
      sheet.getCell('Y5').value = estateCode.toUpperCase();

      styleRange(21, 4, 24, 4, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      });
      styleRange(25, 4, 37, 4, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      });
      styleRange(21, 5, 24, 5, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      });
      styleRange(25, 5, 37, 5, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      });
      outlineRegion(21, 4, 37, 5, 'medium', 'FF10B981');

      sheet.getRow(4).height = 20;
      sheet.getRow(5).height = 20;
      sheet.getRow(6).height = 12; // Spacer row 6

      // 3. Main Productivity Table Header (Rows 7 & 8)
      sheet.mergeCells('A7:A8');
      sheet.getCell('A7').value = 'BIL.';

      sheet.mergeCells('B7:B8');
      sheet.getCell('B7').value = 'JENIS KERJA';

      sheet.mergeCells('C7:AG7');
      sheet.getCell('C7').value = 'TARIKH (KUANTITI KERJA)';

      sheet.mergeCells('AH7:AH8');
      sheet.getCell('AH7').value = 'JUMLAH\nKUANTITI';

      sheet.mergeCells('AI7:AI8');
      sheet.getCell('AI7').value = 'KADAR\nBAYARAN';

      sheet.mergeCells('AJ7:AJ8');
      sheet.getCell('AJ7').value = 'JUMLAH\nPRODUKTIVITI';

      sheet.mergeCells('AK7:AK8');
      sheet.getCell('AK7').value = 'JUMLAH\nBAYARAN\n(RM)';

      // Style all header cells in Rows 7 & 8 with solid dark green background & white text
      styleRange(1, 7, 37, 8, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
        border: darkGreenBorder,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
      });

      // Set Day Numbers on Row 8 (Cols 3 to 33 -> C to AG)
      for (let day = 1; day <= 31; day++) {
        const colLetter = sheet.getColumn(2 + day).letter;
        const cell = sheet.getCell(`${colLetter}8`);
        cell.value = day;
        
        const isSunday = sundayDays.includes(day);
        if (isSunday) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
        }
        cell.border = darkGreenBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      sheet.getRow(7).height = 22;
      sheet.getRow(8).height = 20;

      // 4. Data Rows (Starting Row 9)
      calculatedRows.forEach((row, idx) => {
        const rowNum = 9 + idx;

        // Col 1 (A): BIL
        sheet.getCell(rowNum, 1).value = idx + 1;
        styleRange(1, rowNum, 1, rowNum, {
          font: { name: 'Arial', size: 10, bold: true },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        // Col 2 (B): JENIS KERJA
        sheet.getCell(rowNum, 2).value = `[${row.code}] ${row.work_type} (unit: ${row.unit})`;
        styleRange(2, rowNum, 2, rowNum, {
          font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } },
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: thinBorder
        });

        // Cols 3 to 33: Days 1..31
        for (let day = 1; day <= 31; day++) {
          const colIdx = 2 + day;
          const qty = row.dailyQuantities[day];
          const cell = sheet.getCell(rowNum, colIdx);
          
          if (qty !== undefined && qty !== null) {
            cell.value = qty;
            cell.font = { name: 'Arial', size: 10, bold: true };
          } else {
            cell.value = '';
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' };

          if (sundayDays.includes(day)) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
          }
          cell.border = thinBorder;
        }

        // Col 34 (AH): JUMLAH KUANTITI
        sheet.getCell(rowNum, 34).value = row.totalQty;
        styleRange(34, rowNum, 34, rowNum, {
          font: { name: 'Arial', size: 11, bold: true },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        // Col 35 (AI): KADAR BAYARAN
        sheet.getCell(rowNum, 35).value = `RM${row.rate.toFixed(2)} / ${row.unit}`;
        styleRange(35, rowNum, 35, rowNum, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        // Col 36 (AJ): JUMLAH PRODUKTIVITI
        sheet.getCell(rowNum, 36).value = row.totalQty;
        styleRange(36, rowNum, 36, rowNum, {
          font: { name: 'Arial', size: 11, bold: true },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        // Col 37 (AK): JUMLAH BAYARAN (RM)
        sheet.getCell(rowNum, 37).value = row.totalAmount;
        sheet.getCell(rowNum, 37).numFmt = '"RM " #,##0.00';
        styleRange(37, rowNum, 37, rowNum, {
          font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
          alignment: { horizontal: 'right', vertical: 'middle' },
          border: thinBorder
        });

        sheet.getRow(rowNum).height = 24;
      });

      // 5. Bottom Cards Section (Cards 1, 2, 3 Side-By-Side)
      const cardStartRow = 9 + calculatedRows.length + 2;

      // CARD 1: 1. RINGKASAN BAYARAN (Cols A to M -> 1 to 13)
      sheet.mergeCells(`A${cardStartRow}:M${cardStartRow}`);
      sheet.getCell(`A${cardStartRow}`).value = '1  RINGKASAN BAYARAN';
      styleRange(1, cardStartRow, 13, cardStartRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      const sub1Row = cardStartRow + 1;
      sheet.getCell(`A${sub1Row}`).value = 'BIL.';
      sheet.mergeCells(`B${sub1Row}:I${sub1Row}`);
      sheet.getCell(`B${sub1Row}`).value = 'JENIS KERJA';
      sheet.mergeCells(`J${sub1Row}:M${sub1Row}`);
      sheet.getCell(`J${sub1Row}`).value = 'JUMLAH BAYARAN (RM)';

      styleRange(1, sub1Row, 1, sub1Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      styleRange(2, sub1Row, 9, sub1Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'left', vertical: 'middle' }
      });
      styleRange(10, sub1Row, 13, sub1Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'right', vertical: 'middle' }
      });

      calculatedRows.forEach((r, idx) => {
        const curR = sub1Row + 1 + idx;
        sheet.getCell(`A${curR}`).value = idx + 1;
        styleRange(1, curR, 1, curR, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        sheet.mergeCells(`B${curR}:I${curR}`);
        sheet.getCell(`B${curR}`).value = `[${r.code}] ${r.work_type}`;
        styleRange(2, curR, 9, curR, {
          font: { name: 'Arial', size: 9, bold: true },
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: thinBorder
        });

        sheet.mergeCells(`J${curR}:M${curR}`);
        sheet.getCell(`J${curR}`).value = r.totalAmount;
        sheet.getCell(`J${curR}`).numFmt = '"RM " #,##0.00';
        styleRange(10, curR, 13, curR, {
          font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } },
          alignment: { horizontal: 'right', vertical: 'middle' },
          border: thinBorder
        });
      });

      const card1TotalRow = sub1Row + 1 + calculatedRows.length;
      sheet.mergeCells(`A${card1TotalRow}:I${card1TotalRow}`);
      sheet.getCell(`A${card1TotalRow}`).value = 'JUMLAH KASAR';
      styleRange(1, card1TotalRow, 9, card1TotalRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });

      sheet.mergeCells(`J${card1TotalRow}:M${card1TotalRow}`);
      sheet.getCell(`J${card1TotalRow}`).value = jumlahKasar;
      sheet.getCell(`J${card1TotalRow}`).numFmt = '"RM " #,##0.00';
      styleRange(10, card1TotalRow, 13, card1TotalRow, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });

      outlineRegion(1, cardStartRow, 13, card1TotalRow, 'medium', 'FF065F46');

      // CARD 2: 2. POTONGAN (Cols O to AA -> 15 to 27)
      sheet.mergeCells(`O${cardStartRow}:AA${cardStartRow}`);
      sheet.getCell(`O${cardStartRow}`).value = '2  POTONGAN';
      styleRange(15, cardStartRow, 27, cardStartRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      const sub2Row = cardStartRow + 1;
      sheet.getCell(`O${sub2Row}`).value = 'BIL.';
      sheet.mergeCells(`P${sub2Row}:W${sub2Row}`);
      sheet.getCell(`P${sub2Row}`).value = 'JENIS POTONGAN';
      sheet.mergeCells(`X${sub2Row}:AA${sub2Row}`);
      sheet.getCell(`X${sub2Row}`).value = 'AMAUN (RM)';

      styleRange(15, sub2Row, 15, sub2Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      styleRange(16, sub2Row, 23, sub2Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'left', vertical: 'middle' }
      });
      styleRange(24, sub2Row, 27, sub2Row, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECE9' } },
        border: thinBorder,
        alignment: { horizontal: 'right', vertical: 'middle' }
      });

      const maxSummaryRows = Math.max(calculatedRows.length, deductions.length, 4);
      for (let i = 0; i < maxSummaryRows; i++) {
        const curR = sub2Row + 1 + i;
        const ded = deductions[i];

        sheet.getCell(`O${curR}`).value = i + 1;
        styleRange(15, curR, 15, curR, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });

        sheet.mergeCells(`P${curR}:W${curR}`);
        sheet.getCell(`P${curR}`).value = ded ? ded.description : '-';
        styleRange(16, curR, 23, curR, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: thinBorder
        });

        sheet.mergeCells(`X${curR}:AA${curR}`);
        sheet.getCell(`X${curR}`).value = ded ? (Number(ded.amount) || 0) : '-';
        if (ded) sheet.getCell(`X${curR}`).numFmt = '"RM " #,##0.00';
        styleRange(24, curR, 27, curR, {
          font: { name: 'Arial', size: 9 },
          alignment: { horizontal: 'right', vertical: 'middle' },
          border: thinBorder
        });
      }

      const card2TotalRow = sub2Row + 1 + maxSummaryRows;
      sheet.mergeCells(`O${card2TotalRow}:W${card2TotalRow}`);
      sheet.getCell(`O${card2TotalRow}`).value = 'JUMLAH POTONGAN';
      styleRange(15, card2TotalRow, 23, card2TotalRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });

      sheet.mergeCells(`X${card2TotalRow}:AA${card2TotalRow}`);
      sheet.getCell(`X${card2TotalRow}`).value = jumlahPotongan;
      sheet.getCell(`X${card2TotalRow}`).numFmt = '"RM " #,##0.00';
      styleRange(24, card2TotalRow, 27, card2TotalRow, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });

      outlineRegion(15, cardStartRow, 27, card2TotalRow, 'medium', 'FF065F46');

      // CARD 3: 3. RINGKASAN AKHIR (Cols AC to AK -> 29 to 37)
      sheet.mergeCells(`AC${cardStartRow}:AK${cardStartRow}`);
      sheet.getCell(`AC${cardStartRow}`).value = '3  RINGKASAN AKHIR';
      styleRange(29, cardStartRow, 37, cardStartRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      const r1 = cardStartRow + 1;
      sheet.mergeCells(`AC${r1}:AG${r1}`);
      sheet.getCell(`AC${r1}`).value = 'Jumlah Kasar';
      styleRange(29, r1, 33, r1, {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });

      sheet.mergeCells(`AH${r1}:AK${r1}`);
      sheet.getCell(`AH${r1}`).value = jumlahKasar;
      sheet.getCell(`AH${r1}`).numFmt = '"RM " #,##0.00';
      styleRange(34, r1, 37, r1, {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });

      const r2 = cardStartRow + 2;
      sheet.mergeCells(`AC${r2}:AG${r2}`);
      sheet.getCell(`AC${r2}`).value = '(-) Jumlah Potongan';
      styleRange(29, r2, 33, r2, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });

      sheet.mergeCells(`AH${r2}:AK${r2}`);
      sheet.getCell(`AH${r2}`).value = jumlahPotongan;
      sheet.getCell(`AH${r2}`).numFmt = '"RM " #,##0.00';
      styleRange(34, r2, 37, r2, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: thinBorder
      });

      // Big Prominent Final Total Box (Merged across 2 rows)
      const rBigStart = cardStartRow + 3;
      const rBigEnd = cardStartRow + 4;

      sheet.mergeCells(`AC${rBigStart}:AF${rBigEnd}`);
      sheet.getCell(`AC${rBigStart}`).value = 'JUMLAH BERSIH\nDIBAYAR';
      styleRange(29, rBigStart, 32, rBigEnd, {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
      });

      sheet.mergeCells(`AG${rBigStart}:AK${rBigEnd}`);
      sheet.getCell(`AG${rBigStart}`).value = jumlahBersih;
      sheet.getCell(`AG${rBigStart}`).numFmt = '"RM " #,##0.00';
      styleRange(33, rBigStart, 37, rBigEnd, {
        font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      outlineRegion(29, cardStartRow, 37, rBigEnd, 'medium', 'FF065F46');

      // 6. Footer Signatures (Bottom)
      const sigStartRow = Math.max(card1TotalRow, card2TotalRow, rBigEnd) + 3;

      // Signature Box 1: Disediakan oleh (A..I)
      sheet.mergeCells(`A${sigStartRow}:I${sigStartRow}`);
      sheet.getCell(`A${sigStartRow}`).value = 'Disediakan oleh';
      styleRange(1, sigStartRow, 9, sigStartRow, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      sheet.mergeCells(`A${sigStartRow + 3}:I${sigStartRow + 3}`);
      sheet.getCell(`A${sigStartRow + 3}`).value = `Nama: ${preparedBy.toUpperCase()}`;
      styleRange(1, sigStartRow + 3, 9, sigStartRow + 3, {
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      sheet.mergeCells(`A${sigStartRow + 4}:I${sigStartRow + 4}`);
      sheet.getCell(`A${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
      styleRange(1, sigStartRow + 4, 9, sigStartRow + 4, {
        font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });
      outlineRegion(1, sigStartRow, 9, sigStartRow + 4, 'thin', 'FF9CA3AF');

      // Signature Box 2: Disemak oleh (K..S)
      sheet.mergeCells(`K${sigStartRow}:S${sigStartRow}`);
      sheet.getCell(`K${sigStartRow}`).value = 'Disemak oleh';
      styleRange(11, sigStartRow, 19, sigStartRow, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      sheet.mergeCells(`K${sigStartRow + 3}:S${sigStartRow + 3}`);
      sheet.getCell(`K${sigStartRow + 3}`).value = `Nama: ${reviewedBy.toUpperCase()}`;
      styleRange(11, sigStartRow + 3, 19, sigStartRow + 3, {
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      sheet.mergeCells(`K${sigStartRow + 4}:S${sigStartRow + 4}`);
      sheet.getCell(`K${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
      styleRange(11, sigStartRow + 4, 19, sigStartRow + 4, {
        font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });
      outlineRegion(11, sigStartRow, 19, sigStartRow + 4, 'thin', 'FF9CA3AF');

      // Signature Box 3: Diluluskan oleh (U..AC)
      sheet.mergeCells(`U${sigStartRow}:AC${sigStartRow}`);
      sheet.getCell(`U${sigStartRow}`).value = 'Diluluskan oleh';
      styleRange(21, sigStartRow, 29, sigStartRow, {
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF4B5563' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      sheet.mergeCells(`U${sigStartRow + 3}:AC${sigStartRow + 3}`);
      sheet.getCell(`U${sigStartRow + 3}`).value = `Nama: ${approvedBy.toUpperCase()}`;
      styleRange(21, sigStartRow + 3, 29, sigStartRow + 3, {
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });

      sheet.mergeCells(`U${sigStartRow + 4}:AC${sigStartRow + 4}`);
      sheet.getCell(`U${sigStartRow + 4}`).value = 'Tarikh: ____ / ____ / ________';
      styleRange(21, sigStartRow + 4, 29, sigStartRow + 4, {
        font: { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
      });
      outlineRegion(21, sigStartRow, 29, sigStartRow + 4, 'thin', 'FF9CA3AF');

      // Box 4: Tarikh Pembayaran (AE..AK)
      sheet.mergeCells(`AE${sigStartRow}:AK${sigStartRow}`);
      sheet.getCell(`AE${sigStartRow}`).value = 'Tarikh Pembayaran';
      styleRange(31, sigStartRow, 37, sigStartRow, {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      sheet.mergeCells(`AE${sigStartRow + 1}:AK${sigStartRow + 3}`);
      sheet.getCell(`AE${sigStartRow + 1}`).value = '____ / ____ / ________';
      styleRange(31, sigStartRow + 1, 37, sigStartRow + 3, {
        font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      sheet.mergeCells(`AE${sigStartRow + 4}:AK${sigStartRow + 4}`);
      sheet.getCell(`AE${sigStartRow + 4}`).value = '( hh / bb / tttt )';
      styleRange(31, sigStartRow + 4, 37, sigStartRow + 4, {
        font: { name: 'Arial', size: 9, italic: true, color: { argb: 'FF047857' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      outlineRegion(31, sigStartRow, 37, sigStartRow + 4, 'medium', 'FF047857');

      // Set Column Widths for a clean layout
      sheet.getColumn(1).width = 6;   // BIL
      sheet.getColumn(2).width = 28;  // JENIS KERJA
      for (let day = 1; day <= 31; day++) {
        sheet.getColumn(2 + day).width = 4.2; // Days 1 to 31
      }
      sheet.getColumn(34).width = 14; // JUMLAH KUANTITI
      sheet.getColumn(35).width = 16; // KADAR BAYARAN
      sheet.getColumn(36).width = 14; // JUMLAH PRODUKTIVITI
      sheet.getColumn(37).width = 20; // JUMLAH BAYARAN (RM)

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const fileName = `Checkroll_${selectedWorker.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      onShowToast('success', `Fail Excel "${fileName}" berjaya dimuat turun!`);
    } catch (err: any) {
      console.error('Error exporting Excel checkroll:', err);
      onShowToast('error', 'Gagal memuat turun Excel: ' + err.message);
    }
  };

  // Printable Handler
  const handlePrint = () => {
    window.print();
  };

  const getBadgeColor = (code: string) => {
    switch (code) {
      case 'MB': return 'bg-emerald-600 text-white';
      case 'MR': return 'bg-amber-500 text-white';
      case 'PP': return 'bg-blue-600 text-white';
      case 'MN': return 'bg-purple-600 text-white';
      case 'BR': return 'bg-orange-500 text-white';
      case 'RC': return 'bg-rose-600 text-white';
      case 'GD': return 'bg-cyan-600 text-white';
      case 'CP': return 'bg-teal-600 text-white';
      case 'MD': return 'bg-indigo-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* TOP CONTROLS & WORKER SELECTOR BAR (Hide in Print Mode) */}
      <div className={`p-4 rounded-2xl border print:hidden ${
        isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Worker Navigation 1-by-1 */}
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={handlePrevWorker}
              disabled={selectedWorkerIndex === 0}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center gap-1 text-xs font-bold"
              title="Pekerja Sebelah"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Sebelum</span>
            </button>

            {/* Dropdown Worker Selector */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                <User size={16} />
              </div>
              <select
                value={selectedWorkerIndex}
                onChange={(e) => setSelectedWorkerIndex(Number(e.target.value))}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800 border-white/10 text-white focus:border-emerald-500' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-600 shadow-sm'
                }`}
              >
                {filteredWorkers.map((w, idx) => (
                  <option key={w.id || idx} value={idx}>
                    {idx + 1}. {w.name} ({w.worker_no || 'NO ID'}) — {w.role || 'Pekerja'} [{w.negara_asal || 'Malaysia'}]
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextWorker}
              disabled={selectedWorkerIndex >= filteredWorkers.length - 1}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center gap-1 text-xs font-bold"
              title="Pekerja Seterusnya"
            >
              <span className="hidden sm:inline">Seterusnya</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month & Search Controls */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Worker Input */}
            <div className="relative min-w-[150px]">
              <input
                type="text"
                placeholder="Cari pekerja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border ${
                  isDarkMode ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            {/* Month Picker */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/10">
              <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => selectedWorker && loadTaskAssignmentsForWorker(selectedWorker.id, selectedMonth)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Muat Semula Tugasan Kerja Dari System"
            >
              <RefreshCw size={13} />
              <span>Import Tugasan</span>
            </button>

            <button
              onClick={handleSaveCheckroll}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Save size={13} />
              <span>Simpan</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Muat Turun Checkroll Pekerja Ini sahaja"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Excel (Pekerja Ini)</span>
            </button>

            <button
              onClick={handleExportAllWorkersExcel}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95 border border-emerald-500/30"
              title="Muat Turun Checkroll Keseluruhan Semua Pekerja (Ringkasan + Helaian Individu)"
            >
              <Download size={13} />
              <span>Muat Turun Keseluruhan (Excel)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Cetak</span>
            </button>

          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CHECKROLL CARD / A4 DOCUMENT PRINT AREA */}
      {/* ========================================================= */}
      <div id="checkroll-print-area" className={`p-4 sm:p-6 md:p-8 rounded-3xl border print:p-0 print:border-none print:bg-white print:text-black ${
        isDarkMode ? 'bg-slate-900 border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'
      }`}>

        {/* 1. DOCUMENT HEADER BANNER */}
        <div className="text-center mb-6 pb-4 border-b-2 border-emerald-600 dark:border-emerald-500">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-emerald-700 dark:text-emerald-400 font-black tracking-widest text-lg sm:text-2xl uppercase">
              CHECKROLL PEKERJA / PRODUKTIVITI &amp; BAYARAN
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold italic text-slate-500 dark:text-slate-400">
            Rekod bulanan bagi seorang pekerja — Diselaraskan dengan Kadar Upah Kerja (KUK SIRI 8)
          </p>
        </div>

        {/* 2. WORKER & ESTATE DETAILS GRID BOX (4 BOXES AS IN SCREENSHOT) */}
        {selectedWorker && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            
            {/* Box 1: Nama Pekerja */}
            <div className="p-3 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 flex items-center gap-3">
              <div className="p-2 bg-red-500 text-white rounded-xl shadow-sm">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-red-600 dark:text-red-400">Nama Pekerja:</p>
                <p className="text-xs font-black truncate text-slate-900 dark:text-white uppercase">
                  {selectedWorker.name}
                </p>
              </div>
            </div>

            {/* Box 2: No. Passport / ID */}
            <div className="p-3 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 flex items-center gap-3">
              <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
                <ShieldCheck size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-red-600 dark:text-red-400">No. Passport / Worker ID:</p>
                <p className="text-xs font-black truncate text-slate-900 dark:text-white uppercase">
                  {selectedWorker.worker_no || 'TIDAK DIISI'}
                </p>
              </div>
            </div>

            {/* Box 3: Bulan */}
            <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                <Calendar size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Bulan &amp; Tahun:</p>
                <p className="text-xs font-black truncate text-slate-900 dark:text-white uppercase">
                  {monthDisplayLabel}
                </p>
              </div>
            </div>

            {/* Box 4: Kod Ladang / Blok */}
            <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center gap-3">
              <div className="p-2 bg-emerald-700 text-white rounded-xl shadow-sm">
                <Tag size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Kod Ladang / Blok:</p>
                <input
                  type="text"
                  value={estateCode}
                  onChange={(e) => setEstateCode(e.target.value)}
                  className="w-full bg-transparent text-xs font-black text-slate-900 dark:text-white uppercase focus:outline-none focus:border-b focus:border-emerald-500"
                />
              </div>
            </div>

          </div>
        )}

        {/* 3. MAIN PRODUCTIVITY MATRIX TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 mb-6 custom-scrollbar">
          <table className="w-full border-collapse text-left text-[11px] min-w-[1000px]">
            <thead>
              <tr className="bg-emerald-800 text-white dark:bg-emerald-950 uppercase text-[10px] font-black tracking-wider border-b border-emerald-900">
                <th className="py-2 px-2 text-center border-r border-emerald-700/50 w-8">BIL.</th>
                <th className="py-2 px-3 border-r border-emerald-700/50 w-48">JENIS KERJA</th>
                
                {/* 31 DAYS COLUMNS HEADER */}
                <th colSpan={31} className="py-1 px-1 text-center border-r border-emerald-700/50 bg-emerald-900">
                  TARIKH (KUANTITI KERJA)
                </th>

                <th className="py-2 px-2 text-center border-r border-emerald-700/50 w-20">JUMLAH KUANTITI</th>
                <th className="py-2 px-2 text-center border-r border-emerald-700/50 w-28">KADAR BAYARAN</th>
                <th className="py-2 px-2 text-center border-r border-emerald-700/50 w-20">JUMLAH PRODUKTIVITI</th>
                <th className="py-2 px-3 text-right w-28">JUMLAH BAYARAN (RM)</th>
              </tr>

              {/* SECOND HEADER ROW WITH INDIVIDUAL DAY NUMBERS 1..31 */}
              <tr className="bg-emerald-700 dark:bg-emerald-900 text-white text-[9px] font-black border-b border-emerald-800">
                <th className="border-r border-emerald-600/50"></th>
                <th className="border-r border-emerald-600/50"></th>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const isSunday = sundayDays.includes(day);
                  const isOutMonth = day > daysInMonth;
                  return (
                    <th 
                      key={day} 
                      className={`text-center py-1 w-6 border-r border-emerald-600/40 ${
                        isOutMonth ? 'opacity-30 bg-emerald-900/50' : isSunday ? 'bg-red-600 text-white font-extrabold' : ''
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}
                <th className="border-r border-emerald-600/50"></th>
                <th className="border-r border-emerald-600/50"></th>
                <th className="border-r border-emerald-600/50"></th>
                <th></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-medium">
              {calculatedRows.map((row, idx) => (
                <tr 
                  key={row.id} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                    idx % 2 === 0 ? 'bg-white dark:bg-slate-900/50' : 'bg-slate-50/50 dark:bg-slate-800/20'
                  }`}
                >
                  {/* Row index */}
                  <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 dark:border-white/10">
                    {idx + 1}
                  </td>

                  {/* Jenis Kerja Name & Code Badge */}
                  <td className="py-2 px-3 border-r border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black ${getBadgeColor(row.code)}`}>
                        {row.code}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={row.work_type}
                          onChange={(e) => handleUpdateJobDetails(row.id, 'work_type', e.target.value)}
                          className="w-full font-black text-slate-900 dark:text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
                        />
                        <div className="text-[9px] text-slate-400 italic">
                          (unit: {row.unit})
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteJobRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 print:hidden"
                        title="Padam Baris"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>

                  {/* 31 DAYS QUANTITY INPUT CELLS */}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const isSunday = sundayDays.includes(day);
                    const isOutMonth = day > daysInMonth;
                    const val = row.dailyQuantities[day] ?? '';

                    return (
                      <td 
                        key={day} 
                        className={`text-center p-0 border-r border-slate-200 dark:border-white/10 ${
                          isOutMonth ? 'bg-slate-100 dark:bg-slate-950/50' : isSunday ? 'bg-red-500/5 dark:bg-red-950/10' : ''
                        }`}
                      >
                        {!isOutMonth ? (
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={val}
                            onChange={(e) => handleQuantityChange(row.id, day, e.target.value)}
                            className={`w-full text-center py-2 text-[10px] font-bold bg-transparent focus:outline-none focus:bg-emerald-100 dark:focus:bg-emerald-950/60 focus:text-emerald-900 dark:focus:text-white ${
                              val ? 'text-slate-900 dark:text-emerald-300 font-extrabold' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Jumlah Kuantiti */}
                  <td className="py-2 px-2 text-center font-extrabold text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 border-r border-slate-200 dark:border-white/10">
                    {row.totalQty || 0}
                  </td>

                  {/* Kadar Bayaran (RAG KUK Siri 8) */}
                  <td className="py-2 px-2 text-center border-r border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-center gap-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      <span>RM</span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.rate}
                        onChange={(e) => handleUpdateJobDetails(row.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-12 text-center font-bold bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[9px] text-slate-400">/{row.unit}</span>
                    </div>
                  </td>

                  {/* Jumlah Produktiviti */}
                  <td className="py-2 px-2 text-center font-extrabold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-white/10">
                    {row.totalQty || 0}
                  </td>

                  {/* Jumlah Bayaran RM */}
                  <td className="py-2 px-3 text-right font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs">
                    {row.totalAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BUTTON: ADD CUSTOM JOB ROW */}
        <div className="mb-6 flex justify-start print:hidden">
          <button
            onClick={handleAddJobRow}
            className="px-3 py-1.5 border border-dashed border-emerald-500 hover:border-emerald-600 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Plus size={14} />
            <span>Tambah Jenis Kerja Lagi</span>
          </button>
        </div>

        {/* 4. BOTTOM THREE CARDS ROW (MATCHING SCREENSHOT LAYOUT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          
          {/* CARD 1: RINGKASAN BAYARAN */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                  1
                </span>
                <h4 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">
                  RINGKASAN BAYARAN
                </h4>
              </div>

              <table className="w-full text-left text-xs mb-3">
                <thead>
                  <tr className="border-b border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-slate-500 uppercase">
                    <th className="py-1">BIL.</th>
                    <th className="py-1">JENIS KERJA</th>
                    <th className="py-1 text-right">JUMLAH BAYARAN (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                  {calculatedRows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="py-1.5 font-bold text-slate-500 text-[11px]">{i + 1}</td>
                      <td className="py-1.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <span className={`px-1 rounded text-[8px] font-mono ${getBadgeColor(r.code)}`}>
                          {r.code}
                        </span>
                        <span>{r.work_type}</span>
                      </td>
                      <td className="py-1.5 text-right font-black text-slate-900 dark:text-white">
                        {r.totalAmount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t-2 border-emerald-600 flex justify-between items-center font-black text-xs text-emerald-900 dark:text-emerald-200">
              <span>JUMLAH KASAR</span>
              <span className="text-sm">RM {jumlahKasar.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* CARD 2: POTONGAN */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                    2
                  </span>
                  <h4 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">
                    POTONGAN
                  </h4>
                </div>
                <button
                  onClick={handleAddDeduction}
                  className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline print:hidden flex items-center gap-1"
                >
                  <Plus size={11} /> Tambah
                </button>
              </div>

              {deductions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-semibold italic">
                  Tiada potongan direkodkan (-)
                </div>
              ) : (
                <table className="w-full text-left text-xs mb-3">
                  <thead>
                    <tr className="border-b border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-slate-500 uppercase">
                      <th className="py-1">BIL.</th>
                      <th className="py-1">JENIS POTONGAN</th>
                      <th className="py-1 text-right">AMAUN (RM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                    {deductions.map((d, i) => (
                      <tr key={d.id}>
                        <td className="py-1.5 font-bold text-slate-500 text-[11px]">{i + 1}</td>
                        <td className="py-1.5">
                          <input
                            type="text"
                            value={d.description}
                            onChange={(e) => handleUpdateDeduction(d.id, 'description', e.target.value)}
                            className="w-full bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 text-right font-black text-slate-900 dark:text-white">
                          <input
                            type="number"
                            step="0.01"
                            value={d.amount}
                            onChange={(e) => handleUpdateDeduction(d.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border-b border-dashed border-slate-300 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-2 border-t-2 border-emerald-600 flex justify-between items-center font-black text-xs text-emerald-900 dark:text-emerald-200">
              <span>JUMLAH POTONGAN</span>
              <span className="text-sm">RM {jumlahPotongan.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* CARD 3: RINGKASAN AKHIR & JUMLAH BERSIH */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                  3
                </span>
                <h4 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">
                  RINGKASAN AKHIR
                </h4>
              </div>

              <div className="space-y-2 mb-4 text-xs font-bold">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Jumlah Kasar</span>
                  <span className="font-mono font-black text-sm">
                    RM {jumlahKasar.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                  <span>(-) Jumlah Potongan</span>
                  <span className="font-mono font-black text-sm">
                    RM {jumlahPotongan.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* BIG PROMINENT GREEN FINAL AMOUNT BOX */}
            <div className="p-4 rounded-2xl bg-emerald-700 text-white shadow-md flex items-center justify-between border border-emerald-600">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
                JUMLAH BERSIH DIBAYAR
              </span>
              <span className="text-lg sm:text-2xl font-black font-mono">
                RM {jumlahBersih.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

        </div>

        {/* 5. FOOTER SIGNATURES & PAYMENT DATE SECTION */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Sign 1 */}
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-8">Disediakan oleh</p>
            <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{preparedBy}</p>
            <p className="text-[9px] text-slate-400">Tarikh: ____/____/________</p>
          </div>

          {/* Sign 2 */}
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-8">Disemak oleh</p>
            <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{reviewedBy}</p>
            <p className="text-[9px] text-slate-400">Tarikh: ____/____/________</p>
          </div>

          {/* Sign 3 */}
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-8">Diluluskan oleh</p>
            <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
            <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{approvedBy}</p>
            <p className="text-[9px] text-slate-400">Tarikh: ____/____/________</p>
          </div>

          {/* Payment Date Box */}
          <div className="p-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 mb-1">
              Tarikh Pembayaran
            </p>
            <p className="text-sm font-black font-mono text-emerald-900 dark:text-emerald-100">
              ____ / ____ / ________
            </p>
            <p className="text-[9px] text-slate-400 italic mt-0.5">( hh / bb / tttt )</p>
          </div>

        </div>

      </div>

    </div>
  );
};
