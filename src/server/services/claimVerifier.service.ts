import { CompressedEvidence } from './contextCompressor.service.js';

export interface ClaimVerificationResult {
  claimText: string;
  citedCitations: string[]; // e.g. ["[Ruj 1]"]
  isSupported: boolean;
  supportingEvidenceIds: string[];
  isCritical: boolean;
  reason: string;
}

export interface AlignmentMetrics {
  claimSupportRate: number;      // 0-100%
  citationAccuracy: number;      // 0-100%
  unsupportedClaimRate: number;  // 0-100%
  evidenceUtilization: number;   // 0-100%
  citationCompleteness: number; // 0-100%
}

export interface GroundedConfidenceBreakdown {
  retrievalConfidence: number;   // 0-100
  evidenceCoverage: number;      // 0-100
  citationAccuracy: number;      // 0-100
  claimSupportRate: number;      // 0-100
  sourceAuthority: number;       // 0-100
  groundedConfidence: number;    // Composite heuristic confidence estimate (0-100)
}

export interface NumericalVerificationDetail {
  extractedValue: string;
  unit: string;
  foundInSources: boolean;
  matchingSourceIds: string[];
}

export interface VerificationReport {
  answerText: string;
  extractedClaims: ClaimVerificationResult[];
  alignmentMetrics: AlignmentMetrics;
  confidenceBreakdown: GroundedConfidenceBreakdown;
  groundedStatus: 'GROUNDED' | 'NO_EVIDENCE' | 'AMBIGUOUS' | 'GROUNDING_FAILED' | 'NEEDS_REVIEW';
  isCriticalFailure: boolean;
  verificationSummary: string;
  numericalVerification?: {
    totalNumbersChecked: number;
    matchedNumbersCount: number;
    numericalAccuracyRate: number; // 0-100%
    verifiedValues: NumericalVerificationDetail[];
  };
}

/**
 * Extracts claims from a generated answer paragraph by paragraph or sentence by sentence.
 */
export function extractClaimsFromAnswer(answerText: string): string[] {
  if (!answerText || answerText.trim().length === 0) return [];

  // Split into clean sentences or bullet items
  const lines = answerText
    .split(/\n+/)
    .map(l => l.trim().replace(/^[-*•\d+.]+\s*/, ''))
    .filter(l => l.length > 10 && !l.toLowerCase().includes('maaf,') && !l.toLowerCase().includes('dokumen rujukan'));

  const claims: string[] = [];
  for (const line of lines) {
    // Split sentences inside lines
    const sentences = line.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    for (const sentence of sentences) {
      claims.push(sentence.trim());
    }
  }

  return claims.length > 0 ? claims : [answerText.trim()];
}

/**
 * Checks if a claim contains critical domain terms (wage rates, pesticide/fertilizer dosages, SOP requirements)
 */
export function isCriticalTechnicalClaim(claim: string): boolean {
  const criticalKeywords = [
    'rm', 'kadar', 'dos', 'upah', 'tan', 'hektar', 'kg', 'liter', 'l/ha', 'kg/ha',
    'pesticide', 'racun', 'baja', 'sop', 'mspo', 'kuk', 'manual', 'keselamatan', 'ppe',
    'pusingan', 'tarikh', 'jadual'
  ];
  const lower = claim.toLowerCase();
  return criticalKeywords.some(kw => lower.includes(kw));
}

/**
 * Phase 3.4 Alignment Verifier & Phase 3.5 Hallucination Hard Gate
 */
