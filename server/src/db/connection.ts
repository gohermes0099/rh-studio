import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const projectRoot = path.resolve(import.meta.dirname, '../../..');
  const dataDir = path.join(projectRoot, 'data');
  const dbPath = path.join(dataDir, 'rh-studio.db');

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}
