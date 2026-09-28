import React from "react";
import { Share, X, MessageCircle, Download } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharePreviewData: { url: string; name: string; file: File } | null;
  setSharePreviewData: (data: null) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  sharePreviewData,
  setSharePreviewData,
  showToast,
}: ShareModalProps) {
  if (!isOpen || !sharePreviewData) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
            <Share size={20} className="text-emerald-500" />
            Kongsi Imej HD
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-full transition-colors"
            title="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto rounded-xl bg-slate-100 dark:bg-slate-800 mb-4 border border-slate-200 dark:border-slate-700 min-h-0">
          <img
            src={sharePreviewData.url}
            alt="Screenshot Preview"
            className="w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={async () => {
              try {
                if (
                  navigator.canShare &&
                  navigator.canShare({ files: [sharePreviewData.file] })
                ) {
                  await navigator.share({
                    files: [sharePreviewData.file]
                  });
                  setSharePreviewData(null);
                } else {
                  showToast(
                    "error",
                    "Sistem operasi tidak menyokong fungsi Share (Kongsi)",
                  );
                }
              } catch (e) {
                console.error("Share failed", e);
                // It can be a simple cancel by the user; just quietly handle it unless it's not AbortError
                if (e instanceof Error && e.name !== "AbortError") {
                  showToast("error", "Gagal berkongsi.");
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg shadow-[#25D366]/30 uppercase tracking-widest"
          >
            <MessageCircle size={18} />
            Kongsi ke WhatsApp
          </button>

          <button
            onClick={() => {
              const link = document.createElement("a");
              link.href = sharePreviewData.url;
              link.download = sharePreviewData.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              if (typeof window !== "undefined" && "vibrate" in navigator)
                navigator.vibrate([100, 50, 100]);
              showToast("success", "Imej berjaya dimuat turun format PNG.");
              setSharePreviewData(null);
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white py-3.5 rounded-2xl font-bold text-sm transition-all"
          >
            <Download size={18} />
            Muat Turun (Simpan)
          </button>
        </div>
      </div>
    </div>
  );
}
