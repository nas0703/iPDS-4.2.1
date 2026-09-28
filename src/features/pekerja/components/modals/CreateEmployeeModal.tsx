import React, { useState, useMemo } from 'react';
import { 
  EmployeeMaster, 
  OrgPosition, 
  EmploymentStatus 
} from '../../types/employeeMaster';
import { 
  employeeMasterService, 
  DEFAULT_DIVISIONS, 
  getBlocksForEstate 
} from '../../services/employeeMasterService';
import { ESTATES_REGISTRY, EstateConfig } from '../../../../config/estateRegistry';
import { 
  X, 
  UserPlus, 
  Briefcase, 
  Building2, 
  Layers, 
  Calendar, 
  Phone, 
  Mail, 
  CreditCard,
  CheckSquare,
  Square
} from 'lucide-react';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEmployee: EmployeeMaster) => void;
  isDarkMode: boolean;
  positions: OrgPosition[];
  onShowToast: (type: 'success' | 'error', msg: string) => void;
  isUserSuperAdmin?: boolean;
  defaultEstateId?: string;
}

export const CreateEmployeeModal: React.FC<CreateEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isDarkMode,
  positions,
  onShowToast,
  isUserSuperAdmin = false,
  defaultEstateId = 'FPM_TUNGGAL'
}) => {
  const [staffNo, setStaffNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [positionId, setPositionId] = useState(positions[3]?.id || positions[0]?.id || '');
  const [status, setStatus] = useState<EmploymentStatus>('ACTIVE');
  const [idCard, setIdCard] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Initial assignment fields
  const initialEstate = (!isUserSuperAdmin && defaultEstateId) ? defaultEstateId : 'FPM_TUNGGAL';
  const [selectedEstate, setSelectedEstate] = useState<string>(initialEstate);
  const [selectedDivision, setSelectedDivision] = useState<string>(() => {
    const matchingDiv = DEFAULT_DIVISIONS.find(d => d.estate_id === initialEstate);
    return matchingDiv ? matchingDiv.id : 'DIV_TGL_P1';
  });
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const availableDivisions = useMemo(() => {
    return DEFAULT_DIVISIONS.filter(d => d.estate_id === selectedEstate);
  }, [selectedEstate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNo.trim() || !fullName.trim()) {
      onShowToast('error', 'Sila lengkapkan No. Staf dan Nama Penuh.');
      return;
    }

    try {
      setSaving(true);
      const created = await employeeMasterService.createEmployee({
        staff_no: staffNo,
        full_name: fullName,
        position_id: positionId,
        employment_status: status,
        id_card_passport: idCard.trim(),
        contact_number: phone.trim(),
        email: email.trim(),
        hire_date: hireDate,
        estate_id: selectedEstate,
        division_id: selectedDivision,
        block_ids: selectedBlocks
      });

      onShowToast('success', `Staf baharu ${created.full_name} (${created.staff_no}) berjaya didaftarkan.`);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      onShowToast('error', 'Gagal mendaftar staf: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Daftar Kakitangan / Staf Baharu
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Pendaftaran rekod master staf dan penetapan lokasi penugasan awal ladang
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Section 1: Profil Peribadi & Staf */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-white/5 pb-1">
              1. Butiran Asas Staf
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  No. Staf / Pekerja *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cth: STF00130"
                  value={staffNo}
                  onChange={(e) => setStaffNo(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nama Penuh *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Mohd Azlan bin Hassan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Briefcase size={12} />
                  Jawatan Standard *
                </label>
                <select
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Status Pekerjaan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EmploymentStatus)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="PROBATION">Percubaan (PROBATION)</option>
                  <option value="INACTIVE">Tidak Aktif (INACTIVE)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <CreditCard size={12} />
                  No. Kad Pengenalan / Pasport
                </label>
                <input
                  type="text"
                  placeholder="Cth: 890101-01-5678"
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Calendar size={12} />
                  Tarikh Mula Berkhidmat (Hire Date) *
                </label>
                <input
                  type="date"
                  required
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Phone size={12} />
                  No. Telefon
                </label>
                <input
                  type="text"
                  placeholder="Cth: 012-3456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Mail size={12} />
                  Alamat Emel Rasmi
                </label>
                <input
                  type="email"
                  placeholder="Cth: azlan@fpm.felda.gov.my"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Penetapan Penugasan Awal */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-white/5 pb-1">
              2. Penetapan Ladang, Peringkat &amp; Blok Awal
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Building2 size={12} />
                  Ladang
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

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                  <Layers size={12} />
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
            </div>

            {/* Block selection */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Pilih Blok Bertanggungjawab (Pilihan):
              </label>

              {availableBlocks.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Tiada blok tersenarai untuk bahagian ini.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 custom-scrollbar">
                  {availableBlocks.map(b => {
                    const isChecked = selectedBlocks.includes(b.block_code);
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => handleToggleBlock(b.block_code)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-bold transition border ${
                          isChecked 
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked ? <CheckSquare size={12} /> : <Square size={12} />}
                        <span>{b.block_code}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Mendaftar...' : 'Daftar Staf Sekarang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
