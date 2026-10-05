import React, { useState } from "react";
import { motion } from "motion/react";
import { Save, CloudRain, Calendar, AlertCircle } from "lucide-react";
import { getActiveEstateId } from "../../../utils/estateContext";
import { safeFetch } from "../../../utils/safeFetch";

export const HujanInput: React.FC<{ onSuccess: () => void; onAddHujan: (bulan: string, tahun: string, jumlah: number) => void }> = ({ onSuccess, onAddHujan }) => {
  const [formData, setFormData] = useState({
    bulan: "",
    tahun: new Date().getFullYear().toString(),
    jumlahHujan: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const bulanList = ["JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGOS", "SEPT", "OKT", "NOV", "DIS"];
  const tahunList = ["2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    
    try {
      const jumlah = parseFloat(formData.jumlahHujan);
      const activeEstateId = getActiveEstateId();
      
      const res = await safeFetch('/api/hujan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bulan: formData.bulan,
          tahun: formData.tahun,
          jumlah: jumlah,
          estate_id: activeEstateId
        })
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setErrorMsg(errJson.error || 'Ralat menyimpan rekod hujan melalui API.');
        setIsSubmitting(false);
        return;
      }

      onAddHujan(formData.bulan, formData.tahun, jumlah);
      setSuccessMsg("Rekod hujan berjaya disimpan!");
      
      setTimeout(() => {
        setSuccessMsg("");
        setErrorMsg("");
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Ralat sistem berlaku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
        <h3 className="text-xs font-black text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
          <CloudRain size={14} /> BORANG REKOD HUJAN
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
              Bulan
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={formData.bulan}
                onChange={(e) => setFormData({ ...formData, bulan: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm font-bold text-slate-700 dark:text-white appearance-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="" disabled>Pilih Bulan</option>
                {bulanList.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
              Tahun
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={formData.tahun}
                onChange={(e) => setFormData({ ...formData, tahun: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm font-bold text-slate-700 dark:text-white appearance-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {tahunList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            Jumlah Hujan (mm)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.jumlahHujan}
            onChange={(e) => setFormData({ ...formData, jumlahHujan: e.target.value })}
            required
            placeholder="0.00"
            className="w-full px-4 py-3 text-center text-xl font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2"
        >
          <Save size={14} />
          {successMsg}
        </motion.div>
      )}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2"
        >
          <AlertCircle size={14} />
          {errorMsg}
        </motion.div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Save size={16} /> Simpan Rekod Hujan
          </>
        )}
      </button>
      
      <p className="text-center text-[9px] text-slate-400 font-bold max-w-[200px] mx-auto leading-relaxed mt-4">
        Sila pastikan data hujan dimasukkan pada tarikh hujung bulan untuk menjana laporan dengan tepat.
      </p>
    </motion.form>
  );
};
