import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShieldAlert, Laptop, Smartphone, CheckCircle2, 
  RefreshCw, X, Lock, Copy, Check, 
  Send, Radio, Phone, User, IdCard, KeyRound, ShieldCheck, ChevronDown, ChevronUp,
  Eye, EyeOff, Delete
} from 'lucide-react';
import { getClientDeviceInfo, setDeviceCredential } from '../../../utils/deviceHelper';
import { cleanMalaysiaPhone, formatDisplayMalaysiaPhone } from '../../../utils/phoneUtils';
import { runDeviceApprovalCheck, DEVICE_APPROVAL_POLL_INTERVAL_MS } from '../services/deviceApprovalStatus';

interface DeviceApprovalModalProps {
  deviceInfo: {
    deviceId: string;
    deviceName?: string;
    status: string;
    operatorName?: string;
    createdAt?: string;
  };
  approvalUrl?: string;
  onClose: () => void;
  onSuccessApproved: () => void;
}

export const DeviceApprovalModal: React.FC<DeviceApprovalModalProps> = ({
  deviceInfo,
  approvalUrl,
  onClose,
  onSuccessApproved
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Admin Fast-Approval State (PIN / Direct Unlock)
  const [adminPin, setAdminPin] = useState<string>('');
  const [showPinText, setShowPinText] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [isApprovingWithPin, setIsApprovingWithPin] = useState(false);
  const [showAdminSection, setShowAdminSection] = useState(true);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // FC / Admin WhatsApp Contact Number (Configurable, fetched from server or localStorage)
  const [fcPhoneNumber, setFcPhoneNumber] = useState<string>(() => {
    return cleanMalaysiaPhone(typeof window !== 'undefined' ? localStorage.getItem('ipds_fc_phone') : null) || '60177853551';
  });
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);

  // Applicant Name & Staff Number
  const [applicantName, setApplicantName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ipds_applicant_name') || deviceInfo.operatorName || '';
    }
    return deviceInfo.operatorName || '';
  });

  const [staffNo, setStaffNo] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ipds_applicant_staff_no') || '';
    }
    return '';
  });

  // Sync FC contact number from server and listen for real-time changes
  useEffect(() => {
    fetch('/api/devices/fc-contact')
      .then(res => res.json())
      .then(data => {
        if (data?.contact?.phone) {
          const formatted = cleanMalaysiaPhone(data.contact.phone);
          setFcPhoneNumber(formatted);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ipds_fc_phone', formatted);
          }
        }
      })
      .catch(() => {});

    const handlePhoneUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ phone?: string }>;
      if (customEvent.detail?.phone) {
        const clean = cleanMalaysiaPhone(customEvent.detail.phone);
        setFcPhoneNumber(clean);
      }
    };
    window.addEventListener('ipds_fc_phone_updated', handlePhoneUpdate);
    return () => window.removeEventListener('ipds_fc_phone_updated', handlePhoneUpdate);
  }, []);

  const clientInfo = getClientDeviceInfo();
  const isMobile = clientInfo.platform.includes('Android') || clientInfo.platform.includes('iOS');
  const targetDeviceId = deviceInfo.deviceId || clientInfo.deviceId;
  const targetDeviceName = deviceInfo.deviceName || clientInfo.deviceName;

  const effectiveOperator = [applicantName.trim(), staffNo.trim() ? `(No. ${staffNo.trim()})` : '']
    .filter(Boolean)
    .join(' ') || deviceInfo.operatorName || 'Pengguna Baharu';

  const [currentApprovalUrl, setCurrentApprovalUrl] = useState<string>(approvalUrl || '');

  // Pre-fetch one-time cryptographic approval capability link from server
  useEffect(() => {
    let isMounted = true;
    const fetchCapabilityLink = async () => {
      try {
        const res = await fetch('/api/devices/request-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: targetDeviceId,
            deviceName: targetDeviceName,
            estateId: 'FPM_TUNGGAL',
            requesterName: applicantName.trim() || undefined,
            requesterStaffId: staffNo.trim() || undefined
          })
        });
        const data = await res.json();
        if (isMounted && data?.success && data?.approvalUrl) {
          setCurrentApprovalUrl(data.approvalUrl);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };

    fetchCapabilityLink();
    return () => { isMounted = false; };
  }, [targetDeviceId, targetDeviceName, applicantName, staffNo]);

  // Build the Quick-Approve URL that FC / Admin clicks.
  const quickApproveUrl = typeof window !== 'undefined'
    ? (approvalUrl
        ? new URL(approvalUrl, window.location.origin).toString()
        : (currentApprovalUrl
            ? new URL(currentApprovalUrl, window.location.origin).toString()
            : `${window.location.origin}/api/devices/approve-link`))
    : '';

  // Pre-formatted WhatsApp Message
  const generateWhatsAppMessage = (overrideUrl?: string) => {
    const urlToUse = overrideUrl || quickApproveUrl;
    return `*PERMOHONAN KELULUSAN PERANTI iPDS*
--------------------------------------------
Salam Tuan FC / Pentadbir,

Saya memohon kebenaran akses sistem iPDS bagi peranti baharu ini:

📱 *Peranti*: ${targetDeviceName}
🔑 *ID Peranti*: ${targetDeviceId}
👤 *Nama Pemohon*: ${applicantName.trim() || 'Kakitangan'}
🪪 *No. Kakitangan*: ${staffNo.trim() || '-'}
🏢 *Ladang*: FPMSB TUNGGAL
🕒 *Masa*: ${new Date().toLocaleString('ms-MY')}

👉 *Sila klik pautan di bawah untuk meluluskan peranti ini:*
${urlToUse}`;
  };

  // Open WhatsApp with pre-filled message directly to FC / Admin number
  const handleSendWhatsApp = async () => {
    const cleanPhone = cleanMalaysiaPhone(fcPhoneNumber) || '60177853551';
    if (typeof window !== 'undefined') {
      localStorage.setItem('ipds_fc_phone', cleanPhone);
      if (applicantName.trim()) localStorage.setItem('ipds_applicant_name', applicantName.trim());
      if (staffNo.trim()) localStorage.setItem('ipds_applicant_staff_no', staffNo.trim());
    }

    let dynamicUrl = quickApproveUrl;

    // Fetch fresh one-time approval capability link with latest applicant details
    try {
      const res = await fetch('/api/devices/request-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: targetDeviceId,
          deviceName: targetDeviceName,
          estateId: 'FPM_TUNGGAL',
          requesterName: applicantName.trim() || 'Kakitangan',
          requesterStaffId: staffNo.trim() || undefined
        })
      });
      const data = await res.json();
      if (data?.success && data?.approvalUrl) {
        setCurrentApprovalUrl(data.approvalUrl);
        dynamicUrl = new URL(data.approvalUrl, window.location.origin).toString();
      }
    } catch (err) {
      // Use fallback
    }

    const message = generateWhatsAppMessage(dynamicUrl);
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      if (!document.hidden) {
        window.location.href = waUrl;
      }
    }, 600);
  };

  // Copy approval message & link to clipboard
  const handleCopyMessage = async () => {
    try {
      let dynamicUrl = quickApproveUrl;
      try {
        const res = await fetch('/api/devices/request-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: targetDeviceId,
            deviceName: targetDeviceName,
            estateId: 'FPM_TUNGGAL',
            requesterName: applicantName.trim() || 'Kakitangan',
            requesterStaffId: staffNo.trim() || undefined
          })
        });
        const data = await res.json();
        if (data?.success && data?.approvalUrl) {
          setCurrentApprovalUrl(data.approvalUrl);
          dynamicUrl = new URL(data.approvalUrl, window.location.origin).toString();
        }
      } catch {}

      const message = generateWhatsAppMessage(dynamicUrl);
      await navigator.clipboard.writeText(message);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Gagal menyalin:', err);
    }
  };

  // Direct Approval using Capability Token
  const handleApproveWithCapability = async () => {
    if (!currentApprovalUrl) return;
    setIsChecking(true);
    setErrorMessage(null);
    try {
      let capToken = '';
      try {
        const urlObj = new URL(currentApprovalUrl, window.location.origin);
        capToken = urlObj.searchParams.get('cap') || '';
      } catch {
        capToken = currentApprovalUrl.split('cap=')[1] || '';
      }

      if (!capToken) {
        setErrorMessage('Token kelulusan sistem belum sedia. Sila cuba sebentar lagi.');
        setIsChecking(false);
        return;
      }

      const res = await fetch('/api/devices/approve-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ cap: capToken, action: 'approve', format: 'json' })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (json.credential) {
          setDeviceCredential(json.credential);
        }
        if (approvedHandledRef.current) return;
        approvedHandledRef.current = true;
        triggerApprovalAlert();
        setErrorMessage(null);
        setSuccessMessage('✓ Peranti BERJAYA DILULUSKAN oleh Sistem! Membuka aplikasi...');
        setIsChecking(false);
        successTimerRef.current = setTimeout(() => {
          onSuccessApprovedRef.current();
        }, 1000);
      } else {
        setErrorMessage(json.error || 'Pautan/token kelulusan tidak sah atau telah luput.');
        setIsChecking(false);
      }
    } catch (err) {
      setErrorMessage('Ralat sambungan pelayan semasa meluluskan peranti.');
      setIsChecking(false);
    }
  };

  // Direct Approval using Admin PIN
  const handleApproveWithAdminPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pinToUse = adminPin.trim();
    if (!pinToUse) {
      setErrorMessage('Sila masukkan PIN Pentadbir / FC.');
      return;
    }

    setIsApprovingWithPin(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/devices/approve-with-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: targetDeviceId,
          pin: pinToUse,
          approverName: 'Pentadbir FC'
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (json.credential) {
          setDeviceCredential(json.credential);
        }
        if (approvedHandledRef.current) return;
        approvedHandledRef.current = true;
        triggerApprovalAlert();
        setErrorMessage(null);
        setSuccessMessage(`✓ ${json.message || 'Peranti berjaya diluluskan! Membuka aplikasi...'}`);
        setIsApprovingWithPin(false);
        successTimerRef.current = setTimeout(() => {
          onSuccessApprovedRef.current();
        }, 1000);
      } else {
        setErrorMessage(json.error || 'PIN tidak sah atau bukan akaun Pentadbir.');
        setIsApprovingWithPin(false);
      }
    } catch (err) {
      setErrorMessage('Ralat sambungan pelayan semasa mengesahkan PIN.');
      setIsApprovingWithPin(false);
    }
  };

  // Audio and vibration notification when approval is detected
  const triggerApprovalAlert = () => {
    try {
      if (typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in (window as unknown as Record<string, unknown>))) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([120, 60, 180]);
      }
    } catch {
      // Audio autoplay policy or vibration unsupported
    }
  };

  const approvedHandledRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessApprovedRef = useRef(onSuccessApproved);

  useEffect(() => {
    onSuccessApprovedRef.current = onSuccessApproved;
  }, [onSuccessApproved]);

  const runStatusCheck = useCallback(async (source: 'manual' | 'auto') => {
    if (approvedHandledRef.current) return;

    if (source === 'manual') {
      setIsChecking(true);
      setErrorMessage(null);
    }

    await runDeviceApprovalCheck(targetDeviceId, {
      onApproved: () => {
        if (approvedHandledRef.current) return;
        approvedHandledRef.current = true;
        triggerApprovalAlert();
        setErrorMessage(null);
        setSuccessMessage('✓ Peranti telah DILULUSKAN oleh Pentadbir! Membuka aplikasi...');
        setIsChecking(false);
        successTimerRef.current = setTimeout(() => {
          onSuccessApprovedRef.current();
        }, 1200);
      },
      onPending: () => {
        if (source === 'manual') {
          setErrorMessage('Peranti masih belum diluluskan oleh Pentadbir.');
        }
        setIsChecking(false);
      },
      onError: (message) => {
        if (source === 'manual') {
          setErrorMessage(message);
        }
        setIsChecking(false);
      }
    });
  }, [targetDeviceId]);

  // Automatic poll using shared status check
  useEffect(() => {
    const interval = setInterval(() => {
      runStatusCheck('auto');
    }, DEVICE_APPROVAL_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [runStatusCheck]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleCheckStatus = () => runStatusCheck('manual');

  return (
    <div id="device-approval-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div id="device-approval-modal-card" className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden text-slate-100 my-4">
        
        {/* Ambient Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          id="btn-close-device-modal"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <ShieldAlert size={26} />
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase mt-0.5">
              Peranti Baharu Dikesan
            </h2>
            <p className="text-xs text-slate-300/80 mt-0.5 max-w-xs leading-relaxed">
              Peranti ini memerlukan kelulusan Pentadbir sebelum dibenarkan mengakses data sistem.
            </p>
          </div>
        </div>

        {/* 1. Maklumat Device Card */}
        <div id="device-info-summary" className="my-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              {isMobile ? <Smartphone size={13} className="text-amber-400" /> : <Laptop size={13} className="text-amber-400" />}
              Nama Peranti:
            </span>
            <span className="font-bold text-slate-200 truncate max-w-[180px]">
              {targetDeviceName}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">ID Peranti:</span>
            <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-[11px]">
              {targetDeviceId}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Radio size={12} className="text-amber-400 animate-pulse" />
              Status Akses:
            </span>
            <span className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 text-[11px]">
              <Lock size={12} /> Menunggu Kelulusan
            </span>
          </div>
        </div>

        {/* Status Messages */}
        {errorMessage && (
          <div className="mb-3 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-3 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 animate-bounce">
            <CheckCircle2 size={16} />
            {successMessage}
          </div>
        )}

        {/* 2. PENTADBIR FAST UNLOCK (PIN Pentadbir & One-Click Approval) */}
        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 border border-amber-500/40 shadow-md space-y-2.5">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAdminSection(!showAdminSection)}>
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs uppercase tracking-wide">
              <KeyRound size={14} className="text-amber-400" />
              <span>Kelulusan Terus Pentadbir (Admin PIN)</span>
            </div>
            <button type="button" className="text-slate-400 hover:text-white">
              {showAdminSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showAdminSection && (
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <p className="text-[10.5px] text-slate-300/80 leading-tight">
                Jika anda adalah <strong>Pentadbir / FC</strong> (atau sedang menguji di Google Studio Preview), masukkan PIN Pentadbir untuk meluluskan peranti ini serta-merta:
              </p>

              <form onSubmit={handleApproveWithAdminPin} className="space-y-2">
                <div className="flex gap-1.5 items-center">
                  <div className="relative flex-1">
                    <input
                      ref={pinInputRef}
                      id="input-admin-approval-pin"
                      type={showPinText ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={12}
                      value={adminPin}
                      onChange={(e) => {
                        setErrorMessage(null);
                        setAdminPin(e.target.value);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Masukkan 6-digit PIN Admin"
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 pr-8 text-xs text-amber-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-mono tracking-widest text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinText(!showPinText)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 p-1 cursor-pointer"
                      title={showPinText ? "Sembunyikan PIN" : "Papar PIN"}
                    >
                      {showPinText ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>

                  <button
                    id="btn-admin-approve-pin"
                    type="submit"
                    disabled={isApprovingWithPin || !adminPin.trim()}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isApprovingWithPin ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    <span>Luluskan</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-300">
                  <span>PIN FC Tunggal: <strong className="font-mono font-bold text-amber-200">2401199</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminPin("2401199");
                      setErrorMessage(null);
                    }}
                    className="rounded bg-amber-500/20 hover:bg-amber-500/30 px-1.5 py-0.5 font-bold text-amber-200 text-[9px] transition-colors cursor-pointer"
                  >
                    Guna PIN Ini
                  </button>
                </div>

                {/* Optional Keypad Toggle Button for Touch / Kiosk Devices */}
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowKeypad(!showKeypad)}
                    className="text-[10px] text-amber-400/90 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound size={10} />
                    <span>{showKeypad ? "Tutup Pad Kekunci Skrin" : "Guna Pad Kekunci Skrin (Sentuhan)"}</span>
                  </button>
                  {adminPin && (
                    <button
                      type="button"
                      onClick={() => setAdminPin('')}
                      className="text-[10px] text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      Padam PIN
                    </button>
                  )}
                </div>

                {/* On-Screen Virtual Keypad */}
                {showKeypad && (
                  <div className="p-2 bg-slate-950/90 border border-amber-500/30 rounded-xl grid grid-cols-3 gap-1.5 animate-fadeIn">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setAdminPin((prev) => (prev.length < 10 ? prev + String(num) : prev));
                        }}
                        className="py-2 bg-slate-900 hover:bg-amber-500/20 active:bg-amber-500/40 text-amber-200 hover:text-amber-100 font-mono font-bold text-sm rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAdminPin('')}
                      className="py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs rounded-lg border border-rose-900/50 transition-colors cursor-pointer"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setAdminPin((prev) => (prev.length < 10 ? prev + '0' : prev));
                      }}
                      className="py-2 bg-slate-900 hover:bg-amber-500/20 active:bg-amber-500/40 text-amber-200 hover:text-amber-100 font-mono font-bold text-sm rounded-lg border border-slate-800 transition-colors cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPin((prev) => prev.slice(0, -1))}
                      className="py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-lg border border-slate-800 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <Delete size={14} />
                    </button>
                  </div>
                )}
              </form>

              {currentApprovalUrl && (
                <button
                  id="btn-one-click-system-approval"
                  type="button"
                  onClick={handleApproveWithCapability}
                  disabled={isChecking}
                  className="w-full py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 mt-1"
                >
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Sahkan Kelulusan Menggunakan Token Sistem</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Row: Nama Pemohon dan No. Kakitangan (WhatsApp Workflow) */}
        <div className="mb-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-1">
                <User size={11} className="text-emerald-400" />
                Nama Pemohon:
              </label>
              <input
                id="input-applicant-name"
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="Cth: Mohd Faizal"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-emerald-200 placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-1">
                <IdCard size={11} className="text-emerald-400" />
                No. Kakitangan:
              </label>
              <input
                id="input-applicant-staff-no"
                type="text"
                value={staffNo}
                onChange={(e) => setStaffNo(e.target.value)}
                placeholder="Cth: 500201"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-emerald-200 placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* WhatsApp Admin Contact Indicator & Edit Option */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-400 overflow-hidden">
              <Phone size={12} className="text-[#25D366] shrink-0" />
              <span>Admin:</span>
              <span className="font-mono font-bold text-emerald-300 text-[11px]">
                +{cleanMalaysiaPhone(fcPhoneNumber)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                ({formatDisplayMalaysiaPhone(fcPhoneNumber)})
              </span>
            </div>
            <button
              id="btn-toggle-admin-phone"
              type="button"
              onClick={() => setShowPhoneEdit(!showPhoneEdit)}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer shrink-0 ml-2"
            >
              {showPhoneEdit ? 'Tutup' : 'Tukar No.'}
            </button>
          </div>

          {showPhoneEdit && (
            <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-1.5 animate-fadeIn">
              <label className="text-[9.5px] font-bold text-slate-300 uppercase tracking-wider block">
                Tukar No. WhatsApp Admin:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="tel"
                  value={fcPhoneNumber}
                  onChange={(e) => setFcPhoneNumber(e.target.value)}
                  placeholder="Cth: 017-7853551"
                  className="flex-1 bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const formatted = cleanMalaysiaPhone(fcPhoneNumber);
                    setFcPhoneNumber(formatted);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('ipds_fc_phone', formatted);
                      window.dispatchEvent(new CustomEvent('ipds_fc_phone_updated', { detail: { phone: formatted } }));
                    }
                    try {
                      await fetch('/api/devices/fc-contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: formatted, name: 'MD NASRUDDIN (Admin)' })
                      });
                    } catch (err) {
                      console.warn('Sync contact error:', err);
                    }
                    setShowPhoneEdit(false);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Simpan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Button Link WhatsApp untuk Hantar kepada Admin */}
        <div className="space-y-2">
          <button
            id="btn-send-whatsapp-approval"
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(37,211,102,0.25)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send size={15} />
            <span>Hantar ke WhatsApp Admin</span>
          </button>

          <button
            id="btn-copy-approval-link"
            type="button"
            onClick={handleCopyMessage}
            className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{isCopied ? 'Mesej Permohonan Telah Disalin!' : 'Salin Mesej & Pautan Permohonan'}</span>
          </button>
        </div>

        {/* Footer: Semak Status & Kembali */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <button
            id="btn-check-status-manual"
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} className={isChecking ? "animate-spin" : ""} />
            <span>Semak Status Sekarang</span>
          </button>

          <button
            id="btn-back-to-login"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            Kembali ke Log Masuk
          </button>
        </div>

      </div>
    </div>
  );
};

