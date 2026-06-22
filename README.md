# 路口排雷 · Lukou Pailei

> 系統分析與設計 第六組 | 蕭其睿、李秉威、黃紹軒、趙姵筑

讓用路人共同標記、驗證道路危險點，透過社群力量降低交通資訊不對稱，守護每一條你我每天行走的路。

**線上版本**：https://road-0f4r.onrender.com

> Render 免費版閒置 15 分鐘後進入休眠，首次開啟需等待約 30 秒冷啟動。

---

## 目錄

- [功能介紹](#功能介紹)
- [帳號說明](#帳號說明)
- [快速啟動](#快速啟動)
- [系統架構](#系統架構)
- [雙資料庫設計](#雙資料庫設計)
- [資料庫 Schema](#資料庫-schema)
- [API 完整參考](#api-完整參考)
- [前端架構](#前端架構)
- [安全設計](#安全設計)
- [Render 部署](#render-部署)
- [技術棧](#技術棧)
- [已知問題與待辦](#已知問題與待辦)

---

## 功能介紹

### 地圖首頁

Leaflet 深色地圖（CartoDB Dark Matter tiles），以不同大小的圓形 marker 視覺化所有危險點。

- **動態 marker 大小**：`severity` 1–5 對應 28 px → 46 px（每級 +4.5 px），嚴重度 5 的 marker 額外套用 CSS 脈動動畫（`@keyframes pulse`）吸引注意
- **類別篩選晶片**：頁頂顯示 6 個類別按鈕（路面坑洞 / 標線不清 / 危險路口 / 標誌缺損 / 積水路段 / 路障障礙物），點選後同步過濾地圖上的 marker 與下方卡片列表，多選疊加
- **統計面板**：首頁卡片即時顯示三個數字——全台排雷點總數、已驗證數、已修復數，資料來自 `/api/state`
- **飛行定位**：點擊卡片或 marker，地圖以 `flyTo(lat, lng, zoom 16)` 動畫飛至目標位置

### 快速回報

- **GPS 自動定位**：登入後系統呼叫 `navigator.geolocation.getCurrentPosition()`；若為 HTTP 連線（非 HTTPS），瀏覽器拒絕 GPS 時自動切換為**地圖手動選點**模式，使用者可在地圖上點一下選取回報座標
- **表單欄位**：
  - 缺陷類別（6 選 1，對應不同 emoji 與顏色）
  - 嚴重度（1–5 滑桿）
  - 說明文字（最多 500 字）
  - 現場照片（最大 6 MB，`image/*`，支援手機相機與相簿）
- **積分獎勵**：送出回報即對該使用者 `points + 10`，並自動觸發徽章檢核
- **API 行為**：`POST /api/hazards/report` 同時寫入 `hazards` 與 `posts` 兩張表，回傳完整的 hazard 與 post 物件供前端無需重整即時新增

### 社群附議（Community）

- **貼文列表**：依 `pinned DESC, createdAt DESC` 排序，置頂貼文永遠在最上方
- **類別與狀態標籤**：每張貼文卡片左上角顯示缺陷類別（emoji + 名稱），右上角顯示狀態標籤（待審 🔴 / 已驗證 🟡 / 已修復 🟢 / 已駁回 ⚫）
- **附議（投票）**：每人每帖限投一票，`post_votes` 表以 `(postId, userId)` 為複合主鍵防止重複；附議者 `points + 2`，可取消附議（票數對應扣除，積分不退還）
- **留言串**：`POST /api/posts/:id/comments`，留言長度最多 200 字，author 欄位取 `user_profiles.name`；留言即時 append 至前端不需重整
- **管理員置頂**：後台 `PATCH /api/admin/posts/:id/pin` 可切換 `pinned` 欄位，前台即時呈現

### 成就徽章系統

共 6 枚勳章，由後端 `checkAndAwardBadges()` 在每次**回報**或**查詢徽章**（`GET /api/badges`）時自動計算並發放，前端無需主動觸發。

| 徽章 ID | 圖示 | 名稱 | 觸發指標（metric） | 門檻（threshold） |
|---|---|---|---|---|
| `badge_first` | 🌱 | 初心排雷師 | `reports`（總回報數） | 1 |
| `badge_10` | ⭐ | 勤奮排雷師 | `reports` | 10 |
| `badge_50` | 🔥 | 黃金排雷師 | `reports` | 50 |
| `badge_vote10` | 👍 | 熱心市民 | `votes_given`（附議次數） | 10 |
| `badge_fixed5` | 🏆 | 排雷英雄 | `fixed`（達 5 票的回報數） | 5 |
| `badge_night` | 🦉 | 夜鷹 | `night_reports`（18:00–06:00 回報） | 5 |

每個徽章卡片顯示**進度條**（當前值 / 目標值），積分橫幅顯示累計積分。

> **夜鷹判斷邏輯**：`strftime('%H', datetime(createdAt/1000,'unixepoch','localtime'))`，取本地時間小時數，`>= 18 OR < 6` 計入夜間。

> **排雷英雄判斷邏輯**：`posts WHERE userId=? AND votes >= 5`，達 5 票附議的貼文才算「有效修復」，常數 `FIXED_VOTES_THRESHOLD = 5`。

### 積分排行榜

`GET /api/leaderboard` 回傳積分最高的前 10 名（排除 `admin` 與 `admindemo`），含名稱、城市、積分、頭像 URL。

### 個人設定

- **個人資料**：顯示名稱（最多 20 字）、handle（自動補 `@` 前綴）、城市（22 縣市文字輸入）、最多 3 個自訂標籤
- **頭像上傳**：`POST /api/avatar`（multer，6 MB，image/*），儲存至 `uploads/` 目錄，路徑寫入 `user_profiles.avatar`
- **偏好 Toggle**：
  - `nearbyNotify`（附近通知，預設開）
  - `autoGps`（自動 GPS，預設開）
  - `nightSaver`（夜間省電，預設關）
- **四格統計**：回報數、達修復數（達 5 票）、獲得附議總票數、我的附議次數

### 管理後台（`/admin.html`）

獨立頁面，不共用前端 SPA。透過 sessionStorage 儲存 `adminCreds`（Base64 編碼的 `username:password`），所有 `/api/admin/*` 請求帶 `Authorization: Basic ...` header。

| 功能 | 端點 |
|---|---|
| 危險點列表與狀態篩選 | `GET /api/admin/hazards?status=` |
| 審核狀態切換（待審 → 已驗證 → 已修復 / 已駁回） | `PATCH /api/admin/hazards/:id/status` |
| 刪除危險點 | `DELETE /api/admin/hazards/:id` |
| 貼文管理（置頂 / 下架） | `GET / PATCH / DELETE /api/admin/posts/*` |
| 留言刪除 | `DELETE /api/admin/comments/:id` |
| 用戶管理（查看 / 刪除） | `GET / DELETE /api/admin/users/*` |
| 危險點 CSV 匯出 | `GET /api/admin/export/csv` |
| 統計儀表板 | `GET /api/admin/stats` |
| 管理員密碼變更 | `PUT /api/admin/password` |

---

## 帳號說明

登入頁不顯示任何帳號提示，系統在 `auth-submit` click handler 依 `username` 自動分流：

| 帳號 | 密碼 | 進入模式 | 使用資料庫 |
|---|---|---|---|
| `admin` | `admin`（可透過後台變更） | 🛡️ 跳轉 `/admin.html` | `data.sqlite`（真實） |
| `admindemo` | `admindemo` | 🛡️ 跳轉 `/admin.html` | `data-demo.sqlite`（展示） |
| `demo` | `demo` | 🎬 一般 App，地圖飛至高雄美麗島站 | `data-demo.sqlite`（展示） |
| `user` | `user` | 👤 一般 App | `data.sqlite`（真實） |

### 帳號分流技術細節

1. **`admin` / `admindemo`**：前端偵測 username 直接跳至 `/admin.html`，後台頁從 sessionStorage 讀取 `adminCreds` 以 HTTP Basic Auth 呼叫所有 API
2. **`demo`**：前端登入後，`makeRequireUser` 中間件在 session 驗證後，因 `username === 'demo'` 將 `req.db` 切換至 `demoDb`，所有後續 API 操作（危險點、貼文、留言）均在展示資料庫中進行，不影響真實資料
3. **`user` / 一般註冊帳號**：使用 `realDb`（`data.sqlite`）

### 展示資料（Demo Data）

`seedDemo()` 於每次啟動時對 `data-demo.sqlite` 執行：
1. 先刪除所有 `id LIKE 'demo_%'` 的舊資料
2. 重建 3 個虛構用戶（陳小明、李美玲、王大偉）
3. 植入 20 筆危險點，座標由 OpenStreetMap Nominatim 確認，涵蓋全高雄市各區

**展示危險點分布**：

| # | 地點 | 座標 | 類別 | 狀態 |
|---|---|---|---|---|
| 1 | 高雄車站前建國二路 | 22.6393, 120.3027 | 路面坑洞 | 待審 |
| 2 | 美麗島站中山路口 | 22.6314, 120.3019 | 危險路口 | 待審 |
| 3 | 六合夜市機車道 | 22.6324, 120.3000 | 路障/障礙物 | 已驗證 |
| 4 | 蓮池潭環潭步道 | 22.6838, 120.2964 | 積水路段 | 待審 |
| 5 | 高雄市立美術館 | 22.6565, 120.2862 | 標誌缺損 | 待審 |
| 6 | 三多商圈中山二路 | 22.6142, 120.3044 | 標線不清 | 待審 |
| 7 | 左營高鐵站接送區 | 22.6874, 120.3085 | 路面坑洞 | **已修復** |
| 8 | 駁二藝術特區大港橋 | 22.6195, 120.2816 | 路面坑洞 | 已驗證 |
| 9 | 夢時代中華五路 | 22.5950, 120.3070 | 路障/障礙物 | 已驗證 |
| 10 | 鳳山車站前曹公路 | 22.6316, 120.3567 | 路面坑洞 | 待審 |
| 11 | 文化中心中正二路 | 22.6303, 120.3176 | 積水路段 | 待審 |
| 12 | 愛河之心大順一路 | 22.6560, 120.3027 | 危險路口 | 待審 |
| 13 | 旗津燈塔步道 | 22.6152, 120.2650 | 標線不清 | 待審 |
| 14 | 高雄展覽館成功二路 | 22.6101, 120.2980 | 路障/障礙物 | 待審 |
| 15 | 大東藝術中心光遠路 | 22.6244, 120.3636 | 標誌缺損 | 待審 |
| 16 | 中央公園捷運站出口 | 22.6248, 120.3012 | 積水路段 | 已驗證 |
| 17 | 岡山車站前圓環 | 22.7929, 120.2992 | 危險路口 | 待審 |
| 18 | 楠梓車站建楠路 | 22.7271, 120.3243 | 路面坑洞 | 待審 |
| 19 | 科工館九如一路 | 22.6416, 120.3227 | 標線不清 | 已驗證 |
| 20 | 鼓山輪渡站前臨水路 | 22.6368, 120.2812 | 路面坑洞 | **已修復** |

---

## 快速啟動

### 系統需求

- Node.js 18+
- npm 9+

### 安裝與啟動

```bash
# 1. 安裝套件
npm install

# 2. 啟動伺服器（預設 http://localhost:3001）
npm start
```

啟動成功後終端顯示：
```
[server] 路口排雷 listening on http://localhost:3001
[demo] 已植入 20 筆危險點、20 筆貼文、8 則留言
```

**Windows 一鍵啟動**：雙擊 `start.bat`，自動：
1. 在前景視窗啟動 Express 伺服器並開啟瀏覽器
2. 在子視窗執行 `node mobile.js`（localtunnel，供手機 GPS 使用）

### 環境變數

| 變數 | 預設值 | 說明 |
|---|---|---|
| `PORT` | `3001` | 監聽埠 |
| `ADMIN_PASSWORD` | `admin` | 管理員後台初始密碼（每次啟動 upsert） |

### 手機 GPS 支援

手機瀏覽器要求 HTTPS 才允許 GPS。兩種解法：

**方法一（推薦本機開發）：localtunnel**

```bash
# 終端 1：啟動伺服器
npm start

# 終端 2：建立 HTTPS tunnel
npm run mobile
```

複製輸出的 `https://xxxx.loca.lt` 到手機瀏覽器，首次進入點擊 **Submit** 通過 localtunnel 驗證頁，GPS 即可正常使用。

**方法二：使用線上版**

https://road-0f4r.onrender.com 已有 HTTPS，GPS 直接可用。

---

## 系統架構

### 目錄結構

```
road-refactor/
│
├── server.js                  ← 入口點：建立 HTTP server，呼叫 openDb() x2 後建立 app
├── mobile.js                  ← localtunnel 腳本（npm run mobile）
├── render.yaml                ← Render 部署宣告式設定
├── start.bat                  ← Windows 一鍵啟動腳本
│
├── src/
│   ├── app.js                 ← Express 組裝中心；掛載所有中間件與路由
│   │
│   ├── db/
│   │   ├── schema.js          ← SCHEMA_SQL / SEED_CATEGORIES / SEED_BADGES /
│   │   │                         DEMO_USERS / DEMO_HAZARDS / DEMO_POSTS / DEMO_COMMENTS
│   │   └── index.js           ← openDb() / migrate() / seedAdmin() / seedDemo() /
│   │                             persist() / rowsToObjects() / hashPassword() / randomId()
│   │
│   ├── middleware/
│   │   ├── auth.js            ← parseCookies / setSessionCookie / clearSessionCookie /
│   │   │                         makeRequireUser / makeRequireAdmin
│   │   └── upload.js          ← multer（6 MB 上限，僅 image/*，存至 uploads/）
│   │
│   └── routes/
│       ├── auth.js            ← /api/auth/*（永遠用 realDb）
│       ├── hazards.js         ← /api/hazards/*（GET 公開 / POST 需登入）
│       ├── posts.js           ← /api/posts/*（vote / comments）
│       ├── users.js           ← /api/state / profile / prefs / badges / leaderboard / avatar
│       └── admin.js           ← /api/admin/*（requireAdmin 保護）
│
├── public/
│   ├── index.html             ← 前端 SPA 主頁
│   ├── admin.html             ← 後台管理介面（獨立頁面）
│   ├── sw.js                  ← Service Worker（PWA 靜態資源快取）
│   ├── manifest.json          ← Web App Manifest
│   ├── css/
│   │   └── app.css            ← 深色主題 Design System（CSS 變數）
│   └── js/
│       ├── config.js          ← window.API_BASE（空字串 = 相對路徑）
│       ├── api.js             ← typed fetch wrapper，統一錯誤處理
│       ├── map.js             ← Leaflet 地圖、marker 管理、選點模式
│       ├── community.js       ← 社群貼文、附議、留言、類別標籤渲染
│       ├── achievements.js    ← 成就徽章、積分橫幅、進度條
│       ├── profile.js         ← 個人資料編輯、偏好 toggle、頭像上傳
│       └── app.js             ← 主控制器（SPA boot、loadState、篩選、路由）
│
├── uploads/                   ← 使用者上傳圖片（gitignore）
├── data.sqlite                ← 真實 SQLite（gitignore）
├── data-demo.sqlite           ← 展示 SQLite（gitignore，每次啟動重建）
├── docs/
│   └── midterm-report-system-analysis.pdf
├── TODO.md
├── CLAUDE.md
└── README.md
```

### 請求處理流程

```
Browser
  │
  ▼
server.js  (Node.js HTTP)
  │
  ▼
app.js (Express)
  │
  ├─ app.use ─── req.db = realDb（預設）
  │
  ├─ /api/auth/*  ──────────────────── auth.js（realDb 固定）
  │
  ├─ /api/* ────── requireUser ──┬─ username === 'demo'  → req.db = demoDb
  │                               └─ 其他               → req.db = realDb（不變）
  │                     │
  │                     ├─ /api/state        → users.js
  │                     ├─ /api/hazards/*    → hazards.js
  │                     ├─ /api/posts/*      → posts.js
  │                     └─ /api/badges / leaderboard / profile / prefs / avatar → users.js
  │
  └─ /api/admin/* ── requireAdmin ─┬─ username === 'admindemo' → req.db = demoDb
                                    └─ username === 'admin'    → req.db = realDb
                          │
                          └─ admin.js（hazards / posts / comments / users / stats / csv / password）
```

---

## 雙資料庫設計

系統同時維護兩個完全獨立的 SQLite 資料庫，展示操作絕對不會污染真實資料。

| | `data.sqlite`（realDb） | `data-demo.sqlite`（demoDb） |
|---|---|---|
| 適用帳號 | `admin`、`user`、一般註冊帳號 | `admindemo`、`demo` |
| 啟動行為 | 若檔案存在則讀取，否則建立 | **每次啟動重建展示資料** |
| 持久化 | `persist()` 寫至磁碟 | `demoPersist()` 寫至磁碟 |

### 中間件切換邏輯

**`makeRequireUser(realDb, demoDb, demoPersist)`**

```
1. 從 Cookie 取 sid token
2. 在 realDb 查詢 sessions → users（永遠用 realDb 驗 session）
3. 若 username === 'demo':
     req.db      = demoDb
     req.persist = demoPersist
   否則:
     req.db 維持 realDb（預設值）
4. 呼叫 next()
```

**`makeRequireAdmin(realDb, realPersist, demoDb, demoPersist)`**

```
1. 解析 Authorization: Basic <base64(username:password)>
2. isDemo = (username === 'admindemo')
3. authDb = isDemo ? demoDb : realDb
4. 在 authDb.admins 驗證 PBKDF2 hash
5. req.db      = isDemo ? demoDb : realDb
   req.persist = isDemo ? demoPersist : realPersist
6. 呼叫 next()
```

**auth 路由例外**：`/api/auth/*` 永遠直接拿 `realDb` 閉包，不走中間件切換，確保 session 與用戶帳號統一管理。

---

## 資料庫 Schema

### `users`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `randomId('u_')` 生成（`u_<timestamp>_<6bytes hex>`） |
| `username` | TEXT NOT NULL UNIQUE | 3–24 字元，`[a-z0-9_]`，強制小寫 |
| `email` | TEXT | 可選，目前未使用 |
| `salt` | TEXT NOT NULL | 16 bytes 隨機 hex |
| `hash` | TEXT NOT NULL | PBKDF2-SHA256(password, salt, 100000 iterations, 32 bytes) |
| `points` | INTEGER NOT NULL DEFAULT 0 | 累計積分 |
| `createdAt` | INTEGER NOT NULL | Unix timestamp ms |

### `sessions`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `token` | TEXT PK | 24 bytes 隨機 hex（48 字元） |
| `userId` | TEXT NOT NULL FK→users | |
| `createdAt` | INTEGER NOT NULL | |
| `expiresAt` | INTEGER NOT NULL | `createdAt + 7 * 24 * 60 * 60 * 1000` |

### `user_profiles`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `userId` | TEXT PK FK→users | |
| `name` | TEXT NOT NULL | 顯示名稱，最多 20 字 |
| `handle` | TEXT NOT NULL | 以 `@` 開頭，最多 24 字 |
| `city` | TEXT NOT NULL | 城市，最多 20 字 |
| `avatar` | TEXT | `/uploads/<filename>` 路徑，可選 |

### `user_profile_tags`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `userId` | TEXT FK→users | |
| `tagText` | TEXT | |
| `ord` | INTEGER | 排序（0–2），最多 3 個 |
| PK | (userId, tagText) | |

### `user_prefs`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `userId` | TEXT FK→users | |
| `key` | TEXT | `nearbyNotify` / `autoGps` / `nightSaver` |
| `value` | INTEGER | 0 = false, 1 = true |
| PK | (userId, key) | 用 `ON CONFLICT DO UPDATE` upsert |

### `categories`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `cat_pothole` / `cat_marking` / `cat_turn` / `cat_sign` / `cat_flooding` / `cat_obstacle` |
| `name` | TEXT NOT NULL | 路面坑洞 / 標線不清 / 危險路口 / 標誌缺損 / 積水路段 / 路障障礙物 |
| `emoji` | TEXT NOT NULL | 🕳️ / ⚠️ / 🚦 / 🪧 / 💧 / 🚧 |
| `riskWeight` | INTEGER NOT NULL | 危險權重（1–5），排序用 |
| `color1` | TEXT NOT NULL | 漸層起始色（hex） |
| `color2` | TEXT NOT NULL | 漸層結束色（hex） |

**類別風險權重表**：

| 類別 | riskWeight | color1 | color2 |
|---|---|---|---|
| 危險路口 | 5 | #FF3B4E | #C0392B |
| 路面坑洞 | 4 | #FF3B4E | #FF6B35 |
| 路障/障礙物 | 4 | #E67E22 | #A04000 |
| 標線不清 | 3 | #FFB800 | #FF8C00 |
| 積水路段 | 3 | #3498DB | #1A5276 |
| 標誌缺損 | 2 | #9B59B6 | #6C3483 |

### `hazards`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `randomId('h_')` |
| `categoryId` | TEXT FK→categories | 可為 NULL |
| `typeEmoji` | TEXT NOT NULL | 類別 emoji（≤ 4 chars） |
| `label` | TEXT NOT NULL | 類別名稱（≤ 40 chars） |
| `title` | TEXT NOT NULL | 回報標題（≤ 80 chars） |
| `description` | TEXT | 詳細說明（≤ 500 chars） |
| `lat` | REAL NOT NULL | 緯度 |
| `lng` | REAL NOT NULL | 經度 |
| `color1` | TEXT NOT NULL | 繼承自 category |
| `color2` | TEXT NOT NULL | 繼承自 category |
| `severity` | INTEGER NOT NULL DEFAULT 3 | 嚴重度 1–5 |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending` / `verified` / `fixed` / `rejected` |
| `userId` | TEXT FK→users | 回報者（刪除用戶後 SET NULL） |
| `createdAt` | INTEGER NOT NULL | Unix timestamp ms |
| `updatedAt` | INTEGER NOT NULL | 最後更新時間 ms |

### `hazard_photos`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `randomId('hp_')` |
| `hazardId` | TEXT NOT NULL FK→hazards | 刪除危險點時 CASCADE |
| `url` | TEXT NOT NULL | `/uploads/<filename>` |
| `createdAt` | INTEGER NOT NULL | |

### `posts`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `randomId('p_')` |
| `hazardId` | TEXT NOT NULL FK→hazards | 刪除危險點時 CASCADE |
| `typeEmoji` | TEXT NOT NULL | |
| `label` | TEXT NOT NULL | |
| `title` | TEXT NOT NULL | ≤ 100 chars |
| `reporterName` | TEXT NOT NULL | 回報者顯示名稱（≤ 20 chars） |
| `photoUrl` | TEXT | 附圖 URL |
| `votes` | INTEGER NOT NULL DEFAULT 0 | 附議票數 |
| `pinned` | INTEGER NOT NULL DEFAULT 0 | 0/1 置頂旗標 |
| `userId` | TEXT FK→users | |
| `createdAt` | INTEGER NOT NULL | |

### `post_votes`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `postId` | TEXT NOT NULL FK→posts | 刪除貼文時 CASCADE |
| `userId` | TEXT NOT NULL FK→users | 刪除用戶時 CASCADE |
| `createdAt` | INTEGER NOT NULL | |
| PK | (postId, userId) | 防止重複投票 |

### `comments`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | `randomId('c_')` |
| `postId` | TEXT NOT NULL FK→posts | 刪除貼文時 CASCADE |
| `author` | TEXT NOT NULL | 作者顯示名稱（≤ 20 chars） |
| `text` | TEXT NOT NULL | 留言內容（≤ 200 chars） |
| `at` | INTEGER NOT NULL | Unix timestamp ms |
| `userId` | TEXT FK→users | 刪除用戶後 SET NULL |

### `badges`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT NOT NULL | 徽章名稱 |
| `emoji` | TEXT NOT NULL | 徽章圖示 |
| `description` | TEXT NOT NULL | 說明文字 |
| `threshold` | INTEGER NOT NULL | 達成門檻數字 |
| `metric` | TEXT NOT NULL | 指標名稱（reports / fixed / votes_given / night_reports） |

### `user_badges`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `userId` | TEXT NOT NULL FK→users | |
| `badgeId` | TEXT NOT NULL FK→badges | |
| `earnedAt` | INTEGER NOT NULL | 發放時間 |
| PK | (userId, badgeId) | 用 `INSERT OR IGNORE` 防重複 |

### `admins`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `username` | TEXT PK | `admin` / `admindemo` |
| `salt` | TEXT NOT NULL | 16 bytes 隨機 hex |
| `hash` | TEXT NOT NULL | PBKDF2-SHA256 |
| `createdAt` | INTEGER NOT NULL | |

---

## API 完整參考

所有 API 回傳 JSON，成功時包含 `"ok": true`，失敗時包含 `"error": "<code>"`。

### 公開端點（無需認證）

#### `GET /api/health`

健康檢查。

```json
// Response 200
{ "ok": true, "ts": 1718900000000 }
```

#### `GET /api/auth/me`

取得目前 session 狀態（依 Cookie `sid` 判斷）。

```json
// 已登入 Response 200
{ "ok": true, "loggedIn": true, "user": { "id": "u_...", "username": "alice" } }

// 未登入 Response 200
{ "ok": true, "loggedIn": false }
```

#### `POST /api/auth/register`

註冊新帳號。

```json
// Request Body
{
  "username": "alice",    // 3–24 chars, [a-z0-9_]（自動轉小寫）
  "password": "secret123", // 至少 6 chars
  "name": "愛麗絲",        // 顯示名稱（選填，預設「道路守護者」）
  "city": "台北市"          // 城市（選填，預設「高雄市」）
}

// Response 200
{ "ok": true, "user": { "id": "u_...", "username": "alice" } }

// Error 400
{ "error": "invalid_username" }  // 格式不符
{ "error": "weak_password" }     // 少於 6 字元
{ "error": "username_taken" }    // 帳號已存在
```

> 同時建立 `user_profiles`（name, handle, city）與 `user_prefs`（nearbyNotify=1, autoGps=1, nightSaver=0）。

#### `POST /api/auth/login`

登入並取得 Session Cookie。

```json
// Request Body
{ "username": "alice", "password": "secret123" }

// Response 200（同時 Set-Cookie: sid=<token>; HttpOnly; SameSite=Lax; Max-Age=604800）
{ "ok": true, "user": { "id": "u_...", "username": "alice" } }

// Error 400
{ "error": "invalid_login" }
```

#### `POST /api/auth/logout`

登出，刪除 session 並清除 Cookie。

```json
// Response 200
{ "ok": true }
```

#### `POST /api/demo/seed`

強制重建展示資料（idempotent，每次刪除舊資料再重建）。

```json
// Response 200
{ "ok": true }
```

#### `GET /api/hazards`

取得危險點列表（**無需登入**）。

```
Query: ?status=pending|verified|fixed|rejected  （選填）
       ?categoryId=cat_pothole|...               （選填）
```

```json
// Response 200
{
  "ok": true,
  "hazards": [
    {
      "id": "h_...", "categoryId": "cat_pothole", "typeEmoji": "🕳️",
      "label": "路面坑洞", "title": "...", "description": "...",
      "lat": 22.6393, "lng": 120.3027,
      "color1": "#FF3B4E", "color2": "#FF6B35",
      "severity": 4, "status": "pending",
      "userId": "u_...", "createdAt": 1718900000000, "updatedAt": 1718900000000
    }
  ]
}
```

#### `GET /api/hazards/categories`

取得所有缺陷分類（依 riskWeight DESC 排序）。

```json
// Response 200
{
  "ok": true,
  "categories": [
    { "id": "cat_turn", "name": "危險路口", "emoji": "🚦", "riskWeight": 5, "color1": "#FF3B4E", "color2": "#C0392B" },
    ...
  ]
}
```

#### `GET /api/hazards/:id`

取得單一危險點（含照片列表）。

```json
// Response 200
{
  "ok": true,
  "hazard": {
    ...（所有 hazards 欄位）,
    "photos": ["/uploads/abc.jpg", "/uploads/def.jpg"]
  }
}

// Error 404
{ "error": "not_found" }
```

---

### 需登入端點（Session Cookie：`sid`）

#### `GET /api/state`

取得完整 App 初始狀態，SPA 啟動時呼叫一次。

```json
// Response 200
{
  "me": { "id": "u_...", "username": "alice", "points": 150 },
  "profile": { "name": "愛麗絲", "handle": "@alice", "city": "台北市", "avatar": null, "tags": ["日常通勤", "機車族"] },
  "prefs": { "nearbyNotify": true, "autoGps": true, "nightSaver": false },
  "myStats": {
    "myHazards": 5,
    "myFixed": 1,
    "receivedVotes": 23,
    "helpedVotes": 7,
    "nightReports": 0
  },
  "myBadges": [
    { "id": "badge_first", "name": "初心排雷師", "emoji": "🌱", "description": "完成第 1 次回報", "earnedAt": 1718900000000 }
  ],
  "hazards": [ ...（格式同 GET /api/hazards） ],
  "posts": [
    {
      "id": "p_...", "hazardId": "h_...", "typeEmoji": "🕳️", "label": "路面坑洞",
      "title": "...", "createdAt": 1718900000000, "votes": 3, "pinned": false,
      "comments": [ { "author": "王大偉", "text": "...", "at": 1718901000000 } ],
      "isMine": false, "voted": true,
      "reporterName": "陳小明", "photoUrl": "/uploads/abc.jpg"
    }
  ],
  "categories": [ ...（格式同 GET /api/hazards/categories） ]
}
```

#### `POST /api/hazards/report`

回報新危險點（同時建立 hazard + post）。

```json
// Request Body
{
  "hazard": {
    "lat": 22.6393,
    "lng": 120.3027,
    "categoryId": "cat_pothole",
    "type": "🕳️",
    "label": "路面坑洞",
    "title": "忠孝路路面坑洞",         // 選填，預設「【新回報】<label>」
    "description": "路面下陷約 10cm",   // 選填，max 500 chars
    "severity": 4,                       // 1–5
    "colors": ["#FF3B4E", "#FF6B35"]
  },
  "post": {
    "reporterName": "愛麗絲",
    "title": "忠孝路路面坑洞（GPS 建立）", // 選填
    "photoUrl": "/uploads/abc.jpg"          // 選填
  }
}

// Response 200（hazard + post 完整物件，前端無需重整即可插入）
{
  "ok": true,
  "hazard": { "id": "h_...", "type": "🕳️", ... },
  "post": { "id": "p_...", "hazardId": "h_...", ... }
}

// Error 400
{ "error": "invalid_lat_lng" }
```

> 觸發效果：`users.points += 10`，`checkAndAwardBadges()` 檢查所有指標。

#### `POST /api/hazards/upload`

上傳現場照片。

```
Content-Type: multipart/form-data
Field name: photo
限制: max 6 MB, image/* only
```

```json
// Response 200
{ "ok": true, "url": "/uploads/<uuid>.jpg" }

// Error 400
{ "error": "missing_file" }
```

#### `PATCH /api/hazards/:id`

編輯自己的回報（只有原始回報者可操作）。

```json
// Request Body（所有欄位選填）
{ "title": "更新標題", "description": "更新說明", "severity": 3 }

// Response 200
{ "ok": true }

// Error 403
{ "error": "forbidden" }
// Error 404
{ "error": "not_found" }
```

> 同步更新 `posts.title`（若 title 有變動）。

#### `DELETE /api/hazards/:id`

刪除自己的回報（CASCADE 刪除 hazard_photos / comments / post_votes / posts）。

```json
// Response 200
{ "ok": true }
```

#### `GET /api/posts`

分頁取得貼文列表（置頂優先）。

```
Query: ?page=1  ?limit=10（max 50）
```

```json
// Response 200
{
  "ok": true,
  "posts": [ ...（格式同 /api/state 的 posts） ],
  "total": 42,
  "page": 1,
  "limit": 10,
  "hasMore": true
}
```

#### `POST /api/posts/:postId/vote`

對貼文附議（每人每帖限一票）。

```json
// Response 200
{ "ok": true, "votes": 4 }

// Error 400
{ "error": "already_voted" }
// Error 404
{ "error": "not_found" }
```

> 觸發效果：`users.points += 2`（附議者本人）。

#### `DELETE /api/posts/:postId/vote`

取消附議（票數 -1，積分不退）。

```json
// Response 200
{ "ok": true, "votes": 3 }
```

#### `POST /api/posts/:postId/comments`

發表留言。

```json
// Request Body
{ "text": "留言內容（max 200 chars）", "author": "選填，預設取 profile.name" }

// Response 200
{ "ok": true, "comment": { "id": "c_...", "author": "愛麗絲", "text": "...", "at": 1718901000000 } }

// Error 400
{ "error": "missing_text" }
// Error 404
{ "error": "not_found" }
```

#### `PUT /api/profile`

更新個人資料。

```json
// Request Body
{
  "name": "愛麗絲",
  "handle": "alice_tw",         // 自動補 @ 前綴
  "city": "台北市",
  "tags": ["日常通勤", "機車族"] // 最多 3 個
}

// Response 200
{ "ok": true }
```

#### `PUT /api/prefs`

更新偏好設定（只需傳要變更的欄位）。

```json
// Request Body
{ "nearbyNotify": true, "autoGps": false, "nightSaver": true }

// Response 200
{ "ok": true }
```

#### `GET /api/badges`

取得目前徽章（同時觸發新徽章自動發放）。

```json
// Response 200
{
  "ok": true,
  "badges": [
    { "id": "badge_first", "name": "初心排雷師", "emoji": "🌱", "description": "完成第 1 次回報", "earnedAt": 1718900000000 }
  ]
}
```

#### `GET /api/leaderboard`

積分排行榜（前 10 名，排除系統帳號）。

```json
// Response 200
{
  "ok": true,
  "leaders": [
    { "id": "u_...", "name": "陳小明", "city": "燕巢區", "points": 120, "avatar": null }
  ]
}
```

#### `POST /api/avatar`

上傳頭像（multipart/form-data，field name: `photo`，max 6 MB）。

```json
// Response 200
{ "ok": true, "url": "/uploads/<uuid>.jpg" }
```

---

### 管理後台端點（HTTP Basic Auth）

所有 `/api/admin/*` 請求須帶 `Authorization: Basic <base64(username:password)>` header。

#### `GET /api/admin/stats`

統計儀表板數據。

```json
// Response 200
{
  "ok": true,
  "stats": {
    "total": 20, "pending": 13, "verified": 5, "fixed": 2,
    "users": 6,
    "byCategory": { "路面坑洞": 8, "危險路口": 3, ... },
    "bySeverity": { "1": 1, "2": 3, "3": 7, "4": 6, "5": 1 }
  }
}
```

#### `GET /api/admin/hazards`

危險點列表（可依狀態篩選）。

```
Query: ?status=pending|verified|fixed|rejected  （選填）
```

#### `PATCH /api/admin/hazards/:id/status`

更新危險點狀態。允許值：`pending` / `verified` / `fixed` / `rejected`。

```json
// Request Body
{ "status": "verified" }

// Error 400
{ "error": "invalid_status" }
```

#### `DELETE /api/admin/hazards/:id`

刪除危險點（CASCADE）。

#### `GET /api/admin/posts`

貼文列表（置頂優先）。

#### `PATCH /api/admin/posts/:id/pin`

置頂 / 取消置頂。

```json
// Request Body
{ "pinned": true }
```

#### `DELETE /api/admin/posts/:id`

刪除貼文。

#### `GET /api/admin/comments`

留言列表（依時間 DESC）。

#### `DELETE /api/admin/comments/:id`

刪除留言。

#### `GET /api/admin/users`

用戶列表（id, username, email, points, createdAt）。

#### `DELETE /api/admin/users/:id`

刪除用戶（CASCADE 刪除 sessions / profiles / prefs / hazards / posts / votes / badges）。

#### `GET /api/admin/export/csv`

匯出所有危險點為 CSV（UTF-8 with BOM，filename: `hazards.csv`）。

欄位：`id, label, title, lat, lng, severity, status, categoryId, createdAt`

#### `PUT /api/admin/password`

變更管理員密碼。

```json
// Request Body
{ "oldPassword": "admin", "newPassword": "newpassword123" }

// Error 400
{ "error": "wrong_password" }
{ "error": "weak_password" }  // 新密碼少於 6 字元
```

---

## 前端架構

### Script 載入順序

```html
<script src="/js/config.js"></script>       <!-- window.API_BASE -->
<script src="/js/api.js"></script>           <!-- fetchAPI() -->
<script src="/js/map.js"></script>           <!-- initMap(), addMarker(), flyTo() -->
<script src="/js/community.js"></script>     <!-- renderPosts(), vote(), addComment() -->
<script src="/js/achievements.js"></script>  <!-- renderBadges(), renderStats() -->
<script src="/js/profile.js"></script>       <!-- renderProfile(), saveProfile(), savePrefs() -->
<script src="/js/app.js"></script>           <!-- loadState(), boot(), 篩選邏輯 -->
```

### 各模組職責

**`config.js`**
- 定義 `window.API_BASE`（空字串代表使用相對路徑）

**`api.js`**
- `fetchAPI(path, options)` — 封裝 `fetch`，自動加 `credentials: 'include'`（Session Cookie），統一解析 JSON，非 200 狀態碼拋出錯誤

**`map.js`**
- 初始化 Leaflet（CartoDB Dark Matter tile layer）
- `addMarker(hazard)` — 依 severity 計算大小，建立 SVG 圓形 marker；嚴重度 5 套用脈動動畫 class
- `flyTo(lat, lng, zoom)` — 地圖平滑飛行
- 選點模式（`window.onMapPick`）— 回報表單開啟時啟動，點一下地圖回傳座標
- **不持有任何 STATE**，完全由 `app.js` 驅動

**`community.js`**
- 渲染貼文卡片列表（類別標籤 + 狀態標籤 + 附議按鈕 + 留言串）
- 處理附議（`vote(postId, isVoted)`）與留言（`submitComment(postId, text)`）

**`achievements.js`**
- 渲染徽章卡片（emoji + 名稱 + 進度條）
- 渲染積分橫幅

**`profile.js`**
- 個人資料表單（name / handle / city / tags）
- 偏好 Toggle（nearbyNotify / autoGps / nightSaver）
- 頭像上傳

**`app.js`**
- `loadState()` — 呼叫 `GET /api/state`，結果存入 `window.STATE`（透過 `Object.defineProperty` getter 對外開放），再依序呼叫各模組渲染函式
- Boot 序列：依 `username` 決定是否自動 panTo（demo 帳號飛至高雄美麗島站）或啟動 GPS 定位
- 類別篩選晶片狀態管理
- Tab 切換（地圖 / 社群 / 成就 / 設定）

### 管理後台（`admin.html`）

完全獨立，不共用任何前端 JS。

- 頁面載入時從 `sessionStorage.getItem('adminCreds')` 讀取 Base64 編碼的 `username:password`
- 若 `adminCreds` 不存在，`window.location.href = '/'` 跳回首頁
- 所有 `/api/admin/*` fetch 帶 `Authorization: Basic <adminCreds>` header
- 無 JS 框架，純 DOM 操作

### PWA

- **Service Worker**（`sw.js`）：快取 HTML / CSS / JS 靜態資源，離線時可顯示舊版頁面
- **Web App Manifest**（`manifest.json`）：支援加至桌面、Splash Screen

---

## 安全設計

### 密碼雜湊

使用 Node.js 內建 `crypto.pbkdf2Sync`：

```
PBKDF2(password, salt, iterations=100000, keylen=32, digest='sha256')
```

- `salt`：每次 `crypto.randomBytes(16).toString('hex')` 隨機生成，存於資料庫
- `iterations`：100,000 次，符合 OWASP 2023 建議下限

### Session

- Token：`crypto.randomBytes(24).toString('hex')` — 48 字元 hex，熵值 192 bits
- Cookie 屬性：`HttpOnly; SameSite=Lax; Max-Age=604800`
- 不使用 `Secure` 旗標（因 Render 在反向代理後端連線為 HTTP，HTTPS 由 Render 終止）
- 有效期 7 天，登出時刪除資料庫中的 session 記錄

### SQL Injection 防護

所有 SQL 查詢使用 `db.prepare(sql).run(params)` 或 `db.exec(sql, params)` 參數化查詢，不拼接字串。

### 輸入驗證

- 字串欄位一律 `.trim().slice(0, maxLen)`
- 數值欄位用 `Number()` 轉型後以 `Math.min / Math.max` 夾鉗
- 圖片上傳由 multer 限制 `fileSize: 6 * 1024 * 1024` 與 `mimetype: /^image\//`
- username 格式：`/^[a-z0-9_]{3,24}$/`

### Admin Basic Auth

後台使用獨立 `admins` 表（非 `users`），以相同 PBKDF2 演算法驗證，`WWW-Authenticate: Basic realm="lukou-pailei-admin"` 標準協議。

---

## Render 部署

### `render.yaml` 宣告式設定

```yaml
services:
  - type: web
    name: lukou-pailei
    env: node
    branch: refactor
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### 手動部署步驟

1. Fork 此 repo 至你的 GitHub
2. Render Dashboard → **New** → **Web Service** → 連結 repo
3. 設定：

   | 設定項目 | 值 |
   |---|---|
   | Branch | `refactor` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Environment | Node |

4. 可選：新增環境變數 `ADMIN_PASSWORD` 變更預設管理員密碼

### Git 分支說明

| 分支 | 說明 |
|---|---|
| `master`（remote） | 原始 V1 Android/Capacitor 版本 |
| `refactor`（remote） | 當前 Web SPA 重構版，Render 自動部署 |
| `master`（local） | 對應 remote `refactor`，push 指令：`git push origin master:refactor` |

### 注意事項

- **Ephemeral 檔案系統**：Render 免費版重啟後 `data.sqlite` 會消失，真實用戶資料重置
  - 展示資料 `data-demo.sqlite` 每次啟動重建，不受影響
  - 若需持久化真實資料，可掛 **Render Persistent Disk** 或改用 PostgreSQL

- **冷啟動延遲**：免費版閒置 15 分鐘後休眠，第一次請求需等待約 30 秒

- **`uploads/` 目錄**：用戶上傳的照片同樣不持久化，重啟後遺失；生產環境應改用 S3 / Cloudflare R2 / Supabase Storage

---

## 技術棧

| 層級 | 技術 | 說明 |
|---|---|---|
| 後端語言 | Node.js 18+ | CommonJS（`require`） |
| Web 框架 | Express 4 | 路由、中間件、靜態檔案 |
| 資料庫引擎 | sql.js 1.x | in-memory SQLite，`db.export()` 寫檔持久化 |
| 認證（用戶） | Session Cookie | `HttpOnly; SameSite=Lax`，token 存 sessions 表 |
| 認證（管理員） | HTTP Basic Auth | PBKDF2-SHA256，`Authorization: Basic` header |
| 密碼雜湊 | PBKDF2-SHA256 | Node.js crypto，100,000 次迭代 |
| 檔案上傳 | multer | 6 MB，image/* |
| 前端框架 | 無（Vanilla JS） | 純 HTML / CSS / JS，無打包工具 |
| 地圖 | Leaflet 1.9.4 | CartoDB Dark Matter 深色地圖磚 |
| PWA | Service Worker + Manifest | 靜態資源快取，支援加至桌面 |
| HTTPS tunnel | localtunnel | 本機開發手機 GPS 用 |
| 部署平台 | Render free tier | 自動 HTTPS，監聽 `refactor` 分支 |

---

## 已知問題與待辦

### 已知問題

| 問題 | 影響 | 狀態 |
|---|---|---|
| 「查看全部」按鈕點了無反應 | 無法瀏覽超出首頁顯示數量的危險點 | 待實作 |
| 社群貼文點擊後無法飛至地圖對應位置 | UX 不完整 | 待修復 |
| 手機下拉刷新（pull-to-refresh）未支援 | 用戶需手動重整 | 待實作 |
| Render 冷啟動約 30 秒無回應 | 首次訪問體驗差 | 可加載入動畫緩解 |
| `uploads/` 不持久化（Render ephemeral） | 圖片重啟後消失 | 需 CDN / Object Storage |

### 高優先待辦（🔴）

- **危險點搜尋**：可搜尋標題或地址
- **編輯 / 刪除自己的回報**：回報後可修改（`PATCH /api/hazards/:id` 已實作，前端待串接）
- **Marker 聚合**：密集區域自動合併（Leaflet.markercluster）
- **無限捲動 / 分頁**：社群頁目前一次載入全部（`GET /api/posts` 分頁 API 已實作，前端待串接）
- **回報表單分步驟引導（wizard）**：類別 → 嚴重度 → 描述 → 位置

### 中優先待辦（🟡）

- **通知系統**：自己的回報狀態變更時顯示 badge
- **貼文 → 地圖跳轉**：點擊貼文地點名稱飛至地圖
- **積分排行榜**：前端界面（`GET /api/leaderboard` 已實作）
- **批量操作**：後台可一次選多筆危險點批量改狀態
- **持久化資料庫**：改用 PostgreSQL（Render 提供免費版）

---

*路口排雷 · Lukou Pailei — 系統分析與設計 第六組*
*蕭其睿 · 李秉威 · 黃紹軒 · 趙姵筑*
