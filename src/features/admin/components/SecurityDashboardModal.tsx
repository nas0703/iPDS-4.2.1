import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, ShieldCheck, Activity, Users, AlertTriangle, 
  Search, RefreshCw, X, LogOut, Globe, Smartphone, Laptop, 
  Lock, Clock, Building2, UserX, CheckCircle2, ChevronDown, 
  FileSpreadsheet, Filter, Ban, Eye, Flame, Shield, Radio,
  MessageSquare, Send, Check, Copy, KeyRound, Phone, ExternalLink, GitMerge
} from 'lucide-react';
import { ESTATES_REGISTRY, EstateConfig } from '../../../config/estateRegistry';
import { cleanMalaysiaPhone, toLocalMalaysiaPhone, formatDisplayMalaysiaPhone } from '../../../utils/phoneUtils';
import { setDeviceCredential } from '../../../utils/deviceHelper';
import { DeviceMergeModal } from './DeviceMergeModal';

export interface RegisteredDevice {
  id: string;
  device_id: string;
  device_name: string;
  estate_id: string;
  operator_name: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REVOKED';
  approved_by?: string;
  approved_at?: string;
  last_seen?: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  operatorName: string;
  role: string;
  estateId: string;
  kioskId: string;
  stationName: string;
  ip: string;
  userAgent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface LoginAudit {
  id: string;
  timestamp: string;
  authMethod: 'PIN_KIOSK' | 'ESTATE_STAFF_PIN' | 'ENTERPRISE_PASSWORD' | 'SESSION_TOKEN';
  identifier: string;
  operatorName?: string;
  role?: string;
  attemptedEstate: string;
  assignedEstate?: string;
  status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED_CROSS_ESTATE' | 'RATE_LIMITED' | 'SESSION_EXPIRED' | 'SESSION_REVOKED';
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip: string;
  userAgent: string;
  notes?: string;
  flagged?: boolean;
}

export interface SecuritySummary {
  totalActiveSessions: number;
  estateBreakdown: Record<string, number>;
  recentThreatsCount: number;
  failedAttempts24h: number;
  crossEstateAttempts24h: number;
}

interface SecurityDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  initialTab?: 'overview' | 'sessions' | 'devices' | 'history' | 'threats';
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

function getSecurityAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  const token =
    localStorage.getItem('ipds_token') ||
    sessionStorage.getItem('ipds_token') ||
    localStorage.getItem('fpm_auth_token') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('fpm_auth_token') ||
    '';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const SecurityDashboardModal: React.FC<SecurityDashboardModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  initialTab = 'overview',
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'devices' | 'history' | 'threats'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10s default
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Dashboard Data State
  const [summary, setSummary] = useState<SecuritySummary>({
    totalActiveSessions: 0,
    estateBreakdown: {
      'FPM_TUNGGAL': 0,
      'FPM_ADELA': 0,
      'FPM_KLEDANG': 0,
      'FPM_SENING': 0
    },
    recentThreatsCount: 0,
    failedAttempts24h: 0,
    crossEstateAttempts24h: 0
  });
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginAudit[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<LoginAudit[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [pendingDevicesCount, setPendingDevicesCount] = useState<number>(0);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [approvingDeviceId, setApprovingDeviceId] = useState<string | null>(null);

  // P0-16C.4: one-time existing-device credential rotation.
  // The plaintext credential is held ONLY in this transient state and is cleared
  // when the admin dismisses the panel. It is never logged or placed in a URL.
  const [rotatingDeviceId, setRotatingDeviceId] = useState<string | null>(null);
  const [issuedCredential, setIssuedCredential] = useState<{
    deviceId: string;
    deviceName: string;
    estateId: string;
    credential: string;
    credentialVersion: number;
    rotatedAt?: string;
  } | null>(null);
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [credentialStored, setCredentialStored] = useState(false);

  // FC WhatsApp Contact for receiving staff approval requests
  const [fcPhoneNumber, setFcPhoneNumber] = useState<string>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ipds_fc_phone') : null;
    return cleanMalaysiaPhone(raw);
  });
  const [phoneDraft, setPhoneDraft] = useState<string>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ipds_fc_phone') : null;
    return toLocalMalaysiaPhone(raw);
  });
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  const [selectedEstateFilter, setSelectedEstateFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [threatOnlyFilter, setThreatOnlyFilter] = useState<boolean>(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokeConfirmSession, setRevokeConfirmSession] = useState<ActiveSession | null>(null);
  const [revokeReason, setRevokeReason] = useState('Tamatan manual oleh Pentadbir Utama');

  // Sync initial tab when changed
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch Dashboard Data & Registered Devices from Server
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEstateFilter !== 'ALL') params.append('estate_id', selectedEstateFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (threatOnlyFilter) params.append('threat_only', 'true');

      const headers = getSecurityAuthHeaders();

      // Parallel fetch: dashboard audit & registered devices
      const [res, devRes] = await Promise.allSettled([
        fetch(`/api/auth/super-admin/dashboard?${params.toString()}`, {
          headers,
          credentials: 'include'
        }),
        fetch(`/api/devices/list?estateId=${encodeURIComponent(selectedEstateFilter || 'ALL')}`, {
          headers,
          credentials: 'include'
        })
      ]);

      if (res.status === 'fulfilled' && res.value.ok) {
        const json = await res.value.json();
        if (json.success) {
          setSummary({
            totalActiveSessions: Number(json.summary?.totalActiveSessions) || 0,
            estateBreakdown: json.summary?.estateBreakdown || {
              'FPM_TUNGGAL': 0,
              'FPM_ADELA': 0,
              'FPM_KLEDANG': 0,
              'FPM_SENING': 0
            },
            recentThreatsCount: Number(json.summary?.recentThreatsCount) || 0,
            failedAttempts24h: Number(json.summary?.failedAttempts24h) || 0,
            crossEstateAttempts24h: Number(json.summary?.crossEstateAttempts24h) || 0
          });
          setActiveSessions(json.activeSessions || []);
          setLoginHistory(json.loginHistory || []);
          setSecurityAlerts(json.securityAlerts || []);
          setLastRefreshed(new Date());
        }
      }

      if (devRes.status === 'fulfilled' && devRes.value.ok) {
        const devJson = await devRes.value.json();
        if (devJson.success && Array.isArray(devJson.devices)) {
          setDevices(devJson.devices);
          const pending = devJson.devices.filter((d: RegisteredDevice) => d.status === 'PENDING').length;
          setPendingDevicesCount(pending);
        }
      }
    } catch (err: unknown) {
      console.error('Fetch security dashboard error:', err);
      if (!isSilent && showToast) {
        showToast(err instanceof Error ? err.message : 'Ralat semasa memuatkan data sesi.', 'error');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedEstateFilter, statusFilter, searchQuery, threatOnlyFilter, showToast]);

  // Initial & Auto refresh timer
  useEffect(() => {
    if (!isOpen) return;
    fetchDashboardData();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, refreshInterval, fetchDashboardData]);

  // Fetch FC Contact once when modal opens and listen for real-time updates
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/devices/fc-contact')
      .then(r => r.json())
      .then(d => {
        if (d?.contact?.phone) {
          const cleanPhone = cleanMalaysiaPhone(d.contact.phone);
          setFcPhoneNumber(cleanPhone);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ipds_fc_phone', cleanPhone);
          }
          setPhoneDraft(prev => {
            if (!isEditingPhone) return toLocalMalaysiaPhone(cleanPhone);
            return prev;
          });
        }
      })
      .catch(() => {});

    const handleUpdate = (e: any) => {
      if (e.detail?.phone) {
        const clean = cleanMalaysiaPhone(e.detail.phone);
        setFcPhoneNumber(clean);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ipds_fc_phone', clean);
        }
        setPhoneDraft(prev => {
          if (!isEditingPhone) return toLocalMalaysiaPhone(clean);
          return prev;
        });
      }
    };
    window.addEventListener('ipds_fc_phone_updated', handleUpdate);
    return () => window.removeEventListener('ipds_fc_phone_updated', handleUpdate);
  }, [isOpen, isEditingPhone]);

  // Kill Session Handler
  const handleRevokeSession = async () => {
    if (!revokeConfirmSession) return;
    setRevokingSessionId(revokeConfirmSession.sessionId);
    try {
      const headers = getSecurityAuthHeaders();

      const res = await fetch('/api/auth/super-admin/revoke-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          sessionId: revokeConfirmSession.sessionId,
          reason: revokeReason || 'Tamatan manual dari dashboard keselamatan'
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (showToast) {
          showToast(`Sesi ${revokeConfirmSession.operatorName} (${revokeConfirmSession.estateId}) telah ditamatkan serta-merta.`, 'success');
        }
        setRevokeConfirmSession(null);
        fetchDashboardData(true);
      } else {
        throw new Error(json.error || 'Gagal menamatkan sesi.');
      }
    } catch (err: unknown) {
      if (showToast) {
        showToast(err instanceof Error ? err.message : 'Ralat semasa menamatkan sesi.', 'error');
      }
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Device Approval Handlers
  const handleApproveDevice = async (deviceId: string) => {
    setApprovingDeviceId(deviceId);
    try {
      const headers = getSecurityAuthHeaders();

      const res = await fetch('/api/devices/approve', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ deviceId })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (showToast) showToast('Peranti berjaya diluluskan untuk akses penuh sistem iPDS!', 'success');
        fetchDashboardData(true);
      } else {
        if (showToast) showToast(json.error || 'Gagal meluluskan peranti.', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Ralat sambungan pelayan semasa meluluskan peranti.', 'error');
    } finally {
      setApprovingDeviceId(null);
    }
  };

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Adakah anda pasti mahu menyekat peranti "${deviceName}" (${deviceId}) serta-merta?`)) {
      return;
    }

    try {
      const headers = getSecurityAuthHeaders();

      const res = await fetch('/api/devices/revoke', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ deviceId, reason: 'Disekat oleh FC dari Security Dashboard' })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (showToast) showToast(`Peranti "${deviceName}" telah disekat.`, 'info');
        fetchDashboardData(true);
      } else {
        if (showToast) showToast(json.error || 'Gagal menyekat peranti.', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Ralat menyekat peranti.', 'error');
    }
  };

  /**
   * P0-16C.4: rotate an existing APPROVED device's credential. This is an
   * EXPLICIT admin action only — never triggered on dashboard open or refresh.
   * The server authorizes by the device's recorded estate; the plaintext is
   * displayed once and cleared from UI state on dismissal.
   */
  const handleRotateCredential = async (device: RegisteredDevice) => {
    if (!confirm(`Putar kredensial keselamatan untuk peranti "${device.device_name}" (${device.device_id})?\n\nKredensial lama akan TERUS tidak sah. Kredensial baharu dipaparkan SEKALI sahaja.`)) {
      return;
    }

    setRotatingDeviceId(device.device_id);
    try {
      const headers = getSecurityAuthHeaders();

      const res = await fetch('/api/devices/rotate-credential', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ deviceId: device.device_id })
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.deviceCredential) {
        setIssuedCredential({
          deviceId: device.device_id,
          deviceName: device.device_name,
          estateId: json.estateId || device.estate_id,
          credential: json.deviceCredential,
          credentialVersion: Number(json.credentialVersion) || 0,
          rotatedAt: json.rotatedAt
        });
        setCredentialCopied(false);
        setCredentialStored(false);
        fetchDashboardData(true);
        if (showToast) showToast('Kredensial peranti berjaya diputar. Sila simpan kredensial baharu sekarang.', 'success');
      } else {
        if (showToast) showToast(json?.error || 'Gagal memutar kredensial peranti.', 'error');
      }
    } catch (err) {
      if (showToast) showToast('Ralat sambungan pelayan semasa memutar kredensial peranti.', 'error');
    } finally {
      setRotatingDeviceId(null);
    }
  };

  const handleCopyCredential = async () => {
    if (!issuedCredential) return;
    try {
      await navigator.clipboard.writeText(issuedCredential.credential);
      setCredentialCopied(true);
      setTimeout(() => setCredentialCopied(false), 2500);
    } catch {
      // Clipboard unavailable — admin can still select the text manually.
    }
  };

  const handleStoreCredentialOnDevice = () => {
    if (!issuedCredential) return;
    setDeviceCredential(issuedCredential.credential);
    setCredentialStored(true);
    if (showToast) showToast('Kredensial disimpan pada pelayar peranti ini.', 'success');
  };

  const handleDismissCredential = () => {
    setIssuedCredential(null);
    setCredentialCopied(false);
    setCredentialStored(false);
  };

  const handleSaveFcPhone = async () => {
    setIsSavingPhone(true);
    try {
      const cleaned = cleanMalaysiaPhone(phoneDraft);

      if (!cleaned || cleaned.length < 9) {
        if (showToast) showToast('Sila masukkan nombor telefon yang sah (contoh: 011-38404285 atau +601138404285)', 'error');
        setIsSavingPhone(false);
        return;
      }

      const res = await fetch('/api/devices/fc-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, name: 'MD NASRUDDIN (FC Tunggal / Admin)' })
      });
      const json = await res.json();
      if (json.success && json.contact?.phone) {
        const savedPhone = cleanMalaysiaPhone(json.contact.phone);
        setFcPhoneNumber(savedPhone);
        setPhoneDraft(toLocalMalaysiaPhone(savedPhone));
        if (typeof window !== 'undefined') {
          localStorage.setItem('ipds_fc_phone', savedPhone);
          window.dispatchEvent(new CustomEvent('ipds_fc_phone_updated', { detail: { phone: savedPhone } }));
        }
        setPhoneSuccess(true);
        setIsEditingPhone(false);
        if (showToast) showToast(`Nombor WhatsApp FC berjaya disimpan kekal ke Supabase: +${savedPhone}`, 'success');
        setTimeout(() => setPhoneSuccess(false), 3500);
      } else {
        throw new Error(json.error || 'Gagal menyimpan');
      }
    } catch (err) {
      if (showToast) showToast('Ralat mengemaskini nombor WhatsApp FC.', 'error');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleShareWhatsAppStatus = (device: RegisteredDevice) => {
    const isApproved = device.status === 'APPROVED';
    const quickApproveUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/api/devices/quick-approve?deviceId=${encodeURIComponent(device.device_id)}`
      : '';

    const msg = `*PENGESAHAN STATUS KESELAMATAN PERANTI iPDS*
----------------------------------------
Salam, berikut adalah status terkini pendaftaran peranti anda:

📱 *Peranti*: ${device.device_name}
🔑 *ID*: ${device.device_id}
👤 *Pengendali*: ${device.operator_name}
🏢 *Ladang*: ${device.estate_id || 'FPM_TUNGGAL'}
📊 *Status*: ${isApproved ? '✓ DILULUSKAN (Akses Dibenarkan)' : '✕ MENUNGGU KELULUSAN / DISEKAT'}
${device.approved_by ? `✍️ *Pengesah*: ${device.approved_by}\n` : ''}🕒 *Masa*: ${new Date().toLocaleString('ms-MY')}

${isApproved ? 'Sila buka aplikasi iPDS untuk meneruskan operasi harian.' : `Pautan Kelulusan:\n${quickApproveUrl}`}`;

    // Auto copy message to clipboard
    navigator.clipboard.writeText(msg).catch(() => {});
    if (showToast) showToast('Mesej status disalin ke papan klip!', 'success');

    // Prompt for staff phone number or direct WhatsApp
    const phonePrompt = prompt(
      `Hantar status ke WhatsApp Staf (${device.operator_name || 'Pemohon'}):\n\nMasukkan nombor telefon staf (cth: 0137788990) atau biarkan kosong dan tekan OK untuk pilih kenalan di WhatsApp:`, 
      ''
    );
    if (phonePrompt === null) return;

    let clean = phonePrompt.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '60' + clean.slice(1);
    else if (!clean.startsWith('60') && clean.length >= 8) clean = '60' + clean;

    const url = clean 
      ? `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  // Export audit log to CSV
  const handleExportCSV = () => {
    try {
      const headers = ['Masa', 'Kaedah', 'No. Kakitangan / ID', 'Nama Pengguna', 'Peranan', 'Ladang Sasaran', 'Ladang Asal', 'Status', 'Tahap Ancaman', 'IP Address', 'Catatan'];
      const rows = loginHistory.map(item => [
        new Date(item.timestamp).toLocaleString('ms-MY'),
        item.authMethod,
        item.identifier,
        `"${(item.operatorName || '').replace(/"/g, '""')}"`,
        item.role || '',
        item.attemptedEstate,
        item.assignedEstate || '',
        item.status,
        item.threatLevel,
        item.ip,
        `"${(item.notes || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `AUDIT_KESELAMATAN_SESI_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (showToast) showToast('Laporan audit keselamatan berjaya dimuat turun (CSV).', 'success');
    } catch (e) {
      console.error('Export CSV error:', e);
      if (showToast) showToast('Gagal memuat turun fail CSV.', 'error');
    }
  };

  // Format Helper
  const formatTimeAgo = (dateString: string) => {
    try {
      const diffMs = Date.now() - new Date(dateString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return `${diffSec} saat lalu`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} minit lalu`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} jam lalu`;
      return `${Math.floor(diffHr / 24)} hari lalu`;
    } catch {
      return dateString;
    }
  };

  // Get Estate Display Info
  const getEstateName = (estateId: string) => {
    try {
      const registryValues = Object.values(ESTATES_REGISTRY || {}) as EstateConfig[];
      const matched = registryValues.find(e => e?.id === estateId || e?.code === estateId);
      return matched ? `${matched.name} (${matched.code})` : (estateId || 'FPM Tunggal');
    } catch {
      return estateId || 'FPM Tunggal';
    }
  };

  // Render Threat Badge
  const renderThreatBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border animate-pulse ${
            isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-100 text-rose-700 border-rose-300'
          }`}>
            <Flame size={12} className={isDarkMode ? 'text-rose-400' : 'text-rose-600'} />
            KRITIKAL
          </span>
        );
      case 'HIGH':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            <AlertTriangle size={12} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />
            TINGGI
          </span>
        );
      case 'MEDIUM':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
            isDarkMode ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-100 text-yellow-800 border-yellow-300'
          }`}>
            SEDERHANA
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
            isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          }`}>
            NORMAL
          </span>
        );
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: LoginAudit['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          }`}>
            <CheckCircle2 size={11} /> BERJAYA
          </span>
        );
      case 'UNAUTHORIZED_CROSS_ESTATE':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border animate-pulse ${
            isDarkMode ? 'bg-rose-600/30 text-rose-300 border-rose-500' : 'bg-rose-100 text-rose-800 border-rose-300'
          }`}>
            <Ban size={11} /> SILANG LADANG DITEGAH
          </span>
        );
      case 'INVALID_CREDENTIALS':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            <UserX size={11} /> PIN / KATA LALUAN SALAH
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-800 border-purple-300'
          }`}>
            <Lock size={11} /> KUNCI SEKATAN RATE LIMIT
          </span>
        );
      case 'SESSION_REVOKED':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDarkMode ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : 'bg-slate-200 text-slate-700 border-slate-300'
          }`}>
            <LogOut size={11} /> SESI DITAMATKAN
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
            isDarkMode ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            {status}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-1.5 sm:p-5 overflow-y-auto bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-7xl h-[95dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden my-auto ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-emerald-950/20'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
          }`}
        >
          {/* Top Header Bar - Always visible and pinned */}
          <div className={`flex-shrink-0 px-3.5 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between gap-2.5 sm:gap-3 z-30 ${
            isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 shrink-0">
                <ShieldAlert size={20} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-lg font-black tracking-tight uppercase truncate">
                    Dashboard Keselamatan
                  </h2>
                  <span className="text-[9px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    SUPER ADMIN
                  </span>
                  {summary.recentThreatsCount > 0 && (
                    <span className="text-[9px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1 animate-pulse shrink-0">
                      <Flame size={11} /> {summary.recentThreatsCount} Ancaman
                    </span>
                  )}
                </div>
                <p className={`text-[11px] sm:text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Pemantauan Sesi Masa Nyata & Kelulusan Peranti
                </p>
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  autoRefresh
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Auto Refresh Status"
              >
                <Radio size={13} className={autoRefresh ? 'text-emerald-400 animate-pulse' : ''} />
                <span className="hidden xs:inline">Live: {autoRefresh ? `${refreshInterval / 1000}s` : 'Mati'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchDashboardData()}
                disabled={loading}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Muat Semula</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                }`}
              >
                <FileSpreadsheet size={13} />
                <span className="hidden sm:inline">Eksport CSV</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isDarkMode
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Scrollable Body - Entire dashboard scrolls smoothly on mobile & desktop */}
          <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col min-h-0 touch-pan-y">
            {/* Metric Summary Cards */}
            <div className={`p-3 sm:p-5 border-b grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 flex-shrink-0 ${
              isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200'
            }`}>
            {/* Card 1: Total Active Sessions */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Sesi Aktif Sekarang
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  {summary.totalActiveSessions}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Di semua kiosk & peranti
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Activity size={20} className="animate-pulse" />
              </div>
            </div>

            {/* Card 2: Unauthorized Cross-Estate Blocks */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              summary.crossEstateAttempts24h > 0
                ? isDarkMode ? 'bg-rose-950/30 border-rose-500/40' : 'bg-rose-50 border-rose-200 shadow-sm'
                : isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  Sekatan Silang Ladang
                </span>
                <span className="text-2xl font-black text-rose-400">
                  {summary.crossEstateAttempts24h}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Dalam 24 Jam Terakhir
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Ban size={20} />
              </div>
            </div>

            {/* Card 3: Failed Login Attempts */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Cubaan Gagal (24 Jam)
                </span>
                <span className="text-2xl font-black text-amber-400">
                  {summary.failedAttempts24h}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  PIN Salah / Rate Limited
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle size={20} />
              </div>
            </div>

            {/* Card 4: Estate Distribution */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Taburan Sesi Ladang
                </span>
                <Building2 size={15} className="text-slate-400" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['FPM_TUNGGAL', 'FPM_ADELA', 'FPM_KLEDANG', 'FPM_SENING'].map(code => {
                  const breakdown = summary?.estateBreakdown || {};
                  const count = breakdown[code] || 0;
                  const shortName = code.replace('FPM_', '');
                  return (
                    <span 
                      key={code}
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        count > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isDarkMode ? 'bg-slate-800/60 text-slate-500 border-slate-700/50' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      {shortName}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

            {/* Navigation Tabs & Filter Bar (Sticky below top header on scroll) */}
            <div className={`sticky top-0 z-20 px-3 sm:px-5 py-2 sm:py-3 border-b flex flex-wrap items-center justify-between gap-2.5 backdrop-blur-md shadow-sm ${
              isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
            }`}>
              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/40 border border-slate-800/80 overflow-x-auto max-w-full no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ringkasan Keselamatan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'sessions'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={13} />
                  <span>Sesi Aktif ({activeSessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('devices')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'devices'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : isDarkMode ? 'text-amber-400 hover:text-amber-300' : 'text-amber-700 hover:text-amber-800'
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Peranti ({devices.length})</span>
                  {pendingDevicesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-rose-600 text-white font-black animate-pulse shadow-sm">
                      {pendingDevicesCount} Menunggu
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'history'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={13} />
                  <span>Log Masuk Penuh ({loginHistory.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('threats')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'threats'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : isDarkMode ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'
                  }`}
                >
                  <AlertTriangle size={13} />
                  <span>Ancaman & Amaran ({securityAlerts.length})</span>
                </button>
              </div>

              {/* Filter Tools */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Estate Filter */}
                <div className="relative">
                  <select
                    value={selectedEstateFilter}
                    onChange={(e) => setSelectedEstateFilter(e.target.value)}
                    aria-label="Tapis mengikut Ladang"
                    className={`pl-3 pr-8 py-1.5 text-xs font-bold rounded-xl border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="ALL">Semua Ladang (All Estates)</option>
                    <option value="FPM_TUNGGAL">FPM Tunggal (5155)</option>
                    <option value="FPM_ADELA">FPM Adela (5136)</option>
                    <option value="FPM_KLEDANG">FPM Kledang (5176)</option>
                    <option value="FPM_SENING">FPM Sening (5156)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, staff no, IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="p-3.5 sm:p-6 space-y-6 flex-1">
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Security Highlights Banner */}
                <div className={`p-4 rounded-2xl border ${
                  securityAlerts.length > 0
                    ? isDarkMode ? 'bg-rose-950/20 border-rose-500/30' : 'bg-rose-50 border-rose-200'
                    : isDarkMode ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      securityAlerts.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {securityAlerts.length > 0 ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold uppercase tracking-wider">
                        {securityAlerts.length > 0 
                          ? `${securityAlerts.length} Percubaan Akses Luar Kawalan Dikesan`
                          : 'Status Keselamatan Ladang: Terkawal & Terjamin'
                        }
                      </h3>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {securityAlerts.length > 0
                          ? 'Sistem perlindungan 2-peringkat telah menahan cubaan log masuk daripada staf silang ladang atau PIN tidak sah secara automatik.'
                          : 'Tiada pelanggaran keselamatan aktif. Semua sesi kiosk dan peranti disahkan mengikut ladang berdaftar masing-masing.'}
                      </p>
                    </div>
                    {securityAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('threats')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        Periksa Amaran
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid: Active Sessions Preview + Recent Threats List */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Live Active Sessions Quick Table */}
                  <div className={`p-4 rounded-2xl border flex flex-col ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider">
                          Sesi Kiosk / Operator Sedang Aktif ({activeSessions.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sessions')}
                        className="text-[11px] font-bold text-emerald-400 hover:underline"
                      >
                        Lihat Semua →
                      </button>
                    </div>

                    {activeSessions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Tiada sesi aktif yang sepadan dengan tapisan semasa.
                      </div>
                    ) : (
                      <div className="space-y-2.5 flex-1">
                        {activeSessions.slice(0, 5).map(session => (
                          <div
                            key={session.sessionId}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isDarkMode ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                {session.deviceType === 'mobile' ? <Smartphone size={15} /> : <Laptop size={15} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black truncate">{session.operatorName}</span>
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                    {session.role.toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {getEstateName(session.estateId)} • IP: {session.ip}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setRevokeConfirmSession(session)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer shrink-0"
                            >
                              Tamatkan
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Recent Security Alerts Quick Table */}
                  <div className={`p-4 rounded-2xl border flex flex-col ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-rose-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider">
                          Percubaan Tidak Sah Terkini ({securityAlerts.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('threats')}
                        className="text-[11px] font-bold text-rose-400 hover:underline"
                      >
                        Lihat Semua →
                      </button>
                    </div>

                    {securityAlerts.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                        <ShieldCheck size={28} className="text-emerald-400/50" />
                        <span>Tiada amaran pencerobohan atau log masuk tidak sah direkodkan.</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5 flex-1">
                        {securityAlerts.slice(0, 5).map(alert => (
                          <div
                            key={alert.id}
                            className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                              alert.threatLevel === 'CRITICAL' || alert.threatLevel === 'HIGH'
                                ? isDarkMode ? 'bg-rose-950/20 border-rose-500/40' : 'bg-rose-50/70 border-rose-200'
                                : isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {renderThreatBadge(alert.threatLevel)}
                                <span className={`text-xs font-black truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                  {alert.operatorName || alert.identifier}
                                </span>
                              </div>
                              <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {formatTimeAgo(alert.timestamp)}
                              </span>
                            </div>

                            <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {alert.notes || 'Cubaan akses tidak sah dikesan.'}
                            </p>

                            <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                              isDarkMode ? 'text-slate-400 border-slate-800/60' : 'text-slate-600 border-slate-200'
                            }`}>
                              <span>Sasaran: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-900'}>{alert.attemptedEstate}</strong></span>
                              <span>IP: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{alert.ip}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. SESSIONS TAB (FULL ACTIVE SESSIONS TABLE) */}
            {activeTab === 'sessions' && (
              <div className={`rounded-2xl border overflow-hidden ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="px-5 py-3.5 border-b flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Users size={15} className="text-emerald-400" />
                    Senarai Penuh Sesi Aktif ({activeSessions.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Semua sesi yang mempunyai token JWT aktif & sah
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isDarkMode ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <th className="p-3.5">Kakitangan / Operator</th>
                        <th className="p-3.5">Peranan</th>
                        <th className="p-3.5">Ladang (Estate)</th>
                        <th className="p-3.5">Stesen / Kiosk</th>
                        <th className="p-3.5">IP & Peranti</th>
                        <th className="p-3.5">Masa Log Masuk</th>
                        <th className="p-3.5">Aktiviti Terakhir</th>
                        <th className="p-3.5 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeSessions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500">
                            Tiada sesi aktif ditemui bagi tapisan ini.
                          </td>
                        </tr>
                      ) : (
                        activeSessions.map(session => (
                          <tr 
                            key={session.sessionId}
                            className={`transition-colors ${
                              isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-3.5">
                              <div className="font-bold text-slate-100">{session.operatorName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {session.userId}</div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {session.role}
                              </span>
                            </td>
                            <td className="p-3.5 font-semibold text-slate-200">
                              {getEstateName(session.estateId)}
                            </td>
                            <td className="p-3.5 text-slate-300">
                              <div>{session.stationName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">Kiosk: {session.kioskId}</div>
                            </td>
                            <td className="p-3.5">
                              <div className="font-mono text-[11px] text-slate-300">{session.ip}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                {session.deviceType === 'mobile' ? <Smartphone size={11} /> : <Laptop size={11} />}
                                <span>{session.browser} / {session.os}</span>
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-400">
                              <div>{new Date(session.createdAt).toLocaleTimeString('ms-MY')}</div>
                              <div className="text-[9.5px] text-slate-500">{new Date(session.createdAt).toLocaleDateString('ms-MY')}</div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-emerald-400 font-medium">
                                {formatTimeAgo(session.lastActiveAt)}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setRevokeConfirmSession(session)}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
                              >
                                Tamatkan Sesi
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. HISTORY TAB (FULL AUDIT TRAIL) */}
            {activeTab === 'history' && (
              <div className={`rounded-2xl border overflow-hidden ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="px-5 py-3.5 border-b flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Clock size={15} className="text-blue-400" />
                    Jejak Audit Log Masuk ({loginHistory.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Rekod lengkap cubaan sah, gagal & pencerobohan
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isDarkMode ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <th className="p-3.5">Masa & Tarikh</th>
                        <th className="p-3.5">Kaedah</th>
                        <th className="p-3.5">Kakitangan / Operator</th>
                        <th className="p-3.5">Ladang Sasaran</th>
                        <th className="p-3.5">Ladang Asal</th>
                        <th className="p-3.5">Status & Hasil</th>
                        <th className="p-3.5">Tahap Ancaman</th>
                        <th className="p-3.5">IP & Peranti</th>
                        <th className="p-3.5">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {loginHistory.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500">
                            Tiada rekod log masuk ditemui bagi tapisan ini.
                          </td>
                        </tr>
                      ) : (
                        loginHistory.map(audit => (
                          <tr 
                            key={audit.id}
                            className={`transition-colors ${
                              audit.status === 'UNAUTHORIZED_CROSS_ESTATE'
                                ? isDarkMode ? 'bg-rose-950/20' : 'bg-rose-50/50'
                                : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                              <div>{new Date(audit.timestamp).toLocaleTimeString('ms-MY')}</div>
                              <div className="text-[9.5px] text-slate-500">{new Date(audit.timestamp).toLocaleDateString('ms-MY')}</div>
                            </td>
                            <td className="p-3.5 font-mono text-[10px] text-slate-400">
                              {audit.authMethod}
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-200">{audit.operatorName || audit.identifier}</div>
                              {audit.role && (
                                <span className="text-[9px] font-mono text-slate-400">{audit.role}</span>
                              )}
                            </td>
                            <td className="p-3.5 font-semibold text-slate-200">
                              {getEstateName(audit.attemptedEstate)}
                            </td>
                            <td className="p-3.5 text-slate-400">
                              {audit.assignedEstate ? getEstateName(audit.assignedEstate) : '-'}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {renderStatusBadge(audit.status)}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {renderThreatBadge(audit.threatLevel)}
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                              {audit.ip}
                            </td>
                            <td className="p-3.5 text-[11px] text-slate-400 max-w-xs">
                              {audit.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. THREATS TAB (UNAUTHORIZED ACCESS & THREAT INVESTIGATION) */}
            {activeTab === 'threats' && (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={20} className="text-rose-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Pusat Penyiasatan Ancaman & Cubaan Akses Tidak Sah
                      </h4>
                      <p className="text-xs mt-0.5 opacity-90">
                        Modul ini menapis khusus aktiviti pencerobohan silang ladang, percubaan tekaan PIN berulang (brute-force), dan peranti yang disekat.
                      </p>
                    </div>
                  </div>
                </div>

                {securityAlerts.length === 0 ? (
                  <div className={`p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3 ${
                    isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    <ShieldCheck size={36} className="text-emerald-400" />
                    <h4 className="text-sm font-bold text-slate-200">Tiada Ancaman Aktif Ditemui</h4>
                    <p className="text-xs max-w-md">
                      Tiada percubaan akses tidak sah atau pelanggaran sekatan silang ladang dalam tempoh pemantauan semasa.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {securityAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                          alert.threatLevel === 'CRITICAL' || alert.threatLevel === 'HIGH'
                            ? isDarkMode ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/20' : 'bg-rose-50 border-rose-300'
                            : isDarkMode ? 'bg-amber-950/20 border-amber-500/40' : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            alert.threatLevel === 'CRITICAL' || alert.threatLevel === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            <Ban size={22} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {renderThreatBadge(alert.threatLevel)}
                              {renderStatusBadge(alert.status)}
                              <span className={`text-xs font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                {alert.operatorName || alert.identifier}
                              </span>
                              <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                • {new Date(alert.timestamp).toLocaleString('ms-MY')}
                              </span>
                            </div>

                            <p className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {alert.notes || 'Percubaan akses tidak sah dikesan.'}
                            </p>

                            <div className={`flex flex-wrap items-center gap-4 text-[11px] mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              <span>Ladang Sasaran: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-900'}>{alert.attemptedEstate}</strong></span>
                              {alert.assignedEstate && (
                                <span>Ladang Asal Staf: <strong className={isDarkMode ? 'text-rose-400' : 'text-rose-700'}>{alert.assignedEstate}</strong></span>
                              )}
                              <span>Alamat IP: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{alert.ip}</strong></span>
                              <span>Kaedah: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{alert.authMethod}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                          <span className="text-[10px] font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck size={12} /> DISEKAT SECARA AUTOMATIK
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. DEVICES TAB (PERANTI BERDAFTAR & KELULUSAN PERINGKAT 1) */}
            {activeTab === 'devices' && (
              <div className="space-y-5">
                {/* Information Banner */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isDarkMode ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        Kawalan Keselamatan Peranti (Peringkat 1)
                        <span className="text-[9px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                          AKTIF
                        </span>
                      </h4>
                      <p className="text-xs mt-1 text-slate-300">
                        Hanya peranti yang telah diluluskan oleh Field Controller (FC) dibenarkan mengakses data sistem iPDS.
                        Permohonan boleh dihantar oleh staf melalui WhatsApp dan diluluskan serta-merta dengan 1-klik di sini.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowMergeModal(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                    >
                      <GitMerge size={13} />
                      <span>Gabung Peranti</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchDashboardData()}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      <span>Muat Semula</span>
                    </button>
                  </div>
                </div>

                <DeviceMergeModal
                  isOpen={showMergeModal}
                  onClose={() => setShowMergeModal(false)}
                  onMerged={() => fetchDashboardData(true)}
                  estateId={selectedEstateFilter}
                  isDarkMode={isDarkMode}
                  showToast={showToast}
                />

                {/* P0-16C.4: One-time credential issuance panel (explicit admin action only) */}
                {issuedCredential && (
                  <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${
                    isDarkMode ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-100' : 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                        <KeyRound size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 flex-wrap">
                          Kredensial Peranti Baharu (Dipaparkan Sekali)
                          <span className="text-[9px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                            v{issuedCredential.credentialVersion}
                          </span>
                        </h4>
                        <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-emerald-200/80' : 'text-emerald-900/80'}`}>
                          Peranti <strong>{issuedCredential.deviceName}</strong> ({issuedCredential.deviceId}) • Ladang {issuedCredential.estateId}.
                          Kredensial lama telah tidak sah. Salin atau simpan pada peranti ini SEKARANG — ia tidak boleh diperoleh semula.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDismissCredential}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        title="Tutup dan lupakan kredensial"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border font-mono text-[11px] sm:text-xs break-all select-all ${
                      isDarkMode ? 'bg-slate-950 border-emerald-500/40 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-900'
                    }`}>
                      {issuedCredential.credential}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyCredential}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {credentialCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{credentialCopied ? 'Disalin!' : 'Salin Kredensial'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStoreCredentialOnDevice}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound size={14} />
                        <span>{credentialStored ? 'Disimpan pada Peranti' : 'Simpan pada Peranti Ini'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDismissCredential}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                )}

                {/* FC WhatsApp Destination Setting */}
                <div className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all ${
                  isDarkMode 
                    ? 'bg-slate-900/90 border-emerald-500/40 text-slate-200 shadow-md' 
                    : 'bg-emerald-50/95 border-emerald-300 text-slate-900 shadow-sm'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#25D366]/20 text-[#25D366] shrink-0 shadow-sm">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 flex-wrap">
                          <span>Nombor WhatsApp FC / Admin</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            Penerima Permohonan
                          </span>
                        </h5>
                        <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Staf yang menekan butang <strong>"Buka WhatsApp FC"</strong> akan terus dihantar ke nombor ini.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input and Action Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1.5 border-t border-emerald-500/20">
                    <div className="flex-1 flex items-center gap-2">
                      <div className={`flex-1 flex items-center rounded-xl px-3 py-2 text-xs font-mono border transition-all ${
                        isDarkMode
                          ? 'bg-slate-950 border-emerald-500/50 text-emerald-300 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/50'
                          : 'bg-white border-emerald-400 text-slate-900 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500 shadow-sm'
                      }`}>
                        <Phone size={15} className="text-emerald-600 dark:text-emerald-400 mr-2 shrink-0" />
                        <input
                          type="tel"
                          value={phoneDraft}
                          onFocus={() => setIsEditingPhone(true)}
                          onChange={(e) => {
                            setIsEditingPhone(true);
                            setPhoneDraft(e.target.value);
                          }}
                          placeholder="cth: 017-7853551 atau 01138404285"
                          className="bg-transparent border-none outline-none w-full font-bold text-sm tracking-wide text-slate-900 dark:text-emerald-200 placeholder:text-slate-400"
                        />
                        {phoneDraft && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneDraft('');
                              setIsEditingPhone(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer mr-1"
                            title="Padam teks"
                          >
                            <X size={14} />
                          </button>
                        )}
                        {cleanMalaysiaPhone(phoneDraft) !== cleanMalaysiaPhone(fcPhoneNumber) && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-sans font-bold whitespace-nowrap ml-1 animate-pulse">
                            Belum Simpan
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveFcPhone}
                        disabled={isSavingPhone}
                        className={`flex-1 sm:flex-none px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm text-white ${
                          phoneSuccess 
                            ? 'bg-emerald-600' 
                            : cleanMalaysiaPhone(phoneDraft) !== cleanMalaysiaPhone(fcPhoneNumber)
                              ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/50'
                              : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {isSavingPhone ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : phoneSuccess ? (
                          <>
                            <Check size={14} className="text-white" />
                            <span>Tersimpan Kekal!</span>
                          </>
                        ) : (
                          <span>Simpan Nombor</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const clean = cleanMalaysiaPhone(phoneDraft || fcPhoneNumber);
                          if (!clean || clean.length < 9) {
                            if (showToast) showToast('Sila masukkan nombor telefon yang sah dahulu.', 'error');
                            return;
                          }
                          const url = `https://wa.me/${clean}?text=${encodeURIComponent('Ujian Pautan WhatsApp iPDS: Sistem sedia menerima permohonan kelulusan peranti.')}`;
                          // Safe mobile intent opener
                          const a = document.createElement('a');
                          a.href = url;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => {
                            if (!document.hidden) {
                              window.location.href = url;
                            }
                          }, 500);
                        }}
                        className="px-3 py-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 text-xs font-bold whitespace-nowrap shadow-sm"
                        title="Uji Pautan WhatsApp ke Nombor Ini"
                      >
                        <ExternalLink size={14} />
                        <span>Uji Pautan</span>
                      </button>
                    </div>
                  </div>

                  {/* Informational Sub-Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        Piawaian WhatsApp: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{cleanMalaysiaPhone(fcPhoneNumber)}</strong>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>
                        Tempatan: <strong className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{formatDisplayMalaysiaPhone(fcPhoneNumber)}</strong>
                      </span>
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.2 rounded-full font-medium">
                        Kekal di Supabase
                      </span>
                    </div>
                    {cleanMalaysiaPhone(phoneDraft) !== cleanMalaysiaPhone(fcPhoneNumber) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneDraft(toLocalMalaysiaPhone(fcPhoneNumber));
                          setIsEditingPhone(false);
                        }}
                        className="text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer text-xs"
                      >
                        Batal Perubahan
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 1: Pending Approval List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <Clock size={14} className="text-amber-400" />
                      <span>Permohonan Menunggu Kelulusan</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        pendingDevicesCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {pendingDevicesCount}
                      </span>
                    </h4>
                  </div>

                  {devices.filter(d => d.status === 'PENDING').length === 0 ? (
                    <div className={`p-8 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 ${
                      isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                      <CheckCircle2 size={32} className="text-emerald-400" />
                      <p className="text-xs font-bold text-slate-300">
                        Tiada permohonan peranti baru yang menunggu kelulusan.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Semua peranti semasa telah diluluskan atau disahkan.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {devices.filter(d => d.status === 'PENDING').map(dev => (
                        <div
                          key={dev.device_id}
                          className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                            isDarkMode
                              ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/60 shadow-lg shadow-amber-950/30'
                              : 'bg-amber-50/70 border-amber-300 shadow-sm'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-xl shrink-0 ${
                                  isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  <Smartphone size={18} />
                                </div>
                                <div>
                                  <h5 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {dev.device_name || 'Peranti Baharu'}
                                  </h5>
                                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                    isDarkMode 
                                      ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' 
                                      : 'text-amber-900 bg-amber-100 border-amber-300 font-bold'
                                  }`}>
                                    {dev.device_id}
                                  </span>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                isDarkMode 
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}>
                                MENUNGGU
                              </span>
                            </div>

                            <div className={`text-xs space-y-1 mt-2.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                              <div className={`flex justify-between py-1.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-amber-200/80'}`}>
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Pengendali / Pemohon:</span>
                                <span className={`font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
                                  {dev.operator_name || 'Staf Ladang'}
                                </span>
                              </div>
                              <div className={`flex justify-between py-1.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-amber-200/80'}`}>
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Ladang Sasaran:</span>
                                <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                  {dev.estate_id || 'FPM_TUNGGAL'}
                                </span>
                              </div>
                              {dev.ip_address && (
                                <div className={`flex justify-between py-1.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-amber-200/80'}`}>
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Alamat IP:</span>
                                  <span className={`font-mono text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                    {dev.ip_address}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between py-1.5">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Masa Permohonan:</span>
                                <span className={`font-mono text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                  {dev.created_at ? new Date(dev.created_at).toLocaleString('ms-MY') : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveDevice(dev.device_id)}
                              disabled={approvingDeviceId === dev.device_id}
                              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {approvingDeviceId === dev.device_id ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              <span>Luluskan (1-Klik)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleShareWhatsAppStatus(dev)}
                              className="py-2 px-3 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                              title="Hantar WhatsApp"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(dev.device_id, dev.device_name)}
                              className="py-2 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                              title="Tolak / Sekat"
                            >
                              <Ban size={13} />
                              <span>Sekat</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: All Registered Devices Table */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>Semua Peranti Berdaftar Dalam Sistem ({devices.length})</span>
                    </h4>
                  </div>

                  <div className={`overflow-x-auto rounded-2xl border ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                          isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <th className="p-3.5">Peranti & ID</th>
                          <th className="p-3.5">Pengendali</th>
                          <th className="p-3.5">Ladang</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Pengesah</th>
                          <th className="p-3.5">Tarikh Kelulusan</th>
                          <th className="p-3.5 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {devices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                              Tiada rekod peranti ditemui.
                            </td>
                          </tr>
                        ) : (
                          devices.map(dev => (
                            <tr
                              key={dev.id || dev.device_id}
                              className={`transition-colors ${
                                dev.status === 'APPROVED'
                                  ? isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                                  : dev.status === 'PENDING'
                                  ? isDarkMode ? 'bg-amber-950/15 hover:bg-amber-950/25' : 'bg-amber-50/50'
                                  : isDarkMode ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'bg-rose-50/50'
                              }`}
                            >
                              <td className="p-3.5">
                                <div className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                  <Smartphone size={13} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                                  <span>{dev.device_name || 'Peranti'}</span>
                                </div>
                                <div className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-amber-300' : 'text-amber-800 font-semibold'}`}>
                                  {dev.device_id}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <div className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{dev.operator_name || '-'}</div>
                                <div className={`text-[9.5px] font-mono uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{dev.role || 'staf'}</div>
                              </td>
                              <td className={`p-3.5 font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                {dev.estate_id || 'FPM_TUNGGAL'}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                {dev.status === 'APPROVED' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 size={11} /> DILULUSKAN
                                  </span>
                                ) : dev.status === 'REVOKED' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    <Ban size={11} /> DISEKAT
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <Clock size={11} /> MENUNGGU
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-300">
                                {dev.approved_by || '-'}
                              </td>
                              <td className="p-3.5 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {dev.approved_at ? new Date(dev.approved_at).toLocaleString('ms-MY') : '-'}
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {dev.status === 'PENDING' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveDevice(dev.device_id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                                    >
                                      Luluskan
                                    </button>
                                  ) : dev.status === 'APPROVED' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeDevice(dev.device_id, dev.device_name)}
                                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                                    >
                                      Sekat
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveDevice(dev.device_id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                                    >
                                      Buka Sekatan
                                    </button>
                                  )}

                                  {dev.status === 'APPROVED' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRotateCredential(dev)}
                                      disabled={rotatingDeviceId === dev.device_id}
                                      className="p-1 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                      title="Putar Kredensial Peranti (P0-16C.4)"
                                    >
                                      {rotatingDeviceId === dev.device_id ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                      ) : (
                                        <KeyRound size={14} />
                                      )}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleShareWhatsAppStatus(dev)}
                                    className="p-1 text-[#25D366] hover:bg-[#25D366]/20 rounded-lg transition-colors cursor-pointer"
                                    title="WhatsApp Status"
                                  >
                                    <MessageSquare size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>

            {/* Footer Bar */}
            <div className={`px-4 sm:px-5 py-3 sm:py-3.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs mt-auto flex-shrink-0 ${
              isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Terakhir dikemas kini: {lastRefreshed.toLocaleTimeString('ms-MY')}</span>
                <span className="text-slate-600">•</span>
                <span>Kawalan: <strong>Super Admin (FC FPM Tunggal)</strong></span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                Tutup Dashboard
              </button>
            </div>
          </div>

          {/* Kill / Revoke Session Confirmation Modal */}
          {revokeConfirmSession && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl space-y-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <LogOut size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400">
                      Tamatkan Sesi Kiosk Serta-Merta
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tindakan ini akan membatalkan token JWT dan memaksa operator log keluar serta-merta.
                    </p>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>Operator: <strong>{revokeConfirmSession.operatorName}</strong> ({revokeConfirmSession.role})</div>
                  <div>Ladang: <strong>{getEstateName(revokeConfirmSession.estateId)}</strong></div>
                  <div>Stesen: <strong>{revokeConfirmSession.stationName}</strong></div>
                  <div>IP: <strong className="font-mono">{revokeConfirmSession.ip}</strong></div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Sebab Penamatan Sesi:
                  </label>
                  <input
                    type="text"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-100'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRevokeConfirmSession(null)}
                    disabled={revokingSessionId !== null}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleRevokeSession}
                    disabled={revokingSessionId !== null}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {revokingSessionId ? <RefreshCw size={13} className="animate-spin" /> : <LogOut size={13} />}
                    <span>Sahkan Tamatkan Sesi</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
