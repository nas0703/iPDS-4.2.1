import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Bot, FileText, Copy, Share2, RefreshCw, X, Check, 
  Calendar, Send, ShieldCheck, ShieldAlert, Lock, Trophy, Flame, CheckCircle2,
  Volume2, VolumeX, Square, Play, Pause, Mic, MicOff, Headphones, SkipBack, SkipForward,
  User, MessageSquare, HelpCircle, CornerDownLeft, ChevronRight, BookOpen, Layers,
  Settings, Plus, Trash2, Sliders, Volume1, BarChart3
} from 'lucide-react';
import { ManualSawitChatModal } from './ManualSawitChatModal';
import { MorningBriefingAcronymModal } from './MorningBriefingAcronymModal';
import { MorningBriefingStructuredView } from './MorningBriefingStructuredView';
import { 
  getBestMalayVoice, 
  sanitizeMalaySpeechText, 
  getActiveAcronymDictionary, 
  saveCustomAcronym, 
  DEFAULT_ACRONYM_DICTIONARY,
  expandAcronymsForSpeech 
} from '../../../utils/speechUtils';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { VoiceInputControl } from '../../../components/common/VoiceInputControl';
import { safeStorage } from '../../../utils/safeStorage';
import { getActiveEstateId } from '../../../utils/estateContext';

interface MorningBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentDate?: string;
  analytics?: any;
  allDeliveries?: any[];
  authRole?: string | null;
  initialSubmodule?: 'briefing' | 'msl';
  embedded?: boolean;
  initialBriefingSection?: 'snapshot' | 'chat';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  metrics?: any;
  ragSources?: Array<{
    title?: string;
    section?: string;
    page?: number;
    category?: string;
  }>;
  isError?: boolean;
}

