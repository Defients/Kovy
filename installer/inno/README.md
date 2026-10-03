# Kovy Inno Setup Installer

Production Inno Setup installer for **Kovy 8.0.0** — Digital AI Desktop Companion.

## Prerequisites

| Requirement | Minimum Version | Purpose |
|---|---|---|
| Inno Setup | 6.3.0 | Compiler (`ISCC.exe`) |
| Node.js | 18+ | Frontend build |
| Rust | stable | Tauri backend build |
| Visual Studio Build Tools | C++ workload | Rust on Windows |
| Windows 10/11 | — | Target platform |

Install Inno Setup: <https://jrsoftware.org/isdl.php>

## Quick Start

```powershell
# 1. Build the Tauri release binary
npm run tauri build

# 2. Generate installer brand assets (one-time, re-run if art changes)
pwsh -File installer\inno\tools\generate-installer-assets.ps1

# 3. Build the installer
pwsh -File installer\inno\build-installer.ps1

# 4. Run static validation tests
pwsh -File installer\inno\test-installer.ps1
```

## File Structure

```
installer/inno/
├── Kovy.iss                      # Main Inno Setup script
├── build-installer.ps1           # Build entry point (version check, PE validation, ISCC)
├── test-installer.ps1            # Static + optional smoke tests
├── assets/                       # Generated brand assets (committed)
│   ├── wizard-light.png          # 164×314 portrait (standard DPI)
│   ├── wizard-light-2x.png       # 328×628 portrait (high DPI)
│   ├── wizard-small-light.png    # 55×58 small (standard DPI)
│   ├── wizard-small-light-2x.png # 110×116 small (high DPI)
│   ├── wizard-dark.png           # Dark variants (identical — deep navy suits both)
│   ├── wizard-dark-2x.png
│   ├── wizard-small-dark.png
│   ├── wizard-small-dark-2x.png
│   └── kovy-setup.ico            # Setup/uninstall icon
├── tools/
│   └── generate-installer-assets.ps1  # Deterministic asset generator
├── output/                       # Compiled installer output (gitignored)
│   ├── Kovy-Setup-8.0.0.exe
│   └── Kovy-Setup-8.0.0.exe.sha256
├── README.md                     # This file
└── RELEASE_CHECKLIST.md          # Pre-release validation checklist
```

## Installer Contract

| Property | Value |
|---|---|
| AppId | `{B7D3F4E2-8A6C-4F1D-9E5B-3A7C8D2E1F04}` (permanent, never regenerate) |
| Version source | `package.json` → cross-checked against `Cargo.toml`, `tauri.conf.json`, `version.ts` |
| Install scope | Per-user (`PrivilegesRequired=lowest`), no UAC prompt |
| Install directory | `%LOCALAPPDATA%\Programs\Kovy` (via `{autopf}`) |
| Architecture | x64 (parameterizable via `-Architecture`) |
| Payload | `kovy.exe` + sidecar DLLs + resources (if present) |
| Shortcuts | Start Menu (always) + Desktop (optional, unchecked by default) |
| Autostart | **Not created** — Kovy owns this preference in-app |
| Launch on finish | Interactive installs only, skipped in silent mode |
| User data on uninstall | **Preserved** — no AppData or Credential Manager deletion |
| Prerequisites | WebView2 (required by Tauri, normally present on Win10/11) |
| Signing | Optional via `-Sign -SignTool <path> -CertFile <path> -CertPass <pass>` |
| Compression | LZMA2 Ultra64 + solid compression |

## Build Script Parameters

```powershell
pwsh -File build-installer.ps1 [options]
```

| Parameter | Default | Description |
|---|---|---|
| `-BinaryPath` | `src-tauri/target/release/kovy.exe` | Explicit path to release executable |
| `-Architecture` | `x64` | Architecture label for ISCC |
| `-OutputDir` | `installer/inno/output` | Installer output directory |
| `-Sign` | (off) | Enable code signing |
| `-SignTool` | (none) | Path to signtool.exe |
| `-CertFile` | (none) | Path to PFX certificate |
| `-CertPass` | (none) | Certificate password (pass via env, not hardcoded) |
| `-SkipVersionCheck` | (off) | Skip version coherence validation |

## Test Script Parameters

```powershell
pwsh -File test-installer.ps1 [options]
```

| Parameter | Default | Description |
|---|---|---|
| `-Smoke` | (off) | Run isolated silent install/uninstall tests |
| `-InstallerPath` | auto-discovered | Explicit installer path for smoke tests |

## Silent Install / Uninstall

```powershell
# Silent install
Kovy-Setup-8.0.0.exe /VERYSILENT /NORESTART /SUPPRESSMSGBOXES

# Silent uninstall (via uninstaller)
unins000.exe /VERYSILENT /NORESTART /SUPPRESSMSGBOXES
```

## Data Preservation Policy

The uninstaller **preserves all user data by default**:

- `%LOCALAPPDATA%\com.kovy.desktop\` — configuration, SQLite memory, bond/milestone state
- `%LOCALAPPDATA%\kovy-settings.json` — Tauri plugin-store settings
- Windows Credential Manager entry `KovyAIKey` — AI API key

No `[UninstallDelete]` entries target AppData or credential storage.

To manually remove personal data after uninstall:
1. Delete `%LOCALAPPDATA%\com.kovy.desktop\`
2. Delete `%LOCALAPPDATA%\kovy-settings.json`
3. Remove `KovyAIKey` from Windows Credential Manager

## Asset Regeneration

Brand assets are derived from `Kovy.png` and `src-tauri/icons/icon.ico`:

```powershell
pwsh -File installer\inno\tools\generate-installer-assets.ps1
```

The generator:
- Is deterministic (same input → same output)
- Does not mutate original Kovy art
- Produces exact documented sizes (164×314, 328×628, 55×58, 110×116)
- Requires `System.Drawing` (built into .NET on Windows)

## Code Signing

Signing is optional and disabled by default. To sign:

```powershell
pwsh -File build-installer.ps1 -Sign -SignTool "C:\path\signtool.exe" -CertFile "C:\certs\kovy.pfx" -CertPass $env:KOVY_CERT_PASS
```

**Never hardcode certificate passwords.** Pass via environment variable.

## Output

After a successful build:

| File | Location |
|---|---|
| Installer | `installer/inno/output/Kovy-Setup-8.0.0.exe` |
| SHA-256 checksum | `installer/inno/output/Kovy-Setup-8.0.0.exe.sha256` |

## Known Constraints

- `src-tauri/target/` is not committed — build the Tauri binary first
- Unsigned builds will trigger Windows SmartScreen warning (expected for non-EV cert)
- WebView2 is not bundled — it's normally present on Windows 10/11
- The installer does not handle migration from Tauri's MSI/NSIS bundles
