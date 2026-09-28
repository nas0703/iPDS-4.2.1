import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';

interface MorningBriefingAcronymModalProps {
  isOpen: boolean;
  onClose: () => void;
  acronymDict: Record<string, string>;
  onSaveAcronym: (acronym: string, pronunciation: string) => void;
  onDeleteAcronym: (acronym: string) => void;
}

export const MorningBriefingAcronymModal: React.FC<MorningBriefingAcronymModalProps> = ({
  isOpen,
  onClose,
  acronymDict,
  onSaveAcronym,
  onDeleteAcronym,
}) => {
  const [newAcronym, setNewAcronym] = useState('');
  const [newPronunciation, setNewPronunciation] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAcronym.trim() || !newPronunciation.trim()) return;
    onSaveAcronym(newAcronym.trim().toUpperCase(), newPronunciation.trim());
    setNewAcronym('');
    setNewPronunciation('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Kamus Sebutan Singkatan Sawit</h3>
              <p className="text-xs text-slate-400">Sesuaikan cara AI membaca istilah teknikal & singkatan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Singkatan (cth: MOP)"
            value={newAcronym}
            onChange={(e) => setNewAcronym(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Sebutan (cth: M-O-P)"
            value={newPronunciation}
            onChange={(e) => setNewPronunciation(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </form>

        {/* Acronym List */}
        <div className="mt-4 max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {Object.entries(acronymDict).map(([acr, pron]) => (
            <div
              key={acr}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
            >
              <div>
                <span className="font-bold text-emerald-400">{acr}</span>
                <span className="text-slate-400 ml-2">→ dibaca sebagai:</span>
                <span className="font-medium text-slate-200 ml-1.5">{pron}</span>
              </div>
              <button
                onClick={() => onDeleteAcronym(acr)}
                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {Object.keys(acronymDict).length === 0 && (
            <div className="text-center py-6 text-xs text-slate-500">Tiada singkatan khas didaftarkan.</div>
          )}
        </div>
      </div>
    </div>
  );
};
