@echo off
title Road Hazard Map

cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

:: Kill existing server on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo   admin     / admin     - Admin Panel
echo   admindemo / admindemo - Demo Admin
echo   demo      / demo      - Demo Mode
echo   user      / user      - User Mode
echo.

:: Open browser after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

:: Open mobile tunnel in a separate window (waits 4s for server to be ready first)
start "Mobile GPS Tunnel" cmd /k "cd /d "%~dp0" && timeout /t 4 /nobreak >nul && node mobile.js"

:: Run server in THIS window (stays open)
set PORT=3001
node server.js

pause
