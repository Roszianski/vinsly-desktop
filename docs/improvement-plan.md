# Vinsly Improvement Plan (WIP)

## Prioritized actions (focus first)
- Move Lemon validation behind a Cloudflare Worker (server-only key) and remove `VITE_LEMON_LICENSE_API_KEY*` + `src/utils/lemonLicensingClient.ts` from the app bundle.
- Harden arbitrary directory scans in `src-tauri/src/lib.rs` (`list_agents_from_directory` / `list_skills_from_directory`): expand `~`, canonicalize, and enforce `.claude/agents|skills` so paths outside the sandbox are rejected.
- Configure the Tauri updater signing key in `src-tauri/tauri.conf.json` (replace placeholder `pubkey`) and require valid signatures before installing updates.
- Gate onboarding correctly: `src/App.tsx` initializes onboarding as complete and loads agents/skills before the walkthrough; persist the onboarding flag and block scans until onboarding finishes.
- Fix frontmatter round-tripping for agents/skills by replacing regex parsing with a YAML AST serializer/parser to preserve multiline/colon/array fields.

## Full improvement list (incl. prior 10 suggestions)
- **Lemon secret exposure**: Secret key currently ships in frontend; move to Cloudflare Worker (or other backend) proxy.  
- **Path scope hardening**: Guard `list_agents_from_directory` / `list_skills_from_directory` with path expansion + `.claude/*` enforcement.  
- **Updater integrity**: Real Tauri `pubkey` instead of placeholder to verify updates.  
- **Onboarding gate bug**: Do not scan/load until onboarding completes and activation is closed.  
- **Frontmatter fidelity**: Use YAML AST for import/export; avoid regex + manual parsing.  
- **Licensing resilience**: Add retry/backoff and better error handling around `sendHeartbeat` so transient failures don’t drop licenses.  
- **Network timeouts**: Add `AbortController` timeouts and limited retries to licensing fetches (Lemon + license server).  
- **Zip import I/O**: Replace `fetch('tauri://...')` in `importAgentsFromZipPath` with plugin-fs or a Rust helper to handle paths with spaces and stay within FS allowlist.  
- **Path dedup/merge correctness**: Normalize agent/skill paths (home expansion, slash/case) before deduping to avoid duplicate entries.  
- **Testing gap**: Add Vitest for TS utilities + Rust tests for scanner/path guards.  
- **Type-safety gaps (user-raised)**: Enable stricter TS (e.g., `noUnusedLocals`, `strict`), remove `as any` casts, narrow frontmatter types or use discriminated unions where scope-dependent.  
- **Perf (user-raised)**: Memoize heavy list items, lower virtualization threshold (~50), use `useDeferredValue` for search, wrap list items in `React.memo`.

## Cloudflare Worker plan for Lemon validation
1) Create a Worker (HTTP handler).  
2) Add POST `/api/license/validate`: read `{ licenseKey }`, call Lemon validate with `Authorization: Bearer ${LEMON_LICENSE_API_KEY}`, short timeout (5–10s), 2–3 retries on 5xx/timeouts, return `{ valid, status, error? }`.  
3) Store the secret with `wrangler secret put LEMON_LICENSE_API_KEY` (and test key if needed).  
4) Deploy with `wrangler deploy`; note the `workers.dev` URL (or custom domain).  
5) Point the app to this endpoint, remove Lemon client code/env vars from the frontend, and update docs/env samples accordingly.

## Suggested order for tomorrow
1) Ship Cloudflare Worker proxy + remove frontend key usage.  
2) Patch Tauri path guards + onboarding gate.  
3) Set updater pubkey.  
4) Swap frontmatter parsing to YAML AST.  
5) Add timeouts/retries to licensing calls, then start a small Vitest/Rust test set.  
