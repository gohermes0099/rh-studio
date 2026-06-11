export function runMigrations(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webappId TEXT NOT NULL UNIQUE,
      webappName TEXT NOT NULL,
      nodeInfoList TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      coverUrl TEXT DEFAULT ''
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
      rhFileName TEXT DEFAULT '',
      originalName TEXT NOT NULL,
      mimeType TEXT,
      fileSize INTEGER,
      createdAt TEXT NOT NULL,
      imgbbUrl TEXT DEFAULT '',
      imgbbThumbnailUrl TEXT DEFAULT ''
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

    CREATE TABLE IF NOT EXISTS system_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      description TEXT DEFAULT '',
      isBuiltin INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    -- User-created system prompts must have id >= 1000 to avoid collision
    -- with built-in templates (id 1..N) that live in code, not the DB.
    INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('system_prompts', 999);

    CREATE TABLE IF NOT EXISTS prompt_enhancements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      originalText TEXT NOT NULL,
      enhancedText TEXT NOT NULL,
      rationale TEXT DEFAULT '',
      confidence TEXT DEFAULT 'medium',
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      systemPromptId INTEGER,
      imageHashes TEXT DEFAULT '[]',
      userContext TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_system_prompts_category ON system_prompts(category);
    CREATE INDEX IF NOT EXISTS idx_prompt_enhancements_createdAt ON prompt_enhancements(createdAt);
  `);

  // 006: AI enhancement tables created above (system_prompts, prompt_enhancements)
  const migrations = [
    // 001: Add coverUrl to tools
    `ALTER TABLE tools ADD COLUMN coverUrl TEXT DEFAULT ''`,
    // 002: Add prompt to gallery_items
    `ALTER TABLE gallery_items ADD COLUMN prompt TEXT DEFAULT ''`,
    // 003: Add imgbb columns to uploads
    `ALTER TABLE uploads ADD COLUMN imgbbUrl TEXT DEFAULT ''`,
    `ALTER TABLE uploads ADD COLUMN imgbbThumbnailUrl TEXT DEFAULT ''`,
    // 004: Add rhFileName to uploads
    `ALTER TABLE uploads ADD COLUMN rhFileName TEXT DEFAULT ''`,
    // 005: Add source upload tracking to gallery_items (for before/after display)
    `ALTER TABLE gallery_items ADD COLUMN sourceUploadUrl TEXT DEFAULT ''`,
    `ALTER TABLE gallery_items ADD COLUMN sourceUploadId INTEGER`,
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}