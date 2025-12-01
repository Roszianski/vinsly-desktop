# App.tsx Refactoring Guide (Phase 4)

Guide for refactoring the 900-line App.tsx into a composable, maintainable architecture.

## Current Issues

**App.tsx (900+ lines) handles too many responsibilities:**
- Navigation state management
- Theme management
- License validation
- Update checking/installation
- Workspace management (agents/skills)
- Keyboard shortcuts
- Toast notifications
- Scan settings
- Platform detection
- User profile

## Target Architecture

```
App.tsx (150 lines)
├── AppStateProvider (unified context)
│   ├── useTheme
│   ├── useLicense
│   ├── useWorkspace
│   ├── useNavigation
│   ├── useScanSettings
│   ├── usePlatformInfo
│   ├── useUserProfile
│   └── useHistory (undo/redo)
├── AppShell (layout)
│   ├── Header
│   └── Main content area
├── AppKeyboardShortcuts (global shortcuts)
├── AppUpdateManager (update logic)
└── AppScreenRouter (screen selection)
```

## Step 1: Create AppStateContext

```typescript
// src/contexts/AppStateContext.tsx

import React, { createContext, useContext } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useLicense } from '../hooks/useLicense';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigation } from '../hooks/useNavigation';
import { useScanSettings } from '../hooks/useScanSettings';
import { usePlatformInfo } from '../hooks/usePlatformInfo';
import { useUserProfile } from '../hooks/useUserProfile';
import { useHistory } from '../hooks/useHistory';
import { useToast } from './ToastContext';

interface AppStateContextType {
  theme: ReturnType<typeof useTheme>;
  license: ReturnType<typeof useLicense>;
  workspace: ReturnType<typeof useWorkspace>;
  navigation: ReturnType<typeof useNavigation>;
  scanSettings: ReturnType<typeof useScanSettings>;
  platformInfo: ReturnType<typeof usePlatformInfo>;
  userProfile: ReturnType<typeof useUserProfile>;
  history: ReturnType<typeof useHistory>;
  toast: ReturnType<typeof useToast>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const theme = useTheme();
  const license = useLicense({ showToast: toast.showToast });
  const platformInfo = usePlatformInfo();
  const userProfile = useUserProfile({ showToast: toast.showToast });
  const scanSettings = useScanSettings(platformInfo.isMacPlatform);
  const navigation = useNavigation();
  const history = useHistory({ maxStackSize: 20 });

  // useWorkspace depends on other hooks
  const workspace = useWorkspace({
    showToast: toast.showToast,
    scanSettingsRef: scanSettings.scanSettingsRef,
    licenseInfo: license.licenseInfo,
    onScanComplete: () => {
      // Handle scan completion
    },
  });

  const value: AppStateContextType = {
    theme,
    license,
    workspace,
    navigation,
    scanSettings,
    platformInfo,
    userProfile,
    history,
    toast,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};
```

## Step 2: Create AppKeyboardShortcuts

```typescript
// src/components/AppKeyboardShortcuts.tsx

import React from 'react';
import { useKeyboardShortcuts, CommonShortcuts } from '../hooks/useKeyboardShortcuts';
import { useAppState } from '../contexts/AppStateContext';

export const AppKeyboardShortcuts: React.FC = () => {
  const { history, toast, navigation, workspace } = useAppState();

  useKeyboardShortcuts([
    // Undo/Redo
    CommonShortcuts.undo(async () => {
      const description = await history.undo();
      if (description) {
        toast.showToast('success', `Undone: ${description}`);
      }
    }, history.canUndo),

    CommonShortcuts.redo(async () => {
      const description = await history.redo();
      if (description) {
        toast.showToast('success', `Redone: ${description}`);
      }
    }, history.canRedo),

    // Create new agent
    CommonShortcuts.new(() => {
      if (navigation.currentView === 'agent-list') {
        navigation.navigateToCreate();
      }
    }),

    // Search
    CommonShortcuts.find(() => {
      // Focus search input
      document.querySelector<HTMLInputElement>('[type="search"]')?.focus();
    }),

    // Close/Escape
    CommonShortcuts.escape(() => {
      if (navigation.currentView !== 'agent-list') {
        navigation.navigateHome();
      }
    }),
  ]);

  return null; // This component doesn't render anything
};
```

## Step 3: Create AppUpdateManager

```typescript
// src/components/AppUpdateManager.tsx

import React, { useEffect, useState } from 'react';
import { useUpdater } from '../hooks/useUpdater';
import { useAppState } from '../contexts/AppStateContext';

export const AppUpdateManager: React.FC = () => {
  const { toast } = useAppState();

  const updater = useUpdater({
    onUpdateAvailable: (version) => {
      toast.showToast('info', `Update available: ${version}`, 10000, {
        label: 'Install Now',
        onClick: () => updater.installUpdate(),
      });
    },
    onUpdateError: (error) => {
      toast.showToast('error', `Update failed: ${error.message}`);
    },
  });

  // Auto-check for updates on mount
  useEffect(() => {
    if (updater.autoUpdateEnabled) {
      updater.checkForUpdates();
    }
  }, []);

  return null; // This component doesn't render anything
};
```

## Step 4: Create AppShell

```typescript
// src/components/AppShell.tsx

import React from 'react';
import { Header } from './Header';
import { useAppState } from '../contexts/AppStateContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { theme, workspace, scanSettings, navigation, platformInfo, userProfile, license } = useAppState();

  return (
    <div className={theme.theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary">
        <Header
          onThemeToggle={theme.toggleTheme}
          currentTheme={theme.theme}
          onScan={() => workspace.loadAgents()}
          isScanBusy={workspace.isScanBusy}
          onOpenSettings={() => {/* open settings */}}
          // ... other header props
        />

        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
```

