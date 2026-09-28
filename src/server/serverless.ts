import express from "express";
import cookieParser from "cookie-parser";
import dotenv from 'dotenv';
import path from 'path';
import { getSupabase, isMissingTableError } from './db.js';
import { APP_VERSION, getVersionInfo, getVersionHeaders } from '../config/version.js';

import authRoutes from './routes/auth.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { csrfProtection } from './middleware/csrf.js';
import { observabilityMiddleware } from './middleware/observability.js';
import { securityHeadersMiddleware, corsAllowListMiddleware } from './middleware/securityHeaders.js';
import { generalApiRateLimiter } from './middleware/rateLimiter.js';
import { metricsCollector } from './observability/metrics.js';
import merumputRoutes from './routes/merumput.routes.js';
import pruningRoutes from './routes/pruning.routes.js';
import hasilRoutes from './routes/hasil.routes.js';
import fertilizerRoutes from './routes/fertilizer.routes.js';
import hantaranRoutes from './routes/hantaran.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import slidesRoutes from './routes/slides.routes.js';
import aiRoutes from './routes/ai.routes.js';
import visionRoutes from './routes/ai/vision.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import healthRoutes from './routes/health.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import cronRoutes from './routes/cron.routes.js';
import hujanRoutes from './routes/hujan.routes.js';
import workersRoutes from './routes/workers.routes.js';
import penggredanRoutes from './routes/penggredan.routes.js';
import gradingTasksRoutes from './routes/gradingTasks.routes.js';
import devicesRoutes from './routes/devices.routes.js';
import employeesRoutes from './routes/employees.routes.js';

console.log("Loading API routes from src/server/serverless.ts...");

dotenv.config();

const app = express();

// Enable standard single-hop reverse proxy trust (Cloud Run, Vercel, Nginx)
app.set('trust proxy', 1);

// Enterprise defense-in-depth Security Headers & CORS Allow-list
app.use(securityHeadersMiddleware);
app.use(corsAllowListMiddleware);

// Add cookie-parser middleware
app.use(cookieParser());

// 1. Scoped Body Parsers for Large File/Image/Audio/PDF Upload Routes
// Vision OCR, Weed Vision, Audio Transcription & PDF Ingestion (up to 25MB for audio/PDF, 15MB for images)
const largeMediaParser = express.json({ limit: '25mb' });
app.use(['/api/ai', '/api/ocr-receipt', '/ocr-receipt', '/ai/ocr-receipt'], largeMediaParser);

// Custom Logo Upload (Base64 dataURI up to 10MB)
const logoUploadParser = express.json({ limit: '10mb' });
app.use(['/api/settings/logo', '/api/logo', '/settings/logo', '/logo'], logoUploadParser);

// 2. Default Body Parser for standard API payloads (strictly bounded to 1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Malformed JSON & Payload Too Large Guard (Fail-fast with clean 400 / 413)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.status === 413 || err.type === 'entity.too.large')) {
    const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
    return res.status(413).json({
      success: false,
      error: 'Saiz muatan melebihi had yang dibenarkan.',
      code: 'PAYLOAD_TOO_LARGE',
      correlationId
    });
  }
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
    metricsCollector.recordSecurityEvent('malformed_payload', { path: req.path, method: req.method });
    console.warn(`[MALFORMED_JSON_GUARD] [${correlationId}] Rejected malformed JSON payload on ${req.method} ${req.path}`);
    return res.status(400).json({
      success: false,
      error: 'Format muatan JSON tidak sah atau rosak.',
      code: 'INVALID_JSON_PAYLOAD',
      correlationId
    });
  }
  next(err);
});

// Dynamic Supabase configuration injector for client browser
const serveSupabaseConfig = (req: express.Request, res: express.Response) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`window.__SUPABASE_URL__ = ${JSON.stringify(url)};\nwindow.__SUPABASE_ANON_KEY__ = ${JSON.stringify(anonKey)};\n`);
};

app.get(['/api/supabase-config.js', '/supabase-config.js'], serveSupabaseConfig);

// Add direct resilient route mounts on app for Vercel Serverless Function entry point
app.use("/api/ai", visionRoutes);
app.use("/api/ocr-receipt", visionRoutes);
app.use("/ai/ocr-receipt", visionRoutes);
app.use("/ocr-receipt", visionRoutes);
app.use("/api/ai", aiRoutes);

const apiRouter = express.Router();

// DEBUG: Log all incoming requests for troubleshooting route 404s
apiRouter.use((req, res, next) => {
  if (req.path.includes('/ai/') || req.path.includes('/ocr-') || req.path.includes('/test-')) {
    console.log(`[API_DEBUG_ROUTER] ${new Date().toISOString()} ${req.method} ${req.url} (Path: ${req.path})`);
  }
  next();
});

apiRouter.get('/test-direct', (req, res) => {
  res.json({ success: true, message: 'apiRouter test-direct reached' });
});

// Parse cookies on API router
apiRouter.use(cookieParser());

// Defense-in-depth security headers and CORS policy
apiRouter.use(securityHeadersMiddleware);
apiRouter.use(corsAllowListMiddleware);

// Request logging and observability middleware
apiRouter.use(observabilityMiddleware);

// NEW: Mount AI and Vision routes under /ai, /ocr-receipt, and root on apiRouter
apiRouter.use("/ai", visionRoutes);
apiRouter.use("/ai", aiRoutes);
apiRouter.use("/ocr-receipt", visionRoutes);
apiRouter.use("/", visionRoutes);

// Attach IPDS Version Headers across all API responses
apiRouter.use((req, res, next) => {
  const headers = getVersionHeaders();
  for (const [key, val] of Object.entries(headers)) {
    res.setHeader(key, val);
  }
  next();
});

