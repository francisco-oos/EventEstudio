@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title EventStudio - Prueba local y movil

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo No se encontro Node.js.
  echo Instala Node.js 20 LTS o superior y vuelve a ejecutar INICIAR.bat.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node scripts\iniciar-local.js
set "EVENTSTUDIO_EXIT=%ERRORLEVEL%"

if not "%EVENTSTUDIO_EXIT%"=="0" (
  echo.
  echo EventStudio no pudo iniciar. Conserva el primer error mostrado arriba.
  pause
)

exit /b %EVENTSTUDIO_EXIT%
