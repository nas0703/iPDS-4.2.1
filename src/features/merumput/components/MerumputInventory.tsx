import React, { useState, useEffect } from 'react';
import { MerumputInventoryItem, MerumputTransaction } from '../types';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  Calendar,
  X,
  Save,
  SlidersHorizontal,
  PlusCircle,
  Clock
} from 'lucide-react';

interface MerumputInventoryProps {
  isDarkMode?: boolean;
  onShowToast: (type: 'success' | 'error', msg: string) => void;
}

export const MerumputInventory: React.FC<MerumputInventoryProps> = ({ isDarkMode, onShowToast }) => {
  const [items, setItems] = useState<MerumputInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<MerumputTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // New Chemical Form State
  const [showAddChemModal, setShowAddChemModal] = useState(false);
  const [newChem, setNewChem] = useState({
    name: '',
    quantity: 0,
    min_threshold: 10,
    unit: 'LITER'
  });

  // Log Transaction Form State
  const [showLogTxModal, setShowLogTxModal] = useState(false);
  const [selectedChemId, setSelectedChemId] = useState('');
  const [txForm, setTxForm] = useState({
    type: 'IN' as 'IN' | 'OUT',
    quantity: 0,
    reference: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, txRes] = await Promise.all([
        fetch('/api/merumput/inventory').catch(() => null),
        fetch('/api/merumput/inventory/transactions').catch(() => null)
      ]);

      if (invRes && invRes.ok) {
        const invData = await invRes.json().catch(() => []);
        setItems(invData || []);
        if (invData && invData.length > 0) {
          setSelectedChemId(invData[0].id);
        }
      }
      if (txRes && txRes.ok) {
        const txData = await txRes.json().catch(() => []);
        setTransactions(txData || []);
      }
    } catch (e: any) {
      console.warn("Gagal memuatkan data inventori racun:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChem.name) return;

    try {
      setIsProcessing(true);
      const res = await fetch('/api/merumput/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChem)
      });

      if (res.ok) {
        onShowToast('success', `Chemical ${newChem.name} berjaya ditambah.`);
        setShowAddChemModal(false);
        setNewChem({ name: '', quantity: 0, min_threshold: 10, unit: 'LITER' });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal merakam ralat');
      }
    } catch (err: any) {
      onShowToast('error', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChemId || txForm.quantity <= 0) return;

    try {
      setIsProcessing(true);
      const res = await fetch(`/api/merumput/inventory/${selectedChemId}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txForm)
      });

      if (res.ok) {
        onShowToast('success', `Transaksi stok berjaya direkodkan.`);
        setShowLogTxModal(false);
        setTxForm({ type: 'IN', quantity: 0, reference: '' });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan transaksi');
      }
    } catch (err: any) {
      onShowToast('error', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('Adakah anda pasti mahu membatalkan transaksi ini? Stok racun akan dikira semula.')) return;

    try {
      const res = await fetch(`/api/merumput/inventory/transactions/${txId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        onShowToast('success', 'Transaksi dibatalkan & baki stok dikemas kini.');
        fetchData();
      } else {
        throw new Error('Gagal membatalkan transaksi');
      }
    } catch (e: any) {
      onShowToast('error', e.message);
    }
  };

  const currentChemObj = items.find(i => i.id === selectedChemId);

  return (
    <div className="space-y-6 text-left pb-20">
      {/* Header and top tools button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider leading-none italic">
            Inventori Racun Rumpai & Stok
          </h4>
          <p className="text-xs text-slate-400 mt-1">Urusan bahan kimia racun bulatan, lorong dan rumpai liar ladang.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddChemModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-[0.96]"
          >
            <Plus size={14} />
            Bahan Racun Baru
          </button>
          
          <button
            onClick={() => {
              if (items.length > 0) {
                setShowLogTxModal(true);
              } else {
                onShowToast('error', 'Sila masukkan sekurang-kurangnya satu bahan racun terlebih dahulu.');
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-[0.96]"
          >
            <PlusCircle size={14} />
            Daftar Masuk / Keluar Stok
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={36} className="text-emerald-500 animate-spin" />
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Memuatkan Inventori...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Chemical item list cards */}
          <div className="lg:col-span-2 space-y-4">
            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Status Stok Bahan Racun</h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => {
                const isUnderThreshold = item.quantity <= item.min_threshold;
                return (
                  <div 
                    key={item.id} 
                    className={`p-5 rounded-[28px] border shadow-md flex flex-col justify-between transition-all ${
                      isUnderThreshold 
                        ? 'bg-rose-50/50 dark:bg-rose-950/15 border-rose-150 dark:border-rose-900/60' 
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">Bahan Aktif</p>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight">
                            {item.name}
                          </h4>
                        </div>
                        {isUnderThreshold && (
                          <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-xl shrink-0">
                            <AlertCircle size={14} className="animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Chemical volume stats */}
                      <div className="flex items-baseline justify-between pt-2">
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Baki Stok</p>
                          <p className={`text-xl font-display font-black leading-none ${isUnderThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>
                            {item.quantity.toFixed(1)} <span className="text-[10px] font-black text-slate-400 uppercase">{item.unit}</span>
                          </p>
                        </div>

                        <div className="text-right space-y-0.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Had Minimum</p>
                          <p className="text-xs font-black text-slate-600 dark:text-slate-400">
                            {item.min_threshold} {item.unit}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isUnderThreshold && (
                      <div className="mt-4 pt-3 border-t border-dashed border-rose-100 dark:border-rose-950/50 flex items-center gap-1.5 text-[9px] font-black uppercase text-rose-500">
                        <span>● STOK KRITIKAL: Sila tambah bekalan secepat mungkin.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Recent inventory log transactions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Log Perubahan Stok</h5>
              <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                <Clock size={10} />
                Sejarah
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-[28px] shadow-lg max-h-[480px] overflow-y-auto space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tiada Transaksi</p>
                  <p className="text-[8px] text-slate-400">Semua perubahan stok akan disenaraikan di sini.</p>
                </div>
              ) : (
                transactions.map((tx) => {
                  const chemObj = items.find(i => i.id === tx.inventory_id);
                  const isAdd = tx.type === 'IN';
                  const dateStr = tx.created_at ? tx.created_at.split('T')[0] : '';
                  
                  return (
                    <div 
                      key={tx.id} 
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isAdd ? (
                          <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-lg shrink-0 mt-0.5">
                            <ArrowDownLeft size={14} />
                          </div>
                        ) : (
                          <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-lg shrink-0 mt-0.5">
                            <ArrowUpRight size={14} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h6 className="text-[10px] font-black uppercase text-slate-800 dark:text-white truncate leading-snug">
                            {chemObj?.name || 'Racun Rumpai'}
                          </h6>
                          <p className="text-[9px] text-slate-400 truncate font-medium">Ref: {tx.reference || 'Manual'}</p>
                          <p className="text-[8px] text-slate-400 font-mono tracking-wider flex items-center gap-1 mt-0.5">
                            <Calendar size={10} />
                            {dateStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <p className={`text-[11px] font-black ${isAdd ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isAdd ? '+' : '-'}{tx.quantity.toFixed(1)}
                          </p>
                          <p className="text-[8px] text-slate-400 uppercase font-mono">{chemObj?.unit || 'LITER'}</p>
                        </div>

                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-450 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Modal: Create Chemical Item */}
      {showAddChemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddChemModal(false)} />
          <div className="relative w-full max-w-md rounded-[32px] border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-black uppercase italic text-slate-800 dark:text-white leading-none">Bahan Kimia Baru</h4>
                <p className="text-[10px] text-zinc-400">Daftarkan jenis racun rumpai baharu ke dalam stor.</p>
              </div>
              <button onClick={() => setShowAddChemModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddChemical} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Nama Racun / Bahan Aktif</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: GLYPHOSATE 41% ..."
                  value={newChem.name}
                  onChange={e => setNewChem({ ...newChem, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Kuantiti Stok Awal</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newChem.quantity || ''}
                    onChange={e => setNewChem({ ...newChem, quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Unit</label>
                  <select
                    value={newChem.unit}
                    onChange={e => setNewChem({ ...newChem, unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                  >
                    <option value="LITER">LITER</option>
                    <option value="KG">KG</option>
                    <option value="BEG">BEG</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Had Minimum Amaran (Threshold)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newChem.min_threshold || ''}
                  onChange={e => setNewChem({ ...newChem, min_threshold: parseFloat(e.target.value) || 10 })}
                  placeholder="10.0"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-990/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                SIMPAN BAHAN RACUN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Stock IN/OUT Transaction */}
      {showLogTxModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowLogTxModal(false)} />
          <div className="relative w-full max-w-md rounded-[32px] border bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-black uppercase italic text-slate-800 dark:text-white leading-none">Log Transaksi Stok</h4>
                <p className="text-[10px] text-zinc-400">Catat transaksi penambahan (IN) atau pengurangan manual (OUT).</p>
              </div>
              <button onClick={() => setShowLogTxModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Gudang Bahan Kimia</label>
                <select
                  value={selectedChemId}
                  onChange={e => setSelectedChemId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                >
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Jenis Aliran</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxForm({ ...txForm, type: 'IN' })}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        txForm.type === 'IN' 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      Masuk (IN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxForm({ ...txForm, type: 'OUT' })}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        txForm.type === 'OUT' 
                          ? 'bg-rose-500 border-rose-500 text-white shadow' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      Keluar (OUT)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Kuantiti ({currentChemObj?.unit || 'LITER'})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={txForm.quantity || ''}
                    onChange={e => setTxForm({ ...txForm, quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Rujukan / Nota Catatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Stok Baru Masuk, Pembelian NoPO ..."
                  value={txForm.reference}
                  onChange={e => setTxForm({ ...txForm, reference: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-white font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-990/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                REKOD TRANSAKSI STOK
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
