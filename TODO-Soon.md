# TODO – Near Term (unified)

## Claude high-impact items (not yet implemented)
- [ ] Consolidate agent/skill flows into a generic resource system (shared list/editor, unified CRUD in `useWorkspace`, shared YAML frontmatter parser).
- [ ] Add a comprehensive error-handling/safety layer (async wrappers with toasts, path validation, ZIP size/timeout limits).
- [ ] Implement undo/redo for destructive actions (delete/bulk delete/edit/favorite) with history + shortcuts and toast actions.
- [ ] Refactor `App.tsx` into composable modules/contexts (<300 lines per file).
- [ ] Expand test coverage for imports/exports/parsers/search and key components (agent/skill lists + editors).

## Safety, resilience, and correctness
- [ ] Activation/onboarding gating: start activationPresented/onboarding flags false and block `loadAgents` until activation/onboarding completes; hide agents until scan prefs are chosen.
- [ ] Licensing resilience: HTTPS-only licence server URL, request timeouts/backoff, and an offline grace window so transient heartbeat failures don’t wipe stored licences.
- [ ] Filesystem safety (Rust + UI): sanitize names/paths, canonicalize project roots, refuse symlinks/out-of-scope targets, and enforce size limits on imports/exports; keep writes inside `.claude/{agents,skills}`.
- [ ] Scan pipeline robustness: coalesce scan triggers, add cancellation/abort tokens for overlapping scans, clean scan timers, and parallelize per-directory work or push aggregation into a single Rust command to avoid stale overwrites.
- [ ] Updater/capability hardening: ship the real updater pubkey (or disable updater until ready) and scope/remove the process plugin so only relaunch is permitted; confirm updater endpoint + manifest publishing flow.

## Release/update hygiene (from UPDATES)
- [ ] Keep a release checklist: version bump → build macOS/Windows/Linux installers → generate/publish manifest → upload assets to the release endpoint.
- [ ] Add Windows CI build if no local Windows builder; ensure installers + manifest are published together.
