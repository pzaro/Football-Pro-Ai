@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
if not exist data mkdir data
if exist "data\apex.pid" (
  set /p OLD_PID=<"data\apex.pid"
  tasklist /FI "PID eq %OLD_PID%" 2>nul | find "%OLD_PID%" >nul
  if not errorlevel 1 (
    echo APEX Background Engine is already running. PID %OLD_PID%
    exit /b 0
  )
  del /q "data\apex.pid" >nul 2>nul
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  pause
  exit /b 1
)
if not exist "node_modules\playwright-core" (
  echo Dependencies are missing. Run INSTALL_WINDOWS.bat first.
  pause
  exit /b 1
)
echo Starting APEX OMEGA v6.0 in the background...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wd=(Resolve-Path '.').Path; Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $wd -WindowStyle Hidden"
timeout /t 3 /nobreak >nul
if exist "data\apex.pid" (
  set /p NEW_PID=<"data\apex.pid"
  echo Background Engine started. PID %NEW_PID%
  echo Dashboard: http://127.0.0.1:8787
) else (
  echo The engine did not create a PID file. Check logs\apex-background.log
  pause
  exit /b 1
)
