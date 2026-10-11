@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === APEX OMEGA: επανεκκίνηση μηχανής ===
echo Τερματισμός της παλιάς μηχανής (θύρα 8787)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:8787" ^| findstr LISTENING') do taskkill /PID %%a /T /F
timeout /t 3 /nobreak >nul
if exist "data\apex.pid" del /q "data\apex.pid" >nul 2>nul
call START_BACKGROUND.bat
echo.
pause
