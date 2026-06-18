const express = require('express');
const { rowsToObjects } = require('../db/index');

const FIXED_VOTES_THRESHOLD = 5;

function getUserProfile(db, userId) {
  const prof = rowsToObjects(db.exec('SELECT name, handle, city FROM user_profiles WHERE userId=? LIMIT 1', [userId]))[0];
  if (!prof) return null;
  const tags = rowsToObjects(
    db.exec('SELECT tagText FROM user_profile_tags WHERE userId=? ORDER BY ord ASC', [userId])
  ).map((r) => r.tagText);
  return { ...prof, tags };
}

function getUserPrefs(db, userId) {
  const rows = rowsToObjects(db.exec('SELECT key, value FROM user_prefs WHERE userId=?', [userId]));
  const prefs = { nearbyNotify: true, autoGps: true, nightSaver: false };
  rows.forEach((r) => (prefs[r.key] = !!r.value));
  return prefs;
}

function getUserStats(db, userId) {
  const r = (sql, params) => Number(rowsToObjects(db.exec(sql, params))[0]?.c || 0);
  const myHazards = r('SELECT COUNT(1) AS c FROM hazards WHERE userId=?', [userId]);
  const myFixed = r(
    'SELECT COUNT(1) AS c FROM posts WHERE userId=? AND votes >= ?',
    [userId, FIXED_VOTES_THRESHOLD]
  );
  const receivedVotes = Number(
    rowsToObjects(db.exec('SELECT COALESCE(SUM(votes),0) AS s FROM posts WHERE userId=?', [userId]))[0]?.s || 0
  );
  const helpedVotes = r('SELECT COUNT(1) AS c FROM post_votes WHERE userId=?', [userId]);
  const nightReports = r(
    "SELECT COUNT(1) AS c FROM hazards WHERE userId=? AND (CAST(strftime('%H', datetime(createdAt/1000,'unixepoch','localtime')) AS INTEGER) >= 18 OR CAST(strftime('%H', datetime(createdAt/1000,'unixepoch','localtime')) AS INTEGER) < 6)",
    [userId]
  );
  return { myHazards, myFixed, receivedVotes, helpedVotes, nightReports };
}

function getUserBadges(db, userId) {
  return rowsToObjects(
    db.exec(
      'SELECT b.id, b.name, b.emoji, b.description, ub.earnedAt FROM user_badges ub JOIN badges b ON b.id=ub.badgeId WHERE ub.userId=?',
      [userId]
    )
  );
}

function checkAndAwardBadges(db, persist, userId) {
  const stats = getUserStats(db, userId);
  const badges = rowsToObjects(db.exec('SELECT * FROM badges'));
  const earned = new Set(
    rowsToObjects(db.exec('SELECT badgeId FROM user_badges WHERE userId=?', [userId])).map((r) => r.badgeId)
  );

  const metricMap = {
    reports: stats.myHazards,
    fixed: stats.myFixed,
    votes_given: stats.helpedVotes,
    night_reports: stats.nightReports,
  };

  badges.forEach((b) => {
    if (earned.has(b.id)) return;
    const val = metricMap[b.metric] ?? 0;
    if (val >= b.threshold) {
      const s = db.prepare('INSERT OR IGNORE INTO user_badges (userId, badgeId, earnedAt) VALUES (?,?,?)');
      s.run([userId, b.id, Date.now()]); s.free();
    }
  });
}

