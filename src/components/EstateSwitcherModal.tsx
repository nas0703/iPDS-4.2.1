import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, CheckCircle2, ChevronRight, MapPin, ShieldCheck, X, TreePine, Award, Clock, UploadCloud } from 'lucide-react';
import { 
  getAllEstatesList, 
  getEstateConfig, 
  canSwitchEstates, 
  getAccessibleEstatesForUser, 
  EstateConfig,
  isEstateInStandby
} from '../config/estateRegistry';
import { getActiveEstateId, setRuntimeEstateId } from '../utils/estateContext';
import { isSuperAdmin } from '../features/auth/services/rbacService';

interface EstateSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  authRole: string | null;
  onSelectEstate?: (estate: EstateConfig) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenMasterDataset?: (estateId: string) => void;
}

export const EstateSwitcherModal: React.FC<EstateSwitcherModalProps> = ({
  isOpen,
  onClose,
  authRole,
  onSelectEstate,
  showToast,
  onOpenMasterDataset
}) => {
  const activeEstateId = getActiveEstateId();
  const superAdmin = isSuperAdmin(authRole);
  const isAuthorizedToSwitch = canSwitchEstates(authRole, superAdmin);
  const accessibleEstates = getAccessibleEstatesForUser(authRole, activeEstateId, superAdmin);

  const handleSelect = (estate: EstateConfig) => {
    if (!isAuthorizedToSwitch && estate.id !== activeEstateId) {
      if (showToast) {
        showToast(`Akses dihadkan: Anda hanya dibenarkan melihat ladang ${getEstateConfig(activeEstateId).name}`, 'info');
      }
      return;
    }

    setRuntimeEstateId(estate.id);
    if (onSelectEstate) {
      onSelectEstate(estate);
    }
    if (showToast) {
      showToast(`Ladang ditukar kepada: ${estate.name}`, 'success');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-gradient-to-b from-[#082225] via-[#051719] to-[#020b0d] border border-emerald-500/40 rounded-3xl w-full max-w-xl shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(16,185,129,0.3)] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-emerald-500/20 flex items-center justify-between bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  Pusat Kawalan Ladang FPM
                </h3>
                <p className="text-xs text-emerald-400/90 font-medium">
                  FPM Wilayah Johor Bahru • Zon Adela
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Scope Notice */}
          <div className="px-5 py-3 bg-emerald-900/20 border-b border-emerald-500/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Peranan: <strong className="text-emerald-300 uppercase">{authRole || 'STAFF'}</strong>
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
              {isAuthorizedToSwitch ? 'Multi-Estate Permitted' : 'Single-Estate Scoped'}
            </span>
          </div>

          {/* Estate List Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Senarai Ladang di bawah Zon Adela (4 Ladang)
            </div>

            {accessibleEstates.map((estate) => {
              const isActive = estate.id === activeEstateId;
              const inStandby = isEstateInStandby(estate.id);
              const blockCount = Object.keys(estate.blocks).length;

              return (
                <motion.div
                  key={estate.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelect(estate)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : inStandby
                      ? 'bg-slate-900/70 hover:bg-slate-800/70 border-amber-500/30 hover:border-amber-500/60'
                      : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950 font-black border-emerald-300 shadow-md'
                            : inStandby
                            ? 'bg-amber-950/40 text-amber-400 font-bold border-amber-500/40'
                            : 'bg-slate-800 text-emerald-400 font-bold border-slate-700'
                        }`}
                      >
                        {estate.code}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                            {estate.name}
                          </h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                              Aktif
                            </span>
                          )}
                          {inStandby ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                              Standby
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider">
                              Data Disahkan
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                          {inStandby ? (
                            <span className="text-amber-300/90 font-medium">
                              Sedia menerima data set asas (Keluasan Blok & Peneroka)
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <TreePine className="w-3.5 h-3.5 text-emerald-400" />
                                {blockCount} Blok ({estate.totalHectares.toFixed(1)} Ha)
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                {estate.millName}
                              </span>
                              {estate.annualTargetPkt1 > 0 && (
                                <span className="flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5 text-amber-400" />
                                  Sasaran PKT1: {estate.annualTargetPkt1} t/ha
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {inStandby && onOpenMasterDataset && (
                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                onOpenMasterDataset(estate.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <UploadCloud className="w-3 h-3 text-amber-400" />
                              <span>Sediakan / Masukkan Data Asas</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 pt-1">
                      {isActive ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-emerald-500/20 bg-black/40 flex items-center justify-between text-xs text-slate-400">
            <span>Struktur: Wilayah JB → Zon Adela</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

