import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { extractPdfTextClient } from '../../../utils/pdfExtractor';
import {
  BookOpen,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  Bookmark,
  Layers,
  FileText,
  Copy,
  Check,
  RefreshCw,
  X,
  ChevronRight,
  ChevronDown,
  Database,
  ShieldCheck,
  ExternalLink,
  UploadCloud,
  FileUp,
  AlertCircle,
  History,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  Lightbulb,
  HelpCircle,
  Compass,
  ArrowUpRight,
  SlidersHorizontal,
  Tag,
  CheckSquare,
  Menu,
  Bot,
  Zap,
  Square,
  Leaf
} from 'lucide-react';
import { MANUAL_SAWIT_KNOWLEDGE_BASE, ManualChunk } from '../../../data/manualSawitKnowledge';
import { THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE } from '../../../data/theOilPalmKnowledge';
import { MSL_FAQ_PROMPTS, MSL_FAQ_CATEGORIES, MslFaqPrompt } from '../../../data/mslFaqPrompts';
import { speakMalayText } from '../../../utils/speechUtils';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { VoiceInputControl } from '../../../components/common/VoiceInputControl';
import { WeedDosageCalculatorAndSop } from './WeedDosageCalculatorAndSop';
import { WeedVisionDiagnosis } from './WeedVisionDiagnosis';
import { RagBenchmarkView } from './RagBenchmarkView';
import { WEED_DATABASE, WeedMasterProfile } from '../../../data/weedDatabase';
import { Calculator, Camera, Printer, Image as ImageIcon, BarChart3 } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    manualTitle: string;
    sectionTitle: string;
    category: string;
    pageNumber: number;
    similarity: number;
  }[];
  timestamp: string;
  usedVectorDB?: boolean;
  isCached?: boolean;
  latencyMs?: number;
  numericalAccuracy?: number;
}

interface ChatSession {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface ManualSawitChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  embedded?: boolean;
}

import {
  CATEGORY_STRUCTURE,
  CATEGORIES,
  SUGGESTED_QUESTIONS,
  matchCategoryFilter,
} from '../helpers/manualSawitChat.helpers';
import {
  WeedSpecimenImageCard,
} from './WeedSpecimenImageCard';

const STORAGE_KEY = 'sawit_manual_chat_sessions_v1';
const ACTIVE_SESSION_KEY = 'sawit_manual_active_session_id';

const getInitialWelcomeMessage = (): Message => ({
  id: 'welcome',
  role: 'assistant',
  content: `Selamat datang ke **AI Pembantu Manual Sawit Lestari & SOP (RAG)**! 🌴📚

Sistem ini dihubungkan dengan pangkalan data dokumen dan bersedia untuk menjawab sebarang soalan berkaitan:
- ✂️ **Standard Kematangan BTS & Kutipan Biji Relai**
- 🌱 **Amalan 4T & Jadual Master Pembajaan**
- 🦉 **Pengurusan Perosak Bersepadu (IPM & Burung Hantu)**
- 🌊 **Piawaian MSPO & Zon Penampan Riparian**
- ⚖️ **Integriti Data Timbangan & Audit KPG = KPA**

Sila taip soalan anda atau pilih cadangan di bawah untuk memulakan carian.`,
  timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
});

const loadSavedChatSessions = (): ChatSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading chat history from LocalStorage:', e);
  }
  return [];
};

const getInitialSessionState = (loadedSessions: ChatSession[]) => {
  if (typeof window === 'undefined') {
    return {
      sessionId: `session-${Date.now()}`,
      messages: [getInitialWelcomeMessage()],
      category: 'Semua'
    };
  }

  try {
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (activeId) {
      const found = loadedSessions.find(s => s.id === activeId);
      if (found && found.messages && found.messages.length > 0) {
        return {
          sessionId: found.id,
          messages: found.messages,
          category: found.category || 'Semua',
          title: found.title
        };
      }
    }

    // Default to the latest saved session if available and has messages
    if (loadedSessions.length > 0) {
      const latest = loadedSessions[0];
      if (latest && latest.messages && latest.messages.length > 0) {
        return {
          sessionId: latest.id,
          messages: latest.messages,
          category: latest.category || 'Semua',
          title: latest.title
        };
      }
    }
  } catch (err) {
    console.warn('Error reading active session from LocalStorage:', err);
  }

  return {
    sessionId: `session-${Date.now()}`,
    messages: [getInitialWelcomeMessage()],
    category: 'Semua'
  };
};

