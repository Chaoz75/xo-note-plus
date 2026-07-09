@echo off
echo =============================================
echo    Building XO NOTE+ Installer
echo =============================================
echo.
echo This will create an installable .exe in the "dist" folder.
echo.
call npm run build
echo.
echo =============================================
echo    Done! Check the "dist" folder for your installer.
echo =============================================
pause
