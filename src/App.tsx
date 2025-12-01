import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getVersion } from '@tauri-apps/api/app';
import { Agent, AgentScope, ScanSettings, Skill } from './types';
import { LicenseInfo } from './types/licensing';
import { AgentListScreen } from './components/screens/AgentListScreen';
import { SkillListScreen } from './components/screens/SkillListScreen';
import { AgentEditorScreen } from './components/screens/AgentEditorScreen';
import { SkillEditorScreen } from './components/screens/SkillEditorScreen';
import { AgentTeamView } from './components/screens/AgentTeamView';
import { AnalyticsDashboardScreen } from './components/screens/AnalyticsDashboardScreen';
import { MemoryScreen } from './components/screens/MemoryScreen';
import { MemoryListScreen } from './components/screens/MemoryListScreen';
import { SlashCommandListScreen } from './components/screens/SlashCommandListScreen';
import { SlashCommandEditorScreen } from './components/screens/SlashCommandEditorScreen';
import { Header } from './components/Header';
import { pageTransition } from './animations';
import { getStorageItem, setStorageItem, removeStorageItem } from './utils/storage';
import { useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import { exportSkillDirectory, importSkillArchive, exportSkillsArchive, exportSlashCommandsArchive, importSlashCommandsArchive, exportMemoriesArchive, importMemoriesArchive } from './utils/tauriCommands';
import { saveScanSettings } from './utils/scanSettings';
import { ActivationModal } from './components/ActivationModal';
import { SplashScreen } from './components/SplashScreen';
import { DEFAULT_HOME_DISCOVERY_DEPTH, discoverHomeDirectories } from './utils/homeDiscovery';
import { useUpdater } from './hooks/useUpdater';
import { useTheme, Theme } from './hooks/useTheme';
import { UpdatePrompt } from './components/UpdatePrompt';
import { validateLicenseWithLemon } from './utils/lemonLicensingClient';
import { activateLicense, LicenseServerError, RemoteLicenseStatus } from './utils/licensingClient';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { usePlatformInfo } from './hooks/usePlatformInfo';
import { useUserProfile } from './hooks/useUserProfile';
import { useNavigation, View } from './hooks/useNavigation';
import { useLicense } from './hooks/useLicense';
import { useScanSettings } from './hooks/useScanSettings';
import { useWorkspace } from './hooks/useWorkspace';
import { useHistory } from './hooks/useHistory';
import { useClaudeMemory } from './hooks/useClaudeMemory';
import { useClaudeMemoryList } from './hooks/useClaudeMemoryList';
import { useSlashCommands } from './hooks/useSlashCommands';
import { AgentCommands, SkillCommands } from './utils/workspaceCommands';
import { useKeyboardShortcuts, CommonShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';

const AUTO_UPDATE_KEY = 'vinsly-auto-update-enabled';
const UPDATE_SNOOZE_KEY = 'vinsly-update-snooze';
const UPDATE_SNOOZE_DURATION_MS = 1000 * 60 * 60 * 6; // 6 hours
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24; // 24 hours
const HOME_DISCOVERY_MAX_DEPTH = DEFAULT_HOME_DISCOVERY_DEPTH;

const mapRemoteStatus = (status: RemoteLicenseStatus): LicenseInfo['status'] => {
  if (status === 'active') {
    return 'active';
  }
  if (status === 'expired') {
    return 'expired';
  }
  return 'revoked';
};

const App: React.FC = () => {
  const themeHook = useTheme();
  const { theme, toggleTheme: toggleThemeHook } = themeHook;
  const platform = usePlatformInfo();
  const { isMacLike, macOSMajorVersion, platformIdentifier } = platform;
  const { userDisplayName, setDisplayName } = useUserProfile();
  const { showToast, toasts, removeToast } = useToast();
  const scanSettingsHook = useScanSettings();
  const { scanSettings, scanSettingsRef, applyScanSettings, loadInitialSettings } = scanSettingsHook;
  const [appVersion, setAppVersion] = useState('');
  const workspaceClearRef = useRef<(() => Promise<void>) | null>(null);
  const license = useLicense({
    showToast,
    platformIdentifier,
    appVersion,
    onResetComplete: async () => {
      if (workspaceClearRef.current) {
        await workspaceClearRef.current();
      }
    },
  });
  const {
    licenseInfo,
    deviceFingerprint,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
    ensureDeviceFingerprint,
  } = license;
  const workspace = useWorkspace({
    showToast,
    scanSettingsRef,
    isOnboardingComplete,
  });
  const {
    agents,
    skills,
    isScanBusy,
    loadAgents,
    saveAgent: saveAgentToWorkspace,
    deleteAgent: deleteAgentFromWorkspace,
    bulkDeleteAgents,
    importAgents,
    toggleAgentFavorite,
    saveSkill: saveSkillToWorkspace,
    deleteSkill: deleteSkillFromWorkspace,
    toggleSkillFavorite,
  } = workspace;
  useEffect(() => {
    workspaceClearRef.current = workspace.clearWorkspaceCache;
  }, [workspace.clearWorkspaceCache]);
  const navigation = useNavigation({ agents: workspace.agents });
  const {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    navigateHome,
    navigateToEdit,
    navigateToCreate,
    navigateToDuplicate,
    navigateToSkillEdit,
    navigateToSkillCreate,
    navigateToCommandEdit,
    navigateToCommandCreate,
    navigateToMemoryEdit,
    navigateToMemoryCreate,
    navigateToView,
    cancelEditing,
  } = navigation;
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activationPresented, setActivationPresented] = useState(true);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [updateSnooze, setUpdateSnooze] = useState<{ version: string; until: string } | null>(null);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const autoUpdateTimerRef = useRef<number | null>(null);
  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
  } = useUpdater();

  // Undo/Redo support
  const history = useHistory({ maxStackSize: 20 });
  const { executeCommand, undo, redo, canUndo, canRedo } = history;

  // CLAUDE.md Memory support
  const memory = useClaudeMemory({ showToast });
  const {
    globalMemory,
    projectMemory,
    isLoading: isMemoryLoading,
    activeScope: memoryActiveScope,
    setActiveScope: setMemoryActiveScope,
    saveMemory,
  } = memory;

  // Memory list for discovering all CLAUDE.md files
  const memoryList = useClaudeMemoryList({ showToast, scanSettingsRef });
  const {
    memories,
    isLoading: isMemoryListLoading,
    loadMemories,
    toggleFavorite: toggleMemoryFavorite,
  } = memoryList;

  // Slash Commands support
  const slashCommands = useSlashCommands({ showToast });
  const {
    commands,
    isLoading: isCommandsLoading,
    loadCommands,
    saveCommand,
    deleteCommand,
    toggleFavorite: toggleCommandFavorite,
  } = slashCommands;

  // Keyboard shortcuts for undo/redo and ESC to close panels
  useKeyboardShortcuts([
    CommonShortcuts.undo(
      () => {
        void undo().then(description => {
          if (description) {
            showToast('info', `Undone: ${description}`);
          }
        });
      },
      canUndo
    ),
    CommonShortcuts.redo(
      () => {
        void redo().then(description => {
          if (description) {
            showToast('info', `Redone: ${description}`);
          }
        });
      },
      canRedo
    ),
    CommonShortcuts.escape(
      () => {
        if (showShortcutsPanel) {
          setShowShortcutsPanel(false);
        }
      },
      showShortcutsPanel
    ),
  ]);

  const refreshGlobalSkills = useCallback(async () => {
    await workspace.refreshGlobalSkills();
  }, [workspace.refreshGlobalSkills]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadAppVersion = async () => {
      if (typeof window === 'undefined' || !(window as any).__TAURI__) {
        return;
      }
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (error) {
        console.warn('Unable to read application version', error);
      }
    };
    loadAppVersion();
  }, []);

  useEffect(() => {
    const loadUpdatePreferences = async () => {
      const storedAutoUpdate = await getStorageItem<boolean>(AUTO_UPDATE_KEY);
      if (typeof storedAutoUpdate === 'boolean') {
        setAutoUpdateEnabled(storedAutoUpdate);
      }
      const storedSnooze = await getStorageItem<{ version: string; until: string }>(UPDATE_SNOOZE_KEY);
      if (storedSnooze) {
        setUpdateSnooze(storedSnooze);
      }
    };
    loadUpdatePreferences();
  }, []);

  useEffect(() => {
    if (!updateSnooze) {
      return;
    }
    const expiresAt = Date.parse(updateSnooze.until);
    if (Number.isNaN(expiresAt)) {
      return;
    }
    if (expiresAt <= Date.now()) {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
    }, expiresAt - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [updateSnooze]);

  useEffect(() => {
    if (activationPresented || !licenseBootstrapComplete) {
      return;
    }
    if (!showSplash) {
      if (!licenseInfo) {
        setIsActivationOpen(true);
      }
      setActivationPresented(true);
    }
  }, [licenseInfo, showSplash, activationPresented, licenseBootstrapComplete]);

  useEffect(() => {
    if (!licenseInfo || autoUpdateEnabled) {
      return;
    }
    const runInitialUpdateCheck = async () => {
      try {
        const update = await checkForUpdate();
        if (update) {
          showToast('info', `Vinsly ${update.version} is ready to install.`);
        }
      } catch (error) {
        console.warn('Initial update check failed', error);
      }
    };
    runInitialUpdateCheck();
  }, [licenseInfo, autoUpdateEnabled, checkForUpdate, showToast]);

  useEffect(() => {
    if (!licenseInfo || !autoUpdateEnabled) {
      if (autoUpdateTimerRef.current) {
        window.clearInterval(autoUpdateTimerRef.current);
        autoUpdateTimerRef.current = null;
      }
      return;
    }

    const checkAndInstall = async () => {
      try {
        const update = await checkForUpdate();
        if (update) {
          showToast('info', `Installing Vinsly ${update.version}…`);
          await installUpdate();
        }
      } catch (error) {
        console.warn('Auto-update cycle failed', error);
        showToast('error', 'Auto-update failed. We will try again later.');
      }
    };

    void checkAndInstall();
    autoUpdateTimerRef.current = window.setInterval(() => {
      void checkAndInstall();
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      if (autoUpdateTimerRef.current) {
        window.clearInterval(autoUpdateTimerRef.current);
        autoUpdateTimerRef.current = null;
      }
    };
  }, [licenseInfo, autoUpdateEnabled, checkForUpdate, installUpdate, showToast]);

  useEffect(() => {
    if (!pendingUpdate || !updateSnooze) {
      return;
    }
    if (pendingUpdate.version !== updateSnooze.version) {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
    }
  }, [pendingUpdate, updateSnooze]);

  const handleManualUpdateCheck = useCallback(async () => {
    try {
      const update = await checkForUpdate();
      if (!update) {
        showToast('success', 'You are already on the latest version.');
        return;
      }
      if (autoUpdateEnabled) {
        showToast('info', `Installing Vinsly ${update.version}…`);
        await installUpdate();
        return;
      }
      showToast('info', `Vinsly ${update.version} is ready to install.`);
    } catch (error) {
      console.error('Manual update check failed', error);
      showToast('error', 'Unable to check for updates right now.');
    }
  }, [autoUpdateEnabled, checkForUpdate, installUpdate, showToast]);

  const handleAutoUpdateChange = useCallback(async (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    await setStorageItem(AUTO_UPDATE_KEY, enabled);
    if (!enabled || !licenseInfo) {
      return;
    }
    try {
      const update = await checkForUpdate();
      if (update) {
        showToast('info', `Installing Vinsly ${update.version}…`);
        await installUpdate();
      }
    } catch (error) {
      console.error('Auto-update toggle check failed', error);
      showToast('error', 'Automatic update check failed. Please try again later.');
    }
  }, [licenseInfo, checkForUpdate, installUpdate, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await installUpdate();
    } catch (error) {
      console.error('Update installation failed', error);
      showToast('error', 'Unable to install the update. Please try again.');
    }
  }, [installUpdate, showToast]);

  const handleSnoozeUpdatePrompt = useCallback(async () => {
    if (!pendingUpdate) {
      return;
    }
    const until = new Date(Date.now() + UPDATE_SNOOZE_DURATION_MS).toISOString();
    const payload = { version: pendingUpdate.version, until };
    setUpdateSnooze(payload);
    await setStorageItem(UPDATE_SNOOZE_KEY, payload);
  }, [pendingUpdate]);

  useEffect(() => {

    // Gate agent loading until onboarding completes and activation is closed
    if (!isOnboardingComplete || isActivationOpen) {
      return;
    }

    const initializeAgents = async () => {
      const storedSettings = await loadInitialSettings();

      let homeDirectories: string[] = [];
      if (storedSettings.autoScanHomeDirectoryOnStartup && storedSettings.fullDiskAccessEnabled) {
        try {
          homeDirectories = await discoverHomeDirectories({
            maxDepth: HOME_DISCOVERY_MAX_DEPTH,
            includeProtectedDirs: storedSettings.fullDiskAccessEnabled,
          });
        } catch (error) {
          console.error('Error discovering home directories:', error);
        }
      } else if (storedSettings.autoScanHomeDirectoryOnStartup && !storedSettings.fullDiskAccessEnabled) {
        console.info('Skipping automatic home scan because Full Disk Access is disabled.');
      }

      const homeScanEnabled = storedSettings.autoScanHomeDirectoryOnStartup && storedSettings.fullDiskAccessEnabled;
      const shouldScanWatched = (storedSettings.autoScanGlobalOnStartup || homeScanEnabled)
        && storedSettings.watchedDirectories.length > 0;

      await loadAgents({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        additionalDirectories: homeDirectories,
        scanWatchedDirectories: shouldScanWatched,
      });

      // Also load slash commands
      await loadCommands({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        watchedDirectories: storedSettings.watchedDirectories,
      });
    };

    initializeAgents();
  }, [isActivationOpen, isOnboardingComplete, loadAgents, loadCommands, loadInitialSettings]);

  const handleNavigateHome = () => {
    navigateHome();
  };

  const handleCreateAgent = useCallback(() => {
    navigateToCreate(currentView === 'team' ? 'team' : 'subagents');
  }, [currentView, navigateToCreate]);

  const handleCreateSkill = useCallback(() => {
    navigateToSkillCreate();
  }, [navigateToSkillCreate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifierPressed = isMacLike ? event.metaKey : event.ctrlKey;
      if (modifierPressed && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleCreateAgent();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMacLike, handleCreateAgent]);

  const handleEditAgent = (agent: Agent) => {
    navigateToEdit(agent, currentView === 'team' ? 'team' : 'subagents');
  };

  const handleDuplicateAgent = (agent: Agent) => {
    navigateToDuplicate(agent, currentView === 'team' ? 'team' : 'subagents');
  };

  const handleEditSkill = (skill: Skill) => {
    navigateToSkillEdit(skill);
  };

  const handleSaveSkill = async (skillToSave: Skill, options?: { projectPath?: string }) => {
    await saveSkillToWorkspace(skillToSave, options);
    cancelEditing();
  };

  const handleSaveAgent = async (agentToSave: Agent, options?: { projectPath?: string }) => {
    await saveAgentToWorkspace(agentToSave, options);
    cancelEditing();
  };
  
  const handleDeleteAgent = async (agentIdToDelete: string) => {
    const agentToDelete = agents.find(a => a.id === agentIdToDelete);
    if (!agentToDelete) return;

    const command = AgentCommands.delete(
      agentToDelete,
      async (agent) => {
        await deleteAgentFromWorkspace(agent.id);
      },
      async (agent) => {
        await saveAgentToWorkspace(agent);
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted agent "${agentToDelete.name}"`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  };

  const handleDeleteSkill = async (skillIdToDelete: string) => {
    const skillToDelete = skills.find(s => s.id === skillIdToDelete);
    if (!skillToDelete) return;

    const command = SkillCommands.delete(
      skillToDelete,
      async (skill) => {
        await deleteSkillFromWorkspace(skill.id);
      },
      async (skill) => {
        await saveSkillToWorkspace(skill);
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted skill "${skillToDelete.name}"`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  };

  const handleRevealSkill = useCallback(
    async (skill: Skill) => {
      const targetPath = skill.directoryPath || skill.path;
      if (!targetPath) {
        showToast('error', 'Skill path is missing.');
        return;
      }
      try {
        await revealItemInDir(targetPath);
      } catch (error) {
        console.error('Failed to reveal skill folder:', error);
        showToast('error', 'Failed to reveal the skill folder.');
      }
    },
    [showToast]
  );

  const handleExportSkill = useCallback(
    async (skill: Skill) => {
      const directoryPath = skill.directoryPath || skill.path;
      if (!directoryPath) {
        showToast('error', 'Skill folder is missing.');
        return;
      }

      try {
        const destination = await saveDialog({
          defaultPath: `${skill.name || 'skill'}.zip`,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        });
        if (!destination) {
          return;
        }
        await exportSkillDirectory(directoryPath, destination);
        showToast('success', `Exported "${skill.name}"`);
      } catch (error) {
        console.error('Error exporting skill:', error);
        showToast('error', 'Failed to export the skill.');
      }
    },
    [showToast]
  );

  const handleExportSkills = useCallback(
    async (skillsToExport: Skill[]) => {
      if (skillsToExport.length === 0) {
        return;
      }
      const destination = await saveDialog({
        defaultPath:
          skillsToExport.length === 1
            ? `${skillsToExport[0].name || 'skill'}.zip`
            : 'skills-archive.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!destination) {
        return;
      }
      const directories = skillsToExport
        .map(skill => skill.directoryPath || skill.path)
        .filter((dir): dir is string => Boolean(dir));
      if (directories.length === 0) {
        showToast('error', 'Selected skills are missing directories.');
        return;
      }
      await exportSkillsArchive(directories, destination);
      showToast('success', `Exported ${skillsToExport.length} skill(s)`);
    },
    [showToast]
  );

  const handleImportSkill = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Skill Archive', extensions: ['zip'] }],
      });
      if (!selection) {
        return;
      }
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importSkillArchive(archivePath, 'global');
      await refreshGlobalSkills();
      showToast('success', 'Skill imported into ~/.claude/skills');
    } catch (error) {
      console.error('Error importing skill:', error);
      showToast('error', 'Failed to import skill archive.');
    }
  }, [refreshGlobalSkills, showToast]);

  const handleBulkDelete = async (agentIdsToDelete: string[]) => {
    const agentsToDelete = agents.filter(a => agentIdsToDelete.includes(a.id));
    if (agentsToDelete.length === 0) return;

    const command = AgentCommands.bulkDelete(
      agentsToDelete,
      async (agentsToRemove) => {
        await bulkDeleteAgents(agentsToRemove.map(a => a.id));
      },
      async (agentsToRestore) => {
        for (const agent of agentsToRestore) {
          await saveAgentToWorkspace(agent);
        }
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted ${agentsToDelete.length} agent(s)`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  };

  const handleImportAgents = async (importedAgents: Agent[], errors: string[]) => {
    await importAgents(importedAgents, errors);
  };

  const handleToggleFavorite = async (agentToToggle: Agent) => {
    const command = AgentCommands.toggleFavorite(
      agentToToggle,
      async () => {
        toggleAgentFavorite(agentToToggle);
      }
    );

    await executeCommand(command);
  };

  const handleToggleSkillFavorite = async (skillToToggle: Skill) => {
    const command = SkillCommands.toggleFavorite(
      skillToToggle,
      async () => {
        toggleSkillFavorite(skillToToggle);
      }
    );

    await executeCommand(command);
  };

  const handleCancel = () => {
    cancelEditing();
  };

  const handleShowTeam = () => {
    navigateToView('team');
  };

  const handleShowSubagents = () => {
    navigateToView('subagents');
  };

  const handleShowSkills = () => {
    navigateToView('skills');
  };

  const handleShowAnalytics = () => {
    navigateToView('analytics');
  };

  const handleShowMemory = () => {
    navigateToView('memory');
  };

  const handleShowCommands = () => {
    navigateToView('commands');
  };

  const handleCreateCommand = useCallback(() => {
    navigateToCommandCreate();
  }, [navigateToCommandCreate]);

  const handleEditCommand = useCallback((command: typeof commands[0]) => {
    navigateToCommandEdit(command);
  }, [navigateToCommandEdit]);

  const handleSaveCommand = async (commandToSave: typeof commands[0], options?: { projectPath?: string }) => {
    await saveCommand(commandToSave, options);
    cancelEditing();
  };

  const handleDeleteCommand = async (commandId: string) => {
    await deleteCommand(commandId);
  };

  const handleDuplicateCommand = useCallback(async (commandToDuplicate: typeof commands[0]) => {
    // Create a unique name for the duplicate
    let newName = `${commandToDuplicate.name}-copy`;
    const existingNames = new Set(commands.map(c => c.name));
    let counter = 1;
    while (existingNames.has(newName)) {
      newName = `${commandToDuplicate.name}-copy-${counter}`;
      counter++;
    }

    const duplicatedCommand = {
      ...commandToDuplicate,
      id: crypto.randomUUID(),
      name: newName,
      path: '', // Will be set when saved
    };

    try {
      await saveCommand(duplicatedCommand);
      showToast('success', `Duplicated command as "/${newName}"`);
    } catch (error) {
      console.error('Error duplicating command:', error);
      showToast('error', 'Failed to duplicate command.');
    }
  }, [commands, saveCommand, showToast]);

  const handleExportCommands = useCallback(async (commandsToExport: typeof commands) => {
    if (commandsToExport.length === 0) {
      return;
    }
    try {
      const destination = await saveDialog({
        defaultPath: commandsToExport.length === 1
          ? `${commandsToExport[0].name || 'command'}.zip`
          : 'commands-archive.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!destination) {
        return;
      }
      const paths = commandsToExport.map(cmd => cmd.path).filter(Boolean);
      if (paths.length === 0) {
        showToast('error', 'Selected commands are missing paths.');
        return;
      }
      await exportSlashCommandsArchive(paths, destination);
      showToast('success', `Exported ${commandsToExport.length} command(s)`);
    } catch (error) {
      console.error('Error exporting commands:', error);
      showToast('error', 'Failed to export commands.');
    }
  }, [showToast]);

  const handleImportCommands = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Commands Archive', extensions: ['zip'] }],
      });
      if (!selection) {
        return;
      }
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importSlashCommandsArchive(archivePath, 'global');
      await loadCommands();
      showToast('success', 'Commands imported into ~/.claude/commands');
    } catch (error) {
      console.error('Error importing commands:', error);
      showToast('error', 'Failed to import commands archive.');
    }
  }, [loadCommands, showToast]);

  const handleExportMemories = useCallback(async (memoriesToExport: typeof memories) => {
    if (memoriesToExport.length === 0) {
      return;
    }
    try {
      const destination = await saveDialog({
        defaultPath: memoriesToExport.length === 1
          ? 'claude-memory.zip'
          : 'memories-archive.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!destination) {
        return;
      }
      const paths = memoriesToExport.map(mem => mem.path).filter(Boolean);
      if (paths.length === 0) {
        showToast('error', 'Selected memories are missing paths.');
        return;
      }
      await exportMemoriesArchive(paths, destination);
      showToast('success', `Exported ${memoriesToExport.length} memory file(s)`);
    } catch (error) {
      console.error('Error exporting memories:', error);
      showToast('error', 'Failed to export memories.');
    }
  }, [showToast]);

  const handleImportMemories = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Memories Archive', extensions: ['zip'] }],
      });
      if (!selection) {
        return;
      }
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importMemoriesArchive(archivePath, 'global');
      await loadMemories();
      showToast('success', 'Memory files imported into ~/.claude/');
    } catch (error) {
      console.error('Error importing memories:', error);
      showToast('error', 'Failed to import memories archive.');
    }
  }, [loadMemories, showToast]);

  const handleCloneMemory = useCallback(async (memoryToClone: typeof memories[0]) => {
    try {
      // Open a folder picker to select the destination project
      const selectedPath = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Destination Project Folder',
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      // Save the memory content to the selected project folder
      await saveMemory(AgentScope.Project, memoryToClone.content, selectedPath);
      await loadMemories();
      showToast('success', 'Memory cloned to new project');
    } catch (error) {
      console.error('Error cloning memory:', error);
      showToast('error', 'Failed to clone memory.');
    }
  }, [saveMemory, loadMemories, showToast]);

  const handlePersistDisplayName = useCallback(async (name: string) => {
    await setDisplayName(name);
  }, [setDisplayName]);

  const handleResetLicense = useCallback(async () => {
    await resetLicense();
    cancelEditing();
    navigateHome();
    setIsActivationOpen(true);
  }, [cancelEditing, navigateHome, resetLicense]);

  const renderContent = () => {
    switch(currentView) {
      case 'edit':
      case 'create':
      case 'duplicate':
        if (!selectedAgent) return null;
        return (
          <motion.div
            key={`editor-${currentView}`}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AgentEditorScreen
              agent={selectedAgent}
              onSave={handleSaveAgent}
              onCancel={handleCancel}
              mode={currentView}
              existingNames={agents.map(a => a.name).filter(name => name !== selectedAgent.name)}
            />
          </motion.div>
        );
      case 'create-skill':
      case 'edit-skill':
        if (!selectedSkill) return null;
        return (
          <motion.div
            key={`skill-editor-${currentView}`}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SkillEditorScreen
              skill={selectedSkill}
              onSave={handleSaveSkill}
              onCancel={handleCancel}
              mode={currentView}
              existingNames={skills.map(skill => skill.name).filter(name => name !== selectedSkill.name)}
            />
          </motion.div>
        );
      case 'analytics':
        return (
          <motion.div
            key="analytics"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AnalyticsDashboardScreen
              agents={agents}
              onShowList={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
            />
          </motion.div>
        );
      case 'team':
        return (
          <motion.div
            key="team"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AgentTeamView
              agents={agents}
              onBack={handleShowSubagents}
              onShowList={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onEdit={handleEditAgent}
              onToggleFavorite={handleToggleFavorite}
              userName={userDisplayName || 'Your'}
            />
          </motion.div>
        );
      case 'skills':
        return (
          <motion.div
            key="skills"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SkillListScreen
              skills={skills}
              onCreateSkill={handleCreateSkill}
              onEditSkill={handleEditSkill}
              onDeleteSkill={handleDeleteSkill}
              onRevealSkill={handleRevealSkill}
              onExportSkill={handleExportSkill}
              onExportSkills={handleExportSkills}
              onImportSkill={handleImportSkill}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              activeView="skills"
              onToggleFavorite={handleToggleSkillFavorite}
            />
          </motion.div>
        );
      case 'memory':
        return (
          <motion.div
            key="memory"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <MemoryListScreen
              memories={memories}
              isLoading={isMemoryListLoading}
              onEdit={navigateToMemoryEdit}
              onCreate={navigateToMemoryCreate}
              onClone={handleCloneMemory}
              onToggleFavorite={toggleMemoryFavorite}
              onImport={handleImportMemories}
              onExport={handleExportMemories}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              activeView="memory"
            />
          </motion.div>
        );
      case 'create-memory':
      case 'edit-memory':
        return (
          <motion.div
            key={`memory-editor-${currentView}`}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <MemoryScreen
              globalMemory={currentView === 'edit-memory' && selectedMemory ? selectedMemory : globalMemory}
              projectMemory={projectMemory}
              isLoading={isMemoryLoading}
              activeScope={selectedMemory?.scope || memoryActiveScope}
              onScopeChange={setMemoryActiveScope}
              onSave={async (scope, content, projectPath) => {
                await saveMemory(scope, content, projectPath);
                // Don't call cancelEditing() here - auto-save should not close the editor
              }}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
            />
          </motion.div>
        );
      case 'commands':
        return (
          <motion.div
            key="commands"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SlashCommandListScreen
              commands={commands}
              onCreate={handleCreateCommand}
              onEdit={handleEditCommand}
              onDuplicate={handleDuplicateCommand}
              onDelete={handleDeleteCommand}
              onToggleFavorite={toggleCommandFavorite}
              onImport={handleImportCommands}
              onExport={handleExportCommands}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              activeView="commands"
            />
          </motion.div>
        );
      case 'create-command':
      case 'edit-command':
        if (!selectedCommand) return null;
        return (
          <motion.div
            key={`command-editor-${currentView}`}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SlashCommandEditorScreen
              command={selectedCommand}
              onSave={handleSaveCommand}
              onCancel={cancelEditing}
              mode={currentView === 'create-command' ? 'create' : 'edit'}
              existingNames={commands.map(c => c.name).filter(name => name !== selectedCommand.name)}
            />
          </motion.div>
        );
      case 'subagents':
      default:
        return (
          <motion.div
            key="subagents"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AgentListScreen
              agents={agents}
              onCreate={handleCreateAgent}
              onEdit={handleEditAgent}
              onDuplicate={handleDuplicateAgent}
              onDelete={handleDeleteAgent}
              onBulkDelete={handleBulkDelete}
              onShowTeam={handleShowTeam}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowAnalytics={handleShowAnalytics}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              activeView="subagents"
              onToggleFavorite={handleToggleFavorite}
              onImport={handleImportAgents}
              shortcutHint={isMacLike ? '⌘ N' : 'Ctrl + N'}
            />
          </motion.div>
        );
    }
  };

  const snoozeActive = Boolean(
    pendingUpdate &&
      updateSnooze &&
      updateSnooze.version === pendingUpdate.version &&
      Date.parse(updateSnooze.until) > Date.now()
  );
  const shouldShowUpdatePrompt = Boolean(pendingUpdate && !autoUpdateEnabled && !snoozeActive);

  return (
    <div className="min-h-screen bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary transition-colors duration-200">
      <Header
        theme={theme}
        onToggleTheme={toggleThemeHook}
        onNavigateHome={handleNavigateHome}
        onScan={loadAgents}
        isScanning={isScanBusy}
        licenseInfo={licenseInfo}
        onResetLicense={handleResetLicense}
        userDisplayName={userDisplayName}
        onDisplayNameChange={handlePersistDisplayName}
        scanSettings={scanSettings}
        onScanSettingsChange={applyScanSettings}
        autoUpdateEnabled={autoUpdateEnabled}
        onAutoUpdateChange={handleAutoUpdateChange}
        onCheckForUpdates={handleManualUpdateCheck}
        isCheckingUpdate={isCheckingUpdate}
        isInstallingUpdate={isInstallingUpdate}
        pendingUpdate={pendingUpdate}
        appVersion={appVersion}
        lastUpdateCheckAt={lastUpdateCheckAt}
        onInstallUpdate={handleInstallUpdate}
        isMacPlatform={isMacLike}
        macOSVersionMajor={macOSMajorVersion}
        onShowKeyboardShortcuts={() => setShowShortcutsPanel(true)}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <AnimatePresence>
        {shouldShowUpdatePrompt && pendingUpdate && (
          <UpdatePrompt
            update={pendingUpdate}
            isInstalling={isInstallingUpdate}
            onInstall={handleInstallUpdate}
            onRemindLater={handleSnoozeUpdatePrompt}
          />
        )}
      </AnimatePresence>
      <ActivationModal
        isOpen={isActivationOpen}
        defaultEmail={licenseInfo?.email}
        defaultDisplayName={userDisplayName}
        defaultScanGlobal={scanSettings.autoScanGlobalOnStartup}
        defaultScanHome={scanSettings.autoScanHomeDirectoryOnStartup}
        defaultFullDiskAccess={scanSettings.fullDiskAccessEnabled}
        isMacPlatform={isMacLike}
        macOSVersionMajor={macOSMajorVersion}
        onValidateLicense={async ({ licenseKey }) => {
          const result = await validateLicenseWithLemon(licenseKey);
          const status = result.status?.toLowerCase();
          if (!result.valid || (status && status !== 'active')) {
            const message =
              result.error === 'invalid'
                ? 'This licence key was not recognised.'
                : result.error === 'revoked' || status === 'revoked'
                  ? 'This licence has been revoked or refunded.'
                  : 'Unable to validate your licence right now.';
            throw new Error(message);
          }
        }}
        onComplete={async ({ licenseKey, email, displayName, autoScanGlobal, autoScanHome, fullDiskAccessEnabled }) => {
          const trimmedLicenseKey = licenseKey.trim();
          const trimmedEmail = email.trim();
          const trimmedDisplayName = displayName.trim();

          const resolvedFingerprint = deviceFingerprint ?? (await ensureDeviceFingerprint());
          if (!resolvedFingerprint) {
            throw new Error('Unable to initialize device fingerprint.');
          }

          let activationResult;
          try {
            activationResult = await activateLicense({
              licenseKey: trimmedLicenseKey,
              deviceFingerprint: resolvedFingerprint,
              platform: platformIdentifier,
              appVersion: appVersion || undefined,
            });
          } catch (error) {
            console.error('Activation completion failed:', error);
            if (error instanceof LicenseServerError) {
              if (error.code === 'device_limit_reached') {
                throw new Error('This licence is already active on the maximum number of devices.');
              }
              if (error.code === 'license_revoked_or_refunded') {
                throw new Error('This licence has been revoked or refunded.');
              }
            }
            throw new Error('Unable to activate your licence right now. Please try again.');
          }

          const licenseRecord: LicenseInfo = {
            licenseKey: trimmedLicenseKey,
            email: trimmedEmail,
            status: mapRemoteStatus(activationResult.licenseStatus),
            lastChecked: new Date().toISOString(),
            token: activationResult.token,
            deviceFingerprint: resolvedFingerprint,
            maxDevices: activationResult.maxDevices,
          };
          await setLicense(licenseRecord);

          await setDisplayName(trimmedDisplayName);

          const updatedScanSettings: ScanSettings = {
            ...scanSettingsRef.current,
            autoScanGlobalOnStartup: autoScanGlobal,
            autoScanHomeDirectoryOnStartup: autoScanHome,
            fullDiskAccessEnabled,
          };
          await saveScanSettings(updatedScanSettings);
          applyScanSettings(updatedScanSettings);

          let onboardingDirectories: string[] = [];
          if (autoScanHome && fullDiskAccessEnabled) {
            try {
              onboardingDirectories = await discoverHomeDirectories({
                maxDepth: HOME_DISCOVERY_MAX_DEPTH,
                includeProtectedDirs: fullDiskAccessEnabled,
                force: true,
              });
            } catch (error) {
              console.error('Error discovering home directories during onboarding:', error);
            }
          } else if (autoScanHome && !fullDiskAccessEnabled) {
            console.info('Skipping onboarding home scan because Full Disk Access is disabled.');
          }

          const homeScanActive = autoScanHome && fullDiskAccessEnabled;
          const shouldScanWatched = (autoScanGlobal || homeScanActive) && updatedScanSettings.watchedDirectories.length > 0;

          await loadAgents({
            includeGlobal: autoScanGlobal,
            additionalDirectories: onboardingDirectories,
            scanWatchedDirectories: shouldScanWatched,
          });
          setIsActivationOpen(false);
        }}
        onClose={() => {
          if (isOnboardingComplete) {
            setIsActivationOpen(false);
          }
        }}
      />
      <KeyboardShortcutsPanel
        isOpen={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
        isMacLike={isMacLike}
      />
      <SplashScreen isVisible={showSplash} theme={theme} />
    </div>
  );
};

export default App;
