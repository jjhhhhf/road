const express = require('express');
const { rowsToObjects, randomId } = require('../db/index');

module.exports = function postsRouter(requireUser, getUserProfile) {
  const router = express.Router();

  router.post('/:postId/vote', requireUser, (req, res) => {
    const db     = req.db;
    const postId = String(req.params.postId);
    const r = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=? LIMIT 1', [postId]))[0];
    if (!r) return res.status(404).json({ error: 'not_found' });

    try {
      const s = db.prepare('INSERT INTO post_votes (postId, userId, createdAt) VALUES (?,?,?)');
      s.run([postId, req.user.id, Date.now()]); s.free();
    } catch {
      return res.status(400).json({ error: 'already_voted' });
    }

    db.run('UPDATE posts SET votes = votes + 1 WHERE id=?', [postId]);
    db.run('UPDATE users SET points = points + 2 WHERE id=?', [req.user.id]);
    const next = Number(rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=? LIMIT 1', [postId]))[0]?.votes || 0);
    req.persist();
    res.json({ ok: true, votes: next });
  });

  router.delete('/:postId/vote', requireUser, (req, res) => {
    const db     = req.db;
    const postId = String(req.params.postId);
    const r = rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=? LIMIT 1', [postId]))[0];
    if (!r) return res.status(404).json({ error: 'not_found' });

    db.run('DELETE FROM post_votes WHERE postId=? AND userId=?', [postId, req.user.id]);
    db.run('UPDATE posts SET votes = CASE WHEN votes > 0 THEN votes - 1 ELSE 0 END WHERE id=?', [postId]);
    const next = Number(rowsToObjects(db.exec('SELECT votes FROM posts WHERE id=? LIMIT 1', [postId]))[0]?.votes || 0);
    req.persist();
    res.json({ ok: true, votes: next });
  });

  router.post('/:postId/comments', requireUser, (req, res) => {
    const db     = req.db;
    const postId = String(req.params.postId);
    const text   = String((req.body || {}).text || '').trim().slice(0, 200);
    if (!text) return res.status(400).json({ error: 'missing_text' });

    const exists = rowsToObjects(db.exec('SELECT id FROM posts WHERE id=? LIMIT 1', [postId]))[0];
    if (!exists) return res.status(404).json({ error: 'not_found' });

    const prof   = getUserProfile(db, req.user.id);
    const author = String((req.body || {}).author || prof?.name || req.user.username).trim().slice(0, 20);
    const at     = Date.now();
    const cid    = randomId('c_');

    const s = db.prepare('INSERT INTO comments (id, postId, author, text, at, userId) VALUES (?,?,?,?,?,?)');
    s.run([cid, postId, author, text, at, req.user.id]); s.free();
    req.persist();

    res.json({ ok: true, comment: { id: cid, author, text, at } });
  });

  return router;
};
