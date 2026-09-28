/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 🧼 Normalize text (VERY IMPORTANT)
export const normalizeText = (text: string) => {
  return text
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9:.\-\/ ]/g, ''); // remove noise
};

// 🎯 Extract BLOK (before SKB)
export const extractBlok = (text: string) => {
  const match = text.match(/(\d{1,4}(?:-\d+)+)\s*SKB/);
  if (match) {
    const parts = match[1].split('-');
    return parts[parts.length - 1];
  }

  // 🔁 Fallback: try detect last 2 digit near SKB
  const fallback = text.match(/(\d{1,2})\s*SKB/);
  return fallback ? fallback[1] : '';
};

// 🎯 Extract TAN (NETT)
export const extractTan = (text: string) => {
  let match = text.match(/NETT[:\s]*([\d.]+)/);
  if (match) return match[1];

  // 🔁 fallback: detect TONNE or T
  match = text.match(/([\d.]+)\s*T\b/);
  return match ? match[1] : '';
};

// 🎯 Extract RESIT
export const extractResit = (text: string) => {
  let match = text.match(/NOTA\s*HANTARAN[:\s]*([\d]+)/);
  if (match) return match[1];

  // 🔁 fallback: long number (>=8 digits)
  match = text.match(/\b\d{8,}\b/);
  return match ? match[0] : '';
};

// 🎯 Extract LORI
export const extractLori = (text: string) => {
  let match = text.match(/NO\.?\s*LORI[:\s]*([A-Z0-9]+)/);
  if (match) return match[1];

  // 🔁 fallback: plate-like pattern
  match = text.match(/\b[A-Z]{1,3}\d{2,4}[A-Z]?\b/);
  return match ? match[0] : '';
};

// 🧠 Confidence Check
export const calculateConfidence = (data: { no_resit: string; no_lori: string; blok: string; tan: string }) => {
  let score = 0;

  if (data.no_resit) score += 25;
  if (data.no_lori) score += 25;
  if (data.blok) score += 25;
  if (data.tan) score += 25;

  return score; // out of 100
};

// 🚀 MAIN PARSER
export const parseReceipt = (rawText: string) => {
  const text = normalizeText(rawText);

  const result = {
    no_resit: extractResit(text),
    no_lori: extractLori(text),
    blok: extractBlok(text),
    tan: extractTan(text),
  };

  const confidence = calculateConfidence(result);

  return { ...result, confidence };
};
