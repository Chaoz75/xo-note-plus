@echo off
echo =============================================
echo    XO NOTE+ Setup — by XO SYSTEMS
echo =============================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not installed.
    echo     Download it from: https://nodejs.org
    echo     Install the LTS version, then re-run this script.
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

:: Install dependencies
echo [*] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [!] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed.
echo.

echo =============================================
echo    Setup complete! To run XO NOTE+:
echo.
echo    npm start
echo.
echo    To build the installer:
echo    npm run build
echo =============================================
pause
