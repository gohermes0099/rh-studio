import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';

const router = Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOGIN_MAX_ATTEMPTS = 5;

interface Session {
  user: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
// Expose for cross-route auth (e.g. /api/gallery/files?token=)
(global as any).__sessions = sessions;
export { sessions };

// Periodic cleanup of expired sessions (every 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of sessions) {
    if (sess.expiresAt < now) sessions.delete(token);
  }
}, 30 * 60 * 1000).unref();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// --- Rate limit (per IP, in-memory, sliding window) ---
interface Attempt {
  ts: number;
}
const loginAttempts = new Map<string, Attempt[]>();

function recordFailedLogin(ip: string): number {
  const now = Date.now();
  const arr = loginAttempts.get(ip) || [];
  // Drop expired
  const fresh = arr.filter(a => now - a.ts < LOGIN_WINDOW_MS);
  fresh.push({ ts: now });
  loginAttempts.set(ip, fresh);
  return fresh.length;
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

function getAttemptsLeft(ip: string): number {
  const now = Date.now();
  const arr = loginAttempts.get(ip) || [];
  const fresh = arr.filter(a => now - a.ts < LOGIN_WINDOW_MS);
  return Math.max(0, LOGIN_MAX_ATTEMPTS - fresh.length);
}

// --- Password helpers ---
function isHashed(value: string): boolean {
  // bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

async function ensureHashedPassword(): Promise<{ user: string; password: string }> {
  const db = getDb();
  let userRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user') as { value: string } | undefined;
  let passRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password') as { value: string } | undefined;

  // First run: create default credentials (hashed)
  if (!userRow || !passRow) {
    const defaultUser = 'jajoedvip@gmail.com';
    const defaultPass = '13a25ofgWG';
    const hashed = await bcrypt.hash(defaultPass, 10);
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_user', defaultUser);
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_password', hashed);
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_password_migrated', 'true');
    return { user: defaultUser, password: hashed };
  }

  // Migration: hash existing plain-text password
  if (!isHashed(passRow.value)) {
    console.log('[auth] Migrating plain-text password to bcrypt hash...');
    const hashed = await bcrypt.hash(passRow.value, 10);
    db.run('UPDATE settings SET value = ? WHERE key = ?', hashed, 'admin_password');
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_password_migrated', 'true');
    passRow = { value: hashed };
  }

  return { user: userRow.value, password: passRow.value! };
}

// --- Routes ---

router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Rate limit check
    if (getAttemptsLeft(ip) <= 0) {
      res.status(429).json({
        error: 'Too many failed attempts. Please wait 15 minutes.',
        retryAfter: LOGIN_WINDOW_MS / 1000,
      });
      return;
    }

    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const { user: adminUser, password: adminPassHash } = await ensureHashedPassword();

    // Constant-time username comparison (length check)
    const userMatch = username.length === adminUser.length &&
      crypto.timingSafeEqual(Buffer.from(username), Buffer.from(adminUser));

    // Always run bcrypt to avoid timing attacks revealing whether user exists
    const dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8E1LH.ZJ8.5h6fLk5z9Bk7nOY2zK2i';
    const passOk = userMatch
      ? await bcrypt.compare(password, adminPassHash)
      : await bcrypt.compare(password, dummyHash);

    if (!userMatch || !passOk) {
      const attempts = recordFailedLogin(ip);
      const left = Math.max(0, LOGIN_MAX_ATTEMPTS - attempts);
      res.status(401).json({
        error: 'Invalid credentials',
        attemptsLeft: left,
      });
      return;
    }

    // Success: clear attempts, create session
    clearLoginAttempts(ip);
    const token = generateToken();
    const now = Date.now();
    sessions.set(token, { user: adminUser, createdAt: now, expiresAt: now + SESSION_TTL_MS });

    res.json({ token, user: adminUser, expiresAt: now + SESSION_TTL_MS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/logout', (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.substring(7);
    sessions.delete(token);
  }
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ authenticated: false });
    return;
  }
  const token = auth.substring(7);
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }
  // Check expiry
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.status(401).json({ authenticated: false, expired: true });
    return;
  }
  res.json({ authenticated: true, user: session.user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword.length > 128) {
      res.status(400).json({ error: 'New password is too long' });
      return;
    }
    const db = getDb();
    const passRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password') as { value: string } | undefined;
    if (!passRow) {
      res.status(500).json({ error: 'Auth not configured' });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, passRow.value);
    if (!ok) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE settings SET value = ? WHERE key = ?', newHash, 'admin_password');

    // Invalidate all sessions except current
    const auth = req.headers.authorization;
    const currentToken = auth?.startsWith('Bearer ') ? auth.substring(7) : '';
    for (const token of sessions.keys()) {
      if (token !== currentToken) sessions.delete(token);
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/change-password',
];

export function requireAuth(req: any, res: any, next: any) {
  // Skip auth check for public endpoints
  if (PUBLIC_PATHS.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.substring(7);
    const session = sessions.get(token);
    if (session) {
      if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        res.status(401).json({ error: 'Session expired', expired: true });
        return;
      }
      return next();
    }
  }
  res.status(401).json({ error: 'Authentication required' });
}

export default router;