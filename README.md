# 路口排雷

> 系統分析與設計 第六組 | 蕭其睿、李秉威、黃紹軒、趙姵筑

讓用路人共同標記、驗證道路危險點，降低交通資訊不對稱。

**線上版本**：https://road-0f4r.onrender.com

---

## 帳號

| 帳號 | 密碼 | 模式 |
|---|---|---|
| `admin` | `admin` | 管理後台（真實資料庫） |
| `admindemo` | `admindemo` | 管理後台（展示資料庫） |
| `demo` | `demo` | 一般 App 展示模式 |
| `user` | `user` | 一般使用者 |

系統依帳號自動分流，不顯示提示。

---

## 快速啟動

```bash
npm install
npm start        # https://localhost:3001
```

雙擊 `start.bat`（Windows）可一鍵啟動並開啟瀏覽器。

---

## 功能

| 功能 | 說明 |
|---|---|
| 回報缺陷 | GPS 定位或地圖點選，選類別、嚴重度 1–5、可附照片 |
| 危險點地圖 | Leaflet 深色地圖，marker 大小依嚴重度縮放，可依類別篩選並連動地圖 |
| 統計面板 | 即時顯示全台排雷點、已驗證、已修復數量 |
| 社群附議 | 投票、留言串、類別標籤，管理員可置頂 |
| 成就徽章 | 6 種徽章自動發放，積分制度，進度條顯示距下一個還差多少 |
| 個人設定 | 可編輯顯示名稱與城市，偏好 toggle |
| 後台管理 | 審核、狀態變更、置頂/下架、CSV 匯出、用戶管理 |
| 展示資料 | 高科大燕巢校區正門（深中路 58 號，22.7729°N 120.4007°E）附近 20 筆地標 |
| PWA | Service Worker 離線快取，可安裝至主畫面 |

---

## 架構

```
road-refactor/
├── server.js                入口點（HTTP，Render 自動提供 HTTPS）
├── start.bat                Windows 快速啟動
├── mobile.js                本機開發用 localtunnel（手機 GPS）
├── render.yaml              Render 部署設定
├── src/
│   ├── app.js               Express 組裝、雙 DB 注入、路由掛載
│   ├── db/
│   │   ├── schema.js        資料表定義 + Demo 種子資料（燕巢校區座標）
│   │   └── index.js         openDb()、seedDemo()、DB helpers
│   ├── middleware/
│   │   ├── auth.js          認證中介層（依帳號切換真實/展示 DB）
│   │   └── upload.js        multer（6 MB, image only）
│   └── routes/
│       ├── auth.js          /api/auth/*
│       ├── hazards.js       /api/hazards/*
│       ├── posts.js         /api/posts/:id/vote|comments
│       ├── users.js         /api/state, profile, prefs, badges
│       └── admin.js         /api/admin/*
├── public/
│   ├── index.html           前端 SPA
│   ├── admin.html           後台管理介面
│   ├── css/app.css          Design System（深色主題）
│   └── js/
│       ├── api.js           typed fetch wrapper
│       ├── map.js           Leaflet 地圖 + marker 管理
│       ├── community.js     社群貼文、附議、留言
│       ├── achievements.js  成就徽章 + 積分 + 進度條
│       └── profile.js       個人資料編輯、偏好設定
├── docs/
│   └── midterm-report-system-analysis.pdf
├── .gitignore
├── CLAUDE.md
└── README.md
```

---

## 雙資料庫

| 帳號 | 資料庫 | 說明 |
|---|---|---|
| `admin` / `user` | `data.sqlite` | 真實資料 |
| `admindemo` / `demo` | `data-demo.sqlite` | 展示資料，每次啟動自動重建燕巢校區 20 筆 |

資料庫為 sql.js in-memory SQLite，持久化至檔案。Render 免費版為 ephemeral 檔案系統，重啟後自動重新 seed。

---

## Render 部署

1. Fork 此 repo 到 GitHub
2. Render → New Web Service → 選 repo
3. Branch: `refactor`，Build: `npm install`，Start: `npm run start`
4. 免費版閒置 15 分鐘後休眠，冷啟動約 30 秒

---

## API 速查

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

## 重要常數

- `FIXED_VOTES_THRESHOLD = 5`：達 5 票附議計入「已修復」統計
- Session 有效期：7 天
- 上傳圖片上限：6 MB，僅 image/*
- 回報積分：+10；附議積分：+2
- Demo 正門座標：22.7729°N, 120.4007°E（深中路 58 號）

---

## 技術棧

- **後端**：Node.js + Express（CommonJS）
- **資料庫**：sql.js（in-memory SQLite + 檔案持久化）
- **前端**：純 HTML / CSS / JS，Leaflet 地圖，無框架
- **部署**：Render（free tier，自動 HTTPS）
- **PWA**：Service Worker + Web App Manifest