module.exports = function usersRouter(requireUser) {
  const router = express.Router();

  router.get('/state', requireUser, (req, res) => {
    const db = req.db;
    const { id: userId, username } = req.user;
    const profile  = getUserProfile(db, userId);
    const prefs    = getUserPrefs(db, userId);
    const myStats  = getUserStats(db, userId);
    const myBadges = getUserBadges(db, userId);
    const points   = Number(rowsToObjects(db.exec('SELECT points FROM users WHERE id=? LIMIT 1', [userId]))[0]?.points || 0);

    const hazards = rowsToObjects(db.exec('SELECT * FROM hazards ORDER BY createdAt DESC')).map((h) => ({
      id: h.id, type: h.typeEmoji, emoji: h.typeEmoji, label: h.label, title: h.title,
      lat: h.lat, lng: h.lng, colors: [h.color1, h.color2],
      severity: h.severity, status: h.status, categoryId: h.categoryId || null, createdAt: h.createdAt, userId: h.userId || null,
    }));

    const posts    = rowsToObjects(db.exec('SELECT * FROM posts ORDER BY pinned DESC, createdAt DESC'));
    const comments = rowsToObjects(db.exec('SELECT * FROM comments ORDER BY at ASC'));
    const commentsByPost = {};
    comments.forEach((c) => {
      commentsByPost[c.postId] = commentsByPost[c.postId] || [];
      commentsByPost[c.postId].push({ author: c.author, text: c.text, at: c.at });
    });

    const postsOut = posts.map((p) => ({
      id: p.id, hazardId: p.hazardId, typeEmoji: p.typeEmoji, label: p.label,
      title: p.title, createdAt: p.createdAt, votes: p.votes, pinned: !!p.pinned,
      comments: commentsByPost[p.id] || [],
      isMine: String(p.userId || '') === String(userId),
      voted: !!rowsToObjects(db.exec('SELECT 1 FROM post_votes WHERE postId=? AND userId=? LIMIT 1', [p.id, userId]))[0],
      reporterName: p.reporterName, photoUrl: p.photoUrl || null,
    }));

    const categories = rowsToObjects(db.exec('SELECT * FROM categories'));

    res.json({ me: { id: userId, username, points }, profile, prefs, myStats, myBadges, hazards, posts: postsOut, categories });
  });

  router.put('/profile', requireUser, (req, res) => {
    const db = req.db;
    const { body = {}, user: { id: userId } } = req;
    const name      = String(body.name   || '').trim().slice(0, 20) || '道路守護者';
    const handleRaw = String(body.handle || '').trim().slice(0, 24);
    const handle    = handleRaw.startsWith('@') ? handleRaw : '@' + (handleRaw || 'user');
    const city      = String(body.city   || '').trim().slice(0, 20) || '高雄市';
    const tags      = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    const exists = rowsToObjects(db.exec('SELECT userId FROM user_profiles WHERE userId=? LIMIT 1', [userId]))[0];
    if (exists) {
      db.run('UPDATE user_profiles SET name=?, handle=?, city=? WHERE userId=?', [name, handle, city, userId]);
    } else {
      db.run('INSERT INTO user_profiles (userId, name, handle, city) VALUES (?,?,?,?)', [userId, name, handle, city]);
    }

    db.run('DELETE FROM user_profile_tags WHERE userId=?', [userId]);
    tags.slice(0, 3).forEach((t, i) => {
      const s = db.prepare('INSERT INTO user_profile_tags (userId, tagText, ord) VALUES (?,?,?)');
      s.run([userId, t, i]); s.free();
    });

    req.persist();
    res.json({ ok: true });
  });

  router.put('/prefs', requireUser, (req, res) => {
    const db = req.db;
    const { body = {}, user: { id: userId } } = req;
    ['nearbyNotify', 'autoGps', 'nightSaver'].forEach((k) => {
      if (!(k in body)) return;
      const s = db.prepare(
        'INSERT INTO user_prefs (userId, key, value) VALUES (?,?,?) ON CONFLICT(userId,key) DO UPDATE SET value=excluded.value'
      );
      s.run([userId, k, body[k] ? 1 : 0]); s.free();
    });
    req.persist();
    res.json({ ok: true });
  });

  router.get('/badges', requireUser, (req, res) => {
    const db = req.db;
    checkAndAwardBadges(db, req.persist, req.user.id);
    req.persist();
    res.json({ ok: true, badges: getUserBadges(db, req.user.id) });
  });

  return router;
};

module.exports.getUserProfile       = getUserProfile;
module.exports.checkAndAwardBadges  = checkAndAwardBadges;
