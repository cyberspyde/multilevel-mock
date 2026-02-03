@echo off
title Multilevel Mock - Development Servers
echo ========================================
echo  Starting Development Servers
echo ========================================
echo.

:: Start Whisper Server in a new window
echo [1/3] Starting Whisper Server (dev)...
start /min "Whisper Server (Dev)" cmd /k "cd /d %~dp0whisper-server && python main.py"

:: Wait a moment for Whisper to initialize
timeout /t 2 /nobreak > nul

:: Start Next.js Dev Server in a new window
echo [2/3] Starting Next.js Dev Server...
start /min "Next.js Dev Server" cmd /k "cd /d %~dp0 && npm run dev"

:: Start ngrok last (exposes port 3000)
echo [3/3] Starting ngrok tunnel...
start "ngrok" powershell -NoExit -Command "ngrok http 3000"

:: Open ngrok web UI
start "ngrok UI" "http://127.0.0.1:4040"

echo.
echo ========================================
echo  All development servers started!
echo ========================================
echo.
echo  - Whisper Server: http://127.0.0.1:8659
echo  - Next.js App:    http://localhost:9586
echo  - ngrok:          http://127.0.0.1:4040
echo  - Prisma Studio:  http://localhost:5555
echo.
echo Close this window or press any key to exit.
pause > nul
