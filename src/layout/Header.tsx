import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Leaf, ChevronDown, Moon, Info, Download, Menu,
  Settings, HelpCircle, LogOut, Camera, Upload, Trash2, Image as ImageIcon, Tv, Presentation,
  ExternalLink, FileText, CreditCard, Globe, Sparkles, Lock, ShieldCheck, ShieldAlert, Activity, ChevronRight,
  Wifi, WifiOff, Smartphone, DownloadCloud, KeyRound, Building2, Clock, UploadCloud
} from 'lucide-react';
import { ReportTab } from '../components/common/ReportTab';
import { SlidePresentationModal } from '../components/presentation/SlidePresentationModal';
import { RbacManagerModal } from '../components/common/modals/RbacManagerModal';
import { SecurityDashboardModal } from '../features/admin/components/SecurityDashboardModal';
import { AdminHubModal } from '../features/admin/components/AdminHubModal';
import { isSuperAdmin, getCurrentUserEstate } from '../features/auth/services/rbacService';
import { EstateSwitcherModal } from '../components/EstateSwitcherModal';
import { MasterDatasetModal } from '../components/common/modals/MasterDatasetModal';
import { usePWA } from '../hooks/usePWA';
import { getActiveEstateConfig, ESTATE_CHANGED_EVENT } from '../utils/estateContext';
import { isEstateInStandby } from '../config/estateRegistry';
import { safeFetch } from '../utils/safeFetch';
import {
  getLocalLogo,
  fetchSupabaseLogo,
  saveSupabaseLogo,
  deleteSupabaseLogo,
  subscribeLogoRealtime,
  compressLogoImage
} from '../services/logoService';

