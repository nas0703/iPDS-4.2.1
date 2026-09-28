import React, { useState, useEffect, useMemo } from 'react';
import { 
  EmployeeMaster, 
  OrgPosition, 
  EmploymentStatus 
} from '../types/employeeMaster';
import { employeeMasterService, DEFAULT_POSITIONS } from '../services/employeeMasterService';
import { AssignmentHistoryModal } from './modals/AssignmentHistoryModal';
import { TransferAssignmentModal } from './modals/TransferAssignmentModal';
import { CreateEmployeeModal } from './modals/CreateEmployeeModal';
import { DeactivateEmployeeModal } from './modals/DeactivateEmployeeModal';
import { ESTATES_REGISTRY, EstateConfig, getActiveEstateId, normalizeEstateId, getEstateConfig, ESTATE_CHANGED_EVENT } from '../../../config/estateRegistry';
import { isSuperAdmin, getCurrentUserEstate } from '../../auth/services/rbacService';
import { 
  Users, 
  UserCheck, 
  ShieldCheck, 
  MapPin, 
  Search, 
  Filter, 
  Plus, 
  History, 
  ArrowRightLeft, 
  UserMinus, 
  Building2, 
  Layers, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Lock,
  Crown,
  ShieldAlert,
  Table,
  LayoutGrid
} from 'lucide-react';

interface EmployeeMasterViewProps {
  authRole?: string | null;
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const EmployeeMasterView: React.FC<EmployeeMasterViewProps> = ({
  authRole,
  isDarkMode,
  onShowToast
}) => {
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [positions, setPositions] = useState<OrgPosition[]>(DEFAULT_POSITIONS);
  const [loading, setLoading] = useState<boolean>(true);

  // Determine user privilege & assigned estate
  const userIsSuperAdmin = useMemo(() => isSuperAdmin(authRole), [authRole]);
  const userHomeEstate = useMemo(() => getCurrentUserEstate(authRole), [authRole]);

  // Track active estate in application
  const [activeEstate, setActiveEstate] = useState<string>(() => {
    return normalizeEstateId(getActiveEstateId()) || userHomeEstate;
  });

  // Isolation constraint: Non-superadmin is strictly locked to their home estate
  const effectiveEstate = userIsSuperAdmin ? null : (userHomeEstate || activeEstate);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterEstate, setFilterEstate] = useState<string>(() => {
    return userIsSuperAdmin ? 'ALL' : (effectiveEstate || 'FPM_TUNGGAL');
  });
  const [filterPosition, setFilterPosition] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals state
  const [selectedForHistory, setSelectedForHistory] = useState<EmployeeMaster | null>(null);
  const [selectedForTransfer, setSelectedForTransfer] = useState<EmployeeMaster | null>(null);
  const [selectedForDeactivate, setSelectedForDeactivate] = useState<EmployeeMaster | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [syncing, setSyncing] = useState<boolean>(false);

