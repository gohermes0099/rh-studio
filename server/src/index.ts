import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, saveDb } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import authRouter, { requireAuth } from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import toolsRouter from './routes/tools.js';
import tasksRouter from './routes/tasks.js';
import uploadRouter from './routes/upload.js';
import uploadsRouter from './routes/uploads.js';
import galleryRouter from './routes/gallery.js';
import promptsRouter from './routes/prompts.js';
import { recoverOrphanedTasks } from './services/recovery.js';
import { startTaskCleanup } from './services/taskCleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Find project root regardless of where the compiled file lives
// (could be dist/server/src/ or dist/ depending on tsconfig)
const projectRoot = path.resolve(__dirname, '../../../..');
const clientDist = path.join(projectRoot, 'client', 'dist');

console.log('Client dist path:', clientDist);

app.use(express.static(clientDist, {
  // Disable caching to ensure users always get the latest JS
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected API routes
app.use('/api', requireAuth);

app.use('/api/settings', settingsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/download', uploadRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/prompts', promptsRouter);

// SPA fallback
app.get(/^(?!\/api\/)/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

async function start() {
  try {
    const db = await initDb();
    runMigrations(db);

    // Ensure admin user/password exist
    const adminUser = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user');
    if (!adminUser) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', 'admin_user', 'admin');
      console.log('[startup] Default admin user created (admin)');
    }
    const adminPass = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
    if (!adminPass) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', 'admin_password', 'admin123');
      console.log('[startup] Default admin password created (admin123) - CHANGE THIS!');
    }
    saveDb();

    setInterval(() => { saveDb(); }, 30000);

    recoverOrphanedTasks().then(({ recovered }) => {
      if (recovered > 0) console.log('[startup] Recovered ' + recovered + ' gallery item(s)');
    }).catch((err) => { console.error('[startup] Recovery failed:', err); });

    startTaskCleanup();

    app.listen(PORT, () => {
      console.log('Server listening on port ' + PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();