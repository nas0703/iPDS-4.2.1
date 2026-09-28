import { toPng, toBlob } from "html-to-image";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface ScreenshotOptions {
  isDarkMode: boolean;
  showToast: (type: "success" | "error", msg: string) => void;
  setIsCapturing: (capturing: boolean) => void;
  setSharePreviewData: (data: { file: File; url: string; name: string } | null) => void;
}

export async function captureTableScreenshot({
  isDarkMode,
  showToast,
  setIsCapturing,
  setSharePreviewData,
}: ScreenshotOptions): Promise<void> {
  const node = document.getElementById("hasil-bulanan-report");
  if (!node) {
    showToast("error", "Laporan tidak dijumpai.");
    return;
  }

  try {
    setIsCapturing(true);
    showToast("success", "Sedang menjana imej HD penuh... Sila tunggu.");

    // Delay to ensure all fonts and styles are loaded
    await new Promise((r) => setTimeout(r, 1000));

    const styleTags = Array.from(document.querySelectorAll("style"));
    const originalContents = styleTags.map((style) => style.textContent || "");

    styleTags.forEach((style) => {
      if (
        style.textContent &&
        (style.textContent.includes("oklab") ||
          style.textContent.includes("oklch") ||
          style.textContent.includes("color("))
      ) {
        style.textContent = style.textContent
          .replace(/oklab\([^)]+\)/gi, "rgb(16, 185, 129)")
          .replace(/oklch\([^)]+\)/gi, "rgb(16, 185, 129)")
          .replace(/color\(srgb[^)]+\)/gi, "rgb(16, 185, 129)");
      }
    });

    const elementsToHide = node.querySelectorAll<HTMLElement>(
      "button, .no-screenshot, .dashboard-controls",
    );
    const originalDisplays = new Map<HTMLElement, string>();

    elementsToHide.forEach((el) => {
      originalDisplays.set(el, el.style.display);
      el.style.setProperty("display", "none", "important");
    });

    let dataUrl = "";
    try {
      const tableContainer = node.querySelector(
        ".overflow-x-auto, .overflow-auto",
      ) as HTMLElement;
      const originalOverflow = tableContainer
        ? tableContainer.style.overflow
        : "";
      const originalWidth = tableContainer ? tableContainer.style.width : "";
      const originalMaxWidth = tableContainer
        ? tableContainer.style.maxWidth
        : "";
      const originalPosition = node.style.position;
      const originalWidthNode = node.style.width;

      const parentWithTransform = node.parentElement;
      let originalTransform = "";
      if (parentWithTransform && parentWithTransform.style.transform) {
        originalTransform = parentWithTransform.style.transform;
        parentWithTransform.style.transform = "none";
      }

      if (tableContainer) {
        tableContainer.style.setProperty("overflow", "visible", "important");
        tableContainer.style.setProperty("width", "auto", "important");
        tableContainer.style.setProperty("max-width", "none", "important");
      }

      node.style.setProperty("width", "max-content", "important");
      node.style.setProperty("position", "relative", "important");

      try {
        dataUrl = await toPng(node, {
          backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
          quality: 1.0,
          pixelRatio: 3,
          width: node.scrollWidth,
          height: node.scrollHeight,
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
            margin: "0",
            width: `${node.scrollWidth}px`,
          },
        });
      } catch (toPngErr) {
        console.warn("toPng failed, falling back to html2canvas:", toPngErr);
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
          logging: false,
        });
        dataUrl = canvas.toDataURL("image/png");
      }

      if (tableContainer) {
        tableContainer.style.overflow = originalOverflow;
        tableContainer.style.width = originalWidth;
        tableContainer.style.maxWidth = originalMaxWidth;
      }
      node.style.position = originalPosition;
      node.style.width = originalWidthNode;
      if (parentWithTransform && originalTransform) {
        parentWithTransform.style.transform = originalTransform;
      }
    } finally {
      elementsToHide.forEach((el) => {
        const origDisplay = originalDisplays.get(el);
        if (origDisplay !== undefined) {
          el.style.display = origDisplay;
        } else {
          el.style.removeProperty("display");
        }
      });

      styleTags.forEach((style, idx) => {
        style.textContent = originalContents[idx];
      });
    }

    if (!dataUrl || dataUrl.length < 100 || dataUrl === "data:,") {
      showToast(
        "error",
        "Sila gunakan tangkapan skrin (screenshot) secara manual atau Cetak PDF.",
      );
      return;
    }

    const fileName = `REPORT_FPMSB_${new Date().toISOString().split("T")[0]}.png`;

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      setSharePreviewData({
        file,
        url: dataUrl,
        name: fileName,
      });
      showToast("success", "Imej sedia untuk dikongsi!");
    } catch (error) {
      console.error("Error preparing image for share:", error);
      showToast("error", "Gagal menyediakan imej.");
    }
  } catch (error) {
    console.error("Screenshot error:", error);
    showToast(
      "error",
      'Gagal menjana imej HD. Sila gunakan "Cetak PDF" sebagai alternatif.',
    );
  } finally {
    setIsCapturing(false);
  }
}

