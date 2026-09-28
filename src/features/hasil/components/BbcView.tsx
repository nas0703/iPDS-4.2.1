import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { TrendingUp, FileSpreadsheet, Plus, X, Search, Edit3, Check, Scale, Info, Package } from 'lucide-react';
import { CHART_COLORS } from '../../../utils/constants';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { safeFetch } from '../../../utils/safeFetch';

interface FeldaLot {
  projek: string;
  pkt: string;
  luas: number;
  lot: string;
  blok: string;
  berat: number | null; // This represents BBC index (Average Black Bunch Count per palm)
}

const initialFeldaLots: FeldaLot[] = [
  // 1LF
  { projek: "TUNGGAL", pkt: "1LF", luas: 14.7289, lot: "8009", blok: "2", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 0.8640, lot: "8017", blok: "2", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 0.8914, lot: "8016", blok: "2", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 5.8718, lot: "7993", blok: "6", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 2.2400, lot: "8066", blok: "6", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 4.1714, lot: "1811", blok: "9", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 0.8460, lot: "8102", blok: "12", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 2.5430, lot: "4408", blok: "12", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 2.2130, lot: "8165", blok: "16", berat: null },
  { projek: "TUNGGAL", pkt: "1LF", luas: 17.3405, lot: "4593", blok: "16", berat: null },
  // 2LF
  { projek: "TUNGGAL", pkt: "2LF", luas: 1.3969, lot: "6235", blok: "18", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 4.5100, lot: "6226", blok: "18", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 10.3236, lot: "6284", blok: "19", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 3.0210, lot: "6280", blok: "19", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 18.0714, lot: "6206", blok: "21", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 2.5711, lot: "6199", blok: "21", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 1.2920, lot: "6195", blok: "21", berat: null },
  { projek: "TUNGGAL", pkt: "2LF", luas: 5.6140, lot: "6172", blok: "22", berat: null }
];

const adelaFeldaLots: FeldaLot[] = [
  { projek: "ADELA", pkt: "1F", luas: 39.81, lot: "1F", blok: "1F", berat: null },
  { projek: "ADELA", pkt: "2F", luas: 38.23, lot: "2F", blok: "2F", berat: null },
  { projek: "ADELA", pkt: "LT", luas: 8.06, lot: "125Y", blok: "125Y", berat: null },
  { projek: "ADELA", pkt: "LT", luas: 4.04, lot: "128Y", blok: "128Y", berat: null },
  { projek: "ADELA", pkt: "LT", luas: 4.02, lot: "121V", blok: "121V", berat: null }
];

// Initial seed history for Blocks (Blok 1-22)
const defaultBbcSeedHistory: Record<string, Record<string, number[]>> = {
  "Jan": {}, "Feb": {}, "Mac": {}, "Apr": {}, "Mei": {}, "Jun": {},
  "Jul": {}, "Ogo": {}, "Sep": {}, "Okt": {}, "Nov": {}, "Dis": {}
};

