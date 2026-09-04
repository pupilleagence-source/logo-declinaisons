@echo off
echo ================================================
echo   Installation Logo Declinaisons
echo ================================================
echo.

set "TARGET=%APPDATA%\Adobe\CEP\extensions\logo-declinaisons"

echo Dossier cible : %TARGET%
echo.

if exist "%TARGET%" (
    echo Le plugin existe deja, mise a jour...
    echo.
)

:: Creer le dossier cible
if not exist "%TARGET%" mkdir "%TARGET%"

:: Copier les fichiers
echo Copie des fichiers...
xcopy /E /Y /Q "index.html" "%TARGET%\" >nul 2>&1
xcopy /E /Y /Q "CSXS" "%TARGET%\CSXS\" >nul 2>&1
xcopy /E /Y /Q "css" "%TARGET%\css\" >nul 2>&1
xcopy /E /Y /Q "js" "%TARGET%\js\" >nul 2>&1
xcopy /E /Y /Q "jsx" "%TARGET%\jsx\" >nul 2>&1
xcopy /E /Y /Q "lib" "%TARGET%\lib\" >nul 2>&1
xcopy /E /Y /Q "media" "%TARGET%\media\" >nul 2>&1
xcopy /E /Y /Q "templates" "%TARGET%\templates\" >nul 2>&1

:: Activer le mode debug CEP (necessaire pour les extensions non signees)
echo Activation du mode debug CEP...
:: CSXS.13 = Illustrator 2024, CSXS.14 = Illustrator 2026+ : indispensables, sinon
:: le panneau ne se charge pas du tout sur les versions recentes.
reg add "HKCU\Software\Adobe\CSXS.14" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.13" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

echo.
echo ================================================
echo   Installation terminee !
echo   Redemarrez Illustrator pour voir le plugin.
echo ================================================
echo.
pause
