import compression from 'compression';
import express from 'express';
import enforce from 'express-sslify';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import secure from 'ssl-express-www';
import pkg from '../package.json' with { type: 'json' };

import Delaford from './Delaford.js';
import world from './core/world.js';
import nameValidationService from './core/services/name-validation.js';

const serverDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const distDir = path.join(projectRoot, 'dist');

// Crash forensics: every uncaught exception/rejection is appended to a file
// with a timestamp BEFORE the process dies, so "the game crashed" is always
// diagnosable even after nodemon restarts and the console buffer rolls.
const crashLogPath = path.join(serverDir, 'logs', 'crash.log');
const recordCrash = (kind, error) => {
  try {
    fs.mkdirSync(path.dirname(crashLogPath), { recursive: true });
    const entry = [
      `\n[${new Date().toISOString()}] ${kind}`,
      error && error.stack ? error.stack : String(error),
      '',
    ].join('\n');
    fs.appendFileSync(crashLogPath, entry);
  } catch (logError) {
    // Last resort: at least the console below.
  }
  console.error(`[crash] ${kind}:`, error);
};

process.on('uncaughtException', (error) => {
  recordCrash('uncaughtException', error);
  process.exit(1); // let nodemon restart with a clean slate
});
process.on('unhandledRejection', (reason) => {
  // Log but do not exit: a stray rejection must not take the world down.
  recordCrash('unhandledRejection', reason);
});

const port = process.env.PORT || 6500;
const env = process.env.NODE_ENV || 'development';
const app = express();

const hasClientBundle = () => (
  fs.existsSync(distDir)
  && fs.existsSync(path.join(distDir, 'index.html'))
);

// HTTPS enforcement is opt-in: self-hosted LAN/Tailscale deployments serve
// plain HTTP and would redirect-loop. Set FORCE_HTTPS=true behind a TLS proxy.
if (env === 'production' && process.env.FORCE_HTTPS === 'true') {
  app.use(enforce.HTTPS({ trustProtoHeader: true }));
  app.use(secure);
}

app.use(compression());
app.use(express.json({ limit: '32kb' }));

if (hasClientBundle()) {
  app.use(express.static(distDir));
} else {
  process.stderr.write('[server] Client bundle not found in dist/. Static assets will be skipped.\n');
}

const serializeJob = (job) => {
  const payload = {
    jobId: job.id,
    status: job.status,
    requestedAt: job.requestedAt,
  };

  if (job.completedAt) {
    payload.completedAt = job.completedAt;
  }

  if (job.result) {
    payload.result = job.result;
  }

  if (job.error) {
    payload.error = job.error;
  }

  return payload;
};

// Minimal per-IP sliding-window rate limit for the HTTP API. The WebSocket
// layer has its own token buckets; without this, the REST endpoints (which
// allocate jobs and touch disk) are an unbounded memory/disk sink.
const HTTP_API_WINDOW_MS = 60 * 1000;
const HTTP_API_MAX_REQUESTS = Number(process.env.HTTP_API_MAX_REQUESTS_PER_MINUTE) || 30;
const httpApiHits = new Map();

const httpApiRateLimit = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - HTTP_API_WINDOW_MS;
  const hits = (httpApiHits.get(key) || []).filter(ts => ts > windowStart);

  if (hits.length >= HTTP_API_MAX_REQUESTS) {
    res.set('Retry-After', '60');
    return res.status(429).json({ message: 'Too many requests. Try again shortly.' });
  }

  hits.push(now);
  httpApiHits.set(key, hits);

  // Bound the map so a spray of spoofed IPs cannot grow it forever.
  if (httpApiHits.size > 5000) {
    for (const [ip, timestamps] of httpApiHits) {
      if (!timestamps.length || timestamps[timestamps.length - 1] <= windowStart) {
        httpApiHits.delete(ip);
      }
    }
  }

  return next();
};

app.use('/api', httpApiRateLimit);

const MAX_NAME_BYTES = 64;
const isValidAccountId = value => (
  typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[\w-]+$/.test(value)
);

