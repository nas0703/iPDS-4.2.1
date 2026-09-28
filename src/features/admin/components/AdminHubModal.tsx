import React from 'react';
import { 
  ShieldCheck, Building2, ShieldAlert, KeyRound, ChevronRight, 
  ExternalLink, CheckCircle2, AlertTriangle, Users, MapPin, X, ArrowRight
} from 'lucide-react';
import { getActiveEstateConfig } from '../../../utils/estateContext';
import { isSuperAdmin } from '../../auth/services/rbacService';

interface AdminHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  pendingDevicesCount: number;
  onOpenEstateControl: () => void;
  onOpenSecurityDashboard: () => void;
  onOpenRbacManager: () => void;
}

export const AdminHubModal: React.FC<AdminHubModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  pendingDevicesCount,
  onOpenEstateControl,
  onOpenSecurityDashboard,
  onOpenRbacManager
}) => {
  if (!isOpen) return null;

  // Defense-in-depth: the Administration hub is only reachable by the canonical
  // Super Admin / FC Tunggal identity. The server remains the security control.
  if (!isSuperAdmin()) return null;

  const activeEstate = getActiveEstateConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
        isDarkMode 
          ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-[0_0_50px_rgba(16,185,129,0.15)]' 
          : 'bg-white border-emerald-300 text-slate-900 shadow-[0_10px_40px_rgba(0,0,0,0.12)]'
      }`}>
        
        {/* Top Accent Gradient & Close Button */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors z-10 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800/80 flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                PENTADBIR UTAMA
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                FC TUNGGAL / SUPER ADMIN
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide mt-1 text-slate-900 dark:text-white">
              Modul Pentadbir (Admin Hub)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Pusat kawalan tertinggi operasi ladang, keselamatan peranti staf, dan autoriti akses RBAC.
            </p>
          </div>
        </div>

        {/* Executive Summary Bar */}
        <div className="px-5 sm:px-6 py-3 bg-emerald-500/5 dark:bg-emerald-950/30 border-b border-emerald-500/20 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/60 border border-emerald-500/20">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Ladang Aktif</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
              {activeEstate.shortName || activeEstate.name}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/60 border border-emerald-500/20">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Kelulusan Peranti</span>
            <span className={`text-xs font-black block mt-0.5 ${pendingDevicesCount > 0 ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
              {pendingDevicesCount > 0 ? `${pendingDevicesCount} Menunggu` : 'Semua Bersih (0)'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/60 border border-emerald-500/20">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Autoriti RBAC</span>
            <span className="text-xs font-black text-teal-600 dark:text-teal-400 block mt-0.5">
              Super Admin Aktif
            </span>
          </div>
        </div>

        {/* 3 Submodules List */}
        <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
            Senarai Submodul Pentadbir (3 Submodul)
          </p>

          {/* SUBMODULE 1: Pusat Kawalan Ladang */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEstateControl();
            }}
            className={`w-full text-left p-4 rounded-2xl border transition-all group flex items-center justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              isDarkMode
                ? 'bg-slate-950/70 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/30'
                : 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400 hover:bg-emerald-100/80 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-all">
                <Building2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    SUBMODUL 1
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    ZON ADELA
                  </span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-wide mt-1 text-slate-900 dark:text-emerald-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-200">
                  Pusat Kawalan Ladang
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Tukar ladang aktif (Tunggal, Adela, Kledang, Sening, Wilayah JB), semak keluasan & sasaran bulanan.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  <MapPin size={12} />
                  <span>Ladang Semasa: <strong>{activeEstate.name}</strong></span>
                </div>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
              <ChevronRight size={18} />
            </div>
          </button>

          {/* SUBMODULE 2: Dashboard Keselamatan & Peranti */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSecurityDashboard();
            }}
            className={`w-full text-left p-4 rounded-2xl border transition-all group flex items-center justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              pendingDevicesCount > 0
                ? 'bg-amber-950/40 border-amber-500/60 hover:border-amber-400 shadow-md'
                : isDarkMode
                ? 'bg-slate-950/70 border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/30'
                : 'bg-rose-50/70 border-rose-300 hover:border-rose-400 hover:bg-rose-100/80 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                pendingDevicesCount > 0
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 animate-pulse'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30 group-hover:bg-rose-500/30'
              }`}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    SUBMODUL 2
                  </span>
                  {pendingDevicesCount > 0 ? (
                    <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                      {pendingDevicesCount} KELULUSAN MENUNGGU
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      STATUS KESELAMATAN STABIL
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black uppercase tracking-wide mt-1 text-slate-900 dark:text-rose-300 group-hover:text-rose-500 dark:group-hover:text-rose-200">
                  Dashboard Keselamatan & Peranti
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Audit peranti aktif, luluskan peranti staf baru, sekatan sesi mencurigakan, dan nombor WhatsApp FC.
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
              <ChevronRight size={18} />
            </div>
          </button>

          {/* SUBMODULE 3: Tukar PIN & Kawalan Akses (RBAC) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRbacManager();
            }}
            className={`w-full text-left p-4 rounded-2xl border transition-all group flex items-center justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              isDarkMode
                ? 'bg-slate-950/70 border-teal-500/30 hover:border-teal-400 hover:bg-teal-950/30'
                : 'bg-teal-50/70 border-teal-300 hover:border-teal-400 hover:bg-teal-100/80 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 group-hover:bg-teal-500/30 transition-all">
                <KeyRound size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                    SUBMODUL 3
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    PENGURUSAN RBAC
                  </span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-wide mt-1 text-slate-900 dark:text-teal-300 group-hover:text-teal-500 dark:group-hover:text-teal-200">
                  Tukar PIN & Kawalan Akses (RBAC)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Urus kata laluan PIN pentadbir, tetapkan had peranan operasi (FC, Penyelia, Kerani, Mandur).
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2">
              <ChevronRight size={18} />
            </div>
          </button>
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 bg-slate-950/60 border-t border-slate-800 text-center text-[11px] text-slate-400 flex items-center justify-between px-6">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Hak Pentadbir Penuh: <strong>FC Tunggal (Super Admin)</strong></span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-400 hover:underline font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