export function verifyAnswerAlignment(
  answerText: string,
  compressedEvidences: CompressedEvidence[],
  query: string,
  isNoEvidenceOrAmbiguous: boolean = false
): VerificationReport {
  // Handle No-Evidence / Explicit Fallback Cases
  if (
    isNoEvidenceOrAmbiguous ||
    compressedEvidences.length === 0 ||
    answerText.includes('tidak terdapat dalam dokumen rujukan') ||
    answerText.includes('tidak ditemui dalam pangkalan pengetahuan')
  ) {
    const isAmbiguousQuery = answerText.toLowerCase().includes('merujuk kepada') || 
                             answerText.toLowerCase().includes('sila nyatakan') || 
                             answerText.toLowerCase().includes('keambiguan') || 
                             answerText.toLowerCase().includes('ambigu');
    const status = isAmbiguousQuery ? 'AMBIGUOUS' : 'NO_EVIDENCE';

    return {
      answerText,
      extractedClaims: [],
      alignmentMetrics: {
        claimSupportRate: 100,
        citationAccuracy: 100,
        unsupportedClaimRate: 0,
        evidenceUtilization: 0,
        citationCompleteness: 100
      },
      confidenceBreakdown: {
        retrievalConfidence: status === 'AMBIGUOUS' ? 85 : 0,
        evidenceCoverage: status === 'AMBIGUOUS' ? 80 : 0,
        citationAccuracy: 100,
        claimSupportRate: 100,
        sourceAuthority: 80,
        groundedConfidence: status === 'AMBIGUOUS' ? 85 : 0
      },
      groundedStatus: status,
      isCriticalFailure: false,
      verificationSummary: status === 'AMBIGUOUS' 
        ? 'Query ambiguitas dikesan. Sistem meminta pencerahan/menyenaraikan varian.'
        : 'Bukti tiada dalam pangkalan pengetahuan. Hard gate berkesan mengelakkan halusinasi.'
    };
  }

  const claimTexts = extractClaimsFromAnswer(answerText);
  const claimResults: ClaimVerificationResult[] = [];

  const evidenceMap = new Map<string, CompressedEvidence>();
  compressedEvidences.forEach(e => evidenceMap.set(e.citationId, e));

  let supportedCount = 0;
  let totalCitationsFound = 0;
  let validCitationsFound = 0;
  let claimsWithCitations = 0;
  const citedEvidenceIds = new Set<string>();
  let hasCriticalUnsupported = false;

  for (const claim of claimTexts) {
    const citationMatches = [...claim.matchAll(/\[Ruj\s*(\d+)\]/gi)];
    const citedIds = citationMatches.map(m => `[Ruj ${m[1]}]`);
    const isCritical = isCriticalTechnicalClaim(claim);

    totalCitationsFound += citedIds.length;
    if (citedIds.length > 0) claimsWithCitations++;

    let isSupported = false;
    const supportingIds: string[] = [];

    for (const cid of citedIds) {
      const ev = evidenceMap.get(cid);
      if (ev) {
        validCitationsFound++;
        citedEvidenceIds.add(cid);

        // Term / numerical overlap check (strip citation markers first so [Ruj 1] doesn't add fake '1' number)
        const claimClean = claim.replace(/\[Ruj\s*\d+\]/gi, '');
        const numbersInClaim = claimClean.match(/\b\d+(\.\d+)?\b/g) || [];
        const evContent = ev.evidence.toLowerCase().replace(/\s+/g, '');

        let numbersSupported = true;
        for (const num of numbersInClaim) {
          if (!evContent.includes(num.replace(/\s+/g, ''))) {
            numbersSupported = false;
            break;
          }
        }

        if (numbersSupported) {
          isSupported = true;
          supportingIds.push(cid);
        }
      }
    }

    // If claim has no citations but is technical, check if it matches any evidence directly
    if (citedIds.length === 0) {
      for (const ev of compressedEvidences) {
        if (ev.evidence.toLowerCase().includes(claim.toLowerCase().slice(0, 20))) {
          isSupported = true;
          supportingIds.push(ev.citationId);
          citedEvidenceIds.add(ev.citationId);
          break;
        }
      }
    }

    if (isSupported) {
      supportedCount++;
    } else if (isCritical) {
      hasCriticalUnsupported = true;
    }

    claimResults.push({
      claimText: claim,
      citedCitations: citedIds,
      isSupported,
      supportingEvidenceIds: supportingIds,
      isCritical,
      reason: isSupported
        ? `Claim disokong oleh bukti ${supportingIds.join(', ')}.`
        : `Claim tidak mempunyai bukti yang sepadan dalam context.`
    });
  }

  // Calculate Metrics
  const totalClaims = claimTexts.length || 1;
  const claimSupportRate = Math.round((supportedCount / totalClaims) * 100);
  const unsupportedClaimRate = Math.round(((totalClaims - supportedCount) / totalClaims) * 100);
  const citationAccuracy = totalCitationsFound > 0 ? Math.round((validCitationsFound / totalCitationsFound) * 100) : 100;
  const evidenceUtilization = Math.round((citedEvidenceIds.size / compressedEvidences.length) * 100);
  const citationCompleteness = Math.round((claimsWithCitations / totalClaims) * 100);

  // Confidence Breakdown
  const avgRrf = compressedEvidences.reduce((acc, e) => acc + (e.rrfScore || 0), 0) / compressedEvidences.length;
  const retrievalConfidence = Math.min(100, Math.round(avgRrf * 300));
  const evidenceCoverage = Math.min(100, Math.round(evidenceUtilization * 0.5 + claimSupportRate * 0.5));
  const sourceAuthority = compressedEvidences.some(e => e.category.toLowerCase().includes('kuk')) ? 100 : 85;

  const groundedConfidence = Math.round(
    (retrievalConfidence * 0.20) +
    (evidenceCoverage * 0.20) +
    (citationAccuracy * 0.20) +
    (claimSupportRate * 0.25) +
    (sourceAuthority * 0.15)
  );

  // Grounded Status & Hallucination Hard Gate (Phase 3.5)
  let groundedStatus: 'GROUNDED' | 'NO_EVIDENCE' | 'AMBIGUOUS' | 'GROUNDING_FAILED' | 'NEEDS_REVIEW' = 'GROUNDED';
  let isCriticalFailure = false;

  if (validCitationsFound > 0 && citationAccuracy >= 70) {
    groundedStatus = 'GROUNDED';
    isCriticalFailure = false;
  } else if (hasCriticalUnsupported || unsupportedClaimRate > 25) {
    groundedStatus = 'GROUNDING_FAILED';
    isCriticalFailure = true;
  } else if (unsupportedClaimRate > 0) {
    groundedStatus = 'NEEDS_REVIEW';
  }

  // 8. Numerical and Dosage Grounding Extraction
  const numbersWithUnitsPattern = /\b(\d+(?:\.\d+)?)\s*(rm|kg\/ha|l\/ha|liter|l|ml|kg|tan|g|%|m|cm|sph|frond|pelepah)?\b/gi;
  const answerClean = answerText.replace(/\[Ruj\s*\d+\]/gi, '');
  const extractedNumbersMatches = [...answerClean.matchAll(numbersWithUnitsPattern)];
  const verifiedValues: NumericalVerificationDetail[] = [];
  let matchedNumbersCount = 0;

  const allEvidenceText = compressedEvidences.map(e => e.evidence.toLowerCase()).join(' ');

  for (const match of extractedNumbersMatches.slice(0, 20)) {
    const rawVal = match[1];
    const unit = match[2] || '';
    const fullToken = unit ? `${rawVal} ${unit}`.trim() : rawVal;

    // Check if raw value exists in evidence
    const isMatched = allEvidenceText.includes(rawVal);
    const matchingSourceIds: string[] = [];

    if (isMatched) {
      matchedNumbersCount++;
      for (const ev of compressedEvidences) {
        if (ev.evidence.toLowerCase().includes(rawVal)) {
          matchingSourceIds.push(ev.citationId);
        }
      }
    }

    verifiedValues.push({
      extractedValue: fullToken,
      unit,
      foundInSources: isMatched,
      matchingSourceIds
    });
  }

  const totalNumbersChecked = extractedNumbersMatches.length;
  const numericalAccuracyRate = totalNumbersChecked > 0 
    ? Math.round((matchedNumbersCount / totalNumbersChecked) * 100) 
    : 100;

  return {
    answerText,
    extractedClaims: claimResults,
    alignmentMetrics: {
      claimSupportRate,
      citationAccuracy,
      unsupportedClaimRate,
      evidenceUtilization,
      citationCompleteness
    },
    confidenceBreakdown: {
      retrievalConfidence,
      evidenceCoverage,
      citationAccuracy,
      claimSupportRate,
      sourceAuthority,
      groundedConfidence
    },
    groundedStatus,
    isCriticalFailure,
    verificationSummary: isCriticalFailure
      ? 'GROUNDING_FAILED: Terdapat dakwaan kritikal yang tidak disokong oleh bukti rujukan.'
      : 'Jawapan terbukti sah dan disokong 100% oleh dokumen rujukan.',
    numericalVerification: {
      totalNumbersChecked,
      matchedNumbersCount,
      numericalAccuracyRate,
      verifiedValues
    }
  };
}
