import React from "react";
import {
  Camera,
  Users,
  Award,
  Sparkles,
  CloudUpload,
  DownloadCloud,
  LayoutDashboard,
  Percent,
  Trophy,
} from "lucide-react";

export const RECENT_UPDATES = [
  {
    version: "VER 4.1",
    date: "1 September 2026",
    items: [
      {
        title: "1. Pengukuhan Multi-Tenant & Polisi RLS Enterprise",
        desc: "Pencilan data berasaskan sempadan estet (estate boundary) yang diperkemas serta pengesahan token JWT terautentikasi.",
        icon: <CloudUpload size={18} className="text-emerald-400" />,
        iconBg: "bg-emerald-500/10",
      },
      {
        title: "2. Pematuhan CI/CD & Bencana (DR Preflight Check)",
        desc: "Pengesahan integriti persekitaran pengeluaran dan ujian automatik sedia ada.",
        icon: <Sparkles size={18} className="text-cyan-400" />,
        iconBg: "bg-cyan-500/10",
      },
    ],
  },
  {
    version: "VER 3.5.2",
    date: "12 Ogos 2026",
    items: [
      {
        title: "1. Header MNC Corporate & Muat Naik Logo Custom",
        desc: "Rekaan header korporat berprestij disertai fungsi muat naik logo syarikat terus dari galeri telefon serta penyegerakan masa nyata.",
        icon: <Camera size={18} className="text-emerald-400" />,
        iconBg: "bg-emerald-500/10",
      },
      {
        title: "2. iPDS Muster (Modul Kehadiran Pekerja)",
        desc: "Sistem pengurusan kehadiran harian pekerja ladang, tugasan mengikut sektor/blok, dan eksport Muster Chit.",
        icon: <Users size={18} className="text-teal-400" />,
        iconBg: "bg-teal-500/10",
      },
      {
        title: "3. iPDS Grading (Borang Penggredan BTS Kualiti)",
        desc: "Borang penggredan kualiti BTS ladang bersepadu mengikut standard FPMSB.",
        icon: <Award size={18} className="text-amber-400" />,
        iconBg: "bg-amber-500/10",
      },
      {
        title: "4. Navigasi Profil & Menu 3-Garisan (≡)",
        desc: "Penambahbaikan butang dropdown profil dengan ikon menu 3-garisan yang lebih kemas.",
        icon: <Sparkles size={18} className="text-cyan-400" />,
        iconBg: "bg-cyan-500/10",
      },
      {
        title: "5. Realtime Supabase Database & Storan Awan",
        desc: "Semua rekod disinkronkan secara automatik ke awan Supabase tanpa risiko kehilangan data.",
        icon: <CloudUpload size={18} className="text-indigo-400" />,
        iconBg: "bg-indigo-500/10",
      },
    ],
  },
  {
    version: "VER 3.3",
    date: "27 April 2026",
    items: [
      {
        title: "Muat Turun Pelbagai Format",
        desc: "Keupayaan untuk memuat turun jadual analisis ke dalam format Excel, PDF, PNG, dan Cetakan terus.",
        icon: <DownloadCloud size={16} className="text-emerald-500" />,
        iconBg: "bg-emerald-500/10",
      },
      {
        title: "Paparan Kompak Pro",
        desc: "Rekaan 30% lebih padat dengan pengepala jadual bersepadu untuk pemantauan prestasi blok yang efisien.",
        icon: <LayoutDashboard size={16} className="text-teal-500" />,
        iconBg: "bg-teal-500/10",
      },
      {
        title: "Analisis KPG=KPA %",
        desc: "Ketepatan data kini dipaparkan dalam bentuk peratusan dinamik pada kad ringkasan dan senarai blok.",
        icon: <Percent size={16} className="text-amber-500" />,
        iconBg: "bg-amber-500/10",
      },
      {
        title: "Ranking Dinamik",
        desc: "Sistem ranking blok yang responsif berdasarkan prestasi bulanan dan tahunan.",
        icon: <Trophy size={16} className="text-blue-500" />,
        iconBg: "bg-blue-500/10",
      },
      {
        title: "Muat Naik Resit (OCR)",
        desc: "Muat naik gambar resit dari galeri dan sistem mengekstrak data secara automatik.",
        icon: <CloudUpload size={16} className="text-purple-500" />,
        iconBg: "bg-purple-500/10",
      },
    ],
  },
];
