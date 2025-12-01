# Updater Setup Guide

This guide explains how to set up the Tauri auto-updater for Vinsly Desktop.

## Overview

The Tauri updater allows the application to automatically check for and install updates. It uses public-key cryptography to ensure update authenticity.

## Prerequisites

- Tauri CLI installed: `npm install -g @tauri-apps/cli`
- Access to a server for hosting updates (e.g., `https://updates.vinsly.app` and `https://releases.vinsly.app`)
- Secure storage for the private signing key

## Step 1: Generate Signing Key Pair

The first step is to generate a public/private key pair for signing your releases.

```bash
# Generate a new keypair and save it to a secure location
tauri signer generate -w ~/.tauri/vinsly.key
```

**Important:**
- You will be prompted to set a password for the private key. **Store this password securely!**
- The command will output the public key. **Copy this for the next step.**
- Keep the private key (`~/.tauri/vinsly.key`) **extremely secure** - treat it like a production password
- Consider using a hardware security module (HSM) or secure key management system in production

### Example Output

```
Generating new signing key...
Private key saved to: /Users/you/.tauri/vinsly.key
Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFBQUFBQUFB...

IMPORTANT: Store the private key securely and never commit it to version control!
```

## Step 2: Update tauri.conf.json

Update the `pubkey` field in `src-tauri/tauri.conf.json` with the public key from Step 1:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": false,
      "endpoints": [
        "https://updates.vinsly.app/latest.json"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFBQUFBQUFB...",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**Never commit the private key to version control!** Only the public key goes in `tauri.conf.json`.

## Step 3: Store Private Key in CI/CD

For automated releases, you'll need to make the private key available to your CI/CD system.

### GitHub Actions

1. Add the private key as a secret:
   - Go to your repository Settings → Secrets and variables → Actions
   - Add a new secret named `TAURI_PRIVATE_KEY`
   - Paste the contents of `~/.tauri/vinsly.key`

2. Add the key password as a secret:
   - Add another secret named `TAURI_KEY_PASSWORD`
   - Paste the password you set when generating the key

3. Use in GitHub Actions workflow:

```yaml
- name: Sign and build Tauri app
  env:
    TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
    TAURI_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
  run: npm run tauri build
```

## Step 4: Build and Sign Releases

When building a release, Tauri will automatically sign it using the private key if the environment variables are set:

```bash
# Ensure environment variables are set
export TAURI_PRIVATE_KEY="$(cat ~/.tauri/vinsly.key)"
export TAURI_KEY_PASSWORD="your-key-password"

# Build and sign
npm run tauri build
```

The build process will:
1. Build the application
2. Sign the installer with your private key
3. Generate a signature file (`.sig`) alongside the installer

## Step 5: Create Update Manifest

For each release, create a `latest.json` manifest file:

```json
{
  "version": "1.0.0",
  "pub_date": "2025-01-15T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://releases.vinsly.app/vinsly-1.0.0-aarch64.dmg",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIFRhdXJpIHNlY3JldCBrZXkK..."
    },
    "darwin-x86_64": {
      "url": "https://releases.vinsly.app/vinsly-1.0.0-x64.dmg",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIFRhdXJpIHNlY3JldCBrZXkK..."
    },
    "windows-x86_64": {
      "url": "https://releases.vinsly.app/vinsly-1.0.0-x64-setup.exe",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIFRhdXJpIHNlY3JldCBrZXkK..."
    }
  },
  "notes": "Release notes here..."
}
```

### Getting Signatures

After building, signature files are created alongside installers:
- `vinsly-1.0.0-aarch64.dmg.sig`
- `vinsly-1.0.0-x64.dmg.sig`
- `vinsly-1.0.0-x64-setup.exe.sig`

Read the signature from these files and include them in `latest.json`.

## Step 6: Deploy Update Files

1. **Upload installers** to your releases server (e.g., `https://releases.vinsly.app/`):
   - `vinsly-1.0.0-aarch64.dmg`
   - `vinsly-1.0.0-x64.dmg`
   - `vinsly-1.0.0-x64-setup.exe` (or `.msi`)
   - etc.

2. **Upload manifest** to your update server:
   - Upload `latest.json` to `https://updates.vinsly.app/latest.json`
   - Ensure it's publicly accessible (test with `curl https://updates.vinsly.app/latest.json`)

## Step 7: Test the Updater

1. **Install an older version** of the app
2. **Open the app** and wait for update check (or trigger manually if you have UI for it)
3. **Verify the update flow**:
   - Update notification appears
   - Update downloads
   - Update installs
   - App restarts with new version

### Manual Testing

You can test update checking with:

```javascript
// In your app code
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';

async function checkForUpdates() {
  const update = await check();

  if (update?.available) {
    const yes = await ask(
      `Update to ${update.version} is available. Install now?`,
      { title: 'Update Available', kind: 'info' }
    );

    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
  }
}
```

## Security Best Practices

### Private Key Security
1. **Never commit** the private key to version control
2. **Never share** the private key or password
3. **Rotate keys** if compromised (requires updating `pubkey` in all deployed apps)
4. **Use CI/CD secrets** for automated builds
5. **Limit access** to the key to only those who need it
6. **Back up** the key securely (encrypted backup)

### Update Server Security
1. **Use HTTPS only** for update endpoints
2. **Validate signatures** before serving updates (server-side checks)
3. **Rate limit** update checks to prevent abuse
4. **Monitor** update downloads for anomalies
5. **CDN** for high availability and performance

### Update Manifest Security
1. **Validate JSON** structure before serving
2. **Use timestamps** to prevent replay attacks
3. **Version ordering** to prevent downgrade attacks
4. **Channel separation** (stable, beta, nightly) if needed

## Troubleshooting

### "Invalid signature" Error

**Cause:** The signature doesn't match the public key or the installer was modified.

**Solutions:**
- Verify the public key in `tauri.conf.json` matches the private key used for signing
- Ensure the installer wasn't modified after signing
- Check that you're using the correct `.sig` file for the installer

### "Update server unreachable" Error

**Cause:** The app can't connect to the update server.

**Solutions:**
- Verify `https://updates.vinsly.app/latest.json` is accessible
- Check network/firewall settings
- Ensure HTTPS certificate is valid

### "No update available" When Update Exists

**Cause:** Version comparison issue or caching.

**Solutions:**
- Verify version in `latest.json` is higher than installed version
- Check if semantic versioning is correct (1.0.1 > 1.0.0)
- Clear browser/CDN cache for `latest.json`

### Signature Generation Failed

**Cause:** Private key not found or password incorrect.

**Solutions:**
- Verify `TAURI_PRIVATE_KEY` environment variable is set
- Verify `TAURI_KEY_PASSWORD` is correct
- Check file permissions on the private key file

## Production Checklist

Before going to production with the updater:

- [ ] Private key generated and stored securely
- [ ] Public key added to `tauri.conf.json`
- [ ] Private key added to CI/CD secrets
- [ ] Update and release servers configured with HTTPS
- [ ] Test build and signature generation locally
- [ ] Test build and signature generation in CI
- [ ] Test full update flow on all platforms
- [ ] Monitor update success/failure rates
- [ ] Have rollback plan ready
- [ ] Document key rotation procedure

## Automated Release Script (Optional)

Create a script to automate the release process:

```bash
#!/bin/bash
# release.sh

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh <version>"
  exit 1
fi

# Build and sign
npm run tauri build

# Extract signatures
SIG_MACOS_ARM64=$(cat src-tauri/target/release/bundle/macos/Vinsly_${VERSION}_aarch64.dmg.sig)
SIG_MACOS_X64=$(cat src-tauri/target/release/bundle/macos/Vinsly_${VERSION}_x64.dmg.sig)
SIG_WINDOWS=$(cat src-tauri/target/release/bundle/nsis/Vinsly_${VERSION}_x64-setup.exe.sig)

# Generate manifest
cat > latest.json <<EOF
{
  "version": "${VERSION}",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://releases.vinsly.app/vinsly-${VERSION}-aarch64.dmg",
      "signature": "${SIG_MACOS_ARM64}"
    },
    "darwin-x86_64": {
      "url": "https://releases.vinsly.app/vinsly-${VERSION}-x64.dmg",
      "signature": "${SIG_MACOS_X64}"
    },
    "windows-x86_64": {
      "url": "https://releases.vinsly.app/vinsly-${VERSION}-x64-setup.exe",
      "signature": "${SIG_WINDOWS}"
    }
  },
  "notes": "See CHANGELOG.md for details"
}
EOF

echo "Manifest created: latest.json"
echo "Upload installers and manifest to production servers"
```

## References

- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [Tauri Signer Documentation](https://tauri.app/v1/api/cli#signer)
- [Semantic Versioning](https://semver.org/)