const BbcViewComponent: React.FC = () => {
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());
  const [activeTab, setActiveTab] = useState<'blok' | 'felda'>('felda');
  const [searchQuery, setSearchQuery] = useState('');
  
  // States for main BBC Block View
  const [showBBCModal, setShowBBCModal] = useState(false);
  const [newBbcRecord, setNewBbcRecord] = useState<any>({ month: "" });
  const [bbcHistory, setBbcHistory] = useState<Record<string, Record<string, number[]>>>(() => {
    const estate = getActiveEstateId();
    const saved = localStorage.getItem(`fpm_bbc_history_${estate}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return estate === 'FPM_TUNGGAL' ? defaultBbcSeedHistory : {};
  });

  // Active month for FELDA Lots
  const [activeFeldaMonth, setActiveFeldaMonth] = useState<string>('Mei');

  // State for Lot Felda View
  const [feldaLots] = useState<FeldaLot[]>(() => {
    const estate = getActiveEstateId();
    const saved = localStorage.getItem(`fpm_felda_lots_bbc_${estate}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return estate === 'FPM_ADELA' ? adelaFeldaLots : initialFeldaLots;
  });

  // Track FELDA Lot monthly weights
  const [feldaBbcHistory, setFeldaBbcHistory] = useState<Record<string, Record<string, number | null>>>(() => {
    const estate = getActiveEstateId();
    const saved = localStorage.getItem(`fpm_felda_bbc_history_${estate}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }

    // Pre-seed history: seed completely empty
    const hist: Record<string, Record<string, number | null>> = {};
    const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

    months.forEach(m => {
      hist[m] = {};
      initialFeldaLots.forEach(lot => {
        hist[m][lot.lot] = null;
      });
    });

    return hist;
  });

  // States for FELDA Lot BBC Update Modal
  const [showFeldaBBCModal, setShowFeldaBBCModal] = useState(false);
  const [newFeldaBbcRecord, setNewFeldaBbcRecord] = useState<any>({ month: "" });

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const fetchBbcData = async (estateId: string) => {
    try {
      const res = await safeFetch(`/api/hasil/bbc?estate_id=${estateId}`);
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (res.ok && isJson) {
        const json = await res.json();
        if (json.bbcHistory && Object.keys(json.bbcHistory).length > 0) {
           setBbcHistory(json.bbcHistory);
        } else if (estateId !== 'FPM_TUNGGAL') {
           const localSaved = localStorage.getItem(`fpm_bbc_history_${estateId}`);
           if (localSaved) {
             try {
               const parsed = JSON.parse(localSaved);
               if (parsed && Object.keys(parsed).length > 0) {
                 setBbcHistory(parsed);
               } else {
                 setBbcHistory({});
               }
             } catch (_) { setBbcHistory({}); }
           } else {
             setBbcHistory({});
           }
        }
        if (json.feldaBbcHistory && Object.keys(json.feldaBbcHistory).length > 0) {
           setFeldaBbcHistory(json.feldaBbcHistory);
        } else if (estateId !== 'FPM_TUNGGAL') {
           const localSaved = localStorage.getItem(`fpm_felda_bbc_history_${estateId}`);
           if (localSaved) {
             try {
               const parsed = JSON.parse(localSaved);
               if (parsed && Object.keys(parsed).length > 0) {
                 setFeldaBbcHistory(parsed);
               } else {
                 const hist: Record<string, Record<string, number | null>> = {};
                 const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
                 months.forEach(m => { hist[m] = {}; });
                 setFeldaBbcHistory(hist);
               }
             } catch (_) {
               const hist: Record<string, Record<string, number | null>> = {};
               const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
               months.forEach(m => { hist[m] = {}; });
               setFeldaBbcHistory(hist);
             }
           } else {
             const hist: Record<string, Record<string, number | null>> = {};
             const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
             months.forEach(m => { hist[m] = {}; });
             setFeldaBbcHistory(hist);
           }
        }
      }
    } catch (err) {
      console.warn("Using offline copy for BBC history.");
    } finally {
      setIsDataLoaded(true);
    }
  };

  // Load from API on mount & listen to estate changes
  useEffect(() => {
    fetchBbcData(activeEstate);

    const handleEstateChange = (e: any) => {
      const newEstate = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstate);
      fetchBbcData(newEstate);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  // Persist history values to DB and localStorage
  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem(`fpm_bbc_history_${activeEstate}`, JSON.stringify(bbcHistory));
    if (activeEstate === 'FPM_TUNGGAL') {
      localStorage.setItem("fpm_bbc_history_v5_prod", JSON.stringify(bbcHistory));
    }
    
    // Auto-sync to cloud
    safeFetch(`/api/hasil/bbc?estate_id=${activeEstate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbcHistory, feldaBbcHistory, estate_id: activeEstate })
    }).catch(e => console.error("Sync bbc fail:", e));
  }, [bbcHistory, feldaBbcHistory, isDataLoaded, activeEstate]);

  // Persist Felda lots history
  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem(`fpm_felda_bbc_history_${activeEstate}`, JSON.stringify(feldaBbcHistory));
    if (activeEstate === 'FPM_TUNGGAL') {
      localStorage.setItem("fpm_felda_bbc_history_v5_prod", JSON.stringify(feldaBbcHistory));
    }
  }, [feldaBbcHistory, isDataLoaded, activeEstate]);

  // Dynamic lots containing weight for the selected activeFeldaMonth
  const activeFeldaLots = useMemo(() => {
    return feldaLots.map(lot => ({
      ...lot,
      berat: feldaBbcHistory[activeFeldaMonth]?.[lot.lot] !== undefined
        ? feldaBbcHistory[activeFeldaMonth][lot.lot]
        : null
    }));
  }, [feldaLots, feldaBbcHistory, activeFeldaMonth]);

  // Calculations for Felda Lots based on selected month's dynamic activeLots
  const feldaStats = useMemo(() => {
    // 1LF stats
    const lots1 = activeFeldaLots.filter(l => l.pkt === "1LF");
    const area1 = lots1.reduce((sum, l) => sum + l.luas, 0);
    const validLots1 = lots1.filter(l => l.berat !== null);
    const sumProducts1 = validLots1.reduce((sum, l) => sum + (l.luas * (l.berat || 0)), 0);
    const activeArea1 = validLots1.reduce((sum, l) => sum + l.luas, 0);
    const bbc1 = activeArea1 > 0 ? sumProducts1 / activeArea1 : 0;

    // 2LF stats
    const lots2 = activeFeldaLots.filter(l => l.pkt === "2LF");
    const area2 = lots2.reduce((sum, l) => sum + l.luas, 0);
    const validLots2 = lots2.filter(l => l.berat !== null);
    const sumProducts2 = validLots2.reduce((sum, l) => sum + (l.luas * (l.berat || 0)), 0);
    const activeArea2 = validLots2.reduce((sum, l) => sum + l.luas, 0);
    const bbc2 = activeArea2 > 0 ? sumProducts2 / activeArea2 : 0;

    // Overall stats
    const totalArea = activeFeldaLots.reduce((sum, l) => sum + l.luas, 0);
    const validLotsAll = activeFeldaLots.filter(l => l.berat !== null);
    const totalActiveArea = validLotsAll.reduce((sum, l) => sum + l.luas, 0);
    const totalProduct = validLotsAll.reduce((sum, l) => sum + (l.luas * (l.berat || 0)), 0);
    const overallBbc = totalActiveArea > 0 ? totalProduct / totalActiveArea : 0;

    return {
      area1,
      bbc1,
      area2,
      bbc2,
      totalArea,
      overallBbc,
      totalLots: activeFeldaLots.length,
      activeLots: validLotsAll.length
    };
  }, [activeFeldaLots]);

  // Calculate monthly stats for FELDA across all 12 months for the flat grid
  const feldaMonthlyStats = useMemo(() => {
    const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
    const stats: Record<string, { bbc1: number; bbc2: number; overallBbc: number; area1: number; area2: number; totalArea: number }> = {};

    months.forEach(m => {
      const monthWeights = feldaBbcHistory[m] || {};
      
      // 1LF stats
      const lots1 = feldaLots.filter(l => l.pkt === "1LF");
      const validLots1 = lots1.filter(l => monthWeights[l.lot] !== null && monthWeights[l.lot] !== undefined);
      const sumProducts1 = validLots1.reduce((sum, l) => sum + (l.luas * (monthWeights[l.lot] || 0)), 0);
      const activeArea1 = validLots1.reduce((sum, l) => sum + l.luas, 0);
      const bbc1 = activeArea1 > 0 ? sumProducts1 / activeArea1 : 0;
      const area1 = lots1.reduce((sum, l) => sum + l.luas, 0);

      // 2LF stats
      const lots2 = feldaLots.filter(l => l.pkt === "2LF");
      const validLots2 = lots2.filter(l => monthWeights[l.lot] !== null && monthWeights[l.lot] !== undefined);
      const sumProducts2 = validLots2.reduce((sum, l) => sum + (l.luas * (monthWeights[l.lot] || 0)), 0);
      const activeArea2 = validLots2.reduce((sum, l) => sum + l.luas, 0);
      const bbc2 = activeArea2 > 0 ? sumProducts2 / activeArea2 : 0;
      const area2 = lots2.reduce((sum, l) => sum + l.luas, 0);

      // Overall stats
      const validLotsAll = feldaLots.filter(l => monthWeights[l.lot] !== null && monthWeights[l.lot] !== undefined);
      const totalActiveArea = validLotsAll.reduce((sum, l) => sum + l.luas, 0);
      const totalProduct = validLotsAll.reduce((sum, l) => sum + (l.luas * (monthWeights[l.lot] || 0)), 0);
      const overallBbc = totalActiveArea > 0 ? totalProduct / totalActiveArea : 0;
      const totalArea = feldaLots.reduce((sum, l) => sum + l.luas, 0);

      stats[m] = {
        bbc1,
        bbc2,
        overallBbc,
        area1,
        area2,
        totalArea
      };
    });

    return stats;
  }, [feldaLots, feldaBbcHistory]);

  // Calculate main BBC block metrics (dynamically pulls Felda monthly averages!)
  const bbcDataState = useMemo(() => {
    const result = [];
    const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

    for (const m of months) {
        const record = { month: m } as any;
        let pkt1Sum = 0, pkt1Count = 0;
        let pkt2Sum = 0, pkt2Count = 0;
        
        const monthData = bbcHistory[m] || {};
        
        for (let i = 1; i <= 22; i++) {
             const blokStr = String(i);
             const vals = monthData[blokStr] || [];
             const nonZeroVals = vals.filter((v: number) => typeof v === 'number' && v > 0);
             if (nonZeroVals.length > 0) {
                 const avg = nonZeroVals.reduce((a:number,b:number)=>a+b,0) / nonZeroVals.length;
                 record[blokStr] = avg;
                 if (i <= 17) {
                     pkt1Sum += avg;
                     pkt1Count++;
                 } else {
                     pkt2Sum += avg;
                     pkt2Count++;
                 }
             } else {
                 record[blokStr] = null;
             }
        }
        record.avg1 = pkt1Count > 0 ? pkt1Sum / pkt1Count : null;
        record.avg2 = pkt2Count > 0 ? pkt2Sum / pkt2Count : null;

        // Calculate dynamic FELDA 1LF weighted BBC for month 'm'
        const monthWeights = feldaBbcHistory[m] || {};
        
        let felda1WeightedSum = 0;
        let felda1ActiveArea = 0;
        feldaLots.filter(l => l.pkt === "1LF").forEach(lot => {
          const val = monthWeights[lot.lot];
          if (val !== null && val !== undefined && val > 0) {
             felda1WeightedSum += val * lot.luas;
             felda1ActiveArea += lot.luas;
          }
        });
        record.felda1 = felda1ActiveArea > 0 ? felda1WeightedSum / felda1ActiveArea : null;

        // Calculate dynamic FELDA 2LF weighted BBC for month 'm'
        let felda2WeightedSum = 0;
        let felda2ActiveArea = 0;
        feldaLots.filter(l => l.pkt === "2LF").forEach(lot => {
          const val = monthWeights[lot.lot];
          if (val !== null && val !== undefined && val > 0) {
             felda2WeightedSum += val * lot.luas;
             felda2ActiveArea += lot.luas;
          }
        });
        record.felda2 = felda2ActiveArea > 0 ? felda2WeightedSum / felda2ActiveArea : null;

        result.push(record);
    }
    return result;
  }, [bbcHistory, feldaBbcHistory, feldaLots]);

  // Filter lots based on query
  const filteredLots = useMemo(() => {
    if (!searchQuery) return activeFeldaLots;
    const query = searchQuery.toLowerCase();
    return activeFeldaLots.filter(l => 
      l.lot.toLowerCase().includes(query) || 
      l.blok.toLowerCase().includes(query) ||
      l.pkt.toLowerCase().includes(query)
    );
  }, [activeFeldaLots, searchQuery]);

  const activePkt1Lots = filteredLots.filter(l => l.pkt === "1LF");
  const activePkt2Lots = filteredLots.filter(l => l.pkt === "2LF");

  // Periods definition for periodic summaries
  const periods = useMemo(() => [
    { name: "SUKU 1 (Q1)", short: "Q1", desc: "Jan - Mac", months: ["Jan", "Feb", "Mac"], type: "suku" },
    { name: "SUKU 2 (Q2)", short: "Q2", desc: "Apr - Jun", months: ["Apr", "Mei", "Jun"], type: "suku" },
    { name: "SUKU 3 (Q3)", short: "Q3", desc: "Jul - Sep", months: ["Jul", "Ogo", "Sep"], type: "suku" },
    { name: "SUKU 4 (Q4)", short: "Q4", desc: "Okt - Dis", months: ["Okt", "Nov", "Dis"], type: "suku" },
    { name: "1/2 TAHUN 1 (H1)", short: "H1", desc: "Jan - Jun", months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun"], type: "setengah" },
    { name: "1/2 TAHUN 2 (H2)", short: "H2", desc: "Jul - Dis", months: ["Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"], type: "setengah" },
    { name: "SETAHUN PENUH (FY)", short: "FY", desc: "Jan - Dis", months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"], type: "penuh" },
  ], []);

  // Ordered table columns exactly as drawn in user's notebook
  const tableColumns = useMemo(() => [
    { id: "Jan", type: "month", label: "JAN", monthKey: "Jan" },
    { id: "Feb", type: "month", label: "FEB", monthKey: "Feb" },
    { id: "Mac", type: "month", label: "MAC", monthKey: "Mac" },
    { id: "Q1", type: "period", label: "Q1", desc: "Jan - Mac", months: ["Jan", "Feb", "Mac"], typeBg: "suku" },
    { id: "Apr", type: "month", label: "APRL", monthKey: "Apr" },
    { id: "Mei", type: "month", label: "MEI", monthKey: "Mei" },
    { id: "Jun", type: "month", label: "JUN", monthKey: "Jun" },
    { id: "Q2", type: "period", label: "Q2", desc: "Apr - Jun", months: ["Apr", "Mei", "Jun"], typeBg: "suku" },
    { id: "H1", type: "period", label: "1ST HALF", desc: "Jan - Jun", months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun"], typeBg: "setengah" },
    { id: "Jul", type: "month", label: "JUL", monthKey: "Jul" },
    { id: "Ogo", type: "month", label: "OGS", monthKey: "Ogo" },
    { id: "Sep", type: "month", label: "SEPT", monthKey: "Sep" },
    { id: "Q3", type: "period", label: "Q3", desc: "Jul - Sep", months: ["Jul", "Ogo", "Sep"], typeBg: "suku" },
    { id: "Okt", type: "month", label: "OKT", monthKey: "Okt" },
    { id: "Nov", type: "month", label: "NOV", monthKey: "Nov" },
    { id: "Dis", type: "month", label: "DIS", monthKey: "Dis" },
    { id: "Q4", type: "period", label: "Q4", desc: "Okt - Dis", months: ["Okt", "Nov", "Dis"], typeBg: "suku" },
    { id: "H2", type: "period", label: "2ND HALF", desc: "Jul - Dis", months: ["Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"], typeBg: "setengah" },
    { id: "FY", type: "period", label: "FULL YEAR", desc: "Jan - Dis", months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"], typeBg: "penuh" },
  ], []);

  // Helper for computing sum of a lot's BBC for a given period of months
  const sumFeldaLotPeriod = (months: string[], lotNo: string) => {
    let total = 0;
    let hasValue = false;
    months.forEach(m => {
      const val = feldaBbcHistory[m]?.[lotNo];
      if (val !== null && val !== undefined) {
        total += val;
        hasValue = true;
      }
    });
    return hasValue ? total : null;
  };

  // Helper for computing sum of sector average for Felda
  const sumFeldaPktPeriod = (months: string[], pktKey: 'bbc1' | 'bbc2' | 'overallBbc') => {
    let total = 0;
    let hasValue = false;
    months.forEach(m => {
      const val = feldaMonthlyStats[m]?.[pktKey];
      if (val !== null && val !== undefined && val > 0) {
        total += val;
        hasValue = true;
      }
    });
    return hasValue ? total : null;
  };

  // Helper for computing sum of block-level sensus for a period
  const sumBlockPeriod = (months: string[], blockNo: string) => {
    let total = 0;
    let hasValue = false;
    months.forEach(m => {
      const record = bbcDataState.find(r => r.month === m);
      const val = record ? record[blockNo] : null;
      if (val !== null && val !== undefined) {
        total += val;
        hasValue = true;
      }
    });
    return hasValue ? total : null;
  };

  // Helper for computing sum of averages/fields in block state (avg1, avg2, felda1, felda2)
  const sumBlockStatePeriod = (months: string[], fieldKey: 'avg1' | 'avg2' | 'felda1' | 'felda2') => {
    let total = 0;
    let hasValue = false;
    months.forEach(m => {
      const record = bbcDataState.find(r => r.month === m);
      const val = record ? record[fieldKey] : null;
      if (val !== null && val !== undefined) {
        total += val;
        hasValue = true;
      }
    });
    return hasValue ? total : null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tab Switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setActiveTab('felda')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'felda'
               ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-100'
               : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Scale size={14} className="mr-0.5" />
          Lot Felda
        </button>
        <button
          onClick={() => setActiveTab('blok')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'blok'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp size={14} className="mr-0.5" />
          Keseluruhan
        </button>
      </div>

      {activeTab === 'felda' ? (
        <div className="space-y-6">
          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4">
             
             {/* Controls */}
             <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <h3 className="text-[13px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                     <FileSpreadsheet size={15} />
                     REKOD BBC (BUNCH / POKOK) - SEPANJANG TAHUN
                  </h3>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                     {/* Search Input Box */}
                     <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Cari Lot / Blok / Pkt..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 py-2 w-full sm:w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all focus:ring-2 focus:ring-emerald-500/10"
                        />
                     </div>
                     {/* Kemaskini Button */}
                     <button 
                       onClick={() => {
                         setNewFeldaBbcRecord({ month: "" });
                         setShowFeldaBBCModal(true);
                       }} 
                       className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap self-start sm:self-auto"
                     >
                        <Plus size={14} /> KEMASKINI BBC LOT
                     </button>
                  </div>
             </div>

             {/* Interactive 12-Month Table */}
             <div className="overflow-x-auto rounded-[18px] border border-slate-100 dark:border-slate-800">
                 <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f0fdf4] dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider text-[9px] border-b border-emerald-100 dark:border-emerald-800/80">
                       <tr>
                         <th className="px-2 py-1.5 text-center border-r border-emerald-100 dark:border-emerald-850 min-w-[50px]">PKT</th>
                         <th className="px-2 py-1.5 text-center border-r border-emerald-100 dark:border-emerald-850 min-w-[65px]">NO. LOT</th>
                         <th className="px-2 py-1.5 text-center border-r border-emerald-100 dark:border-emerald-850 min-w-[75px]">BLOK</th>
                         <th className="px-2 py-1.5 text-right border-r border-emerald-100 dark:border-emerald-850 min-w-[80px]">LUAS (HA)</th>
                         {tableColumns.map(col => {
                           if (col.type === 'month') {
                             return (
                               <th key={col.id} className="px-1.5 py-1.5 text-center min-w-[75px] border-r border-emerald-50 dark:border-emerald-955/20">
                                 {col.label} (B/P)
                               </th>
                             );
                           } else {
                             const bgClass = col.typeBg === 'suku' 
                               ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold' 
                               : col.typeBg === 'setengah' 
                                 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold' 
                                 : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 font-extrabold';
                             return (
                               <th key={col.id} className={`px-2 py-1.5 text-center border-r border-emerald-100 dark:border-emerald-800 min-w-[95px] ${bgClass}`}>
                                 {col.label}<br/>
                                 <span className="text-[7.5px] font-bold text-slate-500 dark:text-slate-400 normal-case">({col.desc})</span>
                               </th>
                             );
                           }
                         })}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 dark:divide-emerald-950/10 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        
                        {/* PKT 1LF SECTION */}
                        {activePkt1Lots.length > 0 ? (
                          <>
                            {activePkt1Lots.map((lot, idx) => (
                               <tr key={lot.lot} className="hover:bg-emerald-50/10 dark:hover:bg-emerald-950/5 transition-all">
                                 {idx === 0 && (
                                   <td rowSpan={activePkt1Lots.length} className="px-2 py-2 font-black text-slate-850 dark:text-slate-200 align-middle text-center border-r border-emerald-100 dark:border-emerald-800 bg-slate-50/20 dark:bg-slate-900/10">
                                     {lot.pkt}
                                   </td>
                                 )}
                                 <td className="px-2 py-1.5 text-center font-mono text-slate-900 dark:text-white text-[11px] border-r border-emerald-100 dark:border-emerald-805">{lot.lot}</td>
                                 <td className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400 font-extrabold border-r border-emerald-100 dark:border-emerald-805">BLOK {lot.blok}</td>
                                 <td className="px-2 py-1.5 text-right font-mono text-slate-500 border-r border-emerald-100 dark:border-emerald-805">{lot.luas.toFixed(4)}</td>
                                 
                                 {tableColumns.map(col => {
                                   if (col.type === "month") {
                                     const monthWeights = feldaBbcHistory[col.monthKey] || {};
                                     const val = monthWeights[lot.lot];
                                     return (
                                       <td key={col.id} className="px-1 py-1 text-center border-r border-emerald-50 dark:border-emerald-955/20 align-middle">
                                          <div className="p-0.5 min-h-[18px] flex items-center justify-center font-mono text-center">
                                             <span className={`text-[10.5px] font-black ${val !== null && val !== undefined ? 'text-slate-850 dark:text-white' : 'text-slate-300 dark:text-slate-655'}`}>
                                                {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                                             </span>
                                          </div>
                                       </td>
                                     );
                                   } else {
                                     const sumVal = sumFeldaLotPeriod(col.months || [], lot.lot);
                                     const bgClass = col.typeBg === 'suku' 
                                       ? 'bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 font-bold' 
                                       : col.typeBg === 'setengah' 
                                         ? 'bg-amber-500/5 text-amber-800 dark:text-amber-300 font-bold' 
                                         : 'bg-violet-500/5 text-violet-800 dark:text-violet-300 font-bold';
                                     return (
                                       <td key={col.id} className={`px-1 py-1.5 text-center border-r border-emerald-50 dark:border-emerald-955/25 font-mono font-black text-[10.5px] align-middle ${bgClass}`}>
                                         {sumVal !== null ? sumVal.toFixed(2) : "-"}
                                       </td>
                                     );
                                   }
                                 })}
                               </tr>
                            ))}
                            {!searchQuery && (
                              <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-y border-emerald-100 dark:border-emerald-800">
                                 <td colSpan={3} className="px-2 py-1.5 text-right font-black uppercase text-emerald-700 dark:text-emerald-400 border-r border-emerald-100 dark:border-emerald-800">PURATA FELDA 1LF</td>
                                 <td className="px-2 py-1.5 text-right font-mono font-black text-slate-700 dark:text-slate-200 border-r border-emerald-100 dark:border-emerald-800">{feldaStats.area1.toFixed(4)}</td>
                                 {tableColumns.map(col => {
                                   if (col.type === "month") {
                                     const val = feldaMonthlyStats[col.monthKey]?.bbc1;
                                     return (
                                       <td key={col.id} className="px-1.5 py-1.5 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10px] border-r border-emerald-50 dark:border-emerald-955/10">
                                         {val > 0 ? val.toFixed(2) : "-"}
                                       </td>
                                     );
                                   } else {
                                     const sumVal = sumFeldaPktPeriod(col.months || [], 'bbc1');
                                     const bgClass = col.typeBg === 'suku' 
                                       ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold' 
                                       : col.typeBg === 'setengah' 
                                         ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold' 
                                         : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 font-extrabold';
                                     return (
                                       <td key={col.id} className={`px-1.5 py-1.5 text-center font-mono font-black text-[10px] border-r border-emerald-50 dark:border-emerald-955/15 ${bgClass}`}>
                                         {sumVal !== null ? sumVal.toFixed(2) : "-"}
                                       </td>
                                     );
                                   }
                                 })}
                              </tr>
                            )}
                          </>
                        ) : null}

                        {/* PKT 2LF SECTION */}
                        {activePkt2Lots.length > 0 ? (
                          <>
                            {activePkt2Lots.map((lot, idx) => (
                               <tr key={lot.lot} className="hover:bg-emerald-50/10 dark:hover:bg-emerald-950/5 transition-all">
                                 {idx === 0 && (
                                   <td rowSpan={activePkt2Lots.length} className="px-2 py-2 font-black text-slate-850 dark:text-slate-200 align-middle text-center border-r border-emerald-100 dark:border-emerald-800 bg-slate-50/20 dark:bg-slate-900/10">
                                     {lot.pkt}
                                   </td>
                                 )}
                                 <td className="px-2 py-1.5 text-center font-mono text-slate-900 dark:text-white text-[11px] border-r border-emerald-100 dark:border-emerald-805">{lot.lot}</td>
                                 <td className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400 font-extrabold border-r border-emerald-100 dark:border-emerald-805">BLOK {lot.blok}</td>
                                 <td className="px-2 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400 border-r border-emerald-100 dark:border-emerald-805">{lot.luas.toFixed(4)}</td>
                                 
                                 {tableColumns.map(col => {
                                   if (col.type === "month") {
                                     const monthWeights = feldaBbcHistory[col.monthKey] || {};
                                     const val = monthWeights[lot.lot];
                                     return (
                                       <td key={col.id} className="px-1 py-1 text-center border-r border-emerald-50 dark:border-emerald-955/20 align-middle">
                                          <div className="p-0.5 min-h-[18px] flex items-center justify-center font-mono text-center">
                                             <span className={`text-[10.5px] font-black ${val !== null && val !== undefined ? 'text-slate-850 dark:text-white' : 'text-slate-300 dark:text-slate-655'}`}>
                                                {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                                             </span>
                                          </div>
                                       </td>
                                     );
                                   } else {
                                     const sumVal = sumFeldaLotPeriod(col.months || [], lot.lot);
                                     const bgClass = col.typeBg === 'suku' 
                                       ? 'bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 font-bold' 
                                       : col.typeBg === 'setengah' 
                                         ? 'bg-amber-500/5 text-amber-800 dark:text-amber-300 font-bold' 
                                         : 'bg-violet-500/5 text-violet-800 dark:text-violet-300 font-bold';
                                     return (
                                       <td key={col.id} className={`px-1 py-1.5 text-center border-r border-emerald-50 dark:border-emerald-955/25 font-mono font-black text-[10.5px] align-middle ${bgClass}`}>
                                         {sumVal !== null ? sumVal.toFixed(2) : "-"}
                                       </td>
                                     );
                                   }
                                 })}
                               </tr>
                            ))}
                            {!searchQuery && (
                              <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-y border-emerald-100 dark:border-emerald-800">
                                 <td colSpan={3} className="px-2 py-1.5 text-right font-black uppercase text-emerald-700 dark:text-emerald-400 border-r border-emerald-100 dark:border-emerald-800">PURATA FELDA 2LF</td>
                                 <td className="px-2 py-1.5 text-right font-mono font-black text-slate-700 dark:text-slate-200 border-r border-emerald-100 dark:border-emerald-800">{feldaStats.area2.toFixed(4)}</td>
                                 {tableColumns.map(col => {
                                   if (col.type === "month") {
                                     const val = feldaMonthlyStats[col.monthKey]?.bbc2;
                                     return (
                                       <td key={col.id} className="px-1.5 py-1.5 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10px] border-r border-emerald-50 dark:border-emerald-955/10">
                                         {val > 0 ? val.toFixed(2) : "-"}
                                       </td>
                                     );
                                   } else {
                                     const sumVal = sumFeldaPktPeriod(col.months || [], 'bbc2');
                                     const bgClass = col.typeBg === 'suku' 
                                       ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold' 
                                       : col.typeBg === 'setengah' 
                                         ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold' 
                                         : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 font-extrabold';
                                     return (
                                       <td key={col.id} className={`px-1.5 py-1.5 text-center font-mono font-black text-[10px] border-r border-emerald-50 dark:border-emerald-955/15 ${bgClass}`}>
                                         {sumVal !== null ? sumVal.toFixed(2) : "-"}
                                       </td>
                                     );
                                   }
                                 })}
                              </tr>
                            )}
                          </>
                        ) : null}

                        {/* TABLE GRAND TOTAL */}
                        {!searchQuery && (
                          <tr className="bg-emerald-600 text-white dark:bg-emerald-700 font-extrabold text-xs">
                             <td colSpan={3} className="px-4 py-3.5 text-right font-black uppercase border-r border-emerald-500 dark:border-emerald-600">JUMLAH KAWASAN TERPAKAI (GRAND TOTAL)</td>
                             <td className="px-4 py-3.5 text-right font-mono font-black border-r border-emerald-500 dark:border-emerald-600">{feldaStats.totalArea.toFixed(4)}</td>
                             {tableColumns.map(col => {
                                if (col.type === "month") {
                                  const val = feldaMonthlyStats[col.monthKey]?.overallBbc;
                                  return (
                                    <td key={col.id} className="px-4 py-3.5 text-center font-mono font-black text-shadow-sm text-[12px] border-r border-emerald-500/50 dark:border-emerald-600/50">
                                      {val > 0 ? val.toFixed(2) : "-"} B/P
                                    </td>
                                  );
                                } else {
                                  const sumVal = sumFeldaPktPeriod(col.months || [], 'overallBbc');
                                  const bgClass = col.typeBg === 'suku' 
                                    ? 'bg-emerald-700/40 text-emerald-100 font-black' 
                                    : col.typeBg === 'setengah' 
                                      ? 'bg-amber-700/45 text-amber-100 font-black' 
                                      : 'bg-violet-700/45 text-violet-100 font-black';
                                  return (
                                    <td key={col.id} className={`px-4 py-3.5 text-center font-mono font-black text-[12px] border-r border-emerald-500/50 dark:border-emerald-600/50 ${bgClass}`}>
                                      {sumVal !== null ? sumVal.toFixed(2) : "-"} B/P
                                    </td>
                                  );
                                }
                             })}
                          </tr>
                        )}
                        
                     </tbody>
                 </table>
             </div>
          </div>

           {/* Ringkasan Jumlah BBC Berkala (Suku, Setengah & Setahun) */}
           <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4 mt-6">
              <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
                <h3 className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale size={15} />
                  HASIL TAMBAH BBC LOT SECARA BERKALA (SUKU, SETENGAH & SETAHUN PENUH)
                </h3>
              </div>

              <div className="overflow-x-auto rounded-[18px] border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f0fdf4] dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider text-[9px] border-b border-emerald-100 dark:border-emerald-800/80">
                    <tr>
                      <th className="px-3 py-2 text-center border-r border-emerald-100 dark:border-emerald-850">PKT</th>
                      <th className="px-3 py-2 text-center border-r border-emerald-100 dark:border-emerald-850">NO. LOT</th>
                      <th className="px-3 py-2 text-center border-r border-emerald-100 dark:border-emerald-850">BLOK</th>
                      <th className="px-3 py-2 text-right border-r border-emerald-100 dark:border-emerald-850">LUAS (HA)</th>
                      {periods.map(p => (
                        <th key={p.short} className="px-3 py-2 text-center border-r border-emerald-50 dark:border-emerald-955/20 min-w-[100px]">
                          {p.name}<br/>
                          <span className="text-[7.5px] font-normal text-slate-400 normal-case">({p.desc})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 dark:divide-emerald-950/10 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {/* PKT 1LF */}
                    {activePkt1Lots.map((lot, idx) => (
                      <tr key={`sum-1lf-${lot.lot}`} className="hover:bg-emerald-50/10 dark:hover:bg-emerald-950/5 transition-all">
                        {idx === 0 && (
                          <td rowSpan={activePkt1Lots.length} className="px-3 py-2 font-black text-slate-850 dark:text-slate-200 align-middle text-center border-r border-emerald-100 dark:border-emerald-800 bg-slate-50/20 dark:bg-slate-900/10">
                            {lot.pkt}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center font-mono text-slate-900 dark:text-white text-[11px] border-r border-emerald-100 dark:border-emerald-805">{lot.lot}</td>
                        <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-extrabold border-r border-emerald-100 dark:border-emerald-805">BLOK {lot.blok}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500 border-r border-emerald-100 dark:border-emerald-805">{lot.luas.toFixed(4)}</td>
                        
                        {/* Periods calculation */}
                        {periods.map(p => {
                          const sumVal = sumFeldaLotPeriod(p.months, lot.lot);
                          const bgClass = p.type === 'suku' ? 'bg-emerald-50/5 dark:bg-emerald-950/5' : p.type === 'setengah' ? 'bg-amber-50/5 dark:bg-amber-950/5' : 'bg-violet-50/5 dark:bg-violet-950/5';
                          return (
                            <td key={p.short} className={`px-3 py-2 text-center font-mono font-black border-r border-emerald-50 dark:border-emerald-955/20 ${bgClass}`}>
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* PURATA PKT 1LF */}
                    {!searchQuery && (
                      <tr className="bg-emerald-50/30 dark:bg-emerald-900/10 border-y border-emerald-100 dark:border-emerald-800 font-extrabold">
                        <td colSpan={3} className="px-3 py-2 text-right font-black uppercase text-emerald-700 dark:text-emerald-400 border-r border-emerald-100 dark:border-emerald-800">JUMLAH PURATA 1LF</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-slate-700 dark:text-slate-200 border-r border-emerald-100 dark:border-emerald-800">{feldaStats.area1.toFixed(4)}</td>
                        {periods.map(p => {
                          const sumVal = sumFeldaPktPeriod(p.months, 'bbc1');
                          return (
                            <td key={`sum-1lf-avg-${p.short}`} className="px-3 py-2 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10.5px] border-r border-emerald-50 dark:border-emerald-955/10">
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* PKT 2LF */}
                    {activePkt2Lots.map((lot, idx) => (
                      <tr key={`sum-2lf-${lot.lot}`} className="hover:bg-emerald-50/10 dark:hover:bg-emerald-950/5 transition-all">
                        {idx === 0 && (
                          <td rowSpan={activePkt2Lots.length} className="px-3 py-2 font-black text-slate-850 dark:text-slate-200 align-middle text-center border-r border-emerald-100 dark:border-emerald-800 bg-slate-50/20 dark:bg-slate-900/10">
                            {lot.pkt}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center font-mono text-slate-900 dark:text-white text-[11px] border-r border-emerald-100 dark:border-emerald-805">{lot.lot}</td>
                        <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-extrabold border-r border-emerald-100 dark:border-emerald-805">BLOK {lot.blok}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500 border-r border-emerald-100 dark:border-emerald-805">{lot.luas.toFixed(4)}</td>
                        
                        {/* Periods calculation */}
                        {periods.map(p => {
                          const sumVal = sumFeldaLotPeriod(p.months, lot.lot);
                          const bgClass = p.type === 'suku' ? 'bg-emerald-50/5 dark:bg-emerald-950/5' : p.type === 'setengah' ? 'bg-amber-50/5 dark:bg-amber-950/5' : 'bg-violet-50/5 dark:bg-violet-950/5';
                          return (
                            <td key={p.short} className={`px-3 py-2 text-center font-mono font-black border-r border-emerald-50 dark:border-emerald-955/20 ${bgClass}`}>
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* PURATA PKT 2LF */}
                    {!searchQuery && (
                      <tr className="bg-emerald-50/30 dark:bg-emerald-900/10 border-y border-emerald-100 dark:border-emerald-800 font-extrabold">
                        <td colSpan={3} className="px-3 py-2 text-right font-black uppercase text-emerald-700 dark:text-emerald-400 border-r border-emerald-100 dark:border-emerald-800">JUMLAH PURATA 2LF</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-slate-700 dark:text-slate-200 border-r border-emerald-100 dark:border-emerald-800">{feldaStats.area2.toFixed(4)}</td>
                        {periods.map(p => {
                          const sumVal = sumFeldaPktPeriod(p.months, 'bbc2');
                          return (
                            <td key={`sum-2lf-avg-${p.short}`} className="px-3 py-2 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10.5px] border-r border-emerald-50 dark:border-emerald-955/10">
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* GRAND TOTAL */}
                    {!searchQuery && (
                      <tr className="bg-emerald-600 text-white dark:bg-emerald-700 font-extrabold text-[11px]">
                        <td colSpan={3} className="px-3 py-3 text-right font-black uppercase border-r border-emerald-500 dark:border-emerald-600">JUMLAH KAWASAN TERPAKAI (GRAND TOTAL)</td>
                        <td className="px-3 py-3 text-right font-mono font-black border-r border-emerald-500 dark:border-emerald-600">{feldaStats.totalArea.toFixed(4)}</td>
                        {periods.map(p => {
                          const sumVal = sumFeldaPktPeriod(p.months, 'overallBbc');
                          return (
                            <td key={`sum-grand-${p.short}`} className="px-3 py-3 text-center font-mono font-black border-r border-emerald-500/50 dark:border-emerald-600/50 bg-emerald-700/30">
                              {sumVal !== null ? sumVal.toFixed(2) : "-"} B/P
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* bbc Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-xl border border-slate-100 dark:border-slate-800">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-[14px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                   <Package size={16} />
                   Prestasi Sensus BBC 2026 (PKT 001 vs PKT 002)
                 </h3>
                 <button 
                  onClick={() => {
                    setNewBbcRecord({ month: "" });
                    setShowBBCModal(true);
                  }} 
                  className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95"
                 >
                    <Plus size={14} /> KEMASKINI
                 </button>
             </div>
             <p className="text-[11px] font-bold text-slate-400 mb-4 uppercase tracking-wider">Unjuran Sensus Purata Black Bunch Count (Kuntum Hitam terbit bagi sebatang pokok)</p>
             <div className="h-[300px] w-full mt-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={bbcDataState} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART_COLORS.gray, fontWeight: 700 }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: CHART_COLORS.gray }} dx={-10} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value) => Number(value).toFixed(2)} />
                     <Tooltip
                       contentStyle={{ backgroundColor: "var(--tw-prose-bg, white)", borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)", fontWeight: "bold", fontSize: "12px", color: "#1e293b" }}
                       itemStyle={{ fontWeight: 800 }}
                       formatter={(value: any) => [Number(value).toFixed(2), undefined]}
                     />
                     <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "20px" }} />
                     <Line type="monotone" dataKey="avg1" name="Purata PKT 001" stroke={CHART_COLORS.emerald} strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: CHART_COLORS.emerald }} activeDot={{ r: 8 }} />
                     <Line type="monotone" dataKey="avg2" name="Purata PKT 002" stroke={CHART_COLORS.gray} strokeWidth={4} dot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: CHART_COLORS.gray }} activeDot={{ r: 8 }} />
                     <Line type="monotone" dataKey="felda1" name="Purata FELDA 1LF" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#f59e0b" }} activeDot={{ r: 7 }} />
                     <Line type="monotone" dataKey="felda2" name="Purata FELDA 2LF" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#8b5cf6" }} activeDot={{ r: 7 }} />
                   </LineChart>
                 </ResponsiveContainer>
             </div>
          </div>

          {/* bbc Block history */}
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <TrendingUp size={120} />
            </div>
            
            <h3 className="text-[14px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 mb-6">
              <FileSpreadsheet size={16} />
              Rekod Purata Sensus BBC (B/P) - Sepanjang Tahun
            </h3>

            <div className="overflow-x-auto rounded-xl border border-emerald-100 dark:border-emerald-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f0fdf4] dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider text-[9px] border-b border-emerald-100 dark:border-emerald-800/80">
                  <tr>
                    <th className="px-4 py-3 border-b border-emerald-100 dark:border-emerald-800">PKT</th>
                    <th className="px-4 py-3 border-b border-emerald-100 dark:border-emerald-800">Blok</th>
                    {tableColumns.map(col => {
                      if (col.type === 'month') {
                        return (
                          <th key={col.id} className="px-4 py-3 border-b border-emerald-100 dark:border-emerald-800 text-center min-w-[70px]">
                            {col.label}
                          </th>
                        );
                      } else {
                        const bgClass = col.typeBg === 'suku' 
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold' 
                          : col.typeBg === 'setengah' 
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold' 
                            : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 font-extrabold';
                        return (
                          <th key={col.id} className={`px-3 py-3 border-b border-emerald-100 dark:border-emerald-800 text-center min-w-[95px] ${bgClass}`}>
                            {col.label}<br/>
                            <span className="text-[7.5px] font-bold text-slate-500 dark:text-slate-400 normal-case">({col.desc})</span>
                          </th>
                        );
                      }
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 dark:divide-emerald-800/50 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {/* PKT 001 */}
                  {Array.from({length: 17}, (_, i) => String(i + 1)).map(blok => (
                    <tr key={blok} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors">
                      {blok === "1" && <td rowSpan={17} className="px-4 py-2 border-r border-emerald-100 dark:border-emerald-800 text-center align-top pt-4">001</td>}
                      <td className="px-4 py-2 border-r border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-500">{blok}</td>
                      {tableColumns.map(col => {
                        if (col.type === "month") {
                          const d = bbcDataState.find(row => row.month === col.monthKey);
                          const val = d ? d[blok] : null;
                          return (
                            <td key={col.id} className="px-4 py-2 text-center text-slate-600 dark:text-slate-400 font-mono">
                              {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                            </td>
                          );
                        } else {
                          const sumVal = sumBlockPeriod(col.months || [], blok);
                          const bgClass = col.typeBg === 'suku' 
                            ? 'bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 font-bold' 
                            : col.typeBg === 'setengah' 
                              ? 'bg-amber-500/5 text-amber-800 dark:text-amber-300 font-bold' 
                              : 'bg-violet-500/5 text-violet-800 dark:text-violet-300 font-bold';
                          return (
                            <td key={col.id} className={`px-4 py-2 text-center font-mono font-black border-r border-emerald-50 dark:border-emerald-955/20 ${bgClass}`}>
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        }
                      })}
                    </tr>
                  ))}
                  <tr className="bg-emerald-500 text-white dark:bg-emerald-600 shadow-sm relative z-10 border-t border-emerald-400">
                    <td colSpan={2} className="px-4 py-3 font-black text-right border-r border-emerald-400 dark:border-emerald-500 uppercase flex-1 whitespace-nowrap">Purata PKT 001</td>
                    {tableColumns.map(col => {
                      if (col.type === "month") {
                        const d = bbcDataState.find(row => row.month === col.monthKey);
                        const val = d ? d.avg1 : null;
                        return (
                          <td key={`avg1-${col.id}`} className="px-4 py-3 text-center font-black font-mono">
                            {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                          </td>
                        );
                      } else {
                        const sumVal = sumBlockStatePeriod(col.months || [], 'avg1');
                        return (
                          <td key={`state-avg1-${col.id}`} className="px-4 py-3 text-center font-black font-mono bg-emerald-600/30 border-r border-emerald-500">
                            {sumVal !== null ? sumVal.toFixed(2) : "-"}
                          </td>
                        );
                      }
                    })}
                  </tr>
                  <tr className="bg-amber-500 text-white dark:bg-amber-600 shadow-sm relative z-10 border-t border-amber-400">
                    <td colSpan={2} className="px-4 py-3 font-black text-right border-r border-amber-400 dark:border-amber-500 uppercase flex-1 whitespace-nowrap">Purata FELDA 1LF</td>
                    {tableColumns.map(col => {
                      if (col.type === "month") {
                        const d = bbcDataState.find(row => row.month === col.monthKey);
                        const val = d ? d.felda1 : null;
                        return (
                          <td key={`felda1-${col.id}`} className="px-4 py-3 text-center font-black font-mono">
                            {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                          </td>
                        );
                      } else {
                        const sumVal = sumBlockStatePeriod(col.months || [], 'felda1');
                        return (
                          <td key={`state-felda1-${col.id}`} className="px-4 py-3 text-center font-black font-mono bg-amber-600/30 border-r border-emerald-500">
                            {sumVal !== null ? sumVal.toFixed(2) : "-"}
                          </td>
                        );
                      }
                    })}
                  </tr>
                  
                  {/* PKT 002 */}
                  {Array.from({length: 5}, (_, i) => String(i + 18)).map(blok => (
                    <tr key={blok} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors">
                      {blok === "18" && <td rowSpan={5} className="px-4 py-2 border-r border-emerald-100 dark:border-emerald-800 text-center align-top pt-4">002</td>}
                      <td className="px-4 py-2 border-r border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-500">{blok}</td>
                      {tableColumns.map(col => {
                        if (col.type === "month") {
                          const d = bbcDataState.find(row => row.month === col.monthKey);
                          const val = d ? d[blok] : null;
                          return (
                            <td key={col.id} className="px-4 py-2 text-center text-slate-600 dark:text-slate-400 font-mono">
                              {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                            </td>
                          );
                        } else {
                          const sumVal = sumBlockPeriod(col.months || [], blok);
                          const bgClass = col.typeBg === 'suku' 
                            ? 'bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 font-bold' 
                            : col.typeBg === 'setengah' 
                              ? 'bg-amber-500/5 text-amber-800 dark:text-amber-300 font-bold' 
                              : 'bg-violet-500/5 text-violet-800 dark:text-violet-300 font-bold';
                          return (
                            <td key={col.id} className={`px-4 py-2 text-center font-mono font-black border-r border-emerald-50 dark:border-emerald-955/20 ${bgClass}`}>
                              {sumVal !== null ? sumVal.toFixed(2) : "-"}
                            </td>
                          );
                        }
                      })}
                    </tr>
                  ))}
                  <tr className="bg-emerald-500 text-white dark:bg-emerald-600 shadow-sm relative z-10 border-t border-emerald-400">
                    <td colSpan={2} className="px-4 py-3 font-black text-right border-r border-emerald-400 dark:border-emerald-500 uppercase whitespace-nowrap">Purata PKT 002</td>
                    {tableColumns.map(col => {
                      if (col.type === "month") {
                        const d = bbcDataState.find(row => row.month === col.monthKey);
                        const val = d ? d.avg2 : null;
                        return (
                          <td key={`avg2-${col.id}`} className="px-4 py-3 text-center font-black font-mono">
                            {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                          </td>
                        );
                      } else {
                        const sumVal = sumBlockStatePeriod(col.months || [], 'avg2');
                        return (
                          <td key={`state-avg2-${col.id}`} className="px-4 py-3 text-center font-black font-mono bg-emerald-600/30 border-r border-emerald-500">
                            {sumVal !== null ? sumVal.toFixed(2) : "-"}
                          </td>
                        );
                      }
                    })}
                  </tr>
                  <tr className="bg-violet-600 text-white dark:bg-violet-700 shadow-sm relative z-10 border-t border-violet-500">
                    <td colSpan={2} className="px-4 py-3 font-black text-right border-r border-violet-500 dark:border-violet-600 uppercase whitespace-nowrap">Purata FELDA 2LF</td>
                    {tableColumns.map(col => {
                      if (col.type === "month") {
                        const d = bbcDataState.find(row => row.month === col.monthKey);
                        const val = d ? d.felda2 : null;
                        return (
                          <td key={`felda2-${col.id}`} className="px-4 py-3 text-center font-black font-mono">
                            {val !== null && val !== undefined ? val.toFixed(2) : "-"}
                          </td>
                        );
                      } else {
                        const sumVal = sumBlockStatePeriod(col.months || [], 'felda2');
                        return (
                          <td key={`state-felda2-${col.id}`} className="px-4 py-3 text-center font-black font-mono bg-violet-600/30 border-r border-emerald-500">
                            {sumVal !== null ? sumVal.toFixed(2) : "-"}
                          </td>
                        );
                      }
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>


        </div>
      )}

      {/* Main Block bbc Update Modal */}
      {showBBCModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Package size={16} className="text-emerald-500" />
                Tambah / Kemaskini Data Sensus BBC Block
              </h3>
              <button onClick={() => setShowBBCModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 transition-colors active:scale-95">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Bulan</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={newBbcRecord.month || ""}
                  onChange={(e) => {
                    const selectedMonth = e.target.value;
                    const updatedRecord: any = { month: selectedMonth };
                    const existingMonthData = bbcHistory[selectedMonth];
                    for (let i = 1; i <= 22; i++) {
                      const blokStr = String(i);
                      if (existingMonthData && existingMonthData[blokStr] && existingMonthData[blokStr].length > 0) {
                        updatedRecord[blokStr] = existingMonthData[blokStr].join(", ");
                      } else {
                        updatedRecord[blokStr] = "";
                      }
                    }
                    setNewBbcRecord(updatedRecord);
                  }}
                >
                  <option value="" disabled>Pilih Bulan</option>
                  <option value="Jan">Januari</option>
                  <option value="Feb">Februari</option>
                  <option value="Mac">Mac</option>
                  <option value="Apr">April</option>
                  <option value="Mei">Mei</option>
                  <option value="Jun">Jun</option>
                  <option value="Jul">Julai</option>
                  <option value="Ogo">Ogos</option>
                  <option value="Sep">September</option>
                  <option value="Okt">Oktober</option>
                  <option value="Nov">November</option>
                  <option value="Dis">Disember</option>
                </select>
              </div>

              {newBbcRecord.month && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Data PKT 001 (Blok 1-17)</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {Array.from({length: 17}, (_, i) => String(i + 1)).map(blok => (
                        <div key={blok}>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Blok {blok}</label>
                          <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                            value={newBbcRecord[blok] || ""}
                            placeholder="e.g. 2.15"
                            onChange={(e) => setNewBbcRecord({ ...newBbcRecord, [blok]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mt-4">Data PKT 002 (Blok 18-22)</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {Array.from({length: 5}, (_, i) => String(i + 18)).map(blok => (
                        <div key={blok}>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Blok {blok}</label>
                          <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                            value={newBbcRecord[blok] || ""}
                            placeholder="e.g. 1.85"
                            onChange={(e) => setNewBbcRecord({ ...newBbcRecord, [blok]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                disabled={!newBbcRecord.month}
                onClick={() => {
                    if (!newBbcRecord.month) {
                      return;
                    }
                    const month = newBbcRecord.month;
                    
                    setBbcHistory(prev => {
                        const newState = { ...prev };
                        if (!newState[month]) {
                            newState[month] = {};
                            for(let i=1; i<=22; i++) newState[month][i] = [];
                        } else {
                            newState[month] = { ...newState[month] };
                        }
                        
                        for (let i = 1; i <= 22; i++) {
                            const blokStr = String(i);
                            const valStr = newBbcRecord[blokStr] !== undefined && newBbcRecord[blokStr] !== null ? String(newBbcRecord[blokStr]).trim() : "";
                            if (valStr !== "") {
                                const parts = valStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                                newState[month][blokStr] = parts;
                            } else {
                                newState[month][blokStr] = [];
                            }
                        }
                        return newState;
                    });
                    
                    setShowBBCModal(false);
                    setNewBbcRecord({ month: "" });
                }}
                className={`flex-1 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all active:scale-95 ${
                  newBbcRecord.month 
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30" 
                    : "bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-450 shadow-none"
                }`}
              >
                Simpan Data
              </button>
              <button
                onClick={() => setShowBBCModal(false)}
                className="px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-750 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FELDA Lot BBC Update Modal */}
      {showFeldaBBCModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-500" />
                Tambah / Kemaskini Data Sensus BBC Lot FELDA
              </h3>
              <button onClick={() => setShowFeldaBBCModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 transition-colors active:scale-95">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Bulan</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={newFeldaBbcRecord.month || ""}
                  onChange={(e) => {
                    const selectedMonth = e.target.value;
                    const updatedRecord: any = { month: selectedMonth };
                    const existingMonthData = feldaBbcHistory[selectedMonth] || {};
                    feldaLots.forEach(lot => {
                      updatedRecord[lot.lot] = existingMonthData[lot.lot] !== undefined && existingMonthData[lot.lot] !== null ? String(existingMonthData[lot.lot]) : "";
                    });
                    setNewFeldaBbcRecord(updatedRecord);
                  }}
                >
                  <option value="" disabled>Pilih Bulan</option>
                  <option value="Jan">Januari</option>
                  <option value="Feb">Februari</option>
                  <option value="Mac">Mac</option>
                  <option value="Apr">April</option>
                  <option value="Mei">Mei</option>
                  <option value="Jun">Jun</option>
                  <option value="Jul">Julai</option>
                  <option value="Ogo">Ogos</option>
                  <option value="Sep">September</option>
                  <option value="Okt">Oktober</option>
                  <option value="Nov">November</option>
                  <option value="Dis">Disember</option>
                </select>
              </div>

              {newFeldaBbcRecord.month && (
                <>
                  <div className="space-y-4">
                     <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">KEMASUKAN DATA LOT (PKT 1LF)</h4>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                       {feldaLots.filter(l => l.pkt === "1LF").map(lot => (
                         <div key={lot.lot} className="bg-slate-50/50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                           <span className="block text-[10px] font-black text-slate-850 dark:text-white">LOT {lot.lot}</span>
                           <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">BLOK {lot.blok} ({lot.luas.toFixed(2)} HA)</span>
                           <input
                             type="number"
                             step="0.01"
                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                             value={newFeldaBbcRecord[lot.lot] || ""}
                             placeholder="-"
                             onChange={(e) => setNewFeldaBbcRecord({ ...newFeldaBbcRecord, [lot.lot]: e.target.value })}
                           />
                         </div>
                       ))}
                     </div>
                  </div>

                  <div className="space-y-4 mt-6">
                     <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">KEMASUKAN DATA LOT (PKT 2LF)</h4>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                       {feldaLots.filter(l => l.pkt === "2LF").map(lot => (
                         <div key={lot.lot} className="bg-slate-50/50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                           <span className="block text-[10px] font-black text-slate-850 dark:text-white">LOT {lot.lot}</span>
                           <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">BLOK {lot.blok} ({lot.luas.toFixed(2)} HA)</span>
                           <input
                             type="number"
                             step="0.01"
                             className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                             value={newFeldaBbcRecord[lot.lot] || ""}
                             placeholder="-"
                             onChange={(e) => setNewFeldaBbcRecord({ ...newFeldaBbcRecord, [lot.lot]: e.target.value })}
                           />
                         </div>
                       ))}
                     </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                disabled={!newFeldaBbcRecord.month}
                onClick={() => {
                    if (!newFeldaBbcRecord.month) {
                      return;
                    }
                    const month = newFeldaBbcRecord.month;
                    
                    setFeldaBbcHistory(prev => {
                      const newState = { ...prev };
                      if (!newState[month]) {
                        newState[month] = {};
                      } else {
                        newState[month] = { ...newState[month] };
                      }
                      
                      feldaLots.forEach(lot => {
                        const valStr = newFeldaBbcRecord[lot.lot] !== undefined && newFeldaBbcRecord[lot.lot] !== null ? String(newFeldaBbcRecord[lot.lot]).trim() : "";
                        if (valStr !== "") {
                          const val = parseFloat(valStr);
                          newState[month][lot.lot] = isNaN(val) ? null : val;
                        } else {
                          newState[month][lot.lot] = null;
                        }
                      });
                      
                      return newState;
                    });
                    
                    setShowFeldaBBCModal(false);
                    setNewFeldaBbcRecord({ month: "" });
                }}
                className={`flex-1 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all active:scale-95 ${
                  newFeldaBbcRecord.month 
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30" 
                    : "bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-450 shadow-none"
                }`}
              >
                Simpan Data
              </button>
              <button
                onClick={() => setShowFeldaBBCModal(false)}
                className="px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const BbcView = React.memo(BbcViewComponent);

