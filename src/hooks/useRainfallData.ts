import { useState, useEffect } from "react";
import { HujanRecord } from "../types";
import { supabase } from "../services/supabaseClient";
import { offlineStore } from "../utils/offlineStore";
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from "../utils/estateContext";
import { safeFetch } from "../utils/safeFetch";

export const INITIAL_HUJAN_DATA: HujanRecord[] = [
  { bulan: 'JANUARI', '2021': 66, '2022': 298, '2023': 202, '2024': 199, '2025': 278, '2026': 188, '2027': null, '2028': null },
  { bulan: 'FEBRUARI', '2021': 77, '2022': 247, '2023': 378, '2024': 105, '2025': 48, '2026': null, '2027': null, '2028': null },
  { bulan: 'MAC', '2021': 239, '2022': 77, '2023': 310, '2024': 177, '2025': 361, '2026': null, '2027': null, '2028': null },
  { bulan: 'APRIL', '2021': 114, '2022': 210, '2023': 85, '2024': 120, '2025': 107, '2026': null, '2027': null, '2028': null },
  { bulan: 'MEI', '2021': 120, '2022': 182, '2023': 157, '2024': 303, '2025': 213, '2026': null, '2027': null, '2028': null },
  { bulan: 'JUN', '2021': 146, '2022': 149, '2023': 113, '2024': 123, '2025': 130, '2026': null, '2027': null, '2028': null },
  { bulan: 'JULAI', '2021': 225, '2022': 156, '2023': 108, '2024': 175, '2025': 240, '2026': null, '2027': null, '2028': null },
  { bulan: 'OGOS', '2021': 161, '2022': 112, '2023': 140, '2024': 199, '2025': 173, '2026': null, '2027': null, '2028': null },
  { bulan: 'SEPTEMBER', '2021': 130, '2022': 173, '2023': 224, '2024': 156, '2025': 278, '2026': null, '2027': null, '2028': null },
  { bulan: 'OKTOBER', '2021': 178, '2022': 239, '2023': 374, '2024': 255, '2025': 365, '2026': null, '2027': null, '2028': null },
  { bulan: 'NOVEMBER', '2021': 356, '2022': 472, '2023': 310, '2024': 399, '2025': 532, '2026': null, '2027': null, '2028': null },
  { bulan: 'DISEMBER', '2021': 176, '2022': 244, '2023': 413, '2024': 137, '2025': 185, '2026': null, '2027': null, '2028': null },
  { bulan: 'JUMLAH', '2021': 1988, '2022': 2559, '2023': 2814, '2024': 2448, '2025': 2910, '2026': 188, '2027': null, '2028': null }
];

export const createEmptyHujanData = (): HujanRecord[] => [
  { bulan: 'JANUARI', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'FEBRUARI', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'MAC', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'APRIL', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'MEI', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'JUN', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'JULAI', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'OGOS', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'SEPTEMBER', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'OKTOBER', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'NOVEMBER', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'DISEMBER', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null },
  { bulan: 'JUMLAH', '2021': null, '2022': null, '2023': null, '2024': null, '2025': null, '2026': null, '2027': null, '2028': null }
];

