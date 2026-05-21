const fs = require('fs');
const path = require('path');

const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'data.sqlite');

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_tags (
  profileId TEXT NOT NULL,
  tagText TEXT NOT NULL,
  ord INTEGER NOT NULL,
  PRIMARY KEY (profileId, tagText),
  FOREIGN KEY (profileId) REFERENCES profile(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prefs (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hazards (
  id TEXT PRIMARY KEY,
  typeEmoji TEXT NOT NULL,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  color1 TEXT NOT NULL,
  color2 TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  hazardId TEXT NOT NULL,
  typeEmoji TEXT NOT NULL,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  reporterName TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  photoUrl TEXT,
  isMine INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (hazardId) REFERENCES hazards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL,
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);
`;

function exportDbToFile(db) {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function openDb() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  let db;
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA_SQL);

  // Seed profile if missing
  const profileRows = db.exec("SELECT id FROM profile WHERE id='me' LIMIT 1");
  if (!profileRows.length || !profileRows[0].values.length) {
    db.run(
      "INSERT INTO profile (id, name, handle, city) VALUES ('me', '道路守護者', '@road_hunter_87', '高雄市')"
    );
    db.run("DELETE FROM profile_tags WHERE profileId='me'");
    const seedTags = ['🔥 黃金排雷師', '⭐ 連續7天', '✅ 已認證'];
    seedTags.forEach((t, idx) => {
      const stmt = db.prepare('INSERT INTO profile_tags (profileId, tagText, ord) VALUES (?, ?, ?)');
      stmt.run(['me', t, idx]);
      stmt.free();
    });
  }

  // Seed prefs if missing
  const prefKeys = ['nearbyNotify', 'autoGps', 'nightSaver'];
  const defaultPrefs = { nearbyNotify: 1, autoGps: 1, nightSaver: 0 };
  prefKeys.forEach((k) => {
    const r = db.exec(`SELECT key FROM prefs WHERE key='${k}' LIMIT 1`);
    if (!r.length || !r[0].values.length) {
      const stmt = db.prepare('INSERT INTO prefs (key, value) VALUES (?, ?)');
      stmt.run([k, defaultPrefs[k]]);
      stmt.free();
    }
  });

  exportDbToFile(db);

  return {
    SQL,
    db,
    persist: () => exportDbToFile(db)
  };
}

function rowsToObjects(execResult) {
  if (!execResult || !execResult.length) return [];
  const { columns, values } = execResult[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((c, idx) => (obj[c] = row[idx]));
    return obj;
  });
}

module.exports = {
  openDb,
  rowsToObjects
};
