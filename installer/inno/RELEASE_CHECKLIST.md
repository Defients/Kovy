# Kovy Release Checklist

Pre-release validation for **Kovy 8.0.0** Inno Setup installer.

## Version Sync

- [ ] `package.json` version = 8.0.0
- [ ] `src-tauri/Cargo.toml` version = 8.0.0
- [ ] `src-tauri/tauri.conf.json` version = 8.0.0
- [ ] `src/lib/version.ts` KOVY_VERSION = "8.0.0"
- [ ] `installer/inno/Kovy.iss` KovyVersion = "8.0.0"
- [ ] All versions match (run `pwsh -File test-installer.ps1`)

## Build

- [ ] `npm run test` — all frontend tests pass
- [ ] `cargo test` — all Rust tests pass
- [ ] `npm run tauri build` — clean release build succeeds
- [ ] `src-tauri/target/release/kovy.exe` exists and is a valid PE x64

## Assets

- [ ] `pwsh -File tools\generate-installer-assets.ps1` runs clean
- [ ] `wizard-light.png` is 164×314
- [ ] `wizard-light-2x.png` is 328×628
- [ ] `wizard-small-light.png` is 55×58
- [ ] `wizard-small-light-2x.png` is 110×116
- [ ] `kovy-setup.ico` exists and is valid

## Installer Compile

- [ ] `pwsh -File build-installer.ps1` succeeds
- [ ] No ISCC warnings (or all justified)
- [ ] Output: `Kovy-Setup-8.0.0.exe`
- [ ] SHA-256 checksum file generated

## Signing (if configured)

- [ ] Certificate is valid and not expired
- [ ] `signtool.exe verify /pa /v Kovy-Setup-8.0.0.exe` passes
- [ ] Timestamp included

## Test Matrix

- [ ] **Static tests**: `pwsh -File test-installer.ps1` — all pass
- [ ] **Clean install**: Fresh install on clean VM
- [ ] **Launch**: Kovy starts from Start Menu shortcut
- [ ] **Update/reinstall**: Install over existing same-version
- [ ] **Running-app update**: Kovy running, then update — graceful close + install
- [ ] **Silent install**: `/VERYSILENT` completes without UI
- [ ] **Silent uninstall**: `/VERYSILENT` completes without UI
- [ ] **Normal uninstall**: Via Add/Remove Programs
- [ ] **Data preservation**: User data intact after uninstall
- [ ] **Shortcut cleanup**: Start Menu + Desktop shortcuts removed after uninstall
- [ ] **Uninstall entry**: Removed from Add/Remove Programs after uninstall

## Visual Checks

- [ ] **Light mode**: Wizard renders correctly
- [ ] **Dark mode**: Wizard renders correctly
- [ ] **High contrast**: All text legible, no branding obscures content
- [ ] **100% scaling**: No clipping
- [ ] **125% scaling**: No clipping
- [ ] **150% scaling**: No clipping
- [ ] **200% scaling**: No clipping
- [ ] **250% scaling**: No clipping
- [ ] **Keyboard navigation**: Tab order logical, focus visible
- [ ] **Screen reader**: Welcome/progress/finish text announced

## Security

- [ ] No hardcoded paths in any script
- [ ] No secrets in any committed file
- [ ] No telemetry or network calls from installer
- [ ] Windows Defender scan: clean (expected for unsigned dev builds)
- [ ] SmartScreen: will show "unrecognized app" for unsigned (documented, expected)

## Artifact Inventory

- [ ] `Kovy-Setup-8.0.0.exe` — installer
- [ ] `Kovy-Setup-8.0.0.exe.sha256` — checksum
- [ ] Version verified in file properties
- [ ] Architecture verified (x64)
- [ ] File size reasonable (typically 5-15 MiB depending on payload)

## Final

- [ ] All checkboxes above checked
- [ ] No unresolved compiler warnings
- [ ] Release notes updated
- [ ] Artifact uploaded to release platform
