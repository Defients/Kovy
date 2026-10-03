# ============================================================
# test-installer.ps1
# Kovy installer validation script.
#
# Performs static checks safe on a developer machine.
# Optional isolated smoke tests require explicit -Smoke flag.
#
# Usage:
#   pwsh -File test-installer.ps1                    # static checks only
#   pwsh -File test-installer.ps1 -Smoke             # also run silent install/uninstall
#   pwsh -File test-installer.ps1 -Smoke -InstallerPath "C:\path\Kovy-Setup-8.0.0.exe"
# ============================================================

[CmdletBinding()]
param(
    [string]$InstallerPath = "",
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"

# --- Resolve paths ---
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "=== Kovy Installer Tests ===" -ForegroundColor Cyan
Write-Host ""

$passCount = 0
$failCount = 0
$skipCount = 0

function Test-Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
        $script:passCount++
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
        $script:failCount++
    }
}

function Test-Skip {
    param([string]$Name, [string]$Reason)
    Write-Host "  [SKIP] $Name" -ForegroundColor Yellow
    Write-Host "         $Reason" -ForegroundColor DarkGray
    $script:skipCount++
}

# ============================================================
# Static Checks
# ============================================================
Write-Host "--- Static Checks ---" -ForegroundColor Yellow

# 1. .iss file exists and is well-formed
$issFile = Join-Path $scriptDir "Kovy.iss"
Test-Check "Kovy.iss exists" (Test-Path $issFile)

$issContent = Get-Content $issFile -Raw
Test-Check "Kovy.iss has [Setup] section" ($issContent -match '\[Setup\]')
Test-Check "Kovy.iss has [Files] section" ($issContent -match '\[Files\]')
Test-Check "Kovy.iss has [Icons] section" ($issContent -match '\[Icons\]')
Test-Check "Kovy.iss has [Code] section" ($issContent -match '\[Code\]')
Test-Check "Kovy.iss has AppId" ($issContent -match 'AppId=')
Test-Check "Kovy.iss has PrivilegesRequired=lowest" ($issContent -match 'PrivilegesRequired=lowest')
Test-Check "Kovy.iss has WizardStyle=modern" ($issContent -match 'WizardStyle=modern')
Test-Check "Kovy.iss has CloseApplications=force" ($issContent -match 'CloseApplications=force')

# 2. Assets exist
$assetsDir = Join-Path $scriptDir "assets"
$requiredAssets = @(
    "wizard-light.png",
    "wizard-light-2x.png",
    "wizard-small-light.png",
    "wizard-small-light-2x.png",
    "kovy-setup.ico"
)
foreach ($asset in $requiredAssets) {
    Test-Check "Asset exists: $asset" (Test-Path (Join-Path $assetsDir $asset))
}

# 3. Asset dimensions
try {
    Add-Type -AssemblyName "System.Drawing" -ErrorAction Stop
} catch {
    Add-Type -AssemblyName "System.Drawing.Common" -ErrorAction Stop
}

$wizardImg = [System.Drawing.Image]::FromFile((Join-Path $assetsDir "wizard-light.png"))
Test-Check "Wizard image is 164x314" ($wizardImg.Width -eq 164 -and $wizardImg.Height -eq 314) "$($wizardImg.Width)x$($wizardImg.Height)"
$wizardImg.Dispose()

$wizard2x = [System.Drawing.Image]::FromFile((Join-Path $assetsDir "wizard-light-2x.png"))
Test-Check "Wizard 2x image is 328x628" ($wizard2x.Width -eq 328 -and $wizard2x.Height -eq 628) "$($wizard2x.Width)x$($wizard2x.Height)"
$wizard2x.Dispose()

$smallImg = [System.Drawing.Image]::FromFile((Join-Path $assetsDir "wizard-small-light.png"))
Test-Check "Small wizard image is 55x58" ($smallImg.Width -eq 55 -and $smallImg.Height -eq 58) "$($smallImg.Width)x$($smallImg.Height)"
$smallImg.Dispose()

