## Vinsly Licensing & Onboarding (Lemon Squeezy)

This document captures the planned flow for selling & activating Vinsly using [Lemon Squeezy](https://www.lemonsqueezy.com/).

### 1. Activation & Validation

1. On first launch, before the main UI renders, Vinsly displays a blocking "Welcome" modal that asks for:
   - **Licence key**
   - **Email**
2. Clicking “Activate” calls Lemon Squeezy’s *Validate Licence Key* endpoint (key + email hash). If the key is valid, we store:
   - `licenseId`, `status`, `maxActivations`, etc.
   - the email entered by the user (even if Lemon Squeezy already has it). This lets support correlate keys → emails quickly and gives us a local contact reference.
3. By default we treat the licence as “active” after validation. Future work can call the *activate* endpoint to consume a seat.
4. Offline handling: cache the last-known-good licence response. Allow the app to launch for a short grace period (e.g. 7 days) without re-validation. When the device reconnects, silently re-check; if the key is revoked/expired, re-open the activation modal.

### 2. Username / Organisation Label

Immediately after activation succeeds, we ask the user for a **display name**. This value:

- Drives the Visualise view heading (`[Name] Organisation`).
- Lives purely on-device (Tauri store) and can be changed any time.
- Replaces the current hard-coded “Roszianski” placeholder. Until the user sets it, fallback copy can read “Your Organisation”.

### 3. Settings → Account

Add an “Account” section inside Settings with:

- **Licence status**: masked key (last 4 chars), status badge (Active / Expired / Suspended), “Check again” button to re-validate via Lemon Squeezy.
- **Email on file** (read-only for now). Later we can allow edits that revalidate the licence.
- **Change licence** button → clears the stored key + email and re-opens the activation modal.
- **Display name** input so users can rename their organisation whenever they like.
- Optional support links (“Having trouble? Contact support”).

### 4. Storage Shape (Tauri Store)

```ts
interface LicenseInfo {
  licenseKey: string;       // stored encrypted/obscured
  licenseId: string;
  email: string;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  lastChecked: string;      // ISO timestamp
}

interface LocalPreferences {
  licenseInfo?: LicenseInfo;
  userDisplayName?: string;
}
```

### 5. Future Enhancements

- Support “trial / demo” keys that allow limited functionality before purchase.
- Surface subscription data (renewal date, upgrade link) by querying Lemon Squeezy’s subscription endpoints.
- Handle multi-seat activations (show how many devices are in use, allow deactivation, etc.).

For the first implementation pass we’ll focus on the UI/UX described above without actually calling Lemon Squeezy yet. The activation modal will collect the key/email, store them locally, and guide the user through picking their display name so we can validate the flow end to end.***
