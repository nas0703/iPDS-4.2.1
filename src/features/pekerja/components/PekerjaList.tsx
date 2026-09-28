import React, { useState, useEffect } from 'react';
import { Worker } from '../types';
import { getWorkers, saveWorker, toggleWorkerStatus, updateWorker, deleteWorker } from '../services';
import { getGroupColorTheme } from '../helpers';
import { 
  User, Plus, Search, Check, X, Users, Globe, Trash2, Pencil
} from 'lucide-react';

interface PekerjaListProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

const COUNTRIES = [
  { name: 'Malaysia', label: 'Malaysia (Tempatan)', flag: '🇲🇾' },
  { name: 'Indonesia', label: 'Indonesia', flag: '🇮🇩' },
  { name: 'Bangladesh', label: 'Bangladesh', flag: '🇧🇩' },
  { name: 'Nepal', label: 'Nepal', flag: '🇳🇵' },
  { name: 'India', label: 'India', flag: '🇮🇳' }
];

export const PekerjaList: React.FC<PekerjaListProps> = ({ isDarkMode, onShowToast }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorker, setNewWorker] = useState({
    worker_no: '',
    name: '',
    role: 'Penuai',
    negara_asal: 'Malaysia',
    kumpulan: 'Kerja Am dan Lain-lain',
    is_active: true
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editWorkerForm, setEditWorkerForm] = useState({
    worker_no: '',
    name: '',
    role: 'Penuai',
    negara_asal: 'Malaysia',
    kumpulan: 'Kerja Am dan Lain-lain',
    is_active: true
  });

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await getWorkers();
      setWorkers(data);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat senarai pekerja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleToggleStatus = async (workerId: string, currentStatus: boolean | undefined) => {
    try {
      const updated = await toggleWorkerStatus(workerId, !currentStatus);
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, is_active: updated.is_active } : w));
      onShowToast('success', `Status ${updated.name} dikemaskini.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal menukar status pekerja: ' + err.message);
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.worker_no.trim() || !newWorker.name.trim()) {
      onShowToast('error', 'Sila isi semua maklumat mandatori.');
      return;
    }

    try {
      const added = await saveWorker(newWorker);
      setWorkers(prev => [added, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      setNewWorker({ 
        worker_no: '', 
        name: '', 
        role: 'Penuai', 
        negara_asal: 'Malaysia',
        kumpulan: 'Kerja Am dan Lain-lain',
        is_active: true 
      });
      onShowToast('success', `Pekerja ${added.name} berjaya didaftarkan.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal mendaftar pekerja: ' + err.message);
    }
  };

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    if (!editWorkerForm.worker_no.trim() || !editWorkerForm.name.trim()) {
      onShowToast('error', 'Sila isi semua maklumat mandatori.');
      return;
    }

    try {
      const updated = await updateWorker(editingWorker.id, editWorkerForm);
      setWorkers(prev => prev.map(w => w.id === editingWorker.id ? updated : w).sort((a,b) => a.name.localeCompare(b.name)));
      setShowEditModal(false);
      setEditingWorker(null);
      onShowToast('success', `Maklumat pekerja ${updated.name} berjaya dikemaskini.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal mengemaskini maklumat pekerja: ' + err.message);
    }
  };

  const handleDeleteWorker = async (id: string, name: string) => {
    if (!window.confirm(`Adakah anda pasti untuk PADAM PEKERJA "${name}" secara kekal daripuk pangkalan data?`)) return;
    try {
      await deleteWorker(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
      onShowToast('success', `Pekerja "${name}" berjaya dipadam secara kekal.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal memadam pekerja: ' + err.message);
    }
  };

  const filteredWorkers = workers
    .filter(w => 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.worker_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aActive = a.is_active ?? true;
      const bActive = b.is_active ?? true;
      if (aActive !== bActive) {
        return aActive ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Cari nama, no. pekerja atau peranan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-xl outline-none transition-all text-[11px] font-bold uppercase tracking-wide ${
              isDarkMode 
                ? 'bg-slate-800/50 border-white/5 text-white focus:border-emerald-500 focus:bg-slate-800' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
            }`}
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
        >
          <Plus size={14} />
          Tambah Pekerja Baru
        </button>
      </div>

      {/* Workers List - Compact Rows Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Memuatkan Pekerja...</p>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className={`p-8 text-center rounded-2xl border ${isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
          <p className="text-xs font-bold text-slate-500 uppercase">Tiada rekod pekerja dijumpai.</p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-2xl border ${
          isDarkMode ? 'border-white/5 bg-slate-900/40' : 'border-slate-100 bg-white shadow-sm'
        }`}>
          <div className="min-w-[650px] divide-y divide-slate-100 dark:divide-white/5">
            {/* Table Header */}
            <div className={`grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b ${
              isDarkMode ? 'bg-slate-900/60 border-white/5 text-slate-400' : 'bg-slate-50/80 border-slate-100 text-slate-500'
            }`}>
              <div className="col-span-1">No.</div>
              <div className="col-span-4">Nama Pekerja</div>
              <div className="col-span-2">Negara Asal</div>
              <div className="col-span-2">Peranan</div>
              <div className="col-span-3 text-right">Tindakan / Status</div>
            </div>

            {/* Table Body */}
            {filteredWorkers.map((w, index) => {
              const theme = getGroupColorTheme(w.role);
              const countryMeta = COUNTRIES.find(c => c.name === (w.negara_asal || 'Malaysia')) || COUNTRIES[0];
              const isTempatan = (w.negara_asal || 'Malaysia').toLowerCase() === 'malaysia';
              const countryNameText = isTempatan ? 'TEMPATAN' : (w.negara_asal || 'Malaysia').toUpperCase();

              return (
                <div 
                  key={w.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-2 items-center transition-all duration-200 ${
                    isDarkMode 
                      ? 'hover:bg-slate-900/50' 
                      : 'hover:bg-slate-50/50'
                  }`}
                >
                  {/* Bilangan Column */}
                  <div className="col-span-1 text-[10px] font-black font-mono text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </div>

                  {/* Nama Pekerja Column */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <h4 className={`text-xs font-black uppercase tracking-tight truncate ${
                        w.is_active ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400 line-through'
                      }`}>
                        {w.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5 uppercase flex items-center gap-1.5">
                        <span>{w.worker_no}</span>
                        {w.kumpulan && w.kumpulan !== 'Kerja Am dan Lain-lain' && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">👥 {w.kumpulan}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Negara Asal Column */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wide text-slate-800 dark:text-slate-200 uppercase">
                      <span className="text-xs select-none shrink-0">{countryMeta.flag}</span>
                      <span className="truncate">{countryNameText}</span>
                    </div>
                  </div>

                  {/* Peranan Column */}
                  <div className="col-span-2">
                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      {w.role}
                    </span>
                  </div>

                  {/* Status & Actions Column */}
                  <div className="col-span-3 flex items-center justify-end gap-3.5">
                    {/* Edit Button */}
                    <button 
                      onClick={() => {
                        setEditingWorker(w);
                        setEditWorkerForm({
                          worker_no: w.worker_no,
                          name: w.name,
                          role: w.role,
                          negara_asal: w.negara_asal || 'Malaysia',
                          kumpulan: w.kumpulan || 'Kerja Am dan Lain-lain',
                          is_active: w.is_active ?? true
                        });
                        setShowEditModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all shrink-0"
                      title="Kemaskini Maklumat"
                    >
                      <Pencil size={11} />
                    </button>

                    {/* Delete Button */}
                    <button 
                      onClick={() => handleDeleteWorker(w.id, w.name)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 dark:bg-rose-500/10 text-rose-500 hover:text-white transition-all shrink-0"
                      title="Padam Rekod Pekerja"
                    >
                      <Trash2 size={11} />
                    </button>

                    {/* Active/Inactive Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${w.is_active ? 'text-emerald-500' : 'text-rose-500 dark:text-rose-400/80'}`}>
                        {w.is_active ? 'Aktif' : 'Tak Aktif'}
                      </span>
                      <button 
                        onClick={() => handleToggleStatus(w.id, w.is_active)}
                        className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                          w.is_active ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                        title={w.is_active ? 'Nyahaktifkan pekerja' : 'Aktifkan pekerja'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            w.is_active ? 'translate-x-4.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className={`relative w-full max-w-md p-5 rounded-2xl shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                <Users size={16} className="text-emerald-500" />
                Daftar Pekerja Baru
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddWorker} className="space-y-3.5 text-xs font-bold uppercase">
              <div>
                <label className="block text-slate-400 mb-1">No. Pekerja (Mandatori & Unik)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PKJ092"
                  value={newWorker.worker_no}
                  onChange={(e) => setNewWorker(prev => ({ ...prev, worker_no: e.target.value.toUpperCase() }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold tracking-wider ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Penuh Pekerja</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: AHMAD SUBARI"
                  value={newWorker.name}
                  onChange={(e) => setNewWorker(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori / Peranan</label>
                  <select
                    value={newWorker.role}
                    onChange={(e) => setNewWorker(prev => ({ ...prev, role: e.target.value }))}
                    className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Penuai">Penuai / Harvester</option>
                    <option value="Mandor">Mandor / Penyelia</option>
                    <option value="Pembaja">Pembaja</option>
                    <option value="Racun / Merumput">Racun / Merumput</option>
                    <option value="Pekerja Am">Pekerja Am / Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Negara Asal</label>
                  <select
                    value={newWorker.negara_asal}
                    onChange={(e) => setNewWorker(prev => ({ ...prev, negara_asal: e.target.value }))}
                    className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kumpulan Kerja Asal</label>
                <select
                  value={newWorker.kumpulan}
                  onChange={(e) => setNewWorker(prev => ({ ...prev, kumpulan: e.target.value }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Menuai">Menuai</option>
                  <option value="Penggredan (EQI)">Penggredan (EQI)</option>
                  <option value="Pembaja">Pembaja</option>
                  <option value="Semburan Racun">Semburan Racun</option>
                  <option value="Pangkas Pelepah">Pangkas Pelepah</option>
                  <option value="Kerja Am dan Lain-lain">Kerja Am dan Lain-lain</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider py-3 rounded-xl shadow-md active:scale-95 transition-all"
                >
                  Daftarkan Pekerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {showEditModal && editingWorker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => { setShowEditModal(false); setEditingWorker(null); }} />
          <div className={`relative w-full max-w-md p-5 rounded-2xl shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-1.5">
                <Pencil size={15} className="text-emerald-500" />
                Kemaskini Maklumat Pekerja
              </h3>
              <button 
                onClick={() => { setShowEditModal(false); setEditingWorker(null); }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleUpdateWorker} className="space-y-3.5 text-xs font-bold uppercase">
              <div>
                <label className="block text-slate-400 mb-1">No. Pekerja (Mandatori & Unik)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PKJ092"
                  value={editWorkerForm.worker_no}
                  onChange={(e) => setEditWorkerForm(prev => ({ ...prev, worker_no: e.target.value.toUpperCase() }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold tracking-wider ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Penuh Pekerja</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: AHMAD SUBARI"
                  value={editWorkerForm.name}
                  onChange={(e) => setEditWorkerForm(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori / Peranan</label>
                  <select
                    value={editWorkerForm.role}
                    onChange={(e) => setEditWorkerForm(prev => ({ ...prev, role: e.target.value }))}
                    className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Penuai">Penuai / Harvester</option>
                    <option value="Mandor">Mandor / Penyelia</option>
                    <option value="Pembaja">Pembaja</option>
                    <option value="Racun / Merumput">Racun / Merumput</option>
                    <option value="Pekerja Am">Pekerja Am / Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Negara Asal</label>
                  <select
                    value={editWorkerForm.negara_asal}
                    onChange={(e) => setEditWorkerForm(prev => ({ ...prev, negara_asal: e.target.value }))}
                    className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                      isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kumpulan Kerja Asal</label>
                <select
                  value={editWorkerForm.kumpulan}
                  onChange={(e) => setEditWorkerForm(prev => ({ ...prev, kumpulan: e.target.value }))}
                  className={`w-full p-2.5 border rounded-xl outline-none font-bold ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Menuai">Menuai</option>
                  <option value="Penggredan (EQI)">Penggredan (EQI)</option>
                  <option value="Pembaja">Pembaja</option>
                  <option value="Semburan Racun">Semburan Racun</option>
                  <option value="Pangkas Pelepah">Pangkas Pelepah</option>
                  <option value="Kerja Am dan Lain-lain">Kerja Am dan Lain-lain</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider py-3 rounded-xl shadow-md active:scale-95 transition-all"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
