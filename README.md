# Vinsly Desktop - Agent Studio

A Tauri-powered desktop application for designing, organising, and analysing Claude AI agents. This is the desktop version of the Vinsly Agent Studio, with native integration for file system operations and desktop-first workflows.

## Features

- 🖥️ **Native Desktop Experience** – Built with Tauri 2.0 for a fast, secure, and lightweight desktop application.
- 📁 **File System Integration** – Direct access to `~/.claude/agents/` and project-level `.claude/agents/` directories.
- 🔧 **Agent Management** – Create, edit, duplicate, favourite, and organise your Claude agents with a focused editor.
- 🧰 **Skill Library** – Inspect and edit Claude Code Skills (folders with `SKILL.md`) alongside your subagents, keeping workflows and personas in sync.
- 🧠 **Swarm View** – See your “agent organisation” as a mind-map style graph, grouped by scope, with exportable diagrams.
- 📊 **Agent Insights** – View agent metadata, model distribution, and tool configurations at a glance.
- 🔍 **Scan & Watch** – Scan global and project directories for agents, and configure watched folders for auto‑discovery.
- 🧾 **Slash Commands & Memory** – Manage `.claude/commands` and CLAUDE.md memories across global and project scopes, with import/export.
- 🌐 **MCP Servers** – Configure Model Context Protocol servers at user/project/local scope with favorites and toggles.
- 🪝 **Hooks** – Register shell hooks for Claude Code events (pre/post tool use, notifications, stop) across scopes.
- 🖥️ **Session Monitor** – Detect and stop running Claude Code sessions, with quick reveal in Finder/Explorer.
- 💾 **Persistent Storage** – Settings, layout preferences, and local account details are stored using Tauri Store.
- 🎨 **Light/Dark Themes** – System-aware theming with a dedicated appearance section in Settings.
- 📥 **Import/Export** – Import agents from `.md` and `.zip` bundles, export individual agents or curated sets.
- 🔐 **Licensing & Account** – In-app licence key + email activation flow (backed by Lemon Squeezy), plus a local display name used across the UI (e.g. "[Name] Organisation").

## Platform Support

Vinsly Desktop runs natively on all major desktop platforms:

- **macOS** – Intel and Apple Silicon (signed and notarized)
- **Windows** – x64 (NSIS installer)
- **Linux** – x64 (AppImage and .deb packages)

## UI/UX Design System

### Color Theme

**Dark Mode** (default):
- Background: `#15171c` (deep charcoal)
- Surface: `#1f2229` / `#2c313a` (layered grays)
- Text: `#f2f4f8` (soft white) / `#b7bdc8` (muted gray for secondary)
- Border: `#3d4450` (subtle division)
- Accent: `#C17356` (warm terracotta/rust) with hover state `#B06A4E`

**Light Mode**:
- Background: `#FBFBFA` (warm off-white)
- Surface: `#F7F7F5` / `#F0F0EE` (layered neutrals)
- Text: `#111111` (near black) / `#555555` (medium gray for secondary)
- Border: `#E5E5E3` (soft beige-gray)
- Accent: `#C17356` (same terracotta across both themes)

**Semantic Colors**:
- Success: `#00C851`
- Warning: `#ffbb33`
- Danger: `#ff4444`

### Aesthetic & Vibe

- **Typography**: Inter (UI) and Fira Code (monospace) – clean, modern, developer-focused
- **Border Radii**: Crisp and precise (max 0.625rem / 10px) – following professional desktop tool conventions like VS Code, Linear, and Figma rather than consumer app trends. Buttons, cards, modals, and inputs use subtle rounding that conveys focus and precision.
- **Animations**: Smooth Framer Motion transitions for view changes and interactions
- **Layout**: Spacious, breathable interfaces with clear hierarchy and generous whitespace
- **Tone**: Focused desktop tool for professionals – not playful or casual, but approachable and refined

When designing the landing page or related marketing materials, match this warm-neutral, professional aesthetic with the terracotta accent as the signature brand color.

## Prerequisites

Before running the Vinsly Desktop application, ensure you have:

