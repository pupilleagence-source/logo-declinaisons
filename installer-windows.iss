; Script Inno Setup pour Logo Déclinaisons
; Plugin Adobe Illustrator CEP

#define MyAppName "Logo Déclinaisons"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Votre Nom"
#define MyAppURL "https://votre-site.com"
#define MyAppExeName "Logo Déclinaisons"
#define ExtensionFolder "logo-declinaisons"

[Setup]
; Informations de base
AppId={{B4F5E2A1-8C3D-4F9E-A7B2-1D6C8E9F0A3B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={userappdata}\Adobe\CEP\extensions\{#ExtensionFolder}
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=.\dist
OutputBaseFilename=LogoDeclinaisons-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\media\logo.svg

; Interface utilisateur
; TODO: Convertir logo.svg en .ico et décommenter ces lignes
; SetupIconFile=media\logo.ico
; WizardImageFile=media\logo.bmp
; WizardSmallImageFile=media\logo.bmp

; Langues
[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

; Message d'accueil personnalisé
[Messages]
french.WelcomeLabel2=Cet assistant va installer [name/ver] sur votre ordinateur.%n%nCe plugin vous permettra de générer automatiquement des déclinaisons de logos dans Adobe Illustrator.%n%nIl est recommandé de fermer Illustrator avant de continuer.

; Fichiers à installer
[Files]
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "CSXS\*"; DestDir: "{app}\CSXS"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "css\*"; DestDir: "{app}\css"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "js\*"; DestDir: "{app}\js"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "jsx\*"; DestDir: "{app}\jsx"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "lib\*"; DestDir: "{app}\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "media\*"; DestDir: "{app}\media"; Flags: ignoreversion recursesubdirs createallsubdirs
; Exclure les fichiers inutiles
; .git, .debug, package.json, etc. ne sont pas inclus

; Instructions post-installation
[Run]
Filename: "{app}\README.txt"; Description: "Voir les instructions d'utilisation"; Flags: postinstall shellexec skipifsilent unchecked

; Création d'un fichier README
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ReadmeText: TStringList;
  ReadmePath: String;
begin
  if CurStep = ssPostInstall then
  begin
    ReadmeText := TStringList.Create;
    try
      ReadmeText.Add('===========================================');
      ReadmeText.Add('  Logo Déclinaisons - Plugin Adobe Illustrator');
      ReadmeText.Add('  Version ' + ExpandConstant('{#MyAppVersion}'));
      ReadmeText.Add('===========================================');
      ReadmeText.Add('');
      ReadmeText.Add('INSTALLATION RÉUSSIE !');
      ReadmeText.Add('');
      ReadmeText.Add('Le plugin a été installé dans :');
      ReadmeText.Add(ExpandConstant('{app}'));
      ReadmeText.Add('');
      ReadmeText.Add('COMMENT UTILISER LE PLUGIN :');
      ReadmeText.Add('');
      ReadmeText.Add('1. Ouvrez Adobe Illustrator');
      ReadmeText.Add('2. Allez dans : Fenêtre > Extensions > Logo Déclinaisons');
      ReadmeText.Add('3. Le panneau du plugin s''ouvrira sur le côté');
      ReadmeText.Add('');
      ReadmeText.Add('SUPPORT :');
      ReadmeText.Add('Pour toute question ou problème :');
      ReadmeText.Add('Email : support@votre-site.com');
      ReadmeText.Add('Site : ' + ExpandConstant('{#MyAppURL}'));
      ReadmeText.Add('');
      ReadmeText.Add('DÉSINSTALLATION :');
      ReadmeText.Add('Utilisez "Ajout/Suppression de programmes" dans Windows');
      ReadmeText.Add('ou lancez le désinstallateur depuis le dossier d''installation.');
      ReadmeText.Add('');

      ReadmePath := ExpandConstant('{app}\README.txt');
      ReadmeText.SaveToFile(ReadmePath);
    finally
      ReadmeText.Free;
    end;
  end;
end;

[Registry]
; Active automatiquement le mode debug CEP pour toutes les versions
Root: HKCU; Subkey: "Software\Adobe\CSXS.9"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: createvalueifdoesntexist
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: createvalueifdoesntexist
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: createvalueifdoesntexist
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: createvalueifdoesntexist

[UninstallDelete]
Type: filesandordirs; Name: "{app}"