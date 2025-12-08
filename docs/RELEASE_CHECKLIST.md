# Release Checklist

Use this checklist to ensure all steps are completed when releasing a new version of Vinsly Desktop.

## Pre-Release

- [ ] **Version bump:** Update version in all three locations:
  - [ ] `package.json`
  - [ ] `src-tauri/Cargo.toml`
  - [ ] `src-tauri/tauri.conf.json`
- [ ] **Update CHANGELOG.md** with release notes
  - [ ] New features
  - [ ] Bug fixes
  - [ ] Breaking changes
  - [ ] Known issues
- [ ] **Run full test suite:** `npm test`
  - [ ] All tests passing
  - [ ] No warnings or errors
- [ ] **Manual QA testing on all platforms:**
  - [ ] macOS (Intel and Apple Silicon if available)
  - [ ] Windows
  - [ ] Linux (Ubuntu/Debian)
- [ ] **Test critical user flows:**
  - [ ] Fresh installation and activation
  - [ ] License validation
  - [ ] Agent scanning and discovery
  - [ ] Agent/Skill creation and editing
  - [ ] Import/Export functionality
  - [ ] Undo/Redo functionality
  - [ ] Keyboard shortcuts
  - [ ] Theme switching

## Build

- [ ] **Create git tag:**
  ```bash
  git tag -a v{version} -m "Release v{version}"
  ```
- [ ] **Push tag to trigger CI:**
  ```bash
  git push origin v{version}
  ```
- [ ] **Wait for CI builds to complete**
  - Check GitHub Actions: https://github.com/Roszianski/vinsly-desktop/actions
  - [ ] macOS build successful
  - [ ] Windows build successful
  - [ ] Linux build successful
- [ ] **Download build artifacts from GitHub Actions**
  - [ ] Download `macos-app` artifact
  - [ ] Download `windows-app` artifact
  - [ ] Download `linux-app` artifact
- [ ] **Extract and verify artifacts:**
  - [ ] macOS: `.dmg` file
  - [ ] Windows: `.msi` and/or `.exe` file
  - [ ] Linux: `.deb` and `.AppImage` files

## Updater Preparation

⚠️ **Important:** Only perform these steps if the auto-updater is fully configured with a real signing key.

- [ ] **Generate update manifest** (`latest.json`):
  ```json
  {
    "version": "{version}",
    "pub_date": "{ISO 8601 date}",
    "url": "https://releases.vinsly.app/vinsly-{version}-{platform}.{ext}",
    "signature": "{signature from tauri signer}",
    "notes": "Release notes here"
  }
  ```
- [ ] **Sign binaries with Tauri signing key:**
  ```bash
  tauri signer sign --private-key ~/.tauri/vinsly.key \
    --password <key-password> \
    path/to/bundle.app
  ```
- [ ] **Upload signed binaries to release server:**
  - Upload to `https://releases.vinsly.app/`
  - Verify correct permissions and public accessibility
- [ ] **Upload manifest to update server:**
  - Upload `latest.json` to `https://updates.vinsly.app/latest.json`
  - Verify manifest is publicly accessible
- [ ] **Test updater endpoint:**
  ```bash
  curl https://updates.vinsly.app/latest.json
  ```

## Publishing

- [ ] **Create GitHub release:**
  - Go to: https://github.com/Roszianski/vinsly-desktop/releases/new
  - Select the tag: `v{version}`
  - Release title: `v{version}`
  - Copy release notes from CHANGELOG.md
- [ ] **Upload installers to GitHub release:**
  - [ ] macOS: `Vinsly-{version}.dmg`
  - [ ] Windows: `Vinsly-{version}.msi` and/or `Vinsly-{version}.exe`
  - [ ] Linux: `Vinsly-{version}.deb` and `Vinsly-{version}.AppImage`
- [ ] **Publish release notes**
  - Ensure release notes are clear and user-friendly
  - Highlight major changes and breaking changes
- [ ] **Publish the release**
- [ ] **Test auto-updater on each platform** (if enabled):
  - [ ] macOS: Open previous version, wait for update prompt
  - [ ] Windows: Open previous version, wait for update prompt
  - [ ] Linux: Check for update notification

## Post-Release

- [ ] **Verify download links work:**
  - [ ] macOS installer downloads correctly
  - [ ] Windows installer downloads correctly
  - [ ] Linux installers download correctly
- [ ] **Monitor for issues:**
  - Check GitHub issues for new bug reports
  - Monitor error tracking/telemetry (if configured)
  - Check community channels for user feedback
- [ ] **Verify auto-update works for existing users** (if enabled):
  - Install previous version
  - Wait for update notification
  - Complete update process
  - Verify app launches correctly
- [ ] **Update documentation if needed:**
  - Update any changed features in docs
  - Update screenshots if UI changed
  - Update installation instructions if needed
- [ ] **Announce release:**
  - [ ] Update website (if applicable)
  - [ ] Post to social media/community channels
  - [ ] Send newsletter (if applicable)

## Rollback Plan

If critical issues are discovered after release:

1. **Immediate mitigation:**
   - If updater is active, update `latest.json` to point to previous stable version
   - Add warning to GitHub release page
   - Pin issue to repository

2. **Issue resolution:**
   - Create hotfix branch from release tag
   - Fix critical issue
   - Follow abbreviated release process for hotfix version

3. **Communication:**
   - Notify users of the issue
   - Provide workaround if available
   - Announce hotfix release when ready

## Notes

- **First-time setup:** Ensure updater signing keys are generated (see `docs/UPDATER_SETUP.md`)
- **CI/CD secrets:** Verify all required secrets are configured in GitHub Actions
- **Platform signing:** macOS may require code signing certificate for distribution outside App Store
- **Testing window:** Allow at least 24 hours of testing before announcing to wider audience
- **Version naming:** Follow semantic versioning (MAJOR.MINOR.PATCH)

## Changelog Template

```markdown
## [version] - YYYY-MM-DD

### Added
- New feature X
- New feature Y

### Changed
- Updated behavior of Z
- Improved performance of W

### Fixed
- Fixed bug where A happened
- Resolved issue with B

### Breaking Changes
- Changed API for C (migration guide: ...)

### Known Issues
- Issue D is being tracked in #123
```
