import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDbHelper, setOnChange } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any = null;
let rawDb: SqlJsDatabase | null = null;
let dbPath: string = '';

/**
 * Find the project root by walking up directories until we find a folder
 * containing BOTH `client/` and `server/` (the monorepo structure).
 * Falls back to first package.json if not found.
 */
function findProjectRoot(start: string): string {
  let current = start;
  for (let i = 0; i < 10; i++) {
    // Prefer the monorepo root: has both client/ and server/
    if (fs.existsSync(path.join(current, 'client'))
        && fs.existsSync(path.join(current, 'server'))
        && fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Fallback: first package.json
  current = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return start;
}

export async function initDb(): Promise<any> {
  if (db) return db;

  const projectRoot = findProjectRoot(__dirname);
  dbPath = path.join(projectRoot, 'data', 'rh-studio.db');

  console.log('[db] __dirname:', __dirname);
  console.log('[db] Project root:', projectRoot);
  console.log('[db] Database path:', dbPath);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    rawDb = new SQL.Database(buffer);
    console.log('[db] Loaded existing database');
  } else {
    rawDb = new SQL.Database();
    console.log('[db] Created new database');
  }

  db = createDbHelper(rawDb);
  setOnChange(() => saveDb());
  saveDb();

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function saveDb(): void {
  if (rawDb && dbPath) {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDb(): void {
  if (rawDb) {
    saveDb();
    rawDb.close();
    rawDb = null;
    db = null;
  }
}