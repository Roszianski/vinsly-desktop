# Vinsly Desktop - Agent Studio

A Tauri-powered desktop application for designing, organising, and analysing Claude AI agents. This is the desktop version of the Vinsly Agent Studio, with native integration for file system operations and desktop-first workflows.

## Features

- 🖥️ **Native Desktop Experience** – Built with Tauri 2.0 for a fast, secure, and lightweight desktop application.
- 📁 **File System Integration** – Direct access to `~/.claude/agents/` and project-level `.claude/agents/` directories.
- 🔧 **Agent Management** – Create, edit, duplicate, favourite, and organise your Claude agents with a focused editor.
- 🧰 **Skill Library** – Inspect and edit Claude Code Skills (folders with `SKILL.md`) alongside your subagents, keeping workflows and personas in sync.
- 🧠 **Swarm View** – See your “agent organisation” as a mind-map style graph, grouped by scope, with exportable diagrams.
- 📊 **Analytics Dashboard** – Track agent complexity, model distribution, tool usage, and get data-driven recommendations.
- 🔍 **Scan & Watch** – Scan global and project directories for agents, and configure watched folders for auto‑discovery.
- 💾 **Persistent Storage** – Settings, layout preferences, and local account details are stored using Tauri Store.
- 🎨 **Light/Dark Themes** – System-aware theming with a dedicated appearance section in Settings.
- 📥 **Import/Export** – Import agents from `.md` and `.zip` bundles, export individual agents or curated sets.
- 🧭 **Guided Tours** – Inline guided tours to explain List, Map, Analytics, and editor flows directly in the app.
- 🔐 **Licensing & Account (beta)** – In-app licence key + email activation flow (backed by Lemon Squeezy), plus a local display name used across the UI (e.g. "[Name] Organisation").

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

- **Node.js** (v18 or higher)
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
│   │   ├── screens/             # Main screen components
│   │   ├── analytics/           # Analytics visualizations
│   │   ├── form/                # Form components
│   │   ├── icons/               # Icon components
│   │   ├── tools/               # Tool selector components
│   │   └── wizard/              # Wizard step components
│   ├── utils/                   # Utility functions
│   │   ├── storage.ts           # Tauri Store wrapper (settings, licence, display name)
│   │   ├── tauriCommands.ts     # Rust command wrappers (agent filesystem)
│   │   ├── agentImport.ts       # Agent import from files / zip
│   │   ├── agentExport.ts       # Agent export to zip
│   │   ├── analytics.ts         # Analytics calculations & recommendations
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

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build frontend for production
- `npm run tauri dev` - Run Tauri app in development mode
- `npm run tauri build` - Build Tauri app for production
- `npm run reset:user-data` - Remove cached settings/licence data from the OS app-support folder (handy for testing first-run flows)

## Resetting Local Data

Vinsly persists licence details, onboarding flags, and scan preferences via Tauri Store inside the platform app-support directory (`~/Library/Application Support/com.vinsly.desktop` on macOS, `%APPDATA%\com.vinsly.desktop` on Windows, `~/.config/com.vinsly.desktop` on Linux).  
Run `npm run reset:user-data` any time you need to simulate a clean install on your development machine, or delete the folder manually if you prefer.

## Tauri Commands

The application exposes several Rust commands for native functionality:

### File Operations
- `list_agents(scope, projectPath?)` – List all agent files from project or global scope.
- `read_agent(path)` – Read a single agent file.
- `write_agent(scope, name, content, projectPath?)` – Write an agent file (creating directories if needed).
- `delete_agent(path)` – Delete an agent file.
- `list_agents_from_directory(directory)` – Scan an arbitrary directory for `.claude/agents` content.

### System
- `get_home_dir()` – Get cross-platform home directory path.

## macOS Home Scan Permissions

The optional “scan home directory for project agents” feature now skips macOS-protected folders (Desktop, Documents, Downloads, Music, Pictures, Movies, Applications, Library/iCloud Drive, etc.) to avoid the OS bombarding users with permission alerts.  
Add any protected locations you care about as watched folders in Settings if you still need them indexed.

## Development Notes

### Debugging
- Enable Tauri DevTools in development mode
- Rust logs available in terminal
- Frontend console available via browser DevTools

### Building for Distribution
```bash
npm run tauri build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`

