@echo off
echo ================================================
echo   Creation du package ZXP (version simple)
echo   Logo Declinaisons v1.0.0
echo   SANS TIMESTAMP (plus fiable)
echo ================================================
echo.

REM Definir les chemins
set CERT=certificate.p12
set PASSWORD=logodeclinaisons2024
set OUTPUT=dist\LogoDeclinaisons-1.0.0.zxp
set TEMP_DIR=temp-zxp

REM Creer les dossiers s'ils n'existent pas
if not exist dist mkdir dist

REM Supprimer le dossier temporaire et le ZXP existant
if exist %TEMP_DIR% rmdir /s /q %TEMP_DIR%
if exist %OUTPUT% del %OUTPUT%

REM 1. Creer le certificat auto-signe (si n'existe pas)
if not exist %CERT% (
    echo.
    echo Creation du certificat auto-signe...
    ZXPSignCmd.exe -selfSignedCert FR "IDF" "Logo Declinaisons" "LogoDeclinaisons" "%PASSWORD%" "%CERT%"
    if errorlevel 1 (
        echo ERREUR: Impossible de creer le certificat
        pause
        exit /b 1
    )
    echo OK - Certificat cree
) else (
    echo OK - Certificat existant trouve
)

REM 2. Copier UNIQUEMENT les fichiers necessaires
echo.
echo Preparation des fichiers...

mkdir %TEMP_DIR%

REM Verifier que les fichiers existent
if not exist index.html (
    echo ERREUR: index.html manquant
    pause
    exit /b 1
)

if not exist CSXS\manifest.xml (
    echo ERREUR: CSXS\manifest.xml manquant
    pause
    exit /b 1
)

REM Copier les fichiers
copy index.html %TEMP_DIR%\ >nul
xcopy /E /I /Q CSXS %TEMP_DIR%\CSXS >nul
xcopy /E /I /Q css %TEMP_DIR%\css >nul
xcopy /E /I /Q js %TEMP_DIR%\js >nul
xcopy /E /I /Q jsx %TEMP_DIR%\jsx >nul
xcopy /E /I /Q lib %TEMP_DIR%\lib >nul
xcopy /E /I /Q media %TEMP_DIR%\media >nul

echo OK - Fichiers copies

REM 3. Creer le package ZXP (SANS TIMESTAMP)
echo.
echo Creation du ZXP...
echo.

ZXPSignCmd.exe -sign "%TEMP_DIR%" "%OUTPUT%" "%CERT%" "%PASSWORD%"

if errorlevel 1 (
    echo.
    echo ERREUR: Impossible de creer le ZXP
    echo.
    echo Verifiez que ZXPSignCmd.exe est present
    rmdir /s /q %TEMP_DIR%
    pause
    exit /b 1
)

REM 4. Verification
echo.
echo Verification du ZXP cree...
ZXPSignCmd.exe -verify "%OUTPUT%"

REM 5. Nettoyer
rmdir /s /q %TEMP_DIR%

echo.
echo ================================================
echo   ZXP cree avec succes !
echo ================================================
echo.
echo Fichier: %OUTPUT%
dir "%OUTPUT%"
echo.
echo IMPORTANT: Ce ZXP n'a PAS de timestamp
echo C'est volontaire pour assurer la compatibilite maximale
echo.
pause
