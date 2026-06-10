import { getDb } from '../db/connection.js';

const CLEANUP_AGE_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function cleanupOldTasks(): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    DELETE FROM tasks WHERE createdAt < ?
  `).run(cutoff);

  if (result.changes > 0) {
    console.log(`[cleanup] Deleted ${result.changes} task(s) older than ${CLEANUP_AGE_DAYS} days`);
  }

  return result.changes;
}

export function startTaskCleanup(): void {
  try {
    cleanupOldTasks();
  } catch (err) {
    console.error('[cleanup] Initial cleanup failed:', err);
  }

  setInterval(() => {
    try {
      cleanupOldTasks();
    } catch (err) {
      console.error('[cleanup] Periodic cleanup failed:', err);
    }
  }, CLEANUP_INTERVAL_MS);
}