const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { openDb, rowsToObjects } = require('./db');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;

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

  app.get('/api/state', (req, res) => {
    // Profile
    const prof = rowsToObjects(db.exec("SELECT id, name, handle, city FROM profile WHERE id='me' LIMIT 1"))[0];
    const tags = rowsToObjects(db.exec("SELECT tagText, ord FROM profile_tags WHERE profileId='me' ORDER BY ord ASC"))
      .map((r) => r.tagText);

    // Prefs
    const prefRows = rowsToObjects(db.exec('SELECT key, value FROM prefs'));
    const prefs = {};
    prefRows.forEach((r) => (prefs[r.key] = !!r.value));

    // Only return user-created hazards/posts (this demo keeps seed hazards/posts in the front-end)
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
      isMine: !!p.isMine,
      reporterName: p.reporterName,
      photoUrl: p.photoUrl || null
    }));

    res.json({
      profile: prof ? { name: prof.name, handle: prof.handle, city: prof.city, tags } : null,
      prefs,
      hazards: hazards.map((h) => ({
        id: h.id,
        type: h.typeEmoji,
        emoji: h.typeEmoji,
        label: h.label,
        title: h.title,
        lat: h.lat,
        lng: h.lng,
        colors: [h.color1, h.color2],
        createdAt: h.createdAt
      })),
      posts: postsWithComments
    });
  });

  app.put('/api/profile', (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim().slice(0, 20) || '道路守護者';
    const handleRaw = String(body.handle || '').trim().slice(0, 24) || '@road_hunter_87';
    const handle = handleRaw.startsWith('@') ? handleRaw : '@' + handleRaw;
    const city = String(body.city || '').trim().slice(0, 20) || '高雄市';
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    db.run("UPDATE profile SET name=?, handle=?, city=? WHERE id='me'", [name, handle, city]);
    db.run("DELETE FROM profile_tags WHERE profileId='me'");
    tags.slice(0, 3).forEach((t, idx) => {
      const stmt = db.prepare('INSERT INTO profile_tags (profileId, tagText, ord) VALUES (?, ?, ?)');
      stmt.run(['me', t, idx]);
      stmt.free();
    });

    persist();
    res.json({ ok: true });
  });

  app.put('/api/prefs', (req, res) => {
    const body = req.body || {};
    const keys = ['nearbyNotify', 'autoGps', 'nightSaver'];
    keys.forEach((k) => {
      if (!(k in body)) return;
      const v = body[k] ? 1 : 0;
      const stmt = db.prepare('INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      stmt.run([k, v]);
      stmt.free();
    });
    persist();
    res.json({ ok: true });
  });

  app.post('/api/upload', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    const urlPath = `/uploads/${req.file.filename}`;
    res.json({ ok: true, url: urlPath });
  });

  // Create a report: hazard + community post (optionally with uploaded photoUrl)
  app.post('/api/report', (req, res) => {
    const body = req.body || {};
    const hazard = body.hazard || {};
    const post = body.post || {};

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
      'INSERT OR REPLACE INTO hazards (id, typeEmoji, label, title, lat, lng, color1, color2, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' 
    );
    stmtHaz.run([hazardId, typeEmoji, label, title, lat, lng, String(colors[0]), String(colors[1]), createdAt]);
    stmtHaz.free();

    // reporterName: from profile if possible
    const prof = rowsToObjects(db.exec("SELECT name FROM profile WHERE id='me' LIMIT 1"))[0];
    const reporterName = String(post.reporterName || (prof ? prof.name : '你')).trim().slice(0, 20) || '你';

    const postId = String(post.id || id('p')).slice(0, 60);
    const postTitle = String(post.title || `${title}（GPS 建立）`).trim().slice(0, 100);
    const photoUrl = post.photoUrl ? String(post.photoUrl).slice(0, 200) : null;

    const stmtPost = db.prepare(
      'INSERT OR REPLACE INTO posts (id, hazardId, typeEmoji, label, title, reporterName, createdAt, votes, photoUrl, isMine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    );
    stmtPost.run([postId, hazardId, typeEmoji, label, postTitle, reporterName, createdAt, 0, photoUrl]);
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
        colors
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

  app.post('/api/posts/:postId/vote', (req, res) => {
    const postId = String(req.params.postId || '');
    const r = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    if (!r) return res.status(404).json({ error: 'not_found' });

    const next = Number(r.votes || 0) + 1;
    db.run('UPDATE posts SET votes=? WHERE id=?', [next, postId]);
    persist();
    res.json({ ok: true, votes: next });
  });

  app.post('/api/posts/:postId/comments', (req, res) => {
    const postId = String(req.params.postId || '');
    const text = String((req.body || {}).text || '').trim().slice(0, 200);
    if (!text) return res.status(400).json({ error: 'missing_text' });

    const exists = rowsToObjects(db.exec('SELECT id FROM posts WHERE id=' + JSON.stringify(postId) + ' LIMIT 1'))[0];
    if (!exists) return res.status(404).json({ error: 'not_found' });

    const author = String((req.body || {}).author || '').trim().slice(0, 20) || '你';
    const at = Date.now();
    const cid = id('c');

    const stmt = db.prepare('INSERT INTO comments (id, postId, author, text, at) VALUES (?, ?, ?, ?, ?)');
    stmt.run([cid, postId, author, text, at]);
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
