@echo off
cd /d "%~dp0"
rem Runs the backtest every night at 03:10 until all history is processed (resumes where it stopped).
schtasks /Create /F /SC DAILY /ST 03:10 /TN "APEX OMEGA Backtest" /TR "\"%~dp0RUN_BACKTEST.bat\" --quiet"
if errorlevel 1 (echo Could not create the scheduled task.) else (echo Nightly backtest scheduled at 03:10. Remove with: schtasks /Delete /TN "APEX OMEGA Backtest" /F)
pause