app.post('/api/identity/name-validations', (req, res) => {
  const { name, accountId } = req.body || {};

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'Name is required.' });
  }

  if (name.length > MAX_NAME_BYTES) {
    return res.status(400).json({ message: `Name must be ${MAX_NAME_BYTES} characters or fewer.` });
  }

  if (accountId !== undefined && accountId !== null && !isValidAccountId(accountId)) {
    return res.status(400).json({ message: 'Invalid account id.' });
  }

  const job = nameValidationService.createJob({ name, accountId });
  const statusCode = job.status === 'complete' ? 200 : 202;

  return res.status(statusCode).json(serializeJob(job));
});

app.get('/api/identity/name-validations/:jobId', (req, res) => {
  const job = nameValidationService.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ message: 'Validation job not found.' });
  }

  return res.json(serializeJob(job));
});

app.get('/api/identity/accounts/:accountId', (req, res) => {
  if (!isValidAccountId(req.params.accountId)) {
    return res.status(400).json({ message: 'Invalid account id.' });
  }

  const account = nameValidationService.getAccountIdentity(req.params.accountId);

  if (!account) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  return res.json(account);
});

// Public server status — the community website reads this for its live
// stats panel. Sanitized: no player positions, inventories, or tokens.
const serverStartedAt = Date.now();
app.get('/api/stats', (_req, res) => {
  const instanceCount = [...world.scenes.values()].filter(scene => scene.type === 'instance').length;

  res.json({
    name: 'Verdigris',
    version: pkg.version || null,
    uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
    startedAt: new Date(serverStartedAt).toISOString(),
    playersOnline: world.players.length,
    players: world.players.map(p => ({
      username: p.username,
      level: p.level,
      scene: (world.getScene(p.sceneId) || {}).name || null,
    })),
    scenes: {
      total: world.scenes.size,
      activeInstances: instanceCount,
    },
    generatedAt: new Date().toISOString(),
  });
});

// World data endpoints — only available in development for debugging.
// In production these would leak game state (player positions, items, etc.).
if (env === 'development') {
  app.get('/world/items', (_req, res) => res.json(world.items || []));
  app.get('/world/players', (_req, res) => {
    // Strip sensitive fields before sending
    const safe = (world.players || []).map((p) => ({
      uuid: p.uuid,
      username: p.username,
      x: p.x,
      y: p.y,
      level: p.level,
    }));
    res.json(safe);
  });
  app.get('/world/respawns', (_req, res) => res.json(world.respawns || {}));
  app.get('/world/shops', (_req, res) => res.json(world.shops || []));
}

app.use((_req, res) => {

  if (hasClientBundle()) {
    res.sendFile(path.join(distDir, 'index.html'));
    return;
  }

  res.status(503).json({
    message: 'Client bundle not found. Run `npm run build` or use the Vite dev server.',
  });
});

const server = http.createServer(app);
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    process.stderr.write(`[server] Port ${port} is already in use. ${error}\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => {
  process.stdout.write(`ENVIRONMENT: ${env} and PORT ${port}\n`);
});

const game = new Delaford(server);

game.start();

let isShuttingDown = false;

const gracefulShutdown = (signal, callback) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  process.stdout.write(`[server] Received ${signal}. Shutting down...\n`);

  try {
    game.shutdown();
  } catch (error) {
    process.stderr.write(`[server] Failed to stop game loop. ${error}\n`);
  }

  for (const socket of sockets) {
    try {
      socket.destroy();
    } catch (error) {
      process.stderr.write(`[server] Failed to destroy socket. ${error}\n`);
    }
  }

  const exitAfterClose = (code = 0) => {
    if (typeof callback === 'function') {
      callback();
      return;
    }
    process.exit(code);
  };

  const forceTimeout = setTimeout(() => {
    process.stderr.write('[server] Forced shutdown after timeout.\n');
    exitAfterClose(1);
  }, 5000);
  forceTimeout.unref();

  server.close((error) => {
    if (error) {
      process.stderr.write(`[server] Error closing HTTP server. ${error}\n`);
      exitAfterClose(1);
      return;
    }

    exitAfterClose(0);
  });
};

['SIGINT', 'SIGTERM', 'SIGBREAK'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

if (process.platform !== 'win32') {
  process.once('SIGUSR2', () => {
    gracefulShutdown('SIGUSR2', () => {
      process.kill(process.pid, 'SIGUSR2');
    });
  });
}

export default app;
