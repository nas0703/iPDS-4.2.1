/**
 * iPDS v4.1.0 — Phone Number Utilities
 * Standardized sanitization, local/international conversion, and display formatting for Malaysia (+60)
 */

export const cleanMalaysiaPhone = (phone: string | null | undefined): string => {
  let cleaned = (phone || '').replace(/\D/g, '');
  // Remove accidental repeated country codes like 6060...
  while (cleaned.startsWith('6060')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.slice(1);
  } else if (!cleaned.startsWith('60') && cleaned.length >= 8) {
    cleaned = '60' + cleaned;
  }
  return cleaned || '60177853551';
};

export const toLocalMalaysiaPhone = (phone: string | null | undefined): string => {
  const clean = cleanMalaysiaPhone(phone);
  if (clean.startsWith('60')) {
    return '0' + clean.slice(2);
  }
  return clean;
};

export const formatDisplayMalaysiaPhone = (phone: string | null | undefined): string => {
  const local = toLocalMalaysiaPhone(phone);
  if (local.startsWith('011') && local.length >= 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 7)} ${local.slice(7)}`;
  } else if (local.length >= 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return local;
};
