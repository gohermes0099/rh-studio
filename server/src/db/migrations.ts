import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webappId TEXT NOT NULL UNIQUE,
      webappName TEXT NOT NULL,
      nodeInfoList TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      toolId INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      nodeInfoList TEXT NOT NULL,
      resultFiles TEXT DEFAULT '[]',
      errorMessage TEXT,
      failedReason TEXT,
      pollCount INTEGER DEFAULT 0,
      lastPolledAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tools_webappId ON tools(webappId);
    CREATE INDEX IF NOT EXISTS idx_tools_updatedAt ON tools(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_taskId ON tasks(taskId);
    CREATE INDEX IF NOT EXISTS idx_tasks_toolId ON tasks(toolId);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt);
  `);
}
