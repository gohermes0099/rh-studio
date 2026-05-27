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

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      rhFileName TEXT NOT NULL DEFAULT '',
      originalName TEXT NOT NULL,
      mimeType TEXT,
      fileSize INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      toolId INTEGER,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Add coverUrl to tools if not present (migration for existing DBs)
  try {
    db.exec("ALTER TABLE tools ADD COLUMN coverUrl TEXT DEFAULT ''");
  } catch {
    // Column already exists — safe to ignore
  }

  // Gallery items — independent image storage that survives task cleanup
  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT,
      toolId INTEGER,
      toolName TEXT NOT NULL,
      fileName TEXT NOT NULL,
      originalUrl TEXT,
      outputType TEXT,
      prompt TEXT DEFAULT '',
      nodeId TEXT,
      createdAt TEXT NOT NULL,
      deletedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_gallery_items_deletedAt ON gallery_items(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_gallery_items_createdAt ON gallery_items(createdAt);
  `);

  // Add prompt column to gallery_items if not present (migration for existing DBs)
  try {
    db.exec("ALTER TABLE gallery_items ADD COLUMN prompt TEXT DEFAULT ''");
  } catch {
    // Column already exists — safe to ignore
  }
}
