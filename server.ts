import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { apiRouter } from "./src/server/serverless.js";
import aiRoutes from "./src/server/routes/ai.routes.js";
import visionRouter from "./src/server/routes/ai/vision.routes.js";
import healthRoutes from "./src/server/routes/health.routes.js";
import { snapshotWriter } from "./src/server/observability/persistence.js";
import { securityHeadersMiddleware, corsAllowListMiddleware } from "./src/server/middleware/securityHeaders.js";

async function startServer() {
  const app = express();
  const PORT = 3000;
  console.log("Starting server on port", PORT);

  // Enable standard single-hop reverse proxy trust (Cloud Run, Nginx)
  app.set('trust proxy', 1);

  // Enterprise defense-in-depth Security Headers & CORS Allow-list
  app.use(securityHeadersMiddleware);
  app.use(corsAllowListMiddleware);

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
      return res.status(400).json({
        success: false,
        error: 'Format muatan JSON tidak sah atau rosak.',
        code: 'INVALID_JSON_PAYLOAD',
        correlationId
      });
    }
    next(err);
  });

  // Health check endpoints with active DB and Backup observability probes
  app.use(["/health", "/api/health"], healthRoutes);

  // Dynamic Supabase configuration injector for client browser
  app.get(['/api/supabase-config.js', '/supabase-config.js'], (req, res) => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`window.__SUPABASE_URL__ = ${JSON.stringify(url)};\nwindow.__SUPABASE_ANON_KEY__ = ${JSON.stringify(anonKey)};\n`);
  });

  // Direct mount for Vision OCR routes at /api/ai and /api/ocr-receipt
  app.use("/api/ai", visionRouter);
  app.use("/api/ocr-receipt", visionRouter);
  app.use("/ocr-receipt", visionRouter);

  // Direct mount for AI routes at /api/ai
  app.use("/api/ai", aiRoutes);

  // Mount API router strictly under /api so other paths fall through to Vite
  app.use("/api", apiRouter);

  // PWA Manifest and Icons No-Cache Delivery
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  app.get(['/icons/*', '/favicon.png'], (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // Start background metric snapshot writer (60 minute default interval)
  try {
    snapshotWriter.start(60 * 60 * 1000);
  } catch (writerErr) {
    console.warn('[SERVER_STARTUP_NOTICE] Snapshot writer initialization notice:', writerErr);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Enterprise HTTP Server Keep-Alive Alignment (Prevents 502/ECONNRESET behind reverse proxies / Cloud Run)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.maxConnections = 10000;

  // Centralized Idempotent Lifecycle & Graceful Shutdown Controller
  let isShuttingDown = false;

  const handleShutdown = async (signal: string, exitCode = 0) => {
    if (isShuttingDown) {
      console.log(`[SHUTDOWN_GUARD] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
      return;
    }
    isShuttingDown = true;
    console.log(`[LIFECYCLE] Received ${signal}. Initiating graceful shutdown sequence...`);

    // Failsafe timer: Force exit if graceful cleanup hangs for more than 10 seconds
    const forceExitTimer = setTimeout(() => {
      console.error(`[SHUTDOWN_TIMEOUT] Graceful shutdown timed out after 10s. Forcing process exit (${exitCode || 1}).`);
      process.exit(exitCode || 1);
    }, 10000);

    // Unref timer so it does not keep event loop open if everything finishes early
    if (typeof forceExitTimer.unref === 'function') {
      forceExitTimer.unref();
    }

    try {
      // 1. Flush telemetry snapshots safely within 2 seconds
      console.log('[LIFECYCLE] Flushing observability snapshots...');
      await snapshotWriter.flushOnShutdown(2000);
    } catch (err) {
      console.warn('[SHUTDOWN_FAILSAFE] Notice during telemetry snapshot flush:', err);
    }

    // 2. Stop accepting new HTTP connections and let active in-flight requests finish
    console.log('[LIFECYCLE] Closing HTTP server listener...');
    server.close((closeErr) => {
      if (closeErr) {
        console.error('[SHUTDOWN_ERROR] Error closing HTTP server listener:', closeErr);
        process.exit(1);
      }
      console.log('[LIFECYCLE] HTTP server listener closed cleanly. Exiting process.');
      process.exit(exitCode);
    });
  };

  // Signal Listeners
  process.on('SIGTERM', () => handleShutdown('SIGTERM', 0));
  process.on('SIGINT', () => handleShutdown('SIGINT', 0));

  // Process Stability & Unhandled Error Guards
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[PROCESS_GUARD] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err: any) => {
    const isIgnorableNetworkError = err && (
      err.code === 'ECONNRESET' ||
      err.code === 'EPIPE' ||
      err.code === 'ECANCELED' ||
      err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      err.message?.includes('aborted')
    );
    if (isIgnorableNetworkError) {
      console.warn('[PROCESS_GUARD] Ignored transient network socket disconnect:', err.message || err.code);
      return;
    }
    console.error('[PROCESS_GUARD] Uncaught Exception encountered:', err);
    if (process.env.NODE_ENV === 'production') {
      handleShutdown('UNCAUGHT_EXCEPTION', 1);
    }
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});


