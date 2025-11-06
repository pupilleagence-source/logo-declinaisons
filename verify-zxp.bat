@echo off
echo ================================================
echo   Verification du ZXP
echo ================================================
echo.

set ZXP_FILE=dist\LogoDeclinaisons-1.0.0.zxp

if not exist %ZXP_FILE% (
    echo ERREUR: Le fichier ZXP n'existe pas
    echo %ZXP_FILE%
    pause
    exit /b 1
)

echo Verification du ZXP avec ZXPSignCmd...
echo.
ZXPSignCmd.exe -verify %ZXP_FILE%

echo.
echo ================================================
pause
