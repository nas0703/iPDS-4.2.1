
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Plus, 
  History, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Loader2,
  ChevronRight,
  Droplets,
  Zap,
  Target,
  FileSpreadsheet,
  Package
} from 'lucide-react';
import { FertilizerDashboard } from './components/FertilizerDashboard';
import { FertilizerInput } from './components/FertilizerInput';
import { FertilizerHistory } from './components/FertilizerHistory';
import { FertilizerProgress } from './components/FertilizerProgress';
import { FertilizerProductivity } from './components/FertilizerProductivity';
import { FertilizerAdmin } from './components/FertilizerAdmin';
import { FertilizerProgramTable } from './components/FertilizerProgramTable';
import { FertilizerInventory } from './components/FertilizerInventory';

interface FertilizerModuleProps {
  authRole: string;
  isDarkMode: boolean;
}

export const FertilizerModule: React.FC<FertilizerModuleProps> = ({ authRole, isDarkMode }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'input' | 'history' | 'program' | 'progress' | 'productivity' | 'admin' | 'inventory'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  const subTabs = [
    { id: 'dashboard', label: 'KPI Utama', icon: LayoutDashboard, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff', 'mandur'] },
    { id: 'input', label: 'Daftar Kerja', icon: Plus, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff', 'mandur'] },
    { id: 'progress', label: 'Progres Membaja', icon: TrendingUp, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs'] },
    { id: 'program', label: 'Program Membaja', icon: FileSpreadsheet, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff'] },
    { id: 'productivity', label: 'Analitik', icon: BarChart3, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs'] },
    { id: 'inventory', label: 'Inventori', icon: Package, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff'] },
    { id: 'history', label: 'Sejarah', icon: History, roles: ['rc', 'oc', 'pf', 'fc', 'afc', 'fs', 'staff'] },
    { id: 'admin', label: 'Admin', icon: Settings, roles: ['rc', 'oc', 'pf', 'fc', 'afc'] }
  ].filter(tab => tab.roles.includes(authRole));

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Header */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Droplets className="text-emerald-500" size={18} />
            </div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Modul Baja</h2>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
            {subTabs.find(t => t.id === activeSubTab)?.label}
          </div>
        </div>

        {/* Horizontal Mini Tabs (Scrollable on mobile) */}
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all active:scale-95 border ${
                activeSubTab === tab.id 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="relative z-0"
        >
          {activeSubTab === 'dashboard' && <FertilizerDashboard authRole={authRole} />}
          {activeSubTab === 'input' && <FertilizerInput />}
          {activeSubTab === 'inventory' && <FertilizerInventory />}
          {activeSubTab === 'program' && <FertilizerProgramTable />}
          {activeSubTab === 'history' && <FertilizerHistory authRole={authRole} />}
          {activeSubTab === 'progress' && <FertilizerProgress />}
          {activeSubTab === 'productivity' && <FertilizerProductivity />}
          {activeSubTab === 'admin' && <FertilizerAdmin />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