export function ManualSawitChatModal({
  isOpen,
  onClose,
  onShowToast,
  embedded = false
}: ManualSawitChatModalProps) {
  // Load saved sessions immediately from LocalStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSavedChatSessions());
  
  // Initialize current session ID, messages, and category from LocalStorage
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const initial = getInitialSessionState(loadSavedChatSessions());
    return initial.sessionId;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const initial = getInitialSessionState(loadSavedChatSessions());
    return initial.messages;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const initial = getInitialSessionState(loadSavedChatSessions());
    return initial.category || 'Semua';
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'faq' | 'history' | 'knowledge' | 'calculator' | 'vision' | 'benchmark'>('chat');
  const [selectedWeedForCalc, setSelectedWeedForCalc] = useState<string>('asystasia-gangetica');
  const [showInChatCalculator, setShowInChatCalculator] = useState<boolean>(false);
  const [showInChatVision, setShowInChatVision] = useState<boolean>(false);
  const [visionInitialMode, setVisionInitialMode] = useState<'camera' | 'upload'>('camera');
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [mobileExpandedCategory, setMobileExpandedCategory] = useState<string | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
        setHoveredCategory(null);
      }
    };
    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // 22 Weed Dropdown State in Manual RAG
  const [showWeedListDropdown, setShowWeedListDropdown] = useState(false);
  const [weedDropdownSearch, setWeedDropdownSearch] = useState('');
  const weedDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (weedDropdownRef.current && !weedDropdownRef.current.contains(event.target as Node)) {
        setShowWeedListDropdown(false);
      }
    };
    if (showWeedListDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWeedListDropdown]);

  const formatWeedToRagResponse = (weed: WeedMasterProfile) => {
    const imageMarkdown = weed.imageUrl
      ? `\n\n![${weed.malayName} (${weed.scientificName})](${weed.imageUrl})\n*Gambar Spesimen Botani: ${weed.malayName} (${weed.scientificName})*\n`
      : '';

    return `### 🌿 Profil & Manual Rumpai Sawit: **${weed.malayName}**${imageMarkdown}

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

  const handleSelectWeedFromDropdown = (weed: WeedMasterProfile) => {
    setShowWeedListDropdown(false);
    setWeedDropdownSearch('');
    setSelectedWeedForCalc(weed.id);

    const content = formatWeedToRagResponse(weed);
    const now = new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: `user-weed-${Date.now()}`,
      role: 'user',
      content: `🌿 Maklumat & Kaedah Kawalan Rumpai: ${weed.malayName} (${weed.scientificName})`,
      timestamp: now
    };

    const assistantMsg: Message = {
      id: `bot-weed-${Date.now() + 1}`,
      role: 'assistant',
      content: content,
      timestamp: now,
      sources: [
        {
          manualTitle: 'Manual Kawalan Rumpai Sawit',
          sectionTitle: `${weed.malayName} (${weed.scientificName}) - Famili ${weed.family}`,
          category: 'Manual Rumpai Dan Kawalan',
          pageNumber: 1,
          similarity: 0.99
        }
      ]
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    onShowToast?.(`Memaparkan profil rasmi bagi ${weed.malayName}`, 'success');
  };

  // FAQ & Suggested Prompts States
  const [faqCategory, setFaqCategory] = useState<string>('Semua');
  const [faqSearchTerm, setFaqSearchTerm] = useState<string>('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [showFaqQuickDrawer, setShowFaqQuickDrawer] = useState<boolean>(false);

  // PDF Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('Manual Rumpai Dan Kawalan');
  const [dbUploadedDocs, setDbUploadedDocs] = useState<ManualChunk[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamically uploaded manuals from Supabase
  const loadDynamicManualsFromSupabase = async () => {
    try {
      const res = await fetch('/api/ai/search-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'semua rujukan manual', category: 'Semua' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.ragSources)) {
          // fetch and sync
        }
      }
    } catch (e) {
      console.warn("Could not load dynamic manuals:", e);
    }
  };

  useEffect(() => {
    loadDynamicManualsFromSupabase();
  }, []);

  // High-Quality Voice Input (Speech-to-Text) Hook with Soundwave, Auto-Submit & BM/EN Normalization
  const voiceInput = useVoiceInput({
    initialLanguage: 'ms-MY',
    autoStopSilenceMs: 2000,
    enableAudioVisualizer: true,
    enableAudioCues: true,
    autoSubmitOnFinish: true,
    onTranscriptChange: (text) => {
      setInputQuery(text);
    },
    onFinalResult: (finalText) => {
      setInputQuery(finalText);
    },
    onAutoSubmit: (submittedText) => {
      if (submittedText && submittedText.trim().length >= 2) {
        handleSendMessage(submittedText.trim());
      }
    },
    onError: (errMsg) => {
      onShowToast?.(errMsg, 'error');
    }
  });

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const handleSpeakAssistantMessage = (content: string, msgId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onShowToast?.('Pelayar tidak menyokong fungsi suara Text-to-Speech.', 'error');
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(msgId);
    speakMalayText(content, {
      rate: 0.98,
      onStart: () => setSpeakingMessageId(msgId),
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null)
    });
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync current active session and messages to LocalStorage whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, currentSessionId);
    } catch (e) {
      console.warn('Error saving active session ID:', e);
    }

    if (messages.length === 1 && messages[0].id === 'welcome') {
      return; // Do not save empty/unstarted sessions
    }

    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg
      ? (firstUserMsg.content.length > 45 ? `${firstUserMsg.content.substring(0, 45)}...` : firstUserMsg.content)
      : 'Sembang Manual Sawit';

    const now = new Date().toLocaleString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    setSessions(prev => {
      const existingIdx = prev.findIndex(s => s.id === currentSessionId);
      let updated: ChatSession[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          title: updated[existingIdx].title || title,
          category: selectedCategory,
          updatedAt: now,
          messages
        };
      } else {
        const newSession: ChatSession = {
          id: currentSessionId,
          title,
          category: selectedCategory,
          createdAt: now,
          updatedAt: now,
          messages
        };
        updated = [newSession, ...prev];
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving chat session to LocalStorage:', e);
      }
      return updated;
    });
  }, [messages, currentSessionId, selectedCategory]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([getInitialWelcomeMessage()]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, newId);
      } catch (e) {}
    }
    setActiveTab('chat');
    onShowToast?.('Sembang baru dimulakan', 'info');
  };

  const handleResumeSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages && session.messages.length > 0 ? session.messages : [getInitialWelcomeMessage()]);
    if (session.category) {
      setSelectedCategory(session.category);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
      } catch (e) {}
    }
    setActiveTab('chat');
    onShowToast?.(`Menyambung perbincangan: "${session.title}"`, 'info');
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error deleting session:', err);
    }

    if (currentSessionId === sessionId) {
      handleStartNewChat();
    }
    setDeleteConfirmId(null);
    onShowToast?.(`Sesi "${sessionToDelete?.title || 'Sembang'}" telah dipadamkan`, 'success');
  };

  const handleClearAllHistory = () => {
    setSessions([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (err) {
      console.error('Error clearing sessions:', err);
    }
    handleStartNewChat();
    setShowClearAllModal(false);
    onShowToast?.('Semua sejarah sembang telah dikosongkan', 'success');
  };

  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const handleStopSearch = () => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }
    setIsLoading(false);
    onShowToast?.('Carian AI Manual Sawit telah dihentikan.', 'info');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: `user`,
      content: query,
      timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const chatHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-3)
        .map(m => ({ role: m.role, content: (m.content || '').slice(0, 180) }));

      let data: any = null;
      try {
        const res = await fetch('/api/ai/manual-rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            question: query,
            category: selectedCategory,
            chatHistory
          })
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          console.log('Manual RAG search aborted by user');
          return;
        }
        console.warn('Backend RAG fetch notice:', fetchErr);
      }

      // If server returned data successfully
      if (data && data.answer) {
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
          usedVectorDB: data.usedVectorDB,
          isCached: data.data?.isCached || false,
          latencyMs: data.data?.latencyMs || 0,
          numericalAccuracy: data.data?.grounding?.numericalAccuracyRate ?? 100
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        // Intelligent client-side fallback across MANUAL_SAWIT_KNOWLEDGE_BASE
        const qLower = query.toLowerCase();
        const categoryMatches = selectedCategory && selectedCategory !== 'Semua'
          ? MANUAL_SAWIT_KNOWLEDGE_BASE.filter(k => matchCategoryFilter(k.category, selectedCategory, query))
          : MANUAL_SAWIT_KNOWLEDGE_BASE;
        
        const filtered = categoryMatches.length > 0 ? categoryMatches : MANUAL_SAWIT_KNOWLEDGE_BASE;

        const scored = filtered.map(item => {
          let score = 0;
          const fullText = `${item.manualTitle} ${item.sectionTitle} ${item.content} ${item.tags.join(' ')} ${item.category}`.toLowerCase();
          const words = qLower.split(/[\s,?.!]+/).filter(w => w.length > 2);
          words.forEach(w => {
            if (fullText.includes(w)) score += 3;
          });

          // Topic boosts
          if (qLower.includes('teres') || qLower.includes('backslope') || qLower.includes('stop bund') || qLower.includes('benteng hentian') || qLower.includes('inward slope') || (qLower.includes('bukit') && qLower.includes('cerun'))) {
            if (fullText.includes('teres kontur') || fullText.includes('spesifikasi pembinaan teres') || item.sectionTitle.toLowerCase().includes('teres')) {
              score += 200;
            }
          }
          if ((qLower.includes('jarak') || qLower.includes('kepadatan') || qLower.includes('linning') || qLower.includes('pembarisan') || qLower.includes('lubang tanam') || qLower.includes('holing')) && !qLower.includes('nursery') && !qLower.includes('semai')) {
            if (fullText.includes('jarak tanaman sawit') || fullText.includes('lubang tanaman') || fullText.includes('kepadatan pokok') || item.sectionTitle.toLowerCase().includes('jarak tanaman sawit')) {
              score += 150;
            }
          }
          if (qLower.includes('nursery') || qLower.includes('semai') || qLower.includes('tapak semaian') || qLower.includes('pre-nursery') || qLower.includes('main nursery') || qLower.includes('culling')) {
            if (item.category === 'Tapak Semaian' || fullText.includes('pre-nursery') || fullText.includes('main nursery') || fullText.includes('culling')) {
              score += 120;
            }
          }
          if (qLower.includes('parit') && fullText.includes('parit')) score += 100;
          if ((qLower.includes('parit') || qLower.includes('ukuran') || qLower.includes('dimensi') || qLower.includes('drain') || qLower.includes('saliran')) && (fullText.includes('parit') || fullText.includes('saliran') || fullText.includes('drain'))) score += 50;
          if ((qLower.includes('upah') || qLower.includes('kadar') || qLower.includes('gaji') || qLower.includes('bayaran')) && (fullText.includes('upah') || fullText.includes('kadar'))) score += 15;
          if ((qLower.includes('the oil palm') || qLower.includes('oil palm') || qLower.includes('oil palam') || qLower.includes('corley') || qLower.includes('tinker') || qLower.includes('5th edition') || qLower.includes('5th ed') || qLower.includes('bunch index') || qLower.includes('dry matter') || qLower.includes('dura') || qLower.includes('pisifera') || qLower.includes('tenera') || qLower.includes('avros') || qLower.includes('yangambi') || qLower.includes('ekona') || qLower.includes('frond 17')) && (fullText.includes('corley') || fullText.includes('the oil palm') || fullText.includes('dura') || fullText.includes('tenera') || fullText.includes('bunch index') || fullText.includes('dry matter'))) score += 180;
          if ((qLower.includes('perolehan') || qLower.includes('tender') || qLower.includes('sebut harga') || qLower.includes('lpo') || qLower.includes('pesanan belian') || qLower.includes('kontraktor') || qLower.includes('pembelian terus') || qLower.includes('had kuasa') || qLower.includes('grn') || qLower.includes('wjp') || qLower.includes('bon pelaksanaan')) && (fullText.includes('perolehan') || fullText.includes('tender') || fullText.includes('sebut harga') || fullText.includes('lpo') || fullText.includes('pesanan') || fullText.includes('kuasa'))) score += 18;
          if ((qLower.includes('matang') || qLower.includes('pokok matang') || qLower.includes('tuai')) && (fullText.includes('matang') || fullText.includes('penuaian'))) score += 8;
          if ((qLower.includes('pruning') || qLower.includes('pelepah')) && fullText.includes('pruning')) score += 10;
          if ((qLower.includes('baja') || qLower.includes('pembajaan') || qLower.includes('4t') || qLower.includes('lsu')) && fullText.includes('baja')) score += 10;
          if ((qLower.includes('efb') || qLower.includes('tandan kosong')) && fullText.includes('efb')) score += 8;
          if ((qLower.includes('relai') || qLower.includes('biji')) && fullText.includes('relai')) score += 8;

          return { ...item, score };
        }).sort((a, b) => b.score - a.score);

        const topMatches = scored.filter(s => s.score > 0).slice(0, 3);
        const topScore = topMatches[0]?.score || 0;
        // If top match is highly specific (e.g. score > 120), focus exclusively on high-relevance chunks to prevent noise
        const selectedMatches = topMatches.length > 0 
          ? (topScore > 120 ? topMatches.filter(m => m.score >= topScore * 0.60) : topMatches)
          : [scored[0] || MANUAL_SAWIT_KNOWLEDGE_BASE[0]];

        let fallbackContent = '';
        if (selectedMatches.length === 1) {
          const m = selectedMatches[0];
          fallbackContent = `### Jawapan & Spesifikasi Rasmi: ${m.sectionTitle}\n\n**Sumber:** ${m.manualTitle} (Kategori: *${m.category}*, Muka Surat ${m.pageNumber})\n\n${m.content}\n\n---\n*Rujukan rasmi Manual Sawit Lestari & Amalan Pertanian Baik (GAP).*`;
        } else {
          fallbackContent = `### Jawapan & Silang Rujuk Piawaian Berkaitan\n\n` +
            selectedMatches.map((m, idx) => `#### [Ruj ${idx + 1}] ${m.sectionTitle}\n*${m.manualTitle} (M/S ${m.pageNumber})*\n\n${m.content}`).join('\n\n---\n\n') +
            `\n\n---\n*Rujukan disaring dan disahkan daripada Pangkalan Pengetahuan Manual Sawit & SOP FPMSB.*`;
        }

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: fallbackContent,
          sources: selectedMatches.map((m, idx) => ({
            manualTitle: m.manualTitle,
            sectionTitle: m.sectionTitle,
            category: m.category,
            pageNumber: m.pageNumber,
            similarity: Number((0.92 - idx * 0.04).toFixed(2))
          })),
          timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
          usedVectorDB: false
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Harap maaf, tidak dapat memproses carian. Sila pilih soalan cadangan di bawah atau cuba lagi.',
        timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      searchAbortControllerRef.current = null;
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast?.('Jawapan disalin ke papan keratan', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || isUploading) return;

    // Snapshot fail dan reset input serta-merta untuk cegah re-trigger event berganda
    const fileList: File[] = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (e.target) e.target.value = '';

    setIsUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          onShowToast?.(`Fail ${file.name} bukan PDF yang sah`, 'warning');
          continue;
        }

        setUploadProgressText(`Memproses (${i + 1}/${fileList.length}): ${file.name}...`);

        try {
          setUploadProgressText(`Mengekstrak kandungan dokumen: ${file.name}...`);
          
          // 1. Ekstrak semua teks muka surat di sisi pelayar dengan Auto-OCR AI untuk fail imbasan (kebal dari had HTTP 413)
          const extractionResult = await extractPdfTextClient(file, {
            fileName: file.name,
            category: uploadCategory,
            onProgress: (current, total, customMsg) => {
              setUploadProgressText(customMsg || `Mengekstrak teks m/s ${current}/${total}: ${file.name}...`);
            }
          });

          const extractedPages = extractionResult.pages || [];
          const totalPages = extractionResult.totalPages || extractedPages.length || 1;

          if (extractedPages.length === 0) {
            onShowToast?.(`Fail ${file.name} tidak dapat dibaca oleh enjin OCR. Sila pastikan kualiti imej jelas.`, 'warning');
            continue;
          }

          // 2. Hantar muka surat dalam kelompok (batch) 15 muka surat setiap permintaan
          const BATCH_SIZE = 15;
          const totalBatches = Math.ceil(extractedPages.length / BATCH_SIZE);
          let fileSavedSuccessfully = true;

          for (let b = 0; b < totalBatches; b++) {
            const start = b * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, extractedPages.length);
            const batchPages = extractedPages.slice(start, end);

            setUploadProgressText(`Menyimpan m/s ${start + 1}-${end}/${extractedPages.length} ke Supabase...`);

            const requestBody = {
              fileName: file.name,
              category: uploadCategory,
              pages: batchPages,
              totalPages: totalPages,
              isFirstBatch: b === 0,
              batchIndex: b,
              totalBatches: totalBatches
            };

            const res = await fetch('/api/ai/ingest-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });

            let data: any = null;
            const resText = await res.text();
            try {
              data = JSON.parse(resText);
            } catch {
              data = { error: resText || 'Gagal membaca respon server' };
            }

            if (!res.ok) {
              fileSavedSuccessfully = false;
              console.error(`Upload batch error (${res.status}):`, data);
              onShowToast?.(data?.error || data?.details || `Ralat muat naik (${res.status})`, 'error');
              break;
            }
          }

          if (fileSavedSuccessfully) {
            successCount++;
          }
        } catch (err: any) {
          console.error(`Gagal muat naik ${file.name}:`, err);
          onShowToast?.(err?.message || `Gagal memproses fail ${file.name}`, 'error');
        }
      }
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (successCount > 0) {
      const targetTableName = (uploadCategory.toLowerCase().includes('the oil palm') || uploadCategory.toLowerCase().includes('corley') || uploadCategory.toLowerCase().includes('5th'))
        ? 'the_oil_palm_knowledge'
        : uploadCategory.toLowerCase().includes('rumpai') || uploadCategory.toLowerCase().includes('kawalan')
          ? 'manual_rumpai_knowledge'
          : (uploadCategory === 'Kadar Upah' || uploadCategory === 'Kadar Upah Kerja')
            ? 'kadar_upah_knowledge'
            : 'manual_sawit_knowledge';

      onShowToast?.(`Berjaya memproses ${successCount} fail PDF ke dalam jadual ${targetTableName} di Supabase!`, 'success');
      loadDynamicManualsFromSupabase();

      // Tambah notifikasi dalam chat
      const uploadSuccessMsg: Message = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        content: `🎉 **${successCount} Fail PDF Manual Berjaya Disimpan ke Supabase!**\n\nKandungan teks dan dos herbisid telah diekstrak dan disimpan terus ke dalam jadual \`${targetTableName}\` di Supabase untuk carian pintar RAG & imbasan AI lapangan.`,
        timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
        usedVectorDB: true
      };
      setMessages(prev => [...prev, uploadSuccessMsg]);
    }
  };

  const allManualItems: ManualChunk[] = [
    ...MANUAL_SAWIT_KNOWLEDGE_BASE,
    ...THE_OIL_PALM_5TH_EDITION_KNOWLEDGE_BASE.map(k => ({
      id: k.id,
      manualTitle: k.manualTitle,
      category: k.category,
      sectionTitle: `${k.chapter} - ${k.sectionTitle}`,
      pageNumber: k.pageNumber,
      content: k.content,
      tags: k.tags
    })),
    ...dbUploadedDocs
  ];

  const filteredKnowledge = allManualItems.filter(item => {
    const matchCat = matchCategoryFilter(item.category, selectedCategory);
    const matchSearch = searchTerm === '' || 
      item.sectionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchSearch;
  });

  const filteredSessions = sessions.filter(session => {
    if (!historySearchTerm.trim()) return true;
    const term = historySearchTerm.toLowerCase();
    const matchTitle = session.title.toLowerCase().includes(term);
    const matchMsg = session.messages.some(m => m.content.toLowerCase().includes(term));
    const matchCat = session.category.toLowerCase().includes(term);
    return matchTitle || matchMsg || matchCat;
  });

  const filteredFaqPrompts = MSL_FAQ_PROMPTS.filter(item => {
    const matchCat = faqCategory === 'Semua' || item.category === faqCategory;
    const term = faqSearchTerm.toLowerCase().trim();
    const matchSearch = !term || 
      item.title.toLowerCase().includes(term) ||
      item.query.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.badge.toLowerCase().includes(term) ||
      item.tags.some(t => t.toLowerCase().includes(term));
    return matchCat && matchSearch;
  });

  const handleSelectFaqPrompt = (prompt: MslFaqPrompt, autoSend = true) => {
    if (autoSend) {
      setActiveTab('chat');
      setShowFaqQuickDrawer(false);
      handleSendMessage(prompt.query);
    } else {
      setInputQuery(prompt.query);
      setActiveTab('chat');
      setShowFaqQuickDrawer(false);
      onShowToast?.('Prompt dimasukkan ke kotak input. Anda boleh edit sebelum tekan hantar.', 'info');
    }
  };

  const handleCopyFaqPrompt = (prompt: MslFaqPrompt) => {
    navigator.clipboard.writeText(prompt.query);
    setCopiedPromptId(prompt.id);
    onShowToast?.('Prompt disalin ke papan keratan', 'success');
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  if (!isOpen && !embedded) return null;

  const contentJSX = (
    <div className={`relative w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden ${
      embedded 
        ? 'h-full flex-1' 
        : 'max-w-5xl h-[95vh] sm:h-[92vh] max-h-[900px] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800'
    }`}>
      {/* 1. SLIDE-OVER SIDEBAR DRAWER (ChatGPT/Gemini Style) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs z-40 cursor-pointer"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-slate-950 text-slate-200 border-r border-slate-800/80 z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">AI Executive RAG</h3>
                    <p className="text-[10px] text-emerald-400 font-bold">Manual Sawit & SOP</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Start New Chat Primary Button */}
              <div className="p-3">
                <button
                  onClick={() => {
                    handleStartNewChat();
                    setIsSidebarOpen(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sembang Baru</span>
                </button>
              </div>

              {/* Sidebar Tabs */}
              <div className="px-3 flex gap-1 border-b border-slate-800 text-[11px] font-bold">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-2 rounded-t-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'chat'
                      ? 'text-emerald-400 border-b-2 border-emerald-400 font-black bg-slate-900/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Sejarah ({sessions.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('faq')}
                  className={`flex-1 py-2 rounded-t-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'faq'
                      ? 'text-amber-400 border-b-2 border-amber-400 font-black bg-slate-900/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>FAQ ({MSL_FAQ_PROMPTS.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`flex-1 py-2 rounded-t-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'knowledge'
                      ? 'text-emerald-400 border-b-2 border-emerald-400 font-black bg-slate-900/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Pustaka</span>
                </button>
              </div>

              {/* Sidebar List Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {activeTab === 'chat' && (
                  <>
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                        placeholder="Cari perbualan..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    {filteredSessions.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-500">Tiada perbualan disimpan</p>
                    ) : (
                      filteredSessions.map(session => {
                        const isActive = session.id === currentSessionId;
                        return (
                          <div
                            key={session.id}
                            onClick={() => {
                              handleResumeSession(session);
                              setIsSidebarOpen(false);
                            }}
                            className={`group p-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                              isActive
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200 font-bold'
                                : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/60 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate line-clamp-1">{session.title}</p>
                              <span className="text-[10px] text-slate-500 block">{session.updatedAt}</span>
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                              title="Padam"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {activeTab === 'faq' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Soalan Lazim MSL</p>
                    {MSL_FAQ_PROMPTS.slice(0, 12).map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => {
                          handleSelectFaqPrompt(prompt, true);
                          setIsSidebarOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-all block cursor-pointer"
                      >
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 mr-1.5">
                          {prompt.badge}
                        </span>
                        <span className="line-clamp-1">{prompt.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-dashed border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-850 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Muat Naik Dokumen PDF</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <p className="text-[11px] text-slate-400 pt-2 font-bold">Dokumen Dalam Vector DB:</p>
                    {MANUAL_SAWIT_KNOWLEDGE_BASE.slice(0, 8).map((k, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-900/60 text-xs text-slate-300 border border-slate-800/80">
                        <p className="font-bold text-slate-200 truncate">{k.sectionTitle}</p>
                        <span className="text-[10px] text-slate-500">M/S {k.pageNumber} • {k.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Database className="w-3 h-3" /> Supabase Vector RAG
                </span>
                <span className="font-mono">v2.4</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. MINIMALIST SINGLE-LINE HEADER BAR (Gemini / Claude Style) */}
      <div className="px-2.5 sm:px-4 py-1.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-1.5 shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="p-1 sm:px-2 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 transition-all cursor-pointer flex items-center gap-1"
            title="Buka Sejarah & Pustaka (Sidebar)"
          >
            <Menu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold hidden xs:inline">Menu</span>
            {sessions.length > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[8.5px] bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                {sessions.length}
              </span>
            )}
          </button>

          {/* Model Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10.5px] font-black">
            <Sparkles className="w-3 h-3" />
            <span>Gemini 3.7</span>
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <span className="hidden md:inline text-slate-700 font-mono">|</span>

          {/* Category Dropdown Pill */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] font-bold text-slate-200 transition-colors cursor-pointer shadow-xs"
              title="Pilih Kategori Panduan / Rujukan"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[210px] text-left">{selectedCategory}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {/* Category Dropdown Menu */}
            <AnimatePresence>
              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs"
                >
                  <div className="px-2.5 py-1 mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between">
                    <span>Pilihan Dokumen</span>
                    <span className="text-[9px] text-emerald-400 lowercase font-normal">hover untuk sub-tajuk</span>
                  </div>

                  <div className="space-y-1">
                    {CATEGORY_STRUCTURE.map(cat => {
                      const hasSub = Boolean(cat.subItems && cat.subItems.length > 0);
                      const isCatSelected = selectedCategory === cat.id;
                      const isSubSelected = cat.subItems?.some(s => s.id === selectedCategory);
                      const isHovered = hoveredCategory === cat.id;
                      const isExpanded = mobileExpandedCategory === cat.id;

                      return (
                        <div
                          key={cat.id}
                          className="relative"
                          onMouseEnter={() => {
                            if (hasSub) setHoveredCategory(cat.id);
                          }}
                          onMouseLeave={() => {
                            if (hasSub) setHoveredCategory(null);
                          }}
                        >
                          <div
                            className={`w-full rounded-lg font-bold transition-all flex items-center justify-between group cursor-pointer ${
                              isCatSelected
                                ? 'bg-emerald-600 text-white'
                                : isSubSelected
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                : isHovered
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (hasSub) {
                                  // Toggle sub-menu visibility
                                  setMobileExpandedCategory(prev => prev === cat.id ? null : cat.id);
                                  setHoveredCategory(prev => prev === cat.id ? null : cat.id);
                                } else {
                                  setSelectedCategory(cat.id);
                                  setShowCategoryDropdown(false);
                                  setHoveredCategory(null);
                                }
                              }}
                              className="flex-1 text-left px-3 py-2 flex items-center gap-2 cursor-pointer min-w-0"
                            >
                              {cat.id === 'Semua' ? (
                                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : cat.id.includes('KUK') || cat.id.includes('Upah') ? (
                                <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              <span className="truncate">{cat.name}</span>
                            </button>

                            {hasSub ? (
                              <div className="flex items-center pr-2 gap-1">
                                {isSubSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileExpandedCategory(prev => prev === cat.id ? null : cat.id);
                                    setHoveredCategory(prev => prev === cat.id ? null : cat.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-emerald-400 rounded-md cursor-pointer transition-colors"
                                  title="Papar sub-tajuk"
                                >
                                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isExpanded || isHovered ? 'rotate-90 sm:rotate-0 sm:translate-x-0.5 text-emerald-400' : ''
                                  }`} />
                                </button>
                              </div>
                            ) : (
                              isCatSelected && <Check className="w-3.5 h-3.5 shrink-0 mr-3" />
                            )}
                          </div>

                          {/* Desktop Flyout Sub-menu (on hover or click) */}
                          {hasSub && (isHovered || isExpanded) && (
                            <>
                              {/* Desktop Flyout Menu (side panel) */}
                              <div className="hidden sm:block absolute left-[calc(100%+6px)] top-0 w-72 bg-slate-900/98 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl p-1.5 z-60 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-2.5 py-1 mb-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between">
                                  <span>{cat.badge || cat.name}</span>
                                  <span className="text-[9px] text-slate-400">{cat.subItems?.length || 0} Pilihan</span>
                                </div>
                                <div className="space-y-1">
                                  {cat.subItems?.map(sub => {
                                    const isSubActive = selectedCategory === sub.id;
                                    const isAllMslOption = sub.name.includes('Semua MSL');
                                    return (
                                      <button
                                        key={sub.name}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCategory(sub.id);
                                          setShowCategoryDropdown(false);
                                          setHoveredCategory(null);
                                          setMobileExpandedCategory(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg font-bold transition-all flex items-center justify-between cursor-pointer ${
                                          isSubActive
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : isAllMslOption
                                            ? 'bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 hover:text-white border border-emerald-500/20 mb-1'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                      >
                                        <div className="flex flex-col min-w-0 pr-2">
                                          <div className="flex items-center gap-1.5">
                                            {isAllMslOption && <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />}
                                            <span className="truncate">{sub.name}</span>
                                          </div>
                                          {sub.badge && (
                                            <span className={`text-[9.5px] font-normal ${isSubActive ? 'text-emerald-100' : isAllMslOption ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                                              {sub.badge}
                                            </span>
                                          )}
                                        </div>
                                        {isSubActive && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Mobile Inline Sub-menu (collapsible accordion) */}
                              <div className="sm:hidden pl-3 pr-1 py-1.5 mt-1 space-y-1 border-l-2 border-emerald-500/40 bg-slate-950/40 rounded-r-lg">
                                {cat.subItems?.map(sub => {
                                  const isSubActive = selectedCategory === sub.id;
                                  const isAllMslOption = sub.name.includes('Semua MSL');
                                  return (
                                    <button
                                      key={sub.name}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCategory(sub.id);
                                        setShowCategoryDropdown(false);
                                        setMobileExpandedCategory(null);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer ${
                                        isSubActive
                                          ? 'bg-emerald-600 text-white'
                                          : isAllMslOption
                                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                      }`}
                                    >
                                      <div className="flex flex-col min-w-0 pr-1">
                                        <span className="truncate">{sub.name}</span>
                                        {sub.badge && (
                                          <span className={`text-[8.5px] font-normal ${isSubActive ? 'text-emerald-100' : 'text-slate-500'}`}>
                                            {sub.badge}
                                          </span>
                                        )}
                                      </div>
                                      {isSubActive && <Check className="w-3 h-3 shrink-0 ml-1.5" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTab(activeTab === 'benchmark' ? 'chat' : 'benchmark')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'benchmark'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Perbandingan RAG Lama vs Baharu & Metrik Telemetri"
          >
            <BarChart3 className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Perbandingan RAG</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'calculator' ? 'chat' : 'calculator')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Kalkulator Bancuhan Pam 16L & Kos"
          >
            <Calculator className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Kalkulator 16L</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'vision' ? 'chat' : 'vision')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'vision'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Pengecaman Imej Rumpai AI Vision"
          >
            <Camera className="w-3 h-3 text-teal-400" />
            <span className="hidden sm:inline">AI Vision</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'history' ? 'chat' : 'history')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Sejarah Perbualan"
          >
            <History className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Sejarah</span>
            {sessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/30 text-emerald-200">
                {sessions.length}
              </span>
            )}
          </button>

          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition-all shadow-xs cursor-pointer"
            title="Sembang Baru"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden xs:inline">Baru</span>
          </button>

          {!embedded && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

        {/* Content Body */}
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
            {/* Active Session / LocalStorage Status Banner */}
            {messages.some(m => m.role === 'user') && (
              <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 shrink-0">
                <div className="flex items-center gap-1.5 truncate pr-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span className="font-semibold truncate">
                    💾 Sejarah Sesi Disimpan: <span className="font-normal opacity-90">{sessions.find(s => s.id === currentSessionId)?.title || 'Sesi Perbualan RAG'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Tukar Sesi
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    onClick={handleStartNewChat}
                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:underline cursor-pointer"
                  >
                    + Baru
                  </button>
                </div>
              </div>
            )}

            {/* 22 Weed Dropdown Selector Bar (Active when in Manual Rumpai Dan Kawalan) */}
            {(selectedCategory === 'Manual Rumpai Dan Kawalan' || selectedCategory.toLowerCase().includes('rumpai')) && (
              <div className="px-3 py-2 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-emerald-950/90 border-b border-emerald-500/30 flex items-center justify-between gap-2 shrink-0 relative z-30 shadow-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <Leaf className="w-3.5 h-3.5" />
                  </div>
                  <div className="relative flex-1 max-w-md" ref={weedDropdownRef}>
                    {(() => {
                      const selectedObj = WEED_DATABASE.find(w => w.id === selectedWeedForCalc);
                      return (
                        <button
                          type="button"
                          onClick={() => setShowWeedListDropdown(prev => !prev)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-emerald-500/50 hover:border-emerald-400 transition-all flex items-center justify-between gap-2 text-left cursor-pointer shadow-xs group"
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            {selectedObj?.imageUrl ? (
                              <img
                                src={selectedObj.imageUrl}
                                alt={selectedObj.malayName}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-md object-cover border border-emerald-400/60 shrink-0 bg-slate-950 shadow-xs"
                              />
                            ) : (
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-500/40 shrink-0 font-mono">
                                22 SPESIES
                              </span>
                            )}
                            <span className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                              {selectedObj?.malayName || 'Pilih Spesies Rumpai (22 Senarai)'}
                            </span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 shrink-0 ${showWeedListDropdown ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })()}

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {showWeedListDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                          className="absolute left-0 right-0 top-full mt-1 bg-slate-900/98 backdrop-blur-xl border border-emerald-500/40 rounded-xl shadow-2xl p-2 z-50 max-h-80 flex flex-col space-y-1.5"
                        >
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input
                              type="text"
                              value={weedDropdownSearch}
                              onChange={(e) => setWeedDropdownSearch(e.target.value)}
                              placeholder="Cari rumpai (cth: Rumput Israel, Sambau, Resam)..."
                              className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
                            {WEED_DATABASE.filter(w => {
                              const q = weedDropdownSearch.toLowerCase().trim();
                              if (!q) return true;
                              return w.malayName.toLowerCase().includes(q) ||
                                     w.scientificName.toLowerCase().includes(q) ||
                                     w.category.toLowerCase().includes(q);
                            }).map((w, idx) => {
                              const isSelected = w.id === selectedWeedForCalc;
                              return (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => handleSelectWeedFromDropdown(w)}
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
                                        #{idx + 1}
                                      </span>
                                    </div>

                                    <div className="min-w-0">
                                      <p className="text-xs font-bold truncate group-hover:text-white">
                                        {w.malayName}
                                      </p>
                                      <p className="text-[10px] italic truncate text-emerald-300/90 group-hover:text-emerald-100 font-serif">
                                        {w.scientificName}
                                      </p>
                                      <p className="text-[9.5px] truncate text-slate-400 group-hover:text-emerald-100/90">
                                        Dos: <span className="font-mono text-emerald-300 font-semibold">{w.chemicalControl[0]?.rate16L || 'Ikut SOP'}</span> ({w.chemicalControl[0]?.activeIngredient.split(' ')[0] || ''})
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 group-hover:bg-emerald-800 text-emerald-300 group-hover:text-white border border-slate-700 group-hover:border-emerald-400/40">
                                      {w.category}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('calculator');
                    }}
                    className="px-2.5 py-1 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Buka Kalkulator Dos 16L"
                  >
                    <Calculator className="w-3 h-3" />
                    <span className="hidden sm:inline">Kalkulator 16L</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chat Messages Scroll Area */}
            <div className="flex-1 p-2.5 sm:p-4 overflow-y-auto space-y-2.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`max-w-[92%] sm:max-w-[85%] space-y-1.5`}>
                    <div
                      className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-tr-xs shadow-sm shadow-emerald-600/20'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap font-sans text-sm">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100 font-sans">
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              strong: ({ children }) => (
                                <strong className="font-bold text-slate-900 dark:text-white">
                                  {children}
                                </strong>
                              ),
                              p: ({ children }) => (
                                <div className="leading-relaxed mb-2 last:mb-0">
                                  {children}
                                </div>
                              ),
                              ul: ({ children }) => (
                                <ul className="space-y-1.5 my-2 pl-4 list-disc marker:text-emerald-500">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="space-y-1.5 my-2 pl-4 list-decimal marker:text-emerald-500 font-medium">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="leading-relaxed pl-1">
                                  {children}
                                </li>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-base font-black text-slate-900 dark:text-white mt-3 mb-1.5">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-sm font-black text-slate-900 dark:text-white mt-2.5 mb-1">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-2 mb-1">
                                  {children}
                                </h3>
                              ),
                              code: ({ children }) => (
                                <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] sm:text-xs">
                                  {children}
                                </code>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-emerald-500 pl-3 my-2 italic text-slate-600 dark:text-slate-400 bg-emerald-50/40 dark:bg-emerald-950/20 py-1 rounded-r-lg">
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children }) => (
                                <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                                  <table className="min-w-full text-left text-xs border-collapse">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 font-bold uppercase tracking-wider text-[11px]">
                                  {children}
                                </thead>
                              ),
                              tbody: ({ children }) => (
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/90">
                                  {children}
                                </tbody>
                              ),
                              tr: ({ children }) => (
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  {children}
                                </tr>
                              ),
                              th: ({ children }) => (
                                <th className="px-3 py-2 font-bold whitespace-nowrap text-emerald-900 dark:text-emerald-200 border-r last:border-r-0 border-emerald-200/60 dark:border-emerald-800/60">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200 border-r last:border-r-0 border-slate-100 dark:border-slate-800/60 align-middle">
                                  {children}
                                </td>
                              ),
                              img: ({ src, alt }) => (
                                <WeedSpecimenImageCard src={src} alt={alt} />
                              )
                            }}
                          >
                            {msg.content}
                          </Markdown>
                        </div>
                      )}

                      {/* Sources & Citations - Ringkas & Umum (Concise & Clean) */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Bookmark className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                              Sumber Rujukan: <span className="font-bold text-slate-800 dark:text-slate-200">
                                {Array.from(new Set(msg.sources.map(s => s.manualTitle || s.category || 'Manual Sawit'))).slice(0, 2).join(' & ')}
                              </span>
                            </span>
                          </div>
                          {msg.usedVectorDB && (
                            <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono shrink-0 ml-2 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              RAG Verified
                            </span>
                          )}
                          {msg.isCached && (
                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono shrink-0 ml-1.5 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 text-amber-400" />
                              Cache {msg.latencyMs ? `${msg.latencyMs}ms` : 'Sub-200ms'}
                            </span>
                          )}
                          {msg.numericalAccuracy !== undefined && msg.numericalAccuracy >= 90 && (
                            <span className="text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-mono shrink-0 ml-1.5 flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />
                              100% Dos Sah
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer Actions in message bubble */}
                      <div className="mt-2 pt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{msg.timestamp}</span>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleSpeakAssistantMessage(msg.content, msg.id)}
                              className={`flex items-center gap-1 font-bold transition-colors ${
                                speakingMessageId === msg.id
                                  ? 'text-emerald-600 dark:text-emerald-400 animate-pulse'
                                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                              }`}
                              title={speakingMessageId === msg.id ? "Hentikan bacaan suara" : "Dengar jawapan AI (Text-to-Speech)"}
                            >
                              <Volume2 className={`w-3 h-3 ${speakingMessageId === msg.id ? 'animate-bounce' : ''}`} />
                              <span>{speakingMessageId === msg.id ? 'Membaca...' : 'Dengar'}</span>
                            </button>

                            <button
                              onClick={() => copyToClipboard(msg.content, msg.id)}
                              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" /> Disalin
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Salin
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0 text-xs font-black">
                      FC
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    Sedang mencari rujukan dokumen & menjana jawapan...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions & Prompt Drawer */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              {/* Quick Suggestion Chips (when chat is short) */}
              {messages.length <= 2 && !showFaqQuickDrawer && (
                <div className="px-2.5 py-1 sm:px-3.5 sm:py-1.5">
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Cadangan Soalan:
                    </p>
                    <button
                      onClick={() => setActiveTab('faq')}
                      className="text-[10px] sm:text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <span>Lihat Semua ({MSL_FAQ_PROMPTS.length})</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {MSL_FAQ_PROMPTS.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectFaqPrompt(item, true)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50 whitespace-nowrap transition-all text-left flex items-center gap-1 shadow-2xs group shrink-0"
                        title={item.query}
                      >
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-200 font-bold">
                          {item.badge}
                        </span>
                        <span>{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* In-Chat Quick FAQ Drawer (Expandable) */}
              <AnimatePresence>
                {showFaqQuickDrawer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 space-y-2 max-h-60 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                          Pilih Prompt Berkonteks Tinggi Manual Sawit
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setShowFaqQuickDrawer(false);
                            setActiveTab('faq');
                          }}
                          className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          Buka FAQ Penuh
                        </button>
                        <button
                          onClick={() => setShowFaqQuickDrawer(false)}
                          className="p-0.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {MSL_FAQ_PROMPTS.slice(0, 8).map((prompt) => (
                        <div
                          key={prompt.id}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all text-left flex flex-col justify-between gap-1.5"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {prompt.category}
                              </span>
                              <span className="text-[8.5px] font-bold text-slate-400">
                                {prompt.badge}
                              </span>
                            </div>
                            <h5 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                              {prompt.title}
                            </h5>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {prompt.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleSelectFaqPrompt(prompt, true)}
                              className="flex-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold text-center transition-colors"
                            >
                              Tanya AI
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectFaqPrompt(prompt, false)}
                              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9.5px] font-bold transition-colors"
                              title="Masukkan ke kotak soalan untuk diedit"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Box - Ultra Compact Capsule Design */}
            <div className="p-2 sm:p-3 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 space-y-2">
              <div className="max-w-4xl mx-auto space-y-2">
                {/* In-Chat Quick Vision Drawer (Docked above input) */}
                <AnimatePresence>
                  {showInChatVision && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mb-2"
                    >
                      <WeedVisionDiagnosis
                        autoStartCamera={visionInitialMode === 'camera'}
                        initialMode={visionInitialMode}
                        onWeedIdentified={(weed) => {
                          setSelectedWeedForCalc(weed.id);
                        }}
                        onOpenCalculatorForWeed={(weedId) => {
                          setSelectedWeedForCalc(weedId);
                          setShowInChatVision(false);
                          setShowInChatCalculator(true);
                        }}
                        onAskAiWithPhoto={(query) => {
                          setShowInChatVision(false);
                          handleSendMessage(query);
                        }}
                        onClose={() => setShowInChatVision(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* In-Chat Quick Calculator Drawer (Docked above input) */}
                <AnimatePresence>
                  {showInChatCalculator && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mb-2"
                    >
                      <WeedDosageCalculatorAndSop
                        selectedWeedId={selectedWeedForCalc}
                        onSelectWeed={(id) => setSelectedWeedForCalc(id)}
                        onAskAiAboutWeed={(query) => {
                          setShowInChatCalculator(false);
                          handleSendMessage(query);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (voiceInput.isListening) {
                      voiceInput.stopListening();
                    }
                    handleSendMessage();
                  }}
                  className={`relative rounded-xl sm:rounded-2xl border transition-all duration-200 shadow-md ${
                    voiceInput.isListening
                      ? 'bg-rose-950/20 border-rose-500/60 ring-1 ring-rose-500/30'
                      : 'bg-slate-900/90 hover:bg-slate-900 border-slate-700/80 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/20'
                  }`}
                >
                  {/* Text Input Row */}
                  <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      placeholder={
                        voiceInput.isListening
                          ? 'Mendengar suara anda sekarang...'
                          : 'Tanya soalan mengenai SOP, MSPO, kadar upah, pembajaan...'
                      }
                      className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Bottom Action Controls Row */}
                  <div className="px-2.5 pb-1.5 pt-1 flex items-center justify-between gap-2 border-t border-slate-800/60 text-xs">
                    {/* Left Quick Helpers */}
                    <div className="flex items-center gap-1">
                      {/* Imbas Kamera Button (Direct Live Camera Launch) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (showInChatVision && visionInitialMode === 'camera') {
                            setShowInChatVision(false);
                          } else {
                            setVisionInitialMode('camera');
                            setShowInChatVision(true);
                            setShowInChatCalculator(false);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs shadow-xs ${
                          showInChatVision && visionInitialMode === 'camera'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white ring-2 ring-emerald-400/50'
                            : 'bg-gradient-to-r from-teal-600/90 to-emerald-600/90 hover:from-teal-500 hover:to-emerald-500 text-white border border-teal-400/40 hover:scale-[1.02]'
                        }`}
                        title="Imbas Rumpai: Lancarkan Kamera Langsung"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span className="font-extrabold tracking-tight">Kamera</span>
                      </button>

                      {/* Galeri Foto Button (Direct Photo Gallery Picker) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (showInChatVision && visionInitialMode === 'upload') {
                            setShowInChatVision(false);
                          } else {
                            setVisionInitialMode('upload');
                            setShowInChatVision(true);
                            setShowInChatCalculator(false);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] ${
                          showInChatVision && visionInitialMode === 'upload'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
                        }`}
                        title="Muat Naik / Pilih Imej dari Galeri Foto"
                      >
                        <ImageIcon className="w-3 h-3 text-emerald-400" />
                        <span className="hidden sm:inline">Galeri</span>
                      </button>

                      {/* Kalkulator 16L Quick Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowInChatCalculator(prev => !prev);
                          if (!showInChatCalculator) {
                            setShowInChatVision(false);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] ${
                          showInChatCalculator
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
                        }`}
                        title="Kalkulator Bancuhan Pam 16L & Kos"
                      >
                        <Calculator className="w-3 h-3 text-emerald-400" />
                        <span className="hidden sm:inline">Kalkulator 16L</span>
                      </button>

                      {/* FAQ Drawer Quick Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowFaqQuickDrawer(prev => !prev)}
                        className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] ${
                          showFaqQuickDrawer
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                        }`}
                        title="Cadangan Soalan Lazim MSL"
                      >
                        <Lightbulb className="w-3 h-3" />
                        <span className="hidden md:inline">FAQ MSL</span>
                      </button>

                      {/* PDF Upload Quick Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-0.5 rounded-lg font-bold text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60 flex items-center gap-1 transition-all cursor-pointer text-[11px]"
                        title="Muat Naik Dokumen PDF ke RAG"
                      >
                        <UploadCloud className="w-3 h-3" />
                        <span className="hidden md:inline">RAG PDF</span>
                      </button>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* High-Quality Voice Input Controller with Soundwave & BM/EN Switcher */}
                      <VoiceInputControl
                        voiceInput={voiceInput}
                        onSendDirectly={(text) => handleSendMessage(text)}
                      />

                      {/* Send or Stop Button */}
                      {isLoading ? (
                        <button
                          type="button"
                          onClick={handleStopSearch}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black shadow-md shadow-rose-600/40 transition-all flex items-center gap-1 cursor-pointer shrink-0 text-xs animate-pulse"
                          title="Hentikan carian AI semasa"
                        >
                          <Square className="w-3 h-3 fill-current text-white" />
                          <span>Henti</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!inputQuery.trim()}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1 cursor-pointer shrink-0 text-xs"
                          title="Hantar Soalan"
                        >
                          <Send className="w-3 h-3" />
                          <span className="hidden xs:inline">Hantar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : activeTab === 'faq' ? (
          /* Pustaka Soalan Lazim & Suggested High-Context Prompts Tab */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    Pustaka Soalan Lazim & Prompt Berkonteks Tinggi MSL
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Koleksi templat prompt mendalam untuk memicu analisis RAG menyeluruh merentas Manual Sawit Lestari, jadual pembajaan, kriteria BTS, dan MSPO.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black">
                  {filteredFaqPrompts.length} daripada {MSL_FAQ_PROMPTS.length} Prompts
                </span>
              </div>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {MSL_FAQ_CATEGORIES.map(cat => {
                  const count = cat === 'Semua' 
                    ? MSL_FAQ_PROMPTS.length 
                    : MSL_FAQ_PROMPTS.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFaqCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        faqCategory === cat
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-black'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        faqCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  value={faqSearchTerm}
                  onChange={(e) => setFaqSearchTerm(e.target.value)}
                  placeholder="Cari prompt atau kata kunci..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {faqSearchTerm && (
                  <button
                    onClick={() => setFaqSearchTerm('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Prompt Cards Grid */}
            {filteredFaqPrompts.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Tiada soalan lazim ditemui untuk carian ini
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Cuba tukar kategori atau gunakan kata kunci carian yang berbeza.
                </p>
                <button
                  onClick={() => {
                    setFaqCategory('Semua');
                    setFaqSearchTerm('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold"
                >
                  Set Semula Carian
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFaqPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          {prompt.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {prompt.badge}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {prompt.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {prompt.description}
                        </p>
                      </div>

                      {/* Prompt Query Box */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed relative group">
                        "{prompt.query}"
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {prompt.tags.map((tag, tidx) => (
                          <span
                            key={tidx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyFaqPrompt(prompt)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-bold shrink-0"
                        title="Salin Prompt ke Papan Keratan"
                      >
                        {copiedPromptId === prompt.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 text-[11px]">Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Salin</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectFaqPrompt(prompt, false)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                          title="Muatkan teks soalan ke input chat untuk anda ubahsuai sebelum hantar"
                        >
                          Edit di Input
                        </button>
                        <button
                          onClick={() => handleSelectFaqPrompt(prompt, true)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Terus hantar soalan ini kepada AI"
                        >
                          <Send className="w-3 h-3" />
                          <span>Tanya AI Terus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          /* Sembang Terkini (Recent Chats) Tab */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
            {/* Top Toolbar for Sembang Terkini */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  Sejarah Sembang Terkini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lihat, buka semula, atau uruskan perbualan dan sesi carian manual anda yang lalu.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartNewChat}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sembang Baru</span>
                </button>

                {sessions.length > 0 && (
                  <button
                    onClick={() => setShowClearAllModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-all shadow-sm"
                    title="Kosongkan Semua Sejarah Sembang"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Semua</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Dialog Pengesahan Kosongkan Semua */}
            {showClearAllModal && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-rose-900 dark:text-rose-200">
                      Adakah anda pasti mahu memadamkan SEMUA ({sessions.length}) sejarah sembang?
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Tindakan ini tidak boleh diundur dan semua rekod perbualan akan dibersihkan.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setShowClearAllModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleClearAllHistory}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
                  >
                    Ya, Padam Semua
                  </button>
                </div>
              </div>
            )}

            {/* Search Filter for History */}
            <div className="relative">
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Cari dalam sejarah soalan atau kata kunci sembang lalu..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Session Cards List */}
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {historySearchTerm ? 'Tiada sejarah sembang yang sepadan' : 'Belum ada sejarah perbualan'}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {historySearchTerm
                    ? 'Cuba gunakan kata kunci yang lain untuk mencari semula perbualan anda.'
                    : 'Setiap kali anda bertanya kepada Chatbot, sesi perbualan akan disimpan secara automatik di sini.'}
                </p>
                {!historySearchTerm && (
                  <button
                    onClick={handleStartNewChat}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transition-all mt-2"
                  >
                    <Plus className="w-4 h-4" /> Mula Sembang Sekarang
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSessions.map((s) => {
                  const isActive = s.id === currentSessionId;
                  const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
                  const userQuestions = s.messages.filter(m => m.role === 'user');

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleResumeSession(s)}
                      className={`group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                        isActive
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-md'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {s.category || 'Semua'}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                                Sedang Aktif
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {s.updatedAt || s.createdAt}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                          {s.title}
                        </h4>

                        {lastMsg && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {lastMsg.role === 'user' ? 'Anda: ' : 'AI: '}
                            </span>
                            {lastMsg.content.replace(/[#*`_]/g, '')}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-emerald-500" />
                          {userQuestions.length} soalan ditanya
                        </span>

                        <div className="flex items-center gap-1.5">
                          {deleteConfirmId === s.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 p-1 rounded-xl border border-rose-200 dark:border-rose-800" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 px-1">Padam?</span>
                              <button
                                onClick={(e) => handleDeleteSession(s.id, e)}
                                className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black"
                              >
                                Ya
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-1.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(s.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Padam sesi ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Sambung <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'benchmark' ? (
          /* Tab Perbandingan & Audit RAG Lama vs Baharu */
          <RagBenchmarkView
            onRunTestQuery={(query) => {
              setActiveTab('chat');
              handleSendMessage(query);
            }}
            onShowToast={(msg, type) => onShowToast?.(msg, type)}
          />
        ) : activeTab === 'calculator' ? (
          /* Tab Kalkulator Bancuhan Pam 16L & Matriks Keselamatan */
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
            <WeedDosageCalculatorAndSop
              selectedWeedId={selectedWeedForCalc}
              onSelectWeed={(id) => setSelectedWeedForCalc(id)}
              onAskAiAboutWeed={(query) => {
                setActiveTab('chat');
                handleSendMessage(query);
              }}
            />
          </div>
        ) : activeTab === 'vision' ? (
          /* Tab Pengecaman Imej Rumpai AI Vision */
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
            <WeedVisionDiagnosis
              autoStartCamera={true}
              onWeedIdentified={(weed) => {
                setSelectedWeedForCalc(weed.id);
              }}
              onOpenCalculatorForWeed={(weedId) => {
                setSelectedWeedForCalc(weedId);
                setActiveTab('calculator');
              }}
              onAskAiWithPhoto={(query) => {
                setActiveTab('chat');
                handleSendMessage(query);
              }}
            />
          </div>
        ) : (
          /* Knowledge Explorer Tab */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
            {/* Upload PDF Section Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-600/10 border border-emerald-500/30 dark:border-emerald-500/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      Muat Naik Fail PDF Manual Sawit
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-mono">
                        Vector Ingestion
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pilih fail PDF manual anda (menyokong muat naik tunggal atau sehingga 76 fail serentak).
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  {/* Pilihan Kategori Semasa Upload */}
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    disabled={isUploading}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-sm"
                  >
                    <option value="The Oil Palm, 5th Edition">The Oil Palm (5th Edition) - Corley & Tinker</option>
                    <option value="Manual Rumpai Dan Kawalan">Manual Rumpai Dan Kawalan</option>
                    <option value="Kadar Upah">Kadar Upah Kerja (KUK) SIRI 8</option>
                    <option value="Manual Perolehan 2023 Pind. 2025">Manual Perolehan 2023 Pind. 2025</option>
                    <option value="MSL - Tapak Semaian">MSL - Tapak Semaian</option>
                    <option value="MSL - Pembangunan Tanam Semula">MSL - Pembangunan Tanam Semula</option>
                    <option value="MSL - Pokok Pra Matang">MSL - Pokok Pra Matang</option>
                    <option value="MSL - Pokok Matang">MSL - Pokok Matang</option>
                    <option value="MSL - Pembajaan">MSL - Pembajaan</option>
                  </select>

                  <input
                    id="manual-pdf-file-upload-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,application/pdf"
                    multiple
                    disabled={isUploading}
                    className="hidden"
                  />

                  <label
                    htmlFor="manual-pdf-file-upload-input"
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all select-none cursor-pointer ${
                      isUploading
                        ? 'bg-emerald-700/60 opacity-60 cursor-not-allowed pointer-events-none'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-600/30'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Memproses...
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4" /> PILIH PDF
                      </>
                    )}
                  </label>
                </div>
              </div>

              {isUploading && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {uploadProgressText || 'Sedang mengekstrak kandungan & menjana vektor embedding...'}
                </div>
              )}
            </div>

            {/* Carian Dokumen Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari dalam arkib manual (cth: OER, tikus, ulat bungkus, riparian)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-xs font-bold text-slate-500 shrink-0">
                {filteredKnowledge.length} dokumen rujukan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredKnowledge.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        M/S {item.pageNumber}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {item.sectionTitle}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2 line-clamp-4">
                      {item.content}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t, tidx) => (
                        <span key={tidx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('chat');
                        handleSendMessage(`Jelaskan lebih lanjut mengenai bab: ${item.sectionTitle}`);
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0 ml-2"
                    >
                      Tanya AI <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );

  if (embedded) {
    return contentJSX;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-1 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl h-[95vh] sm:h-[92vh] max-h-[880px] flex flex-col overflow-hidden"
      >
        {contentJSX}
      </motion.div>
    </div>
  );
}

