const express = require('express');
const { rowsToObjects, randomId } = require('../db/index');
const upload = require('../middleware/upload');

module.exports = function hazardsRouter(requireUser, getUserProfile, checkAndAwardBadges) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const db = req.db;
    const { status, categoryId } = req.query;
    let sql = 'SELECT * FROM hazards';
    const params = [];
    const where  = [];
    if (status)     { where.push('status=?');     params.push(status); }
    if (categoryId) { where.push('categoryId=?'); params.push(categoryId); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY createdAt DESC';
    res.json({ ok: true, hazards: rowsToObjects(db.exec(sql, params)) });
  });

  router.get('/categories', (req, res) => {
    res.json({ ok: true, categories: rowsToObjects(req.db.exec('SELECT * FROM categories ORDER BY riskWeight DESC')) });
  });

  router.post('/upload', requireUser, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });

  router.post('/report', requireUser, (req, res) => {
    const db = req.db;
    const { body = {}, user: { id: userId } } = req;
    const hazard = body.hazard || {};
    const post   = body.post   || {};

    const lat = Number(hazard.lat);
    const lng = Number(hazard.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return res.status(400).json({ error: 'invalid_lat_lng' });

    const severity   = Math.min(5, Math.max(1, Number(hazard.severity) || 3));
    const categoryId = String(hazard.categoryId || '').slice(0, 40) || null;
    const typeEmoji  = String(hazard.type || hazard.emoji || '⚠️').trim().slice(0, 4);
    const label      = String(hazard.label || '新回報').trim().slice(0, 40);
    const title      = String(hazard.title || `【新回報】${label}`).trim().slice(0, 80);
    const description = String(hazard.description || '').trim().slice(0, 500) || null;
    const colors     = Array.isArray(hazard.colors) && hazard.colors.length >= 2
      ? hazard.colors : ['#FF3B4E', '#FF6B35'];
    const now      = Date.now();
    const hazardId = randomId('h_');

    const sh = db.prepare(
      'INSERT INTO hazards (id, categoryId, typeEmoji, label, title, description, lat, lng, color1, color2, severity, status, userId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    sh.run([hazardId, categoryId, typeEmoji, label, title, description, lat, lng, String(colors[0]), String(colors[1]), severity, 'pending', userId, now, now]);
    sh.free();

    const prof         = getUserProfile(db, userId);
    const reporterName = String(post.reporterName || prof?.name || 'user').trim().slice(0, 20);
    const postId       = randomId('p_');
    const postTitle    = String(post.title || `${title}（GPS 建立）`).trim().slice(0, 100);
    const photoUrl     = post.photoUrl ? String(post.photoUrl).slice(0, 200) : null;

    const sp = db.prepare(
      'INSERT INTO posts (id, hazardId, typeEmoji, label, title, reporterName, photoUrl, votes, userId, createdAt) VALUES (?,?,?,?,?,?,?,0,?,?)'
    );
    sp.run([postId, hazardId, typeEmoji, label, postTitle, reporterName, photoUrl, userId, now]);
    sp.free();

    db.run('UPDATE users SET points = points + 10 WHERE id=?', [userId]);
    checkAndAwardBadges(db, req.persist, userId);
    req.persist();

    res.json({
      ok: true,
      hazard: { id: hazardId, type: typeEmoji, emoji: typeEmoji, label, title, lat, lng, colors, severity, status: 'pending', createdAt: now, userId },
      post: { id: postId, hazardId, typeEmoji, label, title: postTitle, createdAt: now, votes: 0, comments: [], isMine: true, reporterName, photoUrl },
    });
  });

  router.get('/:id', (req, res) => {
    const db = req.db;
    const h = rowsToObjects(db.exec('SELECT * FROM hazards WHERE id=? LIMIT 1', [req.params.id]))[0];
    if (!h) return res.status(404).json({ error: 'not_found' });
    const photos = rowsToObjects(db.exec('SELECT url FROM hazard_photos WHERE hazardId=? ORDER BY createdAt ASC', [h.id]));
    res.json({ ok: true, hazard: { ...h, photos: photos.map((p) => p.url) } });
  });

  router.patch('/:id', requireUser, (req, res) => {
    const db = req.db;
    const hazardId = req.params.id;
    const row = rowsToObjects(db.exec('SELECT userId FROM hazards WHERE id=? LIMIT 1', [hazardId]))[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (String(row.userId) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    const { title, description, severity } = req.body || {};
    const sets = []; const vals = [];
    if (title       !== undefined) { sets.push('title=?');       vals.push(String(title).trim().slice(0, 80)); }
    if (description !== undefined) { sets.push('description=?'); vals.push(String(description).trim().slice(0, 500) || null); }
    if (severity    !== undefined) { sets.push('severity=?');    vals.push(Math.min(5, Math.max(1, Number(severity) || 3))); }
    if (sets.length) {
      sets.push('updatedAt=?'); vals.push(Date.now()); vals.push(hazardId);
      db.run(`UPDATE hazards SET ${sets.join(',')} WHERE id=?`, vals);
      if (title !== undefined) db.run('UPDATE posts SET title=? WHERE hazardId=?', [String(title).trim().slice(0, 80), hazardId]);
      req.persist();
    }
    res.json({ ok: true });
  });

  router.delete('/:id', requireUser, (req, res) => {
    const db = req.db;
    const hazardId = req.params.id;
    const row = rowsToObjects(db.exec('SELECT userId FROM hazards WHERE id=? LIMIT 1', [hazardId]))[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (String(row.userId) !== String(req.user.id)) return res.status(403).json({ error: 'forbidden' });
    db.run('DELETE FROM hazard_photos WHERE hazardId=?', [hazardId]);
    db.run('DELETE FROM comments WHERE postId IN (SELECT id FROM posts WHERE hazardId=?)', [hazardId]);
    db.run('DELETE FROM post_votes WHERE postId IN (SELECT id FROM posts WHERE hazardId=?)', [hazardId]);
    db.run('DELETE FROM posts WHERE hazardId=?', [hazardId]);
    db.run('DELETE FROM hazards WHERE id=?', [hazardId]);
    req.persist();
    res.json({ ok: true });
  });

  return router;
};
