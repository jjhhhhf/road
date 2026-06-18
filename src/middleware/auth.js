const { rowsToObjects, hashPassword } = require('../db/index');

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const p = part.trim();
    const idx = p.indexOf('=');
    if (idx < 0) return;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function setSessionCookie(res, token) {
  const parts = [
    `sid=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 7}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
}

// Sessions 永遠存在 realDb；demo 使用者資料操作切換至 demoDb
function makeRequireUser(realDb, demoDb, demoPersist) {
  return function requireUser(req, res, next) {
    const token = String(parseCookies(req).sid || '');
    if (!token) return res.status(401).json({ error: 'not_logged_in' });

    const s = rowsToObjects(
      realDb.exec(
        'SELECT s.userId, u.username FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expiresAt > ? LIMIT 1',
        [token, Date.now()]
      )
    )[0];
    if (!s) return res.status(401).json({ error: 'session_expired' });

    req.user = { id: s.userId, username: s.username };
    if (s.username === 'demo') {
      req.db      = demoDb;
      req.persist = demoPersist;
    }
    next();
  };
}

// admindemo → demoDb；admin → realDb
function makeRequireAdmin(realDb, realPersist, demoDb, demoPersist) {
  return function requireAdmin(req, res, next) {
    const header = String(req.headers.authorization || '');
    if (!header.toLowerCase().startsWith('basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="lukou-pailei-admin", charset="UTF-8"');
      return res.status(401).send('Unauthorized');
    }

    let decoded = '';
    try { decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8'); } catch { /* ignore */ }
    const idx = decoded.indexOf(':');
    if (idx < 0) return res.status(401).send('Unauthorized');

    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    const isDemo   = username === 'admindemo';
    const authDb   = isDemo ? demoDb : realDb;

    const row = rowsToObjects(authDb.exec('SELECT salt, hash FROM admins WHERE username=? LIMIT 1', [username]))[0];
    if (!row || hashPassword(password, row.salt) !== String(row.hash)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="lukou-pailei-admin", charset="UTF-8"');
      return res.status(401).send('Unauthorized');
    }

    req.adminUser = username;
    req.db        = isDemo ? demoDb : realDb;
    req.persist   = isDemo ? demoPersist : realPersist;
    next();
  };
}

module.exports = { parseCookies, setSessionCookie, clearSessionCookie, makeRequireUser, makeRequireAdmin };
