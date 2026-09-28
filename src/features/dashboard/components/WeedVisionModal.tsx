import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Sprout, ShieldCheck, Calculator, Camera, ArrowLeft, BookOpen } from 'lucide-react';
import { WeedVisionDiagnosis } from './WeedVisionDiagnosis';
import { WeedDosageCalculatorAndSop } from './WeedDosageCalculatorAndSop';
import { WeedMasterProfile, WEED_DATABASE } from '../../../data/weedDatabase';

interface WeedVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskAiWithPhoto?: (query: string, photoPreviewUrl?: string) => void;
  onOpenCalculatorForWeed?: (weedId: string) => void;
  onWeedIdentified?: (weed: WeedMasterProfile) => void;
  initialWeedId?: string;
  initialTab?: 'scanner' | 'calculator' | 'database';
}

export const WeedVisionModal: React.FC<WeedVisionModalProps> = ({
  isOpen,
  onClose,
  onAskAiWithPhoto,
  onOpenCalculatorForWeed,
  onWeedIdentified,
  initialWeedId = 'asystasia-gangetica',
  initialTab = 'scanner',
}) => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'calculator' | 'database'>(initialTab);
  const [currentWeedId, setCurrentWeedId] = useState<string>(initialWeedId);
  const [currentWeedName, setCurrentWeedName] = useState<string>('');
  const [databaseSearch, setDatabaseSearch] = useState<string>('');
  const [databaseCategory, setDatabaseCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleWeedIdentified = (weed: WeedMasterProfile) => {
    setCurrentWeedId(weed.id);
    setCurrentWeedName(weed.malayName);
    onWeedIdentified?.(weed);
  };

  const handleOpenCalculatorDirect = (weedId: string) => {
    setCurrentWeedId(weedId);
    const target = WEED_DATABASE.find(w => w.id === weedId);
    if (target) setCurrentWeedName(target.malayName);
    setActiveTab('calculator');
    onOpenCalculatorForWeed?.(weedId);
  };

  const filteredCatalog = WEED_DATABASE.filter((w) => {
    const q = databaseSearch.toLowerCase().trim();
    const matchQ =
      !q ||
      w.malayName.toLowerCase().includes(q) ||
      w.scientificName.toLowerCase().includes(q) ||
      w.englishName.toLowerCase().includes(q) ||
      w.chemicalControl.some(c => c.activeIngredient.toLowerCase().includes(q) || c.tradeNameExample.toLowerCase().includes(q));
    const matchCat = databaseCategory === 'ALL' || w.category === databaseCategory;
    return matchQ && matchCat;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col"
        >
          {/* Modal Header */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-emerald-500/30 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                {activeTab === 'database' ? <BookOpen size={16} /> : <Sparkles size={16} className="animate-pulse" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5 truncate">
                    WeedVision™ <span className="text-emerald-400 font-extrabold text-xs">AI</span>
                  </h2>
                  <span className="text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded shrink-0">
                    {activeTab === 'calculator'
                      ? 'KALKULATOR 16L'
                      : activeTab === 'database'
                      ? 'PANGKALAN DATA (22)'
                      : 'PENGIMBAS AI'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  {activeTab === 'calculator'
                    ? `Pengiraan Dos & Kos Racun: ${currentWeedName || currentWeedId}`
                    : activeTab === 'database'
                    ? 'Katalog 22 Spesies Rumpai Utama Sawit & Kaedah Kawalan'
                    : 'Pengecaman Botani Lapangan, Dos Racun 16L & SOP Sawit'}
                </p>
              </div>
            </div>

            {/* View Switcher Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('scanner')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    activeTab === 'scanner'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Buka Pengimbas Imej"
                >
                  <Camera size={12} />
                  <span className="hidden sm:inline">Imbas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('calculator')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    activeTab === 'calculator'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Buka Pengiraan Dos Racun"
                >
                  <Calculator size={12} />
                  <span className="hidden sm:inline">Dos 16L</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    activeTab === 'database'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Buka Katalog Pangkalan Data Rumpai"
                >
                  <BookOpen size={12} />
                  <span className="hidden sm:inline">Katalog</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                title="Tutup WeedVision"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-3 sm:p-4 overflow-y-auto flex-1">
            {activeTab === 'scanner' ? (
              <WeedVisionDiagnosis
                autoStartCamera={true}
                onClose={onClose}
                onWeedIdentified={handleWeedIdentified}
                onAskAiWithPhoto={onAskAiWithPhoto}
                onOpenCalculatorForWeed={handleOpenCalculatorDirect}
                onOpenDatabase={() => setActiveTab('database')}
              />
            ) : activeTab === 'calculator' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-200">
                      Spesies Terpilih: <strong className="text-white underline">{currentWeedName || currentWeedId}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('database')}
                      className="text-[10.5px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <BookOpen size={11} />
                      <span>Katalog</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('scanner')}
                      className="text-[10.5px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <ArrowLeft size={12} />
                      <span>Imbas Semula</span>
                    </button>
                  </div>
                </div>

                <WeedDosageCalculatorAndSop
                  selectedWeedId={currentWeedId}
                  onSelectWeed={(newId) => {
                    setCurrentWeedId(newId);
                    const target = WEED_DATABASE.find(w => w.id === newId);
                    if (target) setCurrentWeedName(target.malayName);
                  }}
                  onAskAiAboutWeed={(q) => onAskAiWithPhoto?.(q)}
                />
              </div>
            ) : (
              /* Database Catalog Tab Inside WeedVisionModal */
              <div className="space-y-3">
                {/* Search & Filter Header */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <input
                    type="text"
                    value={databaseSearch}
                    onChange={(e) => setDatabaseSearch(e.target.value)}
                    placeholder="🔍 Cari nama rumpai, nama saintifik, atau bahan aktif..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] custom-scrollbar">
                    {['ALL', 'Broadleaf', 'Grass', 'Woody/Shrub', 'Fern', 'Climber', 'Sedge'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setDatabaseCategory(cat)}
                        className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap cursor-pointer transition-colors ${
                          databaseCategory === cat
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {cat === 'ALL' ? 'Semua (22)' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weeds List */}
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {filteredCatalog.map((weed) => (
                    <div
                      key={weed.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            {weed.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Famili: {weed.family}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-white">
                          {weed.malayName} <span className="text-emerald-400 font-serif italic text-[11px]">({weed.scientificName})</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-400 line-clamp-1">
                          {weed.chemicalControl[0]
                            ? `Bahan Aktif: ${weed.chemicalControl[0].activeIngredient} (${weed.chemicalControl[0].rate16L})`
                            : weed.morphology.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenCalculatorDirect(weed.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Calculator size={11} />
                          <span>Kira Dos 16L</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


