import React, { useEffect, useState } from 'react';
import { EmployeeMaster, EmployeeAssignment } from '../../types/employeeMaster';
import { employeeMasterService } from '../../services/employeeMasterService';
import { 
  X, 
  History, 
  Calendar, 
  MapPin, 
  Layers, 
  Building2, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  Clock
} from 'lucide-react';

interface AssignmentHistoryModalProps {
  employee: EmployeeMaster;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const AssignmentHistoryModal: React.FC<AssignmentHistoryModalProps> = ({
  employee,
  isOpen,
  onClose,
  isDarkMode
}) => {
  const [history, setHistory] = useState<EmployeeAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    employeeMasterService.getAssignmentHistory(employee.id).then(records => {
      if (isMounted) {
        setHistory(records);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [employee.id, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <History size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase tracking-tight">
                  Sejarah Penugasan &amp; Pertukaran
                </h3>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {employee.staff_no}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {employee.full_name} • {employee.position?.title || 'Staf Operasi'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Clock className="animate-spin" size={24} />
              <span className="text-xs font-bold uppercase tracking-wider">Memuat Sejarah Penugasan...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShieldAlert className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-xs font-bold uppercase">Tiada rekod penugasan lampau dijumpai.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {history.map((record, index) => {
                const isActive = record.status === 'ACTIVE';
                return (
                  <div key={record.id || index} className="relative group">
                    {/* Timeline Dot */}
                    <div 
                      className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 transition ${
                        isActive 
                          ? 'bg-emerald-500 border-white dark:border-slate-900 ring-4 ring-emerald-500/20' 
                          : 'bg-slate-400 border-white dark:border-slate-900 ring-2 ring-slate-400/20'
                      }`} 
                    />

                    {/* Card Container */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      isActive 
                        ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/20 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-white/5 opacity-85 hover:opacity-100'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md tracking-wider border ${
                            isActive 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}>
                            {isActive ? 'Penugasan Semasa (Aktif)' : 'Pertukaran Lampau (Arsip)'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 font-bold">
                            <Calendar size={12} />
                            {record.effective_from} {record.effective_to ? `sehingga ${record.effective_to}` : '— KINI'}
                          </span>
                        </div>
                        {record.assignment_role && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 uppercase">
                            Peranan: {record.assignment_role}
                          </span>
                        )}
                      </div>

                      {/* Location details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Ladang</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {record.estate_name || record.estate_id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <Layers size={14} className="text-slate-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Peringkat / Bahagian</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {record.division_name || record.division_id || 'Peringkat Operasi'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Assigned Blocks */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-white/5">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                          Blok Bertanggungjawab Diselia:
                        </span>
                        {record.blocks && record.blocks.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {record.blocks.map(b => (
                              <span 
                                key={b.id || b.block_code}
                                className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-white/10"
                              >
                                {b.block_code} ({b.hectarage ? `${b.hectarage} Ha` : 'Blok'})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Tiada blok spesifik (Tanggungjawab am peringkat / pejabat pentadbiran).
                          </span>
                        )}
                      </div>

                      {/* Transfer Reason */}
                      {record.transfer_reason && (
                        <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 p-2 rounded-lg">
                          <strong className="text-slate-700 dark:text-slate-300 font-semibold">Catatan Operasi: </strong>
                          {record.transfer_reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
