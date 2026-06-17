/**
 * Board daemon v2 — a persistent localhost HTTP server, INDEPENDENT of the
 * agent (hard rule 14): the board keeps working if the agent dies, and the
 * agent copes with a dead daemon by re-`board`ing the same dir.
 *
 * Endpoints
 *   GET  /health                       → { ok, pid, boards }
 *   GET  /                             → board index
 *   POST /api/boards                   → { id, dir } register (dir must hold board.html)
 *   GET  /boards/<id>/                 → the board HTML
 *   GET  /boards/<id>/<file>           → static asset from the board dir (traversal-guarded)
 *   GET  /boards/<id>/api/progress     → progress.json + reloadGen
 *   GET  /boards/<id>/api/feedback     → the durable feedback record (normalizeLegacy'd), or
 *                                        { authors: [], items: [] } when no file exists yet
 *   POST /boards/<id>/api/feedback     → { kind: submit|pending, feedback } → MERGES (never
 *                                        overwrites) into the durable store under the board mutex
 *   POST /boards/<id>/api/reload       → bump reloadGen (board polls it and swaps HTML in-tab)
 *
 * SPEC-017 — durable, multi-author feedback (load + merge persistence path).
 * The feedback file is the single source of truth; the board is a live projection of it.
 *   - GET loads + normalizes the durable record so a refresh/re-serve never starts empty.
 *   - POST reads the current durable file, mergeFeedback()s the contribution in, and writes
 *     the result — all serialized on the per-board mutex so one author's submit can never
 *     wipe another author's (or an earlier) pins. The raw request body is never written verbatim.
 *   - A "pending" round is reconciled INTO the durable store (not consumed-and-deleted), so
 *     the destructive feedback-pending.json delete that dropped data is gone.
 *
 * PROGRESS IS A FILE (documented decision): the agent writes progress.json next
 * to board.html; the daemon only reads it. Same philosophy as the feedback
 * handshake — the agent side stays dumb, file-driven, and crash-safe.
 *
 * A per-board MUTEX serializes feedback-writes vs reload-bumps so a reload can
 * never interleave with a half-written feedback file.
 *
 * State: <planrHome>/design-daemon/{port,boards.json}. Localhost only.
 */

import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync,
} from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';

import { daemonDir } from './paths.mjs';
import {
  clampPin, assertValidFeedback, mergeFeedback, normalizeLegacy,
  FEEDBACK_FILE, PENDING_FILE,
} from './feedback.mjs';

/* ------------------------------------------------------------------ *
 * Shared server-lifecycle helpers (extracted in SPEC-016/T-001).
 *
 * The board daemon and the dashboard server both need the same three
 * primitives: write/read a port-keyed PID file, probe whether a TCP
 * port is already accepting connections, and confirm a process is alive.
 * They live here (the original server module) so neither surface owns a
 * duplicate copy. Existing board-daemon behaviour is unchanged — these
 * are additive exports only.
 * ------------------------------------------------------------------ */

/** Write a PID file at `<dir>/<port>` holding the current process id. */
export function writePidFile(dir, port, pid = process.pid) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, String(port)), `${pid}\n`);
}

