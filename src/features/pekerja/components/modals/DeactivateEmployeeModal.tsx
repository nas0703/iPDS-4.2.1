import React, { useState } from 'react';
import { EmployeeMaster, EmploymentStatus } from '../../types/employeeMaster';
import { employeeMasterService } from '../../services/employeeMasterService';
import { 
  X, 
  UserMinus, 
  AlertTriangle, 
  Calendar, 
  FileText 
} from 'lucide-react';

interface DeactivateEmployeeModalProps {
  employee: EmployeeMaster;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const DeactivateEmployeeModal: React.FC<DeactivateEmployeeModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSuccess,
  isDarkMode,
  onShowToast
}) => {
  const [status, setStatus] = useState<EmploymentStatus>('RESIGNED');
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await employeeMasterService.updateEmploymentStatus(employee.id, status, reason);
      onShowToast('success', `Status staf ${employee.full_name} berjaya dikemas kini kepada ${status}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast('error', 'Gagal mengemaskini status staf: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <UserMinus size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight text-rose-600 dark:text-rose-400">
                Penyahaktifan / Penamatan Staf
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {employee.staff_no} • {employee.full_name}
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

        {/* Warning Callout */}
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <strong>Prinsip Integriti Audit:</strong> Rekod staf dan sejarah penugasan lampau tidak akan dipadam dari pangkalan data. Penugasan aktif akan ditamatkan pada tarikh kuat kuasa.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Status Penamatan Baharu
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EmploymentStatus)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="RESIGNED">Meletakkan Jawatan (RESIGNED)</option>
              <option value="RETIRED">Bersara Wajib / Pilihan (RETIRED)</option>
              <option value="TERMINATED">Penamatan Perkhidmatan (TERMINATED)</option>
              <option value="INACTIVE">Nyahaktif Sementara (INACTIVE)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
              <Calendar size={12} />
              Tarikh Akhir Berkhidmat
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
              <FileText size={12} />
              Sebab / Justifikasi Rasmi
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cth: Surat peletakan jawatan bertarikh ... / Mencapai umur persaraan wajib"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Mengemaskini...' : 'Sahkan Penyahaktifan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