### Auto-Updates System

Vinsly Desktop includes a fully automated update system:

**Update Endpoint**: `https://raw.githubusercontent.com/Roszianski/vinsly-updates/main/latest.json`

**How It Works**:
1. Private repo builds and cryptographically signs installers
2. GitHub Actions creates a release with signed binaries
3. Workflow generates `latest.json` with download URLs
4. Manifest is automatically pushed to [public updates repo](https://github.com/Roszianski/vinsly-updates)
5. Vinsly Desktop periodically checks for updates

**Creating a Release**:
```bash
# 1. Bump version in src-tauri/tauri.conf.json (e.g., "0.1.0" -> "0.1.1")

# 2. Commit the version change
git add src-tauri/tauri.conf.json
git commit -m "Bump version to 0.1.1"

# 3. Create and push version tag to trigger automated workflow
git tag v0.1.1
git push origin main  # or your branch name
git push origin v0.1.1
```

The GitHub Actions workflow will automatically:
- Build for macOS (Intel & Apple Silicon) and Windows
- Sign all installers with Tauri signing keys
- Create GitHub Release with binaries
- Generate and publish update manifest

**Setup Requirements**:
1. GitHub token `VINSLY_UPDATES_TOKEN` configured in repo secrets (see [vinsly-updates README](https://github.com/Roszianski/vinsly-updates))
2. Tauri signing keys in `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets

### Permissions
All permissions are configured in `src-tauri/capabilities/default.json`. The application has access to:
- File system read/write
- Dialog (open/save)
- Store (persistent storage)

## Hook Architecture & Call Order

`App.tsx` composes the custom hooks in this order:
- `useTheme` → `usePlatformInfo` → `useUserProfile` → `useNavigation` (independent UI state)
- `useLicense` (depends on platformIdentifier; exposes reset + onboarding flags)
- `useScanSettings` (scan settings state + ref for synchronous reads)
- `useWorkspace` (depends on `scanSettingsRef` + `isOnboardingComplete`; handles scanning, CRUD, cache)
- `useUpdater` (unchanged)

Integration example: activation completion calls `useLicense.setLicense`, applies scan settings via `useScanSettings`, then triggers `useWorkspace.loadAgents`.

## Quick Manual QA Checklist

- Activation/onboarding: licence validation, display name, scan defaults, home directory scan gating.
- Theme toggle: header toggle flips DOM class and persists.
- Agents: create/edit/duplicate/delete, bulk delete, import/export, favorites, watched directory scan.
- Skills: create/edit/delete, import/export, favorites, reveal/export selected skills.
- Navigation: list ↔ team ↔ skills ↔ analytics transitions; shortcuts (⌘/Ctrl + N) open create.
- Auto-update: manual check, snooze, auto-update toggle feedback.
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

## Pricing & Licensing (Planned)

Vinsly Desktop is intended to be sold as a **pay‑to‑own** product using Lemon Squeezy for billing and licence key distribution.

- **Launch pricing (planned)** – Initial target is **USD 49–59** one‑time, including at least 12 months of updates.
- **Future pricing** – As deeper Claude Skills / automation features are added, the standard one‑time price may move towards **USD 79–89**, with optional “supporter” or “Pro” tiers for users who want to support development more directly.
- **No subscription required** – The goal is a simple, developer‑friendly one‑off purchase rather than a recurring subscription for the core desktop app.

Details may evolve as the product and licensing integration mature, but the intent is to keep activation straightforward: buy on the landing page, receive a Lemon Squeezy licence key, and activate inside the app using the built‑in licence + email flow.

### Lemon Squeezy API Key Expiry

When generating a Lemon Squeezy **License API key** for Vinsly:

- Prefer a **long‑lived key** (e.g. **12 months**), not a short‑lived token.
- This key is baked into the desktop build via `VITE_LEMON_LICENSE_API_KEY` so the app can call Lemon’s License API to validate keys.
- If the key expires too soon, older installers become unable to validate licences.
- Before the key expires:
  - Create a **new** License API key in Lemon.
  - Rebuild Vinsly with `VITE_LEMON_LICENSE_API_KEY` set to the new key.
  - Ship an update and encourage users to upgrade.
- Once most users are on a build that uses the new key, you can safely revoke the old key in Lemon.
