@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nie je nainstalovany. Instalujem ho, chvilu pockaj...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  echo.
  echo Hotovo. Zavri toto okno a dvojklikom spusti Spusti-Jarvis.bat este raz.
  pause
  exit /b
)
start "Jarvis pomocnik" /min node helper\server.js
exit /b