// HTTP Method Safety Guard (Reject TRACE, TRACK, CONNECT with 405 Method Not Allowed)
apiRouter.use((req, res, next) => {
  const disallowedMethods = ['TRACE', 'TRACK', 'CONNECT'];
  if (disallowedMethods.includes(req.method.toUpperCase())) {
    const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
    return res.status(405).json({
      success: false,
      error: `Kaedah HTTP ${req.method} tidak dibenarkan.`,
      code: 'METHOD_NOT_ALLOWED',
      correlationId
    });
  }
  next();
});

// JSON error guard for apiRouter
apiRouter.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
    metricsCollector.recordSecurityEvent('malformed_payload', { path: req.path, method: req.method });
    return res.status(400).json({
      success: false,
      error: 'Format muatan JSON tidak sah atau rosak.',
      code: 'INVALID_JSON_PAYLOAD',
      correlationId
    });
  }
  next(err);
});

apiRouter.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// General API Rate Limiting (150 req/min with fail-open)
apiRouter.use(generalApiRateLimiter);

// Enforce CSRF protection for all mutating API requests (POST, PUT, PATCH, DELETE)
apiRouter.use(csrfProtection);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/merumput', merumputRoutes);
apiRouter.use('/pruning', pruningRoutes);
apiRouter.use('/hasil', hasilRoutes);
apiRouter.use('/fertilizer', fertilizerRoutes);
apiRouter.use('/hantaran', hantaranRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/slides', slidesRoutes);
apiRouter.use('/telemetry', telemetryRoutes);
apiRouter.use('/jobs', jobsRoutes);
apiRouter.use('/cron', cronRoutes);
apiRouter.use('/hujan', hujanRoutes);
apiRouter.use('/workers', workersRoutes);
apiRouter.use('/penggredan', penggredanRoutes);
apiRouter.use('/grading-tasks', gradingTasksRoutes);
apiRouter.use('/devices', devicesRoutes);
apiRouter.use('/employees', employeesRoutes);

// Direct root fallbacks for legacy and module endpoints to support both prefixed and flat routing
apiRouter.use(authRoutes);
apiRouter.use(employeesRoutes);
apiRouter.use(pruningRoutes);
apiRouter.use(merumputRoutes);
apiRouter.use(hantaranRoutes);
apiRouter.use(hasilRoutes);
apiRouter.use(penggredanRoutes);
apiRouter.use(fertilizerRoutes);
apiRouter.use(settingsRoutes);

// Health check endpoints on apiRouter
apiRouter.use('/health', healthRoutes);

// Database Health & Sync Diagnostic Endpoint
apiRouter.get('/db-health', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(200).json({
        success: true,
        status: 'degraded',
        database: 'offline_or_local',
        message: 'Aplikasi beroperasi dalam mod storan selamat/tempatan (Supabase tidak dikonfigurasikan atau kunci tiada).',
        timestamp: new Date().toISOString()
      });
    }

    let { error } = await supabase.from('hantaran_hasil').select('id').limit(1);
    if (error && (isMissingTableError(error) || error.code === '42P01')) {
      const fallbackRes = await supabase.from('hantaran').select('id').limit(1);
      error = fallbackRes.error;
    }

    if (error) {
      if (isMissingTableError(error)) {
        return res.status(200).json({
          success: true,
          status: 'degraded',
          database: 'missing_tables',
          message: 'Pangkalan data disambungkan tetapi jadual belum diinisialisasikan.',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      return res.status(500).json({
        success: false,
        status: 'error',
        database: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      status: 'healthy',
      database: 'connected',
      message: 'Sambungan pangkalan data beroperasi secara optimum.',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'error',
      database: 'crash',
      error: err?.message || 'Ralat sambungan pangkalan data.',
      timestamp: new Date().toISOString()
    });
  }
});

// Centralized API Error Boundary & Sanitizer
apiRouter.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
  const statusCode = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  
  let rawMessage = String(err?.message || 'Ralat dalaman pelayan berlaku.');
  let safeMessage = rawMessage;
  
  // Strict Redaction for 500 level internal server errors
  if (statusCode >= 500) {
    if (
      safeMessage.includes('postgres://') || 
      safeMessage.includes('supabase') || 
      safeMessage.includes('/src/') || 
      safeMessage.includes('/root/') ||
      safeMessage.includes('at ') ||
      safeMessage.includes('password') || 
      safeMessage.includes('secret')
    ) {
      safeMessage = 'Ralat dalaman pelayan berlaku semasa memproses permintaan.';
    }
  }

  console.error(`[API_CENTRALIZED_ERROR] [${correlationId}] ${req.method} ${req.path} (${statusCode}):`, err?.message || err);

  res.status(statusCode).json({
    success: false,
    error: safeMessage,
    code: err?.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'API_ERROR'),
    correlationId
  });
});

// Final 404 handler for apiRouter
apiRouter.use((req, res) => {
  const correlationId = (req as any).correlationId || (req as any).requestId || `req_${Date.now().toString(36)}`;
  console.log(`[API_ROUTER_404_FINAL] ${req.method} ${req.url} (Path: ${req.path})`);
  res.status(404).json({
    success: false,
    error: 'Laluan API tidak dijumpai (Final Router Catch).',
    code: 'API_ROUTE_NOT_FOUND',
    path: req.path,
    correlationId,
    timestamp: new Date().toISOString()
  });
});

// Mount the apiRouter under /api and root / for Vercel catch-all rewrites
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler for Vercel Serverless Function
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVERLESS_GLOBAL_ERROR]', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err?.message || 'Ralat dalaman pelayan semasa memproses permintaan.',
    code: err?.code || 'INTERNAL_SERVER_ERROR',
    path: req.path
  });
});

export { apiRouter };
export default app;
