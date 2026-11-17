@echo off
rem Double-click to build and open the WWE Universe Tracker.
rem Always uses http://localhost:4173. Your data is stored per address, so keep using this launcher.
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\nodejs-portable\node-v26.13.1-win-x64;%PATH%"
where node >nul 2>nul || (echo Node.js was not found. See README.md for setup. & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)
echo Building the latest version...
call npm run build || (pause & exit /b 1)
echo.
echo WWE Universe Tracker is running at http://localhost:4173
echo Keep this window open while you use the app. Close it to stop.
call npx vite preview --port 4173 --strictPort --open
