import React, { useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MASTER_DATA } from "../../../utils/constants";
import { getEstateConfig, getActiveEstateId } from "../../../config/estateRegistry";
import { Printer, Download, Share2, ZoomIn, ZoomOut, MoveHorizontal, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "../../../components/common/EmptyState";
import { getMalayMonthName } from "../../../utils/formatters";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface PendapatanBulananTableProps {
  analytics: any;
  dashboardDate: string;
  setDashboardDate?: (val: string) => void;
  isDarkMode: boolean;
  onScreenshot?: () => void;
  isCapturing?: boolean;
  activeEstateId?: string;
}

export const PendapatanBulananTableComponent: React.FC<PendapatanBulananTableProps> = ({
  analytics,
  dashboardDate,
  setDashboardDate,
  isDarkMode,
  onScreenshot,
  isCapturing,
  activeEstateId,
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(40);

  const cfg = useMemo(() => getEstateConfig(activeEstateId || getActiveEstateId()), [activeEstateId]);
  const estateTitle = `FELDA PLANTATION MANAGEMENT ${cfg.shortName.toUpperCase()}`;

  const blokStats = analytics?.month?.blokStats;
  const [reportYear, reportMonth] = (dashboardDate || '').split("-");
  const monthName = getMalayMonthName(reportMonth || '1').toUpperCase();

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value; // YYYY-MM
    if (newMonth && setDashboardDate) {
      setDashboardDate(`${newMonth}-01`); // Set to 1st of the month
    }
  };

  const getPriceForPkt = (pkt: string) => {
    if (pkt === "001") return analytics?.month?.pkt1_avg_price || analytics?.month?.avgPrice || 1020.50;
    if (pkt === "002") return analytics?.month?.pkt2_avg_price || analytics?.month?.avgPrice || 1015.00;
    return analytics?.month?.felda_avg_price || analytics?.month?.avgPrice || 1010.00;
  };

  // Memoized Prepared Data
  const { rows, pkt1Rows, pkt2Rows, sumPkt1, sumPkt2, pkt1AvgPrice, pkt1THek, pkt1TPen, pkt1Sependapatan, pkt2AvgPrice, pkt2THek, pkt2TPen, pkt2Sependapatan, p1BlockRange, p2BlockRange } = useMemo(() => {
    if (!blokStats || !Array.isArray(blokStats)) {
      return {
        rows: [],
        pkt1Rows: [],
        pkt2Rows: [],
        sumPkt1: { luas: 0, peneroka: 0, tan: 0, totalSales: 0 },
        sumPkt2: { luas: 0, peneroka: 0, tan: 0, totalSales: 0 },
        pkt1AvgPrice: 0,
        pkt1THek: 0,
        pkt1TPen: 0,
        pkt1Sependapatan: 0,
        pkt2AvgPrice: 0,
        pkt2THek: 0,
        pkt2TPen: 0,
        pkt2Sependapatan: 0,
        p1BlockRange: "-",
        p2BlockRange: "-",
      };
    }

    const calculatedRows = blokStats
      .filter((b: any) => b.blok !== "88" && b.pkt !== "003")
      .map((b: any) => {
        const isTunggal = cfg.id === "FPM_TUNGGAL";
        const peneroka = cfg.blocks?.[b.blok]?.peneroka || (isTunggal ? MASTER_DATA[b.blok]?.peneroka : 1) || 1;
        const tHek = b.luas > 0 ? b.tan / b.luas : 0;
        const tPen = b.tan / peneroka;
        const basePrice = getPriceForPkt(b.pkt);
        const totalSales = (b.hasil_rm && b.hasil_rm > 0) ? b.hasil_rm : (b.tan * basePrice);
        const price = b.tan > 0 ? totalSales / b.tan : 0;
        const purataSependapatan = peneroka > 0 ? totalSales / peneroka : 0;

        return {
          ...b,
          peneroka,
          tHek,
          tPen,
          price,
          totalSales,
          purataSependapatan
        };
      })
      .sort((a: any, b: any) => (parseInt(a.blok) || 999) - (parseInt(b.blok) || 999));

    const p1 = calculatedRows.filter((r: any) => r.pkt === "001");
    const p2 = calculatedRows.filter((r: any) => r.pkt === "002");

    const p1Nums = p1.map((r: any) => parseInt(r.blok)).filter((n: number) => !isNaN(n));
    const p2Nums = p2.map((r: any) => parseInt(r.blok)).filter((n: number) => !isNaN(n));

    const p1Range = p1Nums.length > 0 ? `${Math.min(...p1Nums)}-${Math.max(...p1Nums)}` : "-";
    const p2Range = p2Nums.length > 0 ? `${Math.min(...p2Nums)}-${Math.max(...p2Nums)}` : "-";

    const s1 = {
      luas: p1.reduce((acc: number, r: any) => acc + r.luas, 0),
      peneroka: p1.reduce((acc: number, r: any) => acc + r.peneroka, 0),
      tan: p1.reduce((acc: number, r: any) => acc + r.tan, 0),
      totalSales: p1.reduce((acc: number, r: any) => acc + r.totalSales, 0),
    };
    const p1AvgPrice = s1.tan > 0 ? s1.totalSales / s1.tan : 0;
    const p1THek = s1.luas > 0 ? s1.tan / s1.luas : 0;
    const p1TPen = s1.peneroka > 0 ? s1.tan / s1.peneroka : 0;
    const p1Sependapatan = s1.peneroka > 0 ? s1.totalSales / s1.peneroka : 0;

    const s2 = {
      luas: p2.reduce((acc: number, r: any) => acc + r.luas, 0),
      peneroka: p2.reduce((acc: number, r: any) => acc + r.peneroka, 0),
      tan: p2.reduce((acc: number, r: any) => acc + r.tan, 0),
      totalSales: p2.reduce((acc: number, r: any) => acc + r.totalSales, 0),
    };
    const p2AvgPrice = s2.tan > 0 ? s2.totalSales / s2.tan : 0;
    const p2THek = s2.luas > 0 ? s2.tan / s2.luas : 0;
    const p2TPen = s2.peneroka > 0 ? s2.tan / s2.peneroka : 0;
    const p2Sependapatan = s2.peneroka > 0 ? s2.totalSales / s2.peneroka : 0;

    return {
      rows: calculatedRows,
      pkt1Rows: p1,
      pkt2Rows: p2,
      sumPkt1: s1,
      sumPkt2: s2,
      pkt1AvgPrice: p1AvgPrice,
      pkt1THek: p1THek,
      pkt1TPen: p1TPen,
      pkt1Sependapatan: p1Sependapatan,
      pkt2AvgPrice: p2AvgPrice,
      pkt2THek: p2THek,
      pkt2TPen: p2TPen,
      pkt2Sependapatan: p2Sependapatan,
      p1BlockRange: p1Range,
      p2BlockRange: p2Range,
    };
  }, [blokStats, analytics, cfg]);

  if (!analytics || !analytics.month || !analytics.month.blokStats) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <EmptyState
          icon={<FileSpreadsheet className="w-7 h-7" />}
          title="Tiada Data Pendapatan"
          description="Data pendapatan bulanan belum dimuatkan untuk tarikh yang dipilih."
        />
      </div>
    );
  }
  
  const handleExportExcel = async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pendapatan Peneroka");

      // Title rows
      worksheet.mergeCells('A1', 'J1');
      worksheet.getCell('A1').value = estateTitle;
      worksheet.getCell('A1').font = { bold: true, size: 12 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2', 'J2');
      worksheet.getCell('A2').value = "LAPORAN PENDAPATAN BULANAN PENEROKA";
      worksheet.getCell('A2').font = { bold: true, size: 12 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3', 'J3');
      worksheet.getCell('A3').value = `BULAN : ${monthName} ${reportYear}`;
      worksheet.getCell('A3').font = { bold: true, size: 11 };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      // Headers
      const startHeaderRow = 5;
      worksheet.mergeCells(`A${startHeaderRow}`, `A${startHeaderRow+1}`);
      worksheet.getCell(`A${startHeaderRow}`).value = "Pkt";

      worksheet.mergeCells(`B${startHeaderRow}`, `B${startHeaderRow+1}`);
      worksheet.getCell(`B${startHeaderRow}`).value = "Blok";

      worksheet.mergeCells(`C${startHeaderRow}`, `C${startHeaderRow+1}`);
      worksheet.getCell(`C${startHeaderRow}`).value = "Luas\n(Hek)";
      worksheet.getCell(`C${startHeaderRow}`).alignment = { wrapText: true, horizontal: "center", vertical: 'middle' };

      worksheet.mergeCells(`D${startHeaderRow}`, `D${startHeaderRow+1}`);
      worksheet.getCell(`D${startHeaderRow}`).value = "Jum Pen.";

      worksheet.mergeCells(`E${startHeaderRow}`, `G${startHeaderRow}`);
      worksheet.getCell(`E${startHeaderRow}`).value = "Pencapaian Hasil";
      worksheet.getCell(`E${startHeaderRow}`).alignment = { horizontal: 'center' };

      worksheet.getCell(`E${startHeaderRow+1}`).value = "M/Tan";
      worksheet.getCell(`F${startHeaderRow+1}`).value = "T / Hek";
      worksheet.getCell(`G${startHeaderRow+1}`).value = "T / Pen";

      worksheet.mergeCells(`H${startHeaderRow}`, `H${startHeaderRow+1}`);
      worksheet.getCell(`H${startHeaderRow}`).value = "Jumlah Nilai\nJualan\n( RM )";
      worksheet.getCell(`H${startHeaderRow}`).alignment = { wrapText: true, horizontal: "center", vertical: 'middle' };

      worksheet.mergeCells(`I${startHeaderRow}`, `I${startHeaderRow+1}`);
      worksheet.getCell(`I${startHeaderRow}`).value = "Purata\nHarga /\nTan\n(RM)";
      worksheet.getCell(`I${startHeaderRow}`).alignment = { wrapText: true, horizontal: "center", vertical: 'middle' };

      worksheet.mergeCells(`J${startHeaderRow}`, `J${startHeaderRow+1}`);
      worksheet.getCell(`J${startHeaderRow}`).value = "Purata\nPendapatan\nKasar\nSepeneroka";
      worksheet.getCell(`J${startHeaderRow}`).alignment = { wrapText: true, horizontal: "center", vertical: 'middle' };

      // Styling headers
      for (let c = 1; c <= 10; c++) {
          for(let r = startHeaderRow; r <= startHeaderRow+1; r++) {
              const cell = worksheet.getCell(r, c);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              cell.font = { bold: true };
              if (!cell.alignment) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
      }

      // Columns width
      worksheet.getColumn(1).width = 10;
      worksheet.getColumn(2).width = 8;
      worksheet.getColumn(3).width = 10;
      worksheet.getColumn(4).width = 10;
      worksheet.getColumn(5).width = 12;
      worksheet.getColumn(6).width = 10;
      worksheet.getColumn(7).width = 10;
      worksheet.getColumn(8).width = 16;
      worksheet.getColumn(9).width = 12;
      worksheet.getColumn(10).width = 16;

      let currentRow = startHeaderRow + 2;

      // PKT 1 rows
      pkt1Rows.forEach((row, idx) => {
          worksheet.getCell(`A${currentRow}`).value = idx === 0 ? `001\n(${pkt1Rows.length})` : "";
          if (idx === 0) worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          
          worksheet.getCell(`B${currentRow}`).value = parseInt(row.blok) || row.blok;
          worksheet.getCell(`C${currentRow}`).value = row.luas;
          worksheet.getCell(`D${currentRow}`).value = row.peneroka;
          worksheet.getCell(`E${currentRow}`).value = row.tan;
          worksheet.getCell(`F${currentRow}`).value = row.tHek;
          worksheet.getCell(`G${currentRow}`).value = row.tPen;
          worksheet.getCell(`H${currentRow}`).value = row.totalSales;
          worksheet.getCell(`I${currentRow}`).value = row.price;
          worksheet.getCell(`J${currentRow}`).value = row.purataSependapatan;
          
          worksheet.getCell(`C${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`F${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`H${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`I${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`J${currentRow}`).numFmt = '#,##0.00';
          
          for(let c=1; c<=10; c++) worksheet.getCell(currentRow, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          currentRow++;
      });
      // PKT 1 SUM
      worksheet.getCell(`A${currentRow}`).value = "001";
      worksheet.getCell(`B${currentRow}`).value = p1BlockRange;
      worksheet.getCell(`C${currentRow}`).value = sumPkt1.luas;
      worksheet.getCell(`D${currentRow}`).value = sumPkt1.peneroka;
      worksheet.getCell(`E${currentRow}`).value = sumPkt1.tan;
      worksheet.getCell(`F${currentRow}`).value = pkt1THek;
      worksheet.getCell(`G${currentRow}`).value = pkt1TPen;
      worksheet.getCell(`H${currentRow}`).value = sumPkt1.totalSales;
      worksheet.getCell(`I${currentRow}`).value = pkt1AvgPrice;
      worksheet.getCell(`J${currentRow}`).value = pkt1Sependapatan;
      for(let c=1; c<=10; c++) {
          const cell = worksheet.getCell(currentRow, c);
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
      worksheet.getCell(`C${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`F${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`H${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`I${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`J${currentRow}`).numFmt = '#,##0.00';
      currentRow++;

      // PKT 2 rows
      pkt2Rows.forEach((row, idx) => {
          worksheet.getCell(`A${currentRow}`).value = idx === 0 ? `002\n(${pkt2Rows.length})` : "";
          if (idx === 0) worksheet.getCell(`A${currentRow}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          
          worksheet.getCell(`B${currentRow}`).value = parseInt(row.blok) || row.blok;
          worksheet.getCell(`C${currentRow}`).value = row.luas;
          worksheet.getCell(`D${currentRow}`).value = row.peneroka;
          worksheet.getCell(`E${currentRow}`).value = row.tan;
          worksheet.getCell(`F${currentRow}`).value = row.tHek;
          worksheet.getCell(`G${currentRow}`).value = row.tPen;
          worksheet.getCell(`H${currentRow}`).value = row.totalSales;
          worksheet.getCell(`I${currentRow}`).value = row.price;
          worksheet.getCell(`J${currentRow}`).value = row.purataSependapatan;
          
          worksheet.getCell(`C${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`F${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`H${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`I${currentRow}`).numFmt = '#,##0.00';
          worksheet.getCell(`J${currentRow}`).numFmt = '#,##0.00';

          for(let c=1; c<=10; c++) worksheet.getCell(currentRow, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          currentRow++;
      });
      // PKT 2 SUM
      worksheet.getCell(`A${currentRow}`).value = "002";
      worksheet.getCell(`B${currentRow}`).value = p2BlockRange;
      worksheet.getCell(`C${currentRow}`).value = sumPkt2.luas;
      worksheet.getCell(`D${currentRow}`).value = sumPkt2.peneroka;
      worksheet.getCell(`E${currentRow}`).value = sumPkt2.tan;
      worksheet.getCell(`F${currentRow}`).value = pkt2THek;
      worksheet.getCell(`G${currentRow}`).value = pkt2TPen;
      worksheet.getCell(`H${currentRow}`).value = sumPkt2.totalSales;
      worksheet.getCell(`I${currentRow}`).value = pkt2AvgPrice;
      worksheet.getCell(`J${currentRow}`).value = pkt2Sependapatan;
      for(let c=1; c<=10; c++) {
          const cell = worksheet.getCell(currentRow, c);
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
      worksheet.getCell(`C${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`F${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`H${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`I${currentRow}`).numFmt = '#,##0.00';
      worksheet.getCell(`J${currentRow}`).numFmt = '#,##0.00';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Laporan_Pendapatan_Peneroka_${dashboardDate}.xlsx`);
  };

  return (
    <div className="mt-4 bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row gap-4 md:justify-between items-center bg-slate-50 dark:bg-black/20 dashboard-controls">
        <div className="flex items-center justify-center md:justify-start gap-2 w-full md:w-auto">
          <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest leading-none bg-slate-200 dark:bg-slate-700 px-3 py-2 rounded-xl">Bulan:</span>
          <input 
            type="month"
            value={`${reportYear}-${reportMonth}`}
            onChange={handleMonthChange}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center w-full md:w-auto">
            <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-sm active:scale-95 font-black text-[10px] uppercase tracking-wider cursor-pointer shrink-0"
                title="Muat Turun Excel (.xlsx)"
            >
                <Download size={13} className="stroke-[2.5]" />
                <span>Excel</span>
            </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 p-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 overflow-x-auto dashboard-controls">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 py-2 px-1 md:p-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
          <button
            onClick={() => setZoom(Math.max(5, zoom - 5))}
            className="p-1.5 md:p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all dark:text-emerald-100 active:scale-95"
            title="Zum Keluar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[10px] md:text-sm font-black min-w-[4ch] text-center text-emerald-800 dark:text-emerald-400">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(Math.min(100, zoom + 5))}
            className="p-1.5 md:p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all dark:text-emerald-100 active:scale-95"
            title="Zum Masuk"
          >
            <ZoomIn size={16} />
          </button>
        </div>
        <button onClick={() => setZoom(40)} className="text-[9px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm uppercase tracking-widest cursor-pointer">RESET</button>
      </div>

      <div className="overflow-x-auto custom-scrollbar relative bg-slate-100 dark:bg-[#0f172a] p-4 flex justify-center items-start min-h-[400px]">
        <div 
            ref={tableRef}
            className="flex-shrink-0 transition-transform origin-top select-auto"
            style={{ 
                transform: `scale(${isCapturing ? 0.85 : zoom / 100})`, 
                width: 'max-content'
            }}
        >
            <div id="hasil-bulanan-report" className="bg-white text-black p-6 border shadow-sm">
                <div className="text-center mb-6">
                    <h2 className={isCapturing ? "text-[32px] font-black uppercase font-sans tracking-wide m-0 leading-tight mb-2" : "text-lg font-black uppercase font-sans tracking-wide m-0 leading-tight"}>
                        {estateTitle}
                    </h2>
                    <h3 className={isCapturing ? "text-[24px] font-black uppercase tracking-wide m-0 leading-tight mb-1.5" : "text-base font-black uppercase tracking-wide m-0 leading-tight"}>
                        LAPORAN PENDAPATAN BULANAN PENEROKA
                    </h3>
                    <h4 className={isCapturing ? "text-[18px] font-bold uppercase tracking-wider m-0 mt-1" : "text-sm font-bold uppercase tracking-wider m-0 mt-1"}>
                        BULAN : {monthName} {reportYear}
                    </h4>
                </div>

                <table className="w-full border-collapse text-xs font-sans border-2 border-black">
                    <thead>
                        <tr className="bg-[#FFE599] border-black">
                            <th className="border border-black p-2 font-bold text-center align-middle" rowSpan={2}>Pkt</th>
                            <th className="border border-black p-2 font-bold text-center align-middle" rowSpan={2}>Blok</th>
                            <th className="border border-black p-2 font-bold text-center align-middle w-16" rowSpan={2}>Luas<br/>(Hek)</th>
                            <th className="border border-black p-2 font-bold text-center align-middle" rowSpan={2}>Jum Pen.</th>
                            <th className="border border-black p-1 font-bold text-center" colSpan={3}>Pencapaian Hasil</th>
                            <th className="border border-black p-2 font-bold text-center align-middle w-24" rowSpan={2}>Jumlah Nilai<br/>Jualan<br/>( RM )</th>
                            <th className="border border-black p-2 font-bold text-center align-middle w-20" rowSpan={2}>Purata<br/>Harga /<br/>Tan<br/>(RM)</th>
                            <th className="border border-black p-2 font-bold text-center align-middle w-28" rowSpan={2}>Purata<br/>Pendapatan<br/>Kasar<br/>Sepeneroka</th>
                        </tr>
                        <tr className="bg-[#FFE599] border-black">
                            <th className="border border-black p-1 font-bold text-center">M/Tan</th>
                            <th className="border border-black p-1 font-bold text-center">T / Hek</th>
                            <th className="border border-black p-1 font-bold text-center">T / Pen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pkt1Rows.map((row: any, idx: number) => (
                            <tr key={row.blok} className="hover:bg-slate-50 transition-colors">
                                {idx === 0 && (
                                    <td title="Peringkat (PKT): 001" className="border border-[#e2e8f0] border-r-black border-l-black p-1 text-center font-bold align-middle" rowSpan={pkt1Rows.length}>
                                        001<br/>({pkt1Rows.length})
                                    </td>
                                )}
                                <td title={`Blok: ${parseInt(row.blok) || row.blok}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{parseInt(row.blok) || row.blok}</td>
                                <td title={`Luas Kawasan (Hek): ${row.luas.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.luas.toFixed(2)}</td>
                                <td title={`Jumlah Peneroka: ${row.peneroka}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.peneroka}</td>
                                <td title={`Pencapaian Hasil - M/Tan: ${row.tan.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tan.toFixed(2)}</td>
                                <td title={`Pencapaian Hasil - T / Hek: ${row.tHek.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tHek.toFixed(2)}</td>
                                <td title={`Pencapaian Hasil - T / Pen: ${row.tPen.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tPen.toFixed(2)}</td>
                                <td title={`Jumlah Nilai Jualan (RM): RM ${row.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                                <td title={`Purata Harga / Tan (RM): RM ${row.price.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.price.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                                <td title={`Purata Pendapatan Kasar Sepeneroka: RM ${row.purataSependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.purataSependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            </tr>
                        ))}
                        {/* PKT 1 TOTAL */}
                        <tr className="bg-[#FFE599] border-black font-bold">
                            <td title="Peringkat (PKT): 001" className="border border-black p-1 text-center font-bold">001</td>
                            <td title={`Total Blok: ${p1BlockRange}`} className="border border-black p-1 text-center">{p1BlockRange}</td>
                            <td title={`Jumlah Luas Kawasan (Hek): ${sumPkt1.luas.toFixed(2)}`} className="border border-black p-1 text-center">{sumPkt1.luas.toFixed(2)}</td>
                            <td title={`Jumlah Peneroka: ${sumPkt1.peneroka}`} className="border border-black p-1 text-center">{sumPkt1.peneroka}</td>
                            <td title={`Pencapaian Hasil - M/Tan: ${sumPkt1.tan.toFixed(2)}`} className="border border-black p-1 text-center">{sumPkt1.tan.toFixed(2)}</td>
                            <td title={`Pencapaian Hasil - T / Hek: ${pkt1THek.toFixed(2)}`} className="border border-black p-1 text-center">{pkt1THek.toFixed(2)}</td>
                            <td title={`Pencapaian Hasil - T / Pen: ${pkt1TPen.toFixed(2)}`} className="border border-black p-1 text-center">{pkt1TPen.toFixed(2)}</td>
                            <td title={`Jumlah Nilai Jualan (RM): RM ${sumPkt1.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{sumPkt1.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            <td title={`Purata Harga / Tan (RM): RM ${pkt1AvgPrice.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{pkt1AvgPrice.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            <td title={`Purata Pendapatan Kasar Sepeneroka: RM ${pkt1Sependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{pkt1Sependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                        </tr>

                        {pkt2Rows.map((row: any, idx: number) => (
                            <tr key={row.blok} className="hover:bg-slate-50 transition-colors">
                                {idx === 0 && (
                                    <td title="Peringkat (PKT): 002" className="border border-[#e2e8f0] border-r-black border-l-black p-1 text-center font-bold align-middle" rowSpan={pkt2Rows.length}>
                                        002<br/>({pkt2Rows.length})
                                    </td>
                                )}
                                <td title={`Blok: ${parseInt(row.blok)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{parseInt(row.blok)}</td>
                                <td title={`Luas Kawasan (Hek): ${row.luas.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.luas.toFixed(2)}</td>
                                <td title={`Jumlah Peneroka: ${row.peneroka}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.peneroka}</td>
                                <td title={`Pencapaian Hasil - M/Tan: ${row.tan.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tan.toFixed(2)}</td>
                                <td title={`Pencapaian Hasil - T / Hek: ${row.tHek.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tHek.toFixed(2)}</td>
                                <td title={`Pencapaian Hasil - T / Pen: ${row.tPen.toFixed(2)}`} className="border border-[#e2e8f0] border-x-black p-1 text-center">{row.tPen.toFixed(2)}</td>
                                <td title={`Jumlah Nilai Jualan (RM): RM ${row.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                                <td title={`Purata Harga / Tan (RM): RM ${row.price.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.price.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                                <td title={`Purata Pendapatan Kasar Sepeneroka: RM ${row.purataSependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-[#e2e8f0] border-x-black p-1 text-right">{row.purataSependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            </tr>
                        ))}
                        {/* PKT 2 TOTAL */}
                        <tr className="bg-[#FFE599] border-black font-bold">
                            <td title="Peringkat (PKT): 002" className="border border-black p-1 text-center font-bold">002</td>
                            <td title={`Total Blok: ${p2BlockRange}`} className="border border-black p-1 text-center">{p2BlockRange}</td>
                            <td title={`Jumlah Luas Kawasan (Hek): ${sumPkt2.luas.toFixed(2)}`} className="border border-black p-1 text-center">{sumPkt2.luas.toFixed(2)}</td>
                            <td title={`Jumlah Peneroka: ${sumPkt2.peneroka}`} className="border border-black p-1 text-center">{sumPkt2.peneroka}</td>
                            <td title={`Pencapaian Hasil - M/Tan: ${sumPkt2.tan.toFixed(2)}`} className="border border-black p-1 text-center">{sumPkt2.tan.toFixed(2)}</td>
                            <td title={`Pencapaian Hasil - T / Hek: ${pkt2THek.toFixed(2)}`} className="border border-black p-1 text-center">{pkt2THek.toFixed(2)}</td>
                            <td title={`Pencapaian Hasil - T / Pen: ${pkt2TPen.toFixed(2)}`} className="border border-black p-1 text-center">{pkt2TPen.toFixed(2)}</td>
                            <td title={`Jumlah Nilai Jualan (RM): RM ${sumPkt2.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{sumPkt2.totalSales.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            <td title={`Purata Harga / Tan (RM): RM ${pkt2AvgPrice.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{pkt2AvgPrice.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                            <td title={`Purata Pendapatan Kasar Sepeneroka: RM ${pkt2Sependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}`} className="border border-black p-1 text-right">{pkt2Sependapatan.toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export const PendapatanBulananTable = React.memo(PendapatanBulananTableComponent);

