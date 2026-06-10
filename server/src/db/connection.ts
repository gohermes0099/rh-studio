import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDbHelper } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any = null;
let rawDb: SqlJsDatabase | null = null;
let dbPath: string = '';

/**
 * Find the project root by walking up directories until we find package.json.
 * This works regardless of where the compiled file lives.
 */
function findProjectRoot(start: string): string {
  let current = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return start;
}

/**
 * Find existing rh-studio.db by walking up from the project root.
 * If multiple exist, prefer the canonical /data/rh-studio.db at project root.
 */
function findExistingDb(projectRoot: string): string | null {
  const canonical = path.join(projectRoot, 'data', 'rh-studio.db');
  if (fs.existsSync(canonical)) return canonical;

  // Walk up to 3 levels up from project root looking for stray DBs
  let current = path.dirname(projectRoot);
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(current, 'data', 'rh-studio.db');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function initDb(): Promise<any> {
  if (db) return db;

  const projectRoot = findProjectRoot(__dirname);
  const dataDir = path.join(projectRoot, 'data');

  // Look for existing DB anywhere
  const existingDb = findExistingDb(projectRoot);
  if (existingDb) {
    dbPath = existingDb;
  } else {
    // Create new one at canonical location
    dbPath = path.join(dataDir, 'rh-studio.db');
  }

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