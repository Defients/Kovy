# ============================================================
# build-installer.ps1
# Kovy Inno Setup build entry point.
#
# Validates version coherence, discovers the release binary,
# invokes ISCC.exe, and emits SHA-256 after successful compile.
#
# Usage:
#   pwsh -File build-installer.ps1
#   pwsh -File build-installer.ps1 -BinaryPath "..\..\src-tauri\target\release\kovy.exe"
#   pwsh -File build-installer.ps1 -Architecture x64 -Sign
# ============================================================

[CmdletBinding()]
param(
    [string]$BinaryPath  = "",
    [string]$Architecture = "x64",
    [string]$OutputDir   = "",
    [string]$SignTool    = "",
    [string]$CertFile    = "",
    [string]$CertPass    = "",
    [switch]$SkipVersionCheck,
    [switch]$Sign
)

$ErrorActionPreference = "Stop"

# --- Resolve script + repo paths ---
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "=== Kovy Installer Build ===" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host "Architecture: $Architecture"
Write-Host ""

# ============================================================
# 1. Version Coherence Check
# ============================================================
if (-not $SkipVersionCheck) {
    Write-Host "[1/6] Checking version coherence..." -ForegroundColor Yellow

    $pkgJson = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
    $pkgVersion = $pkgJson.version

    $cargoToml = Get-Content (Join-Path $repoRoot "src-tauri\Cargo.toml") -Raw
    $cargoMatch = [regex]::Match($cargoToml, 'version\s*=\s*"([^"]+)"')
    $cargoVersion = $cargoMatch.Groups[1].Value

    $tauriConf = Get-Content (Join-Path $repoRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
    $tauriVersion = $tauriConf.version

    $versionTs = Get-Content (Join-Path $repoRoot "src\lib\version.ts") -Raw
    $versionMatch = [regex]::Match($versionTs, 'KOVY_VERSION\s*=\s*"([^"]+)"')
    $tsVersion = $versionMatch.Groups[1].Value

    $versions = @{
        "package.json"       = $pkgVersion
        "Cargo.toml"         = $cargoVersion
        "tauri.conf.json"    = $tauriVersion
        "src/lib/version.ts" = $tsVersion
    }

    $allMatch = $true
    foreach ($k in $versions.Keys) {
        $v = $versions[$k]
        if ($v -ne $pkgVersion) {
            Write-Host "  MISMATCH: $k = $v (expected $pkgVersion)" -ForegroundColor Red
            $allMatch = $false
        } else {
            Write-Host "  OK: $k = $v"
        }
    }

    if (-not $allMatch) {
        Write-Error "Version mismatch detected. Reconcile all version sources before building."
        exit 1
    }

    $resolvedVersion = $pkgVersion
    Write-Host "  Resolved version: $resolvedVersion" -ForegroundColor Green
} else {
    $resolvedVersion = "8.0.0"
    Write-Host "  Version check skipped." -ForegroundColor DarkGray
}
Write-Host ""

# ============================================================
# 2. Binary Discovery + PE Validation
# ============================================================
Write-Host "[2/6] Locating release binary..." -ForegroundColor Yellow

if (-not $BinaryPath) {
    $BinaryPath = Join-Path $repoRoot "src-tauri\target\release\kovy.exe"
}

if (-not (Test-Path $BinaryPath)) {
    Write-Host "  Binary not found at: $BinaryPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "  To produce the binary, run:" -ForegroundColor Yellow
    Write-Host "    npm run tauri build" -ForegroundColor White
    Write-Host "  Or specify an explicit path:" -ForegroundColor Yellow
    Write-Host "    pwsh -File build-installer.ps1 -BinaryPath <path-to-kovy.exe>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Expected output location after 'npm run tauri build':" -ForegroundColor DarkGray
    Write-Host "    src-tauri\target\release\kovy.exe" -ForegroundColor DarkGray
    exit 1
}

$BinaryPath = (Resolve-Path $BinaryPath).Path
$binSize = (Get-Item $BinaryPath).Length
Write-Host "  Found: $BinaryPath ($([Math]::Round($binSize / 1MB, 2)) MiB)"

# PE header check
$bytes = [System.IO.File]::ReadAllBytes($BinaryPath)[0..1]
if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
    Write-Error "File is not a valid PE executable (missing MZ header): $BinaryPath"
    exit 1
}
Write-Host "  PE header: valid (MZ)"

# Architecture check from PE header
$peOffsetBytes = [System.IO.File]::ReadAllBytes($BinaryPath)[60..63]
$peOffset = [BitConverter]::ToInt32($peOffsetBytes, 0)
$machineBytes = [System.IO.File]::ReadAllBytes($BinaryPath)[($peOffset + 4)..($peOffset + 5)]
$machine = [BitConverter]::ToUInt16($machineBytes, 0)
$archName = switch ($machine) {
    0x8664 { "x64" }
    0x014C { "x86" }
    0xAA64 { "arm64" }
    default { "unknown (0x{0:X4})" -f $machine }
}
Write-Host "  Architecture: $archName"

if ($Architecture -eq "x64" -and $machine -ne 0x8664) {
    Write-Error "Expected x64 binary but found $archName. Use -Architecture $archName or rebuild for x64."
    exit 1
}
Write-Host ""

