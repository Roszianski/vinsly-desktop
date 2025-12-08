# Changelog

All notable changes to Vinsly Desktop are documented in this file.

## [1.0.0] - 2024-12-08

### First Stable Release

Vinsly 1.0 is the first stable release of the desktop IDE for designing, organizing, and analyzing Claude AI agents.

### Features

- **Agent Management** - Create, edit, duplicate, favorite, and organize Claude agents with a focused editor
- **Skill Library** - Inspect and edit Claude Code Skills (SKILL.md folders) alongside your subagents
- **Swarm View** - Mind-map style graph visualization of agent relationships, grouped by scope
- **Analytics Dashboard** - Track agent complexity, model distribution, tool usage, and get data-driven recommendations
- **Slash Commands & Memory** - Manage `.claude/commands` and CLAUDE.md memories across global and project scopes
- **MCP Servers** - Configure Model Context Protocol servers at user/project/local scope with favorites and toggles
- **Hooks** - Register shell hooks for Claude Code events (pre/post tool use, notifications, stop)
- **Session Monitor** - Detect and stop running Claude Code sessions, with quick reveal in Finder/Explorer
- **Import/Export** - Import agents from `.md` and `.zip` bundles, export individual agents or curated sets
- **Licensing & Account** - In-app license key + email activation flow backed by Lemon Squeezy
- **Auto-Updates** - Automatic update checking and installation across all platforms

### Platform Support

- macOS (Intel and Apple Silicon) - Signed and notarized
- Windows (x64) - NSIS installer
- Linux (x64) - AppImage and .deb packages

### Technical Highlights

- Built with Tauri 2.0 for native performance
- React 19 with TypeScript for the frontend
- Cross-platform CI/CD with signed releases
- Dark and light themes with system-aware switching

---

## Pre-1.0 Development History

### [0.1.8] - 2024-12
- Remove iCloud references from scanning copy
- Improve Settings UI and add autoscan options
- Enable Linux auto-updater support
- Add cross-platform stability and error handling improvements

### [0.1.7] - 2024-12
- Fix macOS configuration issues
- Add macOS signing configuration

### [0.1.6] - 2024-12
- Enable macOS code signing
- Fix failing tests

### [0.1.5] - 2024-12
- Enable updater signing
- Fix release workflow and artifact naming

### [0.1.4] - 2024-12
- Fix Windows build (switch from MSI to NSIS)
- Hide session stop button on non-macOS platforms
- Simplify update system

### [0.1.3] - 2024-12
- Add Linux to supported platforms
- Fix TypeScript build errors
- Security hardening with path canonicalization

### [0.1.2] - 2024-12
- Add updater permissions
- Security hardening and network retry logic
- Fix Lemon Squeezy license validation

### [0.1.1] - 2024-12
- Set up automated update system
- Implement auto-updates with GitHub Releases
- Add sessions panel improvements

### [0.1.0] - 2024-12
- Initial release
- Agent management system
- Skill library
- Swarm view visualization
- Analytics dashboard
- MCP server configuration
- Hooks management
- Session monitor
- Licensing system with Lemon Squeezy
- Full Disk Access detection for macOS
