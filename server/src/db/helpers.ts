// Database helper functions for sql.js (compatible with better-sqlite3 API)

export interface Row {
  [key: string]: unknown;
}

let onChange: (() => void) | null = null;

/** Register a callback to be invoked after every write. */
export function setOnChange(cb: (() => void) | null) {
  onChange = cb;
}

export class Statement {
  private lastId: number = 0;
  private changesCount: number = 0;

  constructor(private db: any, private sql: string) {}

  run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
    this.db.run(this.sql, params as (string | number | null)[]);
    this.changesCount = this.db.getRowsModified();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.lastId = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] as number : 0;

    // Persist after every write
    if (onChange) onChange();

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

export function createDbHelper(db: any) {
  return {
    prepare: (sql: string) => new Statement(db, sql),
    exec: (sql: string) => {
      const result = db.exec(sql);
      if (onChange) onChange();
      return result;
    },
    run: (sql: string, ...params: unknown[]) => {
      const stmt = new Statement(db, sql);
      return stmt.run(...params);
    },
  };
}