  // Listen to runtime estate changes
  useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newEst = normalizeEstateId(e.detail?.estateId || getActiveEstateId());
      setActiveEstate(newEst);
      if (!userIsSuperAdmin) {
        setFilterEstate(newEst);
      }
    };
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, [userIsSuperAdmin]);

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setSyncing(true);
      else setLoading(true);

      let uploadCount = 0;
      if (isManual) {
        const syncRes = await employeeMasterService.syncLocalStorageToCloud();
        uploadCount = syncRes.uploadedCount;
      }

      const [empList, posList] = await Promise.all([
        employeeMasterService.getEmployees(),
        employeeMasterService.getPositions()
      ]);
      setEmployees(empList);
      setPositions(posList);
      if (isManual) {
        if (uploadCount > 0) {
          onShowToast('success', `Penyegerakan selesai: ${uploadCount} rekod kakitangan daripada storan tempatan telah berjaya dimuat naik ke Supabase!`);
        } else {
          onShowToast('success', 'Pangkalan data staf telah disegerakkan sepenuhnya dengan Supabase.');
        }
      }
    } catch (err: any) {
      onShowToast('error', 'Gagal memuat data master kakitangan: ' + err.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleEmployeesUpdate = () => {
      loadData(false);
    };
    window.addEventListener('ipds_employees_updated', handleEmployeesUpdate);
    return () => window.removeEventListener('ipds_employees_updated', handleEmployeesUpdate);
  }, []);

  // Filtered employees with STRICT DATA ISOLATION
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const empEstate = normalizeEstateId(emp.current_assignment?.estate_id || 'FPM_TUNGGAL');

      // 1. STRICT ISOLATION RULE:
      // "ladang lain tak boleh melihat staff ladang tunggal begitu sebaliknya kecuali super admin"
      if (!userIsSuperAdmin) {
        const allowedEstate = effectiveEstate || userHomeEstate;
        if (empEstate !== allowedEstate) return false;
      } else {
        // Super Admin can choose to filter or view all
        if (filterEstate !== 'ALL' && empEstate !== filterEstate) {
          return false;
        }
      }

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = emp.full_name.toLowerCase().includes(query);
        const matchesNo = emp.staff_no.toLowerCase().includes(query);
        const matchesEmail = emp.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesNo && !matchesEmail) return false;
      }

      // Position filter
      if (filterPosition !== 'ALL') {
        if (emp.position_id !== filterPosition && emp.position?.code !== filterPosition) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'ALL') {
        if (emp.employment_status !== filterStatus) return false;
      }

      return true;
    });
  }, [employees, searchTerm, filterEstate, filterPosition, filterStatus, userIsSuperAdmin, effectiveEstate, userHomeEstate]);

  // Quick stats computed on the visible scope
  const stats = useMemo(() => {
    const scopedEmployees = employees.filter(e => {
      const empEstate = normalizeEstateId(e.current_assignment?.estate_id || 'FPM_TUNGGAL');
      if (!userIsSuperAdmin) {
        return empEstate === (effectiveEstate || userHomeEstate);
      }
      if (filterEstate !== 'ALL') {
        return empEstate === filterEstate;
      }
      return true;
    });

    const activeTotal = scopedEmployees.filter(e => e.employment_status === 'ACTIVE').length;
    const managementCount = scopedEmployees.filter(e => 
      ['MANAGEMENT', 'SUPERVISORY'].includes(e.position?.category || '') && e.employment_status === 'ACTIVE'
    ).length;
    const mandorCount = scopedEmployees.filter(e => 
      e.position?.code === 'MDR' && e.employment_status === 'ACTIVE'
    ).length;
    
    // Count distinct blocks supervised
    const activeBlocks = new Set<string>();
    scopedEmployees.forEach(e => {
      if (e.employment_status === 'ACTIVE' && e.current_assignment?.blocks) {
        e.current_assignment.blocks.forEach(b => activeBlocks.add(`${e.current_assignment?.estate_id}-${b.block_code}`));
      }
    });

    return {
      activeTotal,
      managementCount,
      mandorCount,
      blocksCount: activeBlocks.size
    };
  }, [employees, userIsSuperAdmin, effectiveEstate, userHomeEstate, filterEstate]);

  return (
    <div className="space-y-4">
      {/* Role & Estate Isolation Status Banner */}
      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs ${
        userIsSuperAdmin
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300'
      }`}>
        <div className="flex items-center gap-2">
          {userIsSuperAdmin ? (
            <Crown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div>
            <span className="font-black">
              {userIsSuperAdmin ? 'Mod Super Admin (FC Tunggal): ' : 'Dasar Pengasingan Data Ladang: '}
            </span>
            <span className="font-medium">
              {userIsSuperAdmin
                ? 'Akses global penuh merentasi semua ladang (Tunggal, Adela, Kledang, Sening & Wilayah JB).'
                : `Paparan kakitangan dikhususkan bagi ${getEstateConfig(effectiveEstate || userHomeEstate).name} sahaja. Kakitangan ladang lain dilindungi.`}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/60 dark:bg-black/30 border-current/20 uppercase tracking-wider">
          {userIsSuperAdmin ? 'Global Access' : `Estate Scope: ${getEstateConfig(effectiveEstate || userHomeEstate).code}`}
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          isDarkMode ? 'bg-slate-800/60 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Staf Aktif
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {stats.activeTotal}
              </span>
              <span className="text-[10px] font-bold text-slate-400">Orang</span>
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          isDarkMode ? 'bg-slate-800/60 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Pengurusan &amp; Eksekutif
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {stats.managementCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400">Pegawai</span>
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          isDarkMode ? 'bg-slate-800/60 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Mandur Lapangan
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {stats.mandorCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400">Penyelia</span>
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
          isDarkMode ? 'bg-slate-800/60 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <MapPin size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Liputan Blok Diselia
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {stats.blocksCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400">Blok Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Action Button */}
      <div className={`p-3.5 rounded-xl border space-y-3 ${
        isDarkMode ? 'bg-slate-800/40 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari mengikut Nama, No. Staf, atau Emel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* View Mode Switcher (Table vs Card view) */}
            <div className="flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setViewMode('table')}
                title="Paparan Jadual Penuh"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <Table size={15} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                title="Paparan Kad (Mesra Skrin Kecil & Telefon)"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            {/* Sync Button */}
            <button
              onClick={() => loadData(true)}
              title="Segerakkan dengan Pangkalan Data Pusat Supabase"
              disabled={syncing || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-bold active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing || loading ? 'animate-spin text-emerald-500' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Menyegerak...' : 'Segerak Data'}</span>
            </button>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition active:scale-95"
            >
              <Plus size={14} />
              <span>Daftar Staf Baharu</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Filter size={11} />
            Penapis:
          </span>

          {/* Estate Filter */}
          {!userIsSuperAdmin ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
              <Lock size={12} className="text-amber-600 dark:text-amber-400" />
              <span>{getEstateConfig(effectiveEstate || userHomeEstate).name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                Akses Terhad Ladang
              </span>
            </div>
          ) : (
            <div className="relative inline-flex items-center">
              <select
                value={filterEstate}
                onChange={(e) => setFilterEstate(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs font-semibold rounded-lg border border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Ladang (Super Admin)</option>
                {(Object.values(ESTATES_REGISTRY) as EstateConfig[]).map(est => (
                  <option key={est.id} value={est.id}>{est.name}</option>
                ))}
              </select>
              <Crown size={12} className="absolute left-2 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
            </div>
          )}

          {/* Position Filter */}
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Semua Jawatan</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>[{p.code}] {p.title.split('(')[0].trim()}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (ACTIVE)</option>
            <option value="PROBATION">Percubaan (PROBATION)</option>
            <option value="INACTIVE">Tidak Aktif (INACTIVE)</option>
            <option value="RETIRED">Bersara (RETIRED)</option>
            <option value="TERMINATED">Ditamatkan (TERMINATED)</option>
          </select>

          {(searchTerm || filterEstate !== 'ALL' || filterPosition !== 'ALL' || filterStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterEstate('ALL');
                setFilterPosition('ALL');
                setFilterStatus('ALL');
              }}
              className="text-[10px] font-bold text-rose-500 hover:underline uppercase ml-auto"
            >
              Set Semula Penapis
            </button>
          )}
        </div>
      </div>

      {/* Content View: Table or Cards */}
      {viewMode === 'table' ? (
        <div className={`rounded-xl border overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200/80 shadow-sm'
        }`}>
          {/* Scroll Hint Banner */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>Lajur Nama &amp; No. Staf <strong>dikunci (pinned)</strong> di sebelah kiri — tatal ke kanan untuk butiran ladang, blok, dan tindakan.</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Jumlah: {filteredEmployees.length} rekod
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'bg-slate-800/90 border-white/5 text-slate-400' : 'bg-slate-100/90 border-slate-200 text-slate-600'
                }`}>
                  {/* Pinned Left Header */}
                  <th className={`py-3 px-4 sticky left-0 z-20 min-w-[220px] sm:min-w-[260px] ${
                    isDarkMode ? 'bg-slate-800 border-r border-white/10 text-slate-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]' : 'bg-slate-100 border-r border-slate-200 text-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span>Staf / Kakitangan</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                        PINNED
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Jawatan &amp; Jabatan</th>
                  <th className="py-3 px-4">Penugasan Semasa (Ladang &amp; Blok)</th>
                  <th className="py-3 px-4">Tarikh Khidmat</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan Pengurusan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Clock className="animate-spin inline mr-2" size={16} />
                      <span>Memuatkan rekod master staf dari pangkalan data...</span>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tiada rekod kakitangan menepati kriteria carian.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isActive = emp.employment_status === 'ACTIVE';
                    const asg = emp.current_assignment;
                    return (
                      <tr 
                        key={emp.id}
                        className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                          !isActive ? 'opacity-65' : ''
                        }`}
                      >
                        {/* 1. Staf Info - PINNED STICKY LEFT */}
                        <td className={`py-3 px-4 sticky left-0 z-10 min-w-[220px] sm:min-w-[260px] ${
                          isDarkMode 
                            ? 'bg-slate-900 group-hover:bg-slate-800/95 border-r border-white/10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]' 
                            : 'bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shrink-0">
                              {emp.staff_no}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-snug">
                                {emp.full_name}
                              </div>
                              <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                {emp.email && <span>{emp.email}</span>}
                                {emp.contact_number && <span>• {emp.contact_number}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Position */}
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {emp.position?.title.split('(')[0].trim() || 'Staf Ladang'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              Jabatan: {emp.position?.department || 'Operasi'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Assignment */}
                        <td className="py-3 px-4">
                          {asg ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                                <Building2 size={12} className="text-slate-400 shrink-0" />
                                <span>{asg.estate_name || asg.estate_id}</span>
                                <span className="text-slate-400 font-normal">•</span>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {asg.division_name ? asg.division_name.split('(')[0].trim() : 'Peringkat 1'}
                                </span>
                              </div>

                              {/* Assigned Blocks pills */}
                              <div className="flex flex-wrap gap-1 items-center">
                                {asg.blocks && asg.blocks.length > 0 ? (
                                  asg.blocks.map(b => (
                                    <span 
                                      key={b.id || b.block_code}
                                      className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5"
                                    >
                                      {b.block_code}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Seluruh kawasan peringkat / Am
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-500 font-semibold italic">
                              Belum Ditetapkan Penugasan
                            </span>
                          )}
                        </td>

                        {/* 4. Hire Date */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {emp.hire_date}
                        </td>

                        {/* 5. Status Badge */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            emp.employment_status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : emp.employment_status === 'PROBATION'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                              : emp.employment_status === 'RETIRED'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              emp.employment_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                            {emp.employment_status}
                          </span>
                        </td>

                        {/* 6. Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Sejarah Penugasan */}
                            <button
                              onClick={() => setSelectedForHistory(emp)}
                              title="Lihat Sejarah Penugasan & Pertukaran"
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition active:scale-95"
                            >
                              <History size={14} />
                            </button>

                            {/* Tukar Penugasan */}
                            <button
                              onClick={() => setSelectedForTransfer(emp)}
                              title="Tukar Penugasan / Peringkat / Blok"
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-900 transition active:scale-95"
                            >
                              <ArrowRightLeft size={14} />
                            </button>

                            {/* Penyahaktifan */}
                            {isActive && (
                              <button
                                onClick={() => setSelectedForDeactivate(emp)}
                                title="Tamatkan / Nyahaktifkan Staf"
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition active:scale-95"
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Clock className="animate-spin inline mr-2" size={16} />
              <span>Memuatkan rekod master staf...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              Tiada rekod kakitangan menepati kriteria carian.
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const isActive = emp.employment_status === 'ACTIVE';
              const asg = emp.current_assignment;
              return (
                <div
                  key={emp.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition ${
                    isDarkMode ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200 shadow-sm'
                  } ${!isActive ? 'opacity-65' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                        {emp.staff_no}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        emp.employment_status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {emp.employment_status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {emp.full_name}
                      </h4>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {emp.position?.title.split('(')[0].trim() || 'Staf Ladang'}
                        <span className="text-slate-400 font-normal"> • {emp.position?.department || 'Operasi'}</span>
                      </p>
                      {(emp.email || emp.contact_number) && (
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                          {emp.email && <span>{emp.email}</span>}
                          {emp.contact_number && <span>• {emp.contact_number}</span>}
                        </div>
                      )}
                    </div>

                    {/* Penugasan */}
                    <div className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                      isDarkMode ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-200/80'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                        <Building2 size={13} className="text-slate-400 shrink-0" />
                        <span>{asg?.estate_name || asg?.estate_id || 'Belum Ditugaskan'}</span>
                        {asg?.division_name && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {asg.division_name.split('(')[0].trim()}
                            </span>
                          </>
                        )}
                      </div>
                      {asg?.blocks && asg.blocks.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center pt-0.5">
                          {asg.blocks.map(b => (
                            <span 
                              key={b.id || b.block_code}
                              className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                            >
                              {b.block_code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Khidmat: {emp.hire_date}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedForHistory(emp)}
                        title="Sejarah Penugasan"
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => setSelectedForTransfer(emp)}
                        title="Tukar Penugasan"
                        className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                      >
                        <ArrowRightLeft size={14} />
                      </button>
                      {isActive && (
                        <button
                          onClick={() => setSelectedForDeactivate(emp)}
                          title="Tamatkan Staf"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODALS */}
      {selectedForHistory && (
        <AssignmentHistoryModal
          employee={selectedForHistory}
          isOpen={!!selectedForHistory}
          onClose={() => setSelectedForHistory(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {selectedForTransfer && (
        <TransferAssignmentModal
          employee={selectedForTransfer}
          isOpen={!!selectedForTransfer}
          onClose={() => setSelectedForTransfer(null)}
          onSuccess={(updated) => {
            setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
          }}
          isDarkMode={isDarkMode}
          onShowToast={onShowToast}
          isUserSuperAdmin={userIsSuperAdmin}
        />
      )}

      {selectedForDeactivate && (
        <DeactivateEmployeeModal
          employee={selectedForDeactivate}
          isOpen={!!selectedForDeactivate}
          onClose={() => setSelectedForDeactivate(null)}
          onSuccess={() => {
            loadData();
          }}
          isDarkMode={isDarkMode}
          onShowToast={onShowToast}
        />
      )}

      {showCreateModal && (
        <CreateEmployeeModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newEmp) => {
            setEmployees(prev => [newEmp, ...prev]);
          }}
          isDarkMode={isDarkMode}
          positions={positions}
          onShowToast={onShowToast}
          isUserSuperAdmin={userIsSuperAdmin}
          defaultEstateId={effectiveEstate || userHomeEstate}
        />
      )}
    </div>
  );
};
