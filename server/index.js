import compression from 'compression';
import express from 'express';
import enforce from 'express-sslify';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Delaford from './Delaford.js';
import world from './core/world.js';
import identityRegistry from './core/services/identity-registry.js';
import { recentRuntimeEvents } from './core/services/runtime-diagnostics.js';
import { permittedDevelopmentOrigin } from './core/http/development-cors.js';

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
    if (fs.existsSync(crashLogPath) && fs.statSync(crashLogPath).size > 2 * 1024 * 1024) {
      const rotatedCrashLogPath = `${crashLogPath}.1`;
      if (fs.existsSync(rotatedCrashLogPath)) {
        fs.unlinkSync(rotatedCrashLogPath);
      }
      fs.renameSync(crashLogPath, rotatedCrashLogPath);
    }
    const entry = [
      `\n[${new Date().toISOString()}] ${kind}`,
      error && error.stack ? error.stack : String(error),
      'Recent runtime events:',
      JSON.stringify(recentRuntimeEvents(), null, 2),
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
// Fail closed: dev-only surfaces (debug endpoints, dev CORS) require an explicit
// NODE_ENV=development; anything else is treated as production.
const isDevelopment = process.env.NODE_ENV === 'development';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

const hasClientBundle = () => (
  fs.existsSync(distDir)
  && fs.existsSync(path.join(distDir, 'index.html'))
);

// HTTPS enforcement is opt-in: self-hosted LAN/Tailscale deployments serve
// plain HTTP and would redirect-loop. Set FORCE_HTTPS=true behind a TLS proxy.
if (env === 'production' && process.env.FORCE_HTTPS === 'true') {
  app.use(enforce.HTTPS({ trustProtoHeader: true }));
}

app.use(compression());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
app.use(express.json({ limit: '32kb' }));

// The Vite client runs on :5173 while the authoritative API/WS server runs on
// :6500. Permit that same-host development pairing without opening production
// account endpoints to arbitrary cross-origin requests.
if (isDevelopment) {
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    const permittedOrigin = permittedDevelopmentOrigin(origin, req.hostname);
    if (permittedOrigin) {
      res.set('Access-Control-Allow-Origin', permittedOrigin);
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
}

if (hasClientBundle()) {
  app.use(express.static(distDir));
} else {
  process.stderr.write('[server] Client bundle not found in dist/. Static assets will be skipped.\n');
}

// Basic per-IP throttle on the only unauthenticated write endpoint so account
// creation cannot be scripted to flood the SQLite store. Behind a TLS proxy,
// set TRUST_PROXY=true so req.ip is the real client and not the proxy loopback.
const ACCOUNT_WINDOW_MS = 60_000;
const ACCOUNT_MAX_PER_WINDOW = Number(process.env.ACCOUNT_CREATE_LIMIT) || 10;
const accountCreationWindows = new Map();
const accountCreationRateExceeded = (ip) => {
  const now = Date.now();
  if (accountCreationWindows.size > 5000) {
    for (const [key, entry] of accountCreationWindows) {
      if (now - entry.windowStart > ACCOUNT_WINDOW_MS) accountCreationWindows.delete(key);
    }
  }
  const entry = accountCreationWindows.get(ip);
  if (!entry || now - entry.windowStart > ACCOUNT_WINDOW_MS) {
    accountCreationWindows.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > ACCOUNT_MAX_PER_WINDOW;
};

app.post('/api/accounts', (req, res) => {
  if (accountCreationRateExceeded(req.ip)) {
    return res.status(429).json({ message: 'Too many account attempts. Please wait a minute.' });
  }
  const result = identityRegistry.createLoginAccount(req.body || {});
  if (!result.ok) return res.status(400).json({ message: result.reason });
  return res.status(201).json({ accountId: result.accountId, username: result.username });
});

// World data endpoints — only available in development for debugging.
// In production these would leak game state (player positions, items, etc.).
if (isDevelopment) {
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
