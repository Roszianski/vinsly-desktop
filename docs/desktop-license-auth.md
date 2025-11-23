# Vinsly Desktop – Licence Authentication

This document describes how the **desktop app** talks to the licence server to validate a user’s licence key (and optionally their email).

## 1. What the app collects

- **Licence key** (required) – pasted from the purchase email.
- **Email (optional)** – entered in the activation modal.
  - Used for: local “Account” display and easier support lookup.
  - The backend already knows the purchase email from Lemon Squeezy webhooks, so activation does not depend on this field.

## 2. First‑time activation (online)

On first launch, before the main UI:

- **Internet connection is required** for this step. If the device is offline, the app blocks activation and asks the user to turn Wi‑Fi on so the licence key can be validated.
- There is **no separate “online checks” toggle** in the UI – whenever the app can reach the licence server, it validates automatically.

1. Show the activation modal and collect:
   - `licenseKey` (required)
   - `email` (optional)
2. Compute a stable **`deviceFingerprint`** (e.g. hash of machine ID + OS + CPU).
3. Call the licence server:

   ```http
   POST /api/license/activate
   Content-Type: application/json

   {
     "licenseKey": "XXXX-XXXX-XXXX-XXXX",
     "deviceFingerprint": "<hashed-machine-id>",
     "platform": "mac|win|linux",
     "appVersion": "1.0.0"
   }
   ```

4. If the server accepts the activation, it returns:
   - `token` – signed activation token (JWT or similar).
   - `licenseStatus` – e.g. `active`.
   - `maxDevices` – device limit for this licence.
5. The app stores, via Tauri Store:
   - The **activation token**.
   - Local `LicenseInfo` (licence key, email if provided, status, lastChecked).
   - Optional display name and onboarding preferences.

If activation fails, the app shows the error and keeps the user on the activation screen.

## 3. Subsequent launches

On every launch after activation:

1. Load the stored activation `token` and `LicenseInfo`.
2. Recompute `deviceFingerprint`.
3. Call the heartbeat endpoint:

   ```http
   POST /api/license/heartbeat
   Content-Type: application/json

   {
     "token": "<signed-activation-token>",
     "deviceFingerprint": "<hashed-machine-id>",
     "appVersion": "1.0.0"
   }
   ```

4. If the response is OK:
   - Update `lastChecked`.
   - Continue into the main app.
5. If the response indicates revoked / refunded / device limit issues:
   - Mark the local licence as non‑active.
   - Re‑open the activation modal to let the user fix the problem or enter a new key.

## 4. Offline behaviour

- Offline behaviour applies **only after at least one successful activation**.
- If, on a subsequent launch, the app cannot reach the licence server:
  - Use the **last known good** status with a short grace period (e.g. 7 days since `lastChecked`).
  - Show a warning in Settings → Account if we are in grace mode.
- Once connectivity returns, the next heartbeat call will refresh the licence status.

## 5. Email handling summary

- The **licence server does not require email** for `/activate` or `/heartbeat`.
- We collect email in the UI for:
  - Local display in Settings → Account.
  - Easier mapping of support tickets to a given installation.
- Email is optional for the user; leaving it blank does not block activation.
