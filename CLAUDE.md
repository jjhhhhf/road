# 路口排雷 (Lukou Pailei)

道路危險回報平台，讓社群共同標記並追蹤路口危險點。
系統分析與設計 第六組（蕭其睿、李秉威、黃紹軒、趙姵筑）

**線上版本**：https://road-0f4r.onrender.com（Render free tier，refactor 分支自動部署）

## 啟動方式

```bash
npm install
npm start          # https://localhost:3001（自動 HTTPS via selfsigned 已移除，現為純 HTTP）
```

雙擊 `start.bat` 啟動，會自動開瀏覽器並在子視窗跑 `node mobile.js`（localtunnel，手機 GPS 用）。

Admin 帳密：見下方帳號說明。

## 帳號系統

| 帳號 | 密碼 | 行為 |
|---|---|---|
| `admin` | `admin` | 驗證 Basic Auth → 跳轉 `/admin.html` |
| `admindemo` | `admindemo` | 植入展示資料 → 跳轉 `/admin.html` |
| `demo` | `demo` | 植入展示資料 → 一般 App，panTo 燕巢校區 |
| `user` | `user` | 一般 App 登入 |

登入頁不顯示提示，系統在 `auth-submit` click handler 依 username 自動分流。

## 專案架構

```
road-refactor/
├── server.js              入口點（HTTP only，Render 提供 HTTPS）
├── mobile.js              localtunnel（手機 GPS 用，本機開發）
├── render.yaml            Render 部署設定
├── start.bat              Windows 快速啟動
├── src/
│   ├── app.js             Express 組裝、雙 DB 注入
│   ├── db/
│   │   ├── schema.js      CREATE TABLE + 種子資料（categories, badges, DEMO_HAZARDS）
│   │   └── index.js       openDb(file, opts), persist, seedDemo, helpers
│   ├── middleware/
│   │   ├── auth.js        makeRequireUser(realDb, demoDb) / makeRequireAdmin(...)
│   │   └── upload.js      multer（6MB, image only）
│   └── routes/
│       ├── auth.js        /api/auth/*（永遠用 realDb）
│       ├── hazards.js     /api/hazards/*（用 req.db）
│       ├── posts.js       /api/posts/:id/vote|comments（用 req.db）
│       ├── users.js       /api/state, /api/profile, /api/prefs, /api/badges（用 req.db）
│       └── admin.js       /api/admin/*（用 req.db，由 requireAdmin 注入）
├── public/
│   ├── index.html         前端 SPA 入口
│   ├── admin.html         後台管理介面（無 auth overlay，靠 sessionStorage adminCreds）
│   ├── css/app.css        深色主題 Design System
│   └── js/
│       ├── config.js      window.API_BASE（留空=相對路徑）
│       ├── api.js         typed fetch wrapper
│       ├── map.js         Leaflet 地圖 + marker（依嚴重度縮放 28-46px）
│       ├── community.js   社群貼文、附議、留言、類別標籤
│       ├── achievements.js 成就勳章 + 積分 + 進度條
│       └── profile.js     個人資料編輯（名稱/城市）、偏好 toggle
├── docs/
│   └── midterm-report-system-analysis.pdf
├── data.sqlite            真實 DB（gitignore）
├── data-demo.sqlite       展示 DB（gitignore，每次啟動重建）
└── .certs/               本機 HTTPS 憑證（gitignore，已棄用）
```

## 技術棧

- **後端**：Node.js + Express（CommonJS）
- **資料庫**：`sql.js`（in-memory SQLite + 檔案持久化）
- **前端**：純 HTML/CSS/JS，無框架，Leaflet 地圖
- **部署**：Render free tier（refactor branch）
- **PWA**：Service Worker（sw.js）+ Web App Manifest

## 雙資料庫架構

`server.js` 同時開啟兩個 DB：
- `realDb`（data.sqlite）：admin / user 帳號使用
- `demoDb`（data-demo.sqlite）：admindemo / demo 帳號使用，`withDemoData: true` 每次重建

