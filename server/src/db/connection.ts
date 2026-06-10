import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDbHelper } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: ReturnType<typeof createDbHelper> | null = null;
let rawDb: SqlJsDatabase | null = null;
let dbPath: string = '';

export async function initDb(): Promise<any> {
  if (db) return db;

  const projectRoot = path.resolve(__dirname, '../../..');
  const dataDir = path.join(projectRoot, 'data');
  dbPath = path.join(dataDir, 'rh-studio.db');

  fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    rawDb = new SQL.Database(buffer);
  } else {
    rawDb = new SQL.Database();
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