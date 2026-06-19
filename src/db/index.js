const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const { SCHEMA_SQL, SEED_CATEGORIES, SEED_BADGES, DEMO_USERS, DEMO_HAZARDS, DEMO_POSTS, DEMO_COMMENTS } = require('./schema');

const DB_FILE      = path.join(__dirname, '../../data.sqlite');
const DEMO_DB_FILE = path.join(__dirname, '../../data-demo.sqlite');

function hashPassword(password, saltHex) {
  const salt = Buffer.from(String(saltHex || ''), 'hex');
  const key = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
  return key.toString('hex');
}

function randomId(prefix = '') {
  return `${prefix}${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function rowsToObjects(execResult) {
  if (!execResult || !execResult.length) return [];
  const { columns, values } = execResult[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  });
}

function hasColumn(db, table, column) {
  const rows = db.exec(`PRAGMA table_info(${table})`);
  if (!rows || !rows.length) return false;
  return rows[0].values.some((v) => String(v[1]) === column);
}

function migrate(db) {
  const cols = [
    ['hazards', 'severity',    'ALTER TABLE hazards ADD COLUMN severity INTEGER NOT NULL DEFAULT 3'],
    ['hazards', 'status',      "ALTER TABLE hazards ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"],
    ['hazards', 'description', 'ALTER TABLE hazards ADD COLUMN description TEXT'],
    ['hazards', 'categoryId',  'ALTER TABLE hazards ADD COLUMN categoryId TEXT'],
    ['hazards', 'updatedAt',   'ALTER TABLE hazards ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0'],
    ['users',   'points',      'ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0'],
    ['users',   'email',       'ALTER TABLE users ADD COLUMN email TEXT'],
    ['posts',   'isMine',      'ALTER TABLE posts ADD COLUMN isMine INTEGER NOT NULL DEFAULT 0'],
    ['posts',   'pinned',      'ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0'],
  ];
  cols.forEach(([table, col, sql]) => {
    if (!hasColumn(db, table, col)) db.run(sql);
  });
}

function seedCategories(db) {
  SEED_CATEGORIES.forEach((c) => {
    const exists = rowsToObjects(db.exec('SELECT id FROM categories WHERE id=?', [c.id]))[0];
    if (!exists) {
      const s = db.prepare('INSERT INTO categories (id, name, emoji, riskWeight, color1, color2) VALUES (?,?,?,?,?,?)');
      s.run([c.id, c.name, c.emoji, c.riskWeight, c.color1, c.color2]);
      s.free();
    }
  });
}

function seedBadges(db) {
  SEED_BADGES.forEach((b) => {
    const exists = rowsToObjects(db.exec('SELECT id FROM badges WHERE id=?', [b.id]))[0];
    if (!exists) {
      const s = db.prepare('INSERT INTO badges (id, name, emoji, description, threshold, metric) VALUES (?,?,?,?,?,?)');
      s.run([b.id, b.name, b.emoji, b.description, b.threshold, b.metric]);
      s.free();
    }
  });
}

function seedAdmin(db) {
  // admins table（後台 Basic Auth）— 每次啟動 upsert，確保密碼與環境變數一致
  const adminPw = String(process.env.ADMIN_PASSWORD || 'admin');
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminHash = hashPassword(adminPw, adminSalt);
  const sa = db.prepare(
    'INSERT INTO admins (username, salt, hash, createdAt) VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt, hash=excluded.hash'
  );
  sa.run(['admin', adminSalt, adminHash, Date.now()]);
  sa.free();

  // admindemo — 載入展示資料的管理員帳號
  const adSalt = crypto.randomBytes(16).toString('hex');
  const adHash = hashPassword('admindemo', adSalt);
  const sad = db.prepare(
    'INSERT INTO admins (username, salt, hash, createdAt) VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt, hash=excluded.hash'
  );
  sad.run(['admindemo', adSalt, adHash, Date.now()]);
  sad.free();

  // users table — admin 前台登入（密碼 admin）
  const uExists = db.exec("SELECT id FROM users WHERE username='admin' LIMIT 1");
  if (!uExists.length || !uExists[0].values.length) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('admin', salt);
    const s = db.prepare('INSERT INTO users (id, username, salt, hash, points, createdAt) VALUES (?,?,?,?,?,?)');
    s.run(['system_admin', 'admin', salt, hash, 0, Date.now()]);
    s.free();
    const sp = db.prepare('INSERT OR IGNORE INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)');
    sp.run(['system_admin', '系統管理員', '@admin', '高雄市']);
    sp.free();
  }

  // users table — 一般展示帳號 user/user
  const uuExists = db.exec("SELECT id FROM users WHERE username='user' LIMIT 1");
  if (!uuExists.length || !uuExists[0].values.length) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('user', salt);
    const s = db.prepare('INSERT INTO users (id, username, salt, hash, points, createdAt) VALUES (?,?,?,?,?,?)');
    s.run(['system_user', 'user', salt, hash, 0, Date.now()]);
    s.free();
    const sp = db.prepare('INSERT OR IGNORE INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)');
    sp.run(['system_user', '一般用戶', '@user', '高雄市']);
    sp.free();
  }

  // users table — demo 展示帳號 demo/demo（登入後自動植入展示資料）
  const demoExists = db.exec("SELECT id FROM users WHERE username='demo' LIMIT 1");
  if (!demoExists.length || !demoExists[0].values.length) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('demo', salt);
    const s = db.prepare('INSERT INTO users (id, username, salt, hash, points, createdAt) VALUES (?,?,?,?,?,?)');
    s.run(['system_demo', 'demo', salt, hash, 0, Date.now()]);
    s.free();
    const sp = db.prepare('INSERT OR IGNORE INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)');
    sp.run(['system_demo', '展示用戶', '@demo', '高雄市']);
    sp.free();
  }
}

function seedDemo(db) {
  // 每次都刪除舊 demo 資料再重建，確保座標更新後立即生效
  db.run("DELETE FROM hazards WHERE id LIKE 'demo_h_%'");
  db.run("DELETE FROM posts    WHERE id LIKE 'demo_p_%'");
  db.run("DELETE FROM comments WHERE id LIKE 'demo_c_%'");
  db.run("DELETE FROM post_votes WHERE postId LIKE 'demo_p_%'");

  const now = Date.now();

  // Users
  DEMO_USERS.forEach((u) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('demo1234', salt);
    const su = db.prepare('INSERT OR IGNORE INTO users (id, username, salt, hash, points, createdAt) VALUES (?,?,?,?,?,?)');
    su.run([u.id, u.username, salt, hash, u.points, now - 86400000 * 7]);
    su.free();
    const sp = db.prepare('INSERT OR IGNORE INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)');
    sp.run([u.id, u.name, u.handle, u.city]);
    sp.free();
  });

  // Hazards
  DEMO_HAZARDS.forEach((h, i) => {
    const ts = now - (DEMO_HAZARDS.length - i) * 3600000 * 6;
    const sh = db.prepare(
      'INSERT OR IGNORE INTO hazards (id, categoryId, typeEmoji, label, title, description, lat, lng, color1, color2, severity, status, userId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    sh.run([h.id, h.categoryId, h.typeEmoji, h.label, h.title, h.description, h.lat, h.lng, h.color1, h.color2, h.severity, h.status, h.userId, ts, ts]);
    sh.free();
  });

  // Posts
  DEMO_POSTS.forEach((p, i) => {
    const ts = now - (DEMO_POSTS.length - i) * 3600000 * 6 + 300000;
    const sp = db.prepare(
      'INSERT OR IGNORE INTO posts (id, hazardId, typeEmoji, label, title, reporterName, votes, userId, createdAt) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    sp.run([p.id, p.hazardId, p.typeEmoji, p.label, p.title, p.reporterName, p.votes, p.userId, ts]);
    sp.free();
  });

  // Comments
  DEMO_COMMENTS.forEach((c, i) => {
    const ts = now - (DEMO_COMMENTS.length - i) * 3600000 * 2;
    const sc = db.prepare('INSERT OR IGNORE INTO comments (id, postId, author, text, at, userId) VALUES (?,?,?,?,?,?)');
    sc.run([c.id, c.postId, c.author, c.text, ts, c.userId]);
    sc.free();
  });

  // ── Demo 用戶（system_demo）資料初始化 ──────────────────
  db.run("DELETE FROM post_votes   WHERE userId='system_demo'");
  db.run("DELETE FROM user_badges  WHERE userId='system_demo'");
  // 把正門坑洞 + 校門前路口兩筆危險點歸屬給 demo 用戶
  db.run("UPDATE hazards SET userId='system_demo' WHERE id IN ('demo_h_01','demo_h_02')");
  db.run("UPDATE posts SET userId='system_demo', reporterName='Demo 用戶' WHERE hazardId IN ('demo_h_01','demo_h_02')");

  // demo 用戶對 10 篇貼文附議（達成「熱心市民」徽章門檻）
  ['demo_p_03','demo_p_05','demo_p_08','demo_p_10','demo_p_12',
   'demo_p_14','demo_p_15','demo_p_16','demo_p_18','demo_p_19'].forEach(postId => {
    const sv = db.prepare('INSERT OR IGNORE INTO post_votes (postId, userId, createdAt) VALUES (?,?,?)');
    sv.run([postId, 'system_demo', now]); sv.free();
  });

  // 積分 + 個人資料城市
  db.run("UPDATE users SET points=180 WHERE id='system_demo'");
  db.run("UPDATE user_profiles SET city='燕巢區' WHERE userId='system_demo'");

  // 核發成就徽章
  [
    ['badge_first',  now - 86400000 * 7],   // 初心排雷師
    ['badge_vote10', now - 86400000 * 2],   // 熱心市民
  ].forEach(([badgeId, earnedAt]) => {
    const sb = db.prepare('INSERT OR IGNORE INTO user_badges (userId, badgeId, earnedAt) VALUES (?,?,?)');
    sb.run(['system_demo', badgeId, earnedAt]); sb.free();
  });

  console.log(`[demo] 已植入 ${DEMO_HAZARDS.length} 筆危險點、${DEMO_POSTS.length} 筆貼文、${DEMO_COMMENTS.length} 則留言`);
}

function exportDb(db, file) {
  fs.writeFileSync(file, Buffer.from(db.export()));
}

async function openDb(dbFile = DB_FILE, { withDemoData = false } = {}) {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '../../node_modules/sql.js/dist', f),
  });

  const db = fs.existsSync(dbFile)
    ? new SQL.Database(fs.readFileSync(dbFile))
    : new SQL.Database();

  db.run(SCHEMA_SQL);
  migrate(db);
  seedCategories(db);
  seedBadges(db);
  seedAdmin(db);
  if (withDemoData) seedDemo(db);
  exportDb(db, dbFile);

  const persist = () => exportDb(db, dbFile);
  return { db, persist };
}

module.exports = { openDb, DB_FILE, DEMO_DB_FILE, rowsToObjects, hashPassword, randomId, seedDemo };