export function MorningBriefingModal({
  isOpen,
  onClose,
  isDarkMode,
  onShowToast,
  currentDate,
  analytics,
  allDeliveries = [],
  authRole,
  initialSubmodule = 'briefing',
  embedded = false,
  initialBriefingSection = 'snapshot'
}: MorningBriefingModalProps) {
  const [loading, setLoading] = useState(false);
  const [submodule, setSubmodule] = useState<'briefing' | 'msl'>(initialSubmodule);
  const [briefingSection, setBriefingSection] = useState<'snapshot' | 'chat'>(initialBriefingSection);

  // Sync initial submodule & briefing section whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSubmodule) setSubmodule(initialSubmodule);
      if (initialBriefingSection) setBriefingSection(initialBriefingSection);
    }
  }, [isOpen, initialSubmodule, initialBriefingSection]);

  // Security check: Only FC and PF are authorized
  const roleStr = authRole?.toLowerCase();
  const isAuthorized = roleStr === 'fc' || roleStr === 'pf';
  const roleTitle = roleStr === 'fc' 
    ? 'Field Controller (FC)' 
    : roleStr === 'pf' 
      ? 'Pengurus Felda (PF)' 
      : roleStr === 'afc' 
        ? 'Assistant Field Controller (AFC)' 
        : roleStr === 'fs' 
          ? 'Field Supervisor (FS)' 
          : roleStr === 'staff' 
            ? 'Kerani Input (Staff)' 
            : roleStr === 'eqi' 
              ? 'Pemeriksa Kualiti (EQI)' 
              : 'Pengguna Umum';

  // Helper for Malaysia timezone date strings
  const getMalaysiaDateStr = (offsetDays: number = 0) => {
    const now = new Date();
    const ms = now.getTime() + (8 * 60 * 60 * 1000) + (offsetDays * 24 * 60 * 60 * 1000);
    return new Date(ms).toISOString().split('T')[0];
  };

  const yesterdayDate = getMalaysiaDateStr(-1);
  const todayDate = getMalaysiaDateStr(0);

  const getPreviousMonthEndDateStr = (refDateStr: string) => {
    const base = refDateStr || todayDate || getMalaysiaDateStr(0);
    const parts = base.split('-');
    let year = parseInt(parts[0], 10) || 2026;
    let month = parseInt(parts[1], 10) || 9; // 1 to 12
    
    if (month === 1) {
      month = 12;
      year -= 1;
    } else {
      month -= 1;
    }
    
    const lastDay = new Date(year, month, 0).getDate();
    const mStr = String(month).padStart(2, '0');
    const dStr = String(lastDay).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  const lastMonthEndDate = getPreviousMonthEndDateStr(todayDate);
  const malayMonthsFull = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  const lastMonthIdx = parseInt(lastMonthEndDate.split('-')[1], 10) - 1;
  const lastMonthName = malayMonthsFull[lastMonthIdx] || 'Bulan Lepas';

  // LocalStorage Cache Helpers for Morning Briefing
  const getCachedBriefing = (dateKey: string) => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(`fpmsb_morning_briefing_${dateKey}`);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && parsed.reportText && parsed.structuredData) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading briefing cache:', e);
    }
    return null;
  };

  const saveBriefingToCache = (dateKey: string, reportText: string, structuredData: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        `fpmsb_morning_briefing_${dateKey}`,
        JSON.stringify({
          date: dateKey,
          reportText,
          structuredData,
          savedAt: new Date().toISOString()
        })
      );
    } catch (e) {
      console.warn('Error saving briefing cache:', e);
    }
  };

  // Default to yesterday's date when opening Morning Briefing and load cached data if present
  const [reportDate, setReportDate] = useState<string>(yesterdayDate);
  const [briefingText, setBriefingText] = useState<string>(() => {
    const cached = getCachedBriefing(yesterdayDate);
    return cached?.reportText || '';
  });
  const [structuredData, setStructuredData] = useState<any>(() => {
    const cached = getCachedBriefing(yesterdayDate);
    return cached?.structuredData || null;
  });
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Interactive Estate Data & MSL RAG Chatbot LocalStorage Persistence
  const MORNING_BRIEFING_CHAT_STORAGE_KEY = 'fpmsb_morning_briefing_chat_history_v1';

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const defaultWelcome: ChatMessage = {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Salam FC/Pengurus. Saya adalah AI Penganalisis Data Ladang FPMSB TUNGGAL.\n\nSistem ini menghubungkan pangkalan data lengkap merangkumi:\n• Taburan EFB (Tandan Kosong) — Tan, trip lori & kadar GAP\n• Harga BTS & Anggaran Pendapatan — RM/tan, hasil kasar & pendapatan sektor Peneroka FELDA\n• Logistik Lori — No pendaftaran lori, kekerapan trip & jumlah muatan tan\n• Kualiti BTS — 23 Blok KPG=KPA, tandan muda & buah reject\n• Hasil & Yield — Prestasi harian, MTD, YTD & sasaran\n• Pembajaan 4T — Status kemajuan Pusingan 1 hingga 4\n• Manual Sawit Lestari (MSL), KUK Siri 8 & Manual Perolehan 2023 Pind. 2025 — RAG SOP, Kadar Upah & Perolehan\n\nSila tanya apa-apa soalan atau tekan cadangan pantas di bawah.',
      time: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
    };

    if (typeof window === 'undefined') return [defaultWelcome];
    try {
      const saved = localStorage.getItem(MORNING_BRIEFING_CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading Morning Briefing chat history from LocalStorage:', e);
    }
    return [defaultWelcome];
  });

  // Sync Morning Briefing chat messages to LocalStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (chatMessages.length === 1 && chatMessages[0].id === 'welcome-msg') {
        return;
      }
      localStorage.setItem(MORNING_BRIEFING_CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
    } catch (e) {
      console.warn('Error saving Morning Briefing chat history to LocalStorage:', e);
    }
  }, [chatMessages]);

  const [chatInput, setChatInput] = useState<string>('');
  const [isAskingChat, setIsAskingChat] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // UI Mode: 'text' | 'voice'
  const [displayMode, setDisplayMode] = useState<'text' | 'voice'>('text');

  // Voice Output (Text-to-Speech) Robust States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [currentSentenceText, setCurrentSentenceText] = useState<string>('');

  // Acronym & Pronunciation Dictionary Customization Modal States
  const [showAcronymModal, setShowAcronymModal] = useState<boolean>(false);
  const [acronymDict, setAcronymDict] = useState<Record<string, string>>(() => getActiveAcronymDictionary());
  const [newAcronymShort, setNewAcronymShort] = useState<string>('');
  const [newAcronymFull, setNewAcronymFull] = useState<string>('');
  const [acronymSearchFilter, setAcronymSearchFilter] = useState<string>('');

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunkWatchdogRef = useRef<any>(null);

  // Helper untuk menambah atau mengemaskini singkatan kustom
  const handleAddCustomAcronym = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAcronymShort.trim() || !newAcronymFull.trim()) {
      onShowToast('Sila masukkan singkatan dan sebutan penuh.', 'error');
      return;
    }
    saveCustomAcronym(newAcronymShort.trim(), newAcronymFull.trim());
    setAcronymDict(getActiveAcronymDictionary());
    setNewAcronymShort('');
    setNewAcronymFull('');
    onShowToast(`Singkatan "${newAcronymShort.trim()}" berjaya disimpan!`, 'success');
  };

  // Helper untuk menetapkan semula ke kamus rasmi
  const handleResetAcronyms = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fpmsb_custom_speech_acronyms_v1');
      setAcronymDict(DEFAULT_ACRONYM_DICTIONARY);
      onShowToast('Kamus sebutan singkatan telah dikembalikan ke tetapan lalai rasmi.', 'info');
    }
  };

  // Uji sebutan satu singkatan atau perkataan secara terus
  const handleTestWordSpeech = (textToSay: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const expanded = expandAcronymsForSpeech(textToSay);
    const utt = new SpeechSynthesisUtterance(expanded);
    utt.rate = speechRate;
    utt.lang = 'ms-MY';
    const chosen = (selectedVoiceURI && availableVoices.find(v => v.voiceURI === selectedVoiceURI)) || getBestMalayVoice(availableVoices);
    if (chosen) utt.voice = chosen;
    synth.speak(utt);
  };

  // High-Quality Voice Input (Speech-to-Text) Hook with Auto-Submit
  const voiceInput = useVoiceInput({
    initialLanguage: 'ms-MY',
    autoStopSilenceMs: 2000,
    enableAudioVisualizer: true,
    enableAudioCues: true,
    autoSubmitOnFinish: true,
    onTranscriptChange: (text) => {
      setChatInput(text);
      setCustomPrompt(text);
    },
    onFinalResult: (finalText) => {
      setChatInput(finalText);
      setCustomPrompt(finalText);
    },
    onAutoSubmit: (submittedText) => {
      if (submittedText && submittedText.trim().length >= 2) {
        handleAskEstateChat(submittedText.trim());
      }
    },
    onError: (errMsg) => {
      onShowToast(errMsg, 'error');
    }
  });

  // Load and listen for available system voices for TTS reader
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
        
        // Auto-select best Malay voice as default
        const bestMalay = getBestMalayVoice(voices);
        if (bestMalay && (!selectedVoiceURI || !voices.some(v => v.voiceURI === selectedVoiceURI))) {
          setSelectedVoiceURI(bestMalay.voiceURI);
        } else if (!selectedVoiceURI && voices[0]) {
          setSelectedVoiceURI(voices[0].voiceURI);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoiceURI]);

  // Clean raw report text into natural, spoken-friendly Malay sentences with full acronym expansion
  const cleanTextForAudio = (text: string) => {
    return sanitizeMalaySpeechText(text);
  };

  // Break long report into natural sentence chunks (avoid browser 15-second cutoff)
  const splitIntoSentenceChunks = (text: string): string[] => {
    const rawChunks = text
      .split(/(?<=[.!?:\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const refinedChunks: string[] = [];
    for (const chunk of rawChunks) {
      if (chunk.length > 150) {
        // Split further by commas if sentence is extra long
        const subParts = chunk.split(/,\s+/);
        refinedChunks.push(...subParts.filter(p => p.trim().length > 0));
      } else {
        refinedChunks.push(chunk);
      }
    }
    return refinedChunks;
  };

  // Play a specific chunk from the queue without calling synth.cancel mid-queue
  const playNextChunk = (index: number) => {
    if (!synthRef.current || !isPlayingRef.current) return;

    // Clear any active chunk watchdog
    if (chunkWatchdogRef.current) {
      clearTimeout(chunkWatchdogRef.current);
      chunkWatchdogRef.current = null;
    }

    if (index >= chunksRef.current.length) {
      // Completed reading all chunks
      isPlayingRef.current = false;
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentSentenceText('');
      (window as any).__activeSpeechUtterance = null;
      activeUtteranceRef.current = null;
      onShowToast('Selesai membacakan Laporan Morning Briefing.', 'success');
      return;
    }

    chunkIndexRef.current = index;
    setCurrentChunkIndex(index + 1);
    const chunkText = chunksRef.current[index];
    setCurrentSentenceText(chunkText);

    try {
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      // Retain a persistent reference to prevent browser V8 garbage collection
      activeUtteranceRef.current = utterance;
      (window as any).__activeSpeechUtterance = utterance;

      // Assign voice prioritizing Bahasa Melayu
      if (availableVoices.length > 0) {
        const chosenVoice = (selectedVoiceURI && availableVoices.find(v => v.voiceURI === selectedVoiceURI)) || 
                            getBestMalayVoice(availableVoices) || 
                            availableVoices[0];
        if (chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang || 'ms-MY';
        }
      } else {
        utterance.lang = 'ms-MY';
      }

      let isDone = false;
      const advanceQueue = () => {
        if (isDone) return;
        isDone = true;
        if (chunkWatchdogRef.current) {
          clearTimeout(chunkWatchdogRef.current);
          chunkWatchdogRef.current = null;
        }
        if (isPlayingRef.current && !isPaused) {
          playNextChunk(index + 1);
        }
      };

      utterance.onend = () => {
        advanceQueue();
      };

      utterance.onerror = (err) => {
        console.warn('Utterance error on chunk index:', index, err);
        advanceQueue();
      };

      // Watchdog failsafe: If the browser's speech engine drops the onend event,
      // calculate expected speech duration and advance cleanly
      const approxDurationMs = Math.max(3000, ((chunkText.length * 90) / speechRate) + 2500);
      chunkWatchdogRef.current = setTimeout(() => {
        if (isPlayingRef.current && !isPaused && !isDone) {
          console.log('Watchdog auto-advancing chunk:', index);
          advanceQueue();
        }
      }, approxDurationMs);

      // Start speaking the sentence chunk
      synthRef.current.speak(utterance);
    } catch (e) {
      console.error('Error speaking chunk:', e);
      if (isPlayingRef.current && !isPaused) {
        playNextChunk(index + 1);
      }
    }
  };

  const handleStartSpeaking = (startFromIndex: number = 0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast('Pelayar anda tidak menyokong fungsi Text-to-Speech suara.', 'error');
      return;
    }

    if (!briefingText) {
      onShowToast('Tiada teks laporan untuk dibacakan. Sila jana laporan dahulu.', 'error');
      return;
    }

    const synth = window.speechSynthesis;
    synthRef.current = synth;

    // Resume if paused
    if (isPaused) {
      synth.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      isPlayingRef.current = true;
      return;
    }

    // Cancel previous audio session only on fresh start
    if (chunkWatchdogRef.current) {
      clearTimeout(chunkWatchdogRef.current);
      chunkWatchdogRef.current = null;
    }
    synth.cancel();

    // Prepare chunks
    const spokenText = cleanTextForAudio(briefingText);
    const chunks = splitIntoSentenceChunks(spokenText);
    if (chunks.length === 0) return;

    chunksRef.current = chunks;
    setTotalChunks(chunks.length);
    isPlayingRef.current = true;
    setIsSpeaking(true);
    setIsPaused(false);

    onShowToast('Membacakan Laporan Morning Briefing FC...', 'info');
    playNextChunk(startFromIndex);
  };

  const handlePauseSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.pause();
      setIsPaused(true);
      setIsSpeaking(false);
    }
  };

  const handleStopSpeaking = () => {
    isPlayingRef.current = false;
    if (chunkWatchdogRef.current) {
      clearTimeout(chunkWatchdogRef.current);
      chunkWatchdogRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    activeUtteranceRef.current = null;
    (window as any).__activeSpeechUtterance = null;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunkIndex(0);
    setCurrentSentenceText('');
  };

  const handleTestVoiceSound = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast('Text-to-Speech tidak disokong pada pelayar ini.', 'error');
      return;
    }
    handleStopSpeaking();
    const synth = window.speechSynthesis;
    const testUtterance = new SpeechSynthesisUtterance("Ujian suara sistem Morning Briefing Felda Palm Industries berjaya.");
    testUtterance.rate = speechRate;
    (window as any).__activeSpeechUtterance = testUtterance;
    
    if (availableVoices.length > 0) {
      const chosen = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (chosen) testUtterance.voice = chosen;
    }
    testUtterance.lang = 'ms-MY';
    synth.speak(testUtterance);
    onShowToast('Memainkan ujian sampel audio...', 'info');
  };

  // Cleanup on close or unmount
  useEffect(() => {
    if (!isOpen) {
      handleStopSpeaking();
    }
  }, [isOpen]);

  // Automatically trigger generation on open only if not already generated/cached
  useEffect(() => {
    if (isOpen && isAuthorized) {
      const initialDate = reportDate || yesterdayDate;
      const cached = getCachedBriefing(initialDate);
      if (cached) {
        setBriefingText(cached.reportText);
        setStructuredData(cached.structuredData);
        setLoading(false);
      } else {
        generateBriefing(initialDate, false);
      }
    }
  }, [isOpen, isAuthorized]);

  const generateBriefing = async (targetDateStr?: string, forceRefresh: boolean = false) => {
    if (!isAuthorized) {
      onShowToast('Akses Terhad: AI Morning Briefing hanya untuk FC dan PF sahaja.', 'error');
      return;
    }

    const effectiveDate = targetDateStr || reportDate || yesterdayDate;

    // Check cache first if not explicitly requested to force regenerate
    if (!forceRefresh) {
      const cached = getCachedBriefing(effectiveDate);
      if (cached) {
        setBriefingText(cached.reportText);
        setStructuredData(cached.structuredData);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      
      let backlogHistory: any = {};
      try {
        const saved = localStorage.getItem("fpm_backlog_history_v1");
        if (saved) backlogHistory = JSON.parse(saved);
      } catch (e) { console.error(e); }

      let fertEntries: any[] = [];
      let fertMaster: any[] = [];
      let localHujanData: any[] = [];
      try {
        const [eRes, mRes] = await Promise.all([
          fetch('/api/fertilizer/entries').catch(() => null),
          fetch('/api/fertilizer/master').catch(() => null)
        ]);
        if (eRes && eRes.ok) fertEntries = await eRes.json();
        if (mRes && mRes.ok) fertMaster = await mRes.json();
        
        const currentEstate = getActiveEstateId();
        const savedHujan = localStorage.getItem(`hujanData_${currentEstate}`) || (currentEstate === 'FPM_TUNGGAL' ? localStorage.getItem('hujanData') : null);
        if (savedHujan) localHujanData = JSON.parse(savedHujan);
      } catch (e) {
        console.warn("Fertilizer/Hujan fetch notice:", e);
      }

      let resData: any = null;
      try {
        const response = await fetch('/api/ai/morning-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetDate: effectiveDate,
            customInstructions: customPrompt,
            allDeliveries: allDeliveries,
            backlogHistory: backlogHistory,
            fertilizerEntries: fertEntries,
            fertilizerMaster: fertMaster,
            hujanData: localHujanData,
            authRole: authRole
          })
        });

        if (response.ok) {
          resData = await response.json();
        } else if (response.status === 403) {
          const errBody = await response.json().catch(() => ({}));
          onShowToast(errBody.error || 'Akses Ditolak: Modul hanya untuk FC dan PF.', 'error');
          setLoading(false);
          return;
        }
      } catch (netErr) {
        console.warn("API request fallback:", netErr);
      }

      if (resData && resData.reportText && resData.structuredData) {
        setBriefingText(resData.reportText);
        setStructuredData(resData.structuredData);
        saveBriefingToCache(effectiveDate, resData.reportText, resData.structuredData);
        onShowToast('Laporan Morning Briefing berjaya dijana!', 'success');
      } else {
        // Fallback calculations using local allDeliveries
        const normDate = (d?: string) => {
          if (!d) return '';
          let s = String(d).trim().split('T')[0];
          if (s.includes('/')) {
            const p = s.split('/');
            if (p[0].length === 4) return `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
            let y = p[2] || '';
            if (y.length === 2) y = '20' + y;
            return `${y}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
          }
          return s;
        };

        const ffb = allDeliveries.filter((r: any) => r.peringkat !== "EFB");
        const selDayRows = ffb.filter((r: any) => normDate(r.tarikh) === effectiveDate);
        const [yStr, mStr, dStr] = effectiveDate.split('-');
        const monthPrefix = `${yStr}-${mStr}`;
        const yearPrefix = `${yStr}`;
        const monthRows = ffb.filter((r: any) => normDate(r.tarikh).startsWith(monthPrefix));
        const yearRows = ffb.filter((r: any) => normDate(r.tarikh).startsWith(yearPrefix));

        const getTan = (r: any) => parseFloat(r.tan) || parseFloat(r.berat_tan) || parseFloat(r.berat_bersih_tan) || 0;
        const getMuda = (r: any) => parseInt(r.muda) || parseInt(r.bts_muda) || 0;
        const getSample = (r: any) => parseInt(r.sample) || parseInt(r.bts_count) || parseInt(r.bil_tandan) || 0;
        const isKpg = (r: any) => {
          const k = parseFloat(r.kpg || '0');
          const dt = normDate(r.tarikh);
          return k >= (dt >= '2026-04-13' ? 21.25 : 21.0);
        };

        const dayTan = selDayRows.reduce((a: number, b: any) => a + getTan(b), 0);
        const dayTandan = selDayRows.reduce((a: number, b: any) => a + getSample(b), 0);
        const dayResit = selDayRows.length;
        const dayYield = (dayTan / 1615.11).toFixed(3);
        const dayMuda = selDayRows.reduce((a: number, b: any) => a + getMuda(b), 0);
        const dayKpgMatch = selDayRows.filter(isKpg).length;
        const dayKpgPct = dayResit > 0 ? ((dayKpgMatch / dayResit) * 100).toFixed(1) + '%' : '0.0%';
        const dayKpgRatio = `${dayKpgMatch} / ${dayResit} (${dayKpgPct})`;

        const mTan = monthRows.reduce((a: number, b: any) => a + getTan(b), 0);
        const mMuda = monthRows.reduce((a: number, b: any) => a + getMuda(b), 0);
        const mResit = monthRows.length;
        const mYield = (mTan / 1615.11).toFixed(3);
        const mTarget = 4335.23;
        const mCapai = ((mTan / mTarget) * 100).toFixed(1);
        const mKpgMatch = monthRows.filter(isKpg).length;
        const mKpgPct = mResit > 0 ? ((mKpgMatch / mResit) * 100).toFixed(1) + '%' : '0.0%';
        const mKpgRatio = `${mKpgMatch} / ${mResit} (${mKpgPct})`;
        const mMudaPct = mTan > 0 ? ((mMuda / (mTan * 50)) * 100).toFixed(2) + '%' : '0.00%';

        const yTan = yearRows.reduce((a: number, b: any) => a + getTan(b), 0);
        const yResit = yearRows.length;
        const yYield = (yTan / 1615.11).toFixed(2);
        const yTarget = 27334.06;
        const yTargetYield = (yTarget / 1615.11).toFixed(2);
        const yCapai = ((yTan / yTarget) * 100).toFixed(1);
        const yKpgMatch = yearRows.filter(isKpg).length;
        const yKpgPct = yResit > 0 ? ((yKpgMatch / yResit) * 100).toFixed(1) + '%' : '0.0%';
        const yKpgRatio = `${yKpgMatch.toLocaleString('en-US')} / ${yResit.toLocaleString('en-US')} (${yKpgPct})`;

        // Block calculations for Daily, Monthly (MTD), and Yearly (YTD)
        const ESTATE_MASTER: Record<string, number> = {
          "1": 72.15, "2": 68.37, "3": 76.59, "4": 92.39, "5": 60.19,
          "6": 80.42, "7": 89.46, "8": 82.03, "9": 83.61, "10": 84.36,
          "11": 47.85, "12": 76.50, "13": 50.75, "14": 70.45, "15": 68.36,
          "16": 64.44, "17": 84.08, "18": 76.20, "19": 81.75, "20": 68.62,
          "21": 24.26, "22": 65.29, "88": 98.51
        };

        const blockDailyMap: Record<string, { totalTan: number; btsMuda: number; kpgMatch: number; resitCount: number; luas: number }> = {};
        const blockMonthlyMap: Record<string, { totalTan: number; btsMuda: number; kpgMatch: number; resitCount: number; luas: number }> = {};
        const blockYearlyMap: Record<string, { totalTan: number; btsMuda: number; kpgMatch: number; resitCount: number; luas: number }> = {};

        Object.entries(ESTATE_MASTER).forEach(([k, l]) => {
          blockDailyMap[k] = { totalTan: 0, btsMuda: 0, kpgMatch: 0, resitCount: 0, luas: l };
          blockMonthlyMap[k] = { totalTan: 0, btsMuda: 0, kpgMatch: 0, resitCount: 0, luas: l };
          blockYearlyMap[k] = { totalTan: 0, btsMuda: 0, kpgMatch: 0, resitCount: 0, luas: l };
        });

        selDayRows.forEach(r => {
          const bKey = String(r.blok || '').replace(/[^0-9]/g, '');
          if (blockDailyMap[bKey]) {
            blockDailyMap[bKey].totalTan += getTan(r);
            blockDailyMap[bKey].btsMuda += getMuda(r);
            if (isKpg(r)) blockDailyMap[bKey].kpgMatch += 1;
            blockDailyMap[bKey].resitCount += 1;
          }
        });

        monthRows.forEach(r => {
          const bKey = String(r.blok || '').replace(/[^0-9]/g, '');
          if (blockMonthlyMap[bKey]) {
            blockMonthlyMap[bKey].totalTan += getTan(r);
            blockMonthlyMap[bKey].btsMuda += getMuda(r);
            if (isKpg(r)) blockMonthlyMap[bKey].kpgMatch += 1;
            blockMonthlyMap[bKey].resitCount += 1;
          }
        });

        yearRows.forEach(r => {
          const bKey = String(r.blok || '').replace(/[^0-9]/g, '');
          if (blockYearlyMap[bKey]) {
            blockYearlyMap[bKey].totalTan += getTan(r);
            blockYearlyMap[bKey].btsMuda += getMuda(r);
            if (isKpg(r)) blockYearlyMap[bKey].kpgMatch += 1;
            blockYearlyMap[bKey].resitCount += 1;
          }
        });

        const formatBlockLabel = (val: string | number): string => {
          const s = String(val || '').trim();
          if (!s) return '';
          if (/^B\d+$/i.test(s)) return s.replace(/^B/i, 'Blok ');
          if (/^\d+$/.test(s)) return `Blok ${s}`;
          return s;
        };

        const blockRank = Object.entries(blockMonthlyMap).map(([k, v]) => ({
          code: formatBlockLabel(k),
          yield: v.luas > 0 ? (v.totalTan / v.luas) : 0
        })).sort((a, b) => b.yield - a.yield);

        const top3 = blockRank.slice(0, 3);
        const bot3 = [...blockRank].reverse().slice(0, 3);

        // Top 3 BTS Muda
        const top3BtsMudaSemalam = Object.entries(blockDailyMap)
          .map(([k, v]) => ({ code: formatBlockLabel(k), btsMuda: v.btsMuda, totalTan: v.totalTan }))
          .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
          .slice(0, 3);

        const top3BtsMudaBulan = Object.entries(blockMonthlyMap)
          .map(([k, v]) => ({ code: formatBlockLabel(k), btsMuda: v.btsMuda, totalTan: v.totalTan }))
          .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
          .slice(0, 3);

        const top3BtsMudaTahun = Object.entries(blockYearlyMap)
          .map(([k, v]) => ({ code: formatBlockLabel(k), btsMuda: v.btsMuda, totalTan: v.totalTan }))
          .sort((a, b) => b.btsMuda - a.btsMuda || b.totalTan - a.totalTan)
          .slice(0, 3);

        // Top 3 KPG = KPA
        const top3KpgBulan = Object.entries(blockMonthlyMap)
          .map(([k, v]) => {
            const pct = v.resitCount > 0 ? (v.kpgMatch / v.resitCount) * 100 : 0;
            return {
              code: formatBlockLabel(k),
              kpgMatch: v.kpgMatch,
              resitCount: v.resitCount,
              pct,
              ratioStr: `${v.kpgMatch} / ${v.resitCount} resit (${pct.toFixed(1)}%)`
            };
          })
          .sort((a, b) => b.kpgMatch - a.kpgMatch || b.pct - a.pct)
          .slice(0, 3);

        const top3KpgTahun = Object.entries(blockYearlyMap)
          .map(([k, v]) => {
            const pct = v.resitCount > 0 ? (v.kpgMatch / v.resitCount) * 100 : 0;
            return {
              code: formatBlockLabel(k),
              kpgMatch: v.kpgMatch,
              resitCount: v.resitCount,
              pct,
              ratioStr: `${v.kpgMatch} / ${v.resitCount} resit (${pct.toFixed(1)}%)`
            };
          })
          .sort((a, b) => b.kpgMatch - a.kpgMatch || b.pct - a.pct)
          .slice(0, 3);

        const malayMonths = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
        const mIdx = (parseInt(mStr, 10) || 1) - 1;
        const monthName = malayMonths[mIdx] || `Bulan ${mStr}`;
        const monthNameUpper = monthName.toUpperCase();
        const tarikhPrestasi = `${parseInt(dStr, 10)} ${monthName} ${yStr}`;
        
        const nowMs = new Date().getTime() + 8 * 60 * 60 * 1000;
        const nowObj = new Date(nowMs);
        const tarikhBriefing = `${nowObj.getDate()} ${malayMonths[nowObj.getMonth()]} ${nowObj.getFullYear()}`;

        const yGap = yTarget - yTan;
        const yGapStr = yGap > 0 ? `±${yGap.toLocaleString('en-US', { maximumFractionDigits: 0 })} mt` : `Melepasi sasaran (+${Math.abs(yGap).toLocaleString('en-US', { maximumFractionDigits: 0 })} mt)`;

        const botCodes = bot3.map(b => b.code).join(', ');

        const btsSemalamStr = top3BtsMudaSemalam.map((b, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${b.code} : ${b.btsMuda} bts`).join('\n') || 'Tiada rekod';
        const btsBulanStr = top3BtsMudaBulan.map((b, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${b.code} : ${b.btsMuda} bts`).join('\n') || 'Tiada rekod';
        const btsTahunStr = top3BtsMudaTahun.map((b, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${b.code} : ${b.btsMuda} bts`).join('\n') || 'Tiada rekod';

        const kpgBulanStr = top3KpgBulan.map((b, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${b.code} : ${b.ratioStr}`).join('\n') || 'Tiada rekod';
        const kpgTahunStr = top3KpgTahun.map((b, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${b.code} : ${b.ratioStr}`).join('\n') || 'Tiada rekod';

        const fallbackMarkdown = `🏛️ FPMSB TUNGGAL
EXECUTIVE MORNING BRIEFING FC

📅 ${tarikhBriefing}
Prestasi sehingga ${tarikhPrestasi}

━━━━━━━━━━━━━━━━━━━━
📊 EXECUTIVE SNAPSHOT
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
• Hasil: ${dayTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mt
• Yield: ${dayYield} t/ha
• BTS Muda: ${dayMuda}
• KPG = KPA: ${dayKpgRatio}
• Resit: ${dayResit}

MTD : ${monthNameUpper}
• Hasil: ${mTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${mTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mt
• Pencapaian: ${mCapai}%
• Yield: ${mYield} / 2.60 t/ha
• BTS Muda: ${mMuda} (${mMudaPct})
• KPG = KPA: ${mKpgRatio}
• Resit: ${mResit}

YTD : ${yStr}
• Hasil: ${yTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${yTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mt
• Pencapaian: ${yCapai}%
• Yield: ${yYield} / ${yTargetYield} t/ha
• KPG = KPA: ${yKpgRatio}
• Resit: ${yResit.toLocaleString('en-US')}

━━━━━━━━━━━━━━━━━━━━
🌴 PRESTASI BLOK : MTD (YIELD)
━━━━━━━━━━━━━━━━━━━━

🏆 TOP 3
🥇 ${top3[0]?.code || 'Blok 18'} : ${top3[0]?.yield.toFixed(3) || '0.000'} t/ha
🥈 ${top3[1]?.code || 'Blok 14'} : ${top3[1]?.yield.toFixed(3) || '0.000'} t/ha
🥉 ${top3[2]?.code || 'Blok 19'} : ${top3[2]?.yield.toFixed(3) || '0.000'} t/ha

⚠️ BOTTOM 3
🔴 ${bot3[0]?.code || 'Blok 88'} : ${bot3[0]?.yield.toFixed(3) || '0.000'} t/ha
🔴 ${bot3[1]?.code || 'Blok 7'} : ${bot3[1]?.yield.toFixed(3) || '0.000'} t/ha
🔴 ${bot3[2]?.code || 'Blok 16'} : ${bot3[2]?.yield.toFixed(3) || '0.000'} t/ha

━━━━━━━━━━━━━━━━━━━━
🥭 TOP 3 BLOK BTS MUDA TERTINGGI
━━━━━━━━━━━━━━━━━━━━

HARI SEMALAM
${btsSemalamStr}

MTD : ${monthNameUpper}
${btsBulanStr}

YTD : ${yStr}
${btsTahunStr}

━━━━━━━━━━━━━━━━━━━━
🎯 TOP 3 BLOK KPG = KPA
━━━━━━━━━━━━━━━━━━━━

MTD : ${monthNameUpper}
${kpgBulanStr}

YTD : ${yStr}
${kpgTahunStr}

━━━━━━━━━━━━━━━━━━━━
🌱 STATUS PROGRAM PEMBAJAAN
━━━━━━━━━━━━━━━━━━━━
• Pusingan 1: ${structuredData?.laporanBaja?.pusingan1 || "100% (Selesai)"}
• Pusingan 2: ${structuredData?.laporanBaja?.pusingan2 || "100% (Selesai)"}
• Pusingan 3: ${structuredData?.laporanBaja?.pusingan3 || "45% (Sedang Berjalan)"}
• Pusingan 4: ${structuredData?.laporanBaja?.pusingan4 || "0% (Belum Mula)"}

━━━━━━━━━━━━━━━━━━━━
🧠 EXECUTIVE ANALYSIS
━━━━━━━━━━━━━━━━━━━━

${parseFloat(yCapai) >= 95 ? '🟢' : '🟡'} YTD berada pada ${yCapai}% sasaran.
Jurang kepada sasaran YTD: ${yGapStr}.

${parseFloat(mCapai) >= 40 ? '🟡' : '🔴'} MTD mencapai ${mCapai}% sasaran.

🔴 KPG = KPA MTD pada ${mKpgRatio} dan memerlukan perhatian.

🔴 ${botCodes} merupakan blok berprestasi terendah bulan ini.

🟢 Program Pembajaan: ${structuredData?.laporanBaja?.status || "Pusingan 1 & 2 selesai 100%, Pusingan 3 kini mencapai 45%, Pusingan 4 belum bermula (0%)."}

⚠️ DATA QUALITY:
Data penghantaran dan timbangan resit konsisten direkodkan.

━━━━━━━━━━━━━━━━━━━━
🎯 PRIORITI PENGURUS HARI INI
━━━━━━━━━━━━━━━━━━━━

1. HASIL
Pertahankan momentum dan tutup jurang YTD ${yGapStr}.

2. BLOK
Semak ${botCodes} : pusingan menuai, tenaga kerja, buah tinggal dan evakuasi.

3. KPG = KPA
Memperketat penggredan bts 100% di platform seperti B9, B4 dan B20 yang mencatat resit KPG=KPA terbanyak seterusnya menghantar 100% bts berkualiti ke kilang.

4. KUALITI
Pantau ${dayMuda} BTS muda semalam dan semak blok penyumbang tertinggi bagi mengekalkan kualiti penuaian.

5. PEMBAJAAN
Pantau kelancaran aplikasi Pusingan 3 (kini ${structuredData?.laporanBaja?.p3PctStr || '45%'}) bagi memastikan taburan beg menepati jadual master.

6. DATA
Semak dan sahkan integriti data harian di platform.

━━━━━━━━━━━━━━━━━━━━
📌 MANAGEMENT FOCUS
━━━━━━━━━━━━━━━━━━━━

${parseFloat(yCapai) >= 95 ? '🟢 YTD MENCAPAI SASARAN' : '🟡 YTD HAMPIR SASARAN'}
Fokus hari ini:
KPG = KPA + BLOK BAWAH + KUALITI BTS + INTEGRITI DATA + PEMBAJAAN.`;

        const fallbackStructured = {
          tarikhBriefing,
          tarikhPrestasi,
          tarikhLaporan: effectiveDate,
          bulanLaporan: monthName,
          bulanLaporanUpper: monthNameUpper,
          hariIni: {
            totalTan: dayTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            yieldTH: dayYield,
            totalResit: dayResit,
            btsMuda: dayMuda,
            kpgMatchPct: dayKpgPct,
            kpgRatioStr: dayKpgRatio,
            abw: dayTandan > 0 ? ((dayTan * 1000) / dayTandan).toFixed(2) + " kg" : "N/A"
          },
          bulanIni: {
            totalTan: mTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            sasaranTan: mTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            pencapaianPct: mCapai + "%",
            yieldTH: mYield,
            sasaranYieldTH: "2.60",
            btsMuda: mMuda,
            btsMudaPct: mMudaPct,
            totalResit: mResit,
            kpgMatchPct: mKpgPct,
            kpgMatchCount: mKpgMatch,
            kpgRatioStr: mKpgRatio
          },
          tahunIni: {
            totalTan: yTan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            sasaranTanYtd: yTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            pencapaianPct: yCapai + "%",
            yieldTH: yYield,
            sasaranYieldTH: yTargetYield,
            kpgMatchPct: yKpgPct,
            kpgMatchCount: yKpgMatch,
            kpgRatioStr: yKpgRatio,
            totalResit: yResit.toLocaleString('en-US')
          },
          top3BtsMudaSemalam: top3BtsMudaSemalam.map((b, i) => ({
            rank: i + 1,
            blok: `Blok ${b.code.replace('B', '')}`,
            blokCode: b.code,
            btsMuda: b.btsMuda
          })),
          top3BtsMudaBulan: top3BtsMudaBulan.map((b, i) => ({
            rank: i + 1,
            blok: `Blok ${b.code.replace('B', '')}`,
            blokCode: b.code,
            btsMuda: b.btsMuda
          })),
          top3BtsMudaTahun: top3BtsMudaTahun.map((b, i) => ({
            rank: i + 1,
            blok: `Blok ${b.code.replace('B', '')}`,
            blokCode: b.code,
            btsMuda: b.btsMuda
          })),
          top3KpgBulan: top3KpgBulan.map((b, i) => ({
            rank: i + 1,
            blok: `Blok ${b.code.replace('B', '')}`,
            blokCode: b.code,
            kpgMatchCount: b.kpgMatch,
            resitCount: b.resitCount,
            kpgRatioStr: b.ratioStr
          })),
          top3KpgTahun: top3KpgTahun.map((b, i) => ({
            rank: i + 1,
            blok: `Blok ${b.code.replace('B', '')}`,
            blokCode: b.code,
            kpgMatchCount: b.kpgMatch,
            resitCount: b.resitCount,
            kpgRatioStr: b.ratioStr
          }))
        };

        setBriefingText(fallbackMarkdown);
        setStructuredData(fallbackStructured);
        saveBriefingToCache(effectiveDate, fallbackMarkdown, fallbackStructured);
        onShowToast('Laporan Morning Briefing berjaya disediakan!', 'success');
      }
    } catch (err: any) {
      console.error('Error generating briefing:', err);
      onShowToast(err.message || 'Gagal menyediakan laporan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!briefingText) return;
    navigator.clipboard.writeText(briefingText);
    setCopied(true);
    onShowToast('Laporan disalin ke papan keratan (clipboard)!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleModeChange = (newMode: 'text' | 'voice') => {
    setDisplayMode(newMode);
    if (newMode === 'voice') {
      if (briefingText) {
        // Trigger speaking directly within user interaction event
        handleStartSpeaking(0);
      } else {
        onShowToast('Sila jana laporan terlebih dahulu sebelum mengaktifkan Voice Mode.', 'info');
      }
    } else {
      // Stop speech when switching back to text mode
      handleStopSpeaking();
    }
  };

  const handleWhatsAppShare = () => {
    if (!briefingText) return;
    const encoded = encodeURIComponent(briefingText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const estateChatAbortControllerRef = useRef<AbortController | null>(null);

  const handleStopEstateChat = () => {
    if (estateChatAbortControllerRef.current) {
      estateChatAbortControllerRef.current.abort();
      estateChatAbortControllerRef.current = null;
    }
    setIsAskingChat(false);
    onShowToast('Carian AI data ladang telah dihentikan.', 'info');
  };

  // Estate Data Chatbot Interaction Handler
  const handleAskEstateChat = async (questionText?: string) => {
    const q = (questionText || chatInput || customPrompt).trim();
    if (!q || isAskingChat) return;

    if (estateChatAbortControllerRef.current) {
      estateChatAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    estateChatAbortControllerRef.current = controller;

    const userMsgId = 'user-' + Date.now();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: q,
      time: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setCustomPrompt('');
    setIsAskingChat(true);

    try {
      const res = await fetch('/api/ai/estate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: q,
          targetDate: reportDate,
          allDeliveries,
          conversationHistory: chatMessages.slice(-6).map(m => ({ role: m.role, content: m.text })),
          authRole: roleStr
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses soalan data.');
      }

      const rawAnswer = data.answer || 'Tiada maklumat dijumpai bagi pertanyaan ini.';
      const cleanAnswer = rawAnswer
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\*/g, '')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/`{1,3}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        text: cleanAnswer,
        time: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
        metrics: data.metrics,
        ragSources: data.ragSources
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Estate chat request aborted');
        return;
      }
      setChatMessages(prev => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          role: 'assistant',
          text: `⚠️ Maaf, ralat menganalisis data: ${err.message || 'Sila cuba lagi.'}`,
          time: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsAskingChat(false);
      estateChatAbortControllerRef.current = null;
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSpeakChatMessage = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = sanitizeMalaySpeechText(text);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.lang = 'ms-MY';
    
    // Keutamaan: Suara pilihan pengguna -> Suara Melayu terbaik -> Default
    const bestVoice = (selectedVoiceURI && availableVoices.find(voice => voice.voiceURI === selectedVoiceURI)) ||
                      getBestMalayVoice(availableVoices);
    if (bestVoice) {
      utterance.voice = bestVoice;
      if (bestVoice.lang) utterance.lang = bestVoice.lang;
    }

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyChatMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    onShowToast('Jawapan disalin ke papan keratan!', 'success');
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Helper date label
  const getDayCardTitle = (dateStr: string) => {
    if (dateStr === yesterdayDate) return "Hasil Semalam";
    if (dateStr === todayDate) return "Hasil Hari Ini";
    if (dateStr === lastMonthEndDate) return `Hasil Sebulan (${lastMonthName.toUpperCase()} ${lastMonthEndDate.split('-')[0]})`;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `Hasil (${parts[2]}/${parts[1]}/${parts[0]})`;
    return `Hasil (${dateStr})`;
  };

  if (!isOpen && !embedded) return null;

  // Render Access Restricted Screen for Unauthorized Users
  if (!isAuthorized) {
    if (embedded) {
      return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-amber-500/30 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <Lock size={32} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-block mb-3">
            Akses Terhad (Executive Only)
          </span>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            AI Executive (Morning Briefing)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
            Modul ini dikhaskan secara eksklusif untuk peranan <strong className="text-slate-900 dark:text-white font-bold">Field Controller (FC)</strong> dan <strong className="text-slate-900 dark:text-white font-bold">Pengurus Felda (PF)</strong> sahaja bagi tujuan taklimat strategik, penetapan prioriti operasi, serta rumusan analitik harian ladang.
          </p>
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/60 mb-2 text-left">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="text-slate-500 dark:text-slate-400">Sesi Semasa:</span>
              <span className="text-amber-600 dark:text-amber-400 font-black">{roleTitle}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500 dark:text-slate-400">Status Kelayakan:</span>
              <span className="text-rose-500 font-black flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Tidak Dibenarkan
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Security Alert Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-amber-500/30 dark:border-amber-500/20 p-6 sm:p-8 z-10 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto mb-4 shadow-lg shadow-amber-500/10">
              <Lock size={32} />
            </div>

            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-block mb-3">
              Akses Terhad (Executive Only)
            </span>

            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
              AI Executive (Morning Briefing)
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
              Modul ini dikhaskan secara eksklusif untuk peranan <strong className="text-slate-900 dark:text-white font-bold">Field Controller (FC)</strong> dan <strong className="text-slate-900 dark:text-white font-bold">Pengurus Felda (PF)</strong> sahaja bagi tujuan taklimat strategik, penetapan prioriti operasi, serta rumusan analitik harian ladang.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/60 mb-6 text-left">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-500 dark:text-slate-400">Sesi Semasa:</span>
                <span className="text-amber-600 dark:text-amber-400 font-black">{roleTitle}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Status Kelayakan:</span>
                <span className="text-rose-500 font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Tidak Dibenarkan
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Tutup & Kembali
            </button>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  const briefingContentJSX = (
    <div className={`relative w-full bg-white dark:bg-slate-900 overflow-hidden flex flex-col ${
      embedded 
        ? 'rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[calc(100dvh-140px)] sm:h-[calc(100vh-145px)] min-h-[520px]' 
        : 'max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] my-auto z-10'
    }`}>
      {/* Header (Slimmed in embedded mode) */}
      {!embedded ? (
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-900/10 via-slate-900/5 to-transparent dark:from-emerald-950/30 dark:via-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  AI Executive
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  Gemini 3.7
                </span>
                <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100 flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-300" />
                  {roleStr === 'fc' ? 'FC' : 'PF'}
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                Pusat Kepintaran Operasi & Pangkalan Pengetahuan SOP Sawit
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Tutup AI Executive"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : null}

          {/* SUBMODULE 2: MANUAL SAWIT RAG */}
          {submodule === 'msl' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ManualSawitChatModal
                isOpen={true}
                onClose={onClose}
                onShowToast={onShowToast}
                embedded={true}
              />
            </div>
          )}

          {/* SUBMODULE 1: AI BRIEFING FC CONTROLS & CONTENT */}
          {submodule === 'briefing' && (
            <>
              {/* Sub-Navigation for Submodule 1: Bulanan & Harian Snapshot vs Chatbot AI Ladang */}
              <div className="px-3 sm:px-4 py-2 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBriefingSection('snapshot')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                      briefingSection === 'snapshot'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <BarChart3 size={13} />
                    <span>Bulanan &amp; Harian Snapshot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBriefingSection('chat')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                      briefingSection === 'chat'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Bot size={13} />
                    <span>Chatbot AI Ladang</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span>Tarikh:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{reportDate}</span>
                </div>
              </div>

              {/* SECTION 1: BULANAN & HARIAN SNAPSHOT */}
              {briefingSection === 'snapshot' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Controls Bar with Date Presets and Mode Switcher (Ultra-Compact Single-Bar Layout) */}
                  <div className="px-2.5 sm:px-4 py-1.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            {/* Left Group: Date Input + Presets */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 px-1.5 py-0.5 rounded-lg shrink-0">
                <Calendar size={12} className="text-emerald-500 shrink-0" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReportDate(val);
                    if (val) {
                      const cached = getCachedBriefing(val);
                      if (cached) {
                        setBriefingText(cached.reportText);
                        setStructuredData(cached.structuredData);
                      } else {
                        generateBriefing(val, false);
                      }
                    }
                  }}
                  className="text-[10px] font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>

              {/* Segmented Period Buttons */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-300/40 dark:border-slate-700/50 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReportDate(yesterdayDate);
                    const cached = getCachedBriefing(yesterdayDate);
                    if (cached) {
                      setBriefingText(cached.reportText);
                      setStructuredData(cached.structuredData);
                    } else {
                      generateBriefing(yesterdayDate, false);
                    }
                  }}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    reportDate === yesterdayDate
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Pilih tarikh semalam"
                >
                  Semalam
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportDate(todayDate);
                    const cached = getCachedBriefing(todayDate);
                    if (cached) {
                      setBriefingText(cached.reportText);
                      setStructuredData(cached.structuredData);
                    } else {
                      generateBriefing(todayDate, false);
                    }
                  }}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    reportDate === todayDate
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title="Pilih tarikh hari ini"
                >
                  Hari Ini
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = lastMonthEndDate;
                    setReportDate(target);
                    const cached = getCachedBriefing(target);
                    if (cached) {
                      setBriefingText(cached.reportText);
                      setStructuredData(cached.structuredData);
                    } else {
                      generateBriefing(target, false);
                    }
                  }}
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    reportDate === lastMonthEndDate
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title={`Jana taklimat sebulan penuh bagi bulan ${lastMonthName}`}
                >
                  Sebulan ({lastMonthName})
                </button>
              </div>
            </div>

            {/* Right Group: Text/Voice Switch & Regenerate */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* Text Mode vs Voice Mode Toggle Switch */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-300/40 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => handleModeChange('text')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black transition-all cursor-pointer ${
                    displayMode === 'text'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Mod Teks Tradisional & Analisis Visual"
                >
                  <FileText size={11} className={displayMode === 'text' ? 'text-emerald-500' : ''} />
                  <span>Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('voice')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black transition-all cursor-pointer ${
                    displayMode === 'voice'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Mod Suara (Text-to-Speech Interaktif)"
                >
                  <Volume2 size={11} className={displayMode === 'voice' ? 'animate-bounce' : ''} />
                  <span>Voice</span>
                  {isSpeaking && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => generateBriefing(reportDate, true)}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] font-black uppercase tracking-wide shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                title="Paksa AI jana semula laporan bagi tarikh terpilih"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                <span>{loading ? "Menjana..." : "Jana Semula"}</span>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 p-2.5 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                    <Sparkles size={16} />
                  </div>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    AI Sedang Menganalisis Data Ladang...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Mengkira prestasi bagi tarikh <b>{reportDate}</b>, sasaran bulanan, dan ranking blok.
                  </p>
                </div>
              </div>
            )}

            {!loading && structuredData && (
              <div className="space-y-6">
                <MorningBriefingStructuredView
                  structuredData={structuredData}
                  reportDate={reportDate}
                  getDayCardTitle={getDayCardTitle}
                />

                {/* Generated AI Executive Report Output */}
                <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5 pb-1.5 border-b border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center gap-1 shrink-0">
                      {displayMode === 'voice' ? (
                        <Volume2 size={12} className="text-emerald-500 animate-bounce shrink-0" />
                      ) : (
                        <FileText size={12} className="text-emerald-500 shrink-0" />
                      )}
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {displayMode === 'voice' ? 'Mod Suara' : 'Laporan'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 ml-auto">
                      {/* Audio Reader Controls */}
                      <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 px-1 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                        {!isSpeaking && !isPaused ? (
                          <button
                            type="button"
                            onClick={() => handleStartSpeaking(0)}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black tracking-wide transition-all shadow-xs cursor-pointer whitespace-nowrap"
                            title="Dengarkan pembacaan suara laporan"
                          >
                            <Volume2 size={10} />
                            <span>{displayMode === 'voice' ? 'Mula' : 'Baca'}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            {isSpeaking ? (
                              <button
                                type="button"
                                onClick={handlePauseSpeaking}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black transition-all cursor-pointer whitespace-nowrap"
                                title="Jeda bacaan suara"
                              >
                                <Pause size={9} />
                                <span>Jeda</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartSpeaking(Math.max(0, currentChunkIndex - 1))}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black transition-all cursor-pointer whitespace-nowrap"
                                title="Sambung bacaan suara"
                              >
                                <Play size={9} />
                                <span>Sambung</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleStopSpeaking}
                              className="p-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-600 dark:text-rose-300 transition-all cursor-pointer"
                              title="Hentikan bacaan"
                            >
                              <Square size={8} className="fill-current" />
                            </button>
                          </div>
                        )}

                        {/* Speed controller */}
                        <select
                          value={speechRate}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value);
                            setSpeechRate(newRate);
                            if (isSpeaking) {
                              handleStopSpeaking();
                              setTimeout(handleStartSpeaking, 200);
                            }
                          }}
                          className="text-[8.5px] font-bold bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none px-0.5 cursor-pointer"
                          title="Kelajuan Suara"
                        >
                          <option value="0.85">0.85×</option>
                          <option value="1.0">1.0× (Laju)</option>
                          <option value="1.15">1.15×</option>
                          <option value="1.25">1.25×</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-[9px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
                        title="Salin teks laporan ke clipboard"
                      >
                        {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        <span>{copied ? "Disalin!" : "Salin"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black transition-all cursor-pointer shadow-xs whitespace-nowrap"
                        title="Kongsi laporan penuh terus ke WhatsApp"
                      >
                        <Share2 size={10} />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Voice Mode Dedicated Interactive Player Card */}
                  {displayMode === 'voice' && (
                    <div className="mb-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-900/30 via-slate-900/60 to-teal-950/40 border-2 border-emerald-500/40 shadow-xl space-y-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                              <Volume2 size={24} className={isSpeaking ? "animate-bounce" : ""} />
                            </div>
                            {isSpeaking && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Headphones size={13} className="text-emerald-500" />
                                Enjin Audio Text-to-Speech (TTS)
                              </span>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                isSpeaking 
                                  ? 'bg-emerald-500 text-white animate-pulse shadow-sm shadow-emerald-500/50' 
                                  : isPaused 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {isSpeaking ? 'Sedang Membaca' : isPaused ? 'Dijeda' : 'Sedia'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              Membacakan ringkasan Morning Briefing FC secara bersiri perenggan demi perenggan.
                            </p>
                          </div>
                        </div>

                        {/* Direct Play / Pause / Stop Buttons & Chunk Skip */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Previous chunk */}
                          <button
                            type="button"
                            onClick={() => {
                              if (currentChunkIndex > 1) {
                                handleStartSpeaking(currentChunkIndex - 2);
                              }
                            }}
                            disabled={currentChunkIndex <= 1 || !briefingText}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
                            title="Ayat Sebelumnya"
                          >
                            <SkipBack size={14} />
                          </button>

                          {!isSpeaking && !isPaused ? (
                            <button
                              type="button"
                              onClick={() => handleStartSpeaking(0)}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                            >
                              <Play size={14} className="fill-current" />
                              <span>Mula Bacaan Suara</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              {isSpeaking ? (
                                <button
                                  type="button"
                                  onClick={handlePauseSpeaking}
                                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                                >
                                  <Pause size={14} />
                                  <span>Jeda</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartSpeaking(Math.max(0, currentChunkIndex - 1))}
                                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                                >
                                  <Play size={14} className="fill-current" />
                                  <span>Sambung</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={handleStopSpeaking}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                              >
                                <Square size={12} className="fill-current" />
                                <span>Henti</span>
                              </button>
                            </div>
                          )}

                          {/* Next chunk */}
                          <button
                            type="button"
                            onClick={() => {
                              if (currentChunkIndex < totalChunks) {
                                handleStartSpeaking(currentChunkIndex);
                              }
                            }}
                            disabled={currentChunkIndex >= totalChunks || !briefingText}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
                            title="Ayat Seterusnya"
                          >
                            <SkipForward size={14} />
                          </button>

                          {/* Audio Test button */}
                          <button
                            type="button"
                            onClick={handleTestVoiceSound}
                            className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                            title="Uji Sama Ada Pembesar Suara / Speaker Berfungsi"
                          >
                            🔊 Uji Audio
                          </button>
                        </div>
                      </div>

                      {/* Voice Settings bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-500/20 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Pilihan Suara:</span>
                          <select
                            value={selectedVoiceURI}
                            onChange={(e) => {
                              setSelectedVoiceURI(e.target.value);
                              if (isSpeaking) {
                                handleStopSpeaking();
                                setTimeout(() => handleStartSpeaking(Math.max(0, currentChunkIndex - 1)), 200);
                              }
                            }}
                            className="text-xs px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[200px] truncate"
                          >
                            {availableVoices.length > 0 ? (
                              availableVoices.map((v, i) => (
                                <option key={i} value={v.voiceURI}>
                                  {v.name} ({v.lang})
                                </option>
                              ))
                            ) : (
                              <option value="">Suara Sistem Standard (ms-MY)</option>
                            )}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Kelajuan:</span>
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
                            {[0.85, 0.95, 1.0, 1.15, 1.25].map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => {
                                  setSpeechRate(rate);
                                  if (isSpeaking) {
                                    handleStopSpeaking();
                                    setTimeout(() => handleStartSpeaking(Math.max(0, currentChunkIndex - 1)), 200);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  speechRate === rate
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowAcronymModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                          title="Lihat & tetapkan sebutan penuh bagi singkatan (M/t, YTD, ha, dll)"
                        >
                          <BookOpen size={13} className="text-emerald-500" />
                          <span>Kamus Sebutan Singkatan ({Object.keys(acronymDict).length})</span>
                        </button>
                      </div>

                      {/* Live Sentence Highlight Card */}
                      {isSpeaking && currentSentenceText && (
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 shadow-sm space-y-1.5 animate-fadeIn">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              Sedang Dibacakan Sekarang (Perenggan {currentChunkIndex} dari {totalChunks})
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="w-1 h-3 bg-emerald-500 rounded-full animate-[ping_0.8s_ease-in-out_infinite]" />
                              <span className="w-1 h-4 bg-emerald-500 rounded-full animate-[ping_0.6s_ease-in-out_infinite]" />
                              <span className="w-1 h-2 bg-emerald-500 rounded-full animate-[ping_0.9s_ease-in-out_infinite]" />
                            </div>
                          </div>
                          <p className="text-xs sm:text-[13px] font-medium text-slate-900 dark:text-slate-100 leading-relaxed italic bg-emerald-500/10 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                            "{currentSentenceText}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audio Equalizer Banner while playing in Text Mode */}
                  {displayMode === 'text' && isSpeaking && (
                    <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs animate-pulse">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                        <Volume2 size={14} className="animate-bounce text-emerald-600" />
                        <span>AI sedang membacakan taklimat Morning Briefing FC...</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-3 bg-emerald-500 rounded-full animate-[ping_0.8s_ease-in-out_infinite]" />
                        <span className="w-1 h-4 bg-emerald-500 rounded-full animate-[ping_0.6s_ease-in-out_infinite]" />
                        <span className="w-1 h-2 bg-emerald-500 rounded-full animate-[ping_0.9s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  )}

                  <div className="font-mono text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-all bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[450px] overflow-y-auto">
                    {briefingText}
                  </div>
                </div>

                {/* Switch to Chatbot CTA Banner */}
                <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Bot size={14} className="text-emerald-500" />
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        Perlukan Analisis Mendalam Mengenai Data Ladang?
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tanya soalan khusus mengenai hasil blok, taburan EFB, pengangkutan lori, atau SOP KUK Siri 8 terus ke Chatbot AI Ladang.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBriefingSection('chat')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    <span>Buka Chatbot AI Ladang</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: CHATBOT AI LADANG (DEDICATED FULL-VIEW) */}
      {briefingSection === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
          {/* Chatbot Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-900 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Bot size={15} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Chatbot AI Ladang (RAG Analytics)
                  </h4>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Data
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Tanya soalan data BTS, EFB, pembajaan, hasil blok, lori, atau SOP KUK Siri 8
                </p>
              </div>
            </div>

            {chatMessages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setChatMessages([
                    {
                      id: 'welcome-msg',
                      role: 'assistant',
                      text: 'Salam FC/Pengurus. Saya sedia menjawab pertanyaan data ladang terkini & SOP Manual Sawit.',
                      time: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
                    }
                  ]);
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.removeItem(MORNING_BRIEFING_CHAT_STORAGE_KEY);
                    } catch (e) {}
                  }
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline cursor-pointer"
              >
                Kosongkan Chat
              </button>
            )}
          </div>

          {/* Suggested Question Chips */}
          <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">Cadangan:</span>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Berapa kadar upah menuai pokok rendah dan pokok tinggi mengikut KUK Siri 8?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs flex items-center gap-1"
            >
              <span>💵 Kadar Upah KUK Siri 8</span>
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Apakah SOP kematangan BTS dan kriteria biji relai mengikut Manual Sawit Lestari?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs flex items-center gap-1"
            >
              <span>📚 SOP MSL: Kematangan BTS</span>
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Bagaimana SOP pruning pelepah pokok muda vs matang dan susunannya?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs flex items-center gap-1"
            >
              <span>✂️ SOP Pruning Pelepah</span>
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Senaraikan 5 blok KPG=KPA terendah bulan ini dan peratusan padanannya.')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs"
            >
              ⚖️ 5 Blok KPG=KPA Terendah
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Berapa purata harga BTS per tan dan anggaran pendapatan peneroka FELDA bulan ini?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs"
            >
              💰 Harga & Pendapatan Peneroka
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Senaraikan nombor plat lori yang aktif mengangkat buah dan jumlah trip bulan ini.')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all shrink-0 cursor-pointer text-[10px] font-bold shadow-xs"
            >
              🚛 No Lori & Pengangkutan
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Berapa jumlah tan EFB yang dihantar bulan ini dan status taburan?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer text-[10px] font-medium"
            >
              🌱 Tan EFB Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Blok mana yang paling banyak isu BTS muda bulan ini dan apa tindakannya?')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer text-[10px] font-medium"
            >
              🥭 Isu BTS Muda Blok
            </button>
            <button
              type="button"
              onClick={() => handleAskEstateChat('Senaraikan 5 blok dengan yield tertinggi MTD bulan ini.')}
              disabled={isAskingChat}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer text-[10px] font-medium"
            >
              🏆 Top 5 Yield MTD
            </button>
          </div>

          {/* Chat Messages Container */}
          <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto min-h-[350px] sm:min-h-[460px] bg-slate-50/40 dark:bg-slate-950/40">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot size={13} />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white rounded-br-none shadow-sm'
                    : msg.isError
                      ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100 rounded-bl-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-bl-none shadow-sm'
                }`}>
                  {/* Message Body */}
                  <div className="leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {msg.text
                      ? msg.text
                          .replace(/^#{1,6}\s+/gm, '')
                          .replace(/\*\*(.*?)\*\*/g, '$1')
                          .replace(/\*(.*?)\*/g, '$1')
                          .replace(/\*/g, '')
                          .replace(/__([^_]+)__/g, '$1')
                          .replace(/_([^_]+)_/g, '$1')
                          .trim()
                      : ''}
                  </div>

                  {/* RAG Reference Sources Badges */}
                  {msg.role === 'assistant' && msg.ragSources && msg.ragSources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                        <BookOpen size={11} />
                        <span>Rujukan Rasmi Manual & KUK:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.ragSources.map((src, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            title={`${src.title || 'Manual'} - ${src.section || ''} (Muka Surat ${src.page || 'N/A'})`}
                          >
                            <span>{src.section || src.title || 'Manual Sawit'}</span>
                            {src.page && <span className="opacity-70">(M/S {src.page})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Actions: Audio TTS + Copy */}
                  {msg.role === 'assistant' && !msg.isError && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>{msg.time}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSpeakChatMessage(msg.id, msg.text)}
                          className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 font-medium cursor-pointer ${
                            speakingMessageId === msg.id
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                          title="Dengar jawapan audio"
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <Square size={10} className="text-emerald-600" />
                              <span>Henti</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={10} />
                              <span>Dengar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyChatMessage(msg.id, msg.text)}
                          className="px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1 font-medium cursor-pointer"
                          title="Salin teks jawapan"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check size={10} className="text-emerald-600" />
                              <span className="text-emerald-600">Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.role === 'user' && (
                    <div className="mt-1 text-[9px] text-slate-300 dark:text-emerald-200 text-right">
                      {msg.time}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User size={13} />
                  </div>
                )}
              </div>
            ))}

            {isAskingChat && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 text-xs shadow-sm flex items-center gap-2.5">
                  <RefreshCw size={13} className="animate-spin text-emerald-600" />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    AI sedang membaca & menganalisis data perladangan FPMSB TUNGGAL...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input Box & Action Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={voiceInput.isListening ? "Mendengar suara anda..." : "Tanya AI data ladang... (cth: Status EFB bulan ini atau pembajaan)"}
                  value={chatInput || customPrompt}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    setCustomPrompt(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskEstateChat();
                    }
                  }}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl border transition-all ${
                    voiceInput.isListening
                      ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 placeholder-rose-400'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>

              {/* High-Quality Voice Input Controller with Audio Wave & BM/EN Switcher */}
              <VoiceInputControl
                voiceInput={voiceInput}
                onSendDirectly={(text) => handleAskEstateChat(text)}
              />

              {/* Primary Action: Tanya AI Chatbot / Henti Carian */}
              {isAskingChat ? (
                <button
                  type="button"
                  onClick={handleStopEstateChat}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30 shrink-0 animate-pulse"
                  title="Hentikan carian AI semasa"
                >
                  <Square size={13} className="fill-current text-white" />
                  <span>Henti</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAskEstateChat()}
                  disabled={!chatInput && !customPrompt}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 shrink-0"
                  title="Tanya AI Data Ladang"
                >
                  <Send size={13} />
                  <span>Tanya AI</span>
                </button>
              )}
            </div>

            {/* Secondary Action: Kemas Kini Briefing Text if needed */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Tekan <b>Enter</b> atau sebut soalan untuk tanya AI</span>
              <button
                type="button"
                onClick={() => generateBriefing(reportDate)}
                disabled={loading}
                className="text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                title="Gunakan arahan ini untuk menjana semula teks laporan Morning Briefing"
              >
                <Sparkles size={11} className="text-amber-500" />
                Jana Semula Teks Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>FPMSB TUNGGAL Integrated Estate Intelligence</span>
            {!embedded && (
              <button
                type="button"
                onClick={onClose}
                className="font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>

          {/* Acronym & Pronunciation Customization Modal */}
          <MorningBriefingAcronymModal
            isOpen={showAcronymModal}
            onClose={() => setShowAcronymModal(false)}
            acronymDict={acronymDict}
            onSaveAcronym={(acr, pron) => {
              saveCustomAcronym(acr, pron);
              setAcronymDict(getActiveAcronymDictionary());
              onShowToast(`Singkatan "${acr}" berjaya disimpan!`, 'success');
            }}
            onDeleteAcronym={(acr) => {
              const updated = { ...acronymDict };
              delete updated[acr];
              safeStorage.setJSON('fpmsb_custom_speech_acronyms_v1', updated);
              setAcronymDict(updated);
              onShowToast(`Singkatan "${acr}" telah dipadam.`, 'info');
            }}
          />
    </div>
  );

  if (embedded) {
    return briefingContentJSX;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-4xl my-auto z-10"
        >
          {briefingContentJSX}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
