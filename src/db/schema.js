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

// 座標全部由 OpenStreetMap Nominatim 查詢確認，分布全高雄市
const DEMO_HAZARDS = [
  // 高雄車站（三民區建國二路）22.6393, 120.3027
  { id: 'demo_h_01', lat: 22.6393, lng: 120.3027, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '高雄車站前建國二路路面坑洞',      description: '高雄車站正門前建國二路右側路面有大型坑洞，計程車頻繁停靠造成路基下陷，行人跌倒風險高。', severity: 4, status: 'pending',  userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // 美麗島站（新興區中山一路）22.6314, 120.3019
  { id: 'demo_h_02', lat: 22.6314, lng: 120.3019, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '美麗島站中山中山路口號誌時序混亂', description: '美麗島站七叉路口號誌時序設計不當，行人與右轉車輛同時放行，每逢尖峰時段險象環生。', severity: 5, status: 'pending',  userId: 'demo_u_02', color1: '#FF3B4E', color2: '#C0392B' },
  // 六合夜市（前金區六合二路）22.6324, 120.3000
  { id: 'demo_h_03', lat: 22.6324, lng: 120.3000, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '六合夜市攤車佔用機車道',           description: '六合夜市攤販車輛及備料佔用機車道，夜市營業時間機車被迫併入汽車道，危險性極高。', severity: 3, status: 'verified', userId: 'demo_u_03', color1: '#E67E22', color2: '#A04000' },
  // 蓮池潭（左營區）22.6838, 120.2964
  { id: 'demo_h_04', lat: 22.6838, lng: 120.2964, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '蓮池潭環潭步道積水下陷',           description: '蓮池潭環潭步道低窪處地磚下陷，大雨後積水達20公分，步行者無法通行且易滑倒。', severity: 2, status: 'pending',  userId: 'demo_u_01', color1: '#3498DB', color2: '#1A5276' },
  // 高雄市立美術館（鼓山區美術館路）22.6565, 120.2862
  { id: 'demo_h_05', lat: 22.6565, lng: 120.2862, categoryId: 'cat_sign',     typeEmoji: '🪧', label: '標誌缺損',    title: '美術館路停車場出口指示牌損毀',     description: '高雄市立美術館旁停車場出口指示牌遭車輛撞擊後損毀，駕駛無法判斷出口方向，已多次造成逆向。', severity: 2, status: 'pending',  userId: 'demo_u_02', color1: '#9B59B6', color2: '#6C3483' },
  // 三多商圈（苓雅區中山二路）22.6142, 120.3044
  { id: 'demo_h_06', lat: 22.6142, lng: 120.3044, categoryId: 'cat_marking',  typeEmoji: '⚠️', label: '標線不清',    title: '三多商圈中山二路停車格線褪色',     description: '三多商圈路段停車格白線幾乎完全消失，違停車輛任意停放縮減車道，尖峰時段嚴重回堵。', severity: 3, status: 'pending',  userId: 'demo_u_03', color1: '#FFB800', color2: '#FF8C00' },
  // 左營高鐵站（左營區高鐵路）22.6874, 120.3085
  { id: 'demo_h_07', lat: 22.6874, lng: 120.3085, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '左營高鐵站接送區路面破損（已修復）', description: '左營高鐵站計程車接送區路面坑洞已完成修復，路面恢復平整。', severity: 2, status: 'fixed',    userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // 駁二藝術特區（鼓山區）22.6195, 120.2816
  { id: 'demo_h_08', lat: 22.6195, lng: 120.2816, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '駁二藝術特區大港橋引道路面隆起',   description: '駁二大港橋自行車引道路面因熱漲冷縮整段隆起，自行車及行人通過時嚴重顛簸，已有受傷案例。', severity: 4, status: 'verified', userId: 'demo_u_02', color1: '#FF3B4E', color2: '#FF6B35' },
  // 夢時代購物中心（前鎮區中華五路）22.5950, 120.3070
  { id: 'demo_h_09', lat: 22.5950, lng: 120.3070, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '夢時代中華五路施工圍籬縮減車道',   description: '夢時代購物中心週邊中華五路施工圍籬佔用兩線車道，僅剩一線通行，假日返鄉人潮嚴重回堵。', severity: 3, status: 'verified', userId: 'demo_u_03', color1: '#E67E22', color2: '#A04000' },
  // 鳳山車站（鳳山區曹公路）22.6316, 120.3567
  { id: 'demo_h_10', lat: 22.6316, lng: 120.3567, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '鳳山車站前曹公路連續坑洞',         description: '鳳山車站正門前曹公路連續出現多個坑洞，公車停靠時車身劇烈震動，乘客抱怨不斷。', severity: 4, status: 'pending',  userId: 'demo_u_01', color1: '#FF3B4E', color2: '#FF6B35' },
  // 文化中心（苓雅區中正二路）22.6303, 120.3176
  { id: 'demo_h_11', lat: 22.6303, lng: 120.3176, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '文化中心周邊中正二路豪雨積水',     description: '文化中心捷運站出口周邊中正二路排水系統不足，每逢豪雨地下道入口積水，電動機車易熄火。', severity: 3, status: 'pending',  userId: 'demo_u_02', color1: '#3498DB', color2: '#1A5276' },
  // 愛河之心（鼓山區大順一路）22.6560, 120.3027
  { id: 'demo_h_12', lat: 22.6560, lng: 120.3027, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '愛河之心大順一路無庇護左轉',       description: '愛河之心旁大順一路無庇護左轉號誌，直行車高速通過，左轉車輛視線受阻，已有多次事故紀錄。', severity: 4, status: 'pending',  userId: 'demo_u_03', color1: '#FF3B4E', color2: '#C0392B' },
  // 旗津燈塔（旗津區）22.6152, 120.2650
  { id: 'demo_h_13', lat: 22.6152, lng: 120.2650, categoryId: 'cat_marking',  typeEmoji: '⚠️', label: '標線不清',    title: '旗津燈塔步道標線嚴重褪色',         description: '旗津燈塔往海岸步道的自行車道與步行道分隔標線幾乎消失，自行車與行人混行危險。', severity: 2, status: 'pending',  userId: 'demo_u_01', color1: '#FFB800', color2: '#FF8C00' },
  // 高雄展覽館（苓雅區成功二路）22.6101, 120.2980
  { id: 'demo_h_14', lat: 22.6101, lng: 120.2980, categoryId: 'cat_obstacle', typeEmoji: '🚧', label: '路障/障礙物', title: '高雄展覽館成功二路展覽期間違停',    description: '高雄展覽館展覽期間大量車輛違停於成功二路公車停靠區，公車無法靠站，乘客須在車陣中下車。', severity: 3, status: 'pending',  userId: 'demo_u_02', color1: '#E67E22', color2: '#A04000' },
  // 大東文化藝術中心（鳳山區光遠路）22.6244, 120.3636
  { id: 'demo_h_15', lat: 22.6244, lng: 120.3636, categoryId: 'cat_sign',     typeEmoji: '🪧', label: '標誌缺損',    title: '大東藝術中心光遠路指示牌遭颱風損毀', description: '大東文化藝術中心外光遠路方向指示牌颱風後傾斜，字體模糊，外地訪客難以找到入口。', severity: 1, status: 'pending',  userId: 'demo_u_03', color1: '#9B59B6', color2: '#6C3483' },
  // 中央公園（新興區中山一路）22.6248, 120.3012
  { id: 'demo_h_16', lat: 22.6248, lng: 120.3012, categoryId: 'cat_flooding', typeEmoji: '💧', label: '積水路段',    title: '中央公園捷運站出口積水下陷',        description: '中央公園站2號出口外廣場地磚下陷積水，雨後行人被迫跨越大片水坑，長者和幼童有跌倒風險。', severity: 2, status: 'verified', userId: 'demo_u_01', color1: '#3498DB', color2: '#1A5276' },
  // 岡山車站（岡山區中山北路）22.7929, 120.2992
  { id: 'demo_h_17', lat: 22.7929, lng: 120.2992, categoryId: 'cat_turn',     typeEmoji: '🚦', label: '危險路口',    title: '岡山車站前圓環視線不良',            description: '岡山車站前圓環號誌燈遮蔽嚴重，加上大型看板阻擋視線，外地駕駛常搞不清楚禮讓規則。', severity: 3, status: 'pending',  userId: 'demo_u_02', color1: '#FF3B4E', color2: '#C0392B' },
  // 楠梓車站（楠梓區建楠路）22.7271, 120.3243
  { id: 'demo_h_18', lat: 22.7271, lng: 120.3243, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '楠梓車站建楠路貨車輾壓路面破損',    description: '楠梓車站周邊建楠路因大型貨車頻繁往來，路面多處破損下陷，晚上無路燈照明更加危險。', severity: 3, status: 'pending',  userId: 'demo_u_03', color1: '#FF3B4E', color2: '#FF6B35' },
  // 科學工藝博物館（三民區九如一路）22.6416, 120.3227
  { id: 'demo_h_19', lat: 22.6416, lng: 120.3227, categoryId: 'cat_marking',  typeEmoji: '⚠️', label: '標線不清',    title: '科工館九如一路自行車道標線消失',     description: '科學工藝博物館旁九如一路自行車專用道標線完全消失，自行車被迫與汽機車混行，已有擦撞。', severity: 3, status: 'verified', userId: 'demo_u_01', color1: '#FFB800', color2: '#FF8C00' },
  // 鼓山區中心（鼓山區）22.6368, 120.2812
  { id: 'demo_h_20', lat: 22.6368, lng: 120.2812, categoryId: 'cat_pothole',  typeEmoji: '🕳️', label: '路面坑洞',    title: '鼓山輪渡站前臨水路路面嚴重破損（已修復）', description: '鼓山輪渡站前臨水路路面坑洞修復完成，往來旗津的自行車道恢復平順，感謝市府即時處理。', severity: 3, status: 'fixed',    userId: 'demo_u_02', color1: '#FF3B4E', color2: '#FF6B35' },
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