`makeRequireUser(realDb, demoDb)` 在 session 驗證後，根據 username 是否為 `demo` 決定 `req.db`。
`makeRequireAdmin(realDb, realPersist, demoDb, demoPersist)` 根據帳號 `admindemo` 決定 `req.db`。

所有 route 用 `req.db` 和 `req.persist`，不持有 DB 閉包。

## 資料庫

`src/db/index.js` 負責：
- `openDb(file, { withDemoData })` — 建立/讀取 SQLite，跑 schema、migrate、seed
- `migrate()` — ALTER TABLE IF NOT EXIST column
- `seedCategories()` — 6 個缺陷分類
- `seedBadges()` — 6 種成就勳章
- `seedAdmin()` — admin / user / demo / admindemo 四組帳號
- `seedDemo()` — 每次執行都先刪除舊 demo 資料再重建（確保座標更新生效）
- `persist()` — 將 in-memory DB 寫入檔案

### 主要資料表

| 資料表 | 說明 |
|---|---|
| `users` | 使用者帳號（含 points） |
| `sessions` | 登入 session（7 天有效） |
| `user_profiles` | 個人資料（name, handle, city） |
| `user_profile_tags` | 最多 3 個標籤 |
| `user_prefs` | 偏好設定（nearbyNotify, autoGps, nightSaver） |
| `categories` | 缺陷分類（坑洞/標線/路口…）含 riskWeight, color |
| `hazards` | 危險點（含 severity 1-5, status, categoryId） |
| `hazard_photos` | 危險點附加照片 |
| `posts` | 社群回報貼文（含 pinned） |
| `post_votes` | 附議記錄（每人每貼一票） |
| `comments` | 留言 |
| `badges` | 成就勳章定義 |
| `user_badges` | 使用者已獲勳章 |
| `admins` | 管理員帳號（Basic Auth） |

## Demo 資料

20 筆危險點，錨點為高科大燕巢校區正門（22.7729°N, 120.4007°E，深中路 58 號）。
範圍約 ±0.004° 涵蓋校內各棟建築與深中路周邊地標。

panTo 目標：`(22.7735, 120.4010, zoom 16)`

## 重要常數

- `FIXED_VOTES_THRESHOLD = 5`：達 5 票附議計入「myFixed」統計
- Session 有效期：7 天
- 上傳圖片上限：6MB，僅 image/*
- 回報積分：+10；附議積分：+2
- Admin 初始密碼：`admin`（seedAdmin 每次啟動 upsert）

## 前端架構

SPA 無框架，script 載入順序：`api.js → map.js → community.js → achievements.js → profile.js → app.js`

`app.js` 為主控制器：
- `loadState()` → 呼叫 `initMap()`、渲染統計/篩選/卡片列表
- Boot 序列依 username 決定是否 panTo 或自動定位
- `window.STATE` 透過 `Object.defineProperty` getter 供其他模組存取

`map.js` 只負責 Leaflet，不知道 STATE。marker click 呼叫 `window.panTo`，選點模式呼叫 `window.onMapPick`。

`admin.html` 為獨立頁面，不共用 app.js。從 sessionStorage 讀取 `adminCreds`（Base64 Basic Auth），無憑證則跳回 `/`。

## 安全注意事項

- 所有 SQL 查詢使用 prepared statements
- Admin 使用 HTTP Basic Auth，Render 搭配 HTTPS
- Session token 儲存於 HttpOnly cookie
- 圖片上傳限制類型與大小

## Git

- `master`（local）→ 推至 remote `refactor` 分支
- Render 監聽 `refactor` 分支自動部署
- push 指令：`git push origin master:refactor`

## 分支說明

- `master`（remote）— 原始 V1（Android/Capacitor）
- `refactor`（remote，當前部署）— 重構版 Web SPA
