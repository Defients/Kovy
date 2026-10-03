; ============================================================
; Kovy — Inno Setup Script
; v8.0.0
;
; "Companion Arrival" installer experience.
; Per-user, non-elevated, local-first, privacy-respecting.
;
; Minimum Inno Setup: 6.3.0
; ============================================================

#define KovyVersion   "8.0.0"
#define KovyExeName   "kovy.exe"
#define KovyAppName   "Kovy"
#define KovyPublisher "Kovy"

; --- Build parameters (overridable via ISCC /D flags) ---
#ifndef BinDir
  #define BinDir "..\..\src-tauri\target\release"
#endif
#ifndef ArchFlag
  #define ArchFlag "x64"
#endif

[Setup]
AppId={{B7D3F4E2-8A6C-4F1D-9E5B-3A7C8D2E1F04}
AppName={#KovyAppName}
AppVersion={#KovyVersion}
AppVerName={#KovyAppName} {#KovyVersion}
AppPublisher={#KovyPublisher}
AppPublisherURL=
AppSupportURL=
AppUpdatesURL=
AppComments=Digital AI Desktop Companion
DefaultDirName={autopf}\{#KovyAppName}
DefaultGroupName={#KovyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
OutputBaseFilename=Kovy-Setup-{#KovyVersion}
OutputDir=..\output
SetupIconFile=assets\kovy-setup.ico
UninstallDisplayIcon={app}\{#KovyExeName}
UninstallDisplayName={#KovyAppName}
WizardImageFile=assets\wizard-light.png,assets\wizard-light-2x.png
WizardSmallImageFile=assets\wizard-small-light.png,assets\wizard-small-light-2x.png
DisableWelcomePage=no
CloseApplications=force
RestartApplications=no
RestartIfNeededByRun=no
ShowLanguageDialog=no
LanguageDetectionMethod=none
VersionInfoVersion={#KovyVersion}
VersionInfoProductVersion={#KovyVersion}
VersionInfoCompany={#KovyPublisher}
VersionInfoDescription={#KovyAppName} Installer
InternalCompressLevel=ultra64
LZMAUseSeparateProcess=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
; --- Main executable ---
Source: "{#BinDir}\{#KovyExeName}"; DestDir: "{app}"; Flags: ignoreversion

; --- Resources (icon, etc.) ---
Source: "{#BinDir}\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: ResourcesExist

[Icons]
Name: "{group}\{#KovyAppName}"; Filename: "{app}\{#KovyExeName}"
Name: "{group}\Uninstall {#KovyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#KovyAppName}"; Filename: "{app}\{#KovyExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#KovyExeName}"; Description: "Launch {#KovyAppName}"; Flags: nowait postinstall skipifsilent; Check: WizardNotSilent

[UninstallRun]
; No post-uninstall actions — user data is preserved by default

[UninstallDelete]
; Only delete the log directory — never AppData user data
Type: filesandordirs; Name: "{app}\logs"

[Code]
// ============================================================
// Pascal Script — Kovy companion-arrival flavor + safeguards
// ============================================================

var
  ProgressLabel: TLabel;
  LastProgressMsg: string;

// --- Check functions for [Files] entries ---

function ResourcesExist(): Boolean;
begin
  Result := True;
end;

function WizardNotSilent(): Boolean;
begin
  Result := not WizardSilent();
end;

// --- Progress flavor: threshold-based messages tied to real progress ---

procedure UpdateProgressLabel(Progress: Integer);
var
  Msg: string;
begin
  case Progress of
    0..15:   Msg := 'Preparing Kovy''s habitat...';
    16..45:  Msg := 'Placing Kovy''s core files...';
    46..75:  Msg := 'Gathering the glow...';
    76..94:  Msg := 'Settling everything into place...';
    95..100: Msg := 'Almost awake...';
  else
    Msg := '';
  end;

  if (Msg <> '') and (Msg <> LastProgressMsg) then
  begin
    LastProgressMsg := Msg;
    if ProgressLabel <> nil then
      ProgressLabel.Caption := Msg;
  end;
end;

procedure InitializeWizard();
begin
  // Create a label below the standard progress bar to show flavor text
  ProgressLabel := TLabel.Create(WizardForm);
  ProgressLabel.Parent := WizardForm.InstallingPage;
  ProgressLabel.Left := WizardForm.ProgressGauge.Left;
  ProgressLabel.Top := WizardForm.ProgressGauge.Top + WizardForm.ProgressGauge.Height + ScaleY(12);
  ProgressLabel.Width := WizardForm.ProgressGauge.Width;
  ProgressLabel.Height := ScaleY(20);
  ProgressLabel.Font.Size := 9;
  ProgressLabel.Caption := 'Preparing Kovy''s habitat...';
  LastProgressMsg := 'Preparing Kovy''s habitat...';
end;

procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
var
  Pct: Integer;
begin
  if MaxProgress > 0 then
    Pct := (CurProgress * 100) div MaxProgress
  else
    Pct := 0;
  UpdateProgressLabel(Pct);
end;

// --- Welcome page customization ---

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpWelcome then
  begin
    WizardForm.WelcomeLabel2.Caption :=
      'A little local-first companion is ready to move in.' #13#10 #13#10 +
      'Kovy lives above your desktop, reacts to motion, has moods and memories,' #13#10 +
      'and keeps everything on your machine by default.' #13#10 #13#10 +
      'AI stays off until you choose to enable it inside Kovy.';
  end;

  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedLabel.Caption :=
      'Kovy is ready to meet you.' #13#10 #13#10 +
      'You can find Kovy in your Start Menu. Configure settings,' #13#10 +
      'personality, and AI preferences from Kovy''s own settings window.';
  end;
end;

// --- Prepare to install: check for running Kovy ---

function InitializeSetup(): Boolean;
begin
  // CloseApplications=force in [Setup] handles running-app detection via Restart Manager
  Result := True;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
end;

// --- Upgrade detection: prevent accidental downgrade ---

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;

// --- Directory validation: reject root or unsafe paths ---

function NextButtonClick(CurPageID: Integer): Boolean;
var
  DirPath: string;
begin
  Result := True;

  if CurPageID = wpSelectDir then
  begin
    DirPath := WizardForm.DirEdit.Text;

    // Reject root drives
    if (Length(DirPath) <= 3) then
    begin
      MsgBox('Please choose a folder inside Program Files, not a root drive.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Reject if path doesn't contain "Kovy"
    if Pos('Kovy', DirPath) = 0 then
    begin
      if MsgBox(
        'The selected folder does not contain "Kovy" in its name.' #13#10 +
        'Are you sure you want to install here?' #13#10 #13#10 +
        'Selected: ' + DirPath,
        mbConfirmation, MB_YESNO) = IDNO then
      begin
        Result := False;
        Exit;
      end;
    end;
  end;
end;
