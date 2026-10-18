@echo off
title Brave Lock - Uninstall
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native\Uninstall.ps1"
if errorlevel 1 (
  echo.
  echo Uninstall failed. Check the error above.
  pause
  exit /b 1
)
pause
