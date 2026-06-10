import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';

const router = Router();

const sessions = new Map<string, { user: string; createdAt: number }>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const db = getDb();
    const userRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user') as { value: string } | undefined;
    const passRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password') as { value: string } | undefined;

    if (!userRow || !passRow) {
      res.status(500).json({ error: 'Auth not configured. Set admin_user and admin_password in DB.' });
      return;
    }

    if (username !== userRow.value || password !== passRow.value) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken();
    sessions.set(token, { user: username, createdAt: Date.now() });

    res.json({ token, user: username });
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
  res.json({ authenticated: true, user: session.user });
});

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/logout',
  // Gallery file serving is public — the URLs are signed/imgbb-hosted
  // and <img> tags / download links can't send custom auth headers
  '/api/gallery/files',
];

export function requireAuth(req: any, res: any, next: any) {
  // Skip auth check for public endpoints
  // req.originalUrl includes the full URL path including mount points
  if (PUBLIC_PATHS.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.substring(7);
    const session = sessions.get(token);
    if (session) {
      return next();
    }
  }
  res.status(401).json({ error: 'Authentication required' });
}

export default router;