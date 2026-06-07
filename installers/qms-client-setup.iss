; QMS Client Setup — Inno Setup Script
; Installs QMS Agent as a Windows service.
; Silent: QMS-Client-Setup.exe /ApiUrl=... /AgentKey=...

#define MyAppName "QMS Agent Client"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "QServe IT Solutions"
#define MyAppURL "https://github.com/strawhatsgokul/QMS"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={pf64}\QMS-Agent
OutputDir=..\dist\installers
OutputBaseFilename=QMS-Client-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
DisableProgramGroupPage=yes
WizardStyle=modern
SetupIconFile=resources\qms.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\qms-agent.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\dist\qms-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\deploy-agent.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""& '{app}\deploy-agent.ps1' -ApiUrl '{code:GetApiUrl}' -AgentKey '{code:GetAgentKey}'"""; \
  StatusMsg: "Configuring QMS Agent as a Windows service..."; \
  Flags: shellexec waituntilterminated;

[UninstallRun]
Filename: "nssm.exe"; Parameters: "stop QMS-Agent"; Flags: runhidden
Filename: "nssm.exe"; Parameters: "remove QMS-Agent confirm"; Flags: runhidden

[Code]
var
  ApiUrl: string;
  AgentKey: string;

function GetApiUrl(Param: string): string;
begin
  Result := ApiUrl;
end;

function GetAgentKey(Param: string): string;
begin
  Result := AgentKey;
end;

function InitializeSetup: Boolean;
var
  I: Integer;
  Param: string;
begin
  ApiUrl := '';
  AgentKey := '';

  for I := 1 to ParamCount do
  begin
    Param := ParamStr(I);
    if Copy(Param, 1, 9) = '/ApiUrl=' then
      ApiUrl := Copy(Param, 10, Length(Param) - 9);
    if Copy(Param, 1, 11) = '/AgentKey=' then
      AgentKey := Copy(Param, 12, Length(Param) - 11);
  end;

  // Prompt for missing values
  if ApiUrl = '' then
  begin
    ApiUrl := 'http://localhost:4000';
    if not InputQuery('QMS Agent Setup', 'Server API URL:', False, 0, ApiUrl) then
    begin
      Result := False;
      Exit;
    end;
  end;

  if AgentKey = '' then
  begin
    if not InputQuery('QMS Agent Setup', 'Agent Key (from server deployment output):', False, 0, AgentKey) then
    begin
      Result := False;
      Exit;
    end;
  end;

  Result := (ApiUrl <> '') and (AgentKey <> '');
  if not Result then
    MsgBox('Both Server API URL and Agent Key are required.', mbError, MB_OK);
end;
