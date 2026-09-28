/**
 * IPDS VER 3.7 — Disaster Recovery (DR) Type Definitions
 * Shared types for backup manifests, verification results, and safety guards.
 */

export type DREnvironment = 'production' | 'staging' | 'development' | 'recovery' | 'test' | 'unknown';

export interface BackupTableEntry {
  tableName: string;
  rowCount: number;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  status: 'SUCCESS' | 'EMPTY' | 'FAILED' | 'SKIPPED';
  errorMessage?: string;
}

export interface BackupManifest {
  backupId: string;
  version: string;
  createdAt: string;
  sourceEnvironment: DREnvironment;
  sourceHost: string;
  totalTables: number;
  totalRows: number;
  totalSizeBytes: number;
  tables: BackupTableEntry[];
  sha256Checksum: string; // Manifest self-signature
}

export interface DomainVerificationResult {
  domainId: number;
  domainName: string;
  canonicalTable: string;
  resolvedTable: string;
  accessible: boolean;
  rowCount: number;
  status: 'PASS' | 'WARN_ALIAS' | 'FAIL_MISSING';
  details: string;
}

export interface RecoveryVerificationReport {
  timestamp: string;
  environment: DREnvironment;
  targetHost: string;
  connectivity: {
    connected: boolean;
    latencyMs: number;
    error?: string;
  };
  extensions: {
    pgvector: boolean;
    uuidOssp: boolean;
    pgTrgm: boolean;
  };
  domainChecks: DomainVerificationResult[];
  summary: {
    totalDomainsChecked: number;
    passedDomains: number;
    warnedDomains: number;
    failedDomains: number;
    overallStatus: 'ALL_PASS' | 'WARNINGS_PRESENT' | 'CRITICAL_FAILURES';
  };
}

export interface PreflightCheckResult {
  allowed: boolean;
  targetEnvironment: DREnvironment;
  targetHost: string;
  isProductionBlocked: boolean;
  backupId?: string;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

export interface TableReconciliationEntry {
  tableName: string;
  registered: boolean;
  exists: boolean;
  active: boolean;
  backedUp: boolean;
  restorable: boolean;
  rowCount: number;
  reasonIfExcluded?: string;
}

export interface RestoreResult {
  success: boolean;
  targetEnvironment: DREnvironment;
  targetHost: string;
  backupId: string;
  totalTablesAttempted: number;
  tablesRestored: number;
  totalRowsRestored: number;
  elapsedMs: number;
  tableResults: {
    tableName: string;
    rowsRestored: number;
    status: 'RESTORED' | 'SKIPPED' | 'FAILED';
    error?: string;
  }[];
  error?: string;
}

export interface StorageBucketAudit {
  bucketName: string;
  exists: boolean;
  isPublic?: boolean;
  objectCount: number;
  recoveryMethod: string;
  status: 'PASS' | 'EMPTY' | 'MISSING' | 'FAIL' | 'NOT_TESTED';
  representativeFiles: string[];
  details: string;
}

export interface StorageRecoveryReport {
  timestamp: string;
  environment: DREnvironment;
  targetHost: string;
  buckets: StorageBucketAudit[];
  overallStatus: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_TESTED';
  summaryMessage: string;
}

export interface AdversarialTestResult {
  testNumber: number;
  testName: string;
  description: string;
  expectedResult: string;
  actualResult: string;
  passed: boolean;
  durationMs: number;
  errorCaught?: string;
}

export interface Stage2DrillReport {
  timestamp: string;
  environment: DREnvironment;
  backupId: string;
  backupTimestamp: string;
  backupChecksum: string;
  tableReconciliation: TableReconciliationEntry[];
  restorationResult: RestoreResult;
  domainVerification: RecoveryVerificationReport;
  applicationVerification: {
    authPassed: boolean;
    modulesPassed: number;
    totalModules: number;
    ragPassed: boolean;
    observabilityPassed: boolean;
    overallStatus: 'PASS' | 'PARTIAL' | 'FAIL';
    details: Record<string, any>;
  };
  storageVerification: StorageRecoveryReport;
  failureTests: AdversarialTestResult[];
  rpo: {
    targetMinutes: number;
    lastKnownGoodTime: string;
    recoveryPointTime: string;
    measuredMinutes: number | null;
    status: 'PASS' | 'FAIL' | 'NOT_YET_PROVEN';
    notes: string;
  };
  rto: {
    targetMinutes: number;
    recoveryStartTime: string;
    recoveryEndTime: string;
    measuredMinutes: number;
    measuredSeconds: number;
    status: 'PASS' | 'FAIL';
    breakdownMs: Record<string, number>;
  };
  overallStatus: 'PASS' | 'PARTIAL' | 'FAIL';
  remainingGaps: string[];
  recommendationsStage3: string[];
}

