@echo off
echo ================================================
echo   Creation du package ZXP
echo   Logo Declinaisons v1.0.0
echo ================================================
echo.

REM Definir les chemins
set CERT=certificate.p12
set PASSWORD=logodeclinaisons2024
set OUTPUT=dist\LogoDeclinaisons-1.0.0.zxp
set TIMESTAMP=http://time.certum.pl/

REM Creer le dossier dist s'il n'existe pas
if not exist dist mkdir dist

REM 1. Creer le certificat auto-signe (si n'existe pas)
if not exist %CERT% (
    echo.
    echo Création du certificat auto-signe...
    ZXPSignCmd.exe -selfSignedCert FR "IDF" "Logo Declinaisons" "LogoDeclinaisons" "%PASSWORD%" "%CERT%"
    if errorlevel 1 (
        echo ERREUR: Impossible de creer le certificat
        echo.
        echo Assurez-vous que ZXPSignCmd.exe est dans ce dossier
        pause
        exit /b 1
    )
    echo OK - Certificat cree: %CERT%
) else (
    echo OK - Certificat existant trouve
)

REM 2. Creer le package ZXP
echo.
echo Creation du package ZXP...
ZXPSignCmd.exe -sign . "%OUTPUT%" "%CERT%" "%PASSWORD%" -tsa %TIMESTAMP%

if errorlevel 1 (
    echo.
    echo ERREUR: Impossible de creer le ZXP
    pause
    exit /b 1
)

echo.
echo ================================================
echo   ZXP cree avec succes !
echo ================================================
echo.
echo Fichier: %OUTPUT%
echo.
echo Ce fichier fonctionne sur Windows ET Mac
echo.
echo Installation pour vos utilisateurs:
echo 1. Telecharger ZXP Installer (aescripts.com/learn/zxp-installer)
echo 2. Glisser-deposer le fichier .zxp dedans
echo 3. Redemarrer Illustrator
echo.
pause
