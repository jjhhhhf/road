# 路口排雷 · Lukou Pailei

> 系統分析與設計 第六組 | 蕭其睿、李秉威、黃紹軒、趙姵筑

讓用路人共同標記、驗證道路危險點，透過社群力量降低交通資訊不對稱，守護每一條你我每天行走的路。

**線上版本**：https://road-0f4r.onrender.com

> Render 免費版閒置 15 分鐘後會休眠，第一次開啟需等待約 30 秒。

---

## 目錄

- [功能介紹](#功能介紹)
- [帳號說明](#帳號說明)
- [快速啟動](#快速啟動)
- [系統架構](#系統架構)
- [雙資料庫設計](#雙資料庫設計)
- [資料表說明](#資料表說明)
- [API 速查](#api-速查)
- [Render 部署](#render-部署)
- [技術棧](#技術棧)

---

## 功能介紹

### 地圖首頁
- **Leaflet 深色地圖**，危險點以不同大小的 marker 顯示，嚴重度越高 marker 越大（28–46px），嚴重度 5 有脈動動畫
- **類別篩選晶片**，點選類別同步過濾地圖 marker 與清單
- **統計面板**：即時顯示全台排雷點數、已驗證數、已修復數
- 點擊清單卡片或地圖 marker 自動飛至該位置（flyTo）

### 快速回報
- 開啟 GPS 自動定位，HTTP 連線自動改為地圖手動選點
- 缺陷類別選擇（6 類），嚴重度 1–5 滑選
- 可附現場照片（最大 6 MB，支援相機或相簿）
- 送出即獲 +10 積分

### 社群附議
- 每篇回報貼文顯示**缺陷類別標籤**與**狀態標籤**（待審 / 已驗證 / 已修復）
- 附議（投票）功能，每次附議 +2 積分
- 留言串，即時更新
- 管理員可置頂重要貼文

### 成就徽章
- 6 種自動發放的成就勳章
- 每個徽章顯示進度條與當前 / 目標數字
- 積分橫幅顯示累計積分

| 徽章 | 條件 |
|---|---|
| 🌱 初心排雷師 | 完成第 1 次回報 |
| ⭐ 勤奮排雷師 | 累積 10 次回報 |
| 🔥 黃金排雷師 | 累積 50 次回報 |
| 👍 熱心市民 | 累積附議 10 次 |
| 🏆 排雷英雄 | 5 筆回報達成修復 |
| 🦉 夜鷹 | 夜間（18:00–06:00）回報 5 次 |

### 個人設定
- 編輯顯示名稱與城市（22 縣市下拉選單）
- 偏好 Toggle：附近通知、自動 GPS、夜間省電
- 回報數、已修復、獲得附議、我的附議四格統計

### 管理後台（`/admin.html`）
- 危險點審核，狀態切換（待審 → 已驗證 → 已修復 / 已駁回）
- 貼文置頂 / 下架
- 留言刪除
- 用戶管理
- 危險點 CSV 匯出
- Admin 密碼變更

---

## 帳號說明

登入頁不顯示帳號提示，系統依帳號自動分流進入對應模式：

| 帳號 | 密碼 | 進入模式 |
|---|---|---|
| `admin` | `admin` | 🛡️ 管理後台（真實資料庫，空白） |
| `admindemo` | `admindemo` | 🛡️ 管理後台（展示資料庫，含 20 筆高雄地標） |
| `demo` | `demo` | 🎬 一般 App 展示模式（自動植入資料，地圖飛至高雄美麗島站） |
| `user` | `user` | 👤 一般使用者模式 |

**展示資料**包含高雄市 20 個知名地標的模擬缺陷回報，座標由 OpenStreetMap Nominatim 確認，分布全高雄市各區（高雄車站、美麗島站、六合夜市、蓮池潭、駁二藝術特區…等）。

---

## 快速啟動

### 需求
- Node.js 18+
- npm

### 本機啟動

```bash
# 安裝套件
npm install

# 啟動伺服器（預設 http://localhost:3001）
npm start
```

雙擊 **`start.bat`**（Windows）一鍵啟動，會自動開啟瀏覽器並在獨立視窗啟動手機用 HTTPS tunnel。

### 手機 GPS 支援

手機瀏覽器在 HTTP 連線下會封鎖 GPS 存取。有兩種解法：

**方法一（推薦）：localtunnel**
```bash
# 先啟動伺服器
npm start

# 另開一個終端，啟動 tunnel
npm run mobile
```
複製 `https://xxxx.loca.lt` 網址到手機，第一次進入點 Submit 通過驗證，GPS 即可正常使用。

**方法二：直接使用 Render 線上版**
https://road-0f4r.onrender.com（已有 HTTPS，GPS 直接可用）

---

## 系統架構

```
road-refactor/
├── server.js                入口點（純 HTTP，Render 自動提供 HTTPS）
├── mobile.js                本機開發 localtunnel（手機 GPS 用）
├── render.yaml              Render 部署設定
├── start.bat                Windows 快速啟動腳本
│
├── src/
│   ├── app.js               Express 組裝、雙 DB 注入、路由掛載
│   ├── db/
│   │   ├── schema.js        CREATE TABLE、種子資料（DEMO_HAZARDS 20 筆）
│   │   └── index.js         openDb()、seedDemo()、migrate()、DB helpers
│   ├── middleware/
│   │   ├── auth.js          makeRequireUser / makeRequireAdmin（依帳號切換 DB）
│   │   └── upload.js        multer（6 MB，image only）
│   └── routes/
│       ├── auth.js          /api/auth/*（永遠使用 realDb）
│       ├── hazards.js       /api/hazards/*（使用 req.db）
│       ├── posts.js         /api/posts/:id/vote|comments（使用 req.db）
│       ├── users.js         /api/state, profile, prefs, badges（使用 req.db）
│       └── admin.js         /api/admin/*（使用 req.db，由 requireAdmin 注入）
│
├── public/
│   ├── index.html           前端 SPA 入口
│   ├── admin.html           後台管理介面（獨立頁面，靠 sessionStorage 認證）
│   ├── css/app.css          Design System（深色主題）
│   └── js/
│       ├── config.js        window.API_BASE
│       ├── api.js           typed fetch wrapper，所有 API call 走這裡
│       ├── map.js           Leaflet 地圖、marker 管理、選點模式
│       ├── community.js     社群貼文、附議、留言、類別標籤
│       ├── achievements.js  成就徽章、積分、進度條
│       └── profile.js       個人資料編輯、偏好 toggle
│
├── docs/
│   └── midterm-report-system-analysis.pdf
├── TODO.md                  未來優化清單
├── CLAUDE.md                AI 開發說明文件
└── README.md
```

---

## 雙資料庫設計

本系統同時維護兩個獨立的 SQLite 資料庫，確保展示操作不影響真實資料：

| 資料庫 | 帳號 | 說明 |
|---|---|---|
| `data.sqlite` | `admin`、`user` 及一般註冊帳號 | 真實使用者資料，互不干擾 |
| `data-demo.sqlite` | `admindemo`、`demo` | 展示資料，每次伺服器啟動自動重建 20 筆高雄地標 |

**切換邏輯**：
- `makeRequireUser(realDb, demoDb)` — session 驗證後，username 為 `demo` 則注入 `req.db = demoDb`
- `makeRequireAdmin(realDb, ..., demoDb, ...)` — username 為 `admindemo` 則注入 `req.db = demoDb`
- 所有 route 僅使用 `req.db` 與 `req.persist`，不持有任何 DB 閉包

**auth 路由例外**：登入 / 登出 / session 永遠使用 `realDb`（帳號系統統一管理）

---

## 資料表說明

| 資料表 | 說明 |
|---|---|
| `users` | 使用者帳號（id, username, salt, hash, points, createdAt） |
| `sessions` | 登入 session（token, userId，7 天有效） |
| `user_profiles` | 個人資料（name, handle, city） |
| `user_profile_tags` | 最多 3 個自訂標籤 |
| `user_prefs` | 偏好設定（nearbyNotify, autoGps, nightSaver） |
| `categories` | 缺陷分類（riskWeight, color1, color2） |
| `hazards` | 危險點（lat, lng, severity 1–5, status, categoryId） |
| `hazard_photos` | 危險點附加照片 |
| `posts` | 社群回報貼文（votes, pinned） |
| `post_votes` | 附議記錄（每人每貼一票） |
| `comments` | 留言 |
| `badges` | 成就勳章定義（threshold, metric） |
| `user_badges` | 使用者已獲勳章 |
| `admins` | 管理員帳號（Basic Auth，PBKDF2-SHA256） |

**重要常數**

| 常數 | 值 | 說明 |
|---|---|---|
| `FIXED_VOTES_THRESHOLD` | 5 | 達 5 票附議計入「已修復」個人統計 |
| Session 有效期 | 7 天 | |
| 上傳圖片上限 | 6 MB | 僅 image/* |
| 回報積分 | +10 | |
| 附議積分 | +2 | |

---

## API 速查

### 公開端點

```
GET  /api/health              健康檢查
GET  /api/auth/me             取得目前登入狀態
POST /api/auth/register       註冊新帳號
POST /api/auth/login          登入
POST /api/auth/logout         登出
POST /api/demo/seed           植入展示資料（idempotent）
```

### 需登入（Session Cookie）

```
GET    /api/state                         取得完整 App 狀態
GET    /api/hazards                       危險點列表 ?status= ?categoryId=
GET    /api/hazards/categories            分類列表
POST   /api/hazards/report                回報新危險點
POST   /api/hazards/upload                上傳照片
POST   /api/posts/:id/vote                附議
DELETE /api/posts/:id/vote                取消附議
POST   /api/posts/:id/comments            發表留言
PUT    /api/profile                       更新個人資料
PUT    /api/prefs                         更新偏好設定
GET    /api/badges                        取得勳章並自動發放新獲得的
```

### 管理後台（HTTP Basic Auth）

```
GET    /api/admin/stats                   統計數據
GET    /api/admin/hazards                 危險點列表 ?status=
PATCH  /api/admin/hazards/:id/status      更新危險點狀態
DELETE /api/admin/hazards/:id             刪除危險點
GET    /api/admin/posts                   貼文列表（置頂優先）
PATCH  /api/admin/posts/:id/pin           置頂 / 取消置頂
DELETE /api/admin/posts/:id               刪除貼文
GET    /api/admin/comments                留言列表
DELETE /api/admin/comments/:id            刪除留言
GET    /api/admin/users                   用戶列表
DELETE /api/admin/users/:id               刪除用戶
GET    /api/admin/export/csv              匯出危險點 CSV
PUT    /api/admin/password                變更管理員密碼
```

---

## Render 部署

1. Fork 此 repo 到你的 GitHub
2. Render Dashboard → **New** → **Web Service** → 連結你的 repo
3. 設定如下（或讓 `render.yaml` 自動套用）：

   | 設定 | 值 |
   |---|---|
   | Branch | `refactor` |
   | Build Command | `npm install` |
   | Start Command | `npm run start` |
   | Environment | Node |

4. 部署完成後取得 `https://xxxx.onrender.com`，GPS 即可在手機直接使用

> **注意**：Render 免費版使用 ephemeral 檔案系統，伺服器重啟後 `data.sqlite` 會重置。
> 展示資料（`data-demo.sqlite`）每次啟動自動重建，不受影響。
> 若需持久化真實資料，可在 Render 加掛 **Persistent Disk** 或改用 PostgreSQL。

---

## 技術棧

| 項目 | 技術 |
|---|---|
| 後端 | Node.js 18+ + Express 4（CommonJS） |
| 資料庫 | sql.js（in-memory SQLite + 檔案持久化） |
| 認證 | Session Cookie（HttpOnly）+ HTTP Basic Auth（Admin） |
| 密碼雜湊 | PBKDF2-SHA256，100,000 次迭代 |
| 前端 | 純 HTML / CSS / JS，無框架 |
| 地圖 | Leaflet 1.9.4 + CartoDB Dark Matter tiles |
| PWA | Service Worker + Web App Manifest |
| 部署 | Render free tier（自動 HTTPS） |
| 手機 GPS | localtunnel（本機開發）/ Render HTTPS（線上） |