- **Node.js** (v22 or higher)
- **Rust** (latest stable version) - Install from [rustup.rs](https://rustup.rs/)
- **Claude CLI** (optional, for future test console features) - Install following [Claude Code documentation](https://github.com/anthropics/claude-code)

## Installation

1. **Clone or navigate to the project**:
   ```bash
   cd vinsly-desktop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```

4. **Build for production**:
   ```bash
   npm run tauri build
   ```

## Project Structure

```
vinsly-desktop/
├── src/                          # React TypeScript frontend
│   ├── components/               # React components
│   │   ├── screens/             # Agents, skills, memory, commands, MCP, hooks, team graph
│   │   ├── form/                # Form components
│   │   ├── icons/               # Icon components
│   │   ├── tools/               # Tool selector components
│   │   └── wizard/              # Wizard step components
│   ├── contexts/                # App/Workspace/License/Navigation/Toast providers
│   ├── utils/                   # Utility functions
│   │   ├── storage.ts           # Tauri Store wrapper (settings, licence, display name)
│   │   ├── tauriCommands.ts     # Rust command wrappers (agents, skills, memory, commands, MCP, hooks, sessions)
│   │   ├── agentImport.ts       # Agent import from files / zip
│   │   ├── agentExport.ts       # Agent export to zip
│   │   ├── lemonLicensingClient.ts # Lemon Squeezy License API client
│   │   └── fuzzyMatch.ts        # Search functionality
│   ├── types.ts                 # Core TypeScript type definitions
│   ├── types/licensing.ts       # Licence-related types
│   ├── constants.ts             # Application constants
│   ├── animations.ts            # Framer Motion animations
│   └── App.tsx                  # Main application shell (routing, tours, activation)
│   └── hooks/                   # Custom hooks extracted from App
│       ├── useTheme.ts          # Theme + DOM class management
│       ├── usePlatformInfo.ts   # Platform detection + macOS version
│       ├── useUserProfile.ts    # Display name persistence
│       ├── useNavigation.ts     # View/selection routing + templates
│       ├── useLicense.ts        # Licence bootstrap/reset + heartbeat
│       ├── useScanSettings.ts   # Scan settings state + ref
│       ├── useWorkspace.ts      # Agents/skills scan + CRUD + cache
│       └── useUpdater.ts        # Updater (existing)
│
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   └── lib.rs              # Tauri commands and plugins
│   ├── capabilities/           # Permission configurations
│   │   └── default.json        # Default capability set
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
└── package.json                # Node.js dependencies
```

## Key Technologies

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization
- **JSZip** - ZIP file handling
- **@fontsource** - Self-hosted fonts (Inter, Fira Code)

### Backend (Tauri)
- **Tauri 2.0** - Native desktop framework
- **Rust** - Backend language
- **Tauri Plugins**:
  - `tauri-plugin-store` - Persistent key-value storage
  - `tauri-plugin-dialog` - Native file dialogs
  - `tauri-plugin-opener` - Reveal files in the OS file manager
  - `tauri-plugin-updater` - Auto-update functionality
  - `tauri-plugin-process` - Process management (restart after update)

## Integrated Terminal

Vinsly includes a built-in terminal powered by [xterm.js](https://xtermjs.org/) and [portable-pty](https://crates.io/crates/portable-pty). This allows running CLI tools like Claude Code and Codex directly within the app.

### Terminal Implementation Notes

The terminal required specific configuration to work correctly in **production builds** (not just `npm run tauri dev`):

1. **WebGL Renderer** (`@xterm/addon-webgl`)
   - The default canvas renderer has issues in Tauri's production WebView (WKWebView on macOS)
   - Cursor doesn't render and fonts display incorrectly without WebGL
   - Falls back to canvas if WebGL is unavailable
   - See: [xterm.js WKWebView Issue #3575](https://github.com/xtermjs/xterm.js/issues/3575)

2. **Login Shell Flags** (`-il`)
   - Production macOS apps launched from Finder/Dock don't inherit terminal environment
   - Shell must be spawned with `-il` flags to source `~/.zshrc` / `~/.bash_profile`
   - Without this, CLI tools like `claude` and `codex` are not found in PATH
   - Location: `src-tauri/src/terminal.rs`

3. **HTTPS Scheme** (`useHttpsScheme: true`)
   - Configured in `tauri.conf.json` under `app.windows`
   - Makes production WebView use `https://tauri.localhost` instead of `tauri://`
   - Improves compatibility with web APIs and rendering

4. **Environment Variables**
   - Explicitly sets `HOME`, `LANG`, `TERM`, `COLORTERM` for the PTY
   - Required because GUI apps don't inherit these from the user's shell

### Key Files

- `src/components/Terminal/TerminalTab.tsx` - xterm.js setup with WebGL addon
- `src/contexts/TerminalContext.tsx` - Terminal session management
- `src-tauri/src/terminal.rs` - Rust PTY implementation
- `src/index.css` - xterm.js CSS overrides

### Terminal Dependencies

```json
{
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-search": "^0.16.0",
  "@xterm/addon-web-links": "^0.11.0",
  "@xterm/addon-webgl": "^0.18.0"
}
```

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build:web` - Type-check + build frontend
- `npm run build:helper` - Build the macOS scan-helper binary
- `npm run build` - Build frontend and scan-helper (used by Tauri)
- `npm run preview` - Preview built frontend
- `npm run tauri dev` - Run Tauri app in development mode
- `npm run tauri build` - Build Tauri app for production
- `npm test` / `npm run test:watch` - Run Jest tests
- `npm run reset:user-data` - Remove cached settings/licence data from the OS app-support folder (handy for testing first-run flows)

## Resetting Local Data

Vinsly persists licence details, onboarding flags, and scan preferences via Tauri Store inside the platform app-support directory (`~/Library/Application Support/com.vinsly.desktop` on macOS, `%APPDATA%\com.vinsly.desktop` on Windows, `~/.config/com.vinsly.desktop` on Linux).  
Run `npm run reset:user-data` any time you need to simulate a clean install on your development machine, or delete the folder manually if you prefer.

## Tauri Commands

The app exposes a broad Rust command surface for agents/skills, slash commands, CLAUDE.md memory, MCP servers, hooks, Claude Code session detection, and safe import/export. See `docs/TAURI_COMMANDS.md` for the full, up-to-date IPC reference (parameters, validation, and scopes).

## macOS Home Scan Permissions

The optional "scan home directory for project agents" feature now skips macOS-protected folders (Desktop, Documents, Downloads, Music, Pictures, Movies, Applications, Library, etc.) to avoid the OS bombarding users with permission alerts.  
Add any protected locations you care about as watched folders in Settings if you still need them indexed.

## Development Notes

### Debugging
- Enable Tauri DevTools in development mode
- Rust logs available in terminal
- Frontend console available via browser DevTools
- Claude Code session monitor can reveal/terminate active sessions for local debugging

### Building for Distribution
```bash
npm run tauri build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`

### Auto-Updates System

Vinsly Desktop includes an update notification system:

**Update Endpoint**: `https://raw.githubusercontent.com/Roszianski/vinsly-updates/main/latest.json`

**How It Works**:
1. GitHub Actions builds signed installers for all platforms (macOS is notarized)
2. CI creates a GitHub release with signed binaries
3. Workflow generates `latest.json` with download URLs and signatures
4. Manifest is pushed to [public updates repo](https://github.com/Roszianski/vinsly-updates)
5. Vinsly Desktop checks for updates on app launch and shows a badge in Settings when an update is available

**Creating a Release**:
```bash
# 1. Bump version in src-tauri/tauri.conf.json (e.g., "0.1.0" -> "0.1.1")

# 2. Commit with bullet points for release notes (max 3 shown in update modal)
#    The CI extracts lines starting with "- " from the commit message
git add -A
git commit -m "Release v0.1.1 - Brief description

- First change shown in update modal
- Second change shown in update modal
- Third change shown in update modal"

# 3. Create and push version tag to trigger automated workflow
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

**Important**: The update modal shows bullet points from your commit message. Always include 3 lines starting with `- ` in your release commit message. These are automatically extracted and shown to users in the "What's New" section. Keep bullet points concise (3-5 words each) as space in the modal is limited.

**Known Issue (fixed in v0.11.2)**: The `notes` field in `latest.json` must use `\n` for newlines (e.g., `"- First\n- Second\n- Third"`). Prior to v0.11.2, the workflow used `tr '\n' '\\n'` which doesn't work for multi-character replacement, producing invalid escapes like `\-` instead of `\n-`. This broke JSON parsing in the Tauri updater, causing "no update available" even when updates existed. The workflow now uses `sed ':a;N;$!ba;s/\n/\\n/g'` for proper escaping. If you encounter this issue with older releases, manually fix the escaping in the [vinsly-updates repo](https://github.com/Roszianski/vinsly-updates).

The GitHub Actions workflow will automatically:
- Build for macOS, Windows (NSIS), and Linux (deb, AppImage)
- Create GitHub Release with binaries
- Generate update manifest (currently disabled in CI until signing is fully enabled) and publish to the updates repo when re-enabled

**Setup Requirements**:
1. GitHub token `VINSLY_UPDATES_TOKEN` configured in repo secrets (see [vinsly-updates README](https://github.com/Roszianski/vinsly-updates))
2. Tauri signing keys in `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets

### Permissions
All permissions are configured in `src-tauri/capabilities/default.json`. The application has access to:
- File system read/write
- Dialog (open/save)
- Store (persistent storage)

## Hook Architecture & Call Order

`App.tsx` wraps providers (`LicenseProvider` → `UpdateProvider` → `WorkspaceProvider` → `NavigationProvider`). `AppContent` composes the custom hooks roughly as:
- Theme/platform/user profile/navigation boot
- License bootstrap (activation + onboarding)
- Update bootstrap
- Scan settings + workspace loader (agents, skills, commands, memory, MCP, hooks, sessions) once onboarding completes

Integration example: activation completion calls `useLicense.setLicense`, applies scan settings via `useScanSettings`, then triggers `useWorkspace.loadAgents`.

## Quick Manual QA Checklist

- Activation/onboarding: licence validation, display name, scan defaults, home directory scan gating.
- Theme toggle: header toggle flips DOM class and persists.
- Agents: create/edit/duplicate/delete, bulk delete, import/export, favorites, watched directory scan.
- Skills: create/edit/delete, import/export, favorites, reveal/export selected skills.
- Slash commands: CRUD, import/export, favorites, watched directory scan.
- Memory: global/project CLAUDE.md edit/clone, import/export.
- MCP servers: list/add/update/remove across scopes; favorites.
- Hooks: add/update/remove across scopes; favorites.
- Sessions: detect/stop Claude Code sessions; open working directory.
- Navigation: list ↔ team ↔ skills ↔ analytics transitions; shortcuts (⌘/Ctrl + N) open create.
- Updates: manual check button, update badge on settings gear, install flow.
- Shell (process spawning)
- Event system (for streaming CLI output)

## Troubleshooting

### Build Issues
- Ensure Rust is installed and up to date: `rustup update`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Rust build cache: `cd src-tauri && cargo clean`

### Keeping Repository Size Small
The `src-tauri/target/` directory accumulates build artifacts (typically 2-3GB). To free up disk space during development:

```bash
cd src-tauri && cargo clean
```

This removes all compiled artifacts. They'll rebuild automatically on your next build. Consider running this periodically if disk space is limited.

### Runtime Issues
- Check that Claude CLI is in your PATH for Test Console features
- Verify permissions in capabilities configuration
- Check Tauri console for Rust backend errors

## Pricing & Licensing

Vinsly Desktop is a **pay‑to‑own** product using Lemon Squeezy for billing and licence key distribution.

- **Pricing** – One-time purchase, including updates.
- **No subscription required** – A simple, developer‑friendly one‑off purchase rather than a recurring subscription.

**Activation**: Purchase on the landing page, receive a Lemon Squeezy licence key, and activate inside the app using the built‑in licence + email flow.

### Lemon Squeezy API Notes

Vinsly calls Lemon's License API directly from the client to validate/activate keys. Prefer long‑lived licence keys on the Lemon side so older installers remain functional; rotate via normal app updates if you need to change products or variants.

## Documentation

- [CHANGELOG](./CHANGELOG.md) – Version history and release notes
- [LICENSE](./LICENSE) – Proprietary software license
- [PRIVACY](./PRIVACY.md) – Privacy policy
- [Tauri Commands Reference](./docs/TAURI_COMMANDS.md) – Full IPC command documentation

## Support

For questions, issues, or licensing inquiries: **support@vinsly.com**
