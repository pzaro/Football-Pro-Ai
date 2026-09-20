@echo off
setlocal
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\APEX_OMEGA_Background.cmd"
if exist "%TARGET%" del /q "%TARGET%"
echo APEX automatic startup removed.
pause
