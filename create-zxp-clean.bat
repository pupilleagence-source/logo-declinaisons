@echo off
echo ================================================
echo   Creation du package ZXP (version propre)
echo   Logo Declinaisons v1.0.0
echo ================================================
echo.

REM Definir les chemins
set CERT=certificate.p12
set PASSWORD=logodeclinaisons2024
set OUTPUT=dist\LogoDeclinaisons-1.0.0.zxp
set TEMP_DIR=temp-zxp
set TIMESTAMP=http://time.certum.pl/

REM Creer les dossiers s'ils n'existent pas
if not exist dist mkdir dist

REM Supprimer le dossier temporaire s'il existe
if exist %TEMP_DIR% rmdir /s /q %TEMP_DIR%

REM 1. Creer le certificat auto-signe (si n'existe pas)
if not exist %CERT% (
    echo.
    echo Creation du certificat auto-signe...
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

REM 2. Copier UNIQUEMENT les fichiers necessaires dans un dossier temporaire
echo.
echo Preparation des fichiers pour le ZXP...

mkdir %TEMP_DIR%

REM Copier le fichier index.html
copy index.html %TEMP_DIR%\ >nul
echo   OK - index.html

REM Copier les dossiers necessaires
xcopy /E /I /Q CSXS %TEMP_DIR%\CSXS >nul
echo   OK - CSXS\

xcopy /E /I /Q css %TEMP_DIR%\css >nul
echo   OK - css\

xcopy /E /I /Q js %TEMP_DIR%\js >nul
echo   OK - js\

xcopy /E /I /Q jsx %TEMP_DIR%\jsx >nul
echo   OK - jsx\

xcopy /E /I /Q lib %TEMP_DIR%\lib >nul
echo   OK - lib\

xcopy /E /I /Q media %TEMP_DIR%\media >nul
echo   OK - media\

REM 3. Creer le package ZXP a partir du dossier temporaire
echo.
echo Creation du package ZXP...
ZXPSignCmd.exe -sign "%TEMP_DIR%" "%OUTPUT%" "%CERT%" "%PASSWORD%" -tsa %TIMESTAMP%

if errorlevel 1 (
    echo.
    echo ERREUR: Impossible de creer le ZXP
    rmdir /s /q %TEMP_DIR%
    pause
    exit /b 1
)

REM 4. Nettoyer le dossier temporaire
rmdir /s /q %TEMP_DIR%

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
