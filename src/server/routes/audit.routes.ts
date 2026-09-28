/**
 * iPDS v3.8 — Administrative Security Audit Log Query Router
 * 
 * STRICT RBAC:
 * - Only authorized managerial roles ('pf', 'fc') can query audit logs.
 * - Append-only: No delete or update endpoint exists.
 */

import express from 'express';
import { requireRole } from '../middleware/auth.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import { auditService, AuditAction, AuditResult } from '../services/audit.service.js';

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Retrieves security and business operational audit events with filtering
 */
router.get('/admin/audit-logs', requireRole(['pf', 'fc']), adminRateLimiter, (req, res) => {
  try {
    const {
      action,
      role,
      estate_id,
      result,
      search,
      limit = '50',
      offset = '0'
    } = req.query;

    const parsedLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    const queryResult = auditService.query({
      action: action as AuditAction | undefined,
      role: role ? String(role) : undefined,
      estateId: estate_id ? String(estate_id) : undefined,
      result: result as AuditResult | undefined,
      search: search ? String(search) : undefined,
      limit: parsedLimit,
      offset: parsedOffset
    });

    return res.json({
      success: true,
      data: queryResult.logs,
      pagination: {
        total: queryResult.total,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (err: unknown) {
    console.error('[API AuditLogs] Query error:', err);
    return res.status(500).json({
      success: false,
      error: 'Ralat mendapatkan log audit keselamatan.',
      code: 'AUDIT_QUERY_ERROR'
    });
  }
});

export default router;