# ============================================================
# 3. Inno Setup Compiler Discovery
# ============================================================
Write-Host "[3/6] Locating Inno Setup compiler..." -ForegroundColor Yellow

$isccPaths = @(
    "${env:ProgramFiles(X86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)

$iscc = $null
foreach ($p in $isccPaths) {
    if (Test-Path $p) {
        $iscc = $p
        break
    }
}

if (-not $iscc) {
    # Try PATH
    $cmd = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}

if (-not $iscc) {
    Write-Host "  Inno Setup compiler (ISCC.exe) not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install Inno Setup 6.3.0 or later:" -ForegroundColor Yellow
    Write-Host "    https://jrsoftware.org/isdl.php" -ForegroundColor White
    Write-Host "  Or add ISCC.exe to your PATH." -ForegroundColor DarkGray
    exit 1
}

Write-Host "  Found: $iscc"

# Version check
$isccOutput = & $iscc /? 2>&1 | Select-Object -First 5
$isccVersionLine = ($isccOutput | Where-Object { $_ -match 'Inno Setup' } | Select-Object -First 1)
if ($isccVersionLine) {
    Write-Host "  $isccVersionLine"
}

Write-Host ""

# ============================================================
# 4. Asset Validation
# ============================================================
Write-Host "[4/6] Validating installer assets..." -ForegroundColor Yellow

$assetsDir = Join-Path $scriptDir "assets"
$requiredAssets = @(
    "wizard-light.png",
    "wizard-light-2x.png",
    "wizard-small-light.png",
    "wizard-small-light-2x.png",
    "kovy-setup.ico"
)

$assetsOk = $true
foreach ($asset in $requiredAssets) {
    $assetPath = Join-Path $assetsDir $asset
    if (Test-Path $assetPath) {
        Write-Host "  OK: $asset"
    } else {
        Write-Host "  MISSING: $asset" -ForegroundColor Red
        $assetsOk = $false
    }
}

if (-not $assetsOk) {
    Write-Host ""
    Write-Host "  Run the asset generator:" -ForegroundColor Yellow
    Write-Host "    pwsh -File tools\generate-installer-assets.ps1" -ForegroundColor White
    exit 1
}
Write-Host ""

# ============================================================
# 5. Compile Installer
# ============================================================
Write-Host "[5/6] Compiling installer..." -ForegroundColor Yellow

$issFile = Join-Path $scriptDir "Kovy.iss"
if (-not (Test-Path $issFile)) {
    Write-Error "Inno script not found: $issFile"
    exit 1
}

# Build ISCC arguments
$isccArgs = @(
    "/DBinDir=`"$(Split-Path $BinaryPath -Parent)`"",
    "/DArchFlag=$Architecture",
    "`"$issFile`""
)

# Signing
if ($Sign -and $SignTool -and $CertFile) {
    $signParams = "signtool.exe sign /f `"$CertFile`" /p `"$CertPass`" /fd sha256 /t http://timestamp.digicert.com `"$f`""
    $isccArgs = @("/Ssign=`"$signParams`"") + $isccArgs
    Write-Host "  Code signing: enabled" -ForegroundColor DarkGray
} else {
    Write-Host "  Code signing: not configured (unsigned build)" -ForegroundColor DarkGray
}

Write-Host "  ISCC args: $($isccArgs -join ' ')" -ForegroundColor DarkGray
Write-Host ""

$isccProcess = Start-Process -FilePath $iscc -ArgumentList $isccArgs -NoNewWindow -Wait -PassThru

if ($isccProcess.ExitCode -ne 0) {
    Write-Error "ISCC compilation failed with exit code $($isccProcess.ExitCode)"
    exit 1
}

Write-Host ""

# ============================================================
# 6. Artifact Discovery + SHA-256
# ============================================================
Write-Host "[6/6] Verifying output artifact..." -ForegroundColor Yellow

if (-not $OutputDir) {
    $OutputDir = Join-Path $scriptDir "..\output"
}
if (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $scriptDir $OutputDir
}

$expectedName = "Kovy-Setup-$resolvedVersion.exe"
$artifactPath = Join-Path $OutputDir $expectedName

if (-not (Test-Path $artifactPath)) {
    Write-Error "Expected installer not found: $artifactPath"
    exit 1
}

$artifact = Get-Item $artifactPath
$artifactSize = $artifact.Length
$hash = (Get-FileHash $artifactPath -Algorithm SHA256).Hash

Write-Host "  Installer: $artifactPath" -ForegroundColor Green
Write-Host "  Size:      $([Math]::Round($artifactSize / 1MB, 2)) MiB ($artifactSize bytes)"
Write-Host "  SHA-256:   $hash" -ForegroundColor Green
Write-Host "  Version:   $resolvedVersion"
Write-Host "  Arch:      $Architecture"
Write-Host "  Signed:    $(if ($Sign -and $SignTool -and $CertFile) { 'yes' } else { 'no (unsigned)' })"
Write-Host ""

# Write checksum file
$checksumPath = "$artifactPath.sha256"
"$hash  $expectedName" | Out-File -FilePath $checksumPath -Encoding ascii -NoNewline
Write-Host "  Checksum:  $checksumPath"

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
