# Privacy Policy

**Last updated:** December 2024

## Overview

Vinsly Desktop is a desktop application that runs locally on your computer. We are committed to protecting your privacy and being transparent about what data the application handles.

## Data Collection

### What We DO NOT Collect

- We do not collect analytics or telemetry
- We do not track your usage patterns
- We do not collect personal information beyond what's needed for licensing
- We do not have access to your Claude agents, skills, or configuration files

### What We DO Collect

**License Activation Only:**
When you activate your license, the following information is sent to Lemon Squeezy (our payment processor) for validation:
- Your license key
- Your email address (used during purchase)
- A device instance identifier (for managing activations across devices)

This data is sent directly to Lemon Squeezy's License API and is governed by [Lemon Squeezy's Privacy Policy](https://www.lemonsqueezy.com/privacy).

### Data Stored Locally

The following data is stored on your computer only (never transmitted):
- Your license information (for offline grace period support)
- Application preferences (theme, layout, display name)
- Scan settings and watched directories
- Window state and UI preferences

This data is stored using Tauri's secure local storage and remains on your device.

## Network Requests

Vinsly Desktop makes the following network requests:

1. **License Validation** (on app launch)
   - Endpoint: `api.lemonsqueezy.com`
   - Purpose: Verify your license is valid
   - Data sent: License key, email, instance ID

2. **Update Check** (on app launch)
   - Endpoint: `raw.githubusercontent.com/Roszianski/vinsly-updates`
   - Purpose: Check if a new version is available
   - Data sent: None (read-only fetch of version manifest)

## Third-Party Services

- **Lemon Squeezy**: Payment processing and license validation. See their [Privacy Policy](https://www.lemonsqueezy.com/privacy).
- **GitHub**: Hosting update manifests and release downloads. See their [Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## Your Rights

Since we don't collect personal data beyond license validation:
- Your agents, skills, and configurations never leave your device
- You can delete all local data by removing the app and its data folder
- License data can be cleared from Settings within the app

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be noted in the "Last updated" date above.

## Contact

For privacy-related questions, contact: support@vinsly.com
