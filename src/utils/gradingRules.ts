import { cleanAndExtractBlockCode } from './formatters';

export type FieldGrade = 'A' | 'B' | 'C' | 'D';

export interface FieldGradeResult {
  grade: FieldGrade;
  label: string;
  badgeTheme: 'emerald' | 'sky' | 'amber' | 'rose';
  rejectPct: number;
  masakPct: number;
}

export function evaluateFieldGrade(
  totalGred: number,
  tandanDiTinggal: number,
  masak: number
): FieldGradeResult {
  const rejectPct = totalGred ? (tandanDiTinggal / totalGred) * 100 : 0;
  const masakPct = totalGred ? (masak / totalGred) * 100 : 0;

  if (rejectPct > 10 || masakPct < 80) {
    return { grade: 'D', label: 'Kritikal / Perhatian', badgeTheme: 'rose', rejectPct, masakPct };
  }
  if (rejectPct > 5 || masakPct < 85) {
    return { grade: 'C', label: 'Sederhana', badgeTheme: 'amber', rejectPct, masakPct };
  }
  if (rejectPct > 2 || masakPct < 90) {
    return { grade: 'B', label: 'Baik', badgeTheme: 'sky', rejectPct, masakPct };
  }
  return { grade: 'A', label: 'Cemerlang', badgeTheme: 'emerald', rejectPct, masakPct };
}

export function normalizeGradingBlock(value?: string | null): string {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const composite = raw.match(/^\d{2}\/([0-9]{1,3}[A-Z]?)$/);
  if (composite) return normalizeNumericBlock(composite[1]);
  if (['LF', 'LF PKT 1', 'LF PKT 2', 'LOT FELDA', '88 F', 'F88'].includes(raw)) return '88F';

  const cleaned = cleanAndExtractBlockCode(raw);
  return normalizeNumericBlock(cleaned);
}

export function normalizeGradingLorry(value?: string | null): string {
  return normalizeLorryNo(value || '').replace(/[^A-Z0-9]/g, '');
}

export function normalizeLorryNo(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim().toUpperCase();
  if (trimmed.includes('TEST')) return '';

  const clean = trimmed.replace(/\s+/g, ' ');
  const match = clean.match(/^([A-Z]+)\s*([0-9]+)\s*([A-Z]*)$/);
  if (match) {
    return `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ''}`.trim();
  }
  return clean;
}

function normalizeNumericBlock(value: string): string {
  return /^\d+$/.test(value) ? String(parseInt(value, 10)) : value;
}
