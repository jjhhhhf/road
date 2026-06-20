const express = require('express');
const { rowsToObjects, hashPassword } = require('../db/index');
const crypto = require('crypto');

module.exports = function adminRouter() {
  const router = express.Router();

  router.get('/hazards', (req, res) => {
    const db = req.db;
    const { status } = req.query;
    const sql    = status ? 'SELECT * FROM hazards WHERE status=? ORDER BY createdAt DESC' : 'SELECT * FROM hazards ORDER BY createdAt DESC';
    const params = status ? [status] : [];
    res.json({ ok: true, items: rowsToObjects(db.exec(sql, params)) });
  });

  router.patch('/hazards/:id/status', (req, res) => {
    const id     = String(req.params.id);
    const status = String((req.body || {}).status || '');
    const allowed = ['pending', 'verified', 'fixed', 'rejected'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid_status' });
    req.db.run('UPDATE hazards SET status=?, updatedAt=? WHERE id=?', [status, Date.now(), id]);
    req.persist();
    res.json({ ok: true });
  });

  router.delete('/hazards/:id', (req, res) => {
    const id = String(req.params.id);
    if (!id) return res.status(400).json({ error: 'missing_id' });
    req.db.run('DELETE FROM hazards WHERE id=?', [id]);
    req.persist();
    res.json({ ok: true });
  });

  router.get('/posts', (req, res) => {
    res.json({ ok: true, items: rowsToObjects(req.db.exec('SELECT * FROM posts ORDER BY pinned DESC, createdAt DESC')) });
  });

  router.patch('/posts/:id/pin', (req, res) => {
    const id     = String(req.params.id);
    const pinned = (req.body || {}).pinned ? 1 : 0;
    req.db.run('UPDATE posts SET pinned=? WHERE id=?', [pinned, id]);
    req.persist();
    res.json({ ok: true });
  });

  router.delete('/posts/:id', (req, res) => {
    req.db.run('DELETE FROM posts WHERE id=?', [req.params.id]);
    req.persist();
    res.json({ ok: true });
  });

  router.get('/comments', (req, res) => {
    res.json({ ok: true, items: rowsToObjects(req.db.exec('SELECT * FROM comments ORDER BY at DESC')) });
  });

  router.delete('/comments/:id', (req, res) => {
    req.db.run('DELETE FROM comments WHERE id=?', [req.params.id]);
    req.persist();
    res.json({ ok: true });
  });

  router.get('/users', (req, res) => {
    const users = rowsToObjects(req.db.exec('SELECT id, username, email, points, createdAt FROM users ORDER BY createdAt DESC'));
    res.json({ ok: true, items: users });
  });

  router.delete('/users/:id', (req, res) => {
    req.db.run('DELETE FROM users WHERE id=?', [req.params.id]);
    req.persist();
    res.json({ ok: true });
  });

  router.get('/stats', (req, res) => {
    const db = req.db;
    const total    = Number(rowsToObjects(db.exec('SELECT COUNT(1) AS c FROM hazards'))[0]?.c || 0);
    const pending  = Number(rowsToObjects(db.exec("SELECT COUNT(1) AS c FROM hazards WHERE status='pending'"))[0]?.c || 0);
    const fixed    = Number(rowsToObjects(db.exec("SELECT COUNT(1) AS c FROM hazards WHERE status='fixed'"))[0]?.c || 0);
    const verified = Number(rowsToObjects(db.exec("SELECT COUNT(1) AS c FROM hazards WHERE status='verified'"))[0]?.c || 0);
    const users    = Number(rowsToObjects(db.exec('SELECT COUNT(1) AS c FROM users'))[0]?.c || 0);
    const catRows  = rowsToObjects(db.exec('SELECT c.name, COUNT(h.id) AS cnt FROM categories c LEFT JOIN hazards h ON h.categoryId=c.id GROUP BY c.id'));
    const sevRows  = rowsToObjects(db.exec('SELECT severity, COUNT(1) AS cnt FROM hazards GROUP BY severity'));
    const byCategory = {}; catRows.forEach((r) => { byCategory[r.name] = Number(r.cnt || 0); });
    const bySeverity = {}; sevRows.forEach((r) => { bySeverity[r.severity] = Number(r.cnt || 0); });
    res.json({ ok: true, stats: { total, pending, fixed, verified, users, byCategory, bySeverity } });
  });

  router.get('/export/csv', (req, res) => {
    const hazards = rowsToObjects(req.db.exec('SELECT * FROM hazards ORDER BY createdAt DESC'));
    const headers = ['id', 'label', 'title', 'lat', 'lng', 'severity', 'status', 'categoryId', 'createdAt'];
    const rows    = hazards.map((h) => headers.map((k) => JSON.stringify(h[k] ?? '')).join(','));
    const csv     = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hazards.csv"');
    res.send('﻿' + csv);
  });

  router.put('/password', (req, res) => {
    const db = req.db;
    const { body = {} } = req;
    const oldPassword = String(body.oldPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) return res.status(400).json({ error: 'weak_password' });

    const adminUser = req.adminUser || 'admin';
    const row = rowsToObjects(db.exec('SELECT salt, hash FROM admins WHERE username=? LIMIT 1', [adminUser]))[0];
    if (!row) return res.status(500).json({ error: 'admin_missing' });
    if (hashPassword(oldPassword, row.salt) !== String(row.hash))
      return res.status(400).json({ error: 'wrong_password' });

    const newSalt = crypto.randomBytes(16).toString('hex');
    db.run('UPDATE admins SET salt=?, hash=? WHERE username=?', [newSalt, hashPassword(newPassword, newSalt), adminUser]);
    req.persist();
    res.json({ ok: true });
  });

  return router;
};
