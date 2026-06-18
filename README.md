# 路口排雷 — 交通缺陷共筆地圖

> 系統分析與設計 第六組 | 蕭其睿、李秉威、黃紹軒、趙姵筑

讓用路人共同標記、驗證道路危險點，降低交通資訊不對稱。

---

## 快速啟動

雙擊 `start.bat`（Windows），或：

```bash
npm install
npm start        # http://localhost:3001
```

---

## 帳號說明

登入介面直接輸入帳密，系統自動判斷進入的模式：

| 帳號 | 密碼 | 模式 |
|---|---|---|
| `admin` | `admin` | 🛡️ 管理後台（真實資料庫） |
| `admindemo` | `admindemo` | 🛡️ 管理後台（展示資料庫） |
| `demo` | `demo` | 🎬 一般 App 展示模式 |
| `user` | `user` | 👤 一般使用者模式 |

> **兩套資料庫**：`admin`/`user` 使用 `data.sqlite`（真實庫）；`admindemo`/`demo` 使用 `data-demo.sqlite`（展示庫），互不干擾。展示庫在每次伺服器啟動時自動確保 20 筆高科大燕巢校區種子資料存在。

---

## 區網部署（手機 / 平板）

啟動後終端會列出所有網路介面 IP：

```
本機：http://localhost:3001
  [乙太網路] http://192.168.1.5:3001  ← 手機輸入這行
```

手機與電腦連同一 Wi-Fi，手機瀏覽器輸入 Wi-Fi 那行網址即可。  
HTTP 連線下手機 GPS 會被瀏覽器封鎖，可改用「在地圖點選位置」手動設定座標。

---

## 專案結構

```
road-refactor/
├── server.js                入口點（listen）
├── start.bat                Windows 快速啟動
├── src/
│   ├── app.js               Express 組裝、雙 DB 注入
│   ├── db/
│   │   ├── schema.js        資料表定義 + 種子資料（DEMO_HAZARDS）
│   │   └── index.js         openDb()、seedDemo()、helpers
│   ├── middleware/
│   │   ├── auth.js          makeRequireUser / makeRequireAdmin（雙 DB 切換）
│   │   └── upload.js        multer（6 MB, image only）
│   └── routes/
│       ├── auth.js          /api/auth/*
│       ├── hazards.js       /api/hazards/*
│       ├── posts.js         /api/posts/:id/vote|comments
│       ├── users.js         /api/state, profile, prefs, badges
│       └── admin.js         /api/admin/*
├── public/
│   ├── index.html           前端 SPA 入口
│   ├── admin.html           後台管理介面
│   ├── css/app.css          深色主題 Design System
│   └── js/
│       ├── config.js        window.API_BASE
│       ├── api.js           typed fetch wrapper
│       ├── map.js           Leaflet 地圖 + marker 管理
│       ├── community.js     社群貼文、附議、留言
│       ├── achievements.js  成就勳章 + 積分
│       └── profile.js       個人資料、偏好
├── docs/
│   └── midterm-report-system-analysis.pdf
├── .gitignore
├── CLAUDE.md
└── README.md
```

---

## 功能

| 功能 | 說明 |
|---|---|
| ⚡ 快速排雷 | GPS 定位或地圖點選，選類別、嚴重度 1–5、可附照片 |
| 🗺️ 危險點地圖 | Leaflet 深色地圖，marker 大小依嚴重度縮放，可依類別篩選 |
| 📊 修復進度 | 即時顯示全台排雷點數與修復百分比 |
| 💬 社群附議 | 投票 + 留言串，管理員可置頂貼文 |
| 🏆 成就勳章 | 6 種勳章自動發放，積分制度 |
| 🛡️ 後台管理 | 審核、狀態變更、置頂/下架、CSV 匯出、用戶管理 |
| 🎬 展示模式 | 高科大燕巢校區 20 筆真實地標種子資料 |
| 📱 PWA | Service Worker 離線快取、可安裝至主畫面 |

---

## API 端點速查

### 公開
```
GET  /api/health
GET  /api/auth/me
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/demo/seed
```

### 需登入（Session Cookie）
```
GET    /api/state
GET    /api/hazards              ?status= ?categoryId=
GET    /api/hazards/categories
POST   /api/hazards/report
POST   /api/hazards/upload
POST   /api/posts/:id/vote
DELETE /api/posts/:id/vote
POST   /api/posts/:id/comments
PUT    /api/profile
PUT    /api/prefs
GET    /api/badges
```

### 後台（Basic Auth）
```
GET    /api/admin/stats
GET    /api/admin/hazards          ?status=
PATCH  /api/admin/hazards/:id/status
DELETE /api/admin/hazards/:id
GET    /api/admin/posts
PATCH  /api/admin/posts/:id/pin
DELETE /api/admin/posts/:id
GET    /api/admin/comments
DELETE /api/admin/comments/:id
GET    /api/admin/users
DELETE /api/admin/users/:id
GET    /api/admin/export/csv
PUT    /api/admin/password
```

---

## 技術棧

- **後端**：Node.js + Express（CommonJS）
- **資料庫**：`sql.js`（in-memory SQLite + 檔案持久化）
- **前端**：純 HTML / CSS / JS，無框架，Leaflet 地圖
- **PWA**：Service Worker + Web App Manifest
