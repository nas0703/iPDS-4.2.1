import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  BookOpen,
  Calculator,
  Camera,
  ChevronDown,
  Leaf,
  Copy,
  Check,
  Volume2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  MessageSquareText
} from 'lucide-react';
import { WEED_DATABASE, WeedMasterProfile } from '../../../data/weedDatabase';
import { speakMalayText } from '../../../utils/speechUtils';

interface WeedDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeedForCalculator?: (weedId: string) => void;
  onOpenCalculatorForWeed?: (weedId: string) => void;
  onOpenScanner?: () => void;
  onAskAiAboutWeed?: (question: string) => void;
  initialWeedId?: string;
}

export const WeedDatabaseModal: React.FC<WeedDatabaseModalProps> = ({
  isOpen,
  onClose,
  onSelectWeedForCalculator,
  onOpenCalculatorForWeed,
  onOpenScanner,
  onAskAiAboutWeed,
  initialWeedId = 'asystasia-gangetica',
}) => {
  const handleCalculator = onSelectWeedForCalculator || onOpenCalculatorForWeed;
  
  const [selectedWeedId, setSelectedWeedId] = useState<string>(initialWeedId);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const selectedWeed = useMemo(() => {
    return WEED_DATABASE.find((w) => w.id === selectedWeedId) || WEED_DATABASE[0];
  }, [selectedWeedId]);

  const currentIndex = useMemo(() => {
    return WEED_DATABASE.findIndex((w) => w.id === selectedWeed.id);
  }, [selectedWeed]);

  const filteredDropdownWeeds = useMemo(() => {
    const q = dropdownSearch.toLowerCase().trim();
    if (!q) return WEED_DATABASE;
    return WEED_DATABASE.filter(
      (w) =>
        w.malayName.toLowerCase().includes(q) ||
        w.scientificName.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.chemicalControl.some((c) => c.activeIngredient.toLowerCase().includes(q))
    );
  }, [dropdownSearch]);

  if (!isOpen) return null;

  const handleNextWeed = () => {
    const nextIdx = (currentIndex + 1) % WEED_DATABASE.length;
    setSelectedWeedId(WEED_DATABASE[nextIdx].id);
  };

  const handlePrevWeed = () => {
    const prevIdx = (currentIndex - 1 + WEED_DATABASE.length) % WEED_DATABASE.length;
    setSelectedWeedId(WEED_DATABASE[prevIdx].id);
  };

  const generateMarkdownSummary = (weed: WeedMasterProfile) => {
    return `### 🌿 Profil & Manual Rumpai Sawit: **${weed.malayName}**

#### A. 📋 Nama Biasa & Identifikasi Botani
- **Nama Tempatan / Melayu:** ${weed.malayName}
- **Nama Saintifik:** *${weed.scientificName}* ${weed.synonyms && weed.synonyms.length > 0 ? `(Sinonim: ${weed.synonyms.join(', ')})` : ''}
- **Nama Inggeris:** ${weed.englishName}
- **Famili:** ${weed.family}
- **Kategori Rumpai:** ${weed.category}
- **Morfologi & Ciri Habitat:** ${weed.morphology.description} Habitat: ${weed.morphology.habitat}
- **Impak Persaingan:** ${weed.morphology.competitionImpact}
- **Kaedah Penyebaran:** ${weed.morphology.spreadMethod}

#### B. 📊 Jadual Spesifikasi & Dos Racun Kimia (Standard Pam 16 L)
*Nota: Pengiraan kadar di bawah telah ditentukur daripada kadar asal 18 Liter kepada kapasiti alat penyembur galas piawai 16 Liter.*

| RUMPAI / SASARAN | RACUN KIMIA (BAHAN AKTIF % A.I.) | KADAR BANCUHAN (PAM 16 L) | KADAR / HEKTAR |
| :--- | :--- | :--- | :--- |
${weed.chemicalControl.map((c, i) => `| ${i === 0 ? `*${weed.scientificName}*` : ''} | ${c.activeIngredient}${c.tradeNameExample ? ` (${c.tradeNameExample})` : ''} | ${c.rate16L} (${c.rate18L}) | ${c.ratePerHa || '-'} |`).join('\n')}

#### C. 📌 Poin Penting & Syarat Kawalan Agronomi
${weed.chemicalControl.map((c, i) => `- **Pilihan ${i + 1} (${c.activeIngredient}):** ${c.notes} • *Kumpulan Tindakan (MoA):* \`${c.moaGroup}\` • *Kesesuaian Umur Sawit:* ${c.minPalmAgeMonths === 0 ? 'Selamat untuk semua umur' : `Disyorkan untuk sawit > ${c.minPalmAgeMonths} bulan (${c.safeForImmature ? 'Selamat untuk TBM' : 'Perlu nozel bertudung'})`}`).join('\n')}
- **Pengurusan Kerintangan Racun (IWM):** Tahap Risiko: **${weed.resistanceManagement.riskLevel.toUpperCase()}**. ${weed.resistanceManagement.rotationStrategy}
- **Amalan GAP / Kultur Pencegahan:** ${weed.resistanceManagement.preventiveTips.join(' • ')}`;
  };

  const handleCopyMarkdown = () => {
    const text = generateMarkdownSummary(selectedWeed);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToSpeak = `${selectedWeed.malayName}. Nama saintifik: ${selectedWeed.scientificName}. Famili ${selectedWeed.family}. Morfologi: ${selectedWeed.morphology.description}. Kawalan racun pam 16 liter: ${selectedWeed.chemicalControl[0]?.activeIngredient}, kadar ${selectedWeed.chemicalControl[0]?.rate16L}.`;
    setIsSpeaking(true);
    speakMalayText(textToSpeak, {
      rate: 0.98,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Broadleaf':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Grass':
        return 'bg-lime-500/20 text-lime-300 border-lime-500/40';
      case 'Woody/Shrub':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Fern':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Climber':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Sedge':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-100"
        >
          {/* 1. Sleek Modern Header */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-emerald-500/30 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <BookOpen size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
                    Pangkalan Data 22 Rumpai Sawit
                  </h2>
                  <span className="text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded shrink-0">
                    MSPO PIAWAI
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 font-medium truncate">
                  Pilih mana-mana spesies untuk paparan segera: Nama Biasa, Morfologi & Kawalan 16L
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 text-[11px] font-bold transition-all cursor-pointer"
                  title="Buka Pengimbas AI"
                >
                  <Camera size={12} />
                  <span>Imbas AI</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 2. Interactive Dropdown Toggle Bar (22 Senarai Rumpai) */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800/90 relative z-20 shrink-0">
            <div className="flex items-center gap-2">
              {/* Prev Button */}
              <button
                type="button"
                onClick={handlePrevWeed}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Spesies Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Dropdown Toggle Button */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-emerald-500/50 hover:border-emerald-400 transition-all flex items-center justify-between gap-2 text-left cursor-pointer shadow-sm shadow-emerald-950/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={selectedWeed.imageUrl}
                      alt={selectedWeed.malayName}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-md object-cover border border-emerald-400/60 shrink-0 bg-slate-950 shadow-xs"
                    />
                    <span className="text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded shrink-0">
                      {currentIndex + 1}/22
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white truncate group-hover:text-emerald-300 transition-colors">
                          {selectedWeed.malayName}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-serif italic hidden sm:inline truncate">
                          ({selectedWeed.scientificName})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border hidden xs:inline ${getCategoryColor(selectedWeed.category)}`}>
                      {selectedWeed.category}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Dropdown Menu (All 22 Weeds) */}
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/98 backdrop-blur-xl border border-emerald-500/40 rounded-xl shadow-2xl p-2 z-50 max-h-80 flex flex-col space-y-1.5"
                    >
                      {/* Search Filter inside dropdown */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          placeholder="Cari dalam 22 senarai rumpai..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Weeds List */}
                      <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
                        {filteredDropdownWeeds.map((w) => {
                          const isSelected = w.id === selectedWeed.id;
                          const originalIdx = WEED_DATABASE.findIndex((item) => item.id === w.id);
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => {
                                setSelectedWeedId(w.id);
                                setIsDropdownOpen(false);
                                setDropdownSearch('');
                              }}
                              className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer border ${
                                isSelected
                                  ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-md ring-1 ring-emerald-400/50'
                                  : 'bg-slate-900/80 hover:bg-emerald-700/80 text-slate-200 hover:text-white border-slate-800 hover:border-emerald-500/50'
                              } group`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Weed Specimen Image Thumbnail */}
                                <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-emerald-500/40 bg-slate-950 shadow-xs">
                                  <img
                                    src={w.imageUrl}
                                    alt={w.malayName}
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                  <span className="absolute bottom-0.5 right-0.5 text-[7.5px] font-mono font-black px-1 rounded bg-slate-950/90 text-emerald-300 border border-emerald-500/30">
                                    #{originalIdx + 1}
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs truncate font-bold group-hover:text-white">{w.malayName}</p>
                                  <p className={`text-[10px] italic truncate font-serif ${isSelected ? 'text-emerald-100' : 'text-emerald-300/90 group-hover:text-emerald-100'}`}>
                                    {w.scientificName}
                                  </p>
                                  <p className={`text-[9.5px] truncate ${isSelected ? 'text-emerald-100' : 'text-slate-400 group-hover:text-emerald-100/90'}`}>
                                    Dos 16L: <span className="font-mono text-emerald-300 font-semibold">{w.chemicalControl[0]?.rate16L || 'Ikut SOP'}</span>
                                  </p>
                                </div>
                              </div>
                              <span className={`text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${isSelected ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                {w.category}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNextWeed}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Spesies Seterusnya"
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>

          {/* 3. Structured RAG AI Answer Model Format */}
          <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-950/40 text-xs sm:text-sm leading-relaxed">
            {/* Quick Action Buttons Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Model Jawapan RAG AI
                </span>
                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.2 rounded-full font-mono">
                  VERIFIED MSPO
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSpeak}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    isSpeaking
                      ? 'bg-emerald-600 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Dengar bacaan suara"
                >
                  <Volume2 size={13} className={isSpeaking ? 'animate-bounce' : ''} />
                  <span className="hidden xs:inline">{isSpeaking ? 'Membaca...' : 'Dengar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Salin maklumat lengkap"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span className="hidden xs:inline">{copied ? 'Disalin!' : 'Salin'}</span>
                </button>

                {handleCalculator && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCalculator(selectedWeed.id);
                      onClose();
                    }}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <Calculator size={13} />
                    <span>Kira Dos 16L</span>
                  </button>
                )}

                {onAskAiAboutWeed && (
                  <button
                    type="button"
                    onClick={() => {
                      onAskAiAboutWeed(`Terangkan secara mendalam kaedah kawalan dan dos bancuhan 16L bagi rumpai ${selectedWeed.malayName} (${selectedWeed.scientificName}) mengikut Manual Rumpai Sawit.`);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Tanya AI RAG Sembang"
                  >
                    <MessageSquareText size={13} />
                    <span className="hidden sm:inline">Tanya AI</span>
                  </button>
                )}
              </div>
            </div>

            {/* SEKSYEN 1: NAMA BIASA & IDENTIFIKASI BOTANI */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
                  1
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                  Nama Biasa & Identifikasi Botani
                </h3>
              </div>

              {selectedWeed.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-950/80 shadow-md">
                  <div className="relative w-full h-44 sm:h-52 bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={selectedWeed.imageUrl}
                      alt={`${selectedWeed.malayName} (${selectedWeed.scientificName})`}
                      className="w-full h-full object-cover object-center hover:scale-105 transition-all duration-300"
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-950/85 backdrop-blur-md rounded-lg border border-emerald-500/30 text-[10.5px] text-emerald-300 font-bold flex items-center gap-1.5 shadow-md">
                      <span>🌿</span>
                      <span>Spesimen Botani Lapangan</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">Nama Tempatan / Melayu:</span>
                  <p className="text-sm font-bold text-white bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    {selectedWeed.malayName}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">Nama Saintifik & Sinonim:</span>
                  <p className="text-sm font-serif italic text-emerald-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    {selectedWeed.scientificName}
                    {selectedWeed.synonyms && selectedWeed.synonyms.length > 0 && (
                      <span className="text-slate-400 text-xs font-sans not-italic block mt-0.5">
                        Sinonim: {selectedWeed.synonyms.join(', ')}
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">Nama Inggeris:</span>
                  <p className="text-xs font-medium text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    {selectedWeed.englishName}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-bold">Famili & Kategori Rumpai:</span>
                  <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-200 font-mono">Famili: {selectedWeed.family}</span>
                    <span className="text-slate-600">•</span>
                    <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded border ${getCategoryColor(selectedWeed.category)}`}>
                      {selectedWeed.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEKSYEN 2: MORFOLOGI & CIRI-CIRI LAPANGAN */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 font-black text-xs flex items-center justify-center font-mono">
                  2
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                  Morfologi & Ciri-Ciri Lapangan
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <strong className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <Leaf size={13} />
                    <span>Ciri Botani & Bentuk Pertumbuhan:</span>
                  </strong>
                  <p className="text-slate-200 leading-relaxed pl-1">
                    {selectedWeed.morphology.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <strong className="text-[10.5px] font-bold text-slate-300 block">
                      📍 Habitat & Lokasi Lazim di Ladang:
                    </strong>
                    <p className="text-slate-300 text-[11.5px] leading-relaxed">
                      {selectedWeed.morphology.habitat}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <strong className="text-[10.5px] font-bold text-amber-400 block">
                      ⚠️ Impak Persaingan Terhadap Sawit:
                    </strong>
                    <p className="text-slate-300 text-[11.5px] leading-relaxed">
                      {selectedWeed.morphology.competitionImpact}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <strong className="text-[10.5px] font-bold text-teal-400 block">
                    🌱 Kaedah Pembiakan & Penyebaran:
                  </strong>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    {selectedWeed.morphology.spreadMethod}
                  </p>
                </div>
              </div>
            </div>

            {/* SEKSYEN 3: KAEDAH KAWALAN & DOS RACUN (PAM 16 LITER) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center font-mono">
                    3
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                    B. 📊 Jadual Spesifikasi & Dos Racun Kimia (Standard Pam 16 L)
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded">
                  {selectedWeed.chemicalControl.length} Pilihan Rawatan
                </span>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Nota: Pengiraan kadar di bawah telah ditentukur daripada kadar asal 18 Liter kepada kapasiti alat penyembur galas piawai 16 Liter.
              </p>

              {/* Table format */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-sm bg-slate-950/60">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider text-[10.5px]">
                      <th className="px-3 py-2.5 border-r border-emerald-500/20 whitespace-nowrap">RUMPAI / SASARAN</th>
                      <th className="px-3 py-2.5 border-r border-emerald-500/20 whitespace-nowrap">RACUN KIMIA (BAHAN AKTIF % A.I.)</th>
                      <th className="px-3 py-2.5 border-r border-emerald-500/20 whitespace-nowrap text-emerald-200">KADAR BANCUHAN (PAM 16 L)</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">KADAR / HEKTAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {selectedWeed.chemicalControl.map((ctrl, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                        <td className="px-3 py-2.5 text-slate-200 border-r border-slate-800 font-medium align-top">
                          {idx === 0 ? (
                            <div>
                              <span className="font-serif italic text-emerald-400 block font-bold">{selectedWeed.scientificName}</span>
                              <span className="text-[10px] text-slate-400">{ctrl.target}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">{ctrl.target}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-800 align-top">
                          <div className="font-bold text-teal-300 text-xs">
                            {ctrl.activeIngredient}
                          </div>
                          {ctrl.tradeNameExample && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Jenama: <span className="text-slate-300 font-medium">{ctrl.tradeNameExample}</span>
                            </div>
                          )}
                          <div className="mt-1">
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {ctrl.moaGroup}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border-r border-slate-800 align-top bg-emerald-950/20">
                          <div className="font-bold font-mono text-xs text-emerald-300">
                            {ctrl.rate16L}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ({ctrl.rate18L})
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 font-mono text-[11px] align-top">
                          {ctrl.ratePerHa || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Poin Penting & Syarat Kawalan Agronomi */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase">
                  <span>📌 C. Poin Penting & Syarat Kawalan Agronomi:</span>
                </h4>
                <ul className="space-y-1.5 pl-1">
                  {selectedWeed.chemicalControl.map((ctrl, idx) => (
                    <li key={idx} className="text-slate-300 text-[11.5px] leading-relaxed flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>
                      <span>
                        <strong className="text-slate-200">Pilihan {idx + 1} ({ctrl.activeIngredient}):</strong> {ctrl.notes}
                        <span className="text-slate-400 block text-[10.5px] mt-0.5">
                          Kesesuaian Umur: {ctrl.minPalmAgeMonths === 0 ? 'Selamat untuk semua umur' : `Disyorkan untuk sawit > ${ctrl.minPalmAgeMonths} bulan (${ctrl.safeForImmature ? 'Selamat untuk TBM' : 'Perlu nozel bertudung'})`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SEKSYEN 4: PENGURUSAN KERINTANGAN RACUN (IWM) */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center font-mono">
                  4
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                  Pengurusan Kerintangan Racun (IWM) & Pencegahan
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-300">Tahap Risiko Kerintangan Racun:</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                    selectedWeed.resistanceManagement.riskLevel === 'High'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : selectedWeed.resistanceManagement.riskLevel === 'Medium'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    RISIKO {selectedWeed.resistanceManagement.riskLevel.toUpperCase()}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <strong className="text-[10.5px] font-bold text-teal-400 block">
                    🔄 Strategi Penggiliran Bahan Aktif (MoA Rotation):
                  </strong>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed">
                    {selectedWeed.resistanceManagement.rotationStrategy}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                  <strong className="text-[10.5px] font-bold text-slate-200 block">
                    🛡️ Petua Kawalan Kultur & Amalan Ladang (Good Agricultural Practices):
                  </strong>
                  <ul className="space-y-1 pl-3 list-disc marker:text-emerald-400 text-slate-300 text-[11px]">
                    {selectedWeed.resistanceManagement.preventiveTips.map((tip, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
