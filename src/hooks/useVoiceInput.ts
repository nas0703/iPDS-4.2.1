import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseVoiceInputOptions {
  initialLanguage?: 'ms-MY' | 'id-ID' | 'en-US';
  continuous?: boolean;
  autoStopSilenceMs?: number; // Auto stop after N ms of silence
  enableAudioVisualizer?: boolean;
  enableAudioCues?: boolean;
  autoSubmitOnFinish?: boolean; // Serta-merta laksanakan carian/hantar bila selesai bercakap
  onTranscriptChange?: (text: string, isFinal: boolean) => void;
  onFinalResult?: (finalText: string) => void;
  onAutoSubmit?: (submittedText: string) => void; // Callback auto carian
  onError?: (errorMessage: string, rawError: any) => void;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  isPermissionDenied: boolean;
  language: 'ms-MY' | 'id-ID' | 'en-US';
  transcript: string;
  interimTranscript: string;
  combinedText: string;
  audioLevel: number; // 0 to 100
  listeningDuration: number; // in seconds
  error: string | null;
  startListening: (overrideLang?: 'ms-MY' | 'id-ID' | 'en-US') => Promise<void>;
  stopListening: () => Promise<string>;
  toggleListening: () => void;
  resetTranscript: () => void;
  setLanguage: (lang: 'ms-MY' | 'id-ID' | 'en-US') => void;
}

// Clean and normalize speech text, especially for Malaysian plantation terminology
export function formatPlantationSpeechText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Normalize common plantation terms
  cleaned = cleaned
    .replace(/\befb\b/gi, 'EFB')
    .replace(/\bbts\b/gi, 'BTS')
    .replace(/\bkpg\s*(?:sama\s*dengan|=|sama)?\s*kpa\b/gi, 'KPG=KPA')
    .replace(/\bkpg\b/gi, 'KPG')
    .replace(/\bkpa\b/gi, 'KPA')
    .replace(/\bmop\b/gi, 'MOP')
    .replace(/\bmspo\b/gi, 'MSPO')
    .replace(/\bkuk\b/gi, 'KUK')
    .replace(/\babw\b/gi, 'ABW')
    .replace(/\bbbc\b/gi, 'BBC')
    .replace(/\boer\b/gi, 'OER')
    .replace(/\bmsl\b/gi, 'MSL')
    .replace(/\bpkt\s*1\b/gi, 'PKT 1')
    .replace(/\bpkt\s*2\b/gi, 'PKT 2')
    .replace(/\bfelda\b/gi, 'FELDA')
    .replace(/\bfpmsb\b/gi, 'FPMSB')
    .replace(/\bfc\b/gi, 'FC')
    .replace(/\bpf\b/gi, 'PF')
    .replace(/\bytd\b/gi, 'YTD')
    .replace(/\bmtd\b/gi, 'MTD')
    .replace(/\bblok\s*([0-9]{1,2})\b/gi, (_, n) => `Blok ${n}`);

  // Capitalize first character
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

