# Development Guide

This guide will help you set up your development environment and understand the Vinsly Desktop codebase.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)

## Prerequisites

- **Node.js** 22 or higher
- **Rust** (latest stable)
- **Platform-specific dependencies:**
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `webkit2gtk`, `libssl-dev`, `build-essential`
  - **Windows:** Visual Studio Build Tools

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Roszianski/vinsly-desktop.git
   cd vinsly-desktop
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional):**
   Create a `.env` file in the root directory:
   ```env
   VITE_LICENSE_SERVER_URL=http://localhost:4000
   ```

4. **Run in development mode:**
   ```bash
   npm run tauri dev
   ```

This will start both the Vite dev server and the Tauri app.

## Project Structure

```
vinsly-desktop/
├── src/                      # React/TypeScript source code
│   ├── components/           # React components
│   │   ├── screens/         # Full-screen views
│   │   ├── AppShell.tsx     # Main app shell
│   │   ├── Header.tsx       # App header
│   │   └── ...
│   ├── contexts/            # React contexts
│   │   ├── AppStateContext.tsx  # Main app state
│   │   └── ToastContext.tsx     # Toast notifications
│   ├── hooks/               # Custom React hooks
│   │   ├── useHistory.ts    # Undo/redo functionality
│   │   ├── useWorkspace.ts  # Agent/skill management
│   │   ├── useLicense.ts    # License validation
│   │   └── ...
│   ├── utils/               # Utility functions
│   │   ├── agentImport.ts   # Agent import logic
│   │   ├── errorHandler.ts  # Error handling
│   │   ├── fuzzyMatch.ts    # Search algorithm
│   │   └── ...
│   ├── types/               # TypeScript type definitions
│   │   ├── resource.ts      # Resource types
│   │   └── ...
│   ├── config/              # Configuration
│   │   └── resourceConfig.ts
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── src-tauri/               # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands
│   │   ├── scanner.rs      # File system scanning
│   │   └── ...
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── docs/                    # Documentation
│   ├── DEVELOPMENT.md      # This file
│   ├── RELEASE_CHECKLIST.md
│   └── UPDATER_SETUP.md
├── .github/
│   └── workflows/          # CI/CD workflows
└── package.json
```

## Development Workflow

### Running the App

```bash
# Development mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build
```

### Code Style

We use TypeScript for type safety. The codebase follows consistent formatting conventions:

- Use 2-space indentation
- Use single quotes for strings
- Add trailing commas in multi-line arrays/objects
- Keep lines under 100 characters where practical

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

3. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- useHistory.test.ts
```

### Test Structure

- **Unit tests:** Located in `__tests__` directories next to the code they test
- **Integration tests:** Located in `src/__tests__/integration/`
- **Test utilities:** Located in `src/test/utils/`

### Writing Tests

Example test for a utility function:

```typescript
// src/utils/__tests__/myUtil.test.ts
import { myUtil } from '../myUtil';

describe('myUtil', () => {
  it('should do something', () => {
    expect(myUtil('input')).toBe('expected output');
  });
});
```

Example test for a React hook:

```typescript
// src/hooks/__tests__/useMyHook.test.ts
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should manage state correctly', () => {
    const { result } = renderHook(() => useMyHook());

    act(() => {
      result.current.doSomething();
    });

    expect(result.current.value).toBe('expected');
  });
});
```

## Architecture

### State Management

Vinsly Desktop uses React hooks and context for state management:

- **AppStateContext:** Global app state (theme, user, workspace, etc.)
- **ToastContext:** Toast notifications
- **Individual hooks:** Specific functionality (useHistory, useWorkspace, etc.)

### Key Patterns

#### Resource System

Agents and skills are unified under a generic resource system:

```typescript
// Unified resource interface
interface BaseResource {
  id: string;
  name: string;
  scope: ResourceScope;
  path?: string;
  frontmatter: Record<string, any>;
  body: string;
}

// Type-specific extensions
interface AgentResource extends BaseResource {
  type: ResourceType.Agent;
  // agent-specific fields
}

interface SkillResource extends BaseResource {
  type: ResourceType.Skill;
  // skill-specific fields
}
```

#### Command Pattern (Undo/Redo)

All destructive operations use the command pattern:

```typescript
const command: Command = {
  description: 'Delete agent',
  execute: () => deleteAgent(agent),
  undo: () => restoreAgent(agent),
  cleanup: () => cleanupResources(),
};

await history.executeCommand(command);
```

#### Error Handling

Consistent error handling with toast notifications:

```typescript
import { withErrorHandling, withTimeout } from './utils/errorHandler';

const safeOperation = withErrorHandling(
  async () => {
    // risky operation
  },
  showToast,
  'Operation failed'
);

const timedOperation = withTimeout(
  async () => {
    // long-running operation
  },
  10000 // 10 second timeout
);
```

### Tauri Commands

Rust functions exposed to the frontend via Tauri commands:

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    Ok(format!("Received: {}", arg))
}
```

```typescript
// src/utils/tauriCommands.ts
import { invoke } from '@tauri-apps/api/core';

export async function myCommand(arg: string): Promise<string> {
  return invoke('my_command', { arg });
}
```

## Common Tasks

### Adding a New Feature

1. **Create types** in `src/types/`
2. **Add utilities** in `src/utils/`
3. **Create hooks** if needed in `src/hooks/`
4. **Add components** in `src/components/`
5. **Write tests** for all new code
6. **Update documentation**

### Adding a New Tauri Command

1. **Define in Rust:**
   ```rust
   // src-tauri/src/lib.rs
   #[tauri::command]
   fn new_command() -> Result<String, String> {
       Ok("Success".to_string())
   }
   ```

2. **Register in builder:**
   ```rust
   fn run() {
       tauri::Builder::default()
           .invoke_handler(tauri::generate_handler![new_command])
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```

3. **Add TypeScript wrapper:**
   ```typescript
   // src/utils/tauriCommands.ts
   export async function newCommand(): Promise<string> {
       return invoke('new_command');
   }
   ```

### Debugging

#### Frontend Debugging

Use Chrome DevTools (automatically opens in dev mode):
- `Cmd+Opt+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)

#### Backend Debugging

Add logging in Rust code:
```rust
println!("Debug: {:?}", value);
```

View logs in terminal where you ran `npm run tauri dev`.

## Contributing

### Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows the project style guide
- [ ] All tests pass (`npm test`)
- [ ] New code has tests
- [ ] No console errors or warnings
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive

### Pull Request Process

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** and add tests
3. **Run the full test suite** and ensure it passes
4. **Update documentation** if needed
5. **Create a pull request** with a clear description
6. **Address review feedback** promptly

### Commit Message Format

We follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Example:**
```
feat(agents): add bulk delete functionality

Implemented bulk delete for agents with undo support.
Includes keyboard shortcut (Cmd+Shift+Backspace).

Closes #123
```

## Resources

- [Tauri Documentation](https://tauri.app/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

## Getting Help

- **GitHub Issues:** Report bugs or request features
- **GitHub Discussions:** Ask questions or discuss ideas
- **Documentation:** Check `docs/` directory for guides

## License

See LICENSE file in the repository root.
