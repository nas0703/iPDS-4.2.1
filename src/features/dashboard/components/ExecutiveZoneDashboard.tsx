import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  TreePine, 
  MapPin, 
  Award, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  TrendingUp, 
  Layers, 
  ShieldCheck, 
  FileText, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { 
  getAllEstatesList, 
  getEstateConfig, 
  canSwitchEstates,
  EstateConfig,
  ZONES 
} from '../../../config/estateRegistry';
import { getActiveEstateId, setRuntimeEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { isSuperAdmin } from '../../auth/services/rbacService';

interface ExecutiveZoneDashboardProps {
  authRole: string | null;
  isDarkMode?: boolean;
  onOpenMorningBriefing?: () => void;
  onOpenRCReportModal?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExecutiveZoneDashboard: React.FC<ExecutiveZoneDashboardProps> = ({
  authRole,
  isDarkMode = true,
  onOpenMorningBriefing,
  onOpenRCReportModal,
  showToast
}) => {
  const [activeEstateId, setActiveEstateId] = useState<string>(() => getActiveEstateId());
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(true);
  const allEstates = getAllEstatesList();
  const primaryEstate = allEstates.find((e) => e.id === 'WILAYAH_JB') || allEstates[0];
  const otherEstates = allEstates.filter((e) => e.id !== primaryEstate.id);
  const activeEstate = getEstateConfig(activeEstateId);
  const isAuthorizedToSwitch = canSwitchEstates(authRole, isSuperAdmin(authRole));

  const zoneList = [
    { id: 'ALL', name: 'Semua Zon', count: allEstates.length },
    ...Object.values(ZONES).map((z) => ({
      id: z.id,
      name: z.name,
      count: allEstates.filter((e) => e.zoneId === z.id).length,
    })),
  ];

  const displayedEstates = selectedZone === 'ALL'
    ? allEstates
    : allEstates.filter((e) => e.zoneId === selectedZone);

  useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstateId(newId);
    };
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  const totalZoneHectares = allEstates.reduce((sum, e) => sum + e.totalHectares, 0);
  const totalZoneBlocks = allEstates.reduce((sum, e) => sum + Object.keys(e.blocks).length, 0);

  const isRC = authRole === 'rc';
  const isOC = authRole === 'oc';

  const handleSwitchEstate = (estate: EstateConfig) => {
    if (estate.id === activeEstateId) return;

    setRuntimeEstateId(estate.id);
    setActiveEstateId(estate.id);
    if (showToast) {
      showToast(`Paparan ditukar ke: ${estate.name}`, 'success');
    }
  };

  return (
    <div className="w-full mb-4 space-y-3">
      {/* Executive Command Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#03201d] via-[#021817] to-[#010f10] border border-emerald-500/40 p-3.5 sm:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
      >
        {/* Subtle decorative glow */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase tracking-widest">
                  {isRC ? 'Regional Controller (RC)' : isOC ? 'Operation Controller (OC)' : 'Eksekutif Zon'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isRC ? 'FPM Wilayah Johor Bahru' : 'FPM Zon Adela (4 Ladang)'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-0.5 flex items-center gap-1.5">
                Pusat Pemantauan Portfolio Ladang
              </h2>
            </div>
          </div>

          {/* Quick Executive Actions */}
          <div className="flex items-center gap-2 self-end md:self-center">
            {onOpenMorningBriefing && (
              <button
                type="button"
                onClick={onOpenMorningBriefing}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">AI Briefing</span> Eksekutif
              </button>
            )}
            {onOpenRCReportModal && (
              <button
                type="button"
                onClick={onOpenRCReportModal}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                Laporan RC / OC
              </button>
            )}
          </div>
        </div>

        {/* Zone Overview Metric Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-emerald-500/20">
          <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-emerald-500/15">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Jumlah Ladang
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-white">4</span>
              <span className="text-[10px] text-emerald-400 font-bold">Ladang Zon</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-emerald-500/15">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Keluasan Keseluruhan
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-emerald-300">
                {totalZoneHectares.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Ha</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-emerald-500/15">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Bilangan Blok Zon
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-black text-white">
                {totalZoneBlocks}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Blok Hasil</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-emerald-500/15">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Kilang Pemprosesan
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xs sm:text-sm font-black text-amber-300 truncate">
                KS Adela
              </span>
              <span className="text-[9px] text-slate-400">Pusat</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Inter-Estate Portfolio Selection Section */}
      <div className="space-y-2">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <h3 className="text-[10px] sm:text-[11px] font-black text-slate-300 uppercase tracking-wider truncate">
              Prestasi & Pilihan Ladang {selectedZone !== 'ALL' ? `• ${ZONES[selectedZone]?.name || selectedZone}` : ''}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-[8.5px] font-bold text-emerald-400/80">
              Tekan kad untuk tukar paparan
            </span>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-bold bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-400/50 transition-all cursor-pointer shadow-sm shrink-0"
              title={isDropdownOpen ? 'Sembunyikan senarai ladang' : 'Papar senarai semua ladang'}
            >
              <span>{isDropdownOpen ? 'Sembunyi Senarai' : `Papar Ladang (${displayedEstates.length})`}</span>
              <ChevronDown
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-emerald-400' : 'text-slate-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Butang Pilihan Mengikut Zon (Selection Buttons by Zon) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-0.5 no-scrollbar">
          {zoneList.map((z) => {
            const isSelected = selectedZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => {
                  setSelectedZone(z.id);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20 ring-1 ring-emerald-300/60'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{z.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[8.5px] font-black leading-none ${
                    isSelected
                      ? 'bg-slate-950/30 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {z.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Jika Senarai Ditutup: Papar Kad Utama FPM WILAYAH JOHOR BAHRU */}
        {!isDropdownOpen && (
          <div className="w-full">
            {(() => {
              const isActive = primaryEstate.id === activeEstateId;
              const blockCount = Object.keys(primaryEstate.blocks || {}).length;

              return (
                <motion.div
                  key={primaryEstate.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSwitchEstate(primaryEstate)}
                  className={`px-3 py-2 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-950/80 via-emerald-900/60 to-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.22)]'
                      : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500" />
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0 border ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                            : 'bg-slate-800 text-emerald-400 border-slate-700'
                        }`}
                      >
                        {primaryEstate.code}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[11.5px] sm:text-xs font-black text-white uppercase truncate leading-tight">
                          {primaryEstate.name}
                        </h4>
                        <p className="text-[8.5px] sm:text-[9px] text-slate-400 font-medium truncate leading-tight mt-0.5">
                          {primaryEstate.millName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8.5px] font-black uppercase tracking-wider shadow-sm">
                          Aktif
                        </span>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 flex items-center justify-center">
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[9px] sm:text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400">
                      <TreePine className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                      <span>{blockCount} Blok</span>
                    </div>
                    <div className="font-bold text-slate-300">
                      {primaryEstate.totalHectares.toFixed(1)} <span className="text-[7.5px] sm:text-[8px] text-slate-500">Ha</span>
                    </div>
                    <div className="flex items-center gap-0.5 font-bold text-amber-400 text-[8.5px] sm:text-[9px]">
                      <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span>{primaryEstate.annualTargetPkt1} t/ha</span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </div>
        )}

        {/* Jika Senarai Dibuka: Papar Semua Ladang dalam Zon Terpilih */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden space-y-1.5"
            >
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {selectedZone === 'ALL' ? 'Semua Ladang' : ZONES[selectedZone]?.name || selectedZone} ({displayedEstates.length} Ladang)
                </span>
                <span className="text-[8px] sm:text-[8.5px] text-emerald-400/80">
                  Tekan kad untuk tukar paparan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {displayedEstates.map((estate) => {
                  const isActive = estate.id === activeEstateId;
                  const blockCount = Object.keys(estate.blocks || {}).length;

                  return (
                    <motion.div
                      key={estate.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSwitchEstate(estate)}
                      className={`px-3 py-2 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                        isActive
                          ? 'bg-gradient-to-br from-emerald-950/80 via-emerald-900/60 to-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.22)]'
                          : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/40'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500" />
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0 border ${
                              isActive
                                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                                : 'bg-slate-800 text-emerald-400 border-slate-700'
                            }`}
                          >
                            {estate.code}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-[11px] sm:text-xs font-black text-white uppercase truncate leading-tight">
                                {estate.name}
                              </h4>
                              {estate.isStandby && (
                                <span className="px-1 py-0.2 rounded text-[7.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                  Standby
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[8.5px] sm:text-[9px] text-slate-400 font-medium truncate leading-tight mt-0.5">
                              <span className="truncate">{estate.millName}</span>
                              {selectedZone === 'ALL' && estate.zoneName && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-emerald-400/90 truncate">{estate.zoneName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8.5px] font-black uppercase tracking-wider shadow-sm">
                              Aktif
                            </span>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 flex items-center justify-center">
                              <ArrowUpRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sub metrics compact */}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[9px] sm:text-[10px]">
                        <div className="flex items-center gap-1 text-slate-400">
                          <TreePine className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                          <span>{blockCount} Blok</span>
                        </div>
                        <div className="font-bold text-slate-300">
                          {estate.totalHectares.toFixed(1)} <span className="text-[7.5px] sm:text-[8px] text-slate-500">Ha</span>
                        </div>
                        <div className="flex items-center gap-0.5 font-bold text-amber-400 text-[8.5px] sm:text-[9px]">
                          <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span>{estate.annualTargetPkt1} t/ha</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