// Play pleasant web-audio start/stop sound cue (no external assets needed)
function playToneCue(type: 'start' | 'stop') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'start') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'stop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {
    // Autoplay restrictions
  }
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    initialLanguage = 'ms-MY',
    continuous = false,
    autoStopSilenceMs = 2200,
    enableAudioCues = true,
    autoSubmitOnFinish = true,
    onTranscriptChange,
    onFinalResult,
    onAutoSubmit,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [language, setLanguage] = useState<'ms-MY' | 'id-ID' | 'en-US'>(initialLanguage);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [listeningDuration, setListeningDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const animIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeTranscriptRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const usingMediaRecorderFallbackRef = useRef<boolean>(false);
  const hasAutoSubmittedRef = useRef<boolean>(false);

  // Check Web Speech / Media API Support
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setIsSupported(hasMedia || hasSpeech);
  }, []);

  // Animate soundwave during active listening
  const startWaveAnimation = useCallback(() => {
    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    animIntervalRef.current = setInterval(() => {
      if (!isListeningRef.current) return;
      // Generate organic responsive speech pulses between 25 and 85
      const randomLevel = Math.floor(Math.random() * 60) + 25;
      setAudioLevel(randomLevel);
    }, 120);
  }, []);

  const stopWaveAnimation = useCallback(() => {
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Transcribe recorded audio with backend Gemini AI (Used ONLY when Web Speech API is absent)
  const transcribeAudioBlob = useCallback(async (blob: Blob, lang: string): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const res = await fetch('/api/ai/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: base64Audio,
              mimeType: blob.type || 'audio/webm',
              language: lang
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.transcript) {
              const formatted = formatPlantationSpeechText(data.transcript);
              resolve(formatted);
              return;
            }
          }
          resolve('');
        } catch (err) {
          console.warn('AI Audio Transcribe error:', err);
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }, []);

  // Stop listening handler
  const stopListening = useCallback(async (): Promise<string> => {
    isListeningRef.current = false;
    setIsListening(false);
    stopWaveAnimation();

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (enableAudioCues) {
      playToneCue('stop');
    }

    // Stop Web Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    let finalResultText = activeTranscriptRef.current.trim();

    // If using MediaRecorder fallback mode
    if (usingMediaRecorderFallbackRef.current && mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}

      if (audioChunksRef.current.length > 0) {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size > 500) {
            const aiTranscript = await transcribeAudioBlob(audioBlob, language);
            if (aiTranscript) {
              finalResultText = aiTranscript;
              setTranscript(aiTranscript);
              activeTranscriptRef.current = aiTranscript;
              onTranscriptChange?.(aiTranscript, true);
              onFinalResult?.(aiTranscript);
              if (autoSubmitOnFinish && onAutoSubmit && !hasAutoSubmittedRef.current && aiTranscript.trim().length >= 2) {
                hasAutoSubmittedRef.current = true;
                onAutoSubmit(aiTranscript.trim());
              }
            }
          }
        } catch (e) {
          console.warn('Fallback transcribe failed:', e);
        } finally {
          setIsProcessing(false);
        }
      }
    }

    // Trigger auto-submit when voice input finishes
    if (autoSubmitOnFinish && onAutoSubmit && !hasAutoSubmittedRef.current && finalResultText.length >= 2) {
      hasAutoSubmittedRef.current = true;
      onAutoSubmit(finalResultText);
    }

    audioChunksRef.current = [];
    usingMediaRecorderFallbackRef.current = false;
    return finalResultText;
  }, [autoSubmitOnFinish, enableAudioCues, language, onAutoSubmit, onFinalResult, onTranscriptChange, stopWaveAnimation, transcribeAudioBlob]);

  // Reset silence timer
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (autoStopSilenceMs > 0) {
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current) {
          stopListening();
        }
      }, autoStopSilenceMs);
    }
  }, [autoStopSilenceMs, stopListening]);

  // Start listening handler
  const startListening = useCallback(
    async (overrideLang?: 'ms-MY' | 'id-ID' | 'en-US') => {
      setError(null);
      setIsPermissionDenied(false);
      const activeLang = overrideLang || language;

      isListeningRef.current = true;
      setIsListening(true);
      setListeningDuration(0);
      setInterimTranscript('');
      activeTranscriptRef.current = '';
      audioChunksRef.current = [];
      usingMediaRecorderFallbackRef.current = false;
      hasAutoSubmittedRef.current = false;

      if (enableAudioCues) {
        playToneCue('start');
      }

      // Start duration counter
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      durationTimerRef.current = setInterval(() => {
        setListeningDuration((prev) => prev + 1);
      }, 1000);

      startWaveAnimation();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      // STRATEGY 1: Native Web Speech API (NO simultaneous getUserMedia to prevent Android mic lock collision)
      if (SpeechRecognition) {
        try {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (e) {}
          }

          const recognition = new SpeechRecognition();
          recognition.continuous = continuous;
          recognition.interimResults = true;
          recognition.lang = activeLang;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event: any) => {
            resetSilenceTimer();
            let finalChunk = '';
            let interimChunk = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const text = res[0]?.transcript || '';
              if (res.isFinal) {
                finalChunk += text;
              } else {
                interimChunk += text;
              }
            }

            if (finalChunk) {
              const formattedFinal = formatPlantationSpeechText(finalChunk);
              setTranscript((prev) => {
                const updated = prev ? `${prev} ${formattedFinal}` : formattedFinal;
                activeTranscriptRef.current = updated;
                onTranscriptChange?.(updated, true);
                onFinalResult?.(updated);
                return updated;
              });
              setInterimTranscript('');
            } else if (interimChunk) {
              setInterimTranscript(interimChunk);
              onTranscriptChange?.(interimChunk, false);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn('Speech Recognition Event Error:', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setIsPermissionDenied(true);
              const errMsg = 'Akses mikrofon tidak dibenarkan oleh pelayar.';
              setError(errMsg);
              onError?.(errMsg, event);
              stopListening();
            } else if (event.error === 'no-speech') {
              // Ignore silent pause, user may speak soon
            } else if (event.error === 'audio-capture') {
              setError('Mikrofon sedang digunakan oleh aplikasi lain.');
              stopListening();
            }
          };

          recognition.onend = () => {
            if (isListeningRef.current) {
              setIsListening(false);
              isListeningRef.current = false;
              stopWaveAnimation();
              const textToSubmit = activeTranscriptRef.current.trim();
              if (autoSubmitOnFinish && onAutoSubmit && !hasAutoSubmittedRef.current && textToSubmit.length >= 2) {
                hasAutoSubmittedRef.current = true;
                onAutoSubmit(textToSubmit);
              }
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
          resetSilenceTimer();
          return;
        } catch (err: any) {
          console.warn('SpeechRecognition failed to start, falling back to MediaRecorder:', err);
        }
      }

      // STRATEGY 2: Fallback to MediaRecorder + Gemini AI Transcribe (Only if SpeechRecognition is not available)
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          usingMediaRecorderFallbackRef.current = true;
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          recorder.start(250);
          resetSilenceTimer();
        } else {
          setError('Pelayar anda tidak menyokong rakaman audio.');
          stopListening();
        }
      } catch (micErr: any) {
        console.warn('Mic fallback access error:', micErr);
        setIsPermissionDenied(true);
        setError('Akses mikrofon disekat oleh pelayar.');
        stopListening();
      }
    },
    [
      continuous,
      enableAudioCues,
      language,
      onError,
      onFinalResult,
      onTranscriptChange,
      resetSilenceTimer,
      startWaveAnimation,
      stopListening,
      stopWaveAnimation
    ]
  );

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    activeTranscriptRef.current = '';
    setError(null);
    setIsPermissionDenied(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, []);

  const combinedText = interimTranscript
    ? transcript
      ? `${transcript} ${interimTranscript}`
      : interimTranscript
    : transcript;

  return {
    isListening,
    isProcessing,
    isSupported,
    isPermissionDenied,
    language,
    transcript,
    interimTranscript,
    combinedText,
    audioLevel,
    listeningDuration,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setLanguage
  };
}
