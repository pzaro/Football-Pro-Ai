@echo off
setlocal
cd /d "%~dp0"
if not exist "data\apex.pid" (
  echo No active APEX PID file found.
  exit /b 0
)
set /p PID=<"data\apex.pid"
echo Stopping APEX Background Engine PID %PID%...
taskkill /PID %PID% /T >nul 2>nul
timeout /t 1 /nobreak >nul
if exist "data\apex.pid" del /q "data\apex.pid" >nul 2>nul
echo Stopped.
