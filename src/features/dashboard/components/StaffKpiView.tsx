import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  Award, 
  TrendingUp, 
  BarChart3, 
  AlertTriangle, 
  Search, 
  Edit3, 
  Save, 
  Printer, 
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  Droplets,
  Sprout,
  Camera,
  Trees,
  Building2,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Database,
  Cloud,
  X
} from 'lucide-react';
import { getActiveEstateId, getActiveEstateConfig, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { 
  StaffConfig, 
  StaffKpiMetrics, 
  loadEstateStaffKpi, 
  saveEstateStaffKpi, 
  resetEstateStaffKpiToDefault 
} from '../../../services/staffKpiService';

// Definition of the 6 KPI Indicators requested by user
const INDICATORS = [
  {
    key: 'hasilPct',
    shortName: 'Hasil (30%)',
    label: '1. Pencapaian Hasil Hingga Kini',
    weight: 30,
    icon: TrendingUp,
    color: 'emerald',
    desc: 'Pengeluaran BTS (MT) berbanding sasaran YTD blok kendalian'
  },
  {
    key: 'btsMudaPct',
    shortName: 'BTS Muda (15%)',
    label: '2. Laporan BTS Muda',
    weight: 15,
    icon: AlertTriangle,
    color: 'amber',
    desc: 'Kawalan kualiti tandan (Kadar BTS Muda rendah & pematuhan penuaian)'
  },
  {
    key: 'kpgKpaPct',
    shortName: 'KPG=KPA (15%)',
    label: '3. Laporan KPG=KPA',
    weight: 15,
    icon: Camera,
    color: 'blue',
    desc: 'Ketepatan Kadar Pengeluaran Gambar vs Kadar Pengeluaran Anggaran'
  },
  {
    key: 'efbPct',
    shortName: 'EFB (15%)',
    label: '4. Laporan EFB',
    weight: 15,
    icon: Trees,
    color: 'purple',
    desc: 'Pencapaian program & aplikasi Tandan Kosong (EFB)'
  },
  {
    key: 'membajaPct',
    shortName: 'Membaja (15%)',
    label: '5. Laporan Membaja',
    weight: 15,
    icon: Droplets,
    color: 'teal',
    desc: 'Pencapaian pusingan jadual pembajaan di blok kendalian'
  },
  {
    key: 'merumputPct',
    shortName: 'Merumput (10%)',
    label: '6. Laporan Merumput',
    weight: 10,
    icon: Sprout,
    color: 'lime',
    desc: 'Pencapaian program kawalan rumpai & pembersihan bulatan'
  }
];

interface StaffKpiViewProps {
  isDarkMode?: boolean;
  showToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const StaffKpiView: React.FC<StaffKpiViewProps> = ({ isDarkMode, showToast }) => {
  // Active Estate State
  const [activeEstateId, setActiveEstateId] = useState<string>(() => getActiveEstateId());
  const activeEstate = useMemo(() => getActiveEstateConfig(), [activeEstateId]);

  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'ytd'>('ytd');
  const [viewMode, setViewMode] = useState<'all' | 'charts' | 'cards'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [storageSource, setStorageSource] = useState<'local' | 'cloud' | 'default'>('default');
  const [isSaving, setIsSaving] = useState(false);

  // Staff and scores loaded per estate
  const [staffList, setStaffList] = useState<StaffConfig[]>(() => {
    const data = loadEstateStaffKpi(getActiveEstateId());
    return data.staffList;
  });

  const [customScores, setCustomScores] = useState<Record<string, { metrics: Partial<StaffKpiMetrics>; notes: string }>>(() => {
    const data = loadEstateStaffKpi(getActiveEstateId());
    return data.customScores;
  });

  // Reload data whenever estate changes or custom event is fired
  useEffect(() => {
    const handleEstateChange = (e?: any) => {
      const newId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstateId(newId);
      const data = loadEstateStaffKpi(newId);
      setStaffList(data.staffList);
      setCustomScores(data.customScores);
      setStorageSource(data.source);
      setEditingStaffId(null);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    window.addEventListener('ipds_staff_kpi_updated', handleEstateChange);

    // Initial load sync
    handleEstateChange();

    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      window.removeEventListener('ipds_staff_kpi_updated', handleEstateChange);
    };
  }, []);

  // Form state for editing
  const [editForm, setEditForm] = useState<{
    name: string;
    role: string;
    blocks: string;
    totalLuas: number;
    metrics: Record<string, number>;
    notes: string;
  }>({
    name: '',
    role: '',
    blocks: '',
    totalLuas: 0,
    metrics: {},
    notes: ''
  });

  // New staff form state
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    role: 'Penolong Penyelia / Supervisor',
    blocks: '',
    totalLuas: 100,
    chartColor: '#10b981'
  });

  const handleOpenEdit = (staff: StaffConfig) => {
    const currentCustom = customScores[staff.id]?.metrics || staff.baseMetrics;
    const currentNotes = customScores[staff.id]?.notes || staff.notes || '';
    setEditForm({
      name: staff.name,
      role: staff.role,
      blocks: staff.blocks.join(', '),
      totalLuas: staff.totalLuas,
      metrics: { ...currentCustom },
      notes: currentNotes
    });
    setEditingStaffId(staff.id);
  };

  const handleSaveEdit = async (staffId: string) => {
    setIsSaving(true);
    try {
      // 1. Update staff list metadata
      const updatedList = staffList.map(s => {
        if (s.id === staffId) {
          const blocksArray = editForm.blocks.split(',').map(b => b.trim()).filter(Boolean);
          return {
            ...s,
            name: editForm.name.trim() || s.name,
            role: editForm.role.trim() || s.role,
            blocks: blocksArray.length > 0 ? blocksArray : s.blocks,
            totalLuas: editForm.totalLuas || s.totalLuas
          };
        }
        return s;
      });

      // 2. Update custom scores
      const updatedScores = {
        ...customScores,
        [staffId]: {
          metrics: editForm.metrics,
          notes: editForm.notes
        }
      };

      setStaffList(updatedList);
      setCustomScores(updatedScores);

      const result = await saveEstateStaffKpi(activeEstateId, updatedList, updatedScores);
      setEditingStaffId(null);

      if (showToast) {
        showToast('success', `Skor KPI & maklumat staf bagi ${activeEstate.name} berjaya disimpan! ${result.cloudSynced ? '(Diselaraskan ke Supabase)' : '(Tersimpan di Storan Terasing)'}`);
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast('error', 'Gagal menyimpan skor KPI staf.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm(`Adakah anda pasti ingin menetapkan semula senarai staf & KPI ${activeEstate.name} kepada nilai rasmi asal?`)) {
      return;
    }
    await resetEstateStaffKpiToDefault(activeEstateId);
    const refreshed = loadEstateStaffKpi(activeEstateId);
    setStaffList(refreshed.staffList);
    setCustomScores({});
    setStorageSource('default');
    if (showToast) {
      showToast('info', `Maklumat KPI bagi ${activeEstate.name} telah diset semula ke konfigurasi asal.`);
    }
  };

  const handleAddNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name.trim()) return;

    const newId = `STAFF_${Date.now().toString().slice(-4)}`;
    const blocksArray = newStaffForm.blocks.split(',').map(b => b.trim()).filter(Boolean);

    const newStaff: StaffConfig = {
      id: newId,
      name: newStaffForm.name.trim().toUpperCase(),
      role: newStaffForm.role.trim(),
      blocks: blocksArray.length > 0 ? blocksArray : ['1'],
      totalLuas: Number(newStaffForm.totalLuas) || 100,
      avatarColor: 'from-teal-500 to-emerald-700',
      badgeBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      chartColor: newStaffForm.chartColor || '#06b6d4',
      baseMetrics: {
        hasilPct: 88.0,
        btsMudaPct: 90.0,
        kpgKpaPct: 88.0,
        efbPct: 85.0,
        membajaPct: 90.0,
        merumputPct: 88.0
      }
    };

    const updatedList = [...staffList, newStaff];
    setStaffList(updatedList);
    await saveEstateStaffKpi(activeEstateId, updatedList, customScores);

    setShowAddStaffModal(false);
    setNewStaffForm({
      name: '',
      role: 'Penolong Penyelia / Supervisor',
      blocks: '',
      totalLuas: 100,
      chartColor: '#10b981'
    });

    if (showToast) {
      showToast('success', `Staf baru ${newStaff.name} berjaya didaftarkan untuk ladang ${activeEstate.name}!`);
    }
  };

  // Calculate scores for each staff dynamically
  const staffKpiCalculated = useMemo(() => {
    return staffList.map((staff) => {
      const activeMetrics = customScores[staff.id]?.metrics || staff.baseMetrics;
      const notes = customScores[staff.id]?.notes || staff.notes || '';

      // Calculate weighted scores
      let totalWeightedScore = 0;
      const indicatorBreakdown = INDICATORS.map((ind) => {
        const actualVal = Math.min(100, Math.max(0, (activeMetrics as any)[ind.key] ?? (staff.baseMetrics as any)[ind.key] ?? 0));
        const weightedScore = (actualVal / 100) * ind.weight;
        totalWeightedScore += weightedScore;

        return {
          ...ind,
          actualPct: actualVal,
          weightedScore: weightedScore
        };
      });

      // Grade classification
      let grade = 'Perlu Penambahbaikan';
      let gradeColor = 'text-rose-600 bg-rose-500/10 border-rose-500/20';
      let gradeBadge = '🔴 PERLU PENAMBAHBAIKAN';

      if (totalWeightedScore >= 85) {
        grade = 'Cemerlang';
        gradeColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        gradeBadge = '🏆 CEMERLANG';
      } else if (totalWeightedScore >= 70) {
        grade = 'Baik';
        gradeColor = 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
        gradeBadge = '🥈 BAIK';
      } else if (totalWeightedScore >= 50) {
        grade = 'Memuaskan';
        gradeColor = 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
        gradeBadge = '🥉 MEMUASKAN';
      }

      return {
        ...staff,
        totalScore: totalWeightedScore,
        grade,
        gradeColor,
        gradeBadge,
        breakdown: indicatorBreakdown,
        notes
      };
    }).sort((a, b) => b.totalScore - a.totalScore); // Ranked highest first
  }, [staffList, customScores]);

  // Data formatted for Recharts Bar Chart - Overall Staff Comparison
  const overallChartData = useMemo(() => {
    return staffKpiCalculated.map(s => ({
      name: s.name,
      SkorKPI: parseFloat(s.totalScore.toFixed(1)),
      Sasaran: 100,
      color: s.chartColor
    }));
  }, [staffKpiCalculated]);

  // Data formatted for Indicator-by-Indicator Grouped Bar Chart (Dynamic per active staff)
  const indicatorChartData = useMemo(() => {
    return INDICATORS.map(ind => {
      const row: Record<string, any> = { indicator: ind.shortName };
      staffKpiCalculated.forEach(s => {
        const item = s.breakdown.find(b => b.key === ind.key);
        row[s.name] = item ? parseFloat(item.actualPct.toFixed(1)) : 0;
      });
      return row;
    });
  }, [staffKpiCalculated]);

  // Filtered by search query
  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staffKpiCalculated;
    const q = searchQuery.toLowerCase();
    return staffKpiCalculated.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.role.toLowerCase().includes(q) ||
      s.blocks.some(b => b.toLowerCase().includes(q))
    );
  }, [staffKpiCalculated, searchQuery]);

  const averageKpiScore = useMemo(() => {
    if (staffKpiCalculated.length === 0) return 0;
    const total = staffKpiCalculated.reduce((acc, s) => acc + s.totalScore, 0);
    return total / staffKpiCalculated.length;
  }, [staffKpiCalculated]);

  return (
    <div className="space-y-6">
      {/* Active Estate & Storage Isolation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PENGASINGAN LADANG AKTIF
              </span>
              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <Database size={10} /> Local Storage: fpm_staff_kpi_v2_{activeEstateId}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black uppercase text-white mt-0.5 flex items-center gap-1.5">
              <span>{activeEstate.name}</span>
              <span className="text-emerald-400 text-xs font-normal">({activeEstate.totalHectares || 0} HA)</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddStaffModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase flex items-center gap-1 transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Tambah Staf</span>
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Kembalikan konfigurasi staf rasmi ladang ini"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Set Semula</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/2 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Award size={12} /> MODUL PENILAIAN PRESTASI STAFF
              </span>
              <span className="bg-slate-800 text-slate-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md">
                {activeEstate.name}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight italic">
              KPI Mengikut Nama Staff
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
              Penilaian KPI 6 Indikator berwajaran (Hasil 30%, BTS Muda 15%, KPG=KPA 15%, EFB 15%, Membaja 15%, Merumput 10%) khusus bagi staf {activeEstate.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  viewMode === 'all' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua View
              </button>
              <button
                onClick={() => setViewMode('charts')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  viewMode === 'charts' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Carta Bar
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  viewMode === 'cards' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Kad Staff
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl transition-all"
              title="Cetak Laporan KPI Staff"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Weightage Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {INDICATORS.map((ind) => (
          <div 
            key={ind.key}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm hover:border-emerald-500/40 transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200">
                <ind.icon size={14} />
              </div>
              <span className="text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {ind.weight}%
              </span>
            </div>
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 line-clamp-1 uppercase">
              {ind.label.replace(/^\d+\.\s*/, '')}
            </h4>
            <p className="text-[9px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
              {ind.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Visual Comparative Bar Charts Section */}
      {(viewMode === 'all' || viewMode === 'charts') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Perbandingan Jumlah Skor KPI Staff */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  CARTA COMPARISON ({activeEstate.shortName || activeEstate.name})
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-1">
                  Jumlah Skor KPI Staff vs Sasaran 100%
                </h3>
              </div>
              <BarChart3 className="text-emerald-500" size={20} />
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: any) => [`${value}%`, 'Skor KPI']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="SkorKPI" name="Skor KPI (%)" radius={[8, 8, 0, 0]}>
                    {overallChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2 italic">
              *Skor sasaran minima cemerlang: 85% • Purata Keseluruhan Staff ({activeEstate.shortName}): {averageKpiScore.toFixed(1)}%
            </p>
          </div>

          {/* Chart 2: Perbandingan 6 Indikator Bagi Setiap Staff (DYNAMIC PER ESTATE) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                  ANALISIS METRIK ({activeEstate.shortName || activeEstate.name})
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-1">
                  Prestasi Mengikut 6 Indikator (%)
                </h3>
              </div>
              <Target className="text-blue-500" size={20} />
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicatorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="indicator" tick={{ fontSize: 9, fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [`${value}%`, name]}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  {staffKpiCalculated.map((s) => (
                    <Bar key={s.id} dataKey={s.name} name={s.name} fill={s.chartColor} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2 italic">
              *Pencapaian peratusan staf {activeEstate.name} mengikut 6 indikator berwajaran
            </p>
          </div>
        </div>
      )}

      {/* Search & Leaderboard Summary */}
      {(viewMode === 'all' || viewMode === 'cards') && (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Cari staf ${activeEstate.shortName} atau blok...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold w-full sm:w-auto justify-end flex-wrap">
              <span>Staf {activeEstate.shortName}: <strong className="text-slate-800 dark:text-white font-black">{staffList.length} Orang</strong></span>
              <span>•</span>
              <span>Purata KPI: <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                {averageKpiScore.toFixed(1)}%
              </strong></span>
            </div>
          </div>

          {/* Staff KPI Cards List */}
          <div className="space-y-4">
            {filteredStaff.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
                Tiada rekod staf ditemui untuk ladang {activeEstate.name}.
              </div>
            ) : (
              filteredStaff.map((staff, rankIndex) => {
                const isExpanded = expandedStaffId === staff.id;
                const isEditing = editingStaffId === staff.id;

                return (
                  <motion.div
                    key={staff.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Main Staff Header Bar */}
                    <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          {/* Rank Badge & Avatar */}
                          <div className="relative">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${staff.avatarColor} text-white font-black text-sm flex items-center justify-center shadow-lg shadow-slate-900/10`}>
                              {staff.name.substring(0, 2)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 text-amber-400 border border-slate-800 rounded-full flex items-center justify-center text-[9px] font-black">
                              #{rankIndex + 1}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {staff.name}
                              </h3>
                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border ${staff.gradeColor}`}>
                                {staff.gradeBadge}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                              {staff.role}
                            </p>

                            <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px] text-slate-600 dark:text-slate-400">
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">
                                Blok: {staff.blocks.join(', ')}
                              </span>
                              <span>•</span>
                              <span>Keluasan: <strong className="text-slate-800 dark:text-slate-200">{staff.totalLuas} Ha</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Score Summary & Action Buttons */}
                        <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              JUMLAH SKOR KPI
                            </p>
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {staff.totalScore.toFixed(1)}
                              </span>
                              <span className="text-sm font-bold text-slate-400">/ 100%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(staff)}
                              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                              title="Kemaskini Skor KPI & Nama Staff"
                            >
                              <Edit3 size={14} />
                              <span className="hidden sm:inline">Kemaskini</span>
                            </button>

                            <button
                              onClick={() => setExpandedStaffId(isExpanded ? null : staff.id)}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <span>Perincian</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Ringkasan % Pencapaian KPI Setiap Staff */}
                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                          <span>Pencapaian KPI Mengikut Indikator:</span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold hidden sm:inline">Tekan 'Perincian' untuk paparan penuh</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                          {staff.breakdown.map((ind) => (
                            <div 
                              key={ind.key} 
                              className="bg-white dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between shadow-xs"
                            >
                              <div className="flex items-center justify-between gap-1 text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                                <span className="truncate">{ind.shortName.split(' ')[0]}</span>
                                <span className="text-[8px] font-mono text-slate-400">{ind.weight}%</span>
                              </div>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                                  {ind.actualPct.toFixed(1)}%
                                </span>
                                <span className="text-[9px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                  +{ind.weightedScore.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Edit Modal / Inline Edit Drawer */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 sm:p-5 bg-amber-500/5 dark:bg-amber-500/10 border-t border-b border-amber-500/20"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Edit3 className="text-amber-500" size={16} />
                              <h4 className="text-xs font-black uppercase text-amber-900 dark:text-amber-300">
                                Kemaskini Staf & Skor KPI: {staff.name} ({activeEstate.name})
                              </h4>
                            </div>
                            <button
                              onClick={() => setEditingStaffId(null)}
                              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              Batal
                            </button>
                          </div>

                          {/* Profile Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                Nama Staff / Penyelia:
                              </label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg uppercase"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                Blok Kendalian (asingkan koma):
                              </label>
                              <input
                                type="text"
                                value={editForm.blocks}
                                onChange={(e) => setEditForm(prev => ({ ...prev, blocks: e.target.value }))}
                                placeholder="Contoh: 1, 2, 3, 4"
                                className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                                Jumlah Luas (Hektar):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={editForm.totalLuas}
                                onChange={(e) => setEditForm(prev => ({ ...prev, totalLuas: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                            </div>
                          </div>

                          {/* 6 Indicators Metrics Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {INDICATORS.map((ind) => (
                              <div key={ind.key} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 block mb-1">
                                  {ind.label} ({ind.weight}%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={editForm.metrics[ind.key] ?? (staff.baseMetrics as any)[ind.key]}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setEditForm(prev => ({
                                        ...prev,
                                        metrics: {
                                          ...prev.metrics,
                                          [ind.key]: val
                                        }
                                      }));
                                    }}
                                    className="w-full px-2 py-1 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                                  />
                                  <span className="text-xs font-bold text-slate-400">%</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mb-4">
                            <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 block mb-1">
                              Catatan Ulasan Pengurusan / Supervisor Remarks:
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan sebarang ulasan prestasi staf..."
                              value={editForm.notes}
                              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingStaffId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveEdit(staff.id)}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-md cursor-pointer disabled:opacity-50"
                            >
                              <Save size={14} /> {isSaving ? 'Menyimpan...' : 'Simpan Skor & Profil'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Detailed Indicator Breakdown */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 space-y-3"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {staff.breakdown.map((ind) => {
                              const maxWeight = ind.weight;
                              const scoreGained = ind.weightedScore;

                              return (
                                <div 
                                  key={ind.key}
                                  className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 relative overflow-hidden"
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <ind.icon size={13} className="text-emerald-500" />
                                      {ind.label}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-500">
                                      Wajaran {ind.weight}%
                                    </span>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${ind.actualPct}%` }}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                                      Pencapaian: <strong className="text-slate-800 dark:text-slate-200">{ind.actualPct.toFixed(1)}%</strong>
                                    </span>
                                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                      +{scoreGained.toFixed(2)} / {maxWeight}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Staff Notes if any */}
                          {staff.notes && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2 mt-2">
                              <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                              <div>
                                <strong>Catatan Prestasi Staff:</strong> {staff.notes}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Add New Staff Modal */}
      <AnimatePresence>
        {showAddStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                      Daftar Staf KPI Baru
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Ladang: {activeEstate.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddNewStaff} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Nama Staf / Supervisor:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: FS MOHD HAFIZ (SEKTOR 1)"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Jawatan / Tanggungjawab:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Penolong Penyelia / Supervisor"
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Blok Kendalian:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 1, 2, 3, 4"
                      value={newStaffForm.blocks}
                      onChange={(e) => setNewStaffForm(prev => ({ ...prev, blocks: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Keluasan (Ha):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newStaffForm.totalLuas}
                      onChange={(e) => setNewStaffForm(prev => ({ ...prev, totalLuas: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase shadow-md flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>Daftar Staf</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
