const fs = require('fs');
const path = require('path');

const initSqlJs = require('sql.js');
const crypto = require('crypto');

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

CREATE TABLE IF NOT EXISTS admins (
  username TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Per-user profile/prefs (v2)
CREATE TABLE IF NOT EXISTS user_profiles (
  userId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  city TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profile_tags (
  userId TEXT NOT NULL,
  tagText TEXT NOT NULL,
  ord INTEGER NOT NULL,
  PRIMARY KEY (userId, tagText),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_prefs (
  userId TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (userId, key),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_votes (
  postId TEXT NOT NULL,
  userId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`;

function hashPassword(password, saltHex) {
  const salt = Buffer.from(String(saltHex || ''), 'hex');
  const key = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
  return key.toString('hex');
}

function randomId(prefix) {
  return `${prefix}${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function hasColumn(db, tableName, columnName) {
  const rows = db.exec(`PRAGMA table_info(${tableName})`);
  if (!rows || !rows.length) return false;
  const values = rows[0].values || [];
  return values.some((v) => String(v[1]) === columnName);
}

function migrateSchema(db) {
  // Add userId columns to existing tables so admin can see who created what.
  // (SQLite doesn't support ADD COLUMN IF NOT EXISTS)
  if (!hasColumn(db, 'hazards', 'userId')) db.run('ALTER TABLE hazards ADD COLUMN userId TEXT');
  if (!hasColumn(db, 'posts', 'userId')) db.run('ALTER TABLE posts ADD COLUMN userId TEXT');
  if (!hasColumn(db, 'comments', 'userId')) db.run('ALTER TABLE comments ADD COLUMN userId TEXT');
}

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
  migrateSchema(db);

  // Seed admin if missing (persisted in DB; do NOT store plaintext)
  const adminRows = db.exec("SELECT username FROM admins WHERE username='admin' LIMIT 1");
  if (!adminRows.length || !adminRows[0].values.length) {
    const initialPassword = String(process.env.ADMIN_PASSWORD || 'admin1234');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(initialPassword, salt);
    const createdAt = Date.now();
    const stmt = db.prepare('INSERT INTO admins (username, salt, hash, createdAt) VALUES (?, ?, ?, ?)');
    stmt.run(['admin', salt, hash, createdAt]);
    stmt.free();
  }

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
  rowsToObjects,
  hashPassword,
  randomId
};
