import { getDb } from '../db/connection.js';

const CLEANUP_AGE_DAYS = 7;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Once a day

/**
 * Delete tasks that are older than CLEANUP_AGE_DAYS.
 *
 * Tasks are ephemeral — they only track the RH workflow for reference.
 * Deleting a task NEVER affects gallery_items (images are independent).
 */
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

/**
 * Start periodic task cleanup. Runs immediately and then every 24h.
 */
export function startTaskCleanup(): void {
  // Run once on startup
  try {
    cleanupOldTasks();
  } catch (err) {
    console.error('[cleanup] Initial cleanup failed:', err);
  }

  // Then every 24h
  setInterval(() => {
    try {
      cleanupOldTasks();
    } catch (err) {
      console.error('[cleanup] Periodic cleanup failed:', err);
    }
  }, CLEANUP_INTERVAL_MS);
}
