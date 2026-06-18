@echo off
cd /d "%~dp0"

if not exist "node_modules" (
    npm install
)

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

node server.js
pause
