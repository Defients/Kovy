# ============================================================
# generate-installer-assets.ps1
# Deterministic installer brand-asset generator for Kovy.
#
# Derives wizard images from repository-owned Kovy.png and
# copies the setup icon. Produces exact documented output
# sizes. Does not mutate original Kovy art.
#
# Usage:
#   pwsh -File generate-installer-assets.ps1
#   pwsh -File generate-installer-assets.ps1 -SourceImage ..\..\..\Kovy.png
# ============================================================

[CmdletBinding()]
param(
    [string]$SourceImage = "",
    [string]$IconFile    = "",
    [string]$OutputDir   = ""
)

$ErrorActionPreference = "Stop"

# --- Resolve paths relative to this script ---
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..\..")

if (-not $SourceImage) { $SourceImage = Join-Path $repoRoot "Kovy.png" }
if (-not $IconFile)    { $IconFile    = Join-Path $repoRoot "src-tauri\icons\icon.ico" }
if (-not $OutputDir)   { $OutputDir   = Join-Path $scriptDir "..\assets" }

# Resolve to absolute path
if (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $scriptDir $OutputDir
}
$OutputDir = (New-Item -ItemType Directory -Force -Path $OutputDir).FullName

# --- Load System.Drawing ---
try {
    Add-Type -AssemblyName "System.Drawing" -ErrorAction Stop
} catch {
    Add-Type -AssemblyName "System.Drawing.Common" -ErrorAction Stop
}

Write-Host "=== Kovy Installer Asset Generator ===" -ForegroundColor Cyan
Write-Host "Source image: $SourceImage"
Write-Host "Icon file:    $IconFile"
Write-Host "Output dir:   $OutputDir"
Write-Host ""

# --- Validate inputs ---
if (-not (Test-Path $SourceImage)) {
    Write-Error "Source image not found: $SourceImage"
    exit 1
}
if (-not (Test-Path $IconFile)) {
    Write-Error "Icon file not found: $IconFile"
    exit 1
}

# --- Brand colors ---
$deepNavy     = [System.Drawing.Color]::FromArgb(0xFF, 0x0A, 0x0E, 0x1A)
$surfaceNavy  = [System.Drawing.Color]::FromArgb(0xFF, 0x11, 0x18, 0x27)
$cyan         = [System.Drawing.Color]::FromArgb(0xFF, 0x22, 0xD3, 0xEE)
$violet       = [System.Drawing.Color]::FromArgb(0xFF, 0x8B, 0x5C, 0xF6)

# --- Helper: create a wizard image with deep navy background + Kovy mascot ---
function New-WizardImage {
    param(
        [int]$Width,
        [int]$Height,
        [string]$SourcePath,
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill background with deep navy
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($deepNavy)), 0, 0, $Width, $Height)

    # Draw subtle vertical gradient overlay (surface navy at bottom)
    $gradRect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $gradRect,
        [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
        [System.Drawing.Color]::FromArgb(60, $surfaceNavy.R, $surfaceNavy.G, $surfaceNavy.B),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($gradBrush, 0, 0, $Width, $Height)

    # Load source image and draw it centered, scaled to fit
    $srcImg = [System.Drawing.Image]::FromFile($SourcePath)

    # Calculate scaled size to fit within 80% of the canvas (leave margin)
    $margin = 0.10
    $availW = $Width * (1.0 - 2.0 * $margin)
    $availH = $Height * (1.0 - 2.0 * $margin)
    $scaleW = $availW / $srcImg.Width
    $scaleH = $availH / $srcImg.Height
    $scale = [Math]::Min($scaleW, $scaleH)
    $drawW = [int]($srcImg.Width * $scale)
    $drawH = [int]($srcImg.Height * $scale)
    $drawX = [int](($Width - $drawW) / 2)
    $drawY = [int](($Height - $drawH) / 2)

    # Draw a subtle glow behind the mascot
    $glowRadius = [int]([Math]::Min($drawW, $drawH) * 0.6)
    $glowX = [int]($drawX + [Math]::Floor(($drawW - $glowRadius) / 2.0))
    $glowY = [int]($drawY + [Math]::Floor(($drawH - $glowRadius) / 2.0))
    $glowRect = [System.Drawing.Rectangle]::new($glowX, $glowY, $glowRadius, $glowRadius)
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse($glowRect)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(30, $cyan.R, $cyan.G, $cyan.B)
    $glowSurround = @([System.Drawing.Color]::FromArgb(0, $cyan.R, $cyan.G, $cyan.B))
    $glowBrush.SurroundColors = $glowSurround
    $g.FillEllipse($glowBrush, $glowRect)

    # Draw the mascot
    $g.DrawImage($srcImg, $drawX, $drawY, $drawW, $drawH)

    # Draw a subtle bottom accent line (cyan to violet gradient)
    $accentY = $Height - 4
    $accentRect = New-Object System.Drawing.Rectangle(0, $accentY, $Width, 4)
    $accentBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $accentRect,
        [System.Drawing.Color]::FromArgb(80, $cyan.R, $cyan.G, $cyan.B),
        [System.Drawing.Color]::FromArgb(80, $violet.R, $violet.G, $violet.B),
        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
    )
    $g.FillRectangle($accentBrush, 0, $accentY, $Width, 4)

    # Save
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $srcImg.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    $size = (Get-Item $OutPath).Length
    Write-Host "  Created: $OutPath ($Width x $Height, $size bytes)"
}

