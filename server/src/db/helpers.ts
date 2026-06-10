// Database helper functions for sql.js (compatible with better-sqlite3 API)
import type { Database } from 'sql.js';

export interface Row {
  [key: string]: unknown;
}

// Prepared statement simulation for sql.js
export class Statement {
  private lastId: number = 0;
  private changesCount: number = 0;

  constructor(private db: Database, private sql: string) {}

  run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
    this.db.run(this.sql, params as (string | number | null)[]);
    this.changesCount = this.db.getRowsModified();
    
    // Get last inserted rowid
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.lastId = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] as number : 0;
    
    return { changes: this.changesCount, lastInsertRowid: this.lastId };
  }

  get(...params: unknown[]): Row | undefined {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null)[]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row as Row;
    }
    stmt.free();
    return undefined;
  }

  all(...params: unknown[]): Row[] {
    const results: Row[] = [];
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as (string | number | null)[]);
    while (stmt.step()) {
      results.push(stmt.getAsObject() as Row);
    }
    stmt.free();
    return results;
  }
}

// Extend Database with prepare method
export function createDbHelper(db: Database) {
  return {
    prepare: (sql: string) => new Statement(db, sql),
    exec: (sql: string) => db.exec(sql),
    run: (sql: string, ...params: unknown[]) => {
      const stmt = new Statement(db, sql);
      return stmt.run(...params);
    }
  };
}