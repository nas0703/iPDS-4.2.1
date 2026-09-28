import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Droplets,
  AlertTriangle,
  ShieldCheck,
  RotateCw,
  Printer,
  Sparkles,
  Info,
  CheckCircle2,
  DollarSign,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { WEED_DATABASE, WeedMasterProfile } from '../../../data/weedDatabase';

interface WeedCalculatorAndSopProps {
  selectedWeedId?: string;
  onSelectWeed?: (weedId: string) => void;
  onAskAiAboutWeed?: (query: string) => void;
}

export function WeedDosageCalculatorAndSop({
  selectedWeedId = 'asystasia-gangetica',
  onSelectWeed,
  onAskAiAboutWeed
}: WeedCalculatorAndSopProps) {
  const [activeWeedId, setActiveWeedId] = useState<string>(selectedWeedId);
  const [areaSize, setAreaSize] = useState<number>(10); // in Hectares
  const [areaUnit, setAreaUnit] = useState<'ha' | 'ekar'>('ha');
  const [knapsackCapacity, setKnapsackCapacity] = useState<number>(16); // 16 L default
  const [waterRatePerHa, setWaterRatePerHa] = useState<number>(450); // standard 450 L/ha for knapsack
  const [palmAgeMonths, setPalmAgeMonths] = useState<number>(48); // default 4 years (mature)
  const [isNearRiparianZone, setIsNearRiparianZone] = useState<boolean>(false);
  const [selectedControlIdx, setSelectedControlIdx] = useState<number>(0);

  // Synchronize when prop changes
  React.useEffect(() => {
    if (selectedWeedId) {
      setActiveWeedId(selectedWeedId);
    }
  }, [selectedWeedId]);

  const weedProfile = useMemo(() => {
    return WEED_DATABASE.find(w => w.id === activeWeedId) || WEED_DATABASE[0];
  }, [activeWeedId]);

  const controlOption = weedProfile.chemicalControl[selectedControlIdx] || weedProfile.chemicalControl[0];

  // Calculation Math
  const effectiveHa = areaUnit === 'ekar' ? areaSize * 0.404686 : areaSize;
  const totalWaterVolumeL = effectiveHa * waterRatePerHa;
  const totalPumps = Math.ceil(totalWaterVolumeL / knapsackCapacity);

  // Extract numerical dosage per pump 16L
  const parseDosagePerPump = (rate16LStr: string): { amount: number; unit: 'ml' | 'g' | 'ratio' } => {
    const match = rate16LStr.match(/([\d.]+)\s*(ml|g)/i);
    if (match) {
      return { amount: parseFloat(match[1]), unit: match[2].toLowerCase() as 'ml' | 'g' };
    }
    return { amount: 50, unit: 'ml' };
  };

  const parsedDosage = parseDosagePerPump(controlOption.rate16L);
  const totalChemicalRequired = (parsedDosage.amount * totalPumps);
  const totalChemicalFormatted = parsedDosage.unit === 'ml'
    ? (totalChemicalRequired / 1000).toFixed(2) + ' Liter'
    : (totalChemicalRequired / 1000).toFixed(2) + ' Kilogram';

  // Estimated Chemical Cost
  const estimatedCostPerUnit = parsedDosage.unit === 'ml' ? 28.0 : 35.0; // Approx RM per Liter or RM per Kg
  const totalCost = (totalChemicalRequired / 1000) * estimatedCostPerUnit;
  const costPerHa = effectiveHa > 0 ? (totalCost / effectiveHa) : 0;

  // Tree Safety Check
  const isTreeAgeSafe = palmAgeMonths >= controlOption.minPalmAgeMonths;
  const isRiparianSafe = !isNearRiparianZone || controlOption.riparianZoneSafe;

  // Print / Export SOP Task Sheet
  const handlePrintSop = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SOP Arahan Kerja Semburan Racun Rumpai - ${weedProfile.malayName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; }
          .title { font-size: 18px; font-weight: bold; color: #065f46; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .badge-safe { background: #d1fae5; color: #065f46; }
          .badge-danger { background: #fee2e2; color: #991b1b; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; }
          .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin: 16px 0; }
          .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          .sign-box { margin-top: 30px; display: flex; justify-content: space-between; }
          .sign-col { width: 45%; border-top: 1px dashed #64748b; padding-top: 6px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">LEMBARAN ARAHAN KERJA SEMBURAN HERBISID (SOP LADANG)</h1>
          <div class="subtitle">Manual Kawalan Rumpai & Manual Sawit Lestari (MSL) | Tarikh: ${new Date().toLocaleDateString('ms-MY')}</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px;">
          <div><strong>Spesies Sasaran:</strong> <em>${weedProfile.scientificName}</em> (${weedProfile.malayName})</div>
          <div><strong>Keluasan Blok:</strong> ${areaSize} ${areaUnit.toUpperCase()} (${effectiveHa.toFixed(2)} Ha)</div>
        </div>

        <div class="highlight-box">
          <h3 style="margin: 0 0 6px 0; font-size: 14px; color: #065f46;">💧 SUKATAN BANCUHAN PIAWAI (PAM GALAS ${knapsackCapacity} LITER)</h3>
          <p style="margin: 2px 0; font-size: 13px;"><strong>Bahan Aktif Racun:</strong> ${controlOption.activeIngredient}</p>
          <p style="margin: 2px 0; font-size: 13px;"><strong>Sukatan per Pam ${knapsackCapacity} L:</strong> <span style="font-size: 15px; color: #047857; font-weight: bold;">${controlOption.rate16L}</span></p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Jumlah Anggaran Pam:</strong> ${totalPumps} Pam (${totalWaterVolumeL.toLocaleString()} Liter Air)</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Jumlah Racun Diperlukan:</strong> ${totalChemicalFormatted}</p>
        </div>

        <h4 style="margin: 12px 0 6px 0; font-size: 13px;">📋 SPESIFIKASI OPERASI & KESELAMATAN:</h4>
        <table>
          <tr>
            <th width="30%">Parameter</th>
            <th>Spesifikasi Lapangan</th>
          </tr>
          <tr>
            <td><strong>Status Pokok Sawit</strong></td>
            <td>${isTreeAgeSafe ? '✅ DIBENARKAN (Umur Sawit: ' + palmAgeMonths + ' Bulan)' : '❌ AMARAN: Dilarang untuk sawit muda < ' + controlOption.minPalmAgeMonths + ' Bulan'}</td>
          </tr>
          <tr>
            <td><strong>Kumpulan Tindakan (MOA)</strong></td>
            <td>${controlOption.moaGroup}</td>
          </tr>
          <tr>
            <td><strong>Zon Rizab Sungai (Riparian)</strong></td>
            <td>${isNearRiparianZone ? (controlOption.riparianZoneSafe ? '✅ Dibenarkan dengan jarak penampan' : '❌ DILARANG Semburan Kimia dalam Zon Penampan 5-50m (MSPO)') : 'N/A (Bukan Zon Riparian)'}</td>
          </tr>
          <tr>
            <td><strong>Jenis Nozel Disyorkan</strong></td>
            <td>Nozel Deflektor (Polijet Merah/Biru / VLV) atau Even Spray Fan Nozzle</td>
          </tr>
          <tr>
            <td><strong>PPE Wajib</strong></td>
            <td>Pelindung Muka (Face Shield), Sarung Tangan Getah Nitril, Apron Plastik, Kasut But Getah</td>
          </tr>
          <tr>
            <td><strong>Catatan Aplikasi</strong></td>
            <td>${controlOption.notes}</td>
          </tr>
        </table>

        <h4 style="margin: 14px 0 6px 0; font-size: 13px;">🔄 STRATEGI KERINTANGAN & PENCEGAHAN:</h4>
        <p style="font-size: 12px; margin: 4px 0;">${weedProfile.resistanceManagement.rotationStrategy}</p>

        <div class="sign-box">
          <div class="sign-col">
            Disediakan Oleh:<br/><br/><br/>
            ( Penolong Pengurus / Eksekutif Agronomi )
          </div>
          <div class="sign-col">
            Diterima & Dilaksanakan Oleh:<br/><br/><br/>
            ( Mandur / Ketua Kumpulan Semburan )
          </div>
        </div>

        <div class="footer">
          Dicetak secara digital melalui AI App Builder - Sistem RAG Manual Sawit & Rumpai Pintar
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-xs">
      {/* Header Banner */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/20">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm leading-none">Kalkulator Bancuhan Pam 16L & Matriks Keselamatan</h4>
            <p className="text-[10.5px] text-emerald-100 mt-0.5">Penentukuran Automatik 16 Liter, Kos Racun & Eksport SOP Semburan</p>
          </div>
        </div>
        <button
          onClick={handlePrintSop}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs"
          title="Cetak Lembaran Kerja Semburan"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Cetak SOP (PDF)</span>
        </button>
      </div>

      <div className="p-3.5 sm:p-4 space-y-4">
        {/* Weed Selector Pill Selector */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Pilih Spesies Rumpai Sasaran (22 Spesies):
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Kadar Ditentukur 16L
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1.5">
            {WEED_DATABASE.map(w => {
              const isSelected = w.id === activeWeedId;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveWeedId(w.id);
                    setSelectedControlIdx(0);
                    onSelectWeed?.(w.id);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                  }`}
                >
                  <img
                    src={w.imageUrl}
                    alt={w.malayName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-md object-cover border border-emerald-400/50 shrink-0 bg-slate-900"
                  />
                  <span>{w.malayName.split('/')[0]}</span>
                  <span className={`text-[9.5px] italic opacity-80 font-serif`}>({w.scientificName})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Weed Info Brief & Safety Gates */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-emerald-500/50 bg-slate-950 shadow-xs">
                <img
                  src={weedProfile.imageUrl}
                  alt={weedProfile.malayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif italic font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    {weedProfile.scientificName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                    {weedProfile.family}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {weedProfile.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Nama Tempatan: <strong className="text-slate-700 dark:text-slate-200">{weedProfile.malayName}</strong> | English: {weedProfile.englishName}
                </p>
              </div>
            </div>

            {/* Ask AI button for this weed */}
            <button
              onClick={() => onAskAiAboutWeed?.(`Bagaimanakah cara kawalan kimia dan sukatan bancuhan pam 16 liter bagi ${weedProfile.scientificName} (${weedProfile.malayName})?`)}
              className="self-start sm:self-center px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <span>Tanya AI RAG</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
            {weedProfile.morphology.description}
          </p>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Area Input */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Keluasan Kawasan
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={areaSize}
                onChange={e => setAreaSize(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
              <select
                value={areaUnit}
                onChange={e => setAreaUnit(e.target.value as 'ha' | 'ekar')}
                className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-[11px] text-slate-700 dark:text-slate-200"
              >
                <option value="ha">Hektar</option>
                <option value="ekar">Ekar</option>
              </select>
            </div>
          </div>

          {/* Knapsack Sprayer Capacity */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Kapasiti Pam Galas
            </label>
            <select
              value={knapsackCapacity}
              onChange={e => setKnapsackCapacity(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="16">16 Liter (Piawai Default)</option>
              <option value="18">18 Liter (Tradisional)</option>
              <option value="20">20 Liter</option>
            </select>
          </div>

          {/* Palm Age Gate */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Umur Pokok Sawit
            </label>
            <select
              value={palmAgeMonths}
              onChange={e => setPalmAgeMonths(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="12">Sawit Muda TBM 1 (&lt;12 Bulan)</option>
              <option value="24">Sawit Pra-Matang TBM 2 (12-24 Bulan)</option>
              <option value="36">Sawit Mula Matang (24-36 Bulan)</option>
              <option value="48">Sawit Matang Penuh (&gt;36 Bulan)</option>
            </select>
          </div>

          {/* Riparian / MSPO Gate */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Zon Rizab Sungai (MSPO)
            </label>
            <label className="flex items-center gap-2 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={isNearRiparianZone}
                onChange={e => setIsNearRiparianZone(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-600 accent-emerald-600"
              />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Dekat Alur/Sungai (Buffer)
              </span>
            </label>
          </div>
        </div>

        {/* Chemical Option Selection */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Pilih Pilihan Formula Herbisid:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {weedProfile.chemicalControl.map((ctrl, idx) => {
              const isSelected = idx === selectedControlIdx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedControlIdx(idx)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-bold text-[11.5px] text-slate-900 dark:text-slate-100">
                      {ctrl.activeIngredient}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                    <span>Contoh Dagangan: <strong>{ctrl.tradeNameExample}</strong></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold font-mono">
                      {ctrl.rate16L} (Pam 16L)
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {ctrl.moaGroup}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Safety Gate Warning Banners */}
        <div className="space-y-1.5">
          {!isTreeAgeSafe && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2 text-rose-800 dark:text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-xs block">AMARAN KESELAMATAN UMUR POKOK:</strong>
                <p className="text-[11px] leading-relaxed mt-0.5">
                  Racun ini mengandungi bahan aktif yang dilarang untuk sawit muda berumur bawah <strong>{controlOption.minPalmAgeMonths} bulan</strong>. Risiko daun kerinting atau buah partenokarpi! Sila pilih racun selamat seperti <em>Glufosinate-ammonium</em> atau gunakan sungkup semburan bertudung (hooded sprayer).
                </p>
              </div>
            </div>
          )}

          {isNearRiparianZone && !controlOption.riparianZoneSafe && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-xs block">AMARAN ZON PENAMPAR SUNGAI (MSPO / RSPO):</strong>
                <p className="text-[11px] leading-relaxed mt-0.5">
                  Dilarang membuat semburan racun kimia dalam zon penampan sungai (5m – 50m). Gunakan kaedah manual (merumput piringan secara cangkul/tebas) untuk mematuhi piawaian MSPO.
                </p>
              </div>
            </div>
          )}

          {isTreeAgeSafe && (!isNearRiparianZone || controlOption.riparianZoneSafe) && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Status Keselamatan Lulus:</strong> Sesuai untuk aplikasi pada blok sawit terpilih.</span>
            </div>
          )}
        </div>

        {/* Calculated Results Summary Card */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-400">
              <Droplets className="w-4 h-4 text-emerald-400" />
              HASIL PENGIRAAN BANCUHAN LAPANGAN
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Keluasan: {effectiveHa.toFixed(2)} Ha ({areaSize} {areaUnit})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Kadar Bancuhan Pam</span>
              <strong className="text-sm font-black text-emerald-400 mt-0.5 block">{controlOption.rate16L}</strong>
              <span className="text-[9px] text-slate-400">Pam {knapsackCapacity}L</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Bilangan Pam</span>
              <strong className="text-sm font-black text-white mt-0.5 block">{totalPumps} Pam</strong>
              <span className="text-[9px] text-slate-400">{totalWaterVolumeL.toLocaleString()} L Air</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Jumlah Racun Diperlukan</span>
              <strong className="text-sm font-black text-amber-400 mt-0.5 block">{totalChemicalFormatted}</strong>
              <span className="text-[9px] text-slate-400">{controlOption.tradeNameExample.split('/')[0]}</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[9.5px] text-slate-400 font-bold uppercase">Anggaran Kos Racun</span>
              <strong className="text-sm font-black text-emerald-300 mt-0.5 block">RM {totalCost.toFixed(2)}</strong>
              <span className="text-[9px] text-slate-400">~RM {costPerHa.toFixed(2)} / Ha</span>
            </div>
          </div>
        </div>

        {/* Resistance Management & MOA Strategy */}
        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold text-[11px]">
            <RotateCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Pengurusan Kerintangan Herbisid & Giliran Kumpulan Cara Tindakan (MOA):</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {weedProfile.resistanceManagement.rotationStrategy}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {weedProfile.resistanceManagement.preventiveTips.map((tip, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 text-[10px] text-slate-700 dark:text-slate-300 font-medium">
                • {tip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
