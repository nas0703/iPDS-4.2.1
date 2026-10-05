import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { getLocalLogo, fetchSupabaseLogo } from "../../../services/logoService";
import { normalizeEstateId } from "../../../config/estateRegistry";
import { runKioskLoginAttempt } from "../services/kioskLoginFlow";
import { DeviceApprovalModal } from "./DeviceApprovalModal";

interface LoginScreenProps {
  isDarkMode: boolean;
  isVerifying: boolean;
  verifyStaffCredentials: (estateCode: string, staffNo: string) => Promise<boolean>;
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

const ESTATE_CODE_MAP: Record<string, string> = {
  "0001": "FPM WILAYAH JOHOR BAHRU",
  WJB: "FPM WILAYAH JOHOR BAHRU",
  "5155": "LADANG FPM TUNGGAL",
  "5136": "LADANG FPM ADELA",
  "5176": "LADANG FPM KLEDANG",
  "5156": "LADANG FPM SENING",
};

export function LoginScreen({
  isDarkMode,
  isVerifying,
  verifyStaffCredentials,
  deviceApprovalState,
  onClearDeviceApprovalState,
}: LoginScreenProps) {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => getLocalLogo());
  const [estateCode, setEstateCode] = useState("");
  const [staffNo, setStaffNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastStaffNoRef = useRef("");
  const [idleNotice, setIdleNotice] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem("ipds_idle_timeout_notice");
      if (msg) {
        sessionStorage.removeItem("ipds_idle_timeout_notice");
        return msg;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    fetchSupabaseLogo().then((url) => {
      if (url) setCustomLogoUrl(url);
    }).catch(() => {});
  }, []);

  const submitLogin = async (staffNoToSubmit?: string) => {
    if (isSubmitting || isVerifying) return;
    const cleanEstateCode = estateCode.trim().toUpperCase();
    const cleanStaffNo = (staffNoToSubmit || staffNo).trim().toUpperCase();
    if (!cleanEstateCode) {
      setErrorMessage("Sila masukkan Kod Ladang.");
      return;
    }
    if (!cleanStaffNo) {
      setErrorMessage("Sila masukkan No. Kakitangan.");
      return;
    }

    lastStaffNoRef.current = cleanStaffNo;
    setErrorMessage(null);
    setIdleNotice(null);
    const result = await runKioskLoginAttempt(verifyStaffCredentials, cleanEstateCode, cleanStaffNo, setIsSubmitting);
    if (!result.success) {
      // Don't show invalid credential error if device approval modal was triggered
      if (!deviceApprovalState?.isBlocked) {
        setErrorMessage(result.requestFailed
          ? "Log masuk gagal buat sementara waktu. Sila semak maklumat dan cuba lagi."
          : "Kod Ladang atau No. Kakitangan tidak sah. Sila semak dan cuba lagi.");
      }
    }
  };

  const isBusy = isSubmitting || isVerifying;
  const estateName = ESTATE_CODE_MAP[estateCode.trim().toUpperCase()] ||
    (normalizeEstateId(estateCode) !== estateCode.trim().toUpperCase() ? normalizeEstateId(estateCode) : "");