interface HeaderProps {
  authRole: string | null;
  showUserMenu: boolean;
  setShowUserMenu: (val: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  setShowNewFeaturesModal: (val: boolean) => void;
  setShowExportModal: (val: boolean) => void;
  setShowSettingsModal: (val: boolean) => void;
  handleLogout: () => void;
  userMenuRef: React.RefObject<HTMLDivElement>;
  activeTab: string;
  reportTabs: any[];
  setReportTabs: (val: any[]) => void;
  reportType: string;
  setReportType: (val: string) => void;
  isReordering: boolean;
  setIsReordering: (val: boolean) => void;
  longPressTimer: React.MutableRefObject<any>;
  onOpenMorningBriefing?: () => void;
  onOpenManualSawit?: () => void;
  onOpenWeedVision?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const Header: React.FC<HeaderProps> = ({
  authRole,
  showUserMenu,
  setShowUserMenu,
  isDarkMode,
  setIsDarkMode,
  setShowNewFeaturesModal,
  setShowExportModal,
  setShowSettingsModal,
  handleLogout,
  userMenuRef,
  activeTab,
  reportTabs,
  setReportTabs,
  reportType,
  setReportType,
  isReordering,
  setIsReordering,
  longPressTimer,
  onOpenMorningBriefing,
  onOpenManualSawit,
  onOpenWeedVision,
  showToast
}) => {
  // Custom Logo Upload States & Sync
  const [customLogoUrl, setCustomLogoUrl] = React.useState<string | null>(() => getLocalLogo());
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [showLogoOptionsModal, setShowLogoOptionsModal] = React.useState(false);
  const [permissionNotice, setPermissionNotice] = React.useState<string | null>(null);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [showRbacModal, setShowRbacModal] = useState(false);
  const [showSecurityDashboardModal, setShowSecurityDashboardModal] = useState(false);
  const [securityDashboardTab, setSecurityDashboardTab] = useState<'overview' | 'sessions' | 'devices' | 'history' | 'threats'>('overview');
  const [pendingDevicesCount, setPendingDevicesCount] = useState<number>(0);
  const [fcWhatsAppPhone, setFcWhatsAppPhone] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('ipds_fc_phone') : null) || '601138404285';
  });
  const [showAdminHubModal, setShowAdminHubModal] = useState(false);
  const [showEstateModal, setShowEstateModal] = useState(false);
  const [showMasterDatasetModal, setShowMasterDatasetModal] = useState(false);
  const [targetMasterEstateId, setTargetMasterEstateId] = useState<string>('FPM_KLEDANG');
  const [currentEstate, setCurrentEstate] = useState(() => {
    try {
      return getActiveEstateConfig();
    } catch {
      return {
        id: 'FPM_TUNGGAL',
        name: 'FPM Tunggal',
        shortName: 'Tunggal',
        code: 'TGL',
        zoneId: 'ZON_ADELA',
        zoneName: 'Zon Adela',
        regionId: 'WILAYAH_JB',
        regionName: 'FPM Wilayah Johor Bahru',
        millName: 'Kilang Sawit Adela',
        totalHectares: 1563.15,
        annualTargetPkt1: 28.0,
        annualTargetPkt2: 28.0,
        annualTargetFelda: 11.99,
        monthlyTargets2026: {},
        status: 'active',
        isStandby: false,
        blocks: {}
      } as any;
    }
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Authoritative Super Admin / Admin check (canonical client predicate).
  // Peraturan Teras: FC Tunggal, Admin, dan Super Admin adalah orang yang sama (kuasa mutlak rentas semua ladang).
  // The home estate (not the UI-selected estate) is passed so switching estates never revokes Super Admin.
  const isUserSuperAdmin = isSuperAdmin(authRole, getCurrentUserEstate());

  // Poll pending devices count for super admin FC / Admin across ALL estates
  React.useEffect(() => {
    if (!isUserSuperAdmin) return;
    const checkPending = async () => {
      try {
        const res = await safeFetch('/api/devices/pending-count?estateId=ALL');
        if (res.ok) {
          const json = await res.json();
          if (json.success && typeof json.count === 'number') {
            setPendingDevicesCount(json.count);
          }
        }
      } catch {
        // silent catch
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, [isUserSuperAdmin]);

  // Listen to runtime estate changes
  React.useEffect(() => {
    const handleEstateChange = () => {
      try {
        setCurrentEstate(getActiveEstateConfig());
      } catch (err) {
        console.warn('Failed to update estate in Header:', err);
      }
    };
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    };
  }, []);

  // Sync FC WhatsApp Phone from server and listen for real-time changes
  React.useEffect(() => {
    fetch('/api/devices/fc-contact')
      .then(res => res.json())
      .then(data => {
        if (data?.contact?.phone) {
          const clean = (data.contact.phone || '').replace(/\D/g, '');
          if (clean) {
            setFcWhatsAppPhone(clean);
            if (typeof window !== 'undefined') {
              localStorage.setItem('ipds_fc_phone', clean);
            }
          }
        }
      })
      .catch(() => {});

    const handlePhoneUpdate = (e: any) => {
      if (e.detail?.phone) {
        setFcWhatsAppPhone(String(e.detail.phone).replace(/\D/g, ''));
      }
    };
    window.addEventListener('ipds_fc_phone_updated', handlePhoneUpdate);
    return () => window.removeEventListener('ipds_fc_phone_updated', handlePhoneUpdate);
  }, []);

  // Determine header display details based on authRole & active estate
  const getHierarchyHeaderDetails = () => {
    const role = (authRole || '').toLowerCase();
    const isStandby = isEstateInStandby(currentEstate.id);

    // If active estate is in Standby mode, clearly reflect it regardless of role
    if (isStandby) {
      return {
        title: currentEstate.name,
        badge: "MOD STANDBY",
        subtitle: `WILAYAH JB • ${currentEstate.zoneName.toUpperCase()} • STATUS: STANDBY (SEDIA TERIMA DATA ASAS)`,
        userLevel: `${currentEstate.name} (Standby)`,
        subLabel: `Menunggu Data Set Asas • ${currentEstate.zoneName}`,
        isStandby: true,
      };
    }
    
    // 1. REGIONAL CONTROLLER (RC) -> Wilayah Level
    if (role === 'rc') {
      return {
        title: "FPM WILAYAH JB",
        badge: "WILAYAH",
        subtitle: `FPM WILAYAH JOHOR BAHRU • ZON ADELA (4 LADANG) • 6,182.0 HA`,
        userLevel: "Wilayah Johor Bahru",
        subLabel: `Zon Adela • ${currentEstate.name}`,
        isStandby: false,
      };
    }
    
    // 2. OPERATION CONTROLLER (OC) -> Zone Level
    if (role === 'oc') {
      return {
        title: "FPM ZON ADELA",
        badge: "ZON ADELA",
        subtitle: `WILAYAH JB • 4 LADANG • 6,182.0 HA • AKTIF: ${currentEstate.name.toUpperCase()}`,
        userLevel: "Zon Adela (4 Ladang)",
        subLabel: `Zon Adela • ${currentEstate.name}`,
        isStandby: false,
      };
    }
    
    // 3. PENGURUS FELDA (PF) -> Management Level
    if (role === 'pf') {
      return {
        title: currentEstate.name,
        badge: "PENGURUSAN",
        subtitle: `WILAYAH JB • ${currentEstate.zoneName.toUpperCase()} • ${currentEstate.totalHectares.toFixed(1)} HA`,
        userLevel: `Pengurus ${currentEstate.name}`,
        subLabel: `${currentEstate.name} • ${currentEstate.zoneName}`,
        isStandby: false,
      };
    }
    
    // 4. FIELD CONTROLLER (FC) -> Estate Admin Level
    if (role === 'fc') {
      return {
        title: currentEstate.name,
        badge: "PENTADBIR",
        subtitle: `WILAYAH JB • ${currentEstate.zoneName.toUpperCase()} • ${currentEstate.totalHectares.toFixed(1)} HA`,
        userLevel: `Pentadbir ${currentEstate.name}`,
        subLabel: `${currentEstate.name} • ${currentEstate.zoneName}`,
        isStandby: false,
      };
    }
    
    // 5. AFC, FS, STAFF, EQI, etc. -> Estate Operational Level
    return {
      title: currentEstate.name,
      badge: currentEstate.zoneName,
      subtitle: `WILAYAH JB • ${currentEstate.zoneName.toUpperCase()} • ${currentEstate.totalHectares.toFixed(1)} HA`,
      userLevel: currentEstate.name,
      subLabel: `${currentEstate.name} • ${currentEstate.zoneName}`,
      isStandby: false,
    };
  };

  const hierarchyInfo = getHierarchyHeaderDetails();

  // PWA & Connection Status Hook
  const { isOnline, canInstall, isInstalled, installPWA } = usePWA();

  // Initial fetch and Realtime sync across all devices
  React.useEffect(() => {
    fetchSupabaseLogo().then((url) => {
      if (url) setCustomLogoUrl(url);
    });

    const unsubscribe = subscribeLogoRealtime((newUrl) => {
      setCustomLogoUrl(newUrl);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Logo Box Click
  const handleLogoBoxClick = () => {
    // Only Field Controller (FC) is allowed to upload/change logo
    const isFC = authRole?.toLowerCase() === 'fc';
    
    if (!isFC) {
      setPermissionNotice('Hanya Field Controller (FC) sahaja dibenarkan memuat naik logo.');
      setTimeout(() => {
        setPermissionNotice(null);
      }, 4000);
      return;
    }

    if (customLogoUrl) {
      setShowLogoOptionsModal(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  // Handle image selection from gallery
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      const compressedBase64 = await compressLogoImage(file);
      setCustomLogoUrl(compressedBase64);
      await saveSupabaseLogo(compressedBase64);
    } catch (err) {
      console.error('Failed to process logo image:', err);
      alert('Gagal memuat naik gambar logo. Sila cuba lagi.');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
      setShowLogoOptionsModal(false);
    }
  };

  // Handle Delete Logo (revert to default iPDS)
  const handleDeleteLogo = async () => {
    try {
      setIsUploadingLogo(true);
      setCustomLogoUrl(null);
      await deleteSupabaseLogo();
    } catch (err) {
      console.error('Failed to delete logo:', err);
    } finally {
      setIsUploadingLogo(false);
      setShowLogoOptionsModal(false);
    }
  };

  return (
    <header className="pt-2 pb-1 px-2 sm:px-4 relative z-50">
      {/* Main Header Container Card */}
      <div className="bg-gradient-to-b from-[#09292c]/95 via-[#061d1f]/95 to-[#031315]/98 backdrop-blur-2xl border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(16,185,129,0.25)] relative z-20">
        
        {/* Ambient Glow Effects (Clipped within background layer) */}
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -mr-28 -mt-28" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/5 rounded-full blur-[90px] pointer-events-none -ml-24 -mb-24" />
        </div>

        {/* TOP CONTENT GRID / ROW - HORIZONTAL LAYOUT */}
        <div className="relative z-30 flex flex-row items-center justify-between gap-2.5 sm:gap-6">
          
          {/* LEFT: Logo Box + Vertical Divider + Main Titles */}
          <div className="flex flex-row items-center gap-3 sm:gap-5 min-w-0 flex-1">
            
            {/* LOGO BOX (iPDS - Square Corporate MNC Brand) */}
            <div className="shrink-0 relative">
              <div 
                onClick={handleLogoBoxClick}
                className="w-14 h-14 xs:w-18 xs:h-18 sm:w-22 sm:h-22 bg-slate-900/95 border border-emerald-500/40 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.6)] backdrop-blur-md relative group transition-all duration-300 hover:border-emerald-400/80 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] overflow-hidden cursor-pointer active:scale-95"
                title={authRole?.toLowerCase() === 'fc' ? "Tekan untuk muat naik logo (FC)" : "Logo iPDS"}
              >
                {customLogoUrl ? (
                  <div className="relative w-full h-full">
                    <img 
                      src={customLogoUrl} 
                      alt="Logo Header" 
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {authRole?.toLowerCase() === 'fc' && (
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity rounded-xl gap-0.5 pointer-events-none">
                        <Camera className="w-5 h-5 text-emerald-400 drop-shadow" />
                        <span className="text-[7.5px] font-black text-white uppercase tracking-widest">Tukar</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center select-none p-1.5 sm:p-2 relative bg-black rounded-xl">
                    {/* Official Exact iPDS Logotype Vector matching IMG-20260814-WA0057 */}
                    <svg viewBox="0 0 880 380" className="w-full max-w-[96%] h-auto select-none">
                      {/* LETTER "i" */}
                      {/* Green Dot: Rounded Square in Vibrant Green (#2fd51d) */}
                      <rect x="10" y="30" width="56" height="56" rx="14" fill="#2fd51d" />
                      {/* White Stem: Thick Vertical Bar with Rounded Ends */}
                      <rect x="10" y="118" width="56" height="236" rx="28" fill="#FFFFFF" />

                      {/* LETTER "P" */}
                      {/* Open Geometric Monoline P in Solid White (#FFFFFF) */}
                      <path 
                        d="M 120 58 
                           L 228 58 
                           A 86 86 0 0 1 314 144 
                           A 86 86 0 0 1 228 230 
                           L 172 230 
                           A 28 28 0 0 0 144 258 
                           L 144 330" 
                        fill="none" 
                        stroke="#FFFFFF" 
                        strokeWidth="56" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />

                      {/* LETTER "D" */}
                      {/* Green Organic Leaf/Drop Accent (Top-Left quadrant of D) */}
                      <path 
                        d="M 376 138 
                           L 376 58 
                           A 28 28 0 0 1 404 30 
                           L 442 30 
                           A 60 60 0 0 1 460 84 
                           A 72 72 0 0 1 428 184 
                           L 400 184 
                           A 24 24 0 0 1 376 160 
                           Z" 
                        fill="#2fd51d"
                      />
                      {/* White Geometric Outer Shell of D */}
                      <path 
                        d="M 440 58 
                           L 476 58 
                           A 142 142 0 0 1 618 200 
                           A 142 142 0 0 1 476 342 
                           L 404 342 
                           A 28 28 0 0 1 376 314 
                           L 376 164" 
                        fill="none" 
                        stroke="#FFFFFF" 
                        strokeWidth="56" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />

                      {/* LETTER "S" */}
                      {/* White Geometric Rounded S */}
                      <path 
                        d="M 790 72 
                           C 782 42 740 30 694 30 
                           C 632 30 606 60 606 108 
                           C 606 162 656 182 710 198 
                           C 772 214 808 240 808 288 
                           C 808 340 764 374 690 374 
                           C 630 374 596 346 588 316" 
                        fill="none" 
                        stroke="#FFFFFF" 
                        strokeWidth="56" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>

                    {/* Camera icon badge overlay for FC */}
                    {authRole?.toLowerCase() === 'fc' && (
                      <div className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-slate-950 p-1 rounded-full shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                        <Camera className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </div>
                    )}
                  </div>
                )}

                {/* Loading spinner overlay */}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center rounded-xl z-20">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Hidden File Input for Gallery Image Picker */}
              <input 
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Permission Warning Toast for non-FC users */}
              <AnimatePresence>
                {permissionNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 z-50 bg-rose-950/95 border border-rose-500/60 text-rose-100 px-3 py-2 rounded-xl text-[10.5px] font-bold shadow-2xl flex items-center gap-2 w-56 sm:w-64 backdrop-blur-md"
                  >
                    <Info className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{permissionNotice}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* VERTICAL DIVIDER LINE */}
            <div className="w-[1.5px] h-14 xs:h-18 sm:h-22 bg-emerald-500/30 shrink-0" />

            {/* CENTER TEXT BLOCK */}
            <div className="flex flex-col min-w-0 text-left flex-1 pr-1 sm:pr-2">
              {/* TITLE - STRICT 2 LINES */}
              <div className="flex flex-col text-[11px] xs:text-[13px] sm:text-base md:text-lg font-black tracking-wider uppercase leading-tight">
                <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                  <span className="text-white">INTEGRATED</span>
                  <span className="text-emerald-400">PLANTATION</span>
                </div>
                <div className="text-white mt-0.5 tracking-wider whitespace-nowrap">
                  DATA SYSTEM
                </div>
              </div>

              {/* Horizontal Divider line with glowing green node */}
              <div className="relative my-1 sm:my-1.5 w-full">
                <div className="h-[1.5px] bg-emerald-500/50 w-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 sm:w-2 h-1.5 sm:h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,1)]" />
              </div>

              {/* Estate Name & Hierarchy Tagline */}
              <div 
                onClick={() => {
                  if (isUserSuperAdmin) {
                    setShowEstateModal(true);
                  }
                }}
                className={`flex flex-col gap-0.5 mt-0.5 group ${isUserSuperAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                title={isUserSuperAdmin ? "Tekan untuk buka Pusat Kawalan Ladang / Zon FPM" : `${currentEstate.name} (${currentEstate.zoneName})`}
              >
                <div className="flex items-center gap-1.5">
                  <h2 className={`text-[10px] xs:text-xs sm:text-sm font-black tracking-wider uppercase leading-tight whitespace-nowrap transition-colors ${
                    hierarchyInfo.isStandby ? 'text-amber-400 group-hover:text-amber-300' : 'text-emerald-400 group-hover:text-emerald-300'
                  }`}>
                    {hierarchyInfo.title}
                  </h2>
                  <span className={`hidden sm:inline-flex px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider items-center gap-1 ${
                    hierarchyInfo.isStandby 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {hierarchyInfo.isStandby && <Clock className="w-2.5 h-2.5 text-amber-400" />}
                    {hierarchyInfo.badge}
                  </span>
                </div>
                <p className={`text-[5.5px] xs:text-[6.5px] sm:text-[7.5px] md:text-[8px] font-sans font-bold tracking-[0.02em] xs:tracking-[0.04em] sm:tracking-[0.08em] uppercase whitespace-nowrap leading-none ${
                  hierarchyInfo.isStandby ? 'text-amber-200/90' : 'text-slate-300 opacity-90'
                }`}>
                  {hierarchyInfo.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: User Profile Button */}
          <div className="flex items-center gap-2 shrink-0 self-center z-50">
            {/* User Profile Pill Button */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
                className="relative flex items-center gap-2 p-1.5 pl-1.5 pr-3 bg-slate-900/90 hover:bg-slate-800/90 rounded-full border border-slate-700/80 hover:border-emerald-500/60 transition-all shadow-md active:scale-[0.97] group cursor-pointer touch-manipulation"
                aria-label="User Menu"
              >
              {/* Compact Green Circle with Role Badge */}
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[11px] font-black tracking-tight shadow-[0_0_10px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-transform shrink-0">
                {authRole === "rc"
                  ? "RC"
                  : authRole === "oc"
                    ? "OC"
                    : authRole === "pf"
                      ? "PF"
                      : authRole === "fc"
                        ? "FC"
                        : authRole === "afc"
                          ? "AFC"
                          : authRole === "fs"
                            ? "FS"
                            : authRole === "eqi"
                              ? "EQI"
                              : authRole === "staff"
                                ? "ST"
                                : "FC"}
              </div>

              <Menu
                size={16}
                className="text-slate-300 group-hover:text-white transition-colors"
              />

              {/* Pending Devices Notification Dot / Badge */}
              {pendingDevicesCount > 0 && isUserSuperAdmin && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-bounce shadow-lg border-2 border-slate-950 flex items-center gap-1 z-30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  <span>{pendingDevicesCount}</span>
                </span>
              )}
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  {/* Backdrop overlay for outside tap */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowUserMenu(false)}
                    className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-[1px]"
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className={`absolute top-full mt-2.5 right-0 w-72 sm:w-80 rounded-2xl z-[200] max-h-[82vh] overflow-y-auto divide-y transition-all ${
                      isDarkMode
                        ? "bg-[#031315] border border-emerald-500/40 shadow-[0_25px_60px_rgba(0,0,0,0.95)] divide-white/10 text-white"
                        : "bg-white border border-emerald-600/30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] divide-slate-100 text-slate-800"
                    }`}
                  >
                    {/* User Profile Header */}
                    <div className={`p-3.5 transition-colors ${
                      isDarkMode
                        ? "bg-gradient-to-br from-emerald-950/70 via-[#031a1c] to-[#021012]"
                        : "bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border-b border-emerald-100/80"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg ring-2 ring-emerald-400/30">
                            {authRole === "rc"
                              ? "RC"
                              : authRole === "oc"
                                ? "OC"
                                : authRole === "pf"
                                  ? "PF"
                                  : authRole === "fc"
                                    ? "FC"
                                    : authRole === "afc"
                                      ? "AFC"
                                      : authRole === "fs"
                                        ? "FS"
                                        : authRole === "eqi"
                                          ? "EQI"
                                          : authRole === "staff"
                                            ? "ST"
                                            : "FC"}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 rounded-full shadow-sm ${
                            isDarkMode ? "border-[#031315]" : "border-white"
                          }`} />
                        </div>
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={`text-[11px] font-black uppercase truncate ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              {authRole === "rc"
                                ? "Regional Controller (RC)"
                                : authRole === "oc"
                                  ? "Operation Controller (OC)"
                                  : authRole === "pf"
                                    ? "Pengurus Felda (PF)"
                                    : authRole === "fc"
                                      ? "Field Controller (FC)"
                                      : authRole === "afc"
                                        ? "Asst. Field Controller (AFC)"
                                        : authRole === "fs"
                                          ? "Field Supervisor (FS)"
                                          : authRole === "eqi"
                                            ? "Pemeriksa Kualiti (EQI)"
                                            : authRole === "staff"
                                              ? "Kerani Operasi (Staff)"
                                              : "Field Controller (FC)"}
                            </p>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                              isDarkMode
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}>
                              {authRole === "rc"
                                ? "Wilayah JB"
                                : authRole === "oc"
                                  ? "Zon Adela"
                                  : authRole === "fc"
                                    ? (isUserSuperAdmin ? "Super Admin" : "Pentadbir Ladang")
                                    : authRole === "pf"
                                      ? "Pengurusan"
                                      : authRole === "afc"
                                        ? "Akses Zon"
                                        : authRole === "eqi"
                                          ? "BTS Quality"
                                          : authRole === "staff"
                                            ? "Operasi"
                                            : "Pentadbir Ladang"}
                            </span>
                          </div>
                          <p className={`text-[9px] font-mono uppercase tracking-wider truncate ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}>
                            iPDS {hierarchyInfo.title} {authRole === 'oc' || authRole === 'rc' ? `• ${currentEstate.shortName}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 1: SYSTEM CONTROLS & STATUS */}
                    <div className="p-2.5 space-y-1.5">
                      <p className={`text-[8px] font-black uppercase tracking-widest px-1 pt-0.5 ${
                        isDarkMode ? "text-emerald-400/80" : "text-emerald-700"
                      }`}>
                        Tetapan Sistem & Mod
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Dark Mode */}
                        <div className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                          isDarkMode
                            ? "bg-white/5 hover:bg-white/10 border border-white/5"
                            : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Moon size={14} className={isDarkMode ? "text-amber-400 shrink-0" : "text-amber-500 shrink-0"} />
                            <span className={`text-[9.5px] font-bold uppercase tracking-wider ${
                              isDarkMode ? "text-slate-200" : "text-slate-700"
                            }`}>
                              Mod Gelap
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer touch-manipulation ${
                              isDarkMode ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                isDarkMode ? "translate-x-4" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        {/* System Status (Dynamic Online / Offline) */}
                        <div className={`flex items-center justify-between px-2.5 py-2 rounded-xl ${
                          isDarkMode
                            ? "bg-white/5 border border-white/5"
                            : "bg-slate-50 border border-slate-200"
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              isOnline
                                ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                                : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                            }`} />
                            <span className={`text-[9.5px] font-bold uppercase tracking-wider ${
                              isDarkMode ? "text-slate-200" : "text-slate-700"
                            }`}>
                              Sistem
                            </span>
                          </div>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                            isOnline
                              ? isDarkMode
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : isDarkMode
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}>
                            {isOnline ? "Online" : "Luar Talian"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: PAUTAN PANTAS (QUICK LINKS) */}
                    <div className={`p-2.5 space-y-1.5 transition-colors ${
                      isDarkMode ? "bg-emerald-950/20" : "bg-emerald-50/40"
                    }`}>
                      <div className="flex items-center justify-between px-1 pt-0.5">
                        <p className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${
                          isDarkMode ? "text-amber-400/90" : "text-amber-700"
                        }`}>
                          <Globe size={11} className={isDarkMode ? "text-amber-400" : "text-amber-600"} /> Pautan Pantas
                        </p>
                        <span className={`text-[7.5px] font-mono px-1.5 py-0.2 rounded ${
                          isDarkMode
                            ? "text-amber-300 bg-amber-500/10 border border-amber-500/20"
                            : "text-amber-800 bg-amber-100 border border-amber-300 font-bold"
                        }`}>
                          HRMS & Tuntutan
                        </span>
                      </div>

                      {/* FPMSB MyHR LINK CARD */}
                      <a
                        href="https://fpmhrms.felda.net.my/claim-normal-application/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group shadow-sm ${
                          isDarkMode
                            ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent hover:from-emerald-500/25 hover:via-emerald-500/20 border border-emerald-500/35 hover:border-emerald-400/60"
                            : "bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white hover:from-emerald-100 hover:via-emerald-50 border border-emerald-300/80 hover:border-emerald-400"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-all ${
                            isDarkMode
                              ? "bg-emerald-500/20 border border-emerald-500/40 group-hover:bg-emerald-500/30"
                              : "bg-emerald-100 border border-emerald-300 group-hover:bg-emerald-200"
                          }`}>
                            <CreditCard size={15} className={isDarkMode ? "text-emerald-300" : "text-emerald-700"} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-wider truncate transition-colors ${
                              isDarkMode ? "text-white group-hover:text-emerald-300" : "text-slate-900 group-hover:text-emerald-700"
                            }`}>
                              FPMSB MyHR
                            </p>
                            <p className={`text-[8.5px] font-mono truncate ${
                              isDarkMode ? "text-emerald-400/80" : "text-emerald-700"
                            }`}>
                              fpmhrms.felda.net.my
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center shrink-0 ml-1">
                          <ExternalLink size={13} className={`${isDarkMode ? "text-emerald-400" : "text-emerald-600"} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform`} />
                        </div>
                      </a>
                    </div>

                    {/* ========================================================================= */}
                    {/* SECTION 3: MODUL PENTADBIR (ADMIN) - KUMPULAN INDUK 3 SUBMODUL            */}
                    {/* ========================================================================= */}
                    {isUserSuperAdmin && (
                      <div className="p-2.5 pt-1">
                        <div className={`p-2.5 rounded-2xl border transition-all ${
                          isDarkMode
                            ? "bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-emerald-950/20 border-emerald-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                            : "bg-gradient-to-b from-emerald-50/90 via-teal-50/40 to-white border-emerald-300 shadow-sm"
                        }`}>
                          {/* Header Modul Admin */}
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isDarkMode ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-200 text-emerald-800"
                              }`}>
                                <ShieldCheck size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h3 className={`text-[10.5px] font-black uppercase tracking-wider truncate ${
                                    isDarkMode ? "text-white" : "text-emerald-950"
                                  }`}>
                                    Modul Pentadbir (Admin)
                                  </h3>
                                </div>
                                <p className={`text-[7.5px] font-medium truncate ${
                                  isDarkMode ? "text-emerald-400/80" : "text-emerald-700"
                                }`}>
                                  3 Submodul Kawalan Operasi & Keselamatan
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {pendingDevicesCount > 0 && (
                                <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse shadow-sm">
                                  {pendingDevicesCount} MENUNGGU
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowUserMenu(false);
                                  setShowAdminHubModal(true);
                                }}
                                title="Buka Hab Pentadbir Penuh"
                                className={`text-[7px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                  isDarkMode 
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30" 
                                    : "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                                }`}
                              >
                                SUPER ADMIN
                              </button>
                            </div>
                          </div>

                          {/* 3 Submodul Admin */}
                          <div className="space-y-1.5">
                            {/* SUBMODUL 1: PUSAT KAWALAN LADANG */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowEstateModal(true);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                                isDarkMode
                                  ? "text-white bg-slate-950/70 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/40"
                                  : "text-emerald-950 bg-white/90 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                  isDarkMode ? "bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  <Building2 size={13} className="text-emerald-400" />
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[7px] font-mono font-black uppercase px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      SUB 1
                                    </span>
                                    <span className={`text-[9.5px] font-black uppercase tracking-wider truncate block ${
                                      isDarkMode ? "text-emerald-300" : "text-emerald-900"
                                    }`}>
                                      Pusat Kawalan Ladang
                                    </span>
                                  </div>
                                  <span className="text-[7.5px] text-slate-400 font-medium block truncate">
                                    {currentEstate.name} • {currentEstate.zoneName}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 ml-1">
                                ZON ADELA
                              </span>
                            </button>

                            {/* SUBMODUL 2: DASHBOARD KESELAMATAN & PERANTI */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                setSecurityDashboardTab(pendingDevicesCount > 0 ? 'devices' : 'overview');
                                setShowSecurityDashboardModal(true);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                                pendingDevicesCount > 0
                                  ? "text-white bg-gradient-to-r from-amber-950/80 via-slate-900 to-rose-950/80 border-amber-500/60 shadow-lg"
                                  : isDarkMode
                                  ? "text-white bg-slate-950/70 border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/30"
                                  : "text-rose-950 bg-white/90 border-rose-200 hover:border-rose-400 hover:bg-rose-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                  pendingDevicesCount > 0
                                    ? "bg-amber-500/30 text-amber-300"
                                    : isDarkMode ? "bg-rose-500/20 text-rose-300 group-hover:bg-rose-500/30" : "bg-rose-100 text-rose-800"
                                }`}>
                                  <ShieldAlert size={13} className={pendingDevicesCount > 0 ? "text-amber-400 animate-bounce" : "text-rose-400"} />
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[7px] font-mono font-black uppercase px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                      SUB 2
                                    </span>
                                    <span className={`text-[9.5px] font-black uppercase tracking-wider truncate block ${
                                      pendingDevicesCount > 0 ? "text-amber-300" : isDarkMode ? "text-rose-300" : "text-rose-900"
                                    }`}>
                                      Dashboard Keselamatan & Peranti
                                    </span>
                                  </div>
                                  <span className="text-[7.5px] text-slate-400 font-medium block truncate">
                                    {pendingDevicesCount > 0 ? `${pendingDevicesCount} Peranti Baru Menunggu Kelulusan` : 'Audit Sesi & Kelulusan Peranti'}
                                  </span>
                                </div>
                              </div>
                              {pendingDevicesCount > 0 ? (
                                <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse shadow-sm shrink-0 ml-1">
                                  {pendingDevicesCount} MENUNGGU
                                </span>
                              ) : (
                                <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 ml-1">
                                  SUPER ADMIN
                                </span>
                              )}
                            </button>

                            {/* SUBMODUL 3: TUKAR PIN & AKSES (RBAC) */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowRbacModal(true);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                                isDarkMode
                                  ? "text-white bg-slate-950/70 border-teal-500/30 hover:border-teal-400 hover:bg-teal-950/30"
                                  : "text-teal-950 bg-white/90 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                  isDarkMode ? "bg-teal-500/20 text-teal-300 group-hover:bg-teal-500/30" : "bg-teal-100 text-teal-800"
                                }`}>
                                  <KeyRound size={13} className="text-teal-400" />
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[7px] font-mono font-black uppercase px-1 py-0.2 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                                      SUB 3
                                    </span>
                                    <span className={`text-[9.5px] font-black uppercase tracking-wider truncate block ${
                                      isDarkMode ? "text-emerald-300" : "text-emerald-900"
                                    }`}>
                                      Tukar PIN & Akses (RBAC)
                                    </span>
                                  </div>
                                  <span className="text-[7.5px] text-slate-400 font-medium block truncate">
                                    Tetapan Peranan & Kata Laluan
                                  </span>
                                </div>
                              </div>
                              <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0 ml-1">
                                SUPER ADMIN
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 4: UTILITI & FUNGSI SOKONGAN */}
                    <div className="p-2.5 space-y-1.5">
                      <p className={`text-[8px] font-black uppercase tracking-widest px-1 pt-0.5 ${
                        isDarkMode ? "text-slate-400/90" : "text-slate-500"
                      }`}>
                        Utiliti & Fungsi Sokongan
                      </p>

                      <div className="space-y-1">
                        {/* WeedVision™ AI Botani & Rumpai */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenWeedVision?.();
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group cursor-pointer touch-manipulation active:scale-[0.98] ${
                            isDarkMode
                              ? "text-white hover:text-white hover:bg-emerald-500/20 border border-emerald-500/30 bg-emerald-500/10"
                              : "text-emerald-950 hover:text-emerald-950 hover:bg-emerald-100 border border-emerald-300 bg-emerald-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isDarkMode ? "bg-emerald-500/30 group-hover:bg-emerald-500/40" : "bg-emerald-200 group-hover:bg-emerald-300"
                            }`}>
                              <Sparkles size={14} className={isDarkMode ? "text-emerald-300 animate-pulse" : "text-emerald-800"} />
                            </div>
                            <div className="text-left">
                              <span className={`text-[10px] font-black uppercase tracking-wider block ${
                                isDarkMode ? "text-emerald-300" : "text-emerald-900"
                              }`}>
                                WeedVision™ AI
                              </span>
                              <span className="text-[7.5px] text-slate-400 font-medium block">
                                Imbas Botani & Kawalan Rumpai
                              </span>
                            </div>
                          </div>
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${
                            isDarkMode
                              ? "bg-emerald-500/30 text-emerald-300 border-emerald-400/40"
                              : "bg-emerald-200 text-emerald-900 border-emerald-400"
                          }`}>
                            SCAN
                          </span>
                        </button>

                        {/* Slide Presentation */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowPresentationModal(true);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group cursor-pointer touch-manipulation active:scale-[0.98] ${
                            isDarkMode
                              ? "text-white/80 hover:text-white hover:bg-emerald-500/15 border border-emerald-500/20 bg-emerald-500/5"
                              : "text-slate-800 hover:text-emerald-950 hover:bg-emerald-50 border border-emerald-200/80 bg-emerald-50/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isDarkMode ? "bg-emerald-500/20 group-hover:bg-emerald-500/30" : "bg-emerald-100 group-hover:bg-emerald-200"
                            }`}>
                              <Tv size={14} className={isDarkMode ? "text-emerald-400" : "text-emerald-700"} />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isDarkMode ? "text-emerald-300" : "text-emerald-800"
                            }`}>
                              Pembentangan Slide
                            </span>
                          </div>
                          <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isDarkMode
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}>
                            PPTX / PDF
                          </span>
                        </button>

                        {/* Pasang Aplikasi PWA */}
                        {(canInstall || !isInstalled) && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              installPWA();
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                              isDarkMode
                                ? "text-emerald-300 hover:text-white hover:bg-emerald-500/20 border-emerald-500/30 bg-emerald-500/10"
                                : "text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100 border-emerald-300 bg-emerald-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                isDarkMode ? "bg-emerald-500/30 group-hover:bg-emerald-500/40" : "bg-emerald-200 group-hover:bg-emerald-300"
                              }`}>
                                <DownloadCloud size={14} className={isDarkMode ? "text-emerald-300" : "text-emerald-800"} />
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider ${
                                isDarkMode ? "text-emerald-300" : "text-emerald-900"
                              }`}>
                                Pasang Aplikasi (PWA)
                              </span>
                            </div>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                              isDarkMode
                                ? "bg-emerald-500/30 text-emerald-300 border-emerald-400/40"
                                : "bg-emerald-200 text-emerald-900 border-emerald-400"
                            }`}>
                              APP
                            </span>
                          </button>
                        )}

                        {/* Muat Turun Excel */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowExportModal(true);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                            isDarkMode
                              ? "text-white/80 hover:text-white hover:bg-white/10 border-transparent hover:border-white/10"
                              : "text-slate-700 hover:text-slate-950 hover:bg-slate-50 border-transparent hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isDarkMode ? "bg-blue-500/15 group-hover:bg-blue-500/25" : "bg-blue-50 group-hover:bg-blue-100"
                            }`}>
                              <Download size={14} className={isDarkMode ? "text-blue-400" : "text-blue-600"} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isDarkMode ? "text-slate-200" : "text-slate-800"
                            }`}>
                              Muat Turun Excel
                            </span>
                          </div>
                          <span className={`text-[8px] font-mono ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}>
                            .XLSX
                          </span>
                        </button>

                        {/* Ciri Baharu */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowNewFeaturesModal(true);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                            isDarkMode
                              ? "text-white/80 hover:text-white hover:bg-white/10 border-transparent hover:border-white/10"
                              : "text-slate-700 hover:text-slate-950 hover:bg-slate-50 border-transparent hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isDarkMode ? "bg-cyan-500/15 group-hover:bg-cyan-500/25" : "bg-cyan-50 group-hover:bg-cyan-100"
                            }`}>
                              <Info size={14} className={isDarkMode ? "text-cyan-400" : "text-cyan-600"} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isDarkMode ? "text-slate-200" : "text-slate-800"
                            }`}>
                              Ciri Baharu
                            </span>
                          </div>
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </button>

                        {/* Bantuan WhatsApp */}
                        <a
                          href={`https://wa.me/${fcWhatsAppPhone || '601138404285'}?text=${encodeURIComponent('Salam Tuan FC / Admin, saya memerlukan bantuan teknikal berkenaan aplikasi iPDS.')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group border cursor-pointer touch-manipulation active:scale-[0.98] ${
                            isDarkMode
                              ? "text-white/80 hover:text-white hover:bg-white/10 border-transparent hover:border-white/10"
                              : "text-slate-700 hover:text-slate-950 hover:bg-slate-50 border-transparent hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isDarkMode ? "bg-indigo-500/15 group-hover:bg-indigo-500/25" : "bg-indigo-50 group-hover:bg-indigo-100"
                            }`}>
                              <HelpCircle size={14} className={isDarkMode ? "text-indigo-400" : "text-indigo-600"} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isDarkMode ? "text-slate-200" : "text-slate-800"
                            }`}>
                              Bantuan Teknikal
                            </span>
                          </div>
                          <ExternalLink size={12} className={`${isDarkMode ? "text-slate-500 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"} transition-colors`} />
                        </a>
                      </div>
                    </div>

                    {/* SECTION 4: LOG KELUAR */}
                    <div className="p-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl transition-all group cursor-pointer touch-manipulation active:scale-95 ${
                          isDarkMode
                            ? "text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25"
                            : "text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                        }`}
                      >
                        <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Log Keluar Akaun
                        </span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

        {/* FOOTER SUB-LINE OF HEADER CARD */}
        <div className="relative z-0 mt-2 sm:mt-2.5 pt-1 pb-0.5 flex items-center justify-center gap-1.5 text-[5.5px] sm:text-[6.5px] font-mono tracking-wider text-slate-400">
          <div className="h-[1px] bg-emerald-500/20 flex-1 max-w-[80px] sm:max-w-[220px]" />
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[5.5px] sm:text-[6.5px]">POWERED BY</span>
            <span className="font-sans font-black text-white tracking-wider text-[6px] sm:text-[7px]">
              Fpm<span className="text-emerald-400">OS</span>
            </span>
            <span className="px-1 py-[0.5px] border border-emerald-500/35 rounded text-emerald-400 font-extrabold text-[5px] sm:text-[5.5px] bg-emerald-500/10 uppercase leading-none">
              V4.2.1
            </span>
          </div>
          <div className="h-[1px] bg-emerald-500/20 flex-1 max-w-[80px] sm:max-w-[220px]" />
        </div>
      </div>

      {/* Toggle Laporan (Dashboard) */}
      {(authRole === "rc" || authRole === "oc" || authRole === "pf" || authRole === "fc" || authRole === "afc" || authRole === "fs" || authRole === "eqi" || authRole === "mandur" || authRole === "staff") &&
        activeTab === "dashboard" && (
          <div className="mt-3 sm:mt-4 relative z-10 animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Level 1: Jenis Laporan (Pill Style) - Scrollable */}
            <div className="flex items-center gap-1.5 w-full">
              <div
                className="flex w-full overflow-x-auto scrollbar-hide bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/35 backdrop-blur-xl shadow-lg shadow-emerald-950/50 gap-1.5 items-center"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {reportTabs.map((r) => (
                  <ReportTab
                    key={r.id}
                    r={r}
                    reportType={reportType}
                    setReportType={setReportType}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      {/* FC Logo Options Modal */}
      <AnimatePresence>
        {showLogoOptionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowLogoOptionsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-xl bg-slate-950">
                <img src={customLogoUrl!} alt="Logo Semasa" className="w-full h-full object-cover" />
              </div>

              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Pengurusan Logo Header</h3>
                <p className="text-[11px] font-medium text-emerald-400 mt-1">Sesi Akses: Field Controller (FC)</p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Tukar Logo (Pilih dari Galeri)
                </button>

                <button
                  onClick={handleDeleteLogo}
                  className="w-full py-2.5 px-4 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Padam Logo (Guna Logo Asal)
                </button>

                <button
                  onClick={() => setShowLogoOptionsModal(false)}
                  className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide Presentation Modal */}
      <SlidePresentationModal
        isOpen={showPresentationModal}
        onClose={() => setShowPresentationModal(false)}
      />

      {/* Modul Pentadbir (Admin Hub) Dialog */}
      <AdminHubModal
        isOpen={showAdminHubModal}
        onClose={() => setShowAdminHubModal(false)}
        isDarkMode={isDarkMode}
        pendingDevicesCount={pendingDevicesCount}
        onOpenEstateControl={() => setShowEstateModal(true)}
        onOpenSecurityDashboard={() => {
          setSecurityDashboardTab(pendingDevicesCount > 0 ? 'devices' : 'overview');
          setShowSecurityDashboardModal(true);
        }}
        onOpenRbacManager={() => setShowRbacModal(true)}
      />

      {/* RBAC PIN & Role Access Management Modal (FC Admin FPM Tunggal Sahaja) */}
      <RbacManagerModal
        isOpen={showRbacModal}
        onClose={() => setShowRbacModal(false)}
        currentUserRole={authRole}
        activeEstateId={currentEstate.id}
        onSaveComplete={() => {
          showToast?.('Tetapan PIN, No. Kakitangan & Akses pengguna berjaya dikemaskini!', 'success');
        }}
      />

      {/* Super Admin Security & Session Audit Dashboard Modal */}
      {showSecurityDashboardModal && (
        <SecurityDashboardModal
          isOpen={showSecurityDashboardModal}
          onClose={() => setShowSecurityDashboardModal(false)}
          isDarkMode={isDarkMode}
          initialTab={securityDashboardTab}
          showToast={showToast}
        />
      )}

      {/* Multi-Estate Switcher Modal (Wilayah JB -> Zon Adela) */}
      <EstateSwitcherModal
        isOpen={showEstateModal}
        onClose={() => setShowEstateModal(false)}
        authRole={authRole}
        onSelectEstate={(estate) => {
          showToast?.(`Bertukar ke ${estate.name}`, 'success');
        }}
        showToast={showToast}
        onOpenMasterDataset={(estateId) => {
          setTargetMasterEstateId(estateId);
          setShowMasterDatasetModal(true);
        }}
      />

      {/* Master Dataset Setup Modal for Standby Estates (Kledang, Sening) */}
      <MasterDatasetModal
        isOpen={showMasterDatasetModal}
        onClose={() => setShowMasterDatasetModal(false)}
        defaultEstateId={targetMasterEstateId || currentEstate.id}
      />
    </header>
  );
};
