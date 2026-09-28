import React, { useState, useEffect, useCallback, useRef } from "react";
import { Delete, ShieldCheck, ArrowRight, Loader2, Clock } from "lucide-react";
import { getLocalLogo, fetchSupabaseLogo } from "../../../services/logoService";
import { DeviceApprovalModal } from "./DeviceApprovalModal";

interface LoginScreenProps {
  pin: string;
  loginError: boolean;
  isDarkMode: boolean;
  handlePinPress: (num: string) => void;
  handleDeletePress: () => void;
  handleQuickLogin?: (pin: string) => void;
  verifyStaffCredentials?: (estateCode: string, staffNo: string) => Promise<boolean>;
  verifyPasswordOnServer?: (identity: string, pass: string) => Promise<boolean>;
  deviceApprovalState?: {
    isBlocked: boolean;
    device?: {
      deviceId: string;
      deviceName?: string;
      status: string;
      operatorName?: string;
      createdAt?: string;
    };
    approvalUrl?: string;
    message?: string;
  } | null;
  onClearDeviceApprovalState?: () => void;
}

// Map 4-Digit Estate & Region Codes to Names & IDs
const ESTATE_CODE_MAP: Record<string, { id: string; name: string }> = {
  "0001": { id: "WILAYAH_JB", name: "FPM WILAYAH JOHOR BAHRU" },
  "WJB": { id: "WILAYAH_JB", name: "FPM WILAYAH JOHOR BAHRU" },
  "5155": { id: "FPM_TUNGGAL", name: "LADANG FPM TUNGGAL" },
  "5136": { id: "FPM_ADELA", name: "LADANG FPM ADELA" },
  "5176": { id: "FPM_KLEDANG", name: "LADANG FPM KLEDANG" },
  "5156": { id: "FPM_SENING", name: "LADANG FPM SENING" },
};

