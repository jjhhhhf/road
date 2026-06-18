const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  email       TEXT,
  salt        TEXT NOT NULL,
  hash        TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 0,
  createdAt   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  createdAt   INTEGER NOT NULL,
  expiresAt   INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profiles (
  userId  TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  handle  TEXT NOT NULL,
  city    TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profile_tags (
  userId  TEXT NOT NULL,
  tagText TEXT NOT NULL,
  ord     INTEGER NOT NULL,
  PRIMARY KEY (userId, tagText),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_prefs (
  userId  TEXT NOT NULL,
  key     TEXT NOT NULL,
  value   INTEGER NOT NULL,
  PRIMARY KEY (userId, key),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  riskWeight  INTEGER NOT NULL DEFAULT 1,
  color1      TEXT NOT NULL DEFAULT '#FF3B4E',
  color2      TEXT NOT NULL DEFAULT '#FF6B35'
);

CREATE TABLE IF NOT EXISTS hazards (
  id          TEXT PRIMARY KEY,
  categoryId  TEXT,
  typeEmoji   TEXT NOT NULL,
  label       TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  color1      TEXT NOT NULL,
  color2      TEXT NOT NULL,
  severity    INTEGER NOT NULL DEFAULT 3,
  status      TEXT NOT NULL DEFAULT 'pending',
  userId      TEXT,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS hazard_photos (
  id        TEXT PRIMARY KEY,
  hazardId  TEXT NOT NULL,
  url       TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (hazardId) REFERENCES hazards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  hazardId      TEXT NOT NULL,
  typeEmoji     TEXT NOT NULL,
  label         TEXT NOT NULL,
  title         TEXT NOT NULL,
  reporterName  TEXT NOT NULL,
  photoUrl      TEXT,
  votes         INTEGER NOT NULL DEFAULT 0,
  userId        TEXT,
  createdAt     INTEGER NOT NULL,
  FOREIGN KEY (hazardId) REFERENCES hazards(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS post_votes (
  postId    TEXT NOT NULL,
  userId    TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id        TEXT PRIMARY KEY,
  postId    TEXT NOT NULL,
  author    TEXT NOT NULL,
  text      TEXT NOT NULL,
  at        INTEGER NOT NULL,
  userId    TEXT,
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  description TEXT NOT NULL,
  threshold   INTEGER NOT NULL,
  metric      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  userId    TEXT NOT NULL,
  badgeId   TEXT NOT NULL,
  earnedAt  INTEGER NOT NULL,
  PRIMARY KEY (userId, badgeId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badgeId) REFERENCES badges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admins (
  username  TEXT PRIMARY KEY,
  salt      TEXT NOT NULL,
  hash      TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
`;

const SEED_CATEGORIES = [
  { id: 'cat_pothole',   name: '路面坑洞',   emoji: '🕳️',  riskWeight: 4, color1: '#FF3B4E', color2: '#FF6B35' },
  { id: 'cat_marking',   name: '標線不清',   emoji: '⚠️',  riskWeight: 3, color1: '#FFB800', color2: '#FF8C00' },
  { id: 'cat_turn',      name: '危險路口',   emoji: '🚦',  riskWeight: 5, color1: '#FF3B4E', color2: '#C0392B' },
  { id: 'cat_sign',      name: '標誌缺損',   emoji: '🪧',  riskWeight: 2, color1: '#9B59B6', color2: '#6C3483' },
  { id: 'cat_flooding',  name: '積水路段',   emoji: '💧',  riskWeight: 3, color1: '#3498DB', color2: '#1A5276' },
  { id: 'cat_obstacle',  name: '路障/障礙物', emoji: '🚧', riskWeight: 4, color1: '#E67E22', color2: '#A04000' },
];

const SEED_BADGES = [
  { id: 'badge_first',   name: '初心排雷師', emoji: '🌱', description: '完成第 1 次回報', threshold: 1,   metric: 'reports' },
  { id: 'badge_10',      name: '勤奮排雷師', emoji: '⭐', description: '累積 10 次回報',  threshold: 10,  metric: 'reports' },
  { id: 'badge_50',      name: '黃金排雷師', emoji: '🔥', description: '累積 50 次回報',  threshold: 50,  metric: 'reports' },
  { id: 'badge_vote10',  name: '熱心市民',   emoji: '👍', description: '累積附議 10 次',  threshold: 10,  metric: 'votes_given' },
  { id: 'badge_fixed5',  name: '排雷英雄',   emoji: '🏆', description: '5 筆回報達成修復', threshold: 5,  metric: 'fixed' },
  { id: 'badge_night',   name: '夜鷹',       emoji: '🦉', description: '夜間回報 5 次',    threshold: 5,  metric: 'night_reports' },
];

// ── Demo seed data（高科大燕巢校區，深中路58號正門為錨點）──────────
const DEMO_USERS = [
  { id: 'demo_u_01', username: 'demo_yanchao', name: '陳小明', handle: 'chen_yanchao', city: '燕巢區', points: 120 },
  { id: 'demo_u_02', username: 'demo_rider',   name: '李美玲', handle: 'li_rider',     city: '高雄市', points: 80  },
  { id: 'demo_u_03', username: 'demo_local',   name: '王大偉', handle: 'wang_local',   city: '岡山區', points: 50  },
];

// 正門 22.6916°N 120.3767°E；地標依校內各棟與深中路周邊設置
const DEMO_HAZARDS = [
  // ── 校門口（正門深中路58號）──
  { id: 'demo_h_01', lat: 22.6916, lng: 120.3767, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '正門校門口入口大坑洞',          description: '深中路58號校門口右側路面有大型坑洞，機車入校時容易顛簸，雨天積水深達10公分。', severity: 4, status: 'pending',  userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 深中路校門前三叉路口 ──
  { id: 'demo_h_02', lat: 22.6907, lng: 120.3762, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '深中路校門前三叉路口無號誌',     description: '校門口前深中路與橫山路交叉三叉口無號誌管制，尖峰時段車輛搶道嚴重，已發生多起擦撞。', severity: 5, status: 'pending',  userId: 'demo_u_02', color1: '#FF3B4E', color2: '#C0392B' },
  // ── 第一教學大樓前停車場 ──
  { id: 'demo_h_03', lat: 22.6931, lng: 120.3772, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '第一教學大樓前停車場廢材堆積',   description: '第一教學大樓停車場出口堆放廢棄建材，嚴重遮蔽視線，車輛出入危險。', severity: 2, status: 'verified', userId: 'demo_u_03', color1: '#E67E22', color2: '#A04000' },
  // ── 圖書館前廣場 ──
  { id: 'demo_h_04', lat: 22.6940, lng: 120.3772, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '圖書館前廣場地磚凹陷積水',       description: '圖書館正門廣場地磚凹陷下沉，下雨後大面積積水，行人被迫繞行草地。', severity: 2, status: 'pending',  userId: 'demo_u_01', color1: '#3498DB', color2: '#1A5276' },
  // ── 行政大樓前 ──
  { id: 'demo_h_05', lat: 22.6948, lng: 120.3775, categoryId: 'cat_sign',     typeEmoji: '🪧', label: '標誌缺損',    title: '行政大樓前方向指示牌嚴重褪色',   description: '行政大樓正前方指引外賓的方向標誌字體嚴重褪色，外地訪客常迷路。', severity: 1, status: 'pending',  userId: 'demo_u_02', color1: '#9B59B6', color2: '#6C3483' },
  // ── 北側校道 ──
  { id: 'demo_h_06', lat: 22.6954, lng: 120.3774, categoryId: 'cat_marking',  typeEmoji: '⚠️', label: '標線不清',    title: '北側校內主幹道車道標線褪色',      description: '校內北側主幹道雙向車道分隔白線幾乎完全消失，夜間無法判斷行向，事故風險高。', severity: 3, status: 'pending',  userId: 'demo_u_03', color1: '#FFB800', color2: '#FF8C00' },
  // ── 宿舍區前（已修復）──
  { id: 'demo_h_07', lat: 22.6958, lng: 120.3780, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '學生宿舍區前路面坑洞（已修復）',  description: '宿舍前方路面坑洞已完成回填，路面恢復平整，感謝校方即時處理。', severity: 3, status: 'fixed',    userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 運動場旁 ──
  { id: 'demo_h_08', lat: 22.6963, lng: 120.3766, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '綜合運動場旁柏油路面整段隆起',    description: '運動場西側道路路面整段柏油隆起破裂，跑步及騎車路過均有危險，已有輪胎受損案例。', severity: 4, status: 'verified', userId: 'demo_u_02', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 北側停車場 ──
  { id: 'demo_h_09', lat: 22.6951, lng: 120.3793, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '北側停車場出口施工圍籬佔道',      description: '北側停車場出口有施工圍籬突出至車道，大型車輛出入困難且有碰撞風險。', severity: 3, status: 'verified', userId: 'demo_u_03', color1: '#E67E22', color2: '#A04000' },
  // ── 後門 ──
  { id: 'demo_h_10', lat: 22.6961, lng: 120.3759, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '後門往宿舍路段路面嚴重破損',      description: '後門往宿舍的校內道路多處破損，重型車輛進出更加劇坑洞擴大，震動感明顯。', severity: 4, status: 'pending',  userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 西側圍牆 ──
  { id: 'demo_h_11', lat: 22.6941, lng: 120.3754, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '西側圍牆旁路邊崩塌下陷',          description: '西側圍牆外沿路邊土基流失崩塌，形成連續坑洞，機車沿邊行駛有落車風險。', severity: 3, status: 'pending',  userId: 'demo_u_02', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 環形道路低點 ──
  { id: 'demo_h_12', lat: 22.6950, lng: 120.3764, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '校內環形道路最低點嚴重積水',      description: '校內環形道路最低窪處每逢大雨必積水，深達15公分，曾導致機車熄火。', severity: 3, status: 'verified', userId: 'demo_u_03', color1: '#3498DB', color2: '#1A5276' },
  // ── 東側外圍 ──
  { id: 'demo_h_13', lat: 22.6943, lng: 120.3796, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '東側外圍道路排水溝溢流',          description: '東側校外圍道路排水溝容量不足，豪雨時溢流至路面，積水深達10公分以上。', severity: 3, status: 'pending',  userId: 'demo_u_01', color1: '#3498DB', color2: '#1A5276' },
  // ── 北出口急彎 ──
  { id: 'demo_h_14', lat: 22.6969, lng: 120.3779, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '北出口急彎路段完全無路燈',        description: '校園北出口急彎處無任何路燈照明，夜間騎車完全靠車燈，已有機車因此摔倒。', severity: 4, status: 'pending',  userId: 'demo_u_02', color1: '#FF3B4E', color2: '#C0392B' },
  // ── 深中路橫山路口（校外）──
  { id: 'demo_h_15', lat: 22.6905, lng: 120.3758, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '深中路橫山路口視線遭樹叢遮蔽',   description: '校門對面深中路與橫山路大型路口，路側樹叢遮蔽視線嚴重，已記錄多次接近事故。', severity: 5, status: 'verified', userId: 'demo_u_03', color1: '#FF3B4E', color2: '#C0392B' },
  // ── 深中路便利商店前（校外）──
  { id: 'demo_h_16', lat: 22.6910, lng: 120.3778, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '深中路便利商店前機車長期佔用人行道', description: '校門旁便利商店前機車大量違停於人行道，行人被迫走車道，假日情況更嚴重。', severity: 2, status: 'pending',  userId: 'demo_u_01', color1: '#E67E22', color2: '#A04000' },
  // ── 燕巢國小前（校外）──
  { id: 'demo_h_17', lat: 22.6882, lng: 120.3762, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '燕巢國小前人行道施工圍籬（已清）', description: '燕巢國小正門前人行道施工圍籬已撤除，步行空間恢復正常。', severity: 3, status: 'fixed',    userId: 'demo_u_02', color1: '#E67E22', color2: '#A04000' },
  // ── 燕巢加油站旁（校外）──
  { id: 'demo_h_18', lat: 22.6895, lng: 120.3755, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '燕巢加油站旁路面多處破損',        description: '加油站出入口旁路面因重車輾壓形成多處坑洞，車輛進出加油站時嚴重顛簸。', severity: 3, status: 'pending',  userId: 'demo_u_03', color1: '#FF3B4E', color2: '#FF6B35' },
  // ── 深中路往市區引道（校外）──
  { id: 'demo_h_19', lat: 22.6880, lng: 120.3760, categoryId: 'cat_marking',  typeEmoji: '⚠️', label: '標線不清',    title: '深中路往燕巢市區方向標線模糊',    description: '深中路往燕巢市區方向的導向標線嚴重褪色，外地駕駛容易走錯方向。', severity: 3, status: 'pending',  userId: 'demo_u_01', color1: '#FFB800', color2: '#FF8C00' },
  // ── 限速標誌（南側出口）──
  { id: 'demo_h_20', lat: 22.6921, lng: 120.3769, categoryId: 'cat_sign',     typeEmoji: '🪧', label: '標誌缺損',    title: '南側出口限速30標誌遭颱風吹倒',   description: '南側校園出口限速30標誌颱風後傾倒至今未豎立，車速明顯偏快。', severity: 2, status: 'pending',  userId: 'demo_u_02', color1: '#9B59B6', color2: '#6C3483' },
];

// posts 對應每個 hazard，reporterName 來自 DEMO_USERS name
const DEMO_POSTS = DEMO_HAZARDS.map((h, i) => ({
  id:           `demo_p_${String(i + 1).padStart(2, '0')}`,
  hazardId:     h.id,
  typeEmoji:    h.typeEmoji,
  label:        h.label,
  title:        h.title,
  reporterName: DEMO_USERS[i % DEMO_USERS.length].name,
  userId:       DEMO_USERS[i % DEMO_USERS.length].id,
  votes:        [5, 3, 7, 2, 12, 0, 4, 1, 6, 9, 3, 8, 2, 0, 1, 0, 5, 3, 4, 2][i],
}));

const DEMO_COMMENTS = [
  { id: 'demo_c_01', postId: 'demo_p_01', author: '李美玲', text: '這個坑已經很久了，下雨根本不敢騎過去！', userId: 'demo_u_02' },
  { id: 'demo_c_02', postId: 'demo_p_01', author: '王大偉', text: '上週剛好在這裡摔倒，希望盡快修復。',     userId: 'demo_u_03' },
  { id: 'demo_c_03', postId: 'demo_p_05', author: '陳小明', text: '這個路口真的每天都提心吊膽，急需裝號誌！', userId: 'demo_u_01' },
  { id: 'demo_c_04', postId: 'demo_p_05', author: '李美玲', text: '附議！我也差點在這裡出事。',              userId: 'demo_u_02' },
  { id: 'demo_c_05', postId: 'demo_p_09', author: '陳小明', text: '路面隆起非常嚴重，自行車直接被彈飛。',   userId: 'demo_u_01' },
  { id: 'demo_c_06', postId: 'demo_p_10', author: '王大偉', text: '夜間真的漆黑一片，建議加裝反光板。',     userId: 'demo_u_03' },
  { id: 'demo_c_07', postId: 'demo_p_12', author: '李美玲', text: '這個路口的問題存在很久了，每次路過都很緊張。', userId: 'demo_u_02' },
  { id: 'demo_c_08', postId: 'demo_p_17', author: '陳小明', text: '後門這段路真的很糟，大卡車一壓更嚴重。', userId: 'demo_u_01' },
];

module.exports = { SCHEMA_SQL, SEED_CATEGORIES, SEED_BADGES, DEMO_USERS, DEMO_HAZARDS, DEMO_POSTS, DEMO_COMMENTS };
