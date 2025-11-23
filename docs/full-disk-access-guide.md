# Full Disk Access Admin & QA Guide

This document captures the practical steps for rolling out Vinsly’s macOS Full Disk Access (FDA) flow and the verification matrix referenced in the resilience plan.

## 1. Admin rollout checklist

### Manual grant (HT210595)

1. Ask the user to open **System Settings → Privacy & Security → Full Disk Access** (Apple doc [HT210595](https://support.apple.com/HT210595)).
2. Click the **+** button and add `Vinsly.app` (or toggle it on if already listed). The helper binary lives inside the same bundle as `Contents/MacOS/scan-helper`, so enabling Vinsly covers both processes.
3. Return to Vinsly and use **Settings → Permissions → Check again** to confirm access.
4. If FDA is declined, remind the user that watched directories still allow scoped scans of Desktop/Documents without elevating the entire home directory.

### MDM deployment (PrivacyPreferencesPolicyControl)

Enterprise admins can pre-grant FDA via the `PrivacyPreferencesPolicyControl` payload. Target the bundle identifier `com.vinsly.desktop` with the `SystemPolicyAllFiles` service:

```xml
<dict>
  <key>IdentifierType</key>
  <string>bundleID</string>
  <key>Identifier</key>
  <string>com.vinsly.desktop</string>
  <key>CodeRequirement</key>
  <string>identifier "com.vinsly.desktop" and anchor apple generic</string>
  <key>Services</key>
  <dict>
    <key>SystemPolicyAllFiles</key>
    <dict>
      <key>Allowed</key>
      <integer>1</integer>
      <key>PromptUser</key>
      <false/>
    </dict>
  </dict>
</dict>
```

*Notes:*

- Deploy via the standard `com.apple.TCC.configuration-profile-policy` payload.
- Set the payload scope to “system” so both the GUI and the packaged helper inherit the entitlement.
- Even with MDM, leave watched directories configured for users who prefer selective access.

## 2. QA matrix

| Platform | Build | Scenarios to verify |
| --- | --- | --- |
| macOS 14 (Sonoma) – Apple Silicon | Release build | 1) Run Vinsly without FDA → confirm watched directories still work. 2) Grant FDA manually → “Check again” shows *Granted*. 3) Remove FDA and rerun to confirm warning text toggles off `fullDiskAccessEnabled`. |
| macOS 14 (Sonoma) – Intel | Release build | 1) Trigger “Open System Settings” and confirm the URL fallback works if `/usr/bin/open -b` fails. 2) Run a home scan with FDA on/off and confirm the helper (listed as `Vinsly` in System Settings) appears. |
| macOS 15 (Sequoia beta) – Apple Silicon | Release build | 1) Confirm the Sequoia note appears in Activation + Settings. 2) Verify home scans with `includeProtectedDirs=true` execute through the packaged `scan-helper` sidecar (check `Console.app` or `ps`). 3) Confirm the UI surfaces the `scan-helper` warning if the helper binary is missing. |
| macOS 15 (Sequoia beta) – Intel | Release build | 1) Repeat FDA grant via HT210595, ensuring the helper still runs even if it disappears from the System Settings UI. 2) Run through an MDM-delivered PrivacyPreferencesPolicyControl profile and confirm `check_full_disk_access` logs show the TCC grant. |

**Regression checks**

- Toggle FDA off and ensure watched folders messaging shows the fallback copy.
- Use the “Open System Settings” action while intentionally breaking `/usr/bin/open` (rename temporarily) to confirm the URL-only fallback and error copy fire.
- For each matrix entry validate `src/components/SettingsModal` and the Activation wizard report “macOS is still blocking Desktop/Documents…” when FDA is denied.

Document last updated after implementing `docs/full-disk-access-spec.md`. Keep this guide beside QA artifacts and delete the spec once the checklist is complete.
