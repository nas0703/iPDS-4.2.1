import { Message } from '../types/manualSawitChat.types';

export const STORAGE_KEY = 'sawit_manual_chat_sessions_v1';

export const getInitialWelcomeMessage = (): Message => ({
  id: 'msg-welcome',
  sender: 'bot',
  text: `Selamat datang ke **AI Assistant Manual Sawit MPOB & SOP Ladang**. 🌾🤖

Saya sedia membantu anda menyemak **SOP, garis panduan MSPO, kawalan perosak/rumpai, amalan agronomi, serta isu operasi ladang**.

Sila taip soalan anda atau pilih contoh cadangan di bawah.`,
  timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
});

export const loadSavedChatSessions = (): { sessions: any[]; activeId: string; messages: Message[] } => {
  const initialMsg = getInitialWelcomeMessage();
  const defaultSession = {
    id: 'session-default',
    title: 'Sesi Utama',
    updatedAt: new Date().toISOString(),
    messages: [initialMsg],
  };

  if (typeof window === 'undefined') {
    return { sessions: [defaultSession], activeId: defaultSession.id, messages: [initialMsg] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sessions: [defaultSession], activeId: defaultSession.id, messages: [initialMsg] };
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const active = parsed[0];
      return {
        sessions: parsed,
        activeId: active.id,
        messages: active.messages && active.messages.length > 0 ? active.messages : [initialMsg],
      };
    }
  } catch (err) {
    console.warn('Gagal membaca chat sessions daripada localStorage:', err);
  }

  return { sessions: [defaultSession], activeId: defaultSession.id, messages: [initialMsg] };
};
