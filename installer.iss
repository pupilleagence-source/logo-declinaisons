; Inno Setup script - Logo Declinaisons
; Cree un installeur .exe pour Adobe Illustrator CEP extension

#define MyAppName "Logo Declinaisons"
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "Pupille Studio"
#define MyAppURL "https://logodeclinaisons.com"
#define MyExtensionId "logo-declinaisons"

[Setup]
AppId={{A8F7D3E2-9B4C-4A5E-8D1F-7C3B9E2A6F4D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installer

; Installation au niveau utilisateur (pas besoin admin)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Dossier CEP Adobe (AppData)
DefaultDirName={userappdata}\Adobe\CEP\extensions\{#MyExtensionId}
DisableDirPage=yes
DisableProgramGroupPage=yes

; Desinstalleur stocke ailleurs pour ne pas polluer le dossier extension
UninstallFilesDir={userappdata}\{#MyAppName}\uninstall

; Licence / readme (optionnel)
; LicenseFile=LICENSE.txt

; Apparence
WizardStyle=modern
; SetupIconFile=media\logo.ico
DisableWelcomePage=no
ShowLanguageDialog=no

; Sortie
OutputDir=dist
OutputBaseFilename=LogoDeclinaisons-{#MyAppVersion}-windows
Compression=lzma2/ultra64
SolidCompression=yes

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Files]
; Tout le contenu de l'extension
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "CSXS\*"; DestDir: "{app}\CSXS"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "css\*"; DestDir: "{app}\css"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "js\*"; DestDir: "{app}\js"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "jsx\*"; DestDir: "{app}\jsx"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "lib\*"; DestDir: "{app}\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "media\*"; DestDir: "{app}\media"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "templates\template-1.idml"; DestDir: "{app}\templates"; Flags: ignoreversion skipifsourcedoesntexist
Source: "templates\template-2.idml"; DestDir: "{app}\templates"; Flags: ignoreversion skipifsourcedoesntexist
Source: "templates\mockups\*.psd"; DestDir: "{app}\templates\mockups"; Flags: ignoreversion skipifsourcedoesntexist

[Registry]
; Activer PlayerDebugMode pour toutes les versions CEP (9 a 12)
Root: HKCU; Subkey: "Software\Adobe\CSXS.9"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue

[Messages]
french.SetupAppTitle=Installation de {#MyAppName}
french.SetupWindowTitle=Installation de {#MyAppName}

[CustomMessages]
french.FinishedLabel=L'installation de {#MyAppName} est terminee.%n%nRedemarrez Adobe Illustrator, puis allez dans :%nFenetre > Extensions > Logo Declinaisons

[Code]
function NeedsAddPath(Param: string): boolean;
begin
  Result := True;
end;
