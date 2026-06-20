const express = require('express');
const { rowsToObjects, randomId } = require('../db/index');

module.exports = function postsRouter(requireUser, getUserProfile) {
  const router = express.Router();

  router.get('/', requireUser, (req, res) => {
    const db = req.db;
    const { id: userId } = req.user;
    const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;
    const total = Number(rowsToObjects(db.exec('SELECT COUNT(1) AS c FROM posts'))[0]?.c || 0);
    const posts = rowsToObjects(db.exec(
      'SELECT * FROM posts ORDER BY pinned DESC, createdAt DESC LIMIT ? OFFSET ?', [limit, offset]
    ));
    const comments = rowsToObjects(db.exec('SELECT * FROM comments ORDER BY at ASC'));
    const byPost = {};
    comments.forEach((c) => {
      byPost[c.postId] = byPost[c.postId] || [];
      byPost[c.postId].push({ author: c.author, text: c.text, at: c.at });
    });
    const postsOut = posts.map((p) => ({
      id: p.id, hazardId: p.hazardId, typeEmoji: p.typeEmoji, label: p.label,
      title: p.title, createdAt: p.createdAt, votes: p.votes, pinned: !!p.pinned,
      comments: byPost[p.id] || [],
      isMine: String(p.userId || '') === String(userId),
      voted: !!rowsToObjects(db.exec('SELECT 1 FROM post_votes WHERE postId=? AND userId=? LIMIT 1', [p.id, userId]))[0],
      reporterName: p.reporterName, photoUrl: p.photoUrl || null,
    }));
    res.json({ ok: true, posts: postsOut, total, page, limit, hasMore: offset + limit < total });
  });

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
