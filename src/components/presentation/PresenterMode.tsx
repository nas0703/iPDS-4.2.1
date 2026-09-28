import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  FileText, 
  Grid, 
  Radio, 
  Clock, 
  Sparkles,
  Volume2,
  Download,
  Layers
} from 'lucide-react';
import { PresentationDeck, SlideItem, downloadDeckAsPPTX } from '../../services/presentationService';

interface PresenterModeProps {
  deck: PresentationDeck;
  onClose: () => void;
}

type TransitionStyle = 'slide' | 'fade' | 'zoom' | 'flip';

export const PresenterMode: React.FC<PresenterModeProps> = ({ deck, onClose }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<number>(1); // 1 = next, -1 = prev
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('slide');
  const [showTransitionMenu, setShowTransitionMenu] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLaserActive, setIsLaserActive] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: -100, y: -100 });
  const [showNotes, setShowNotes] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  
  // Timer state
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Auto-play slideshow state
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplayIntervalSec, setAutoplayIntervalSec] = useState(5);
  const [imgLoadErrors, setImgLoadErrors] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const currentSlide: SlideItem | undefined = deck.slides[currentSlideIndex];
  const totalSlides = deck.slides.length;
  const hasValidImage = currentSlide?.imageUrl && currentSlide?.type === 'image' && !imgLoadErrors[currentSlide.id];

  // Slide Animation Variants based on selected transition style
  const slideVariants = {
    slide: {
      initial: (dir: number) => ({
        x: dir > 0 ? 250 : -250,
        opacity: 0,
        scale: 0.96
      }),
      animate: {
        x: 0,
        opacity: 1,
        scale: 1,
        transition: {
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.25 }
        }
      },
      exit: (dir: number) => ({
        x: dir < 0 ? 250 : -250,
        opacity: 0,
        scale: 0.96,
        transition: {
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 }
        }
      })
    },
    fade: {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } }
    },
    zoom: {
      initial: (dir: number) => ({
        opacity: 0,
        scale: dir > 0 ? 0.8 : 1.2
      }),
      animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
      exit: (dir: number) => ({
        opacity: 0,
        scale: dir < 0 ? 0.8 : 1.2,
        transition: { duration: 0.2, ease: 'easeIn' }
      })
    },
    flip: {
      initial: (dir: number) => ({
        opacity: 0,
        rotateY: dir > 0 ? 45 : -45,
        scale: 0.9
      }),
      animate: { opacity: 1, rotateY: 0, scale: 1, transition: { duration: 0.35 } },
      exit: (dir: number) => ({
        opacity: 0,
        rotateY: dir < 0 ? 45 : -45,
        scale: 0.9,
        transition: { duration: 0.25 }
      })
    }
  };

  // Presentation Timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else if (!isTimerRunning && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, seconds]);

  // Autoplay Slideshow
  useEffect(() => {
    let interval: any = null;
    if (isAutoplay) {
      interval = setInterval(() => {
        setCurrentSlideIndex(prev => (prev + 1) % totalSlides);
      }, autoplayIntervalSec * 1000);
    }
    return () => clearInterval(interval);
  }, [isAutoplay, autoplayIntervalSec, totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'l' || e.key === 'L') {
        setIsLaserActive(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, totalSlides, isFullscreen]);

  const goToSlide = (targetIndex: number) => {
    if (targetIndex === currentSlideIndex) return;
    setSlideDirection(targetIndex > currentSlideIndex ? 1 : -1);
    setCurrentSlideIndex(targetIndex);
  };

  const nextSlide = () => {
    if (currentSlideIndex < totalSlides - 1) {
      setSlideDirection(1);
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setSlideDirection(-1);
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn('Fullscreen error:', err);
      });
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
  };

  // Mouse / Touch movement for Laser Pointer
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isLaserActive) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setLaserPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // Touch Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartX.current = null;
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[1000] bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      {/* LASER POINTER DOT OVERLAY */}
      {isLaserActive && (
        <div 
          className="pointer-events-none fixed z-[9999] w-6 h-6 rounded-full bg-rose-500 shadow-[0_0_20px_#f43f5e,0_0_40px_#f43f5e] transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 animate-pulse"
          style={{ left: `${laserPos.x}px`, top: `${laserPos.y}px` }}
        />
      )}

      {/* TOP PRESENTER TOOLBAR */}
      <div className="bg-slate-900/90 border-b border-emerald-500/30 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between z-50">
        {/* Left Info & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
              {deck.title}
            </h2>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate">
              Slaid {currentSlideIndex + 1} daripada {totalSlides}
            </p>
          </div>
        </div>

        {/* Center Timer & Autoplay */}
        <div className="hidden md:flex items-center gap-4 bg-slate-950/80 px-4 py-1.5 rounded-full border border-white/10">
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatTimer(seconds)}</span>
          </div>
          <div className="w-[1px] h-4 bg-white/20" />
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white"
          >
            {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setSeconds(0)}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white"
            title="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Tools Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Laser Pointer Toggle */}
          <button
            onClick={() => setIsLaserActive(!isLaserActive)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              isLaserActive 
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white'
            }`}
            title="Penuding Laser (Tekan L)"
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline text-[10px] uppercase font-bold">Laser</span>
          </button>

          {/* Grid View Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              showGrid
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white'
            }`}
            title="Ringkasan Slaid"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Transition Effect Picker */}
          <div className="relative">
            <button
              onClick={() => setShowTransitionMenu(!showTransitionMenu)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                showTransitionMenu 
                  ? 'bg-emerald-500/30 border-emerald-400 text-white' 
                  : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white'
              }`}
              title="Kesan Peralihan Slaid (Slide Transition)"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline text-[10px] uppercase font-bold text-emerald-300 capitalize">
                {transitionStyle}
              </span>
            </button>

            {showTransitionMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-12 z-50 bg-slate-900 border border-emerald-500/40 rounded-2xl p-2 shadow-2xl min-w-[170px] space-y-1 backdrop-blur-xl"
              >
                <p className="text-[9px] font-black uppercase text-slate-400 px-3 py-1 tracking-wider border-b border-white/10 mb-1">
                  Gaya Peralihan Slaid
                </p>
                {[
                  { id: 'slide', label: '⚡ Slide / Geser', desc: 'Gerakan kiri-kanan' },
                  { id: 'fade', label: '🌫️ Resap / Fade', desc: 'Resap lembut' },
                  { id: 'zoom', label: '🔍 Zum / Zoom', desc: 'Zum fokus masuk' },
                  { id: 'flip', label: '🔄 Putaran 3D', desc: 'Pusingan 3D card' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setTransitionStyle(opt.id as TransitionStyle);
                      setShowTransitionMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-all flex flex-col ${
                      transitionStyle === opt.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[9px] text-slate-400 font-normal">{opt.desc}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Download PPTX */}
          <button
            onClick={() => downloadDeckAsPPTX(deck)}
            className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-white hover:bg-emerald-500/40 transition-all"
            title="Muat Turun PowerPoint (.pptx)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white transition-all"
            title="Mod Skrin Penuh (Tekan F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500 hover:text-white transition-all"
            title="Tutup Pembentangan (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN SLIDE PRESENTATION CANVAS AREA */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-2 xs:p-3 sm:p-6 md:p-8 overflow-hidden bg-gradient-to-b from-slate-950 via-[#031517] to-slate-950">
        
        {/* GRID OVERLAY SELECTOR MODAL */}
        <AnimatePresence>
          {showGrid && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl p-6 sm:p-10 overflow-y-auto"
            >
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Grid className="w-5 h-5 text-emerald-400" />
                    <span>Pilih Slaid Pembentangan</span>
                  </h3>
                  <button
                    onClick={() => setShowGrid(false)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                  >
                    Tutup Grid
                  </button>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {deck.slides.map((s, idx) => (
                    <button
                      key={s.id || idx}
                      onClick={() => {
                        goToSlide(idx);
                        setShowGrid(false);
                      }}
                      className={`relative aspect-video rounded-xl p-3 border text-left flex flex-col justify-between transition-all group overflow-hidden ${
                        idx === currentSlideIndex
                          ? 'border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : 'border-white/10 bg-slate-900/80 hover:border-emerald-500/50 hover:bg-slate-800'
                      }`}
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={s.title} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${s.bgColor || 'from-slate-900 to-slate-950'} opacity-80`} />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[10px] font-black bg-slate-950/80 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          #{idx + 1}
                        </span>
                      </div>
                      <p className="relative z-10 text-[11px] font-black text-white line-clamp-2 uppercase">
                        {s.title || `Slaid ${idx + 1}`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE SLIDE DISPLAY FRAME WITH STRICT 16:9 FIT-TO-SCREEN ASPECT RATIO */}
        <AnimatePresence mode="popLayout" custom={slideDirection}>
          {currentSlide && (
            <motion.div
              key={currentSlideIndex}
              custom={slideDirection}
              variants={slideVariants[transitionStyle] as any}
              initial="initial"
              animate="animate"
              exit="exit"
              className="aspect-[16/9] w-full max-w-[calc((100vh-130px)*16/9)] max-h-[calc(100vh-130px)] bg-slate-950 rounded-xl xs:rounded-2xl sm:rounded-3xl border border-emerald-500/40 shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between mx-auto my-auto"
            >
              {/* IF UPLOADED / ORIGINAL SLIDE IMAGE AND VALID: DISPLAY 100% PURE UNTOUCHED SLIDE VISUAL */}
              {hasValidImage ? (
                <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-950 overflow-hidden">
                  <img 
                    src={currentSlide.imageUrl} 
                    alt={currentSlide.title || 'Slaid Asli'} 
                    className="w-full h-full object-contain pointer-events-none select-none"
                    onError={() => {
                      if (currentSlide?.id) {
                        setImgLoadErrors(prev => ({ ...prev, [currentSlide.id]: true }));
                      }
                    }} 
                  />
                  {/* Floating slide page indicator */}
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 pointer-events-none">
                    <span className="text-[9px] sm:text-xs font-mono font-bold text-emerald-300 bg-slate-950/85 px-2.5 py-1 rounded-full border border-emerald-500/30 shadow-xl backdrop-blur-md">
                      {currentSlideIndex + 1} / {totalSlides}
                    </span>
                  </div>
                </div>
              ) : (
                /* TEMPLATE SLIDE RENDERING (FOR SYSTEM-GENERATED DECKS) */
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentSlide.bgColor || 'from-[#031d1f] via-[#082e31] to-[#041618]'} z-0`} />

                  {/* SLIDE HEADER & BRANDING */}
                  <div className="relative z-10 flex items-center justify-between border-b border-white/10 p-3 xs:p-4 sm:p-6 pb-1.5 xs:pb-2 sm:pb-3 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="text-[8px] xs:text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-300">
                        iPDS Slide Presentation Mode
                      </span>
                    </div>
                    <span className="text-[9px] xs:text-[10px] sm:text-xs font-mono font-bold text-slate-400 bg-slate-950/60 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-white/10">
                      {currentSlideIndex + 1} / {totalSlides}
                    </span>
                  </div>

                  {/* SLIDE MAIN CONTENT BODY */}
                  <div className="relative z-10 my-auto p-3 xs:p-4 sm:p-6 md:p-8 lg:p-10 py-1 sm:py-3 max-w-5xl w-full flex-1 flex flex-col justify-center overflow-y-auto scrollbar-hide">
                    <motion.h1 
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="text-xs xs:text-sm sm:text-2xl md:text-3xl lg:text-4xl font-black text-white uppercase tracking-wide leading-tight mb-1 xs:mb-2 sm:mb-3 drop-shadow-md"
                    >
                      {currentSlide.title}
                    </motion.h1>

                    {currentSlide.content && (
                      <motion.div 
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="text-[10px] xs:text-xs sm:text-base md:text-lg lg:text-xl text-emerald-100 font-medium whitespace-pre-line leading-relaxed bg-slate-950/50 p-2 xs:p-3 sm:p-5 rounded-lg sm:rounded-2xl border border-white/10 backdrop-blur-md shadow-inner overflow-y-auto max-h-full"
                      >
                        {currentSlide.content}
                      </motion.div>
                    )}
                  </div>

                  {/* SLIDE FOOTER */}
                  <div className="relative z-10 flex items-center justify-between border-t border-white/10 p-3 xs:p-4 sm:p-6 pt-1.5 xs:pt-2 sm:pt-3 text-[8px] xs:text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0">
                    <span>{deck.author || 'iPDS Corporate'}</span>
                    <span>Sistem Pengurusan Data Ladang Terpimpin</span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SPEAKER NOTES BOTTOM DRAWER */}
        <AnimatePresence>
          {showNotes && currentSlide?.notes && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-4 left-4 right-4 sm:left-12 sm:right-12 z-40 bg-teal-950/95 border border-teal-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 mb-2 text-teal-300 font-black text-xs uppercase tracking-wider border-b border-teal-500/30 pb-1.5">
                <FileText className="w-4 h-4" />
                <span>Nota Pembentang (Speaker Notes)</span>
              </div>
              <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed">
                {currentSlide.notes}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM SLIDE CONTROLS BAR */}
      <div className="bg-slate-900/95 border-t border-emerald-500/30 px-4 py-3 flex items-center justify-between z-50">
        {/* Previous Slide Button */}
        <button
          onClick={prevSlide}
          disabled={currentSlideIndex === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-white font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 hover:text-slate-950 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Slaid Sebelum</span>
        </button>

        {/* Slide Progress Indicator */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide max-w-[200px] xs:max-w-xs sm:max-w-md px-2">
          {deck.slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-2.5 rounded-full transition-all ${
                idx === currentSlideIndex 
                  ? 'w-8 bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]' 
                  : 'w-2.5 bg-slate-700 hover:bg-slate-500'
              }`}
              title={`Pergi ke slaid ${idx + 1}`}
            />
          ))}
        </div>

        {/* Next Slide Button */}
        <button
          onClick={nextSlide}
          disabled={currentSlideIndex === totalSlides - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <span className="hidden xs:inline">Slaid Seterusnya</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
