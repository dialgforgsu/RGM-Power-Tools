; Inno Setup script for the RGM Power Tools dashboard.
;
; Produces packaging/dist/monitor-dashboard-setup.exe — a simple install wizard
; that installs the self-contained monitor-dashboard.exe, adds Start Menu and
; (optional) desktop shortcuts, and offers to launch the dashboard on finish.
;
; Build with the Inno Setup compiler (ISCC.exe), which build-all.mjs invokes:
;     "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" packaging\installer.iss
; Get Inno Setup from https://jrsoftware.org/isdl.php (or `winget install
; JRSoftware.InnoSetup`). Requires that packaging\dist\monitor-dashboard.exe
; already exists (run build-exe.mjs first).

#define AppName "RGM Power Tools Dashboard"
#define AppVersion "0.1.0"
#define AppPublisher "RGM Power Tools"
#define AppExeName "monitor-dashboard.exe"
#define AppUrl "https://github.com/red-gate/rgm-power-tools"

[Setup]
AppId={{8B2F1A6C-3D4E-4F5A-9B0C-1D2E3F4A5B6C}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
DefaultDirName={autopf}\RGM Power Tools
DefaultGroupName=RGM Power Tools
; Per-user install by default needs no admin; flip to admin for machine-wide.
PrivilegesRequiredOverridesAllowed=dialog commandline
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE
OutputDir=dist
OutputBaseFilename=monitor-dashboard-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu: launches on loopback with no-auth and opens the browser.
Name: "{group}\RGM Dashboard"; Filename: "{app}\{#AppExeName}"; \
  Comment: "Start the RGM Power Tools dashboard and open it in your browser"
Name: "{group}\Uninstall RGM Power Tools Dashboard"; Filename: "{uninstallexe}"
Name: "{autodesktop}\RGM Dashboard"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch the dashboard now"; \
  Flags: nowait postinstall skipifsilent
