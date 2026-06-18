# 路口排雷 (Lukou Pailei)
        
道路危險回報平台，讓社群共同標記並追蹤路口危險點。  
系統分析與設計 第六組（蕭其睿、李秉威、黃紹軒、趙姵筑）

## 啟動方式

```bash
npm install
npm start          # http://localhost:3000
PORT=8080 npm start  # 指定 port
```

Admin 帳密：`admin` / `admin1234`（可用 `ADMIN_PASSWORD` 環境變數覆寫初始密碼）

## 專案架構

```
road/
├── server.js              # 入口點（只負責 listen）
├── src/
│   ├── app.js             # Express 組裝、route 掛載
│   ├── db/
│   │   ├── schema.js      # CREATE TABLE + 種子資料（categories, badges）
│   │   └── index.js       # openDb, persist, rowsToObjects, hashPassword, randomId
│   ├── middleware/
│   │   ├── auth.js        # makeRequireUser / makeRequireAdmin（prepared statements）
│   │   └── upload.js      # multer（6MB, image only）
│   └── routes/
│       ├── auth.js        # /api/auth/*
│       ├── hazards.js     # /api/hazards/*, /api/hazards/report
│       ├── posts.js       # /api/posts/:id/vote|comments
│       ├── users.js       # /api/state, /api/profile, /api/prefs, /api/badges
│       └── admin.js       # /api/admin/*
├── public/
│   ├── index.html         # 前端 SPA 入口
│   ├── admin.html         # 後台管理介面
│   ├── css/app.css        # 深色主題 Design System（CSS 變數）
│   └── js/
│       ├── config.js      # window.API_BASE（留空=相對路徑，區網直連不需改）
│       ├── api.js         # typed fetch wrapper（所有 API call 走這裡）
│       ├── map.js         # Leaflet 地圖 + marker 管理
│       ├── community.js   # 社群貼文、附議、留言
│       ├── achievements.js# 成就勳章 + 積分
│       └── profile.js     # 個人資料、偏好 toggle
├── README.md              # 完整使用說明
├── data.sqlite            # SQLite（gitignore）
└── uploads/               # 上傳圖片（gitignore）
```

## 技術棧

- **後端**: Node.js + Express（CommonJS）
- **資料庫**: `sql.js`（in-memory SQLite + 檔案持久化至 data.sqlite）
- **前端**: 純 HTML/CSS/JS，無框架，Leaflet 地圖
- **PWA**: Service Worker（sw.js）+ Web App Manifest

## 資料庫

`src/db/index.js` 負責：
- 執行 `SCHEMA_SQL`（CREATE TABLE IF NOT EXISTS）
- `migrate()` — 補欄位（ALTER TABLE IF NOT EXIST column）
- `seedCategories()` — 6 個缺陷分類
- `seedBadges()` — 6 種成就勳章
- `seedAdmin()` — admin 帳號
- `persist()` — 將 in-memory DB 寫入 data.sqlite

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
| `posts` | 社群回報貼文 |
| `post_votes` | 附議記錄（每人每貼一票） |
| `comments` | 留言 |
| `badges` | 成就勳章定義 |
| `user_badges` | 使用者已獲勳章 |
| `admins` | 管理員帳號（Basic Auth） |

## 重要常數

- `FIXED_VOTES_THRESHOLD = 5`：達 5 票附議計入「myFixed」統計
- Session 有效期：7 天
- 上傳圖片上限：6MB，僅 image/*
- 回報積分：+10；附議積分：+2
- Admin 初始密碼：`admin1234`

## 區網部署

`npm start` 啟動後會列出所有網路介面的 IP，選 Wi-Fi 或乙太網路那行給手機輸入。  
若筆電有跑 WireGuard 等 VPN，介面清單會同時出現 VPN IP，忽略即可。

## 展示模式

```bash
npm run demo   # 啟動時自動植入測試資料（高科大燕巢校區附近 20 筆）
npm start      # 一般模式（不植入）
```

**展示帳號**：`admin` / `admin`（伺服器啟動時自動建立，存於 `users` 表）

兩個觸發入口（均呼叫 `POST /api/demo/seed`，idempotent）：
- 登入頁：🎬 展示模式 → 自動種資料 + 以 `admin`/`admin` 登入
- 個人設定頁（登入後）：展示模式區塊 → 🎬 載入展示資料，地圖飛至燕巢校區

## 定位限制

HTTP 區網連線下（非 localhost），手機瀏覽器會封鎖 GPS 自動定位。  
解法：回報表單內若 GPS 失敗，會出現「在地圖點選位置」按鈕，點選後在地圖上點一下即可手動設定回報座標。

## 分支說明

- `master` — 原始 V1
- `refactor` — 重構版（當前開發分支）

## 安全注意事項

- 所有 SQL 查詢使用 prepared statements（`db.prepare().run([params])`）
- Admin 使用 HTTP Basic Auth，正式環境需搭配 HTTPS
- Session token 儲存於 HttpOnly cookie
- 圖片上傳限制類型與大小，存放於 uploads/（gitignore）