export function LoginScreen({
  pin,
  loginError,
  isDarkMode,
  handlePinPress,
  handleDeletePress,
  handleQuickLogin,
  verifyStaffCredentials,
  verifyPasswordOnServer,
  deviceApprovalState,
  onClearDeviceApprovalState,
}: LoginScreenProps) {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => getLocalLogo());

  // Kiosk 2-Step State: Step 1 = Kod Ladang (4 digit), Step 2 = No. Kakitangan
  const [step, setStep] = useState<1 | 2>(1);
  const [typedDigits, setTypedDigits] = useState<string>("");
  const [selectedEstateCode, setSelectedEstateCode] = useState<string>("");
  const [selectedEstateId, setSelectedEstateId] = useState<string>("FPM_TUNGGAL");
  const [selectedEstateName, setSelectedEstateName] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // P0-16 fix: remembers the last staff number so a successful device-approval
  // status check can resume the normal login flow (typedDigits is cleared when
  // the device is first blocked).
  const lastStaffNoRef = useRef<string>("");
  const [idleNotice, setIdleNotice] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem("ipds_idle_timeout_notice");
      if (msg) {
        sessionStorage.removeItem("ipds_idle_timeout_notice");
        return msg;
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    fetchSupabaseLogo().then((url) => {
      if (url) setCustomLogoUrl(url);
    }).catch(() => {});
  }, []);

  // Discrete sound effect
  const playKeyBeepSound = () => {
    try {
      if (typeof window === "undefined") return;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Silent fallback
    }
  };

  // Tactile haptic vibration feedback
  const triggerHapticFeedback = () => {
    try {
      if (typeof window !== "undefined" && window.navigator && typeof window.navigator.vibrate === "function") {
        window.navigator.vibrate(12);
      }
    } catch (e) {
      // Safe fallback
    }
  };

  // Process Keypad Digit Press
  const handleKeypadPress = useCallback((num: string) => {
    if (isSubmitting) return;

    try {
      playKeyBeepSound();
      triggerHapticFeedback();
    } catch (e) {}

    setErrorMessage(null);
    setIdleNotice(null);

    setTypedDigits((prev) => {
      const nextVal = prev + num;

      // STEP 1: Kod Ladang Validation (4 Digits)
      if (step === 1) {
        if (nextVal.length === 4) {
          const estateMatch = ESTATE_CODE_MAP[nextVal];
          if (estateMatch) {
            // Valid Kod Ladang -> Move to Step 2!
            setSelectedEstateCode(nextVal);
            setSelectedEstateId(estateMatch.id);
            setSelectedEstateName(estateMatch.name);
            setStep(2);
            return ""; // Reset PIN pad digits for Staff No input
          } else {
            // Invalid Kod Ladang -> Show Error & Reset
            setErrorMessage("Kod ladang tidak sah");
            return "";
          }
        }
        if (nextVal.length > 4) return prev;
      }

      // STEP 2: No. Kakitangan Input (Max 7 Digits)
      if (nextVal.length > 7) return prev;
      return nextVal;
    });
  }, [step, isSubmitting]);

  // Auto-submit Staff Login when typedDigits reaches valid length (6 to 7 digits) in Step 2
  useEffect(() => {
    if (step === 2 && typedDigits.length >= 6 && !isSubmitting) {
      let isCancelled = false;
      const isFull7Digits = typedDigits.length >= 7;

      const triggerSubmission = async () => {
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
          if (verifyStaffCredentials) {
            const success = await verifyStaffCredentials(selectedEstateId || selectedEstateCode, typedDigits);
            if (!success && !isCancelled) {
              setErrorMessage(`Kombinasi Kod Ladang & No. Kakitangan tidak sah bagi ${selectedEstateName || 'ladang ini'}.`);
              setTypedDigits("");
            }
          } else {
            setErrorMessage("Sistem pengesahan kombinasi ladang tidak sedia.");
            setTypedDigits("");
          }
        } catch (err) {
          if (!isCancelled) {
            setErrorMessage("Kombinasi Kod Ladang atau No. Kakitangan tidak sah.");
            setTypedDigits("");
          }
        } finally {
          if (!isCancelled) {
            setIsSubmitting(false);
          }
        }
      };

      // Full 7 digits submits immediately; 6 digits waits a short debounce (350ms) to allow 7th digit or submit
      if (isFull7Digits) {
        triggerSubmission();
        return () => {
          isCancelled = true;
        };
      } else {
        const timer = setTimeout(() => {
          triggerSubmission();
        }, 350);
        return () => {
          isCancelled = true;
          clearTimeout(timer);
        };
      }
    }
  }, [typedDigits, step, selectedEstateId, selectedEstateCode, selectedEstateName, verifyStaffCredentials, isSubmitting]);

  // Process Backspace Press
  const handleKeypadBackspace = useCallback(() => {
    try {
      playKeyBeepSound();
      triggerHapticFeedback();
    } catch (e) {}
    setErrorMessage(null);
    setTypedDigits((prev) => prev.slice(0, -1));
  }, []);

  // Clear Input
  const handleKeypadClear = useCallback(() => {
    try {
      playKeyBeepSound();
      triggerHapticFeedback();
    } catch (e) {}
    setErrorMessage(null);
    setTypedDigits("");
  }, []);

  // Submit Staff Login in Step 2
  const submitStaffLogin = useCallback(async (staffNoToSubmit?: string) => {
    const targetStaffNo = (staffNoToSubmit || typedDigits).trim();
    if (!targetStaffNo) {
      setErrorMessage("Sila masukkan No. Kakitangan.");
      return;
    }
    // Remember the last submitted staff number so the login can resume after a
    // device is approved (the typed digits are cleared when the device blocks).
    lastStaffNoRef.current = targetStaffNo;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (verifyStaffCredentials) {
        const success = await verifyStaffCredentials(selectedEstateId || selectedEstateCode, targetStaffNo);
        if (!success) {
          setErrorMessage(`Kombinasi Kod Ladang & No. Kakitangan tidak sah bagi ${selectedEstateName || 'ladang ini'}.`);
          setTypedDigits("");
        }
      } else {
        setErrorMessage("Sistem pengesahan kombinasi ladang tidak sedia.");
        setTypedDigits("");
      }
    } catch (err) {
      setErrorMessage("Kombinasi Kod Ladang atau No. Kakitangan tidak sah.");
      setTypedDigits("");
    } finally {
      setIsSubmitting(false);
    }
  }, [typedDigits, verifyStaffCredentials, selectedEstateId, selectedEstateCode, selectedEstateName]);

  // Physical Keyboard Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keystrokes if device approval modal is open or an input/textarea has active focus
      if (deviceApprovalState?.isBlocked) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === 'Enter' && step === 2) {
        e.preventDefault();
        submitStaffLogin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, handleKeypadBackspace, step, submitStaffLogin, deviceApprovalState?.isBlocked]);

  return (
    <div
      className={`max-w-md mx-auto min-h-screen ${isDarkMode ? "bg-[#090f1e]" : "bg-slate-950"} flex flex-col justify-center items-center py-6 px-4 relative overflow-hidden transition-colors duration-500`}
    >
      {/* Background Glowing Ambient Accents */}
      <div className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* FULL LOGIN CARD CONTAINER */}
      <div className="relative z-10 w-full max-w-sm bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 flex flex-col items-center space-y-4 shadow-[0_0_45px_rgba(0,0,0,0.7)] backdrop-blur-md overflow-hidden my-auto">
        
        {/* Glow Effects */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* HEADER BRANDING */}
        <div className="w-full flex flex-col items-center">
          
          {/* LOGO */}
          <div className="w-20 h-20 sm:w-22 sm:h-22 bg-slate-950 border border-emerald-500/50 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)] relative overflow-hidden mb-3 p-2 transition-all duration-300">
            {customLogoUrl ? (
              <img
                src={customLogoUrl}
                alt="Logo Header"
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center select-none p-1 bg-black rounded-xl">
                {/* Official IPDS Vector Logo */}
                <svg viewBox="0 0 880 380" className="w-full max-w-[96%] h-auto select-none">
                  <rect x="10" y="30" width="56" height="56" rx="14" fill="#2fd51d" />
                  <rect x="10" y="118" width="56" height="236" rx="28" fill="#FFFFFF" />
                  <path 
                    d="M 120 58 L 228 58 A 86 86 0 0 1 314 144 A 86 86 0 0 1 228 230 L 172 230 A 28 28 0 0 0 144 258 L 144 330" 
                    fill="none" 
                    stroke="#FFFFFF" 
                    strokeWidth="56" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M 376 138 L 376 58 A 28 28 0 0 1 404 30 L 442 30 A 60 60 0 0 1 460 84 A 72 72 0 0 1 428 184 L 400 184 A 24 24 0 0 1 376 160 Z" 
                    fill="#2fd51d"
                  />
                  <path 
                    d="M 440 58 L 476 58 A 142 142 0 0 1 618 200 A 142 142 0 0 1 476 342 L 404 342 A 28 28 0 0 1 376 314 L 376 164" 
                    fill="none" 
                    stroke="#FFFFFF" 
                    strokeWidth="56" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M 790 72 C 782 42 740 30 694 30 C 632 30 606 60 606 108 C 606 162 656 182 710 198 C 772 214 808 240 808 288 C 808 340 764 374 690 374 C 630 374 596 346 588 316" 
                    fill="none" 
                    stroke="#FFFFFF" 
                    strokeWidth="56" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* DYNAMIC HEADER TITLE */}
          <div className="text-center space-y-1 w-full">
            {/* System Title */}
            <h2 className="text-[12px] sm:text-[13px] font-black tracking-[0.18em] text-emerald-400 uppercase leading-none">
              INTEGRATED PLANTATION DATA SYSTEM
            </h2>

            {/* Universal Header Line 1 */}
            <h1 className="text-[10.5px] sm:text-[11px] font-black tracking-widest text-white/90 uppercase leading-tight pt-0.5">
              FPM WILAYAH JOHOR BAHRU
            </h1>

            {/* Dynamic Header Line 2 (Shows Estate Name when Kod Ladang is entered) */}
            {step === 2 && selectedEstateName && (
              <div className="pt-0.5 animate-fadeIn flex flex-col items-center gap-1">
                <span className="text-[12px] sm:text-[13px] font-black text-emerald-400 tracking-wider uppercase block bg-emerald-500/10 border border-emerald-500/30 py-1 px-3 rounded-xl shadow-sm">
                  {selectedEstateName} ({selectedEstateCode})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setTypedDigits("");
                    setErrorMessage(null);
                  }}
                  className="text-[10px] text-emerald-400/80 hover:text-emerald-300 underline tracking-wide transition-colors py-0.5 cursor-pointer flex items-center gap-1"
                >
                  <span>←</span> Tukar Kod Ladang
                </button>
              </div>
            )}

            {/* Subtitle / Step Instruction */}
            <p className="text-[8.5px] font-extrabold tracking-[0.18em] text-emerald-300/80 uppercase pt-1">
              {step === 1 ? "MASUKKAN KOD LADANG (4 DIGIT)" : "MASUKKAN NO. KAKITANGAN"}
            </p>
          </div>
        </div>

        {/* INPUT DISPLAY CONTAINER */}
        <div className="w-full space-y-3 pt-1">
          {step === 1 ? (
            /* STEP 1: 4-Digit Kod Ladang Slots Display (Masked for Privacy) */
            <div className="flex items-center justify-center px-6 py-3 rounded-2xl w-full bg-slate-950/70 border border-emerald-500/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <div className="flex gap-4.5 h-6 items-center">
                {[...Array(4)].map((_, i) => {
                  const active = typedDigits.length > i;
                  return (
                    <div
                      key={i}
                      className="relative flex items-center justify-center transition-all duration-300"
                    >
                      <div
                        className={`w-7 h-7 rounded-lg transition-all duration-300 border flex items-center justify-center font-mono font-black text-base ${
                          active 
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]" 
                            : "bg-slate-950 border-slate-800 text-slate-700"
                        }`}
                      >
                        •
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STEP 2: 7-Digit No. Kakitangan Slots Display (Masked for Privacy) */
            <div className="flex items-center justify-center px-4 py-3 rounded-2xl w-full bg-slate-950/70 border border-emerald-500/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <div className="flex gap-2 sm:gap-2.5 h-6 items-center justify-center">
                {[...Array(7)].map((_, i) => {
                  const active = typedDigits.length > i;
                  return (
                    <div
                      key={i}
                      className="relative flex items-center justify-center transition-all duration-300"
                    >
                      <div
                        className={`w-7 h-7 rounded-lg transition-all duration-300 border flex items-center justify-center font-mono font-black text-base ${
                          active 
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]" 
                            : "bg-slate-950 border-slate-800 text-slate-700"
                        }`}
                      >
                        •
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ERROR MESSAGE DISPLAY */}
          {(errorMessage || loginError) && (
            <p className="text-rose-400 text-[10.5px] font-extrabold uppercase tracking-wide bg-rose-500/10 border border-rose-500/30 py-1.5 px-3 rounded-xl text-center animate-pulse shadow-sm">
              {errorMessage || "Kod ladang atau No. Kakitangan tidak sah."}
            </p>
          )}

          {/* IDLE TIMEOUT SECURITY NOTICE */}
          {idleNotice && !errorMessage && !loginError && (
            <div className="text-amber-300 text-[10px] font-bold text-center bg-amber-500/10 border border-amber-500/30 py-2 px-3 rounded-xl flex items-center justify-center gap-2 shadow-sm animate-fadeIn">
              <Clock size={15} className="text-amber-400 shrink-0" />
              <span className="leading-tight">{idleNotice}</span>
            </div>
          )}

          {/* KIOSK NUMERIC PIN PAD */}
          <div className="grid grid-cols-3 gap-x-5 gap-y-3 w-full px-1 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num.toString())}
                className="w-13.5 h-13.5 mx-auto rounded-full flex items-center justify-center font-sans font-extrabold text-2xl text-slate-100 bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-emerald-500/30 select-none shadow-md outline-none focus:outline-none active:scale-95 transition-all cursor-pointer hover:border-emerald-400"
              >
                {num}
              </button>
            ))}
            
            {/* Clear Button (C) */}
            <button
              type="button"
              onClick={handleKeypadClear}
              className="w-13.5 h-13.5 mx-auto rounded-full flex flex-col items-center justify-center text-[11px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-900/50 border border-slate-800 select-none shadow-md outline-none focus:outline-none active:scale-95 transition-all cursor-pointer hover:text-slate-200"
            >
              <span>C</span>
            </button>

            {/* Zero (0) */}
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="w-13.5 h-13.5 mx-auto rounded-full flex items-center justify-center font-sans font-extrabold text-2xl text-slate-100 bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-emerald-500/30 select-none shadow-md outline-none focus:outline-none active:scale-95 transition-all cursor-pointer hover:border-emerald-400"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="w-13.5 h-13.5 mx-auto rounded-full flex items-center justify-center text-slate-300 bg-slate-900/50 border border-slate-800 select-none shadow-md outline-none focus:outline-none active:scale-95 transition-all cursor-pointer hover:text-rose-400"
            >
              <Delete size={20} className="stroke-[2.5]" />
            </button>
          </div>

          {/* STEP 2 SUBMIT / LOG MASUK BUTTON */}
          {step === 2 && (
            <button
              type="button"
              onClick={() => submitStaffLogin()}
              disabled={isSubmitting || !typedDigits.trim()}
              className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>MENGESAHKAN KAKITANGAN...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>LOG MASUK KAKITANGAN</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>

        {/* Corporate Metadata Footer */}
        <div className="w-full text-center space-y-2 pt-2 border-t border-emerald-500/20">
          <div className="w-full flex items-center justify-center gap-1.5 text-[6.5px] font-mono tracking-wider text-slate-400">
            <div className="h-[1px] bg-emerald-500/20 flex-1 max-w-[50px]" />
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider">POWERED BY</span>
              <span className="font-sans font-black text-white tracking-wider text-[7.5px]">
                Fpm<span className="text-emerald-400">OS</span>
              </span>
              <span className="px-1 py-[0.5px] border border-emerald-500/35 rounded text-emerald-400 font-extrabold text-[6px] bg-emerald-500/10 uppercase leading-none">
                V4.1
              </span>
            </div>
            <div className="h-[1px] bg-emerald-500/20 flex-1 max-w-[50px]" />
          </div>

          <div className="space-y-0.5">
            <p className="text-[8px] font-black tracking-[0.25em] text-slate-500 uppercase leading-none">
              FPMSB INTEGRATED PLANTATION SYSTEM
            </p>
            <div className="flex items-center justify-center pt-0.5">
              <p className="text-[7.5px] font-bold text-slate-600 leading-none">
                © 2026 FPMSB • Hak Cipta Terpelihara
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DEVICE APPROVAL MODAL (PERINGKAT 1 SECURITY) */}
      {deviceApprovalState?.isBlocked && (
        <DeviceApprovalModal
          deviceInfo={deviceApprovalState.device || { deviceId: 'DEV-UNKNOWN', status: 'PENDING' }}
          approvalUrl={deviceApprovalState.approvalUrl}
          onClose={() => {
            if (onClearDeviceApprovalState) {
              onClearDeviceApprovalState();
            }
          }}
          onSuccessApproved={() => {
            if (onClearDeviceApprovalState) {
              onClearDeviceApprovalState();
            }
            // Auto re-trigger staff login using the remembered staff number so
            // the flow continues even though typedDigits was cleared on block.
            submitStaffLogin(lastStaffNoRef.current || undefined);
          }}
        />
      )}
    </div>
  );
}
