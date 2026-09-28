import React from 'react';
import {
  LayoutDashboard, History, FileSpreadsheet, BarChart3, TrendingUp,
  Package, CloudRain, ClipboardCheck, Users, AlertTriangle, ShieldCheck
} from 'lucide-react';

interface DashboardSubNavProps {
  reportType: string;
  effectiveReportType: string;
  activeKualitiTab?: string;
  setActiveKualitiTab?: (tab: 'muda' | 'kpa_kpg' | 'penggredan') => void;
  currentHasilTab?: string;
  setActiveHasilTab?: (tab: any) => void;
  setShowFSA13Report?: (val: boolean) => void;
  currentEfbTab?: string;
  setActiveEfbTab?: (tab: any) => void;
}

export const DashboardSubNav: React.FC<DashboardSubNavProps> = ({
  reportType,
  effectiveReportType,
  activeKualitiTab = 'muda',
  setActiveKualitiTab,
  currentHasilTab = 'kpi',
  setActiveHasilTab,
  setShowFSA13Report,
  currentEfbTab = 'kpi',
  setActiveEfbTab,
}) => {
  return (
    <>
      {/* KUALITI BTS SUBTABS */}
      {reportType === "kualiti_bts" && (
        <div className="flex flex-col gap-2 mb-4 mt-2">
          <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
            {[
              { id: 'muda', label: 'BTS Muda', icon: AlertTriangle },
              { id: 'kpa_kpg', label: 'KPG=KPA', icon: ShieldCheck },
              { id: 'penggredan', label: 'iPDS Grading', icon: ClipboardCheck }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveKualitiTab && setActiveKualitiTab(tab.id as 'muda' | 'kpa_kpg' | 'penggredan')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all active:scale-95 border ${
                  effectiveReportType === tab.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* HASIL SUBTABS */}
      {reportType === "hasil" && (
        <div className="flex flex-col gap-2 mb-4 mt-2">
          <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
            {[
              { id: 'kpi', label: 'KPI Utama', icon: LayoutDashboard },
              { id: 'sejarah', label: 'Sejarah Hasil', icon: History },
              { id: 'laporan', label: 'Laporan', icon: FileSpreadsheet },
              { id: 'analitik', label: 'Analitik', icon: BarChart3 },
              { id: 'abw', label: 'ABW', icon: TrendingUp },
              { id: 'bbc', label: 'BBC', icon: Package },
              { id: 'hujan', label: 'Laporan Hujan', icon: CloudRain },
              { id: 'backlog', label: 'Laporan Backlog', icon: ClipboardCheck },
              { id: 'produktiviti', label: 'Produktiviti Menuai', icon: Users }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (setActiveHasilTab) setActiveHasilTab(tab.id as any);
                  if (tab.id === 'laporan' && setShowFSA13Report) setShowFSA13Report(true);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all active:scale-95 border ${
                  currentHasilTab === tab.id 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EFB SUBTABS */}
      {reportType === "efb" && (
        <div className="flex flex-col gap-2 mb-4 mt-2">
          <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
            {[
              { id: 'kpi', label: 'KPI Utama EFB', icon: LayoutDashboard },
              { id: 'sejarah', label: 'Sejarah EFB', icon: History }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveEfbTab && setActiveEfbTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all active:scale-95 border ${
                  currentEfbTab === tab.id 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
