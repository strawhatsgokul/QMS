; QMS Server Setup — Inno Setup Script
; Compile: iscc qms-server-setup.iss
; Thin wrapper that clones the repo + runs deploy-nssm.ps1

#define MyAppName "QMS Dashboard Server"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "QServe IT Solutions"
#define MyAppURL "https://github.com/strawhatsgokul/QMS"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName=C:\QMS
OutputDir=..\dist\installers
OutputBaseFilename=QMS-Server-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
DisableWelcomePage=no
WizardStyle=modern
SetupIconFile=resources\qms.ico
Uninstallable=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\deploy-nssm.ps1"; DestDir: "{tmp}\qms"; Flags: ignoreversion

[Run]
; Step 1: Clone repo into {app}\QMS if not already present
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""if (-not (Test-Path '{app}\QMS\.git')) {{ & git clone --branch Developement https://github.com/strawhatsgokul/QMS.git '{app}\QMS' 2>&1 | Out-Host }} else {{ Set-Location '{app}\QMS'; & git pull 2>&1 | Out-Host }}"""; \
  StatusMsg: "Cloning repository to {app}\QMS..."; \
  Flags: shellexec waituntilterminated;

; Step 2: Copy latest deploy-nssm.ps1 into the cloned repo, then run it
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Copy-Item '{tmp}\qms\deploy-nssm.ps1' '{app}\QMS\deploy-nssm.ps1' -Force; Set-Location '{app}\QMS'; & '.\deploy-nssm.ps1'; Write-Host '`n[Setup] Deployment complete. Press any key to exit...'; $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"""; \
  StatusMsg: "Deploying QMS Dashboard (PowerShell window shows progress)..."; \
  Flags: shellexec waituntilterminated;

[Code]
function IsInstalled(ExeName: string): Boolean;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/c ' + ExeName + ' --version > nul 2>&1', '',
    0, ewWaitUntilTerminated, ResultCode);
  Result := ResultCode = 0;
end;

function InitializeSetup: Boolean;
var
  Missing: string;
begin
  Missing := '';
  if not IsInstalled('node') then Missing := Missing + #13 + '  - Node.js';
  if not IsInstalled('git') then Missing := Missing + #13 + '  - Git';
  if not IsInstalled('nssm') then Missing := Missing + #13 + '  - NSSM';
  if Missing <> '' then
  begin
    MsgBox('Missing prerequisites:' + Missing + #13#13 +
      'Install missing items, then re-run this installer.', mbError, MB_OK);
    Result := False;
  end
  else
    Result := True;
end;