export interface PdfOptions {
  showToast: (type: "success" | "error", msg: string) => void;
  setIsDownloadingPdf: (downloading: boolean) => void;
}

export async function downloadPdf({
  showToast,
  setIsDownloadingPdf,
}: PdfOptions): Promise<void> {
  const node = document.getElementById("hasil-bulanan-report");
  if (!node) {
    showToast("error", "Laporan tidak dijumpai.");
    return;
  }

  try {
    setIsDownloadingPdf(true);
    showToast("success", "Sedang menjana dokumen PDF... Sila tunggu.");

    await new Promise((r) => setTimeout(r, 1000));

    const elementsToHide = node.querySelectorAll<HTMLElement>(
      "button, .no-screenshot, .dashboard-controls",
    );
    const originalDisplays = new Map<HTMLElement, string>();

    elementsToHide.forEach((el) => {
      originalDisplays.set(el, el.style.display);
      el.style.setProperty("display", "none", "important");
    });

    try {
      const tableContainer = node.querySelector(
        ".overflow-x-auto, .overflow-auto",
      ) as HTMLElement;
      const originalOverflow = tableContainer
        ? tableContainer.style.overflow
        : "";
      const originalWidth = tableContainer ? tableContainer.style.width : "";
      const originalMaxWidth = tableContainer
        ? tableContainer.style.maxWidth
        : "";
      const originalPosition = node.style.position;
      const originalWidthNode = node.style.width;

      if (tableContainer) {
        tableContainer.style.setProperty("overflow", "visible", "important");
        tableContainer.style.setProperty("width", "auto", "important");
        tableContainer.style.setProperty("max-width", "none", "important");
      }

      node.style.setProperty("width", "max-content", "important");
      node.style.setProperty("position", "relative", "important");

      const width = node.scrollWidth;
      const height = node.scrollHeight;

      const dataUrl = await toPng(node, {
        backgroundColor: "#FFFFFF",
        quality: 1.0,
        pixelRatio: 2,
        width: width,
        height: height,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          margin: "0",
          padding: "24px",
        },
      });

      const pdfWidth = width + 48;
      const pdfHeight = height + 48;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "l" : "p",
        unit: "px",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `Laporan_Hasil_Bulanan_${new Date().toISOString().split("T")[0]}.pdf`,
      );

      if (tableContainer) {
        tableContainer.style.overflow = originalOverflow;
        tableContainer.style.width = originalWidth;
        tableContainer.style.maxWidth = originalMaxWidth;
      }
      node.style.position = originalPosition;
      node.style.width = originalWidthNode;

      showToast("success", "PDF berjaya dimuat turun!");
    } finally {
      elementsToHide.forEach((el) => {
        const origDisplay = originalDisplays.get(el);
        if (origDisplay !== undefined) {
          el.style.display = origDisplay;
        } else {
          el.style.removeProperty("display");
        }
      });
    }
  } catch (error) {
    console.error("PDF Export error:", error);
    showToast("error", "Gagal menjana dokumen PDF.");
  } finally {
    setIsDownloadingPdf(false);
  }
}

export interface ShareBtsOptions {
  isDarkMode: boolean;
  setIsSharingBts: (sharing: boolean) => void;
}

export async function shareBtsReport({
  isDarkMode,
  setIsSharingBts,
}: ShareBtsOptions): Promise<void> {
  try {
    setIsSharingBts(true);
    const element = document.getElementById("laporan-harga-bts");
    if (!element) return;

    const shareBtn = element.querySelector(".share-bts-btn") as HTMLElement;
    if (shareBtn) shareBtn.style.display = "none";

    const firstRowWithMonth = element.querySelector("tr[data-month]");
    const latestMonth = firstRowWithMonth
      ? firstRowWithMonth.getAttribute("data-month")
      : null;
    const hiddenRows: HTMLElement[] = [];

    if (latestMonth) {
      const allRows = element.querySelectorAll("tr[data-month]");
      let visibleDataDays = 0;

      allRows.forEach((row) => {
        const isMonthHeader = row.querySelector("td[colspan='3']") !== null;

        if (row.getAttribute("data-month") !== latestMonth) {
          const htmlRow = row as HTMLElement;
          htmlRow.style.setProperty("display", "none", "important");
          hiddenRows.push(htmlRow);
        } else if (!isMonthHeader) {
          visibleDataDays++;
          if (visibleDataDays > 10) {
            const htmlRow = row as HTMLElement;
            htmlRow.style.setProperty("display", "none", "important");
            hiddenRows.push(htmlRow);
          }
        }
      });
    }

    const blob = await toBlob(element, {
      pixelRatio: 2,
      backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
    });

    if (shareBtn) shareBtn.style.display = "flex";

    hiddenRows.forEach((row) => {
      row.style.removeProperty("display");
    });

    if (!blob) throw new Error("Gagal menjana imej");

    const file = new File([blob], "laporan_harga_bts.png", {
      type: "image/png",
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Laporan Harga BTS",
        text: "Laporan Harga BTS Terkini",
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "laporan_harga_bts.png";
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Error sharing report:", error);
    alert("Ralat semasa menjana imej laporan.");
  } finally {
    setIsSharingBts(false);
  }
}