## Step 5: Create AppScreenRouter

```typescript
// src/components/AppScreenRouter.tsx

import React from 'react';
import { useAppState } from '../contexts/AppStateContext';
import { AgentListScreen } from './screens/AgentListScreen';
import { AgentEditorScreen } from './screens/AgentEditorScreen';
import { SkillListScreen } from './screens/SkillListScreen';
import { SkillEditorScreen } from './screens/SkillEditorScreen';
import { AgentTeamView } from './AgentTeamView';
import { AnalyticsDashboardScreen } from './screens/AnalyticsDashboardScreen';

export const AppScreenRouter: React.FC = () => {
  const { navigation, workspace, history, toast } = useAppState();

  switch (navigation.currentView) {
    case 'agent-list':
      return (
        <AgentListScreen
          agents={workspace.agents}
          onSelect={navigation.navigateToEdit}
          onCreate={navigation.navigateToCreate}
          onDuplicate={workspace.duplicateAgent}
          onDelete={(agent) => workspace.deleteAgent(agent, history, toast)}
          // ... other props
        />
      );

    case 'agent-editor':
      return (
        <AgentEditorScreen
          agent={navigation.selectedAgent}
          onSave={(agent) => workspace.saveAgent(agent, history, toast)}
          onCancel={navigation.navigateHome}
          // ... other props
        />
      );

    case 'skill-list':
      return (
        <SkillListScreen
          skills={workspace.skills}
          onSelect={navigation.navigateToEdit}
          onCreate={navigation.navigateToCreate}
          onDuplicate={workspace.duplicateSkill}
          onDelete={(skill) => workspace.deleteSkill(skill, history, toast)}
          // ... other props
        />
      );

    case 'skill-editor':
      return (
        <SkillEditorScreen
          skill={navigation.selectedSkill}
          onSave={(skill) => workspace.saveSkill(skill, history, toast)}
          onCancel={navigation.navigateHome}
          // ... other props
        />
      );

    case 'team-view':
      return (
        <AgentTeamView
          agents={workspace.agents}
          skills={workspace.skills}
        />
      );

    case 'analytics':
      return (
        <AnalyticsDashboardScreen
          agents={workspace.agents}
          skills={workspace.skills}
        />
      );

    default:
      return <AgentListScreen {...} />;
  }
};
```

## Step 6: Refactored App.tsx

```typescript
// src/App.tsx (reduced from 900 to ~150 lines)

import React from 'react';
import { ToastProvider } from './contexts/ToastContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { AppShell } from './components/AppShell';
import { AppKeyboardShortcuts } from './components/AppKeyboardShortcuts';
import { AppUpdateManager } from './components/AppUpdateManager';
import { AppScreenRouter } from './components/AppScreenRouter';
import { ToastContainer } from './components/Toast';
import { ActivationModal } from './components/ActivationModal';
import { useAppState } from './contexts/AppStateContext';

// Inner component that uses AppState
const AppContent: React.FC = () => {
  const { license, toast } = useAppState();

  // Show activation modal if not licensed
  if (!license.isOnboardingComplete) {
    return (
      <ActivationModal
        onComplete={license.completeLicenseSetup}
        // ... other props
      />
    );
  }

  return (
    <>
      <AppKeyboardShortcuts />
      <AppUpdateManager />
      <AppShell>
        <AppScreenRouter />
      </AppShell>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </>
  );
};

// Main App component
const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </ToastProvider>
  );
};

export default App;
```

## Benefits

### Before Refactor
- ❌ 900+ lines in one file
- ❌ 10+ responsibilities in one component
- ❌ Difficult to test
- ❌ Hard to understand data flow
- ❌ Props drilling everywhere
- ❌ Duplicate code across screens

### After Refactor
- ✅ 150 lines in main file
- ✅ Single responsibility per component
- ✅ Easy to test in isolation
- ✅ Clear data flow through context
- ✅ No props drilling
- ✅ Reusable components

## Migration Steps

1. **Create AppStateContext** - Combine all hooks
2. **Extract AppKeyboardShortcuts** - Move keyboard logic
3. **Extract AppUpdateManager** - Move update logic
4. **Create AppShell** - Extract layout
5. **Create AppScreenRouter** - Extract routing logic
6. **Refactor App.tsx** - Use new components
7. **Test thoroughly** - Verify all functionality
8. **Remove old code** - Clean up once stable

## Testing Strategy

```typescript
// Test AppStateContext
test('provides all app state', () => {
  const { result } = renderHook(() => useAppState(), {
    wrapper: AppStateProvider,
  });

  expect(result.current.theme).toBeDefined();
  expect(result.current.workspace).toBeDefined();
  expect(result.current.history).toBeDefined();
});

// Test individual hooks still work
test('useWorkspace loads agents', async () => {
  const { result } = renderHook(() => useWorkspace({}));

  await act(async () => {
    await result.current.loadAgents();
  });

  expect(result.current.agents.length).toBeGreaterThan(0);
});
```

## Rollback Plan

If issues arise:
1. Keep old App.tsx as App.old.tsx
2. Switch back by renaming files
3. Fix issues in refactored version
4. Switch forward again when ready

## Success Metrics

- [ ] App.tsx < 200 lines
- [ ] All components < 400 lines
- [ ] All tests still pass
- [ ] No regression bugs
- [ ] Easier to understand
- [ ] Easier to modify