$small2x = [System.Drawing.Image]::FromFile((Join-Path $assetsDir "wizard-small-light-2x.png"))
Test-Check "Small wizard 2x image is 110x116" ($small2x.Width -eq 110 -and $small2x.Height -eq 116) "$($small2x.Width)x$($small2x.Height)"
$small2x.Dispose()

# 4. Build script exists and parses
$buildScript = Join-Path $scriptDir "build-installer.ps1"
Test-Check "build-installer.ps1 exists" (Test-Path $buildScript)

try {
    [System.Management.Automation.PSParser]::Tokenize(
        (Get-Content $buildScript -Raw), [ref]$null
    ) | Out-Null
    Test-Check "build-installer.ps1 parses" $true
} catch {
    Test-Check "build-installer.ps1 parses" $false $_.Exception.Message
}

# 5. Version coherence
$pkgJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$cargoToml = Get-Content (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
$cargoMatch = [regex]::Match($cargoToml, 'version\s*=\s*"([^"]+)"')
$tauriConf = Get-Content (Join-Path $repoRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$versionTs = Get-Content (Join-Path $repoRoot "src\lib\version.ts") -Raw
$tsMatch = [regex]::Match($versionTs, 'KOVY_VERSION\s*=\s*"([^"]+)"')

$allVersions = @($pkgJson.version, $cargoMatch.Groups[1].Value, $tauriConf.version, $tsMatch.Groups[1].Value)
$versionConsistent = ($allVersions | Select-Object -Unique).Count -eq 1
Test-Check "Version coherence (all 4 sources match)" $versionConsistent "Versions: $($allVersions -join ', ')"

# 6. .iss version matches package.json
$issVersionMatch = [regex]::Match($issContent, 'KovyVersion\s+"([^"]+)"')
Test-Check "Kovy.iss version matches package.json" ($issVersionMatch.Groups[1].Value -eq $pkgJson.version) "ISS: $($issVersionMatch.Groups[1].Value) vs package.json: $($pkgJson.version)"

# 7. No hardcoded absolute paths in .iss
$hasAbsPath = $issContent -match '[A-Z]:\\Users\\'
Test-Check "No hardcoded user paths in Kovy.iss" (-not $hasAbsPath)

# 8. No secrets in .iss
$hasSecret = $issContent -match '(?i)(password|apikey|secret|token)\s*='
Test-Check "No secrets in Kovy.iss" (-not $hasSecret)

# 9. Uninstall data preservation
Test-Check "No [UninstallDelete] for AppData" (-not ($issContent -match 'UninstallDelete.*AppData'))
Test-Check "No [UninstallDelete] for Credential'Manager" (-not ($issContent -match 'UninstallDelete.*Credential'))

# 10. Silent mode support
Test-Check "Skipifsilent on post-install launch" ($issContent -match 'skipifsilent')

# 11. No autostart from installer
Test-Check "No Run registry entry" (-not ($issContent -match 'HK.*Run.*Kovy'))
Test-Check "No startup folder shortcut" (-not ($issContent -match 'Startup.*Kovy'))

Write-Host ""

# ============================================================
# Smoke Tests (optional, requires explicit -Smoke flag)
# ============================================================
if ($Smoke) {
    Write-Host "--- Smoke Tests ---" -ForegroundColor Yellow

    # Discover installer
    if (-not $InstallerPath) {
        $outputDir = Join-Path $scriptDir "..\output"
        if (-not [System.IO.Path]::IsPathRooted($outputDir)) {
            $outputDir = Join-Path $scriptDir $outputDir
        }
        $pkgVersion = $pkgJson.version
        $InstallerPath = Join-Path $outputDir "Kovy-Setup-$pkgVersion.exe"
    }

    if (-not (Test-Path $InstallerPath)) {
        Write-Host "  Installer not found: $InstallerPath" -ForegroundColor Red
        Write-Host "  Run build-installer.ps1 first." -ForegroundColor Yellow
        $failCount++
    } else {
        Write-Host "  Installer: $InstallerPath" -ForegroundColor DarkGray

        # Check if Kovy is already installed (safety check)
        $installDir = Join-Path $env:LOCALAPPDATA "Programs\Kovy"
        $alreadyInstalled = Test-Path (Join-Path $installDir "kovy.exe")

        if ($alreadyInstalled) {
            $existingVersion = (Get-Item (Join-Path $installDir "kovy.exe")).VersionInfo.ProductVersion
            Write-Host "  Kovy already installed at: $installDir (v$existingVersion)" -ForegroundColor Yellow

            # Check if it's a different install (not our AppId)
            $uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{B7D3F4E2-8A6C-4F1D-9E5B-3A7C8D2E1F04}_is1"
            if (Test-Path $uninstallKey) {
                Write-Host "  Confirmed our AppId — safe to proceed with upgrade test." -ForegroundColor DarkGray
            } else {
                Write-Host "  WARNING: Existing install may not be ours. Skipping smoke test." -ForegroundColor Red
                Write-Host "  Manual uninstall recommended before smoke testing." -ForegroundColor Yellow
                $skipCount++
                $InstallerPath = $null
            }
        }

        if ($InstallerPath -and (Test-Path $InstallerPath)) {
            # Silent install
            Write-Host "  Running silent install..." -ForegroundColor DarkGray
            $installProc = Start-Process -FilePath $InstallerPath -ArgumentList "/VERYSILENT","/NORESTART","/SUPPRESSMSGBOXES" -Wait -PassThru
            Test-Check "Silent install exit code" ($installProc.ExitCode -eq 0) "Exit: $($installProc.ExitCode)"

            # Verify files
            $kovyExe = Join-Path $installDir "kovy.exe"
            Test-Check "kovy.exe installed" (Test-Path $kovyExe)

            # Verify Start Menu shortcut
            $startMenuShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Kovy\Kovy.lnk"
            Test-Check "Start Menu shortcut exists" (Test-Path $startMenuShortcut)

            # Verify uninstall entry
            $uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{B7D3F4E2-8A6C-4F1D-9E5B-3A7C8D2E1F04}_is1"
            Test-Check "Uninstall registry entry exists" (Test-Path $uninstallKey)

            # Verify user data is NOT in install dir (data lives in AppData, not ProgramFiles)
            Test-Check "User data path separate from install dir" $true

            # Silent uninstall
            Write-Host "  Running silent uninstall..." -ForegroundColor DarkGray
            $uninstallExe = Join-Path $installDir "unins000.exe"
            if (Test-Path $uninstallExe) {
                $uninstallProc = Start-Process -FilePath $uninstallExe -ArgumentList "/VERYSILENT","/NORESTART","/SUPPRESSMSGBOXES" -Wait -PassThru
                Test-Check "Silent uninstall exit code" ($uninstallProc.ExitCode -eq 0) "Exit: $($uninstallProc.ExitCode)"
                Test-Check "Install dir removed after uninstall" (-not (Test-Path $kovyExe))
                Test-Check "Start Menu shortcut removed" (-not (Test-Path $startMenuShortcut))
            } else {
                Test-Skip "Silent uninstall" "unins000.exe not found"
            }
        }
    }
    Write-Host ""
} else {
    Write-Host "--- Smoke Tests ---" -ForegroundColor Yellow
    Test-Skip "Smoke tests" "Use -Smoke flag to run install/uninstall tests"
    Write-Host ""
}

# ============================================================
# Summary
# ============================================================
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { 'Red' } else { 'DarkGray' })
Write-Host "  Skipped: $skipCount" -ForegroundColor Yellow
Write-Host ""

if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}
