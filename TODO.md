# To-Do

- Ensure the walkthrough truly blocks agent loading: even if previous session data exists, defer loading until onboarding closes so new users don’t see agents before choosing scan preferences.

## Phase 2 – File robustness & safety (tomorrow)
- Swap regex frontmatter parsing/export with a YAML serializer so multiline descriptions, arrays, and colons round-trip cleanly.
- Sanitize agent names/paths in the Rust commands before writing/deleting to keep work inside `.claude/agents`.
- Finish cleaning up scan timers (wrap every interval in `finally` + share a helper) so failed scans never leak or leave stale “scanning…” states.

## Phase 3 – Security & performance hardening (complete)
- [x] Tighten Tauri capabilities to only the FS/dialog scopes the app actually uses; drop shell access in production builds.
- [x] Move home-directory discovery onto a blocking worker/cached background task and add simple cancellation/debounce so large disks don’t freeze the UI when rescanning.
