@echo off
setlocal
cd /d "%~dp0" 2>nul
rem Publishes the latest APEX OMEGA changes to GitHub (main) -> Vercel. Never adds data\, .env or databases.
where git >/dev/null 2>nul
if errorlevel 1 (echo Git is not installed or not in PATH.& pause & exit /b 1)
echo === Changes ===
git status --short
git add -- stats.js index.html style.css leagues.js server.js background-bridge.js IMPROVEMENT_LOG.md backtest.js RUN_BACKTEST.bat INSTALL_BACKTEST_NIGHTLY.bat PUBLISH_CHANGES.bat 2>nul
git diff --cached --quiet
if not errorlevel 1 (echo Nothing new to publish.& pause & exit /b 0)
if exist "data\COMMIT_MESSAGE.txt" (git commit -F "data\COMMIT_MESSAGE.txt") else (git commit -m "APEX OMEGA: ενημέρωση από την καθημερινή βελτίωση")
if errorlevel 1 (echo Commit failed.& pause & exit /b 1)
git pull --rebase origin main
if errorlevel 1 (echo Pull failed - nothing was pushed. Resolve and run again.& pause & exit /b 1)
git push origin main
if errorlevel 1 (echo Push failed.& pause & exit /b 1)
if exist "data\COMMIT_MESSAGE.txt" del /q "data\COMMIT_MESSAGE.txt"
echo Published. Vercel will deploy automatically.
pause
