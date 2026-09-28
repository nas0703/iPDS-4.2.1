
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle, 
  History, 
  Plus, 
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MoreVertical,
  Minus,
  Table as TableIcon,
  FileText,
  Loader2,
  Database
} from 'lucide-react';
import { COMPACT_FELDA_12_DATA, BinKadEntry } from '../data/inventory_static';
import { getActiveEstateId } from '../../../utils/estateContext';
import { safeFetch } from '../../../utils/safeFetch';

interface InventoryItem {
  id: string | number;
  name: string;
  quantity: number;
  min_threshold: number;
  unit: string;
  updated_at: string;
}

interface Transaction {
  id: string | number;
  inventory_id: string | number;
  type: 'IN' | 'OUT';
  quantity: number;
  reference: string;
  created_at: string;
}

export const FertilizerInventory: React.FC = () => {
  const [viewMode, setViewMode] = useState<'summary' | 'binkad'>('summary');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInModal, setShowInModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: 0, min_threshold: 50, unit: 'BEG' });
  const [transData, setTransData] = useState({ quantity: 0, reference: '' });
  const [modalPus, setModalPus] = useState<string>('1');
  const [inType, setInType] = useState<'IN' | 'OUT'>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [entries, setEntries] = useState<any[]>([]);

  // Kapasiti stor adalah 380 tan (380,000 KG)
  const totalStockKg = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const maxCapacityKg = 380000;
  const percentUsed = Math.min((totalStockKg / maxCapacityKg) * 100, 100);
  const remainingSpaceKg = Math.max(maxCapacityKg - totalStockKg, 0);
  const remainingSpaceTan = remainingSpaceKg / 1000;

  const fetchData = async () => {
    setIsLoading(true);
    const activeEstateId = getActiveEstateId();
    const isTunggal = activeEstateId === 'FPM_TUNGGAL';

    try {
      const [invRes, transRes, entriesRes] = await Promise.all([
        safeFetch(`/api/fertilizer/inventory?estate_id=${activeEstateId}`),
        safeFetch(`/api/fertilizer/inventory/transactions?estate_id=${activeEstateId}`),
        safeFetch(`/api/fertilizer/entries?estate_id=${activeEstateId}`)
      ]);
      const invData = invRes.ok ? await invRes.json() : [];
      const trData = transRes.ok ? await transRes.json() : [];
      const enData = entriesRes.ok ? await entriesRes.json() : [];
      
      const filteredInv = Array.isArray(invData) ? invData.filter((i: any) => isTunggal ? (!i.estate_id || i.estate_id === 'FPM_TUNGGAL') : i.estate_id === activeEstateId) : [];
      const filteredTr = Array.isArray(trData) ? trData.filter((t: any) => isTunggal ? (!t.estate_id || t.estate_id === 'FPM_TUNGGAL') : t.estate_id === activeEstateId) : [];
      const filteredEn = Array.isArray(enData) ? enData.filter((e: any) => isTunggal ? (!e.estate_id || e.estate_id === 'FPM_TUNGGAL') : e.estate_id === activeEstateId) : [];

      setInventory(filteredInv);
      setTransactions(filteredTr);
      setEntries(filteredEn);
    } catch (err) {
      console.error("Fetch inventory error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string | number) => {
    if (!window.confirm("Adakah anda pasti mahu memadam transaksi ini? Stok akan dikira semula.")) return;
    try {
      const res = await safeFetch(`/api/fertilizer/inventory/transactions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Delete transaction error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await safeFetch('/api/fertilizer/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ name: '', quantity: 0, min_threshold: 50, unit: 'BEG' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransaction = async (type: 'IN' | 'OUT') => {
    if (!selectedItem || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...transData,
        reference: `${transData.reference} [PUS ${modalPus}]`,
        type
      };

      const res = await safeFetch(`/api/fertilizer/inventory/${selectedItem.id}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowInModal(false);
        setTransData({ quantity: 0, reference: '' });
        setSelectedItem(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 gap-3">
      <RefreshCw className="animate-spin text-emerald-500" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sila Tunggu...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* View Selector Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex gap-1 flex-1">
          <button 
            onClick={() => setViewMode('summary')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Package size={14} /> Ringkasan Stok
          </button>
          <button 
            onClick={() => setViewMode('binkad')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'binkad' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <TableIcon size={14} /> Bin Kad Baja
          </button>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="space-y-4 animate-in fade-in duration-500">
          {/* Inventory KPI View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#064E3B] p-4 rounded-[20px] text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <Package className="absolute right-[-10px] top-[-10px] text-white/10" size={80} />
          <div>
            <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">Total Stok Semasa</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-black">{inventory.reduce((acc, curr) => acc + curr.quantity, 0).toLocaleString()}</p>
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">KG</span>
            </div>
          </div>
          <div className="mt-2 text-[8px] opacity-60 font-medium">
            Sama dengan {(totalStockKg / 1000).toFixed(2)} Tan
          </div>
        </div>

        {/* Brand New Storage Space Indicator */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-[20px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Ruang Stor (Had: 380 Tan)</p>
              <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest ${
                percentUsed >= 100 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' :
                percentUsed >= 90 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}>
                {percentUsed >= 100 ? 'Penuh 🔴' : percentUsed >= 90 ? 'Hampir Penuh 🟡' : 'Ada Ruang 🟢'}
              </span>
            </div>
            
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black text-slate-800 dark:text-white">
                  {(totalStockKg / 1000).toFixed(1)} / 380
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase">Tan ({percentUsed.toFixed(1)}%)</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed >= 100 ? 'bg-rose-500' :
                    percentUsed >= 90 ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 dark:border-slate-800/60 pt-2 text-[8px] font-bold text-slate-400 uppercase">
            <span>Baki Ruang:</span>
            <span className={`font-black ${percentUsed >= 100 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
              {remainingSpaceTan.toFixed(1)} Tan ({remainingSpaceKg.toLocaleString()} KG)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-[20px] shadow-sm flex flex-col justify-center">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Stok Rendah</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${inventory.some(i => i.quantity <= i.min_threshold) ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none">
                {inventory.filter(i => i.quantity <= i.min_threshold).length > 0 
                  ? `${inventory.filter(i => i.quantity <= i.min_threshold).length} Item Rendah` 
                  : 'Stok Mencukupi'}
              </p>
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Perlu Pesanan Baru Segera</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 p-4 rounded-[20px] text-white shadow-lg flex items-center justify-between transition-all active:scale-95 group"
        >
          <div className="text-left">
            <p className="text-[8px] font-black uppercase opacity-70 tracking-widest leading-none">Admin Inventori</p>
            <p className="text-sm font-black mt-1">TAMBAH ITEM</p>
          </div>
          <div className="bg-white/20 p-2 rounded-xl group-hover:bg-white/30 transition-all">
            <Plus size={20} />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory List */}
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="bg-[#064E3B] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="text-emerald-400" size={16} />
              <h3 className="text-[9px] font-black text-white uppercase tracking-widest">Senarai Inventori</h3>
            </div>
            <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-950/30 px-2 py-1 rounded">
              {inventory.filter(item => item.quantity > 0).length} Produk
            </div>
          </div>
          
          <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {inventory.filter(item => item.quantity > 0).map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">{item.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Threshold: <span className="text-slate-600 dark:text-slate-300">{item.min_threshold} {item.unit}</span></p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black leading-none ${item.quantity <= item.min_threshold ? 'text-rose-500' : 'text-emerald-600'}`}>{item.quantity}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">{item.unit}</p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                   <button 
                    onClick={() => { setSelectedItem(item); setShowInModal(true); setInType('IN'); setTransData({ quantity: 0, reference: '' }); setModalPus('1'); }}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2 rounded-xl text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                   >
                     <ArrowUpCircle size={10} /> Terima Baja
                   </button>
                   <button 
                    onClick={() => { setSelectedItem(item); setShowInModal(true); setInType('OUT'); setTransData({ quantity: 0, reference: '' }); setModalPus('1'); }}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2 rounded-xl text-[8px] font-black text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                   >
                     <ArrowDownCircle size={10} /> Guna Baja
                   </button>
                </div>
              </div>
            ))}
            {inventory.filter(item => item.quantity > 0).length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-[10px] font-black uppercase tracking-widest">Tiada rekod inventori</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="bg-emerald-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="text-emerald-200" size={16} />
              <h3 className="text-[9px] font-black text-white uppercase tracking-widest">Aktiviti Terkini</h3>
            </div>
          </div>
          
          <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto">
            {transactions.map((tr) => {
              const item = inventory.find(i => i.id === tr.inventory_id);
              return (
                <div key={tr.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-l-2 border-transparent hover:border-emerald-500 pl-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${tr.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {tr.type === 'IN' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-800 dark:text-white uppercase leading-none">{item?.name || 'Item Terpadam'}</p>
                      <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{tr.reference || 'Tiada Rujukan'} • {new Date(tr.created_at).toLocaleDateString('ms-MY')}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-[10px] font-black ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tr.type === 'IN' ? '+' : '-'}{tr.quantity} {item?.unit || ''}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteTransaction(tr.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-[10px] font-black uppercase tracking-widest">Tiada transaksi direkod</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 px-1">
        <BinKadTable transactions={transactions} inventory={inventory} entries={entries} onDeleteTransaction={handleDeleteTransaction} />
      </div>
    )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
          >
            <div className="bg-[#064E3B] p-6 text-white text-center">
               <Package size={32} className="mx-auto mb-2 opacity-50" />
               <h3 className="text-lg font-black uppercase tracking-widest">Tambah Produk</h3>
               <p className="text-[10px] font-bold text-emerald-200 uppercase opacity-70">Daftar Baja Baru ke Inventori</p>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="relative group">
                  <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">Nama Produk</span>
                  <select 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white"
                  >
                    <option value="">PILIH JENIS BAJA</option>
                    <option value="COMPACT FELDA 12">COMPACT FELDA 12</option>
                    <option value="FELDA ORGANIC">FELDA ORGANIC</option>
                    <option value="MOP (MURIATE OF POTASH)">MOP (MURIATE OF POTASH)</option>
                    <option value="ERP (EGYPT ROCK PHOSPHATE)">ERP (EGYPT ROCK PHOSPHATE)</option>
                    <option value="KIESERITE">KIESERITE</option>
                    <option value="BORATE">BORATE</option>
                    <option value="NPK 15-15-15">NPK 15-15-15</option>
                    <option value="NPK 12-12-17-2">NPK 12-12-17-2</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">Stok Awal</span>
                    <input 
                      type="number" 
                      required
                      value={isNaN(formData.quantity) ? '' : formData.quantity}
                      onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="relative group">
                    <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">Min. Alert</span>
                    <input 
                      type="number" 
                      required
                      value={isNaN(formData.min_threshold) ? '' : formData.min_threshold}
                      onChange={e => setFormData({...formData, min_threshold: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-black text-[10px] text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all">Batal</button>
                <button type="submit" className="flex-1 bg-emerald-600 py-3 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Simpan Item</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Transaction Modal (IN/OUT) */}
      {showInModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
          >
            <div className={`p-6 text-white text-center flex flex-col items-center ${inType === 'IN' ? 'bg-[#064E3B]' : 'bg-rose-900'}`}>
               <h3 className="text-lg font-black uppercase tracking-widest">
                 {inType === 'IN' ? 'Terima Baja' : 'Guna Baja'}
               </h3>
               <p className="text-[10px] font-bold text-emerald-200 uppercase opacity-70 mt-1">{selectedItem.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="relative group">
                <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">Kuantiti ({selectedItem.unit})</span>
                <input 
                  type="number" 
                  value={isNaN(transData.quantity) ? '' : transData.quantity}
                  onChange={e => setTransData({...transData, quantity: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="0.00"
                />
              </div>
              <div className="relative group">
                <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">Pusingan</span>
                <select 
                  value={modalPus}
                  onChange={e => setModalPus(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white"
                >
                  <option value="1">PUS 1</option>
                  <option value="2">PUS 2</option>
                  <option value="3">PUS 3</option>
                  <option value="4">PUS 4</option>
                </select>
              </div>
              <div className="relative group">
                <span className="absolute left-3 top-[-7px] bg-white dark:bg-slate-900 px-1 text-[8px] font-black text-emerald-600 uppercase tracking-widest z-10">
                  {inType === 'IN' ? 'No. Resit / DO' : 'Blok Penerima'}
                </span>
                <input 
                  type="text" 
                  value={transData.reference}
                  onChange={e => setTransData({...transData, reference: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 outline-none transition-all text-xs font-bold uppercase text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder={inType === 'IN' ? "CONTOH: FL123456" : "CONTOH: BLOK 1 / LP"}
                />
              </div>
              {inType === 'IN' && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
                    <span>Projeksi Ruang Stor:</span>
                    <span className={totalStockKg + (isNaN(transData.quantity) ? 0 : transData.quantity) > 380000 ? 'text-rose-500 font-black' : 'text-emerald-500 font-black'}>
                      {totalStockKg + (isNaN(transData.quantity) ? 0 : transData.quantity) > 380000 ? 'MELEBIHI HAD' : 'MENCUKUPI'}
                    </span>
                  </div>
                  <div className="text-xs font-black text-slate-800 dark:text-white mt-1">
                    {((totalStockKg + (isNaN(transData.quantity) ? 0 : transData.quantity)) / 1000).toFixed(2)} / 380 Tan
                  </div>
                  {totalStockKg + (isNaN(transData.quantity) ? 0 : transData.quantity) > 380000 && (
                    <p className="text-[8px] text-rose-500 font-bold uppercase mt-1 leading-normal">
                      ⚠️ Amaran: Jumlah ini melebihi had kapasiti stor sebanyak {(((totalStockKg + (isNaN(transData.quantity) ? 0 : transData.quantity)) - 380000) / 1000).toFixed(2)} Tan!
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => handleTransaction(inType)} 
                  disabled={isSubmitting}
                  className={`flex-1 py-4 rounded-2xl text-white font-black text-[12px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${inType === 'IN' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (inType === 'IN' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />)}
                  {isSubmitting ? 'MENYIMPAN...' : `SAHKAN ${inType === 'IN' ? 'TERIMA' : 'GUNA'}`}
                </button>
              </div>
              <button 
                onClick={() => { setShowInModal(false); setSelectedItem(null); }} 
                className="w-full py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>

  );
};

const BinKadTable: React.FC<{ 
  transactions: Transaction[], 
  inventory: InventoryItem[], 
  entries: any[],
  onDeleteTransaction: (id: string | number) => void 
}> = ({ transactions, inventory, entries, onDeleteTransaction }) => {
  const [selectedBaja, setSelectedBaja] = useState('COMPACT FELDA 12');
  const [selectedPusingan, setSelectedPusingan] = useState('1');
  const [isBajaOpen, setIsBajaOpen] = useState(false);
  const [isPusinganOpen, setIsPusinganOpen] = useState(false);

  const bajaTypes = [
    'COMPACT FELDA 12',
    'FELDA ORGANIC',
    'MOP (MURIATE OF POTASH)',
    'ERP (EGYPT ROCK PHOSPHATE)',
    'KIESERITE',
    'BORATE',
    'NPK 15-15-15',
    'NPK 12-12-17-2'
  ];

  const pusinganRounds = ['1', '2', '3', '4'];

  // Merge static data with live transactions
  const getMergedData = (): BinKadEntry[] => {
    let baseData: BinKadEntry[] = [];
    if (selectedBaja === 'COMPACT FELDA 12' && selectedPusingan === '1') {
      baseData = [...COMPACT_FELDA_12_DATA];
    } else {
      // For others, start with 0 balance
      baseData = [];
    }

    // Find inventory item to get the ID
    const invItem = inventory.find(i => i.name === selectedBaja);
    if (!invItem) return baseData;

    // Filter relevant transactions from DB
    let relevantTrans = transactions
      .filter(t => t.inventory_id === invItem.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    relevantTrans = relevantTrans.filter(t => {
      let tPus: string | null = null;
      
      // 1. Try to get PUS from reference e.g. [PUS 3]
      const pusMatch = t.reference?.match(/\[PUS\s+(\d+)\]/i);
      if (pusMatch) {
        tPus = pusMatch[1];
      } else {
        // 2. Try to get PUS from linked entry
        const entryIdMatch = t.reference?.match(/Entry ID:\s*([a-zA-Z0-9-]+)/i);
        if (entryIdMatch && entries) {
           const entry = entries.find(e => e.id === entryIdMatch[1]);
           if (entry && entry.pus) tPus = String(entry.pus);
        }
      }

      // 3. Fallback based on selectedBaja default
      if (!tPus) {
          if (selectedBaja === 'COMPACT FELDA 12') tPus = '1';
          else if (selectedBaja === 'FELDA ORGANIC') tPus = '2';
      }

      return tPus === selectedPusingan;
    });

    if (relevantTrans.length === 0) return baseData;

    // Convert transactions to BinKad format and append
    const merged = [...baseData];
    let currentBaki = merged.length > 0 ? merged[merged.length - 1].baki : 0;

    relevantTrans.forEach(t => {
      const q = Number(t.quantity);
      if (t.type === 'IN') currentBaki += q;
      else currentBaki -= q;

      // Try to extract date from reference if it's a manual sync
      // Reference format: "Manual Sync: Blok X (Entry ID: ...)"
      // Or just use created_at
      const date = new Date(t.created_at);
      const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)}`;

      merged.push({
        id: t.id,
        tarikh: formattedDate,
        terima: t.type === 'IN' ? q : null,
        keluar: t.type === 'OUT' ? q : null,
        baki: currentBaki,
        blok: t.reference?.includes('Blok') ? t.reference.match(/Blok\s+([^\s(]+)/)?.[1] || '' : '',
        catatan: t.reference || ''
      });
    });

    return merged;
  };

  const currentData = getMergedData();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
      <div className="bg-[#064E3B] px-3 py-2 border-b border-emerald-800">
        <div className="flex items-center justify-between gap-2 overflow-visible">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <FileText className="text-emerald-400" size={12} />
            </div>
            <div>
              <h3 className="text-[9px] font-black text-white uppercase tracking-tight leading-none mb-0.5">Bin Kad Inventori</h3>
              <p className="text-[6px] font-bold text-emerald-300 uppercase tracking-widest leading-none">FPMSB TUNGGAL • 3155</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <div className="relative">
              <button 
                onClick={() => setIsPusinganOpen(!isPusinganOpen)}
                className="flex items-center gap-1.5 bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-800/50 hover:bg-emerald-900/60 transition-colors"
              >
                <div className="flex flex-col items-start pr-1">
                  <p className="text-[7px] font-black text-emerald-400 uppercase tracking-tighter">PUS {selectedPusingan}</p>
                  <p className="text-[8px] font-black text-white uppercase truncate">{selectedBaja}</p>
                </div>
                <ChevronDown size={10} className={`text-emerald-300 transition-transform duration-200 ${isPusinganOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isPusinganOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 top-full mt-1 z-[100] bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden min-w-[180px]"
                  >
                    {[
                      { pus: '1', baja: 'COMPACT FELDA 12' },
                      { pus: '2', baja: 'FELDA ORGANIC' },
                      { pus: '3', baja: 'FELDA ORGANIC' },
                      { pus: '4', baja: 'COMPACT FELDA 12' }
                    ].map((opt, idx) => (
                      <button 
                        key={idx}
                        onClick={() => { 
                          setSelectedPusingan(opt.pus); 
                          setSelectedBaja(opt.baja); 
                          setIsPusinganOpen(false); 
                        }}
                        className={`w-full flex justify-between items-center px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${(selectedPusingan === opt.pus && selectedBaja === opt.baja) ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest bg-black/20 px-1.5 py-0.5 rounded">PUS {opt.pus}</span>
                        <span className="text-[8px] font-black uppercase text-right leading-tight max-w-[100px]">{opt.baja}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar min-h-[250px] relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Tarikh</th>
              <th className="px-2 py-1.5 text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Terima</th>
              <th className="px-2 py-1.5 text-[7px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Keluar</th>
              <th className="px-2 py-1.5 text-[7px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Baki</th>
              <th className="px-2 py-1.5 text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-center">Blok</th>
              <th className="px-2 py-1.5 text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Nota</th>
              <th className="px-1 py-1.5 border-b border-slate-100 dark:border-slate-800"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {currentData.length > 0 ? (
              currentData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-2 py-1 text-[8px] font-bold text-slate-600 dark:text-slate-400 font-mono tracking-tighter">{row.tarikh}</td>
                  <td className="px-2 py-1 text-[9px] font-black text-emerald-600 dark:text-emerald-50 text-right">
                    {row.terima ? row.terima.toLocaleString() : '-'}
                  </td>
                  <td className="px-2 py-1 text-[9px] font-black text-rose-500 text-right">
                    {row.keluar ? row.keluar.toLocaleString() : '-'}
                  </td>
                  <td className="px-2 py-1 text-[9px] font-black text-slate-900 dark:text-white text-right">
                    {row.baki.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {row.blok ? (
                      <span className="text-[7px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                        {row.blok}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-2 py-1 text-[7px] font-bold text-slate-500 dark:text-slate-500 truncate max-w-[60px]">{row.catatan}</td>
                  <td className="px-1 py-1 text-right">
                    {row.id && (
                      <button 
                        onClick={() => onDeleteTransaction(row.id!)}
                        className="p-1 rounded-md text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        title="Padam Transaksi"
                      >
                        <XCircle size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <Package className="mx-auto text-slate-200 dark:text-slate-800 mb-2 opacity-20" size={40} />
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Tiada Rekod Dijumpai</p>
                  <p className="text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase mt-1">Data akan dikemaskini kemudian</p>
                </td>
              </tr>
            )}
          </tbody>
          {currentData.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/80 sticky bottom-0 z-10 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <tr>
                <td className="px-2 py-2 text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">AKHIR:</td>
                <td className="px-2 py-2 text-[9px] font-black text-emerald-600 text-right">{currentData.reduce((acc, r) => acc + (r.terima || 0), 0).toLocaleString()}</td>
                <td className="px-2 py-2 text-[9px] font-black text-rose-500 text-right">{currentData.reduce((acc, r) => acc + (r.keluar || 0), 0).toLocaleString()}</td>
                <td className="px-2 py-2 text-[10px] font-black text-slate-900 dark:text-white text-right">{currentData[currentData.length - 1].baki.toLocaleString()}</td>
                <td colSpan={3} className="px-2 py-2 text-[6px] font-bold text-slate-400 uppercase opacity-50 text-right pr-4">
                  UPDATED {currentData[currentData.length - 1].tarikh}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