# --- Helper: create a small wizard image (icon-style) ---
function New-SmallWizardImage {
    param(
        [int]$Width,
        [int]$Height,
        [string]$SourcePath,
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill with deep navy
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($deepNavy)), 0, 0, $Width, $Height)

    # Load source and draw centered
    $srcImg = [System.Drawing.Image]::FromFile($SourcePath)

    $margin = 0.15
    $availW = $Width * (1.0 - 2.0 * $margin)
    $availH = $Height * (1.0 - 2.0 * $margin)
    $scaleW = $availW / $srcImg.Width
    $scaleH = $availH / $srcImg.Height
    $scale = [Math]::Min($scaleW, $scaleH)
    $drawW = [int]($srcImg.Width * $scale)
    $drawH = [int]($srcImg.Height * $scale)
    $drawX = [int](($Width - $drawW) / 2)
    $drawY = [int](($Height - $drawH) / 2)

    $g.DrawImage($srcImg, $drawX, $drawY, $drawW, $drawH)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $srcImg.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    $size = (Get-Item $OutPath).Length
    Write-Host "  Created: $OutPath ($Width x $Height, $size bytes)"
}

# --- Generate wizard images ---
Write-Host "Generating wizard portrait images..." -ForegroundColor Yellow

# Standard DPI (164 x 314) and 2x DPI (328 x 628)
New-WizardImage -Width 164 -Height 314 -SourcePath $SourceImage -OutPath (Join-Path $OutputDir "wizard-light.png")
New-WizardImage -Width 328 -Height 628 -SourcePath $SourceImage -OutPath (Join-Path $OutputDir "wizard-light-2x.png")

# Dark variants (same composition — deep navy works in both themes)
Copy-Item (Join-Path $OutputDir "wizard-light.png")   (Join-Path $OutputDir "wizard-dark.png")   -Force
Copy-Item (Join-Path $OutputDir "wizard-light-2x.png") (Join-Path $OutputDir "wizard-dark-2x.png") -Force
Write-Host "  Copied dark variants (identical — deep navy suits both themes)"

Write-Host ""
Write-Host "Generating small wizard images..." -ForegroundColor Yellow

# Standard DPI (55 x 58) and 2x DPI (110 x 116)
New-SmallWizardImage -Width 55 -Height 58 -SourcePath $SourceImage -OutPath (Join-Path $OutputDir "wizard-small-light.png")
New-SmallWizardImage -Width 110 -Height 116 -SourcePath $SourceImage -OutPath (Join-Path $OutputDir "wizard-small-light-2x.png")

Copy-Item (Join-Path $OutputDir "wizard-small-light.png")   (Join-Path $OutputDir "wizard-small-dark.png")   -Force
Copy-Item (Join-Path $OutputDir "wizard-small-light-2x.png") (Join-Path $OutputDir "wizard-small-dark-2x.png") -Force
Write-Host "  Copied dark variants"

# --- Copy setup icon ---
Write-Host ""
Write-Host "Copying setup icon..." -ForegroundColor Yellow
$iconDest = Join-Path $OutputDir "kovy-setup.ico"
Copy-Item $IconFile $iconDest -Force
$iconSize = (Get-Item $iconDest).Length
Write-Host "  Copied: $iconDest ($iconSize bytes)"

# --- Summary ---
Write-Host ""
Write-Host "=== Asset Generation Complete ===" -ForegroundColor Green
$assets = Get-ChildItem $OutputDir -Filter "*.png" | Sort-Object Name
$icons  = Get-ChildItem $OutputDir -Filter "*.ico" | Sort-Object Name
Write-Host "PNG files: $($assets.Count)"
Write-Host "ICO files: $($icons.Count)"
Write-Host "Output: $OutputDir"
