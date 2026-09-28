import React, { useState, useEffect } from 'react';
import { Leaf, Eye, X } from 'lucide-react';
import { WEED_DATABASE, WeedMasterProfile } from '../../../data/weedDatabase';

export const CATEGORY_THEMES: Record<string, { bg: string; border: string; badge: string; text: string; icon: string }> = {
  'Woody/Shrub': {
    bg: 'from-amber-950/70 via-slate-900 to-slate-950',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    text: 'text-amber-400',
    icon: '🌳',
  },
  'Broadleaf': {
    bg: 'from-teal-950/70 via-slate-900 to-slate-950',
    border: 'border-teal-500/40',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    text: 'text-teal-400',
    icon: '🍃',
  },
  'Fern': {
    bg: 'from-emerald-950/70 via-slate-900 to-slate-950',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-400',
    icon: '🌿',
  },
  'Grass': {
    bg: 'from-green-950/70 via-slate-900 to-slate-950',
    border: 'border-green-500/40',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
    text: 'text-green-400',
    icon: '🌾',
  },
  'Climber': {
    bg: 'from-purple-950/70 via-slate-900 to-slate-950',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    text: 'text-purple-400',
    icon: '➰',
  },
  'Sedge': {
    bg: 'from-sky-950/70 via-slate-900 to-slate-950',
    border: 'border-sky-500/40',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    text: 'text-sky-400',
    icon: '🎋',
  },
};

export const resolveWeedProfile = (alt?: string, src?: string): WeedMasterProfile | undefined => {
  const query = `${alt || ''} ${src || ''}`.toLowerCase();
  if (!query.trim()) return undefined;

  return WEED_DATABASE.find((w) => {
    if (query.includes(w.id.toLowerCase()) || w.id.toLowerCase().includes(query)) return true;

    const malayParts = w.malayName.toLowerCase().split('/').map((p) => p.trim());
    if (malayParts.some((p) => p.length > 2 && query.includes(p))) return true;

    const sciLower = w.scientificName.toLowerCase();
    if (query.includes(sciLower)) return true;
    const sciWords = sciLower.split(' ').filter((word) => word.length > 3 && !['spp.', 'subsp.', 'var.'].includes(word));
    if (sciWords.some((word) => query.includes(word))) return true;

    if (
      w.synonyms?.some((s) => {
        const sLower = s.toLowerCase();
        return query.includes(sLower) || sLower.split(' ').some((word) => word.length > 3 && query.includes(word));
      })
    )
      return true;

    const engParts = (w.englishName || '').toLowerCase().split('/').map((p) => p.trim());
    if (engParts.some((p) => p.length > 3 && query.includes(p))) return true;

    return false;
  });
};

export const WeedSpecimenImageCard: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  const matchedWeed = resolveWeedProfile(alt, src);
  const category = matchedWeed?.category || 'Broadleaf';
  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES['Broadleaf'];

  const initialUrl = matchedWeed?.imageUrl || src;
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    setPhotoLoaded(false);
    setPhotoError(false);
  }, [src, alt, initialUrl]);

  const displayName = matchedWeed?.malayName || alt || 'Spesimen Rumpai Sawit';
  const scientific = matchedWeed?.scientificName || '';
  const family = matchedWeed?.family || '';

  return (
    <div className={`my-3.5 rounded-2xl overflow-hidden border ${theme.border} bg-slate-950 shadow-xl transition-all`}>
      <div className={`relative w-full h-48 sm:h-56 bg-gradient-to-br ${theme.bg} flex items-center justify-center overflow-hidden group select-none`}>
        <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
          <svg className="w-48 h-48 text-emerald-400/20" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 0 C60 30 90 40 100 50 C70 60 60 90 50 100 C40 70 10 60 0 50 C30 40 40 10 50 0 Z" />
          </svg>
        </div>

        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/10 text-[10.5px] font-bold text-white shadow">
          <span>{theme.icon}</span>
          <span className="truncate max-w-[200px]">{category}</span>
          {family && <span className="text-slate-400 font-normal">| {family}</span>}
        </div>

        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-500/30 text-[10px] font-bold text-emerald-300 shadow">
          <Leaf className="w-3.5 h-3.5 text-emerald-400" />
          <span>Spesimen Botani Sahih</span>
        </div>

        {(!photoLoaded || photoError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10 animate-in fade-in">
            <span className="text-3xl mb-1 filter drop-shadow-md">{theme.icon}</span>
            <h4 className="text-sm sm:text-base font-bold text-white tracking-wide drop-shadow">{displayName}</h4>
            {scientific && <p className="text-xs text-emerald-300 font-medium italic mt-0.5 drop-shadow">{scientific}</p>}
            {matchedWeed?.morphology?.description && (
              <p className="text-[10.5px] text-slate-300 line-clamp-1 max-w-[85%] mt-1.5 opacity-90">
                {matchedWeed.morphology.description}
              </p>
            )}
          </div>
        )}

        {!photoError && initialUrl && (
          <img
            src={initialUrl}
            alt={displayName}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-500 cursor-pointer ${
              photoLoaded ? 'opacity-100 scale-100 hover:scale-105' : 'opacity-0 scale-95 pointer-events-none'
            }`}
            loading="eager"
            referrerPolicy="no-referrer"
            onLoad={() => setPhotoLoaded(true)}
            onError={() => {
              setPhotoError(true);
              setPhotoLoaded(true);
            }}
            onClick={() => setShowFullImage(true)}
          />
        )}

        {photoLoaded && !photoError && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none z-10" />
        )}

        {photoLoaded && !photoError && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
            <div>
              <h5 className="text-xs font-bold text-white drop-shadow-md">{displayName}</h5>
              {scientific && <p className="text-[10px] text-emerald-300 italic drop-shadow">{scientific}</p>}
            </div>
            <button
              onClick={() => setShowFullImage(true)}
              className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/80 hover:bg-slate-900 text-slate-200 text-[10px] font-medium border border-white/10 backdrop-blur-sm transition-all"
            >
              <Eye className="w-3 h-3 text-emerald-400" /> Zum
            </button>
          </div>
        )}
      </div>

      {matchedWeed && (
        <div className="p-3 bg-slate-900/90 space-y-2 text-[11px] text-slate-300 border-t border-slate-800">
          {matchedWeed.morphology?.description && (
            <div>
              <span className="font-bold text-slate-200">Penerangan:</span> {matchedWeed.morphology.description}
            </div>
          )}
          {matchedWeed.chemicalControl && matchedWeed.chemicalControl.length > 0 && (
            <div>
              <span className="font-bold text-emerald-400">Kawalan Syor:</span>{' '}
              {matchedWeed.chemicalControl.map((c) => `${c.activeIngredient} (${c.rate16L})`).join(', ')}
            </div>
          )}
        </div>
      )}

      {showFullImage && initialUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-200 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={initialUrl} alt={displayName} className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
};
