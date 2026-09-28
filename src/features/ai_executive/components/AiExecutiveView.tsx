import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  FileText,
  Activity,
  Gauge
} from "lucide-react";
import { MorningBriefingModal } from "../../dashboard/components/MorningBriefingModal";
import { ManualSawitChatModal } from "../../dashboard/components/ManualSawitChatModal";
import { RagStatisticsCard } from "./RagStatisticsCard";

interface AiExecutiveViewProps {
  onOpenMorningBriefing?: () => void;
  onOpenManualSawit?: () => void;
  authRole: string | null;
  analytics?: any;
  allDeliveries?: any[];
  isDarkMode?: boolean;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  currentDate?: string;
  initialSubmodule?: "briefing" | "msl" | "hub";
}

export const AiExecutiveView: React.FC<AiExecutiveViewProps> = ({
  authRole,
  analytics,
  allDeliveries = [],
  isDarkMode = false,
  onShowToast,
  currentDate,
  initialSubmodule = "briefing"
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"briefing" | "msl">(
    initialSubmodule === "msl" ? "msl" : "briefing"
  );
  const [showRagStats, setShowRagStats] = useState<boolean>(true);

  const roleStr = authRole?.toLowerCase();
  const roleBadge = roleStr === "fc" ? "FC" : roleStr === "pf" ? "PF" : "EXEC";

  return (
    <div className="w-full max-w-5xl mx-auto space-y-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200 pb-16 sm:pb-20 px-0 sm:px-1">
      {/* 1. EXECUTIVE CONTROL BAR */}
      <div className="bg-slate-950/90 dark:bg-slate-950 text-slate-100 rounded-xl px-2.5 sm:px-3.5 py-1.5 border border-slate-800/90 shadow-sm flex items-center justify-between gap-2">
        {/* Left Title & Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles size={14} className="animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white truncate">
              AI Exec <span className="text-emerald-400 font-bold">iPDS</span>
            </h1>
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              {roleBadge}
            </span>
          </div>
        </div>

        {/* Right Actions: Stat Toggle & Submodule Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRagStats(!showRagStats)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all border cursor-pointer ${
              showRagStats
                ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300 shadow-xs"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Papar/Sembunyi Kad Statistik Prestasi & Kekerapan RAG"
          >
            <Gauge size={12} className={showRagStats ? "text-emerald-400 animate-pulse" : "text-slate-400"} />
            <span className="hidden sm:inline">Statistik RAG</span>
          </button>

          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab("briefing")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                activeSubTab === "briefing"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700/60 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText size={12} className={activeSubTab === "briefing" ? "text-emerald-400" : ""} />
              <span>Taklimat AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("msl")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                activeSubTab === "msl"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen size={12} className={activeSubTab === "msl" ? "text-emerald-200" : ""} />
              <span>Manual RAG</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KAD STATISTIK KEKERAPAN & PURATA MASA RESPONS RAG */}
      {showRagStats && (
        <RagStatisticsCard
          onOpenManualSawit={() => setActiveSubTab("msl")}
          onShowToast={onShowToast}
        />
      )}

      {/* 3. MAXIMIZED OUTPUT DISPLAY CONTAINER */}
      {activeSubTab === "briefing" ? (
        <MorningBriefingModal
          isOpen={true}
          embedded={true}
          onClose={() => {}}
          isDarkMode={isDarkMode}
          onShowToast={onShowToast}
          currentDate={currentDate || analytics?.displayDate}
          analytics={analytics}
          allDeliveries={allDeliveries}
          authRole={authRole}
          initialSubmodule="briefing"
        />
      ) : (
        <div className="w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-slate-800/80 h-[calc(100dvh-180px)] sm:h-[calc(100vh-190px)] min-h-[500px] flex flex-col bg-slate-950">
          <ManualSawitChatModal
            isOpen={true}
            embedded={true}
            onClose={() => {}}
            onShowToast={onShowToast}
          />
        </div>
      )}
    </div>
  );
};

