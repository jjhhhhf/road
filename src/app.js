const express = require('express');
const path = require('path');

const { makeRequireUser, makeRequireAdmin } = require('./middleware/auth');
const authRouter          = require('./routes/auth');
const usersRouterFactory  = require('./routes/users');
const hazardsRouterFactory = require('./routes/hazards');
const postsRouterFactory  = require('./routes/posts');
const adminRouterFactory  = require('./routes/admin');
const { seedDemo }        = require('./db/index');

const { getUserProfile, checkAndAwardBadges } = usersRouterFactory;

module.exports = function createApp(realDb, realPersist, demoDb, demoPersist) {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // 預設使用 realDb；requireUser / requireAdmin 會在認證後切換
  app.use((req, res, next) => {
    req.db      = realDb;
    req.persist = realPersist;
    next();
  });

  const requireUser  = makeRequireUser(realDb, demoDb, demoPersist);
  const requireAdmin = makeRequireAdmin(realDb, realPersist, demoDb, demoPersist);

  // auth 路由永遠用 realDb（session / user 帳號）
  app.use('/api/auth', authRouter(realDb, realPersist));

  // 資料路由用 req.db（由 requireUser/requireAdmin 決定）
  app.use('/api', usersRouterFactory(requireUser));
  app.use('/api/hazards', hazardsRouterFactory(requireUser, getUserProfile, checkAndAwardBadges));
  app.use('/api/posts',   postsRouterFactory(requireUser, getUserProfile));
  app.use('/api/admin',   requireAdmin, adminRouterFactory());

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

  // demo seed 永遠作用於 demoDb
  app.post('/api/demo/seed', (req, res) => {
    seedDemo(demoDb);
    demoPersist();
    res.json({ ok: true });
  });

  app.get(['/admin', '/admin.html'], (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
  });

  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.use((req, res) => res.status(404).json({ error: 'not_found' }));

  return app;
};
