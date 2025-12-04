# Launch Checklist

## Required before public launch

- [ ] **Apple Developer Program** ($99/year) - Required for macOS notarization
  - Sign up at https://developer.apple.com/programs/
  - Add code signing + notarization to CI workflow
  - Without this, macOS users see "damaged" error

## Nice to have

- [ ] **Windows download page note** - Add text like:
  > "Windows may show a security warning. Click 'More info' then 'Run anyway' to proceed."

- [ ] **Windows code signing** ($70-400/year) - Removes SmartScreen warning
  - Not critical - users can click through
  - Consider after launch if user complaints arise

## Already done

- [x] Multi-platform CI builds (macOS, Windows, Linux)
- [x] GitHub Releases pipeline
- [x] Tauri update signing (createUpdaterArtifacts)
- [x] Update manifest system
