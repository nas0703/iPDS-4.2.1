import React, { RefObject, Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import { FileText, Factory, Droplets, Scissors, Save, AlertCircle, RefreshCw, Loader2, Send, Container, CloudRain, Sparkles, Scan, ShieldAlert } from "lucide-react";
import { FloatingInput } from "../../../components/ui/FloatingInput";
import { FertilizerInput } from "../../fertilizer/components/FertilizerInput";
import { PruningInput } from "../../pruning/components/PruningInput";
import { HujanInput } from "../../hujan/components/HujanInput";
import { MerumputInput } from "../../merumput/components/MerumputInput";
import { Leaf } from "lucide-react";
import { getEstateConfig, getActiveEstateId } from "../../../config/estateRegistry";
import { getTodayDateString, getDaysDifferenceFromToday, formatDateWithDay, cleanAndExtractBlockCode } from "../../../utils/formatters";

export interface InputTabProps {
  formData: any;
  setFormData: Dispatch<SetStateAction<any>>;
  fileInputRef: RefObject<HTMLInputElement>;
  uploadInputRef: RefObject<HTMLInputElement>;
  handleOcrScan: (e: any) => void;
  submitTransaction: (e: any) => void;
  isProcessing: boolean;
  isScanning?: boolean;
  onAddHujan?: (bulan: string, tahun: string, jumlah: number) => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  authRole?: string | null;
  rawData?: any[];
}

export const InputTab: React.FC<InputTabProps> = ({
  formData,
  setFormData,
  fileInputRef,
  uploadInputRef,
  handleOcrScan,
  submitTransaction,
  isProcessing,
  isScanning = false,
  onAddHujan,
  isEditing = false,
  onCancelEdit,
  authRole,
  rawData = [],
}) => {
  const activeEstateId = formData.estate_id || getActiveEstateId();
  const estateCfg = getEstateConfig(activeEstateId);
  const knownBlocks = estateCfg?.blocks ? Object.keys(estateCfg.blocks) : [];
  const rawBlok = String(formData.blok || "").trim();
  const extractedBlok = cleanAndExtractBlockCode(rawBlok);
  const cleanBlokUpper = (extractedBlok || rawBlok).toUpperCase();
  const isPktBlockPattern = /^(?:P[12]|PKT\s*[12])[-\s:]*\d+$/i.test(cleanBlokUpper);
  const numericOnly = cleanBlokUpper.replace(/^(?:P[12]|PKT\s*[12])[-\s:]*/i, "").replace(/[^0-9]/g, "");
  const isNumericBlok = /^\d+$/.test(numericOnly) && parseInt(numericOnly, 10) >= 1 && parseInt(numericOnly, 10) <= 99;
  const isKnownBlock = knownBlocks.includes(cleanBlokUpper) || knownBlocks.includes(numericOnly) || ["1F", "2F", "88F", "88 F", "125Y", "128Y", "121V", "88", "LF"].includes(cleanBlokUpper);
  const isBlokValid = formData.blok === "" || isNumericBlok || isKnownBlock || isPktBlockPattern;

  // Pencegahan Pertindihan Resit (Duplicate Check by No Akuan Terima / No Resit)
  const normalizedNoAkuan = String(formData.no_akaun_terima || "").trim().toUpperCase();
  const normalizedNoResit = String(formData.no_resit || "").trim().toUpperCase();

  const duplicateRecord = React.useMemo(() => {
    if (isEditing || !rawData || rawData.length === 0) return null;
    return (
      rawData.find((r: any) => {
        const existingAkuan = String(r.no_akaun_terima || "").trim().toUpperCase();
        const existingResit = String(r.no_resit || "").trim().toUpperCase();
        if (normalizedNoAkuan && existingAkuan && existingAkuan === normalizedNoAkuan) {
          return true;
        }
        if (normalizedNoResit && existingResit && existingResit === normalizedNoResit) {
          return true;
        }
        return false;
      }) || null
    );
  }, [rawData, normalizedNoAkuan, normalizedNoResit, isEditing]);

  const isStaffRole = authRole === "staff";

  const isNoActiveTab = 
    !formData.is_efb && 
    !formData.is_baja && 
    !formData.is_pruning && 
    !formData.is_hujan && 
    !formData.is_meracun;

  return (
    <div className="w-full">
      <div className="animate-in fade-in duration-300">
        {/* OCR PROCESSING BANNER (IF SCANNING) */}
        {isScanning && (
          <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl shadow-emerald-950/20 flex items-center justify-between border border-emerald-400/40 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <Loader2 size={22} className="animate-spin" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Scan size={14} /> AI OCR Sedang Memproses Resit
                </p>
                <p className="text-[10px] font-semibold text-emerald-100">
                  Mengekstrak maklumat resit & menyelaraskan data...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/40 text-[9px] font-mono font-bold text-emerald-200 border border-emerald-400/30">
              <Sparkles size={11} className="animate-bounce" />
              <span>GEMINI AI</span>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center mb-3">
          <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <FileText size={14} /> Rekod Hantaran
          </h2>
        </div>

        <div className="space-y-3 mt-2">
          {/* TOGGLES SECTION */}
          <div className="grid grid-cols-1 gap-2">
            {/* REKOD HANTARAN Toggle */}
            <div
              onClick={() => {
                setFormData({
                  ...formData,
                  is_efb: false,
                  is_baja: false,
                  is_pruning: false,
                  is_hujan: false,
                  is_meracun: false,
                });
              }}
              className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                isNoActiveTab
                  ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                  : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isNoActiveTab
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Container size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                    Rekod Hantaran
                  </p>
                  <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Buah Tandan Segar
                  </p>
                </div>
              </div>
              <div
                className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                  isNoActiveTab
                    ? "bg-blue-500 shadow-inner"
                    : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                }`}
              >
                <div
                  className={`w-full h-full rounded-full transition-transform duration-300 relative`}
                >
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                      isNoActiveTab
                        ? "translate-x-[20px]"
                        : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* RESIT EFB Toggle */}
            <div
              onClick={() => {
                if (!formData.is_efb) {
                  setFormData({
                    ...formData,
                    is_efb: true,
                    is_baja: false,
                    is_pruning: false,
                    is_hujan: false,
                    is_meracun: false,
                    kpg: "",
                    kpa: "",
                    muda: "0",
                    reject: "0.00",
                    sample: "0",
                    no_seal: "",
                    rm_mt: "",
                  });
                }
              }}
              className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                formData.is_efb
                  ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                  : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    formData.is_efb
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                      : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Factory size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                    Resit EFB
                  </p>
                  <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Tandan Kosong
                  </p>
                </div>
              </div>
              <div
                className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                  formData.is_efb
                    ? "bg-purple-500 shadow-inner"
                    : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                }`}
              >
                <div
                  className={`w-full h-full rounded-full transition-transform duration-300 relative`}
                >
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                      formData.is_efb ? "translate-x-[20px]" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>

            {!isStaffRole && (
              <>
                {/* RECORD BAJA Toggle */}
                <div
                  onClick={() => {
                    if (!formData.is_baja) {
                      setFormData({
                        ...formData,
                        is_baja: true,
                        is_efb: false,
                        is_pruning: false,
                        is_hujan: false,
                        is_meracun: false,
                      });
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                    formData.is_baja
                      ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                      : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        formData.is_baja
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Droplets size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                        Rekod Baja
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Pembajaan Ladang
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                      formData.is_baja
                        ? "bg-emerald-500 shadow-inner"
                        : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-full transition-transform duration-300 relative`}
                    >
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                          formData.is_baja ? "translate-x-[20px]" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* PRUNING Toggle */}
                <div
                  onClick={() => {
                    if (!formData.is_pruning) {
                      setFormData({
                        ...formData,
                        is_pruning: true,
                        is_baja: false,
                        is_efb: false,
                        is_hujan: false,
                        is_meracun: false,
                      });
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                    formData.is_pruning
                      ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                      : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        formData.is_pruning
                          ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Scissors size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                        Rekod Pruning
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Pemangkasan Pokok
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                      formData.is_pruning
                        ? "bg-amber-500 shadow-inner"
                        : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-full transition-transform duration-300 relative`}
                    >
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                          formData.is_pruning ? "translate-x-[20px]" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* HUJAN Toggle */}
                <div
                  onClick={() => {
                    if (!formData.is_hujan) {
                      setFormData({
                        ...formData,
                        is_hujan: true,
                        is_pruning: false,
                        is_baja: false,
                        is_efb: false,
                        is_meracun: false,
                      });
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                    formData.is_hujan
                      ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                      : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        formData.is_hujan
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <CloudRain size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                        Laporan Hujan
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Rekod Hujan Bulanan
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                      formData.is_hujan
                        ? "bg-blue-500 shadow-inner"
                        : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-full transition-transform duration-300 relative`}
                    >
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                          formData.is_hujan ? "translate-x-[20px]" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* RECORD MERACUN Toggle */}
                <div
                  onClick={() => {
                    if (!formData.is_meracun) {
                      setFormData({
                        ...formData,
                        is_meracun: true,
                        is_baja: false,
                        is_efb: false,
                        is_pruning: false,
                        is_hujan: false,
                      });
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                    formData.is_meracun
                      ? "bg-slate-50/85 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700"
                      : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        formData.is_meracun
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Leaf size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                        Rekod Meracun
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Kawasan Meracun (Weeding)
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-[48px] h-[26px] p-1 rounded-full relative transition-all duration-300 ${
                      formData.is_meracun
                        ? "bg-emerald-600 shadow-inner"
                        : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                    }`}
                  >
                    <div className="w-full h-full rounded-full transition-transform duration-300 relative">
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-white rounded-full shadow-md transition-transform duration-300 ${
                          formData.is_meracun ? "translate-x-[20px]" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-4" />

          {/* DYNAMIC FORMS */}
          {formData.is_hujan ? (
            <HujanInput 
              onSuccess={() => {
                setFormData({ ...formData, is_hujan: false });
              }}
              onAddHujan={onAddHujan!}
            />
          ) : formData.is_baja ? (
            <FertilizerInput
              onSuccess={() => {
                setFormData({ ...formData, is_baja: false });
              }}
            />
          ) : formData.is_pruning ? (
            <PruningInput
              onSuccess={() => {
                setFormData({ ...formData, is_pruning: false });
              }}
            />
          ) : formData.is_meracun ? (
            <MerumputInput
              onSuccess={() => {
                setFormData({ ...formData, is_meracun: false });
              }}
            />
          ) : (
            <form onSubmit={submitTransaction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FloatingInput
                  id="input-no-resit"
                  label="No Resit Kilang"
                  value={formData.no_resit}
                  onChange={(e) =>
                    setFormData({ ...formData, no_resit: e.target.value })
                  }
                  required
                  disabled={isEditing}
                  className={
                    duplicateRecord && normalizedNoResit && String(duplicateRecord.no_resit || '').trim().toUpperCase() === normalizedNoResit
                      ? "border-rose-500 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20"
                      : ""
                  }
                />
                {!formData.is_efb && (
                  <FloatingInput
                    label="Nota Hantaran"
                    value={formData.no_nota_hantaran}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        no_nota_hantaran: e.target.value,
                      })
                    }
                  />
                )}
              </div>

              {!formData.is_efb && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <FloatingInput
                    label="No Lori"
                    value={formData.no_lori}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        no_lori: e.target.value,
                      })
                    }
                    required
                  />
                  <FloatingInput
                    label="Kadar KPG (%)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.kpg}
                    onChange={(e) =>
                      setFormData({ ...formData, kpg: e.target.value })
                    }
                    className="font-mono text-emerald-600 dark:text-emerald-400 focus:border-emerald-500"
                  />
                  <FloatingInput
                    label="Kadar KPA (%)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.kpa || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, kpa: e.target.value })
                    }
                    className="font-mono text-sky-600 dark:text-sky-400 focus:border-sky-500"
                  />
                </div>
              )}

              {/* ... The rest of the form ... */}
              <div className="grid grid-cols-2 gap-3">
                <FloatingInput
                  label="Tan (MT)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tan}
                  onChange={(e) =>
                    setFormData({ ...formData, tan: e.target.value })
                  }
                  required
                />
                <div className="relative">
                  <FloatingInput
                    label={estateCfg.shortName === "Adela" ? "No. Blok (1-17, 88F, P2-1...6)" : "No. Blok (1-99)"}
                    type="text"
                    value={formData.blok}
                    onChange={(e) =>
                      setFormData({ ...formData, blok: e.target.value.toUpperCase() })
                    }
                    onBlur={() => {
                      if (formData.blok) {
                        const sanitized = cleanAndExtractBlockCode(formData.blok);
                        const isP2 = /^(?:P2|PKT\s*2)[-\s:]*/i.test(formData.blok) || (sanitized && /^(?:P2|PKT\s*2)[-\s:]*/i.test(sanitized));
                        const isFelda = sanitized === "88F" || sanitized === "88" || sanitized === "LF" || sanitized === "1F" || sanitized === "2F";
                        const updates: any = { blok: sanitized || formData.blok };
                        if (isP2) {
                          updates.peringkat = "PKT 002";
                        } else if (isFelda) {
                          updates.peringkat = "LOT FELDA";
                        }
                        setFormData((prev: any) => ({ ...prev, ...updates }));
                      }
                    }}
                    required
                    className={`font-mono ${!isBlokValid ? "border-rose-500 dark:border-rose-500 text-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""}`}
                  />
                  {!isBlokValid && (
                    <AlertCircle
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500"
                    />
                  )}
                  {estateCfg.shortName === "Adela" && (
                    <div className="text-[10px] text-slate-400 mt-1 px-1">
                      Pkt 1: Blok 1-11 | Pkt 2: Blok 12-17 (atau P2-1 hingga P2-6) | Lot Felda: 88F
                    </div>
                  )}
                </div>
              </div>

              {!formData.is_efb && (
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput
                    label="Bil Tandan Muda"
                    type="number"
                    min="0"
                    value={formData.muda}
                    onChange={(e) =>
                      setFormData({ ...formData, muda: e.target.value })
                    }
                    className="text-amber-600 dark:text-amber-500 focus:border-amber-500"
                  />
                  <FloatingInput
                    id="input-no-akuan-terima"
                    label="No Akuan Terima"
                    value={formData.no_akaun_terima}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        no_akaun_terima: e.target.value,
                      })
                    }
                    className={
                      duplicateRecord && normalizedNoAkuan && String(duplicateRecord.no_akaun_terima || '').trim().toUpperCase() === normalizedNoAkuan
                        ? "border-rose-500 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20 font-mono font-bold"
                        : "font-mono font-bold"
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!formData.is_efb && (
                  <>
                    <FloatingInput
                      label="No Seal (Pilihan)"
                      value={formData.no_seal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          no_seal: e.target.value,
                        })
                      }
                    />
                    <FloatingInput
                      label="Harga Semasa (RM/MT)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.rm_mt}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rm_mt: e.target.value,
                        })
                      }
                      className="font-mono text-indigo-600 dark:text-indigo-400 focus:border-indigo-500"
                    />
                  </>
                )}
                {formData.is_efb && (
                  <FloatingInput
                    label="No Lori (L/D)"
                    value={formData.no_lori}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        no_lori: e.target.value,
                      })
                    }
                    required
                  />
                )}
                <div className="relative">
                  <input
                    type="date"
                    value={formData.tarikh}
                    onChange={(e) =>
                      setFormData({ ...formData, tarikh: e.target.value })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-4 py-3 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    required
                  />
                  <span className="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 capitalize tracking-wider">
                    Tarikh
                  </span>
                </div>
              </div>

              {/* Real-Time Date Discrepancy Indicator & Quick-Fix Helper */}
              {formData.tarikh && (() => {
                const diff = getDaysDifferenceFromToday(formData.tarikh);
                const today = getTodayDateString();
                if (diff === 0) return null;
                const isFuture = diff > 0;
                return (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border transition-all ${
                    isFuture
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className={isFuture ? "text-rose-600 dark:text-rose-400 shrink-0" : "text-amber-600 dark:text-amber-400 shrink-0"} />
                      <div>
                        <span className="font-bold">
                          {isFuture
                            ? `Tarikh Masa Hadapan (+${diff} hari)`
                            : `Resit Terdahulu (-${Math.abs(diff)} hari)`}
                        </span>
                        <span className="text-[10px] opacity-80 block">
                          {formatDateWithDay(formData.tarikh)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tarikh: today })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-black text-emerald-600 dark:text-emerald-400 shadow-xs active:scale-95 transition-all flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Set Hari Ini
                    </button>
                  </div>
                );
              })()}

              {/* AMARAN & SEKATAN PERTINDIHAN RESIT (DUPLICATE PROTECTION) */}
              {!isEditing && duplicateRecord && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-300 space-y-2.5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center gap-2 text-rose-400 font-black text-xs uppercase tracking-wider">
                    <ShieldAlert size={18} className="text-rose-500 shrink-0" />
                    <span>Pemasukan Disekat: Resit Ini Telah Wujud</span>
                  </div>
                  <p className="text-xs text-rose-200/90 leading-relaxed">
                    Resit ini telah pun didaftarkan sebelum ini dengan{" "}
                    <strong className="text-white font-mono font-bold">
                      {duplicateRecord.no_akaun_terima && normalizedNoAkuan && String(duplicateRecord.no_akaun_terima).trim().toUpperCase() === normalizedNoAkuan
                        ? `No. Akuan Terima: ${duplicateRecord.no_akaun_terima}`
                        : `No. Resit: ${duplicateRecord.no_resit}`}
                    </strong>
                    . Pemasukan kali kedua disekat bagi mengelakkan pertindihan rekod atau penimpaan (overwrite) data sedia ada.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 dark:bg-black/50 p-2.5 rounded-xl font-mono text-slate-300 border border-rose-500/20">
                    <div>Tarikh: <span className="text-white font-bold">{duplicateRecord.tarikh}</span></div>
                    <div>No. Lori: <span className="text-white font-bold">{duplicateRecord.no_lori}</span></div>
                    <div>Blok: <span className="text-white font-bold">{duplicateRecord.blok}</span></div>
                    <div>Berat: <span className="text-amber-400 font-bold">{duplicateRecord.tan} MT</span></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black py-4 rounded-2xl flex justify-center items-center gap-2 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing || !isBlokValid}
                      className={`flex-[2] text-white text-xs font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-xl shadow-amber-600/20 outline-none active:scale-95 ${
                        isProcessing || !isBlokValid
                          ? "bg-amber-400 cursor-not-allowed"
                          : "bg-amber-500 hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Kemaskini...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Kemaskini Data
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                    onClick={() => setFormData({
                      no_resit: "", no_akaun_terima: "", no_lori: "", no_seal: "", no_nota_hantaran: "", kpg: "", kpa: "", blok: "", tan: "", muda: "", reject: "0.00", sample: "0", rm_mt: "", tarikh: "", masa_masuk: "", is_efb: false, is_baja: false, is_pruning: false, is_hujan: false, is_meracun: false
                    })}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black py-4 rounded-2xl flex justify-center items-center gap-2 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <RefreshCw size={16} /> Reset
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing || !isBlokValid || !!duplicateRecord}
                      className={`flex-[2] text-white text-xs font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-xl outline-none active:scale-95 ${
                        duplicateRecord
                          ? "bg-rose-900/80 border border-rose-500/40 text-rose-200 cursor-not-allowed shadow-none"
                          : isProcessing || !isBlokValid
                          ? "bg-emerald-400 cursor-not-allowed shadow-emerald-600/20"
                          : "bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 shadow-emerald-600/20"
                      }`}
                    >
                      {duplicateRecord ? (
                        <>
                          <ShieldAlert size={16} /> Resit Telah Wujud (Disekat)
                        </>
                      ) : isProcessing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Menyimpan...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Simpan Data
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
