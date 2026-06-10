const initSqlJs = require('sql.js');
const fs = require('fs');
(async () => {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync('/opt/rh-studio/data/rh-studio.db');
  const db = new SQL.Database(buffer);

  // Same query as tools.ts
  const stmt = db.prepare("SELECT t.*, (SELECT COUNT(*) FROM tasks WHERE toolId = t.id) as taskCount FROM tools t ORDER BY t.updatedAt DESC");

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  console.log('Rows found:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
})();