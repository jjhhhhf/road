@echo off
chcp 65001 >nul
title 路口排雷

cd /d "%~dp0"

if not exist "node_modules" (
    echo 安裝相依套件中...
    npm install
)

echo.
echo  ╔══════════════════════════════════╗
echo  ║        路口排雷  啟動中          ║
echo  ╠══════════════════════════════════╣
echo  ║  http://localhost:3001           ║
echo  ╠══════════════════════════════════╣
echo  ║  admin     / admin    → 管理後台 ║
echo  ║  admindemo / admindemo → 展示後台 ║
echo  ║  demo      / demo     → 展示模式 ║
echo  ║  user      / user     → 一般模式 ║
echo  ╚══════════════════════════════════╝
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"

set PORT=3001
node server.js

pause
