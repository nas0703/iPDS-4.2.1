import React, { useState, useEffect, useRef, useCallback } from "react";
import { Transaction } from "../types";
import { supabase, updateSupabaseClient, isSupabaseReady } from "../services/supabaseClient";
import { HISTORICAL_BLOCK_YIELDS } from "../utils/historicalYieldData";
import { parseReceiptWithGemini, detectEstateFromSeller } from "../features/input/services/ocrService";
import { offlineStore } from "../utils/offlineStore";
import { getActiveEstateId, ESTATE_CHANGED_EVENT, inferEstateFromReceipt } from "../utils/estateContext";
import { ESTATES_REGISTRY, getEstateConfig } from "../config/estateRegistry";
import { generateAdelaBaselineTransactions } from "../data/adelaBaselineDeliveries";
import { getTodayDateString, normalizeDateToISO, getDaysDifferenceFromToday, cleanAndExtractBlockCode, extractBtsSerialDetails } from "../utils/formatters";

export function normalizeSingleTransaction(item: any): Transaction {
  const rawBlok = String(item.blok || "").trim();
  const extractedBlok = cleanAndExtractBlockCode(rawBlok);
  let cleanBlok = extractedBlok;
  
  if (extractedBlok) {
    const upper = extractedBlok.toUpperCase();
    if (upper === "LF" || upper === "F88" || upper === "88F" || upper === "88 F") {
      cleanBlok = "88F";
    } else if (["1F", "2F", "125Y", "128Y", "121V", "88F"].includes(upper)) {
      cleanBlok = upper;
    } else {
      const num = parseInt(extractedBlok.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num)) {
        cleanBlok = num.toString();
      }
    }
  }

  const isEfb =
    item.is_efb === true ||
    String(item.peringkat || "").toUpperCase().trim() === "EFB" ||
    cleanBlok.toUpperCase() === "EFB" ||
    String(item.no_resit || "").toUpperCase().startsWith("EFB");

  if (isEfb && (!cleanBlok || cleanBlok.toUpperCase() === "EFB")) {
    cleanBlok = "EFB";
  }

  let normalizedDate = "";
  if (item.tarikh) {
    const dateStr = String(item.tarikh).trim();
    const datePart = dateStr.split(/[T ]/)[0];
    const separator = datePart.includes("-") ? "-" : datePart.includes("/") ? "/" : "";
    if (separator) {
      const parts = datePart.split(separator);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          normalizedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else if (parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    } else if (datePart.length === 8 && !isNaN(Number(datePart))) {
      normalizedDate = `${datePart.substring(0, 4)}-${datePart.substring(4, 6)}-${datePart.substring(6, 8)}`;
    }
  }

  if (!normalizedDate && item.created_at) {
    const myT = new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000);
    normalizedDate = myT.toISOString().split("T")[0];
  }

  const rawTanVal = item.tan ?? item.ton ?? item.berat_bersih ?? item.nett_weight ?? item.berat ?? item.mt ?? 0;
  const rawTan = String(rawTanVal).trim().replace(",", ".");
  const cleanTan = parseFloat(rawTan.replace(/[^0-9.]/g, "")) || 0;

  const rawMudaVal = item.muda ?? item.buah_muda ?? 0;
  const rawMuda = String(rawMudaVal).trim().replace(",", ".");
  const cleanMuda = parseFloat(rawMuda.replace(/[^0-9.]/g, "")) || 0;

  const cleanReject = parseFloat(String(item.reject ?? item.buah_reject ?? "0").replace(",", ".")) || 0;
  const cleanSample = parseInt(String(item.sample ?? item.sample_count ?? "0"), 10) || 0;
  const cleanRmMt = parseFloat(String(item.rm_mt ?? item.harga ?? item.price ?? "0").replace(",", ".")) || 0;
  const cleanHasilRm =
    parseFloat(String(item.hasil_rm ?? item.total_rm ?? "0").replace(",", ".")) ||
    (cleanTan * cleanRmMt);

  const detectedEstate = inferEstateFromReceipt(item);
  const estateCfg = getEstateConfig(detectedEstate);

  // Check explicit or inferred Peringkat 2
  let rawBlokUpper = String(cleanBlok || "").toUpperCase().trim();
  let isPkt2Explicit = false;
  if (rawBlokUpper.startsWith("P2-") || rawBlokUpper.startsWith("P2 ") || rawBlokUpper.startsWith("PKT 2") || rawBlokUpper.startsWith("PKT2")) {
    isPkt2Explicit = true;
    cleanBlok = rawBlokUpper.replace(/^(?:P2|PKT\s*2)[-\s:]*/i, "").trim();
    rawBlokUpper = cleanBlok.toUpperCase();
  } else if (rawBlokUpper.startsWith("P1-") || rawBlokUpper.startsWith("P1 ") || rawBlokUpper.startsWith("PKT 1") || rawBlokUpper.startsWith("PKT1")) {
    cleanBlok = rawBlokUpper.replace(/^(?:P1|PKT\s*1)[-\s:]*/i, "").trim();
    rawBlokUpper = cleanBlok.toUpperCase();
  }

  const pUpper = String(item.peringkat || "").toUpperCase();
  const kpUpper = String(item.kod_penjual || "").toUpperCase();
  const kaUpper = String(item.kod_akaun_bts || "").toUpperCase();
  const npUpper = String(item.nama_penjual || "").toUpperCase();

  const has020 =
    kpUpper.includes("-020-") ||
    kaUpper.includes("-020-") ||
    /[-_]020[-_]/.test(kpUpper) ||
    /[-_]020[-_]/.test(kaUpper) ||
    /\b\d{4}-020-/.test(kpUpper) ||
    /\b\d{4}-020-/.test(kaUpper) ||
    /\b020\b/.test(kaUpper);

  const isPkt2 = isPkt2Explicit ||
    pUpper.includes("002") || pUpper.includes("PKT 2") || pUpper.includes("PKT2") || pUpper.includes("PERINGKAT 2") ||
    has020 ||
    npUpper.includes("PKT 2") || npUpper.includes("PERINGKAT 2");

  let peringkat = item.peringkat;

  if (cleanBlok === "EFB" || item.is_efb) {
    peringkat = "EFB";
  } else if (detectedEstate === 'FPM_ADELA') {
    const isAdelaFelda = 
      cleanBlok === "88F" || cleanBlok === "88" || cleanBlok === "F88" || cleanBlok === "LF" || cleanBlok === "1F" || cleanBlok === "2F" ||
      cleanBlok.toUpperCase().includes("F") ||
      kpUpper.includes("001") || kaUpper.includes("001") || kpUpper.includes("88F") || kaUpper.includes("88F") ||
      pUpper.includes("003") || pUpper.includes("FELDA");

    if (isAdelaFelda) {
      peringkat = "LOT FELDA";
      if (cleanBlok === "88" || cleanBlok === "F88" || cleanBlok === "LF" || cleanBlok === "88 F") {
        cleanBlok = "88F";
      }
    } else {
      const digitsOnly = cleanBlok.replace(/[^0-9]/g, '');
      const bNum = digitsOnly ? parseInt(digitsOnly, 10) : NaN;
      if (isPkt2) {
        peringkat = "PKT 002";
        if (!isNaN(bNum) && bNum >= 1 && bNum <= 6) {
          cleanBlok = String(bNum + 11); // Map to internal block IDs 12-17
        } else if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          cleanBlok = String(bNum);
        }
      } else {
        if (!isNaN(bNum) && bNum >= 12 && bNum <= 17) {
          peringkat = "PKT 002";
          cleanBlok = String(bNum);
        } else if (!isNaN(bNum) && bNum >= 1 && bNum <= 11) {
          peringkat = "PKT 001";
          cleanBlok = String(bNum);
        } else if (cleanBlok.toUpperCase().includes("Y") || cleanBlok.toUpperCase().includes("V")) {
          peringkat = "PKT 004";
        } else {
          peringkat = "PKT 001";
        }
      }
    }
  } else {
    // Other estates (e.g. Tunggal, Kledang, Sening)
    if (!peringkat || peringkat === "undefined") {
      if (estateCfg?.blocks && estateCfg.blocks[cleanBlok]?.pkt) {
        const pktCode = estateCfg.blocks[cleanBlok].pkt;
        peringkat = pktCode === "001" ? "PKT 001" : pktCode === "002" ? "PKT 002" : pktCode === "003" ? "LOT FELDA" : pktCode === "004" ? "PKT 004" : `PKT ${pktCode}`;
      } else {
        const bNum = parseInt(cleanBlok.replace(/[^0-9]/g, ''), 10);
        if (bNum >= 1 && bNum <= 17) peringkat = "PKT 001";
        else if (bNum >= 18 && bNum <= 22) peringkat = "PKT 002";
        else if (bNum === 88 || cleanBlok.toUpperCase() === "LF") peringkat = "LOT FELDA";
        else peringkat = "PKT 001";
      }
    }
  }

  const rawKpg = String(item.kpg || "").trim().replace(",", ".");
  const cleanKpg = rawKpg.replace(/[^0-9.]/g, "");
  const rawKpa = String(item.kpa ?? "").trim().replace(",", ".");
  const cleanKpa = rawKpa ? parseFloat(rawKpa.replace(/[^0-9.]/g, "")) : undefined;

  const todayIso = new Date().toISOString().split("T")[0];

  return {
    ...item,
    estate_id: detectedEstate,
    tan: cleanTan,
    muda: cleanMuda,
    kpg: cleanKpg,
    kpa: cleanKpa,
    blok: cleanBlok,
    peringkat: peringkat || "PKT 001",
    tarikh: normalizedDate.trim() || todayIso,
    no_resit: String(item.no_resit || item.receipt_no || item.id || `REC-${Math.random().toString(36).substr(2, 6)}`),
    no_lori: String(item.no_lori || item.lorry_no || "-"),
    no_akaun_terima: item.no_akaun_terima || "",
    reject: cleanReject,
    sample: cleanSample,
    rm_mt: cleanRmMt,
    hasil_rm: parseFloat(cleanHasilRm.toFixed(2)),
  };
}

