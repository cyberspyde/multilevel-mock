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
echo [1/2] Starting Whisper Server (prod)...
start "Whisper Server (Prod)" cmd /k "cd /d %~dp0whisper-server && python main.py"

:: Wait a moment for Whisper to initialize
timeout /t 2 /nobreak > nul

:: Start Next.js Production Server in a new window
echo [2/2] Starting Next.js Production Server...
start "Next.js Prod Server" cmd /k "cd /d %~dp0 && npm run start"

echo.
echo ========================================
echo  All production servers started!
echo ========================================
echo.
echo  - Whisper Server: http://127.0.0.1:8000
echo  - Next.js App:    http://localhost:3000
echo.
echo Close this window or press any key to exit.
pause > nul
