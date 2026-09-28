import React, { useState, useEffect } from 'react';
import { Worker } from '../types';
import { getWorkers, updateWorkerKumpulan } from '../services';
import { 
  Users, Plus, X, ArrowRight, Check, UserX
} from 'lucide-react';

interface KumpulanNegaraViewProps {
  isDarkMode: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const KumpulanNegaraView: React.FC<KumpulanNegaraViewProps> = ({ isDarkMode, onShowToast }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal / Dropdown State for changing values
  const [showKumpulanModal, setShowKumpulanModal] = useState(false);

  // Custom user-defined groups state
  const [groups, setGroups] = useState<string[]>(['Menuai', 'Penggredan (EQI)', 'Pembaja', 'Semburan Racun', 'Pangkas Pelepah', 'Kerja Am dan Lain-lain']);
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const data = await getWorkers();
      setWorkers(data);

      // Collect any custom groups that already exist on loaded workers
      const existingGroups = new Set(groups);
      data.forEach(w => {
        if (w.kumpulan && w.kumpulan !== 'Tiada Kumpulan') {
          existingGroups.add(w.kumpulan);
        }
      });
      setGroups(Array.from(existingGroups));
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Gagal memuat pekerja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleUpdateGroup = async (workerId: string, groupName: string) => {
    try {
      await updateWorkerKumpulan(workerId, groupName);
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, kumpulan: groupName } : w));
      if (groupName && groupName !== 'Tiada Kumpulan') {
        onShowToast('success', `Dilemparkan ke kumpulan "${groupName}".`);
      } else {
        onShowToast('success', 'Pekerja dikeluarkan dari kumpulan.');
      }
      setShowKumpulanModal(false);
    } catch (err: any) {
      onShowToast('error', 'Gagal mengemaskini kumpulan kerja. Pastikan kolum kumpulan wujud.');
    }
  };

  const handleRemoveFromGroup = async (member: Worker, currentGroup: string) => {
    try {
      // Clear group by setting kumpulan to 'Tiada Kumpulan'
      await updateWorkerKumpulan(member.id, 'Tiada Kumpulan');
      setWorkers(prev => prev.map(w => w.id === member.id ? { ...w, kumpulan: 'Tiada Kumpulan' } : w));
      onShowToast('success', `${member.name} berjaya dikeluarkan daripada Kumpulan ${currentGroup}.`);
    } catch (err: any) {
      onShowToast('error', 'Gagal mengeluarkan pekerja: ' + err.message);
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    if (groups.includes(name)) {
      onShowToast('error', 'Kumpulan sudah wujud.');
      return;
    }
    setGroups(prev => [...prev, name]);
    setNewGroupName('');
    setShowAddGroupInput(false);
    onShowToast('success', `Kumpulan "${name}" berjaya dicipta.`);
  };

  // Compute unassigned workers
  const unassignedWorkers = workers.filter(w => !w.kumpulan || w.kumpulan === 'Tiada Kumpulan' || w.kumpulan === '');

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Memuatkan Data Kumpulan...</p>
        </div>
      ) : (
        // 👥 KUMPULAN KERJA VIEW
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Pembahagian Tugasan Kekal
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Urus kumpulan tetap pekerja untuk memudahkan penugasan.</p>
            </div>

            {/* Cipta Kumpulan Action Button */}
            {!showAddGroupInput ? (
              <button
                onClick={() => setShowAddGroupInput(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
              >
                <Plus size={14} />
                Cipta Kumpulan
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nama kumpulan..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value.toUpperCase())}
                  className={`p-2 border rounded-xl outline-none text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  onClick={handleCreateGroup}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setShowAddGroupInput(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Unassigned Workers Banner / Card if any */}
          {unassignedWorkers.length > 0 && (
            <div className={`p-4 rounded-2xl border ${
              isDarkMode ? 'bg-amber-950/20 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
            } flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-2.5">
                <UserX size={18} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wide">
                    {unassignedWorkers.length} Pekerja Belum Diagih Ke Mana-Mana Kumpulan
                  </p>
                  <p className="text-[10px] opacity-80 uppercase font-semibold mt-0.5">
                    Klik button "+ Tambah Pekerja" di mana-mana kumpulan di bawah untuk memasukkan mereka.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Group Accordions / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map(groupName => {
              const groupWorkers = workers.filter(w => {
                if (groupName === 'Kerja Am dan Lain-lain') {
                  return w.kumpulan === 'Kerja Am dan Lain-lain' || (!w.kumpulan && w.kumpulan !== 'Tiada Kumpulan');
                }
                return w.kumpulan === groupName;
              });

              return (
                <div 
                  key={groupName}
                  className={`border rounded-3xl p-5 ${
                    isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {groupName}
                      </h4>
                    </div>
                    <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                      {groupWorkers.length} Pekerja
                    </span>
                  </div>

                  {/* Member List */}
                  <div className="space-y-2 min-h-[100px] max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {groupWorkers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Users size={24} className="text-slate-400 opacity-60 mb-1" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Tiada Ahli Kumpulan</p>
                      </div>
                    ) : (
                      groupWorkers.map(member => (
                        <div 
                          key={member.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border ${
                            isDarkMode ? 'bg-slate-900/60 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 shadow-sm'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className={`text-[11px] font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {member.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase truncate">
                              NO: {member.worker_no} • {member.role}
                            </p>
                          </div>
                          
                          {/* Action: Keluarkan dari kumpulan (X) */}
                          <div className="shrink-0">
                            {/* Cross button: Keluarkan dari kumpulan */}
                            <button
                              onClick={() => handleRemoveFromGroup(member, groupName)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 transition-all flex items-center justify-center"
                              title="Keluarkan dari kumpulan ini"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Member Button Trigger */}
                  <button
                    onClick={() => {
                      setNewGroupName(groupName);
                      setShowKumpulanModal(true);
                    }}
                    className="w-full mt-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-transparent hover:border-slate-300 dark:hover:border-white/10 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus size={12} />
                    Tambah Pekerja
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH PEKERJA KE KUMPULAN */}
      {showKumpulanModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowKumpulanModal(false)} />
          <div className={`relative w-full max-w-md p-6 rounded-[28px] shadow-2xl border ${
            isDarkMode ? 'bg-slate-900 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <Users className="text-indigo-500" size={16} />
                Tambah ke {newGroupName}
              </h3>
              <button 
                onClick={() => setShowKumpulanModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 uppercase font-bold mb-4">
              Sila pilih pekerja aktif untuk dimasukkan ke kumpulan ini:
            </p>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 text-xs font-bold uppercase">
              {workers
                .filter(w => {
                  if (w.is_active === false) return false;
                  // Exclude workers already in this group
                  if (newGroupName === 'Kerja Am dan Lain-lain') {
                    return w.kumpulan !== 'Kerja Am dan Lain-lain' && (w.kumpulan === 'Tiada Kumpulan' || !!w.kumpulan);
                  }
                  return w.kumpulan !== newGroupName;
                })
                .map(w => (
                  <button
                    key={w.id}
                    onClick={() => handleUpdateGroup(w.id, newGroupName)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/50 dark:border-white/5 bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-500/10 hover:border-indigo-500/20 hover:text-indigo-500 transition-all text-left"
                  >
                    <div>
                      <p className="font-black">{w.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        NO: {w.worker_no} • {w.role} {(w.kumpulan && w.kumpulan !== 'Kerja Am dan Lain-lain' && w.kumpulan !== 'Tiada Kumpulan') ? `(${w.kumpulan})` : ''}
                      </p>
                    </div>
                    <ArrowRight size={14} />
                  </button>
                ))}
              
              {workers.filter(w => w.is_active !== false && w.kumpulan !== newGroupName).length === 0 && (
                <p className="text-center py-6 text-[10px] text-slate-400 font-black uppercase">
                  Tiada pekerja lain yang tersedia.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
