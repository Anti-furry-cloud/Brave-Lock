@echo off
title Brave Lock - Install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native\Install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Check the error above.
  pause
  exit /b 1
)
pause