export const INITIAL_FORM_DATA = {
  no_resit: "",
  no_akaun_terima: "",
  no_lori: "",
  no_seal: "",
  no_nota_hantaran: "",
  kpg: "",
  kpa: "",
  blok: "",
  peringkat: "",
  tan: "",
  muda: "",
  reject: "0.00",
  sample: "0",
  rm_mt: "",
  tarikh: "",
  masa_masuk: "",
  estate_id: "",
  kod_penjual: "",
  nama_penjual: "",
  kod_projek: "",
  kod_akaun_bts: "",
  is_efb: false,
  is_baja: false,
  is_pruning: false,
  is_hujan: false,
  is_meracun: false,
};

interface UseTransactionStateProps {
  authRole: string | null;
  setActiveTab: (tab: "scan" | "dashboard" | "sejarah" | "ai_executive") => void;
  setDashboardDate: (date: any) => void;
  setHistoryFilterDate: (date: string) => void;
  setShowUserMenu: (show: boolean) => void;
}

export function useTransactionState({
  authRole,
  setActiveTab,
  setDashboardDate,
  setHistoryFilterDate,
  setShowUserMenu,
}: UseTransactionStateProps) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [rawData, setRawData] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const estateId = getActiveEstateId();
        const cached = localStorage.getItem(`ipds_rawdata_cache_${estateId}`) || 
          (estateId === 'FPM_TUNGGAL' ? localStorage.getItem("ipds_rawdata_cache") : null);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const isRegion = estateId === 'ALL' || estateId === 'WILAYAH_JB' || estateId === 'WJB' || estateId === '0001';
            const valid = parsed
              .map((r: any) => normalizeSingleTransaction(r))
              .filter((r: any) => isRegion || r.estate_id === estateId);
            if (estateId === 'FPM_ADELA' || isRegion) {
              const baseline = generateAdelaBaselineTransactions();
              const baselineMap = new Map(baseline.map(b => [String(b.no_resit).toUpperCase(), b]));
              const seen = new Set<string>();
              const updatedValid = valid.map((r: any) => {
                const k = String(r.no_resit || '').toUpperCase();
                if (baselineMap.has(k)) {
                  seen.add(k);
                  return { ...r, ...baselineMap.get(k) };
                }
                return r;
              });
              const missing = baseline.filter(b => !seen.has(String(b.no_resit || '').toUpperCase()));
              return [...updatedValid, ...missing];
            }
            return valid;
          }
        }
        if (estateId === 'FPM_ADELA') {
          return generateAdelaBaselineTransactions();
        }
      } catch (_) {}
    }
    return [];
  });
  const [blockAnnualData, setBlockAnnualData] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const estateId = getActiveEstateId();
        const isTunggal = estateId === 'FPM_TUNGGAL';
        const cached = localStorage.getItem(`ipds_blockyields_cache_${estateId}`) || (isTunggal ? localStorage.getItem("ipds_blockyields_cache") : null);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
        if (isTunggal) {
          return HISTORICAL_BLOCK_YIELDS;
        }
        return [];
      } catch (_) {}
    }
    const estateId = getActiveEstateId();
    return estateId === 'FPM_TUNGGAL' ? HISTORICAL_BLOCK_YIELDS : [];
  });

  // Rehydrate cache from IndexedDB if initial state from localStorage was empty
  useEffect(() => {
    let isMounted = true;
    async function rehydrateFromIndexedDB() {
      const estateId = getActiveEstateId();
      if (rawData.length === 0) {
        try {
          const cachedRawData = await offlineStore.getItem<any[]>(`ipds_rawdata_cache_${estateId}`, []);
          if (isMounted && Array.isArray(cachedRawData) && cachedRawData.length > 0) {
            console.log('[iPDS Cache] Rehydrated rawData from IndexedDB for', estateId);
            setRawData(cachedRawData);
          }
        } catch (e) {
          console.warn('[iPDS Cache] IndexedDB rawData rehydration error:', e);
        }
      }
      if (blockAnnualData.length === 0) {
        try {
          const cachedYields = await offlineStore.getItem<any[]>(`ipds_blockyields_cache_${estateId}`, []);
          if (isMounted && Array.isArray(cachedYields) && cachedYields.length > 0) {
            setBlockAnnualData(cachedYields);
          }
        } catch (e) {
          console.warn('[iPDS Cache] IndexedDB blockYields rehydration error:', e);
        }
      }
    }
    rehydrateFromIndexedDB();
    return () => { isMounted = false; };
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Date Discrepancy Verification Modal state for OCR Scans
  const [showDateVerificationModal, setShowDateVerificationModal] = useState(false);
  const [pendingOcrVerification, setPendingOcrVerification] = useState<{
    detectedDate: string;
    receiptInfo: any;
    extractedData: any;
  } | null>(null);

  const [configStatus, setConfigStatus] = useState<{
    supabase: boolean;
    googleSheets: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((arg1: any, arg2?: any) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    let type: "success" | "error" = "success";
    let msg = "";

    const validTypes = ["success", "error", "info", "warning"];

    if (typeof arg1 === "string" && validTypes.includes(arg1.toLowerCase())) {
      type = arg1.toLowerCase() === "error" ? "error" : "success";
      msg = typeof arg2 === "string" ? arg2 : arg1;
    } else if (typeof arg2 === "string" && validTypes.includes(arg2.toLowerCase())) {
      type = arg2.toLowerCase() === "error" ? "error" : "success";
      msg = typeof arg1 === "string" ? arg1 : arg2;
    } else {
      msg = typeof arg1 === "string" ? arg1 : (typeof arg2 === "string" ? arg2 : String(arg1 || ""));
      type = "success";
    }

    // Secondary check: If message contains success keywords, force type to success
    const lowerMsg = msg.toLowerCase();
    if (
      lowerMsg.includes("berjaya") ||
      lowerMsg.includes("success") ||
      lowerMsg.includes("ditukar") ||
      lowerMsg.includes("disimpan") ||
      lowerMsg.includes("dikemaskini") ||
      lowerMsg.includes("disegerakkan") ||
      lowerMsg.includes("sambung")
    ) {
      type = "success";
    }

    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const safeFetch = async (
    url: string,
    options?: RequestInit,
    retries = 2
  ): Promise<any> => {
    try {
      const activeEstate = getActiveEstateId();
      const token = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ipds_token') : null) ||
                    (typeof localStorage !== 'undefined' ? localStorage.getItem('ipds_token') : null);
      const role = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ipds_auth_role') : null) ||
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('ipds_auth_role') : null);

      const defaultOptions: RequestInit = {
        credentials: "include",
        ...options,
        headers: {
          "x-estate-id": activeEstate,
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(role ? { "x-auth-role": role } : {}),
          ...(options?.headers || {}),
        }
      };

      const res = await fetch(url, defaultOptions);
      const contentType = res.headers.get("content-type");

      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(text || `Ralat pelayan (${res.status})`);
        }
        return text;
      }

      if (!res.ok) {
        const errObj: any = new Error(
          data?.error || data?.message || `Ralat pelayan (${res.status})`
        );
        errObj.status = res.status;
        errObj.data = data;
        errObj.isServerRejection = true;
        throw errObj;
      }
      return data;
    } catch (e: any) {
      if (
        retries > 0 &&
        (e.message?.includes("fetch") || e.name === "TypeError")
      ) {
        console.warn(`Fetch failed, retrying... (${retries} left)`, e);
        await new Promise((r) => setTimeout(r, 800));
        return safeFetch(url, options, retries - 1);
      }
      throw e;
    }
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) showToast("success", "Mengambil data terbaru...");

      const activeEstate = getActiveEstateId();
      let [data, blockYields] = await Promise.all([
        safeFetch(`/api/hantaran?estate_id=${encodeURIComponent(activeEstate)}`).catch(() => null),
        safeFetch(`/api/block-annual-yields?estate_id=${encodeURIComponent(activeEstate)}`).catch(() => null),
      ]);

      // Direct Client-Side Supabase Fallback ONLY if server route completely failed (data is null)
      if (data === null && isSupabaseReady()) {
        try {
          let allSbRecords: any[] = [];
          let start = 0;
          const limit = 1000;
          let hasMore = true;
          const isAll = activeEstate === 'ALL' || activeEstate === 'WILAYAH_JB' || activeEstate === 'WJB' || activeEstate === '0001';

          while (hasMore) {
            let query = supabase
              .from('hantaran_hasil')
              .select('*')
              .order('tarikh', { ascending: false })
              .order('created_at', { ascending: false });

            if (!isAll) {
              query = query.eq('estate_id', activeEstate);
            }

            const { data: sbRecords, error: sbErr } = await query.range(start, start + limit - 1);

            if (sbErr && !isAll) {
              hasMore = false;
              break;
            }

            if (!sbErr && Array.isArray(sbRecords) && sbRecords.length > 0) {
              allSbRecords = allSbRecords.concat(sbRecords);
              if (sbRecords.length < limit) {
                hasMore = false;
              } else {
                start += limit;
              }
            } else {
              hasMore = false;
            }
          }

          if (allSbRecords.length > 0) {
            data = allSbRecords;
          }
        } catch (sbEx) {
          console.warn("Direct Supabase fetch fallback error:", sbEx);
        }
      }

      if (Array.isArray(data)) {
        const isAll = activeEstate === 'ALL' || activeEstate === 'WILAYAH_JB' || activeEstate === 'WJB' || activeEstate === '0001';
        let parsedData = data
          .map((item: any) => normalizeSingleTransaction(item))
          .filter((item: any) => isAll || item.estate_id === activeEstate);

        if (activeEstate === 'FPM_ADELA' || isAll) {
          const baseline = generateAdelaBaselineTransactions();
          const baselineMap = new Map(baseline.map(b => [String(b.no_resit).toUpperCase(), b]));
          const seen = new Set<string>();
          const updatedParsed = parsedData.map((r: any) => {
            const k = String(r.no_resit || '').toUpperCase();
            if (baselineMap.has(k)) {
              seen.add(k);
              return { ...r, ...baselineMap.get(k) };
            }
            return r;
          });
          const missing = baseline.filter(b => !seen.has(String(b.no_resit || '').toUpperCase()));
          parsedData = [...updatedParsed, ...missing];
        }

        setRawData(parsedData);
        try {
          localStorage.setItem(`ipds_rawdata_cache_${activeEstate}`, JSON.stringify(parsedData));
          offlineStore.setItem(`ipds_rawdata_cache_${activeEstate}`, parsedData);
        } catch (_) {}
      } else {
        // Keep cached data if server failed to return array
        try {
          const cached = localStorage.getItem(`ipds_rawdata_cache_${activeEstate}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const isRegion = activeEstate === 'ALL' || activeEstate === 'WILAYAH_JB' || activeEstate === 'WJB' || activeEstate === '0001';
              const valid = parsed
                .map((item: any) => normalizeSingleTransaction(item))
                .filter((item: any) => isRegion || item.estate_id === activeEstate);
              setRawData(valid);
              return;
            }
          }
        } catch (_) {}
        setRawData([]);
      }

      if (Array.isArray(blockYields) && blockYields.length > 0) {
        setBlockAnnualData(blockYields);
      } else if (activeEstate === 'FPM_TUNGGAL') {
        setBlockAnnualData(HISTORICAL_BLOCK_YIELDS);
        if (typeof navigator !== 'undefined' && navigator.onLine && (authRole === 'pf' || authRole === 'fc')) {
          seedHistoricalData();
        }
      } else {
        setBlockAnnualData([]);
      }
    } catch (e: any) {
      console.error("Fetch error:", e);
    }
  };

  // Synchronize rawData cache to LocalStorage and IndexedDB for instant app rehydration & offline support
  useEffect(() => {
    const estateId = getActiveEstateId();
    if (rawData && rawData.length > 0) {
      const isConsistent = rawData.every((item: any) => {
        if (estateId === 'ALL') return true;
        return item.estate_id === estateId || inferEstateFromReceipt(item) === estateId;
      });
      if (isConsistent) {
        try {
          localStorage.setItem(`ipds_rawdata_cache_${estateId}`, JSON.stringify(rawData));
          offlineStore.setItem(`ipds_rawdata_cache_${estateId}`, rawData);
        } catch (e) {
          console.warn("Failed to cache rawData to storage:", e);
        }
      }
    }
  }, [rawData]);

  // Synchronize blockAnnualData cache to LocalStorage and IndexedDB
  useEffect(() => {
    const estateId = getActiveEstateId();
    if (blockAnnualData && blockAnnualData.length > 0) {
      try {
        localStorage.setItem(`ipds_blockyields_cache_${estateId}`, JSON.stringify(blockAnnualData));
        offlineStore.setItem(`ipds_blockyields_cache_${estateId}`, blockAnnualData);
      } catch (e) {
        console.warn("Failed to cache blockAnnualData to storage:", e);
      }
    }
  }, [blockAnnualData]);

  const seedHistoricalData = async () => {
    try {
      await safeFetch("/api/seed-historical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: HISTORICAL_BLOCK_YIELDS }),
      });
      const blockYields = await safeFetch("/api/block-annual-yields").catch(() => null);
      if (Array.isArray(blockYields) && blockYields.length > 0) setBlockAnnualData(blockYields);
    } catch (e) {
      // Non-blocking background seeding fallback
      console.warn("Seeding historical data to cloud skipped or unauthenticated:", e);
    }
  };

  const handleDeleteRecord = async (no_resit: string) => {
    try {
      setIsProcessing(true);
      await safeFetch(`/api/hantaran/${no_resit}`, {
        method: "DELETE",
      });
      showToast("success", `Rekod ${no_resit} telah dipadam.`);
      setRecordToDelete(null);
      fetchData(true);
    } catch (e: any) {
      console.error("Delete error:", e);
      showToast("error", e.message || "Gagal memadam data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAllRecords = async () => {
    try {
      setIsProcessing(true);
      await safeFetch("/api/hantaran/all", {
        method: "DELETE",
      });
      showToast("success", "Semua rekod telah dipadam.");
      setShowDeleteAllModal(false);
      fetchData(true);
    } catch (e: any) {
      console.error("Delete all error:", e);
      showToast("error", e.message || "Gagal memadam semua data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const checkConfig = async () => {
    try {
      const data = await safeFetch("/api/config-check");
      const ready = isSupabaseReady();
      const updatedStatus = {
        ...data,
        supabase: Boolean(data?.supabase || ready)
      };
      setConfigStatus(updatedStatus);
      if (data && data.supabase) {
        try {
          const pub = await safeFetch("/api/public-config");
          if (pub && pub.supabaseUrl && pub.supabaseAnonKey) {
            updateSupabaseClient(pub.supabaseUrl, pub.supabaseAnonKey);
            setConfigStatus((prev: any) => ({ ...prev, supabase: true }));
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Notice: Config check fallback active", e);
      if (isSupabaseReady()) {
        setConfigStatus((prev: any) => ({ ...prev, supabase: true }));
      }
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  useEffect(() => {
    if (authRole) {
      fetchData(true);
      checkConfig();
    }
  }, [authRole]);

  // Listen to estate switch events
  useEffect(() => {
    const handleEstateChange = (e: any) => {
      // Clear data or load estate-specific cached transactions immediately for snappy UX
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      try {
        const cached = localStorage.getItem(`ipds_rawdata_cache_${newEstateId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const isRegion = newEstateId === 'ALL' || newEstateId === 'WILAYAH_JB' || newEstateId === 'WJB' || newEstateId === '0001';
            const valid = parsed
              .map((r: any) => normalizeSingleTransaction(r))
              .filter((r: any) => isRegion || r.estate_id === newEstateId);
            if (newEstateId === 'FPM_ADELA' || isRegion) {
              const baseline = generateAdelaBaselineTransactions();
              const baselineMap = new Map(baseline.map(b => [String(b.no_resit).toUpperCase(), b]));
              const seen = new Set<string>();
              const updatedValid = valid.map((r: any) => {
                const k = String(r.no_resit || '').toUpperCase();
                if (baselineMap.has(k)) {
                  seen.add(k);
                  return { ...r, ...baselineMap.get(k) };
                }
                return r;
              });
              const missing = baseline.filter(b => !seen.has(String(b.no_resit || '').toUpperCase()));
              setRawData([...updatedValid, ...missing]);
            } else {
              setRawData(valid);
            }
          } else if (newEstateId === 'FPM_ADELA') {
            setRawData(generateAdelaBaselineTransactions());
          } else {
            setRawData([]);
          }
        } else if (newEstateId === 'FPM_ADELA') {
          setRawData(generateAdelaBaselineTransactions());
        } else {
          setRawData([]);
        }
      } catch (_) {
        setRawData([]);
      }

      // Reset blockAnnualData appropriately for new estate
      if (newEstateId === 'FPM_TUNGGAL') {
        const cached = localStorage.getItem(`ipds_blockyields_cache_FPM_TUNGGAL`) || localStorage.getItem("ipds_blockyields_cache");
        if (cached) {
          try {
            setBlockAnnualData(JSON.parse(cached));
          } catch (_) {
            setBlockAnnualData(HISTORICAL_BLOCK_YIELDS);
          }
        } else {
          setBlockAnnualData(HISTORICAL_BLOCK_YIELDS);
        }
      } else {
        const cached = localStorage.getItem(`ipds_blockyields_cache_${newEstateId}`);
        if (cached) {
          try {
            setBlockAnnualData(JSON.parse(cached));
          } catch (_) {
            setBlockAnnualData([]);
          }
        } else {
          setBlockAnnualData([]);
        }
      }

      fetchData(true);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!authRole) return;

    const channel = supabase
      .channel("hantaran-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hantaran_hasil" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRawData((prev) => {
              const exists = prev.find((p) => p.id === payload.new.id);
              if (exists) return prev;
              showToast("success", `Data baru: Resit ${payload.new.no_resit}`);
              return [normalizeSingleTransaction(payload.new), ...prev];
            });
          }
          if (payload.eventType === "DELETE") {
            setRawData((prev) => prev.filter((p) => p.id !== payload.old.id));
            showToast("error", "Rekod telah dipadam.");
          }
          if (payload.eventType === "UPDATE") {
            setRawData((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? normalizeSingleTransaction(payload.new) : p
              )
            );
            showToast("success", `Rekod dikemaskini: Resit ${payload.new.no_resit}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authRole]);

  const handleEditRecord = (record: Transaction) => {
    setFormData({
      no_resit: record.no_resit || "",
      no_akaun_terima: record.no_akaun_terima || "",
      no_lori: record.no_lori || "",
      no_seal: record.no_seal || "",
      no_nota_hantaran: record.no_nota_hantaran || "",
      kpg: record.kpg ? record.kpg.toString() : "",
      kpa: record.kpa !== undefined ? record.kpa.toString() : "",
      blok: record.blok ? record.blok.replace(/[^0-9A-Z]/g, '') : "",
      peringkat: record.peringkat || "",
      tan: record.tan ? record.tan.toString() : "",
      muda: record.muda ? record.muda.toString() : "",
      reject: record.reject ? record.reject.toString() : "0.00",
      sample: record.sample ? record.sample.toString() : "0",
      rm_mt: record.rm_mt ? record.rm_mt.toString() : "",
      tarikh: record.tarikh || "",
      masa_masuk: record.masa_masuk || "",
      estate_id: (record as any).estate_id || getActiveEstateId(),
      kod_penjual: (record as any).kod_penjual || "",
      nama_penjual: (record as any).nama_penjual || "",
      kod_projek: (record as any).kod_projek || "",
      kod_akaun_bts: (record as any).kod_akaun_bts || "",
      is_efb: record.is_efb !== undefined ? !!record.is_efb : record.peringkat === "EFB",
      is_baja: false,
      is_pruning: false,
      is_hujan: false,
      is_meracun: false,
    });
    setEditingRecordId(record.no_resit);
    setActiveTab("scan");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFormData = () => {
    setFormData(INITIAL_FORM_DATA);
  };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.no_resit || !formData.no_lori || !formData.blok) {
      showToast("error", "Sila lengkapkan semua maklumat wajib.");
      return;
    }

    // ==========================================
    // SEKATAN PERSEMPADAN LADANG (ESTATE BOUNDARY CONTROL)
    // Menghalang kemasukan resit ladang lain ke dalam pangkalan data ladang semasa
    // ==========================================
    const activeEstate = getActiveEstateId();
    const activeEstateConfig = getEstateConfig(activeEstate);
    const detectedEstate = detectEstateFromSeller(
      formData.kod_penjual,
      formData.nama_penjual,
      formData.kod_projek,
      formData.no_nota_hantaran,
      formData.no_resit,
      formData.kod_akaun_bts
    );

    if (activeEstate !== 'ALL' && detectedEstate && detectedEstate.estateId !== activeEstate) {
      showToast(
        "error",
        `⛔ SEKATAN PERSEMPADAN LADANG: Maklumat resit dikesan milik ${detectedEstate.estateName} (Kod ${detectedEstate.code}), tetapi anda berada dalam pangkalan data ${activeEstateConfig.name}. Pemasukan resit merentasi ladang disekat!`
      );
      return;
    }

    // ==========================================
    // SEKATAN PERTINDIHAN (DUPLICATE PROTECTION)
    // Menghalang kemasukan kali kedua mengikut No Akuan Terima / No Resit
    // ==========================================
    if (!editingRecordId) {
      const normalizedNoAkuan = String(formData.no_akaun_terima || "").trim().toUpperCase();
      const normalizedNoResit = String(formData.no_resit || "").trim().toUpperCase();

      const existingRecord = rawData.find((r: any) => {
        const exAkuan = String(r.no_akaun_terima || "").trim().toUpperCase();
        const exResit = String(r.no_resit || "").trim().toUpperCase();
        if (normalizedNoAkuan && exAkuan && exAkuan === normalizedNoAkuan) return true;
        if (normalizedNoResit && exResit && exResit === normalizedNoResit) return true;
        return false;
      });

      if (existingRecord) {
        const matchLabel = normalizedNoAkuan && String(existingRecord.no_akaun_terima || "").trim().toUpperCase() === normalizedNoAkuan
          ? `No. Akuan Terima "${existingRecord.no_akaun_terima}"`
          : `No. Resit "${existingRecord.no_resit}"`;
        showToast(
          "error",
          `⛔ Pemasukan disekat! Resit dengan ${matchLabel} telah pun direkodkan (${existingRecord.tarikh} - Lori: ${existingRecord.no_lori}, Berat: ${existingRecord.tan} MT). Pemasukan kali kedua tidak dibenarkan bagi mengelakkan pertindihan data.`
        );
        return;
      }
    }

    setIsProcessing(true);
    const url = editingRecordId ? `/api/hantaran/${encodeURIComponent(editingRecordId)}` : "/api/hantaran";
    const method = editingRecordId ? "PUT" : "POST";

    const sanitizedBlok = cleanAndExtractBlockCode(formData.blok) || formData.blok;
    const payloadWithEstate = {
      ...formData,
      blok: sanitizedBlok,
      estate_id: formData.estate_id || activeEstate,
    };

    // If device is offline, queue locally and update optimistic state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await offlineStore.enqueueSync({ url, method, payload: payloadWithEstate });
        const localOptimisticRecord = normalizeSingleTransaction({
          ...payloadWithEstate,
          id: `offline_${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        
        setRawData((prev) => [localOptimisticRecord, ...prev.filter(r => r.no_resit !== formData.no_resit)]);
        showToast("success", `[Luar Talian] Resit ${formData.no_resit} disimpan ke cache. Akan disegerakkan bila online.`);
        const submittedDate = formData.tarikh;
        resetFormData();
        setEditingRecordId(null);
        if (submittedDate) {
          setHistoryFilterDate(submittedDate);
          setDashboardDate((prev) => (!prev || submittedDate >= prev ? submittedDate : prev));
        }
        if (editingRecordId) {
          setActiveTab("sejarah");
        }
      } catch (offlineErr) {
        showToast("error", "Gagal menyimpan rekod secara luar talian.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      const result = await safeFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithEstate),
      });

      if (result.success) {
        showToast("success", editingRecordId ? `Berjaya dikemaskini: Resit ${result.ref}` : `Berjaya ditambah: Resit ${result.ref}`);
        const submittedDate = formData.tarikh;
        const targetEstate = payloadWithEstate.estate_id || activeEstate;
        
        // Also update local cache for the target estate immediately
        const newRecord = normalizeSingleTransaction({
          ...payloadWithEstate,
          id: result.ref || `rec_${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        try {
          const existingCacheStr = localStorage.getItem(`ipds_rawdata_cache_${targetEstate}`) || "[]";
          const existingCache = JSON.parse(existingCacheStr);
          const updatedCache = [newRecord, ...existingCache.filter((r: any) => String(r.no_resit).toUpperCase() !== String(newRecord.no_resit).toUpperCase())];
          localStorage.setItem(`ipds_rawdata_cache_${targetEstate}`, JSON.stringify(updatedCache));
          offlineStore.setItem(`ipds_rawdata_cache_${targetEstate}`, updatedCache);
        } catch (_) {}

        resetFormData();
        setEditingRecordId(null);
        if (submittedDate) {
          setHistoryFilterDate(submittedDate);
          setDashboardDate((prev) => (!prev || submittedDate >= prev ? submittedDate : prev));
        }
        fetchData(true);
        if (editingRecordId) {
          setActiveTab("sejarah");
        }
      } else {
        const errorMsg = result.error || "Ralat tidak dijangka berlaku.";
        showToast("error", errorMsg);
      }
    } catch (err: any) {
      // Sekiranya penolakan daripada pelayan (cth: 409 conflict, pertindihan resit)
      if (err.isServerRejection || err.status === 409 || err.message?.includes("Pemasukan disekat") || err.message?.includes("wujud")) {
        showToast("error", err.message || "Pemasukan disekat: Resit telah pun wujud.");
        return;
      }

      console.warn("Network submission failed, queueing offline:", err);
      // Fallback to offline store if network fails unexpectedly
      try {
        await offlineStore.enqueueSync({ url, method, payload: formData });
        const localOptimisticRecord = normalizeSingleTransaction({
          ...formData,
          id: `offline_${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        setRawData((prev) => [localOptimisticRecord, ...prev.filter(r => r.no_resit !== formData.no_resit)]);
        showToast("success", `Disimpan ke storan peranti! Akan disegerakkan secara automatik bila online.`);
        resetFormData();
        setEditingRecordId(null);
      } catch (_) {
        showToast("error", "Gagal menghubungi pelayan. Sila periksa sambungan internet.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const applyOcrDataToForm = (data: any, confirmedDate: string) => {
    const rawSerial = `${data.kod_akaun_bts || ''} ${data.kod_penjual || ''}`.toUpperCase();
    const isPkt2FromBts = (data.peringkat && (data.peringkat.includes("002") || data.peringkat.includes("PKT 2") || data.peringkat.includes("PKT2"))) ||
      rawSerial.includes("-020-") ||
      /\b\d{4}-020-/.test(rawSerial) ||
      /[-_]020[-_]/.test(rawSerial) ||
      /\b020\b/.test(data.kod_akaun_bts || '');

    const btsDetails = extractBtsSerialDetails(data.kod_akaun_bts);
    const targetEstate = data.detected_estate_id || getActiveEstateId();
    const isAdela = targetEstate === 'FPM_ADELA' || targetEstate === '5136' || String(targetEstate).includes('ADELA');

    const candidateBlok = data.blok || (btsDetails?.blok) || (data.kod_akaun_bts ? cleanAndExtractBlockCode(data.kod_akaun_bts) : "");
    let cleanedBlok = cleanAndExtractBlockCode(candidateBlok) || candidateBlok;

    const bNum = parseInt(String(cleanedBlok).replace(/[^0-9]/g, ""), 10);

    const candidateUpper = String(candidateBlok || '').toUpperCase().trim();
    const isLotFeldaMatch = 
      (btsDetails && (btsDetails.subCode === '001' || btsDetails.blok === '88F')) ||
      rawSerial.includes('-001-') ||
      rawSerial.includes(' 001 ') ||
      rawSerial.includes('88F') ||
      rawSerial.includes('88 F') ||
      rawSerial.includes('F88') ||
      candidateUpper === '88F' ||
      candidateUpper === '88 F' ||
      candidateUpper === 'F88' ||
      candidateUpper === 'LF' ||
      (isAdela && (candidateUpper === '88' || String(data.blok || '').trim() === '88'));

    if (isAdela && btsDetails) {
      if (btsDetails.subCode === '020' && !isNaN(bNum) && bNum >= 1 && bNum <= 6) {
        cleanedBlok = `P2-${bNum}`;
      } else if (btsDetails.subCode === '010' && !isNaN(bNum) && bNum >= 1 && bNum <= 9) {
        cleanedBlok = String(bNum);
      } else if (btsDetails.subCode === '011' && !isNaN(bNum) && bNum >= 10 && bNum <= 11) {
        cleanedBlok = String(bNum);
      } else if (btsDetails.subCode === '001') {
        cleanedBlok = "88F";
      } else if (['125Y', '1254', '128Y', '121V'].includes(btsDetails.subCode || '')) {
        cleanedBlok = btsDetails.subCode || cleanedBlok;
      }
    } else if (isPkt2FromBts && !isNaN(bNum) && bNum >= 1 && bNum <= 6) {
      if (isAdela) {
        cleanedBlok = `P2-${bNum}`;
      }
    }

    if (isLotFeldaMatch) {
      cleanedBlok = isAdela ? "88F" : (cleanedBlok || "88");
    }

    const extractedNoAkuan = data.no_akuan_terima || data.no_akaun_terima || "";
    setFormData((prev: any) => ({
      ...prev,
      no_resit: data.no_resit || prev.no_resit,
      no_akaun_terima: extractedNoAkuan || prev.no_akaun_terima,
      no_lori: data.no_lori || prev.no_lori,
      no_nota_hantaran: data.no_nota_hantaran || prev.no_nota_hantaran,
      no_seal: data.no_seal || prev.no_seal,
      kpg: data.kpg !== undefined && data.kpg !== null ? data.kpg.toString() : prev.kpg,
      kpa: data.kpa !== undefined && data.kpa !== null ? data.kpa.toString() : prev.kpa,
      rm_mt: data.rm_mt !== undefined && data.rm_mt !== null ? data.rm_mt.toString() : prev.rm_mt,
      tan: data.tan !== undefined && data.tan !== null ? data.tan.toString() : prev.tan,
      muda: data.muda !== undefined && data.muda !== null ? data.muda.toString() : prev.muda,
      tarikh: confirmedDate,
      masa_masuk: data.masa_masuk || prev.masa_masuk,
      is_efb: !!data.is_efb,
      estate_id: data.detected_estate_id || prev.estate_id,
      kod_penjual: data.kod_penjual || prev.kod_penjual,
      nama_penjual: data.nama_penjual || prev.nama_penjual,
      kod_projek: data.kod_projek || prev.kod_projek,
      kod_akaun_bts: data.kod_akaun_bts || prev.kod_akaun_bts,
      peringkat: isLotFeldaMatch ? "LOT FELDA" : (isPkt2FromBts ? "PKT 002" : (data.peringkat || prev.peringkat || "PKT 001")),
      blok: cleanedBlok || prev.blok || (data.is_efb ? "" : "1"),
    }));
  };

  const handleConfirmOcrDate = (confirmedDate: string) => {
    if (pendingOcrVerification) {
      applyOcrDataToForm(pendingOcrVerification.extractedData, confirmedDate);
      setShowDateVerificationModal(false);
      setPendingOcrVerification(null);
      setActiveTab("scan");
      showToast("success", `✅ Tarikh disahkan (${confirmedDate}). Maklumat resit dimasukkan ke borang.`);
    }
  };

  const handleConfirmAndSaveDirectly = async (confirmedDate: string) => {
    if (!pendingOcrVerification) return;
    const data = pendingOcrVerification.extractedData;
    const activeEstate = getActiveEstateId();
    const activeEstateConfig = getEstateConfig(activeEstate);

    // Sekatan persempadan ladang
    const detectedEstate = detectEstateFromSeller(
      data.kod_penjual,
      data.nama_penjual,
      data.kod_projek,
      data.no_nota_hantaran,
      data.no_resit
    );

    if (activeEstate !== 'ALL' && detectedEstate && detectedEstate.estateId !== activeEstate) {
      showToast(
        "error",
        `⛔ SEKATAN PERSEMPADAN LADANG: Resit ini milik ${detectedEstate.estateName} (Kod ${detectedEstate.code}), tetapi anda berada dalam pangkalan data ${activeEstateConfig.name}. Pemasukan disekat!`
      );
      setShowDateVerificationModal(false);
      setPendingOcrVerification(null);
      setActiveTab("scan");
      return;
    }
    const candidateBlok = data.blok || (data.kod_akaun_bts ? cleanAndExtractBlockCode(data.kod_akaun_bts) : "") || formData.blok || (data.is_efb ? "" : "1");
    const cleanedBlok = cleanAndExtractBlockCode(candidateBlok);
    const extractedNoAkuan = data.no_akuan_terima || data.no_akaun_terima || "";
    const payload = {
      ...formData,
      no_resit: data.no_resit || formData.no_resit,
      no_akaun_terima: extractedNoAkuan || formData.no_akaun_terima,
      no_lori: data.no_lori || formData.no_lori,
      no_nota_hantaran: data.no_nota_hantaran || formData.no_nota_hantaran,
      no_seal: data.no_seal || formData.no_seal,
      kpg: data.kpg !== undefined && data.kpg !== null ? data.kpg.toString() : formData.kpg,
      kpa: data.kpa !== undefined && data.kpa !== null ? data.kpa.toString() : formData.kpa,
      rm_mt: data.rm_mt !== undefined && data.rm_mt !== null ? data.rm_mt.toString() : formData.rm_mt,
      tan: data.tan !== undefined && data.tan !== null ? data.tan.toString() : formData.tan,
      muda: data.muda !== undefined && data.muda !== null ? data.muda.toString() : formData.muda,
      tarikh: confirmedDate,
      masa_masuk: data.masa_masuk || formData.masa_masuk,
      is_efb: !!data.is_efb,
      estate_id: data.detected_estate_id || formData.estate_id || activeEstate,
      blok: cleanedBlok || (data.is_efb ? "" : "1"),
    };

    applyOcrDataToForm(data, confirmedDate);
    setShowDateVerificationModal(false);
    setPendingOcrVerification(null);

    if (!payload.no_resit || !payload.no_lori || !payload.blok) {
      setActiveTab("scan");
      showToast("error", "Sila lengkapkan maklumat wajib di borang sebelum simpan.");
      return;
    }

    // Semak pendua sebelum simpan terus
    const checkAkuan = String(payload.no_akaun_terima || "").trim().toUpperCase();
    const checkResit = String(payload.no_resit || "").trim().toUpperCase();
    const existingDuplicate = rawData.find((r: any) => {
      const exAkuan = String(r.no_akaun_terima || "").trim().toUpperCase();
      const exResit = String(r.no_resit || "").trim().toUpperCase();
      if (checkAkuan && exAkuan && exAkuan === checkAkuan) return true;
      if (checkResit && exResit && exResit === checkResit) return true;
      return false;
    });

    if (existingDuplicate) {
      const matchLabel = checkAkuan && String(existingDuplicate.no_akaun_terima || "").trim().toUpperCase() === checkAkuan
        ? `No. Akuan Terima "${checkAkuan}"`
        : `No. Resit "${checkResit}"`;
      showToast(
        "error",
        `⛔ Pemasukan disekat! Resit dengan ${matchLabel} telah pun direkodkan (${existingDuplicate.tarikh} - Lori: ${existingDuplicate.no_lori}). Pemasukan kali kedua tidak dibenarkan.`
      );
      setActiveTab("scan");
      return;
    }

    setIsProcessing(true);
    const url = "/api/hantaran";
    const method = "POST";

    // Semak jika mod luar talian (offline)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await offlineStore.enqueueSync({ url, method, payload });
        const localOptimisticRecord = normalizeSingleTransaction({
          ...payload,
          id: `offline_${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        setRawData((prev) => [localOptimisticRecord, ...prev.filter(r => r.no_resit !== payload.no_resit)]);
        showToast("success", `[Luar Talian] Resit ${payload.no_resit} disimpan ke cache.`);
        resetFormData();
        setEditingRecordId(null);
        if (confirmedDate) {
          setHistoryFilterDate(confirmedDate);
          setDashboardDate((prev) => (!prev || confirmedDate >= prev ? confirmedDate : prev));
        }
        setActiveTab("sejarah");
      } catch (offlineErr) {
        showToast("error", "Gagal menyimpan rekod secara luar talian.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      const result = await safeFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (result.success) {
        showToast("success", `Berjaya disimpan: Resit ${result.ref || payload.no_resit}`);
        
        const newRecord = normalizeSingleTransaction({
          ...payload,
          id: result.ref || `rec_${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        try {
          const existingCacheStr = localStorage.getItem(`ipds_rawdata_cache_${payload.estate_id}`) || "[]";
          const existingCache = JSON.parse(existingCacheStr);
          const updatedCache = [newRecord, ...existingCache.filter((r: any) => String(r.no_resit).toUpperCase() !== String(newRecord.no_resit).toUpperCase())];
          localStorage.setItem(`ipds_rawdata_cache_${payload.estate_id}`, JSON.stringify(updatedCache));
          offlineStore.setItem(`ipds_rawdata_cache_${payload.estate_id}`, updatedCache);
        } catch (_) {}

        resetFormData();
        setEditingRecordId(null);
        if (confirmedDate) {
          setHistoryFilterDate(confirmedDate);
          setDashboardDate((prev) => (!prev || confirmedDate >= prev ? confirmedDate : prev));
        }
        fetchData(true);
        setActiveTab("sejarah");
      } else {
        showToast("error", result.error || "Ralat semasa menyimpan rekod.");
        setActiveTab("scan");
      }
    } catch (err: any) {
      showToast("error", err.message || "Gagal menghubungi pelayan semasa menyimpan rekod.");
      setActiveTab("scan");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcrScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveTab("scan");
    setShowUserMenu(false);
    setIsScanning(true);
    const scanStartTime = Date.now();

    try {
      const result = await parseReceiptWithGemini(file);

      if (result.no_resit || result.no_lori || result.tan) {
        const activeEstate = getActiveEstateId();
        const activeEstateConfig = getEstateConfig(activeEstate);
        const detectedEstate = detectEstateFromSeller(
          result.kod_penjual,
          result.nama_penjual,
          result.kod_projek,
          result.no_nota_hantaran,
          result.no_resit
        );

        if (activeEstate !== 'ALL' && detectedEstate && detectedEstate.estateId !== activeEstate) {
          showToast(
            "error",
            `⛔ SEKATAN PERSEMPADAN LADANG: Resit yang diimbas dikesan milik ${detectedEstate.estateName} (Kod ${detectedEstate.code}), tetapi anda sedang mengakses ${activeEstateConfig.name}. Pemasukan resit merentasi ladang disekat demi integriti data!`
          );
          return;
        }

        const todayDate = getTodayDateString();
        const ocrRawDate = result.tarikh ? normalizeDateToISO(result.tarikh) : '';
        const daysDiff = ocrRawDate ? getDaysDifferenceFromToday(ocrRawDate) : 0;
        const cleanedOcrBlok = cleanAndExtractBlockCode(result.blok || result.kod_akaun_bts);

        // Semak jika resit yang diimbas sudah wujud dalam data sedia ada
        const scannedNoAkuan = (result.no_akuan_terima || result.no_akaun_terima || '').trim().toUpperCase();
        const scannedNoResit = (result.no_resit || '').trim().toUpperCase();
        const duplicateMatch = rawData.find((item: any) => {
          const itemAkuan = String(item.no_akaun_terima || '').trim().toUpperCase();
          const itemResit = String(item.no_resit || '').trim().toUpperCase();
          if (scannedNoAkuan && itemAkuan && itemAkuan === scannedNoAkuan) return true;
          if (scannedNoResit && itemResit && itemResit === scannedNoResit) return true;
          return false;
        });

        if (duplicateMatch) {
          const matchLabel = scannedNoAkuan && String(duplicateMatch.no_akaun_terima || '').trim().toUpperCase() === scannedNoAkuan
            ? `No. Akuan Terima "${scannedNoAkuan}"`
            : `No. Resit "${scannedNoResit}"`;
          showToast(
            "error",
            `⛔ AMARAN: Resit dengan ${matchLabel} telah pun direkodkan (${duplicateMatch.tarikh} - Lori: ${duplicateMatch.no_lori}, Berat: ${duplicateMatch.tan} MT). Pemasukan kali kedua disekat!`
          );
        }

        // Sekiranya tarikh dikesan BERBEZA dari tarikh semasa hari ini (sama ada hari masa hadapan atau hari lepas):
        if (ocrRawDate && daysDiff !== 0) {
          setPendingOcrVerification({
            detectedDate: ocrRawDate,
            receiptInfo: {
              no_resit: result.no_resit,
              no_lori: result.no_lori,
              no_nota_hantaran: result.no_nota_hantaran,
              no_akuan_terima: result.no_akuan_terima || result.no_akaun_terima || '',
              tan: result.tan,
              kpg: result.kpg,
              kpa: result.kpa,
              muda: result.muda,
              blok: cleanedOcrBlok,
              rm_mt: result.rm_mt,
              is_efb: result.is_efb,
              detected_estate_name: result.detected_estate_name,
              detected_estate_id: result.detected_estate_id,
              kod_penjual: result.kod_penjual,
              nama_penjual: result.nama_penjual,
              confidence: result.confidence,
            },
            extractedData: {
              ...result,
              blok: cleanedOcrBlok,
            },
          });
          setShowDateVerificationModal(true);

          if (daysDiff > 0) {
            showToast("error", `⚠️ Amaran: Tarikh resit dikesan di masa hadapan (${ocrRawDate}). Sila semak & betulkan.`);
          } else {
            showToast("info", `⚠️ Peringatan: Tarikh resit (${ocrRawDate}) dikesan ${Math.abs(daysDiff)} hari lepas. Sila buat pengesahan.`);
          }
        } else {
          // Tarikh sama dengan hari ini atau tiada tarikh diekstrak (gunakan tarikh hari ini)
          const confirmedDate = ocrRawDate || todayDate;
          applyOcrDataToForm(result, confirmedDate);
          setActiveTab("scan");

          if (result.confidence < 70) {
            showToast("error", `⚠️ Accuracy rendah (${result.confidence}%). Sila semak maklumat.`);
          } else {
            const estateBadge = result.detected_estate_name
              ? ` | ${result.detected_estate_name} (${result.kod_penjual || ''})`
              : '';
            showToast(
              "success",
              result.is_efb
                ? `✅ Scan EFB berjaya (${result.confidence}%)${estateBadge}`
                : `✅ Scan berjaya (${result.confidence}%)${estateBadge}`
            );
          }
        }
      } else {
        showToast("error", "Gagal mengekstrak maklumat. Sila isi secara manual.");
      }
    } catch (err: any) {
      console.error("Gemini OCR Error:", err);
      showToast("error", `Ralat OCR: ${err.message || "Sila cuba lagi."}`);
    } finally {
      // Pastikan paparan proses mengambil masa sekurang-kurangnya 3 saat (3200ms)
      // supaya pengguna sempat melihat perincian proses (Langkah 1/4 -> 2/4 -> 3/4 -> 4/4 Selesai)
      const elapsed = Date.now() - scanStartTime;
      const minDuration = 3200;
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
      }
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  return {
    formData,
    setFormData,
    resetFormData,
    rawData,
    setRawData,
    blockAnnualData,
    isProcessing,
    isScanning,
    toast,
    setToast,
    showToast,
    recordToDelete,
    setRecordToDelete,
    editingRecordId,
    setEditingRecordId,
    showDeleteAllModal,
    setShowDeleteAllModal,
    showDateVerificationModal,
    setShowDateVerificationModal,
    pendingOcrVerification,
    setPendingOcrVerification,
    handleConfirmOcrDate,
    handleConfirmAndSaveDirectly,
    configStatus,
    fileInputRef,
    uploadInputRef,
    fetchData,
    checkConfig,
    handleDeleteRecord,
    handleDeleteAllRecords,
    handleEditRecord,
    submitTransaction,
    handleOcrScan,
  };
}
