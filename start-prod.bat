@echo off
title Multilevel Mock - Production Servers
echo ========================================
echo  Starting Production Servers
echo ========================================
echo.
echo NOTE: Make sure you have already built the app with:
echo       npm run build
echo.

:: Start Whisper Server in a new window
echo [1/3] Starting Whisper Server (prod)...
start /min "Whisper Server (Prod)" cmd /k "cd /d %~dp0whisper-server && python main.py"

:: Wait a moment for Whisper to initialize
timeout /t 2 /nobreak > nul

:: Start Next.js Production Server in a new window
echo [2/3] Starting Next.js Production Server...
start /min "Next.js Prod Server" cmd /k "cd /d %~dp0 && npm run start"

:: Start ngrok last (exposes port 3000)
echo [3/3] Starting ngrok tunnel...
start "ngrok" cmd /k "ngrok http 3000"

:: Open ngrok web UI
start "ngrok UI" "http://127.0.0.1:4040"

echo.
echo ========================================
echo  All production servers started!
echo ========================================
echo.
echo  - Whisper Server: http://127.0.0.1:8659
echo  - Next.js App:    http://localhost:3000
echo  - ngrok:          http://127.0.0.1:4040
echo.
echo Close this window or press any key to exit.
pause > nul