/** Read the pid recorded at `<dir>/<port>`, or null if absent/unreadable. */
export function readPidFile(dir, port) {
  const file = join(dir, String(port));
  if (!existsSync(file)) return null;
  const pid = Number(readFileSync(file, 'utf-8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** True when a process with `pid` is currently alive (signal 0 probe). */
export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but is owned by another user.
    return err && err.code === 'EPERM';
  }
}

/**
 * Resolve to true when `port` on `host` already accepts a TCP connection
 * (i.e. a server owns it). Never rejects — a refused/timed-out probe
 * resolves false. Used for reuse-if-running detection.
 */
export function isPortInUse(port, { host = '127.0.0.1', timeout = 500 } = {}) {
  return new Promise((resolveProbe) => {
    const socket = createConnection({ port, host });
    let settled = false;
    const done = (inUse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveProbe(inUse);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Daemon behaviour version. Bumped whenever the server's contract changes (e.g.
 * the non-enumerating index, registry pruning) so `ensureDaemon` can detect a
 * daemon running stale code and restart it instead of reusing it forever. A
 * daemon started before this field existed reports no version → treated as stale.
 */
export const DAEMON_VERSION = 2;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolveBody, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolveBody(data));
    req.on('error', reject);
  });

export function createDaemon({ env = process.env } = {}) {
  const stateDir = daemonDir(env);
  mkdirSync(stateDir, { recursive: true });
  const registryPath = join(stateDir, 'boards.json');

  const loadRegistry = () => {
    try {
      return existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf-8')) : {};
    } catch {
      return {};
    }
  };
  const saveRegistry = (r) => writeFileSync(registryPath, `${JSON.stringify(r, null, 2)}\n`);

  // Startup hygiene: prune the persistent registry so it never accumulates — or
  // serves — other projects' boards. Drop entries whose dir vanished, and legacy
  // entries that predate capability tokens (bare slug, no `--<token>`).
  (() => {
    const reg = loadRegistry();
    let changed = false;
    for (const [id, dir] of Object.entries(reg)) {
      if (!existsSync(dir) || !/--[a-f0-9]{16,}$/.test(id)) { delete reg[id]; changed = true; }
    }
    if (changed) saveRegistry(reg);
  })();

  const reloadGen = new Map(); // boardId → counter
  const mutex = new Map(); // boardId → promise chain
  const locked = (id, fn) => {
    const tail = (mutex.get(id) ?? Promise.resolve()).then(fn, fn);
    mutex.set(id, tail.catch(() => {}));
    return tail;
  };

  const boardDir = (id) => {
    const dir = loadRegistry()[id];
    return dir && existsSync(dir) ? dir : null;
  };

  // SPEC-017: boards we've already announced the mutex-guarded merge path for,
  // so the startup/registration log line is emitted once per board, not per request.
  const mutexAnnounced = new Set();
  const announceMutexPath = (id) => {
    if (mutexAnnounced.has(id)) return;
    mutexAnnounced.add(id);
    process.stderr.write(`[feedback] mutex-guarded merge path active for board ${id}\n`);
  };

  /**
   * SPEC-017: read the durable feedback record for a board and normalize it so every pin
   * carries an author + stable id (legacy/unattributed files load as "Anonymous"). Returns
   * null when the file is absent or unparseable — callers decide the empty/fallback shape.
   */
  const readStored = (dir) => {
    const file = join(dir, FEEDBACK_FILE);
    if (!existsSync(file)) return null;
    try {
      return normalizeLegacy(JSON.parse(readFileSync(file, 'utf-8')));
    } catch {
      return null;
    }
  };

  /**
   * SPEC-017: reconcile any leftover feedback-pending.json into the durable store, then
   * leave the pending file as an empty record. The previous board version consumed-and-deleted
   * the pending file on read, which dropped other authors' pins — here it is MERGED, never
   * destroyed. Best-effort + serialized on the board mutex; a parse error skips reconciliation
   * rather than corrupting the durable file.
   */
  const reconcilePending = (id, dir) =>
    locked(id, () => {
      const pendingPath = join(dir, PENDING_FILE);
      if (!existsSync(pendingPath)) return;
      let pending;
      try {
        pending = JSON.parse(readFileSync(pendingPath, 'utf-8'));
      } catch {
        return; // unreadable pending round — leave it untouched, never destroy the durable store
      }
      const merged = mergeFeedback(readStored(dir) ?? {}, pending);
      try {
        assertValidFeedback(merged);
      } catch {
        return; // refuse to write an invalid durable record
      }
      writeFileSync(join(dir, FEEDBACK_FILE), `${JSON.stringify(merged, null, 2)}\n`);
      // The pending round is now folded into the durable store. Empty it (rather than delete)
      // so a stale round can never be double-applied, while keeping the file's existence intact.
      writeFileSync(pendingPath, `${JSON.stringify({ pins: [], authors: [] }, null, 2)}\n`);
    });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);

      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, pid: process.pid, version: DAEMON_VERSION, boards: Object.keys(loadRegistry()).length });
      }

      if (req.method === 'GET' && url.pathname === '/') {
        // The root never enumerates boards: the registry spans every project on
        // this machine, and listing it would leak other projects' names into a
        // shared/screenshared review URL. A board is reachable only via its own
        // capability URL (/boards/<slug>--<token>/), printed by the command.
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8"><title>planr design boards</title>
<body style="font:15px system-ui;padding:32px"><h1>planr design boards</h1>
<p>Open the board with the exact URL printed by your design command. Boards are not listed here.</p>`);
      }

      if (req.method === 'POST' && url.pathname === '/api/boards') {
        const { id, dir } = JSON.parse(await readBody(req) || '{}');
        if (!id || !dir) return json(res, 400, { error: 'id and dir required' });
        if (!existsSync(join(dir, 'board.html'))) {
          return json(res, 400, { error: `no board.html in ${dir}` });
        }
        const registry = loadRegistry();
        registry[id] = resolve(dir);
        saveRegistry(registry);
        if (!reloadGen.has(id)) reloadGen.set(id, 0);
        // SPEC-017: confirm the mutex-guarded merge path is active for this board and fold any
        // leftover pending round into the durable store (non-destructively) on (re-)register.
        announceMutexPath(id);
        reconcilePending(id, registry[id]);
        return json(res, 200, { ok: true, url: `/boards/${encodeURIComponent(id)}/` });
      }

      if (parts[0] === 'boards' && parts.length >= 2) {
        const id = decodeURIComponent(parts[1]);
        const dir = boardDir(id);
        if (!dir) return json(res, 404, { error: `unknown board "${id}"` });

        // Canonical trailing slash: /boards/<id> (no slash) must NOT serve the
        // page — the browser would resolve every relative URL (variant-A.png,
        // api/progress, api/feedback) against /boards/ and the whole board
        // silently breaks (404 images, dead polling, lost feedback). Terminal
        // linkifiers routinely drop the trailing slash from BOARD_URL, so
        // redirect instead of serving.
        if (parts.length === 2 && !url.pathname.endsWith('/')) {
          res.writeHead(301, { location: `/boards/${encodeURIComponent(id)}/` });
          return res.end();
        }

        // /boards/<id>/api/…
        if (parts[2] === 'api') {
          if (req.method === 'GET' && parts[3] === 'progress') {
            let progress = {};
            const p = join(dir, 'progress.json');
            if (existsSync(p)) {
              try { progress = JSON.parse(readFileSync(p, 'utf-8')); } catch { progress = { parseError: true }; }
            }
            return json(res, 200, { ...progress, reloadGen: reloadGen.get(id) ?? 0 });
          }
          // SPEC-017: GET the durable feedback record for the board's initial load. Reads the
          // persisted file, normalizeLegacy()s it so every pin carries an author + stable id,
          // and returns it. When no file exists yet the board gets a valid empty record so the
          // first paint is the designed "no feedback yet" state — never a fetch error. This route
          // is read-only: it must NOT delete feedback-pending.json.
          if (req.method === 'GET' && parts[3] === 'feedback') {
            const stored = readStored(dir);
            return json(res, 200, stored ?? { authors: [], items: [] });
          }
          if (req.method === 'POST' && parts[3] === 'feedback') {
            const body = JSON.parse(await readBody(req) || '{}');
            const kind = body.kind === 'pending' ? 'pending' : 'submit';
            const raw = body.feedback ?? {};
            raw.pins = (raw.pins ?? []).map(clampPin);
            // SPEC-017: normalize the incoming round first — fill author ("Anonymous") + the
            // content-derived stable id on every pin — so a client that doesn't pre-assign ids
            // stays compatible, and the same logical pin keys consistently across submits. The
            // contribution must then itself be a valid feedback object before we fold it in, so a
            // malformed body is rejected up front and never reaches the durable file.
            const contribution = normalizeLegacy(raw);
            try {
              assertValidFeedback(contribution);
            } catch (e) {
              return json(res, 400, { error: e.message });
            }
            announceMutexPath(id);

            // A "pending" round is the design-loop's regenerate/remix handshake: the agent picks
            // it up via readFeedback() (Preserve), which consumes it. It is written to its own
            // PENDING_FILE (still mutex-serialized so it can't interleave with a reload) and is
            // NOT folded into the durable collaborative store at write time. The destructive part
            // SPEC-017 removes is the load-side consume that dropped OTHER authors' durable pins —
            // here the durable feedback.json is never touched by a pending write.
            if (kind === 'pending') {
              await locked(id, () => {
                writeFileSync(join(dir, PENDING_FILE), `${JSON.stringify(contribution, null, 2)}\n`);
              });
              return json(res, 200, { ok: true, kind });
            }

            // submit → MERGE into the durable store, never overwrite. Serialized on the per-board
            // mutex so two concurrent POSTs (from different authors or tabs) cannot interleave a
            // half-written file or clobber each other. We read the current durable store INSIDE the
            // lock, mergeFeedback() the contribution in, validate, then write the result. The raw
            // request body is never written verbatim.
            let result;
            try {
              await locked(id, () => {
                const stored = readStored(dir) ?? {};
                const merged = mergeFeedback(stored, contribution);
                assertValidFeedback(merged);
                writeFileSync(join(dir, FEEDBACK_FILE), `${JSON.stringify(merged, null, 2)}\n`);
                result = merged;
              });
            } catch (e) {
              return json(res, 500, { error: String(e.message ?? e) });
            }
            return json(res, 200, { ok: true, kind, feedback: result });
          }
          if (req.method === 'POST' && parts[3] === 'reload') {
            await locked(id, () => reloadGen.set(id, (reloadGen.get(id) ?? 0) + 1));
            return json(res, 200, { ok: true, reloadGen: reloadGen.get(id) });
          }
          return json(res, 404, { error: 'unknown api route' });
        }

        // static: /boards/<id>/ → board.html, else the named file (traversal-guarded).
        // HEAD is honored like GET (Node omits the body automatically).
        if (req.method === 'GET' || req.method === 'HEAD') {
          const rel = parts.slice(2).join('/') || 'board.html';
          // realpath BEFORE resolving: macOS tmp dirs are symlinks (/var → /private/var),
          // and the guard must compare like with like.
          const realDir = realpathSync(dir);
          const abs = resolve(realDir, rel);
          if (abs !== realDir && !abs.startsWith(realDir + sep)) {
            return json(res, 403, { error: 'path traversal blocked' });
          }
          if (!existsSync(abs)) return json(res, 404, { error: `not found: ${rel}` });
          res.writeHead(200, { 'content-type': MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream' });
          return res.end(readFileSync(abs));
        }
      }

      return json(res, 404, { error: 'not found' });
    } catch (err) {
      return json(res, 500, { error: String(err.message ?? err) });
    }
  });

  return {
    server,
    /** Start on 127.0.0.1; port 0 = ephemeral. Persists the port for discovery. */
    listen(port = 0) {
      return new Promise((resolveListen) => {
        server.listen(port, '127.0.0.1', () => {
          const actual = server.address().port;
          writeFileSync(join(stateDir, 'port'), String(actual));
          resolveListen(actual);
        });
      });
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Discover a running daemon: read the port file, confirm /health answers. */
export async function findRunningDaemon({ env = process.env, fetchImpl = fetch } = {}) {
  const portFile = join(daemonDir(env), 'port');
  if (!existsSync(portFile)) return null;
  const port = Number(readFileSync(portFile, 'utf-8').trim());
  if (!port) return null;
  try {
    const res = await fetchImpl(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      const health = await res.json().catch(() => ({}));
      return { port, pid: health.pid ?? null, version: health.version ?? null };
    }
  } catch {
    /* dead daemon — caller starts a fresh one (rule 14) */
  }
  return null;
}

// CLI entry: `node daemon.mjs --serve [port]`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()) && process.argv.includes('--serve')) {
  const portArg = Number(process.argv[process.argv.indexOf('--serve') + 1]) || 0;
  const daemon = createDaemon();
  daemon.listen(portArg).then((port) => {
    process.stderr.write(`DAEMON_PORT: ${port}\n`);
  });
}
