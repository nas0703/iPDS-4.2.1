import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw, DownloadCloud, Smartphone } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export const OfflineStatusBanner: React.FC = () => {
  const { isOnline, canInstall, isInstalled, syncingOfflineData, installPWA } = usePWA();
  const [dismissedInstallBanner, setDismissedInstallBanner] = React.useState(false);

  return (
    <div className="w-full relative z-40">
      {/* 1. Offline Mode Alert Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-950/90 border-b border-amber-500/40 text-amber-200 px-3 py-1.5 text-xs flex items-center justify-between shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2 max-w-xl">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-[11px] leading-tight">
                Mod Luar Talian (Offline Cache Aktif) — Anda masih boleh menyemak data & laporan yang telah disimpan.
              </span>
            </div>
            <span className="text-[9px] font-mono font-bold uppercase bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 shrink-0 ml-2">
              Luar Talian
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Auto Re-syncing Banner */}
      <AnimatePresence>
        {isOnline && syncingOfflineData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-200 px-3 py-1.5 text-xs flex items-center justify-between shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              <span className="font-semibold text-[11px]">
                Menyegerakkan data yang disimpan di luar talian ke pelayan...
              </span>
            </div>
            <span className="text-[9px] font-mono font-bold uppercase bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
              Auto Sync
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. PWA Install Prompt Banner (Only when installable and not dismissed) */}
      <AnimatePresence>
        {canInstall && !dismissedInstallBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-[#062c26] via-[#041f1b] to-[#021311] border-b border-emerald-500/40 px-3 py-2 text-xs flex items-center justify-between shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-300">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-emerald-300 tracking-wider truncate">
                  Pasang Aplikasi iPDS
                </p>
                <p className="text-[9.5px] text-slate-300 truncate">
                  Akses pantas dari skrin utama & sokongan luar talian sepenuhnya
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                onClick={installPWA}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] uppercase rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Pasang
              </button>
              <button
                onClick={() => setDismissedInstallBanner(true)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-1 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
