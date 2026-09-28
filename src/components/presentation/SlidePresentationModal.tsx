import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Upload, 
  Sparkles, 
  Trash2, 
  Play, 
  X, 
  FileSpreadsheet, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  Presentation, 
  Download, 
  Calendar, 
  Layers, 
  Share2, 
  Info 
} from 'lucide-react';
import { 
  PresentationDeck, 
  SlideItem,
  fetchPresentationDecks, 
  savePresentationDeck, 
  deletePresentationDeck, 
  parsePPTXFile, 
  parsePDFFileToSlideImages,
  generateExecutiveDeck,
  fileToBlobBase64,
  downloadDeckAsPPTX
} from '../../services/presentationService';
import { PresenterMode } from './PresenterMode';

interface SlidePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const SlidePresentationModal: React.FC<SlidePresentationModalProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [decks, setDecks] = useState<PresentationDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDeck, setActiveDeck] = useState<PresentationDeck | null>(null);
  const [showPresenter, setShowPresenter] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadDecks();
    }
  }, [isOpen]);

  const loadDecks = async () => {
    setLoading(true);
    try {
      const data = await fetchPresentationDecks();
      if (data.length === 0) {
        // Auto create an official executive deck if none exists
        const execDeck = generateExecutiveDeck();
        await savePresentationDeck(execDeck);
        setDecks([execDeck]);
      } else {
        setDecks(data);
      }
    } catch (err) {
      console.warn('Error loading decks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      const filesArray: File[] = Array.from(fileList);
      const firstFile = filesArray[0];
      const fileNameLower = firstFile.name.toLowerCase();
      const isPDF = fileNameLower.endsWith('.pdf');
      const isPPTX = fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');

      let parsedSlides: SlideItem[] = [];
      let base64Blob: string | null = null;

      try {
        base64Blob = await fileToBlobBase64(firstFile);
      } catch (e) {
        console.warn('Could not convert file to Base64 Blob:', e);
      }

      if (isPDF) {
        parsedSlides = await parsePDFFileToSlideImages(firstFile);
      } else if (isPPTX) {
        parsedSlides = await parsePPTXFile(firstFile);
      } else {
        // Image files or multiple uploaded slide pages
        for (let idx = 0; idx < filesArray.length; idx++) {
          const file = filesArray[idx];
          let imgDataUrl = '';
          try {
            imgDataUrl = await fileToBlobBase64(file);
          } catch (e) {
            imgDataUrl = URL.createObjectURL(file);
          }

          parsedSlides.push({
            id: `slide_orig_${idx + 1}_${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: imgDataUrl,
            type: 'image' as const,
            isOriginal: true,
            notes: `Slaid asli daripada fail ${file.name}`
          });
        }
      }

      const mainTitle = filesArray.length > 1
        ? `DEK SLAID (${filesArray.length} MUKA SURAT)`
        : firstFile.name.replace(/\.[^/.]+$/, '').toUpperCase();

      const newDeck: PresentationDeck = {
        id: `deck_${Date.now()}`,
        title: mainTitle,
        description: `Slaid pembentangan dimuat naik pada ${new Date().toLocaleDateString('ms-MY')}`,
        category: 'Muat Naik',
        author: 'Pegawai Pembentang',
        pptx_base64: base64Blob,
        file_name: firstFile.name,
        file_size: firstFile.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        slides: parsedSlides
      };

      await savePresentationDeck(newDeck);
      setDecks(prev => [newDeck, ...prev]);
      onShowToast?.('success', `Slaid ${firstFile.name} (${parsedSlides.length} muka surat visual) berjaya dimuat naik!`);
    } catch (err) {
      console.error('Failed to parse uploaded slide:', err);
      onShowToast?.('error', 'Gagal memproses fail pembentangan. Sila cuba lagi.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateNewDeck = async () => {
    setUploading(true);
    try {
      const newExecDeck = generateExecutiveDeck();
      await savePresentationDeck(newExecDeck);
      setDecks(prev => [newExecDeck, ...prev]);
      onShowToast?.('success', 'Slaid Laporan Eksekutif iPDS berjaya dijana!');
    } catch (err) {
      onShowToast?.('error', 'Gagal menjana slaid pembentangan.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setDecks(prev => prev.filter(d => d.id !== id));
      await deletePresentationDeck(id);
      onShowToast?.('info', `Slaid "${title}" telah dipadam.`);
    } catch (err) {
      console.error('Failed to delete presentation deck:', err);
      onShowToast?.('error', 'Gagal memadam slaid.');
    } finally {
      setDeletingId(null);
    }
  };

  const startPresentation = (deck: PresentationDeck) => {
    setActiveDeck(deck);
    setShowPresenter(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {!showPresenter && (
          <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-4xl bg-[#041618] border border-emerald-500/40 rounded-3xl p-5 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.95)] relative overflow-hidden"
            >
              {/* HEADER SECTION */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/40 shrink-0">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                      Platform Pembentangan Slide iPDS
                    </h2>
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">
                      Muat Naik PDF / Imej / PowerPoint & Buat Pembentangan Langsung
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2.5 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-emerald-500/50 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* UPLOAD & GENERATE ACTIONS BANNER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Upload File */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-400 bg-gradient-to-r hover:from-emerald-950/40 hover:to-teal-950/40 flex items-center gap-3 transition-all group text-left relative overflow-hidden"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Muat Naik PDF / Imej / PPTX
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      PDF & Imej menyokong visual slaid 100% tepat mengikut reka bentuk asal
                    </p>
                  </div>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.pptx,.ppt,image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {/* Auto-Generate Executive Deck */}
                <button
                  onClick={handleGenerateNewDeck}
                  disabled={uploading}
                  className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-110 text-white flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/20 text-left active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      Jana Slaid Eksekutif iPDS
                    </h3>
                    <p className="text-[10px] text-emerald-100 font-bold">
                      Jana slaid laporan rasmi automatik berasaskan data terkini
                    </p>
                  </div>
                </button>
              </div>

              {/* HELPFUL TIP FOR 100% PERFECT VISUAL SLIDES */}
              <div className="mb-6 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-200">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Petua Visual 100% Asli:</strong> Untuk paparan visual slaid 100% tepat mengikut font, susun atur, dan grafik asal PowerPoint anda, muat naik fail **PDF** atau **Imej Slaid (PNG/JPG)**.
                </span>
              </div>

              {/* DECKS LIST CONTAINER */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Senarai Slaid Pembentangan Tersimpan</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {decks.length} Dek Slaid
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Memuatkan dek slaid...</span>
                  </div>
                ) : decks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-white/5 text-slate-400">
                    <Presentation className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-bold uppercase">Tiada slaid pembentangan ditemui.</p>
                    <p className="text-[10px] text-slate-500 mt-1">Sila muat naik fail PowerPoint atau tekan "Jana Slaid Eksekutif".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                    {decks.map(deck => (
                      <div
                        key={deck.id}
                        className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-400/80 rounded-2xl p-4 flex flex-col justify-between transition-all group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {deck.category}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {deck.slides.length} Slaid
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider line-clamp-1 mb-1">
                            {deck.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mb-3">
                            {deck.description || 'Tiada penerangan.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1">
                          <span className="text-[9px] text-slate-500 font-bold">
                            {deck.author}
                          </span>

                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => downloadDeckAsPPTX(deck)}
                              className="p-2 rounded-xl text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 border border-emerald-500/20 transition-all"
                              title="Muat Turun PowerPoint (.pptx)"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {deletingId === deck.id ? (
                              <button
                                onClick={(e) => handleDelete(deck.id, deck.title, e)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md shadow-rose-600/30 transition-all animate-pulse"
                                title="Sahkan Padam Slaid Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Padam?</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(deck.id);
                                  setTimeout(() => setDeletingId(prev => prev === deck.id ? null : prev), 4000);
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                                title="Padam Slaid"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => startPresentation(deck)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Mula Pembentangan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FOOTER INFO */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Info className="w-3.5 h-3.5" />
                  Slaid tersimpan secara automatik pada Cloud Supabase
                </span>
                <span>Disokong pada Mobile & Laptop</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN PRESENTER PLAYER */}
      {showPresenter && activeDeck && (
        <PresenterMode
          deck={activeDeck}
          onClose={() => setShowPresenter(false)}
        />
      )}
    </>
  );
};
