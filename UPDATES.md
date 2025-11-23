# Updating Vinsly Desktop

## Simple explanation

- When you buy and activate Vinsly, you get the app on your computer like any other `.dmg` (Mac) or `.exe` (Windows).
- When I finish new features or fixes, I build a **new version of the app** on my side, which produces new installers (`.dmg` / `.exe`) and a tiny file saying “this is the latest version”.
- I upload those built files to a place the app can see over the internet (for example, the **Releases** section of this same GitHub repo).
- Your Vinsly app occasionally checks that place.  
  - If it sees a newer version, it can show an **“Update available”** message inside the app.  
  - You click a button like **“Download and restart”**, and Vinsly downloads the new version and restarts into it.
- There will also be an **Auto‑update** switch in Settings. If you turn it on, Vinsly can download and install new versions in the background and then ask to restart when it’s ready.
- **Important:** simply pushing code to `main` on GitHub does **not** update users. Users only see an update when I build and publish a new installer as a “release”.

## Do I need a separate GitHub repo for updates?

No. You **do not** need a second repo just for updates.

- The **same GitHub repo** that holds the source code can also hold the built `.dmg` / `.exe` files.
- GitHub has a **Releases** section for each repo. That is usually where the built installers and the “latest version” file live.
- The app only cares about that release endpoint (a web link) where the files are hosted, not about how the code is organised.

If you ever want to, you *can* move the updates to another place (for example, an S3 bucket or a CDN), but that’s optional and can be done later just by changing a URL in the config.

## Slightly more technical (for future you)

- Tauri has a built‑in **updater**. It:
  - Looks at a small JSON file (a “manifest”) on a server.  
  - Compares the manifest’s version (for example `0.2.0`) with the app’s own version (from `src-tauri/tauri.conf.json`).  
  - If the manifest says there is a newer version and gives a link to the new `.dmg` / `.exe`, Tauri downloads and installs it.
- A typical release flow looks like:
  1. Bump the version in `src-tauri/tauri.conf.json` (for example from `0.1.0` to `0.2.0`).
  2. Run `npm run tauri build` to produce signed installers.
  3. Publish those installers (and the Tauri update manifest) to the **Releases** page of this repo or another HTTPS host.
  4. The running app checks that location; if it sees `0.2.0` and it’s higher than `0.1.0`, it offers the update.

In short: **updates are driven by published, built app files**, not by raw Git commits. Releasing an update is “build + upload + publish”, not just “git push”.

## In-app controls

- **Settings → Account → Updates** now shows the current app version, the last time a check ran, and whether a new build is waiting.
- Click **Check for updates** for a manual check; if one is found you can install it from the same panel or from the floating “Update available” popup.
- The **Auto-update** toggle saves your preference locally. When it’s on, Vinsly silently downloads and applies new builds (and prompts to restart once the installer finishes). When it’s off, you’ll only see the inline reminder + popup so you stay in control.

## Platform-specific builds (important)

- Building on **macOS** (e.g. `npm run tauri build` on your Mac) only produces the **Mac installer** (`.dmg`).
- To get a **Windows installer** (`.exe` / `.msi`), you must either:
  - Run `npm run tauri build` on a **Windows machine** with Node, Rust, and Tauri installed, or
  - Use a **CI workflow** (GitHub Actions) that runs the build on `windows-latest`.
- In practice: when you cut a new release, build on macOS for the `.dmg`, build on Windows for the `.exe`/`.msi`, then upload **both** installers to Lemon Squeezy and/or your GitHub Release.

### If you don’t have a Windows PC

- Easiest path: let **GitHub Actions** build Windows for you.
- Create a workflow (for example at `.github/workflows/windows-build.yml`) that:
  - Runs on `windows-latest`
  - Checks out this repo
  - Installs Node, Rust, and the Tauri CLI
  - Runs `npm install` then `npm run tauri build`
- The workflow can then attach the generated `.exe`/`.msi` to the GitHub Release so you can grab the Windows installer from your Mac and/or let the updater use it.
