export const getGroupColorTheme = (role: string) => {
  const normalized = role.toLowerCase().trim();
  
  // Mengembalikan tema warna Tailwind mengikut kumpulan pekerja
  if (normalized.includes('mandor') || normalized.includes('supervisor')) {
    return {
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/10',
      border: 'border-amber-200 dark:border-amber-900/30'
    };
  }
  
  if (normalized.includes('am') || normalized.includes('umum') || normalized.includes('general')) {
    return {
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/10',
      border: 'border-blue-200 dark:border-blue-900/30'
    };
  }
  
  if (normalized.includes('tuai') || normalized.includes('harvester') || normalized.includes('potong')) {
    return {
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/10',
      border: 'border-emerald-200 dark:border-emerald-900/30'
    };
  }

  if (normalized.includes('siram') || normalized.includes('baja') || normalized.includes('racun')) {
    return {
      badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900/50',
      text: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/10',
      border: 'border-purple-200 dark:border-purple-900/30'
    };
  }

  // Default theme
  return {
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    border: 'border-slate-200 dark:border-slate-800'
  };
};
