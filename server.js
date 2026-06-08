const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const { openDb, rowsToObjects, hashPassword, randomId } = require('./db');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function id(prefix) {
  return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

(async () => {
  const { db, persist } = await openDb();

  const app = express();

  app.use(express.json({ limit: '2mb' }));

  function parseCookies(req) {
    const header = String(req.headers.cookie || '');
    const out = {};
    header.split(';').forEach((part) => {
      const p = part.trim();
      if (!p) return;
      const idx = p.indexOf('=');
      if (idx < 0) return;
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      if (!k) return;
      out[k] = decodeURIComponent(v);
    });
    return out;
  }

  function setSessionCookie(res, token) {
    const maxAge = 60 * 60 * 24 * 7; // 7d
    const parts = [
      `sid=${encodeURIComponent(token)}`,
      'Path=/',
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax'
    ];
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  }

  function requireUser(req, res, next) {
    const cookies = parseCookies(req);
    const token = String(cookies.sid || '');
    if (!token) return res.status(401).json({ error: 'not_logged_in' });

    const now = Date.now();
    const s = rowsToObjects(
      db.exec(
        'SELECT s.userId, u.username FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=' +
          JSON.stringify(token) +
          ' AND s.expiresAt > ' +
          now +
          ' LIMIT 1'
      )
    )[0];
    if (!s) return res.status(401).json({ error: 'session_expired' });
    req.user = { id: s.userId, username: s.username };
    next();
  }

  function getUserProfile(userId) {
    const prof = rowsToObjects(
      db.exec('SELECT name, handle, city FROM user_profiles WHERE userId=' + JSON.stringify(userId) + ' LIMIT 1')
    )[0];
    const tags = rowsToObjects(
      db.exec('SELECT tagText, ord FROM user_profile_tags WHERE userId=' + JSON.stringify(userId) + ' ORDER BY ord ASC')
    ).map((r) => r.tagText);
    return prof ? { name: prof.name, handle: prof.handle, city: prof.city, tags } : null;
  }

  function getUserPrefs(userId) {
    const rows = rowsToObjects(
      db.exec('SELECT key, value FROM user_prefs WHERE userId=' + JSON.stringify(userId))
    );
    const prefs = { nearbyNotify: true, autoGps: true, nightSaver: false };
    rows.forEach((r) => (prefs[r.key] = !!r.value));
    return prefs;
  }

  const FIXED_VOTES_THRESHOLD = 5; // keep in sync with front-end COMMUNITY_FIXED_VOTES

  function getUserAchievementStats(userId) {
    const myHazardsRow = rowsToObjects(
      db.exec('SELECT COUNT(1) AS c FROM hazards WHERE userId=' + JSON.stringify(userId))
    )[0];
    const myHazards = Number(myHazardsRow ? myHazardsRow.c : 0) || 0;

    const nightReportsRow = rowsToObjects(
      db.exec(
        'SELECT COUNT(1) AS c FROM hazards WHERE userId=' +
          JSON.stringify(userId) +
          " AND ((CAST(strftime('%H', datetime(createdAt / 1000, 'unixepoch', 'localtime')) AS INTEGER) >= 18) OR (CAST(strftime('%H', datetime(createdAt / 1000, 'unixepoch', 'localtime')) AS INTEGER) < 6))"
      )
    )[0];
    const nightReports = Number(nightReportsRow ? nightReportsRow.c : 0) || 0;

    const receivedVotesRow = rowsToObjects(
      db.exec('SELECT COALESCE(SUM(votes), 0) AS s FROM posts WHERE userId=' + JSON.stringify(userId))
    )[0];
    const receivedVotes = Number(receivedVotesRow ? receivedVotesRow.s : 0) || 0;

    const myFixedRow = rowsToObjects(
      db.exec(
        'SELECT COUNT(1) AS c FROM posts WHERE userId=' +
          JSON.stringify(userId) +
          ' AND votes >= ' +
          FIXED_VOTES_THRESHOLD
      )
    )[0];
    const myFixed = Number(myFixedRow ? myFixedRow.c : 0) || 0;

    const helpedVotesRow = rowsToObjects(
      db.exec('SELECT COUNT(1) AS c FROM post_votes WHERE userId=' + JSON.stringify(userId))
    )[0];
    const helpedVotes = Number(helpedVotesRow ? helpedVotesRow.c : 0) || 0;

    return { myHazards, myFixed, receivedVotes, helpedVotes, nightReports };
  }

  function parseBasicAuth(req) {
    const header = String(req.headers.authorization || '');
    if (!header.toLowerCase().startsWith('basic ')) return null;
    const b64 = header.slice(6).trim();
    let decoded = '';
    try {
      decoded = Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return null;
    }
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    return { username, password };
  }

  function requireAdmin(req, res, next) {
    const creds = parseBasicAuth(req);
    if (!creds) {
      res.setHeader('WWW-Authenticate', 'Basic realm="lukou-pailei-admin", charset="UTF-8"');
      return res.status(401).send('Unauthorized');
    }

    const username = String(creds.username || '');
    const password = String(creds.password || '');
    const row = rowsToObjects(db.exec('SELECT salt, hash FROM admins WHERE username=' + JSON.stringify(username) + ' LIMIT 1'))[0];
    if (!row) {
      res.setHeader('WWW-Authenticate', 'Basic realm="lukou-pailei-admin", charset="UTF-8"');
      return res.status(401).send('Unauthorized');
    }
    const expected = String(row.hash || '');
    const actual = hashPassword(password, row.salt);
    if (actual !== expected) {
      res.setHeader('WWW-Authenticate', 'Basic realm="lukou-pailei-admin", charset="UTF-8"');
      return res.status(401).send('Unauthorized');
    }
    req.adminUser = username;
    next();
  }

  // Admin console (protected). Put BEFORE express.static so it can't be bypassed.
  app.get(['/admin', '/admin.html'], requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
  });

  // Static assets (front-end files)
  app.use(express.static(__dirname));

  // Uploads
  const uploadsDir = path.join(__dirname, 'uploads');
  ensureDir(uploadsDir);

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').slice(0, 12);
        cb(null, `${Date.now()}_${Math.random().toString(16).slice(2, 8)}${ext || ''}`);
      }
    }),
    limits: { fileSize: 6 * 1024 * 1024 }
  });

  app.use('/uploads', express.static(uploadsDir));

  // --- API ---
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // --- Auth ---
  app.get('/api/me', (req, res) => {
    try {
      const cookies = parseCookies(req);
      const token = String(cookies.sid || '');
      if (!token) return res.json({ ok: true, loggedIn: false });
      const now = Date.now();
      const s = rowsToObjects(
        db.exec(
          'SELECT s.userId, u.username FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=' +
            JSON.stringify(token) +
            ' AND s.expiresAt > ' +
            now +
            ' LIMIT 1'
        )
      )[0];
      if (!s) return res.json({ ok: true, loggedIn: false });
      res.json({ ok: true, loggedIn: true, user: { id: s.userId, username: s.username } });
    } catch {
      res.json({ ok: true, loggedIn: false });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 20) || '道路守護者';
    const city = String(body.city || '').trim().slice(0, 20) || '高雄市';

    if (username.length < 3 || username.length > 24 || !/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'invalid_username' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'weak_password' });

    const exists = rowsToObjects(db.exec('SELECT id FROM users WHERE username=' + JSON.stringify(username) + ' LIMIT 1'))[0];
    if (exists) return res.status(400).json({ error: 'username_taken' });

    const userId = randomId('u_');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const createdAt = Date.now();

    const stmt = db.prepare('INSERT INTO users (id, username, salt, hash, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run([userId, username, salt, hash, createdAt]);
    stmt.free();

    const handle = '@' + username;
    const stmtP = db.prepare('INSERT INTO user_profiles (userId, name, handle, city) VALUES (?, ?, ?, ?)');
    stmtP.run([userId, name, handle, city]);
    stmtP.free();

    const defaults = { nearbyNotify: 1, autoGps: 1, nightSaver: 0 };
    Object.keys(defaults).forEach((k) => {
      const s2 = db.prepare('INSERT INTO user_prefs (userId, key, value) VALUES (?, ?, ?)');
      s2.run([userId, k, defaults[k]]);
      s2.free();
    });

    persist();
    res.json({ ok: true, user: { id: userId, username } });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    const row = rowsToObjects(db.exec('SELECT id, salt, hash FROM users WHERE username=' + JSON.stringify(username) + ' LIMIT 1'))[0];
    if (!row) return res.status(400).json({ error: 'invalid_login' });

    const actual = hashPassword(password, row.salt);
    if (actual !== String(row.hash || '')) return res.status(400).json({ error: 'invalid_login' });

    const token = crypto.randomBytes(24).toString('hex');
    const createdAt = Date.now();
    const expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000;
    const stmt = db.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)');
    stmt.run([token, row.id, createdAt, expiresAt]);
    stmt.free();
    persist();

    setSessionCookie(res, token);
    res.json({ ok: true, user: { id: row.id, username } });
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req);
    const token = String(cookies.sid || '');
    if (token) db.run('DELETE FROM sessions WHERE token=?', [token]);
    persist();
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // --- Admin API (protected) ---
  app.get('/api/admin/hazards', requireAdmin, (req, res) => {
    const items = rowsToObjects(db.exec('SELECT * FROM hazards ORDER BY createdAt DESC'));
    res.json({ ok: true, items });
  });

  app.get('/api/admin/posts', requireAdmin, (req, res) => {
    const items = rowsToObjects(db.exec('SELECT * FROM posts ORDER BY createdAt DESC'));
    res.json({ ok: true, items });
  });

  app.get('/api/admin/comments', requireAdmin, (req, res) => {
    const items = rowsToObjects(db.exec('SELECT * FROM comments ORDER BY at DESC'));
    res.json({ ok: true, items });
  });

  app.delete('/api/admin/hazards/:hazardId', requireAdmin, (req, res) => {
    const hazardId = String(req.params.hazardId || '');
    if (!hazardId) return res.status(400).json({ error: 'missing_id' });
    db.run('DELETE FROM hazards WHERE id=?', [hazardId]);
    persist();
    res.json({ ok: true });
  });

  app.delete('/api/admin/posts/:postId', requireAdmin, (req, res) => {
    const postId = String(req.params.postId || '');
    if (!postId) return res.status(400).json({ error: 'missing_id' });
    db.run('DELETE FROM posts WHERE id=?', [postId]);
    persist();
    res.json({ ok: true });
  });

  app.delete('/api/admin/comments/:commentId', requireAdmin, (req, res) => {
    const commentId = String(req.params.commentId || '');
    if (!commentId) return res.status(400).json({ error: 'missing_id' });
    db.run('DELETE FROM comments WHERE id=?', [commentId]);
    persist();
    res.json({ ok: true });
  });

  app.put('/api/admin/password', requireAdmin, (req, res) => {
    const body = req.body || {};
    const oldPassword = String(body.oldPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) return res.status(400).json({ error: 'weak_password' });

    const row = rowsToObjects(db.exec("SELECT salt, hash FROM admins WHERE username='admin' LIMIT 1"))[0];
    if (!row) return res.status(500).json({ error: 'admin_missing' });
    const actualOld = hashPassword(oldPassword, row.salt);
    if (actualOld !== String(row.hash || '')) return res.status(400).json({ error: 'wrong_password' });

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);
    db.run("UPDATE admins SET salt=?, hash=? WHERE username='admin'", [newSalt, newHash]);
    persist();
    res.json({ ok: true });
  });

  app.get('/api/state', requireUser, (req, res) => {
    const userId = req.user.id;

    const profile = getUserProfile(userId);
    const prefs = getUserPrefs(userId);
    const myStats = getUserAchievementStats(userId);

    // Global hazards/posts for demo
    const hazards = rowsToObjects(db.exec('SELECT * FROM hazards ORDER BY createdAt DESC'));
    const posts = rowsToObjects(db.exec('SELECT * FROM posts ORDER BY createdAt DESC'));

    const comments = rowsToObjects(db.exec('SELECT * FROM comments ORDER BY at ASC'));
    const commentsByPost = {};
    comments.forEach((c) => {
      commentsByPost[c.postId] = commentsByPost[c.postId] || [];
      commentsByPost[c.postId].push({ author: c.author, text: c.text, at: c.at });
    });

    const postsWithComments = posts.map((p) => ({
      id: p.id,
      hazardId: p.hazardId,
      typeEmoji: p.typeEmoji,
      label: p.label,
      title: p.title,
      createdAt: p.createdAt,
      votes: p.votes,
      comments: commentsByPost[p.id] || [],
      isMine: String(p.userId || '') === String(userId),
      voted: !!rowsToObjects(db.exec('SELECT 1 FROM post_votes WHERE postId=' + JSON.stringify(p.id) + ' AND userId=' + JSON.stringify(userId) + ' LIMIT 1'))[0],
      reporterName: p.reporterName,
      photoUrl: p.photoUrl || null
    }));

    res.json({
      me: { id: userId, username: req.user.username },
      profile,
      prefs,
      myStats,
      hazards: hazards.map((h) => ({
        id: h.id,
        type: h.typeEmoji,
        emoji: h.typeEmoji,
        label: h.label,
        title: h.title,
        lat: h.lat,
        lng: h.lng,
        colors: [h.color1, h.color2],
        createdAt: h.createdAt,
        userId: h.userId || null
      })),
      posts: postsWithComments
    });
  });

  app.put('/api/profile', requireUser, (req, res) => {
    const body = req.body || {};
    const userId = req.user.id;
    const name = String(body.name || '').trim().slice(0, 20) || '道路守護者';
    const handleRaw = String(body.handle || '').trim().slice(0, 24) || '@road_hunter_87';
    const handle = handleRaw.startsWith('@') ? handleRaw : '@' + handleRaw;
    const city = String(body.city || '').trim().slice(0, 20) || '高雄市';
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    const existing = rowsToObjects(db.exec('SELECT userId FROM user_profiles WHERE userId=' + JSON.stringify(userId) + ' LIMIT 1'))[0];
    if (existing) db.run('UPDATE user_profiles SET name=?, handle=?, city=? WHERE userId=?', [name, handle, city, userId]);
    else db.run('INSERT INTO user_profiles (userId, name, handle, city) VALUES (?, ?, ?, ?)', [userId, name, handle, city]);

    db.run('DELETE FROM user_profile_tags WHERE userId=?', [userId]);
    tags.slice(0, 3).forEach((t, idx) => {
      const stmt = db.prepare('INSERT INTO user_profile_tags (userId, tagText, ord) VALUES (?, ?, ?)');
      stmt.run([userId, t, idx]);
      stmt.free();
    });

    persist();
    res.json({ ok: true });
  });

  app.put('/api/prefs', requireUser, (req, res) => {
    const body = req.body || {};
    const userId = req.user.id;
    const keys = ['nearbyNotify', 'autoGps', 'nightSaver'];
    keys.forEach((k) => {
      if (!(k in body)) return;
      const v = body[k] ? 1 : 0;
      const stmt = db.prepare('INSERT INTO user_prefs (userId, key, value) VALUES (?, ?, ?) ON CONFLICT(userId, key) DO UPDATE SET value=excluded.value');
      stmt.run([userId, k, v]);
      stmt.free();
    });
    persist();
    res.json({ ok: true });
  });

  app.post('/api/upload', requireUser, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    const urlPath = `/uploads/${req.file.filename}`;
    res.json({ ok: true, url: urlPath });
  });

  // Create a report: hazard + community post (optionally with uploaded photoUrl)
  app.post('/api/report', requireUser, (req, res) => {
    const body = req.body || {};
    const hazard = body.hazard || {};
    const post = body.post || {};
    const userId = req.user.id;

    const hazardId = String(hazard.id || id('u')).slice(0, 60);
    const typeEmoji = String(hazard.type || hazard.emoji || '⚠️').trim().slice(0, 4);
    const label = String(hazard.label || '新回報').trim().slice(0, 40);
    const title = String(hazard.title || `【新回報】${label}`).trim().slice(0, 80);
    const lat = Number(hazard.lat);
    const lng = Number(hazard.lng);
    const colors = Array.isArray(hazard.colors) && hazard.colors.length >= 2 ? hazard.colors : ['#FF3B4E', '#FF6B35'];
    const createdAt = Date.now();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'invalid_lat_lng' });
    }

    const stmtHaz = db.prepare(
      'INSERT OR REPLACE INTO hazards (id, typeEmoji, label, title, lat, lng, color1, color2, createdAt, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' 
    );
    stmtHaz.run([hazardId, typeEmoji, label, title, lat, lng, String(colors[0]), String(colors[1]), createdAt, userId]);
    stmtHaz.free();

    const prof = getUserProfile(userId);
    const reporterName = String(post.reporterName || (prof ? prof.name : req.user.username)).trim().slice(0, 20) || req.user.username;

    const postId = String(post.id || id('p')).slice(0, 60);
    const postTitle = String(post.title || `${title}（GPS 建立）`).trim().slice(0, 100);
    const photoUrl = post.photoUrl ? String(post.photoUrl).slice(0, 200) : null;

    const stmtPost = db.prepare(
      'INSERT OR REPLACE INTO posts (id, hazardId, typeEmoji, label, title, reporterName, createdAt, votes, photoUrl, isMine, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    );
    stmtPost.run([postId, hazardId, typeEmoji, label, postTitle, reporterName, createdAt, 0, photoUrl, userId]);
    stmtPost.free();

    persist();

    res.json({
      ok: true,
      hazard: {
        id: hazardId,
        type: typeEmoji,
        emoji: typeEmoji,
        label,
        title,
        lat,
        lng,
        colors,
        createdAt,
        userId
      },
      post: {
        id: postId,
        hazardId,
        typeEmoji,
        label,
        title: postTitle,
        createdAt,
        votes: 0,
        comments: [],
        isMine: true,
        reporterName,
        photoUrl
      }
    });
  });

  app.post('/api/posts/:postId/vote', requireUser, (req, res) => {
    const postId = String(req.params.postId || '');
    const r = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    if (!r) return res.status(404).json({ error: 'not_found' });

    try {
      const stmt = db.prepare('INSERT INTO post_votes (postId, userId, createdAt) VALUES (?, ?, ?)');
      stmt.run([postId, req.user.id, Date.now()]);
      stmt.free();
    } catch {
      return res.status(400).json({ error: 'already_voted' });
    }

    db.run('UPDATE posts SET votes = votes + 1 WHERE id=?', [postId]);
    const nextRow = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    const next = Number(nextRow ? nextRow.votes : (Number(r.votes || 0) + 1));
    persist();
    res.json({ ok: true, votes: next });
  });

  // 支援取消附議（toggle 行為）
  app.delete('/api/posts/:postId/vote', requireUser, (req, res) => {
    const postId = String(req.params.postId || '');
    const r = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    if (!r) return res.status(404).json({ error: 'not_found' });

    try {
      const stmt = db.prepare('DELETE FROM post_votes WHERE postId=? AND userId=?');
      stmt.run([postId, req.user.id]);
      stmt.free();
    } catch (err) {
      return res.status(400).json({ error: 'not_voted' });
    }

    // 減少 posts.votes（下限 0）
    db.run('UPDATE posts SET votes = CASE WHEN votes>0 THEN votes-1 ELSE 0 END WHERE id=?', [postId]);
    const nextRow = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    const next = Number(nextRow ? nextRow.votes : Math.max(0, Number(r.votes || 0) - 1));
    persist();
    res.json({ ok: true, votes: next });
  });

  app.post('/api/posts/:postId/comments', requireUser, (req, res) => {
    const postId = String(req.params.postId || '');
    const text = String((req.body || {}).text || '').trim().slice(0, 200);
    if (!text) return res.status(400).json({ error: 'missing_text' });

    const exists = rowsToObjects(db.exec('SELECT id FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    if (!exists) return res.status(404).json({ error: 'not_found' });

    const prof = getUserProfile(req.user.id);
    const author = String((req.body || {}).author || (prof ? prof.name : req.user.username)).trim().slice(0, 20) || req.user.username;
    const at = Date.now();
    const cid = id('c');

    const stmt = db.prepare('INSERT INTO comments (id, postId, author, text, at, userId) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run([cid, postId, author, text, at, req.user.id]);
    stmt.free();

    persist();
    res.json({ ok: true, comment: { id: cid, author, text, at } });
  });

  // SPA fallback: open the HTML
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '路口排雷_完整版App.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
})();
