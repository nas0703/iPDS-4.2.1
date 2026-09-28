import React, { useState } from 'react';
import { EmployeeMasterView } from './components/EmployeeMasterView';
import { PekerjaList } from './components/PekerjaList';
import { KumpulanNegaraView } from './components/KumpulanNegaraView';
import { AttendanceSheet } from './components/AttendanceSheet';
import { AssignmentForm } from './components/AssignmentForm';
import { MusterChitView } from './components/MusterChitView';
import { ECheckrollView } from './components/ECheckrollView';
import { Users, Globe, ClipboardCheck, Briefcase, FileText, Calculator, ShieldCheck } from 'lucide-react';

interface PekerjaModuleProps {
  authRole?: string | null;
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const PekerjaModule: React.FC<PekerjaModuleProps> = ({ authRole, isDarkMode, onShowToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'maklumat_asas' | 'senarai' | 'kumpulan' | 'kedatangan' | 'tugasan' | 'musterchit' | 'echeckroll'>('maklumat_asas');

  const tabs = [
    { id: 'maklumat_asas' as const, label: 'Maklumat Asas Staf', icon: ShieldCheck },
    { id: 'senarai' as const, label: 'Senarai Buruh / Penuai', icon: Users },
    { id: 'kumpulan' as const, label: 'Kumpulan Kerja', icon: Globe },
    { id: 'kedatangan' as const, label: 'Rekod Kehadiran', icon: ClipboardCheck },
    { id: 'tugasan' as const, label: 'Tugasan Kerja', icon: Briefcase },
    { id: 'musterchit' as const, label: 'Muster Chit', icon: FileText },
    { id: 'echeckroll' as const, label: 'E-Checkroll', icon: Calculator },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Module Card Wrapper */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isDarkMode ? 'bg-slate-900 border-white/5 shadow-2xl' : 'bg-white border-slate-100 shadow-xl'
      }`}>
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                iPDS Muster
              </span>
            </div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Pengurusan Pekerja &amp; Muster Chit
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase">Sistem Pengurusan Rekod, Kehadiran, Tugasan &amp; Muster Chit Kakitangan Ladang</p>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/5 mb-3 overflow-x-auto gap-1.5 pb-2 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase whitespace-nowrap transition-all active:scale-95 border ${
                  isActive 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' 
                    : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="mt-2">
          {activeSubTab === 'maklumat_asas' && (
            <EmployeeMasterView authRole={authRole} isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'senarai' && (
            <PekerjaList isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'kumpulan' && (
            <KumpulanNegaraView isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'kedatangan' && (
            <AttendanceSheet isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'tugasan' && (
            <AssignmentForm isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'musterchit' && (
            <MusterChitView isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
          {activeSubTab === 'echeckroll' && (
            <ECheckrollView isDarkMode={isDarkMode} onShowToast={onShowToast} />
          )}
        </div>
      </div>
    </div>
  );
};