  return (
    <div className={`max-w-md mx-auto min-h-screen ${isDarkMode ? "bg-[#090f1e]" : "bg-slate-950"} flex flex-col justify-center items-center py-6 px-4 relative overflow-hidden transition-colors duration-500`}>
      <div className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 flex flex-col items-center space-y-5 shadow-[0_0_45px_rgba(0,0,0,0.7)] backdrop-blur-md overflow-hidden my-auto">
        <div className="w-full flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-950 border border-emerald-500/50 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)] overflow-hidden mb-3 p-2">
            {customLogoUrl ? (
              <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full flex items-center justify-center select-none p-1 bg-black rounded-xl">
                <svg viewBox="0 0 880 380" className="w-full max-w-[96%] h-auto select-none" aria-hidden="true">
                  <rect x="10" y="30" width="56" height="56" rx="14" fill="#2fd51d" />
                  <rect x="10" y="118" width="56" height="236" rx="28" fill="#FFFFFF" />
                  <path d="M 120 58 L 228 58 A 86 86 0 0 1 314 144 A 86 86 0 0 1 228 230 L 172 230 A 28 28 0 0 0 144 258 L 144 330" fill="none" stroke="#FFFFFF" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 376 138 L 376 58 A 28 28 0 0 1 404 30 L 442 30 A 60 60 0 0 1 460 84 A 72 72 0 0 1 428 184 L 400 184 A 24 24 0 0 1 376 160 Z" fill="#2fd51d" />
                  <path d="M 440 58 L 476 58 A 142 142 0 0 1 618 200 A 142 142 0 0 1 476 342 L 404 342 A 28 28 0 0 1 376 314 L 376 164" fill="none" stroke="#FFFFFF" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 790 72 C 782 42 740 30 694 30 C 632 30 606 60 606 108 C 606 162 656 182 710 198 C 772 214 808 240 808 288 C 808 340 764 374 690 374 C 630 374 596 346 588 316" fill="none" stroke="#FFFFFF" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
          <div className="text-center space-y-1 w-full">
            <h2 className="text-[12px] sm:text-[13px] font-black tracking-[0.18em] text-emerald-400 uppercase leading-none">INTEGRATED PLANTATION DATA SYSTEM</h2>
            <h1 className="text-[10.5px] sm:text-[11px] font-black tracking-widest text-white/90 uppercase leading-tight pt-1">FPM WILAYAH JOHOR BAHRU</h1>
            {estateName && <p className="text-[10px] font-bold text-emerald-300 uppercase pt-1">{estateName}</p>}
          </div>
        </div>

        <form
          className="w-full space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitLogin();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="login-estate-code" className="block text-[11px] font-bold uppercase tracking-wider text-emerald-200">Kod Ladang</label>
            <div className="relative">
              <Building2 size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" aria-hidden="true" />
              <input
                id="login-estate-code"
                name="estateCode"
                type="text"
                autoComplete="off"
                maxLength={32}
                value={estateCode}
                onChange={(event) => { setEstateCode(event.target.value); setErrorMessage(null); }}
                disabled={isBusy}
                placeholder="Contoh: 5155 atau WJB"
                className="w-full rounded-xl border border-emerald-500/30 bg-slate-950/80 py-3 pl-10 pr-3 text-sm font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-staff-no" className="block text-[11px] font-bold uppercase tracking-wider text-emerald-200">No. Kakitangan</label>
            <input
              id="login-staff-no"
              name="staffNo"
              type="text"
              autoComplete="username"
              maxLength={64}
              value={staffNo}
              onChange={(event) => { setStaffNo(event.target.value); setErrorMessage(null); }}
              disabled={isBusy}
              placeholder="Contoh: TGL-FC-2026"
              className="w-full rounded-xl border border-emerald-500/30 bg-slate-950/80 px-3 py-3 text-sm font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 disabled:opacity-60"
            />
          </div>

          {errorMessage && !deviceApprovalState?.isBlocked && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-xs font-bold text-rose-300">
              {errorMessage}
            </p>
          )}

          {idleNotice && !errorMessage && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-semibold text-amber-200">
              <Clock size={15} className="shrink-0 text-amber-400" />
              <span>{idleNotice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy || !estateCode.trim() || !staffNo.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isBusy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={18} />}
            <span>{isBusy ? "MENGESAHKAN..." : "LOG MASUK"}</span>
            {!isBusy && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="w-full border-t border-emerald-500/20 pt-3 text-center">
          <p className="text-[8px] font-black tracking-[0.25em] text-slate-500 uppercase">FPMSB INTEGRATED PLANTATION SYSTEM</p>
          <p className="pt-1 text-[8px] font-bold text-slate-600">© 2026 FPMSB</p>
        </div>
      </div>

      {deviceApprovalState?.isBlocked && (
        <DeviceApprovalModal
          deviceInfo={deviceApprovalState.device || { deviceId: "DEV-UNKNOWN", status: "PENDING" }}
          approvalUrl={deviceApprovalState.approvalUrl}
          onClose={() => onClearDeviceApprovalState?.()}
          onSuccessApproved={() => {
            onClearDeviceApprovalState?.();
            void submitLogin(lastStaffNoRef.current || undefined);
          }}
        />
      )}
    </div>
  );
}