const getInitialDataForEstate = (estateId: string): HujanRecord[] => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`hujanData_${estateId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
  }
  return estateId === 'FPM_TUNGGAL' ? INITIAL_HUJAN_DATA : createEmptyHujanData();
};

const normalizeMonth = (m: string) => {
  const clean = (m || '').toUpperCase().trim();
  if (clean.startsWith('JAN')) return 'JANUARI';
  if (clean.startsWith('FEB')) return 'FEBRUARI';
  if (clean.startsWith('MAC') || clean.startsWith('MAR')) return 'MAC';
  if (clean.startsWith('APR')) return 'APRIL';
  if (clean.startsWith('MEI') || clean.startsWith('MAY')) return 'MEI';
  if (clean.startsWith('JUN')) return 'JUN';
  if (clean.startsWith('JUL')) return 'JULAI';
  if (clean.startsWith('OGO') || clean.startsWith('AUG')) return 'OGOS';
  if (clean.startsWith('SEP')) return 'SEPTEMBER';
  if (clean.startsWith('OKT') || clean.startsWith('OCT')) return 'OKTOBER';
  if (clean.startsWith('NOV')) return 'NOVEMBER';
  if (clean.startsWith('DIS') || clean.startsWith('DEC')) return 'DISEMBER';
  return clean;
};

export function useRainfallData() {
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());

  const [hujanData, setHujanData] = useState<HujanRecord[]>(() => {
    return getInitialDataForEstate(getActiveEstateId());
  });

  // Listen to estate changes
  useEffect(() => {
    const handleEstateChange = (e: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstateId);
      setHujanData(getInitialDataForEstate(newEstateId));
    };

    if (typeof window !== "undefined") {
      window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      return () => {
        window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      };
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(`hujanData_${activeEstate}`, JSON.stringify(hujanData));
    if (activeEstate === 'FPM_TUNGGAL') {
      localStorage.setItem('hujanData', JSON.stringify(hujanData));
    }
    offlineStore.setItem(`hujanData_${activeEstate}`, hujanData);
  }, [hujanData, activeEstate]);

  useEffect(() => {
    const fetchHujanFromApi = async () => {
      try {
        const res = await safeFetch(`/api/hujan?estate_id=${encodeURIComponent(activeEstate)}`);
        if (!res.ok) {
          console.log("No rainfall record API endpoint or error fetching:", res.statusText);
          return;
        }

        const json = await res.json();
        const data = json.data || [];
        const isTunggal = activeEstate === 'FPM_TUNGGAL';
        const filtered = data;

        // If no data exists in Supabase for this estate, keep existing local data if available
        let newData = isTunggal ? [...INITIAL_HUJAN_DATA] : getInitialDataForEstate(activeEstate);
        
        if (filtered.length > 0) {
          filtered.forEach((rekod: any) => {
            const rekodBulan = normalizeMonth(rekod.bulan);
            newData = newData.map(item => {
              if (normalizeMonth(item.bulan) === rekodBulan) {
                const tahunKey = String(rekod.tahun);
                return { ...item, [tahunKey]: Number(rekod.jumlah) || 0 };
              }
              return item;
            });
          });
        }

        // Recalculate JUMLAH row
        const yearsList = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
        newData = newData.map(item => {
          if (item.bulan === 'JUMLAH') {
            const newJumlahRow = { ...item };
            yearsList.forEach(y => {
              let yTotal = 0;
              let hasDataForYear = false;
              newData.forEach(dataItem => {
                if (dataItem.bulan !== 'JUMLAH' && dataItem[y] != null) {
                  yTotal += Number(dataItem[y]) || 0;
                  hasDataForYear = true;
                }
              });
              newJumlahRow[y] = hasDataForYear ? yTotal : null;
            });
            return newJumlahRow;
          }
          return item;
        });

        setHujanData(newData);
      } catch (err) {
        console.warn("[iPDS RAINFALL] Menggunakan data luar talian/cache untuk hujan:", err);
      }
    };

    fetchHujanFromApi();
  }, [activeEstate]);

  const handleAddHujan = (bulan: string, tahun: string, jumlah: number) => {
    const targetBulan = normalizeMonth(bulan);
    setHujanData(prev => {
      let newData = prev.map(item => {
        if (normalizeMonth(item.bulan) === targetBulan) {
          return { ...item, [tahun]: jumlah };
        }
        return item;
      });

      const yearsList = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];
      newData = newData.map(item => {
        if (item.bulan === 'JUMLAH') {
          const newJumlahRow = { ...item };
          yearsList.forEach(y => {
            let yTotal = 0;
            let hasDataForYear = false;
            newData.forEach(dataItem => {
              if (dataItem.bulan !== 'JUMLAH' && dataItem[y] != null) {
                yTotal += Number(dataItem[y]) || 0;
                hasDataForYear = true;
              }
            });
            newJumlahRow[y] = hasDataForYear ? yTotal : null;
          });
          return newJumlahRow;
        }
        return item;
      });

      return newData;
    });
  };

  return {
    hujanData,
    setHujanData,
    handleAddHujan,
  };
}
