import React, { useState, useEffect } from 'react';
import { Worker, AttendanceRecord, AttendanceStatus } from '../types';
import { 
  getWorkers, 
  getAttendanceForDate, 
  getAttendanceForMonth, 
  upsertAttendance, 
  toggleWorkerStatus 
} from '../services';
import { 
  Calendar as CalendarIcon, Save, Loader2, Users, ClipboardCheck, Info, Search, Power, AlertCircle, Printer, Download,
  LayoutGrid, Table, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, CalendarDays, Filter, ChevronLeft, ChevronRight, UserCheck
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { printReport } from '../../../utils/printHelper';

interface AttendanceSheetProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ isDarkMode, onShowToast }) => {
  // Navigation: Harian vs Bulanan
  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan'>('harian');
  
  // Basic states
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search and status filter (For Harian tab)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Tidak Aktif'>('Aktif');

  // Function to get current local date (YYYY-MM-DD) avoiding UTC offset issues during early morning rollcall
  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Kehadiran Harian selected date & map
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  // Kehadiran Bulanan state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [monthlyAttendance, setMonthlyAttendance] = useState<Record<string, Record<number, AttendanceStatus>>>({});

  // Kehadiran Bulanan UI states
  const [monthlyViewMode, setMonthlyViewMode] = useState<'kad' | 'matriks'>('kad');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);
  const [kumpulanFilter, setKumpulanFilter] = useState<string>('Semua');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Load all workers & current harian attendance
  const loadHarianData = async () => {
    try {
      setLoading(true);
      const workersList = await getWorkers();
      setWorkers(workersList);

      const existingRecords = await getAttendanceForDate(selectedDate);
      const attMap: Record<string, AttendanceStatus> = {};
      
      // Default to "Hadir" for active workers
      workersList.forEach(w => {
        if (w.is_active !== false) {
          attMap[w.id] = 'Hadir';
        }
      });

      // Override with actual db data
      existingRecords.forEach(r => {
        attMap[r.worker_id] = r.status;
      });

      setAttendance(attMap);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat kedatangan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load monthly matrix
  const loadBulananData = async () => {
    try {
      setLoading(true);
      const workersList = await getWorkers();
      setWorkers(workersList);

      const [yearStr, monthStr] = selectedMonth.split('-');
      const monthlyRecords = await getAttendanceForMonth(yearStr, monthStr);

      const matrix: Record<string, Record<number, AttendanceStatus>> = {};
      monthlyRecords.forEach(r => {
        const day = new Date(r.date).getDate();
        if (!matrix[r.worker_id]) {
          matrix[r.worker_id] = {};
        }
        matrix[r.worker_id][day] = r.status;
      });

      setMonthlyAttendance(matrix);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat rekod bulanan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'harian') {
      loadHarianData();
    } else {
      loadBulananData();
    }
  }, [activeTab, selectedDate, selectedMonth]);

  // Helper to check if a day is Sunday (Ahad = Cuti Mingguan)
  const isSunday = (day: number) => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 8;
    const date = new Date(year, month - 1, day);
    return date.getDay() === 0; // 0 = Sunday
  };

  // Print handlers for Attendance Sheet
  const handlePrintBulanan = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
    const monthName = monthNames[parseInt(monthStr, 10) - 1] || monthStr;

    const daysInMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const filtered = workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()));

    const rowsHtml = filtered.map((w, idx) => {
      const workerMonthly = monthlyAttendance[w.id] || {};
      const cellsHtml = daysArr.map(day => {
        const isSun = isSunday(day);
        const status = workerMonthly[day] || (isSun ? 'Cuti Mingguan' : undefined);
        let sym = '-';
        if (status === 'Hadir') sym = '✔';
        else if (status === 'Tidak Hadir') sym = '❌';
        else if (status === 'Cuti') sym = 'C';
        else if (status === 'Sakit') sym = 'S';
        else if (status === 'Cuti Mingguan') sym = 'CM';
        else if (status === 'Cuti Umum') sym = 'CU';

        const bgStyle = isSun ? 'background-color: #f3e8ff;' : '';
        return `<td style="text-align: center; border: 1px solid #000; padding: 2px; font-size: 8px; ${bgStyle}">${sym}</td>`;
      }).join('');

      return `
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; font-size: 8px;">
            ${w.name}<br/>
            <span style="font-size: 7px; color: #555;">${w.worker_no}</span>
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join('');

    const headersHtml = daysArr.map(d => {
      const isSun = isSunday(d);
      const bgStyle = isSun ? 'background-color: #e9d5ff; color: #581c87;' : '';
      return `<th style="border: 1px solid #000; padding: 2px; text-align: center; font-size: 8px; ${bgStyle}">${d}</th>`;
    }).join('');

    const fullHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 25px;">NO</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; min-width: 120px;">PEKERJA</th>
            ${headersHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="margin-top: 12px; font-size: 8px; font-weight: bold; text-align: center;">
        LEGEND: ✔ HADIR | ❌ TIDAK HADIR | C CUTI | S SAKIT | CM CUTI MINGGUAN (AHAD) | CU CUTI UMUM
      </div>
    `;

    printReport({
      title: `LAPORAN KEHADIRAN BULANAN PEKERJA - ${monthName} ${yearStr}`,
      subtitle: `JUMLAH PEKERJA: ${filtered.length}`,
      orientation: 'landscape',
      htmlContent: fullHtml
    });
  };

  const handlePrintHarian = () => {
    const filtered = workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()));

    const rowsHtml = filtered.map((w, idx) => {
      const activeStatus = attendance[w.id] || 'Tidak Hadir';
      return `
        <tr>
          <td style="border: 1px solid #000; text-align: center; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px;">
            <strong>${w.name}</strong><br/>
            <span style="font-size: 8px; color: #555;">${w.worker_no}</span>
          </td>
          <td style="border: 1px solid #000; padding: 6px;">${w.role || '-'} ${w.kumpulan ? `(${w.kumpulan})` : ''}</td>
          <td style="border: 1px solid #000; text-align: center; padding: 6px; font-weight: bold;">${activeStatus.toUpperCase()}</td>
        </tr>
      `;
    }).join('');

    const fullHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 35px;">NO</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">NAMA PEKERJA</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: left;">PERANAN / KUMPULAN</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 140px;">STATUS KEHADIRAN</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    printReport({
      title: `REKOD KEHADIRAN HARIAN PEKERJA`,
      subtitle: `TARIKH: ${selectedDate} | JUMLAH PEKERJA: ${filtered.length}`,
      orientation: 'portrait',
      htmlContent: fullHtml
    });
  };

  // Export handlers for Excel (.xlsx)
  const handleExportExcelBulanan = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kehadiran Bulanan');

      const [yearStr, monthStr] = selectedMonth.split('-');
      const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
      const monthName = monthNames[parseInt(monthStr, 10) - 1] || monthStr;

      const daysInMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
      const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Title
      const titleRow = worksheet.addRow([`LAPORAN KEHADIRAN BULANAN PEKERJA - ${monthName} ${yearStr}`]);
      titleRow.font = { name: 'Arial', size: 12, bold: true };
      worksheet.addRow([]);

      // Headers
      const headerValues = ['NO', 'NO. PEKERJA', 'NAMA PEKERJA', 'PERANAN', 'KUMPULAN', ...daysArr.map(d => String(d)), 'HADIR', 'CUTI', 'SAKIT', 'C.MINGGUAN', 'C.UMUM', 'TIDAK HADIR'];
      const headerRow = worksheet.addRow(headerValues);
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const filtered = workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()));

      filtered.forEach((w, idx) => {
        const workerMonthly = monthlyAttendance[w.id] || {};
        let hadirCount = 0;
        let cutiCount = 0;
        let sakitCount = 0;
        let cutiMingguanCount = 0;
        let cutiUmumCount = 0;
        let tidakHadirCount = 0;

        const dayStatuses = daysArr.map(day => {
          const isSun = isSunday(day);
          const status = workerMonthly[day] || (isSun ? 'Cuti Mingguan' : undefined);
          if (status === 'Hadir') { hadirCount++; return 'H'; }
          if (status === 'Tidak Hadir') { tidakHadirCount++; return 'TH'; }
          if (status === 'Cuti') { cutiCount++; return 'C'; }
          if (status === 'Sakit') { sakitCount++; return 'S'; }
          if (status === 'Cuti Mingguan') { cutiMingguanCount++; return 'CM'; }
          if (status === 'Cuti Umum') { cutiUmumCount++; return 'CU'; }
          return '-';
        });

        const row = worksheet.addRow([
          idx + 1,
          w.worker_no || '-',
          w.name,
          w.role || '-',
          w.kumpulan || '-',
          ...dayStatuses,
          hadirCount,
          cutiCount,
          sakitCount,
          cutiMingguanCount,
          cutiUmumCount,
          tidakHadirCount
        ]);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 8 };
          cell.alignment = { horizontal: colNumber > 5 ? 'center' : 'left', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      worksheet.columns.forEach((col, i) => {
        if (i === 2) col.width = 25;
        else if (i === 1) col.width = 14;
        else if (i === 3 || i === 4) col.width = 16;
        else col.width = 5;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Kehadiran_Bulanan_${selectedMonth}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      onShowToast('success', 'Fail Excel berjaya dimuat turun!');
    } catch (err) {
      console.error('Error exporting Excel Bulanan:', err);
      onShowToast('error', 'Gagal memuat turun fail Excel.');
    }
  };

  const handleExportExcelHarian = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kehadiran Harian');

      const titleRow = worksheet.addRow([`REKOD KEHADIRAN HARIAN PEKERJA - ${selectedDate}`]);
      titleRow.font = { name: 'Arial', size: 12, bold: true };
      worksheet.addRow([]);

      const headerRow = worksheet.addRow(['NO', 'NO. PEKERJA', 'NAMA PEKERJA', 'PERANAN', 'KUMPULAN', 'STATUS KEHADIRAN']);
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const filtered = workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()));

      filtered.forEach((w, idx) => {
        const activeStatus = attendance[w.id] || 'Tidak Hadir';
        const row = worksheet.addRow([
          idx + 1,
          w.worker_no || '-',
          w.name,
          w.role || '-',
          w.kumpulan || '-',
          activeStatus.toUpperCase()
        ]);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { horizontal: colNumber === 1 || colNumber === 6 ? 'center' : 'left', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      worksheet.columns = [
        { width: 6 },
        { width: 16 },
        { width: 30 },
        { width: 20 },
        { width: 20 },
        { width: 20 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rekod_Kehadiran_Harian_${selectedDate}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      onShowToast('success', 'Fail Excel berjaya dimuat turun!');
    } catch (err) {
      console.error('Error exporting Excel Harian:', err);
      onShowToast('error', 'Gagal memuat turun fail Excel.');
    }
  };

  // Handle single attendance toggle
  const handleStatusChange = (workerId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [workerId]: status
    }));
  };

  // Handle single worker active status toggle
  const handleToggleWorkerActive = async (workerId: string, currentStatus: boolean | undefined) => {
    try {
      const nextStatus = !currentStatus;
      await toggleWorkerStatus(workerId, nextStatus);
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, is_active: nextStatus } : w));
      onShowToast('success', `Status pekerja dikemaskini.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal menukar status aktif: ' + err.message);
    }
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      // Only save for currently active workers or workers with existing selected status
      const recordsToUpsert: Partial<AttendanceRecord>[] = Object.entries(attendance).map(([workerId, status]) => ({
        worker_id: workerId,
        date: selectedDate,
        status: status as AttendanceStatus
      }));

      await upsertAttendance(recordsToUpsert);
      onShowToast('success', `Rekod kehadiran pada ${selectedDate.split('-').reverse().join('.')} disimpan.`);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal menyimpan rekod kehadiran: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter workers based on search (only active workers for attendance)
  const filteredWorkers = workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        w.worker_no.toLowerCase().includes(searchTerm.toLowerCase());
    
    return w.is_active !== false && matchSearch;
  });

  // Calculate days of current selected month
  const getDaysInMonthList = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => i + 1);
  };

  const daysList = getDaysInMonthList();

  // Helper to get day details (short name, weekend status)
  const getDayDetails = (day: number) => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 8;
    const date = new Date(year, month - 1, day);
    const dayIndex = date.getDay(); // 0 = Ahad, 1 = Isnin ...
    const daysBM = ['A', 'I', 'S', 'R', 'K', 'J', 'S']; // Ahd, Isn, Sel, Rab, Kha, Jum, Sab
    const daysFullBM = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    return {
      short: daysBM[dayIndex],
      fullName: daysFullBM[dayIndex],
      isWeekend: dayIndex === 0 || dayIndex === 6,
      dateFormatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    };
  };

  // Helper to scroll matrix table to day
  const scrollToDay = (day: number) => {
    if (scrollContainerRef.current) {
      const targetCell = scrollContainerRef.current.querySelector(`[data-day="${day}"]`);
      if (targetCell) {
        targetCell.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  };

  // Unique list of groups for filtering
  const kumpulanList = Array.from(new Set(workers.map(w => w.kumpulan).filter(Boolean))) as string[];

  // Filtered workers for Bulanan view
  const filteredBulananWorkers = workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        w.worker_no.toLowerCase().includes(searchTerm.toLowerCase());
    const matchKumpulan = kumpulanFilter === 'Semua' || w.kumpulan === kumpulanFilter;
    return matchSearch && matchKumpulan;
  });

  // Calculate worker stats for the selected month
  const getWorkerMonthStats = (workerId: string) => {
    const workerMonthly = monthlyAttendance[workerId] || {};
    let hadir = 0;
    let tidakHadir = 0;
    let cuti = 0;
    let sakit = 0;

    daysList.forEach(day => {
      const st = workerMonthly[day];
      if (st === 'Hadir') hadir++;
      else if (st === 'Tidak Hadir') tidakHadir++;
      else if (st === 'Cuti') cuti++;
      else if (st === 'Sakit') sakit++;
    });

    const totalLogged = hadir + tidakHadir + cuti + sakit;
    const pct = totalLogged > 0 ? Math.round((hadir / totalLogged) * 100) : 0;

    return { hadir, tidakHadir, cuti, sakit, totalLogged, pct };
  };

  // Overall Month Overview calculation
  const getOverallMonthOverview = () => {
    let totalHadir = 0;
    let totalTidakHadir = 0;
    let totalCuti = 0;
    let totalSakit = 0;

    filteredBulananWorkers.forEach(w => {
      const workerMonthly = monthlyAttendance[w.id] || {};
      daysList.forEach(day => {
        const st = workerMonthly[day];
        if (st === 'Hadir') totalHadir++;
        else if (st === 'Tidak Hadir') totalTidakHadir++;
        else if (st === 'Cuti') totalCuti++;
        else if (st === 'Sakit') totalSakit++;
      });
    });

    const totalLogs = totalHadir + totalTidakHadir + totalCuti + totalSakit;
    const overallPct = totalLogs > 0 ? Math.round((totalHadir / totalLogs) * 100) : 0;

    return {
      totalWorkers: filteredBulananWorkers.length,
      totalHadir,
      totalTidakHadir,
      totalCuti,
      totalSakit,
      overallPct
    };
  };

  const monthOverview = getOverallMonthOverview();

  // Color mapping helper for statuses
  const statusConfig: Record<AttendanceStatus, { short: string, bg: string, text: string, border: string, solid: string }> = {
    'Hadir': { 
      short: 'HADIR', 
      bg: 'bg-emerald-50 dark:bg-emerald-950/20', 
      text: 'text-emerald-600 dark:text-emerald-400', 
      border: 'border-emerald-200 dark:border-emerald-900/40',
      solid: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
    },
    'Tidak Hadir': { 
      short: 'T.HADIR', 
      bg: 'bg-rose-50 dark:bg-rose-950/20', 
      text: 'text-rose-600 dark:text-rose-400', 
      border: 'border-rose-200 dark:border-rose-900/40',
      solid: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
    },
    'Cuti': { 
      short: 'CUTI', 
      bg: 'bg-amber-50 dark:bg-amber-950/20', 
      text: 'text-amber-600 dark:text-amber-400', 
      border: 'border-amber-200 dark:border-amber-900/40',
      solid: 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20'
    },
    'Sakit': { 
      short: 'SAKIT', 
      bg: 'bg-blue-50 dark:bg-blue-950/20', 
      text: 'text-blue-600 dark:text-blue-400', 
      border: 'border-blue-200 dark:border-blue-900/40',
      solid: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
    },
    'Cuti Mingguan': { 
      short: 'C.MINGGUAN', 
      bg: 'bg-purple-50 dark:bg-purple-950/20', 
      text: 'text-purple-600 dark:text-purple-400', 
      border: 'border-purple-200 dark:border-purple-900/40',
      solid: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20'
    },
    'Cuti Umum': { 
      short: 'C.UMUM', 
      bg: 'bg-indigo-50 dark:bg-indigo-950/20', 
      text: 'text-indigo-600 dark:text-indigo-400', 
      border: 'border-indigo-200 dark:border-indigo-900/40',
      solid: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
    }
  };

  // Helper function to split worker name after every 2 words for compact multi-line display
  const formatNameWords = (name: string, wordsPerLine = 2) => {
    if (!name) return [];
    const words = name.trim().split(/\s+/);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }
    return lines;
  };

  const getStatusSymbol = (status: AttendanceStatus | undefined, isSun = false) => {
    const effectiveStatus = status || (isSun ? 'Cuti Mingguan' : undefined);
    if (!effectiveStatus) return <span className="text-slate-300 dark:text-slate-700">-</span>;
    switch (effectiveStatus) {
      case 'Hadir': return <span className="text-emerald-500 font-black text-[10px]">✔</span>;
      case 'Tidak Hadir': return <span className="text-rose-500 font-black text-[10px]">❌</span>;
      case 'Cuti': return <span className="text-amber-500 font-black text-[10px]">C</span>;
      case 'Sakit': return <span className="text-blue-500 font-black text-[10px]">S</span>;
      case 'Cuti Mingguan': return <span className="text-purple-600 dark:text-purple-300 font-black text-[8px] px-1 py-0.5 rounded bg-purple-500/15 dark:bg-purple-500/25 border border-purple-500/30">CM</span>;
      case 'Cuti Umum': return <span className="text-indigo-600 dark:text-indigo-300 font-black text-[8px] px-1 py-0.5 rounded bg-indigo-500/15 dark:bg-indigo-500/25 border border-indigo-500/30">CU</span>;
    }
  };

  return (
    <div className="space-y-3">
      {/* Upper Segmented Control - compact sleek layout */}
      <div className="flex bg-slate-100 dark:bg-slate-800/40 p-1 rounded-xl max-w-xs border border-slate-200/50 dark:border-white/5">
        <button
          onClick={() => setActiveTab('harian')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'harian'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📋 Kehadiran Harian
        </button>
        <button
          onClick={() => setActiveTab('bulanan')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'bulanan'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📅 Kehadiran Bulanan
        </button>
      </div>

      {/* Date / Month Picker bar - compact */}
      <div className={`p-3 px-4 rounded-2xl border ${
        isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'
      } flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <ClipboardCheck size={16} />
          </div>
          <div>
            <h3 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeTab === 'harian' ? 'Kedatangan Harian' : 'Laporan Kehadiran Bulanan'}
            </h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase">
              {activeTab === 'harian' ? 'Urus & rekod kedatangan harian pekerja.' : `Bulan semasa: ${selectedMonth}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeTab === 'harian' ? (
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2 text-slate-400" size={12} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-32 sm:w-36 pl-8 pr-2 py-1 border rounded-lg outline-none text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode 
                    ? 'bg-slate-800 border-white/5 text-white focus:border-emerald-500' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          ) : (
            <div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`w-32 sm:w-36 px-2.5 py-1 border rounded-lg outline-none text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode 
                    ? 'bg-slate-800 border-white/5 text-white focus:border-emerald-500' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          )}

          {/* Compact Modern Excel Download Button */}
          <button
            onClick={activeTab === 'harian' ? handleExportExcelHarian : handleExportExcelBulanan}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm shadow-emerald-600/30 border border-emerald-500/30 cursor-pointer shrink-0"
            title="Muat Turun Excel (.xlsx)"
          >
            <Download size={12} className="stroke-[2.5]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Memuatkan Data...</p>
        </div>
      ) : activeTab === 'harian' ? (
        // 📋 KEHADIRAN HARIAN VIEW (Compact)
        <div className="space-y-2.5">
          {/* Search Row */}
          <div className="flex justify-between items-center">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Cari pekerja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 border rounded-xl outline-none text-[10px] font-black uppercase transition-all ${
                  isDarkMode 
                    ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Vertical Worker Cards Layout (Compact) */}
          {filteredWorkers.length === 0 ? (
            <div className={`p-8 text-center rounded-2xl border ${isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <Users size={36} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-500">Tiada pekerja dijumpai.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWorkers.map(w => {
                const activeStatus = attendance[w.id];
                
                return (
                  <div 
                    key={w.id}
                    className={`p-3 rounded-2xl border transition-all duration-300 relative ${
                      isDarkMode 
                        ? 'bg-slate-900/80 border-white/5 hover:border-white/10' 
                        : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Worker Name */}
                      <h4 className={`text-xs font-black uppercase tracking-tight ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {w.name}
                      </h4>
                      
                      {/* No & Current Group/Location */}
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">
                        {w.worker_no} • {w.role} {w.kumpulan ? `• ${w.kumpulan}` : ''}
                      </p>
                    </div>

                    {/* Horizontal Attendance Option Buttons */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2.5">
                      {(['Hadir', 'Tidak Hadir', 'Cuti', 'Sakit', 'Cuti Mingguan', 'Cuti Umum'] as AttendanceStatus[]).map(status => {
                        const isSelected = activeStatus === status;
                        const config = statusConfig[status];
                        
                        return (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(w.id, status)}
                            className={`py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-tight transition-all border text-center ${
                              isSelected 
                                ? `${config.solid} scale-[1.02] shadow-md` 
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {config.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Save Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-black">
              <Info size={14} className="text-emerald-500 shrink-0" />
              Pastikan butang simpan ditekan untuk memuktamadkan data.
            </div>
            
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white font-black text-xs uppercase tracking-wider py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Simpan Rekod Kehadiran
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // 📅 KEHADIRAN BULANAN VIEW (Exactly like Screenshot 1)
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <span>📅</span> Bulanan: {selectedMonth}
            </h3>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Cari pekerja..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 border rounded-xl outline-none text-[10px] font-black uppercase transition-all ${
                    isDarkMode 
                      ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Matrix table */}
          <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-100'} shadow-xl`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800/40 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}>
                    <th className="py-2.5 px-2.5 w-[105px] min-w-[105px] max-w-[110px] sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/90 border-r border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">Pekerja</th>
                    {daysList.map(day => {
                      const isSun = isSunday(day);
                      const dayDetails = getDayDetails(day);
                      return (
                        <th 
                          key={day} 
                          className={`py-1.5 px-0.5 text-center font-mono min-w-[30px] text-[8px] border-r border-slate-100 dark:border-white/5 ${
                            isSun 
                              ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 font-black' 
                              : ''
                          }`}
                          title={`${dayDetails.fullName} (${dayDetails.dateFormatted})`}
                        >
                          <div>{day}</div>
                          <div className="text-[7px] opacity-75">{dayDetails.short}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-[10px] font-bold uppercase">
                  {workers
                    .filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(w => {
                      const workerMonthly = monthlyAttendance[w.id] || {};
                      const nameLines = formatNameWords(w.name, 2);

                      return (
                        <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-2.5 px-2.5 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-white/5 font-black w-[105px] min-w-[105px] max-w-[110px]">
                            <div className="space-y-0.5">
                              {nameLines.map((line, idx) => (
                                <p key={idx} className="text-[9.5px] text-slate-900 dark:text-white leading-tight font-black break-words">
                                  {line}
                                </p>
                              ))}
                              <p className="text-[8px] text-slate-400 font-mono tracking-tight pt-0.5 leading-none">{w.worker_no}</p>
                            </div>
                          </td>
                          {daysList.map(day => {
                            const isSun = isSunday(day);
                            const status = workerMonthly[day];
                            return (
                              <td 
                                key={day} 
                                className={`py-2 px-0.5 text-center font-mono border-r border-slate-100 dark:border-white/5 ${
                                  isSun ? 'bg-purple-500/5 dark:bg-purple-950/20' : ''
                                }`}
                              >
                                {getStatusSymbol(status, isSun)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Legend Description */}
          <div className="flex flex-wrap items-center gap-4 text-[9px] text-slate-400 uppercase font-black pt-2">
            <span className="flex items-center gap-1">🟢 ✔ <span className="text-[8px] text-slate-500">HADIR</span></span>
            <span className="flex items-center gap-1">🔴 ❌ <span className="text-[8px] text-slate-500">TIDAK HADIR</span></span>
            <span className="flex items-center gap-1">🟡 C <span className="text-[8px] text-slate-500">CUTI</span></span>
            <span className="flex items-center gap-1">🔵 S <span className="text-[8px] text-slate-500">SAKIT</span></span>
            <span className="flex items-center gap-1">🟣 CM <span className="text-[8px] text-slate-500 font-bold">CUTI MINGGUAN (AHAD)</span></span>
            <span className="flex items-center gap-1">🔵 CU <span className="text-[8px] text-slate-500 font-bold">CUTI UMUM</span></span>
          </div>
        </div>
      )}
    </div>
  );
};
