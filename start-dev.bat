@echo off
title Multilevel Mock - Development Servers
echo ========================================
echo  Starting Development Servers
echo ========================================
echo.

:: Start Whisper Server in a new window
echo [1/2] Starting Whisper Server (dev)...
start "Whisper Server (Dev)" cmd /k "cd /d %~dp0whisper-server && python main.py"

:: Wait a moment for Whisper to initialize
timeout /t 2 /nobreak > nul

:: Start Next.js Dev Server in a new window
echo [2/2] Starting Next.js Dev Server...
start "Next.js Dev Server" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo  All development servers started!
echo ========================================
echo.
echo  - Whisper Server: http://127.0.0.1:8659
echo  - Next.js App:    http://localhost:9586
echo  - Prisma Studio:  http://localhost:5555
echo.
echo Close this window or press any key to exit.
pause > nul
