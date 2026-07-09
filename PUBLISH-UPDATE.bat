@echo off
setlocal enabledelayedexpansion
echo =============================================
echo    Publishing XO NOTE+ Update to GitHub
echo =============================================
echo.
echo Before running this:
echo   1. Bump the version number in package.json
echo   2. Add a new entry to src\renderer\utils\changelog.js
echo   3. Make sure GH_TOKEN is set (this window needs to see it --
echo      if you just set it for the first time, close this window
echo      and double-click this file again from a fresh one)
echo.
echo This is the one-stop tool for shipping an update -- it builds the
echo installer, uploads it to GitHub, merges it back together
echo automatically if GitHub splits it into more than one draft, and
echo fills in the release notes from your changelog.js entry. You
echo should never need to type "npm run publish" by hand -- just use
echo this file every time.
echo.
echo This publishes LIVE immediately -- there is no draft/review step
echo anymore. The moment this finishes, anyone with GH_TOKEN access
echo (and, once the repo is public, everyone) can see and download
echo this release, and the app's auto-update check will start
echo offering it right away. Make sure the version bump and changelog
echo entry are exactly what you want BEFORE running this.
echo.
pause

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set VERSION=%%v
echo.
echo Tagging this release as v%VERSION% in git first (helps GitHub
echo avoid splitting your release files across multiple drafts)...
git tag v%VERSION% 2>nul
git push origin v%VERSION% 2>nul
echo (If you saw a "tag already exists" message above, that's fine --
echo  it just means this version was already tagged before.)
echo.

call npm run publish

echo.
echo Checking whether GitHub split this release into more than one
echo draft, and merging them back into one if it did...
node scripts\merge-split-release.js

echo.
echo Filling in the release notes on GitHub from your changelog.js entry...
node scripts\set-release-notes.js

echo.
echo =============================================
echo    Done! v%VERSION% is now LIVE on GitHub -- no extra click
echo    needed. Go check the Releases tab if you want to confirm.
echo    (If you ever see it split across more than one release,
echo    that means the auto-merge above hit an error -- drag the
echo    missing file(s) into the published one, then delete the
echo    leftover draft yourself.)
echo =============================================
pause
