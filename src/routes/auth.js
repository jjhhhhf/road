const express = require('express');
const crypto = require('crypto');
const { rowsToObjects, hashPassword, randomId } = require('../db/index');
const { parseCookies, setSessionCookie, clearSessionCookie } = require('../middleware/auth');

module.exports = function authRouter(db, persist) {
  const router = express.Router();

  router.get('/me', (req, res) => {
    const token = String(parseCookies(req).sid || '');
    if (!token) return res.json({ ok: true, loggedIn: false });

    const s = rowsToObjects(
      db.exec(
        'SELECT s.userId, u.username FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expiresAt > ? LIMIT 1',
        [token, Date.now()]
      )
    )[0];
    if (!s) return res.json({ ok: true, loggedIn: false });
    res.json({ ok: true, loggedIn: true, user: { id: s.userId, username: s.username } });
  });

  router.post('/register', (req, res) => {
    const { body = {} } = req;
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 20) || '道路守護者';
    const city = String(body.city || '').trim().slice(0, 20) || '高雄市';

    if (!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'invalid_username' });
    if (password.length < 6) return res.status(400).json({ error: 'weak_password' });

    const exists = rowsToObjects(db.exec('SELECT id FROM users WHERE username=? LIMIT 1', [username]))[0];
    if (exists) return res.status(400).json({ error: 'username_taken' });

    const userId = randomId('u_');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const now = Date.now();

    const s1 = db.prepare('INSERT INTO users (id, username, salt, hash, points, createdAt) VALUES (?,?,?,?,0,?)');
    s1.run([userId, username, salt, hash, now]); s1.free();

    const s2 = db.prepare('INSERT INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)');
    s2.run([userId, name, '@' + username, city]); s2.free();

    [['nearbyNotify', 1], ['autoGps', 1], ['nightSaver', 0]].forEach(([k, v]) => {
      const s = db.prepare('INSERT INTO user_prefs (userId, key, value) VALUES (?,?,?)');
      s.run([userId, k, v]); s.free();
    });

    persist();
    res.json({ ok: true, user: { id: userId, username } });
  });

  router.post('/login', (req, res) => {
    const { body = {} } = req;
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    const row = rowsToObjects(db.exec('SELECT id, salt, hash FROM users WHERE username=? LIMIT 1', [username]))[0];
    if (!row || hashPassword(password, row.salt) !== String(row.hash)) {
      return res.status(400).json({ error: 'invalid_login' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const s = db.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?,?,?,?)');
    s.run([token, row.id, now, now + 7 * 24 * 60 * 60 * 1000]); s.free();
    persist();

    setSessionCookie(res, token);
    res.json({ ok: true, user: { id: row.id, username } });
  });

  router.post('/logout', (req, res) => {
    const token = String(parseCookies(req).sid || '');
    if (token) db.run('DELETE FROM sessions WHERE token=?', [token]);
    persist();
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  return router;
};
