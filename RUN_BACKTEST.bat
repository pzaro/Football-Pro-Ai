@echo off
setlocal
cd /d "%~dp0"
where node >/dev/null 2>nul
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
echo APEX OMEGA backtest - running the current model on past matches...
echo Progress log: data\backtest\backtest.log
node backtest.js %*
if exist "data\backtest\BACKTEST_REPORT.html" if /I not "%~1"=="--quiet" start "" "data\backtest\BACKTEST_REPORT.html"
