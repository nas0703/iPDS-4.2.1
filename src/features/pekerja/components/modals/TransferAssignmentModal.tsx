import React, { useState, useMemo } from 'react';
import { EmployeeMaster } from '../../types/employeeMaster';
import { 
  employeeMasterService, 
  DEFAULT_DIVISIONS, 
  getBlocksForEstate 
} from '../../services/employeeMasterService';
import { ESTATES_REGISTRY, EstateConfig } from '../../../../config/estateRegistry';
import { 
  X, 
  ArrowRightLeft, 
  Building2, 
  Layers, 
  Calendar, 
  FileText, 
  Check, 
  CheckSquare, 
  Square 
} from 'lucide-react';

interface TransferAssignmentModalProps {
  employee: EmployeeMaster;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: EmployeeMaster) => void;
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
  isUserSuperAdmin?: boolean;
}

export const TransferAssignmentModal: React.FC<TransferAssignmentModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSuccess,
  isDarkMode,
  onShowToast,
  isUserSuperAdmin = false
}) => {
  const currentEstate = employee.current_assignment?.estate_id || 'FPM_TUNGGAL';
  const currentDivision = employee.current_assignment?.division_id || 'DIV_TGL_P1';
  const currentBlocks = employee.current_assignment?.blocks?.map(b => b.block_code) || [];

  const [selectedEstate, setSelectedEstate] = useState<string>(currentEstate);
  const [selectedDivision, setSelectedDivision] = useState<string>(currentDivision);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>(currentBlocks);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Available divisions for selected estate
  const availableDivisions = useMemo(() => {
    return DEFAULT_DIVISIONS.filter(d => d.estate_id === selectedEstate);
  }, [selectedEstate]);

  // Available blocks for selected estate & division
  const availableBlocks = useMemo(() => {
    return getBlocksForEstate(selectedEstate, selectedDivision);
  }, [selectedEstate, selectedDivision]);

  const handleToggleBlock = (blockCode: string) => {
    setSelectedBlocks(prev => 
      prev.includes(blockCode)
        ? prev.filter(c => c !== blockCode)
        : [...prev, blockCode]
    );
  };

  const handleSelectAllBlocks = () => {
    if (selectedBlocks.length === availableBlocks.length) {
      setSelectedBlocks([]);
    } else {
      setSelectedBlocks(availableBlocks.map(b => b.block_code));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveFrom) {
      onShowToast('error', 'Sila nyatakan tarikh kuat kuasa pertukaran.');
      return;
    }

    try {
      setSaving(true);
      const updated = await employeeMasterService.transferAssignment({
        employee_id: employee.id,
        estate_id: selectedEstate,
        division_id: selectedDivision,
        block_ids: selectedBlocks,
        effective_from: effectiveFrom,
        transfer_reason: reason.trim() || 'Pertukaran Penugasan Operasi Ladang'
      });

      onShowToast('success', `Pertukaran penugasan staf ${employee.full_name} berjaya direkodkan.`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      onShowToast('error', 'Gagal memindahkan penugasan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Tukar Penugasan / Peringkat / Blok
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {employee.staff_no} • {employee.full_name} ({employee.position?.title || 'Staf'})
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

        {/* Current Active Assignment Callout */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Penugasan Semasa:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {employee.current_assignment?.estate_name || 'FPM Tunggal'} • {employee.current_assignment?.division_name || 'Peringkat 1'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Blok Semasa:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {currentBlocks.length > 0 ? currentBlocks.join(', ') : 'Tiada Blok Spesifik'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Estate Selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Building2 size={13} />
              Ladang Destinasi
            </label>
            <select
              value={selectedEstate}
              disabled={!isUserSuperAdmin}
              onChange={(e) => {
                const newEst = e.target.value;
                setSelectedEstate(newEst);
                const matchingDiv = DEFAULT_DIVISIONS.find(d => d.estate_id === newEst);
                setSelectedDivision(matchingDiv ? matchingDiv.id : '');
                setSelectedBlocks([]);
              }}
              className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                !isUserSuperAdmin ? 'opacity-75 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : ''
              }`}
            >
              {(Object.values(ESTATES_REGISTRY) as EstateConfig[])
                .filter(est => isUserSuperAdmin || est.id === selectedEstate)
                .map(est => (
                  <option key={est.id} value={est.id}>
                    {est.name} ({est.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Division Selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Layers size={13} />
              Peringkat / Bahagian
            </label>
            <select
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value);
                setSelectedBlocks([]);
              }}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {availableDivisions.map(div => (
                <option key={div.id} value={div.id}>
                  {div.name}
                </option>
              ))}
            </select>
          </div>

          {/* Block Selection (Multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pilih Blok Bertanggungjawab ({selectedBlocks.length} Dipilih)
              </label>
              {availableBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllBlocks}
                  className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {selectedBlocks.length === availableBlocks.length ? 'Nyahpilih Semua' : 'Pilih Semua'}
                </button>
              )}
            </div>

            {availableBlocks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Tiada senarai blok didaftarkan untuk bahagian ini.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 custom-scrollbar">
                {availableBlocks.map(b => {
                  const isChecked = selectedBlocks.includes(b.block_code);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => handleToggleBlock(b.block_code)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono font-bold transition border ${
                        isChecked 
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {isChecked ? <CheckSquare size={12} /> : <Square size={12} />}
                      <span>{b.block_code}</span>
                      <span className="text-[9px] text-slate-400 font-sans font-normal">({b.hectarage}Ha)</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Effective Date */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Calendar size={13} />
              Tarikh Kuat Kuasa Pertukaran
            </label>
            <input
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              * Penugasan lampau akan ditutup secara automatik pada tarikh sebelum ini bagi tujuan integriti audit.
            </span>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <FileText size={13} />
              Catatan &amp; Sebab Pertukaran
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cth: Pertukaran giliran zon tuaian suku tahunan / Naik pangkat penyelia"
              className="w-full px-3 py-2 text-xs font-normal rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Submit Buttons */}
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
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Sahkan Pertukaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
