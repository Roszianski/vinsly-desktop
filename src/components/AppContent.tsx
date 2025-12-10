import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent, AgentScope, ScanSettings, Skill, ClaudeMemory } from '../types';
import { LicenseInfo } from '../types/licensing';
import { AgentListScreen } from './screens/AgentListScreen';
import { SkillListScreen } from './screens/SkillListScreen';
import { AgentEditorScreen } from './screens/AgentEditorScreen';
import { SkillEditorScreen } from './screens/SkillEditorScreen';
import { AgentTeamView } from './screens/AgentTeamView';
import { MemoryScreen } from './screens/MemoryScreen';
import { MemoryListScreen } from './screens/MemoryListScreen';
import { SlashCommandListScreen } from './screens/SlashCommandListScreen';
import { SlashCommandEditorScreen } from './screens/SlashCommandEditorScreen';
import { MCPListScreen } from './screens/MCPListScreen';
import { MCPEditorScreen } from './screens/MCPEditorScreen';
import { HooksListScreen } from './screens/HooksListScreen';
import { HooksEditorScreen } from './screens/HooksEditorScreen';
import { Header } from './Header';
import { pageTransition } from '../animations';
import { ToastContainer } from './Toast';
import { ActivationModal } from './ActivationModal';
import { ChangeLicenseModal } from './ChangeLicenseModal';
import { UpdateAvailableModal } from './UpdateAvailableModal';
import { SplashScreen } from './SplashScreen';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { DocsPanel } from './DocsPanel';
import { useToast } from '../contexts/ToastContext';
import { useLicenseContext } from '../contexts/LicenseContext';
import { useUpdateContext } from '../contexts/UpdateContext';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTheme } from '../hooks/useTheme';
import { useUserProfile } from '../hooks/useUserProfile';
import { useClaudeSessions } from '../hooks/useClaudeSessions';
import { useKeyboardShortcuts, CommonShortcuts } from '../hooks/useKeyboardShortcuts';
import { validateLicenseWithLemon, activateLicenseWithLemon, deactivateLicenseWithLemon } from '../utils/lemonLicensingClient';
import { saveScanSettings } from '../utils/scanSettings';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { exportSkillDirectory, importSkillArchive, exportSkillsArchive, exportSlashCommandsArchive, importSlashCommandsArchive, exportMemoriesArchive, importMemoriesArchive } from '../utils/tauriCommands';
import { DEFAULT_HOME_DISCOVERY_DEPTH, discoverHomeDirectories } from '../utils/homeDiscovery';
import { MCPServer } from '../types/mcp';
import { Hook } from '../types/hooks';
import { devLog } from '../utils/devLogger';

const HOME_DISCOVERY_MAX_DEPTH = DEFAULT_HOME_DISCOVERY_DEPTH;

export const AppContent: React.FC = () => {
  const { theme, themeLoaded, toggleTheme } = useTheme();
  const { userDisplayName, setDisplayName } = useUserProfile();
  const { showToast, toasts, removeToast } = useToast();

  // License context
  const {
    licenseInfo,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
    isActivationOpen,
    setIsActivationOpen,
    activationPresented,
    setActivationPresented,
    appVersion,
    platformIdentifier,
    isMacLike,
    macOSMajorVersion,
  } = useLicenseContext();

  // Update context
  const {
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    initialCheckComplete,
    handleManualUpdateCheck,
    handleInstallUpdate,
    dismissPendingUpdate,
  } = useUpdateContext();

  // Workspace context
  const {
    agents,
    skills,
    commands,
    mcpServersList,
    hooksList,
    memories,
    isMemoryListLoading,
    globalMemory,
    projectMemory,
    isMemoryLoading,
    memoryActiveScope,
    setMemoryActiveScope,
    isScanBusy,
    scanSettings,
    applyScanSettings,
    handleFullScan,
    canUndo,
    canRedo,
    undo,
    redo,
    saveAgent,
    deleteAgent,
    bulkDeleteAgents,
    importAgents,
    toggleAgentFavorite,
    saveSkill,
    deleteSkill,
    toggleSkillFavorite,
    refreshGlobalSkills,
    saveCommand,
    deleteCommand,
    toggleCommandFavorite,
    duplicateCommand,
    addMCPServer,
    updateMCPServer,
    removeMCPServer,
    toggleMCPFavorite,
    addHook,
    updateHook,
    removeHook,
    toggleHookFavorite,
    saveMemory,
    toggleMemoryFavorite,
    cloneMemory,
  } = useWorkspaceContext();

  // Navigation context
  const {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    selectedMCPServer,
    selectedHook,
    navigateHome,
    navigateToView,
    cancelEditing,
    navigateToAgentCreate,
    navigateToAgentEdit,
    navigateToAgentDuplicate,
    navigateToSkillCreate,
    navigateToSkillEdit,
    navigateToCommandCreate,
    navigateToCommandEdit,
    navigateToMemoryCreate,
    navigateToMemoryEdit,
    navigateToMCPCreate,
    navigateToMCPEdit,
    navigateToHookCreate,
    navigateToHookEdit,
  } = useNavigationContext();

  // Local UI state
  const [showSplash, setShowSplash] = useState(true);
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  const [showDocsPanel, setShowDocsPanel] = useState(false);
  const [isChangeLicenseOpen, setIsChangeLicenseOpen] = useState(false);

  // Claude sessions
  const claudeSessions = useClaudeSessions({ autoStart: true, pollInterval: 5000 });
  const { sessions, isLoading: isSessionsLoading, error: sessionsError, refresh: refreshSessions } = claudeSessions;

  // Splash screen timer
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  // Determine if we should show the pre-activation update modal
  const showPreActivationUpdate = !showSplash &&
    initialCheckComplete &&
    pendingUpdate !== null &&
    !licenseInfo;

  // Open activation modal when license bootstrap completes (and no pre-activation update is showing)
  useEffect(() => {
    if (activationPresented || !licenseBootstrapComplete || !initialCheckComplete) return;
    // Don't open activation if we're showing the update modal
    if (!showSplash && !licenseInfo && !pendingUpdate) {
      setIsActivationOpen(true);
    }
    if (!showSplash && !pendingUpdate) {
      setActivationPresented(true);
    }
  }, [licenseInfo, showSplash, activationPresented, licenseBootstrapComplete, initialCheckComplete, pendingUpdate, setIsActivationOpen, setActivationPresented]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    CommonShortcuts.undo(
      () => {
        void undo().then(description => {
          if (description) showToast('info', `Undone: ${description}`);
        });
      },
      canUndo
    ),
    CommonShortcuts.redo(
      () => {
        void redo().then(description => {
          if (description) showToast('info', `Redone: ${description}`);
        });
      },
      canRedo
    ),
    CommonShortcuts.escape(
      () => {
        if (showShortcutsPanel) setShowShortcutsPanel(false);
        else if (showDocsPanel) setShowDocsPanel(false);
      },
      showShortcutsPanel || showDocsPanel
    ),
  ]);

  // Cmd+N / Ctrl+N to create agent
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifierPressed = isMacLike ? event.metaKey : event.ctrlKey;
      if (modifierPressed && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        navigateToAgentCreate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMacLike, navigateToAgentCreate]);

  // Handler wrappers
  const handleSaveAgent = async (agent: Agent, options?: { projectPath?: string }) => {
    await saveAgent(agent, options);
    cancelEditing();
  };

  const handleSaveSkill = async (skill: Skill, options?: { projectPath?: string }) => {
    await saveSkill(skill, options);
    cancelEditing();
  };

  const handleSaveCommand = async (cmd: typeof commands[0], options?: { projectPath?: string }) => {
    await saveCommand(cmd, options);
    cancelEditing();
  };

  const handleSaveMCP = async (server: MCPServer, projectPath?: string) => {
    const existingServer = mcpServersList.find(s => s.id === server.id);
    if (existingServer) {
      await updateMCPServer(server, existingServer, projectPath);
    } else {
      await addMCPServer(server, projectPath);
    }
    cancelEditing();
  };

  const handleSaveHook = async (hook: Hook, projectPath?: string) => {
    const existingHook = hooksList.find(h => h.id === hook.id);
    if (existingHook) {
      await updateHook(hook, existingHook, projectPath);
    } else {
      await addHook(hook, projectPath);
    }
    cancelEditing();
  };

  const handleDeleteMCP = async (server: MCPServer) => {
    await removeMCPServer(server.name, server.scope);
  };

  const handleDeleteHook = async (hook: Hook) => {
    await removeHook(hook);
  };

  const handleChangeLicense = useCallback(() => {
    setIsChangeLicenseOpen(true);
  }, []);

  // Handle skipping pre-activation update
  const handleSkipPreActivationUpdate = useCallback(() => {
    dismissPendingUpdate();
    // Activation modal will open via the useEffect once pendingUpdate becomes null
  }, [dismissPendingUpdate]);

  // Skill handlers
  const handleRevealSkill = useCallback(async (skill: Skill) => {
    const targetPath = skill.directoryPath || skill.path;
    if (!targetPath) {
      showToast('error', 'Skill path is missing.');
      return;
    }
    try {
      await revealItemInDir(targetPath);
    } catch (error) {
      devLog.error('Failed to reveal skill folder:', error);
      showToast('error', 'Failed to reveal the skill folder.');
    }
  }, [showToast]);

  const handleExportSkill = useCallback(async (skill: Skill) => {
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
      if (!destination) return;
      await exportSkillDirectory(directoryPath, destination);
      showToast('success', `Exported "${skill.name}"`);
    } catch (error) {
      devLog.error('Error exporting skill:', error);
      showToast('error', 'Failed to export the skill.');
    }
  }, [showToast]);

  const handleExportSkills = useCallback(async (skillsToExport: Skill[]) => {
    if (skillsToExport.length === 0) return;
    const destination = await saveDialog({
      defaultPath: skillsToExport.length === 1 ? `${skillsToExport[0].name || 'skill'}.zip` : 'skills-archive.zip',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });
    if (!destination) return;
    const directories = skillsToExport.map(skill => skill.directoryPath || skill.path).filter((dir): dir is string => Boolean(dir));
    if (directories.length === 0) {
      showToast('error', 'Selected skills are missing directories.');
      return;
    }
    await exportSkillsArchive(directories, destination);
    showToast('success', `Exported ${skillsToExport.length} skill(s)`);
  }, [showToast]);

  const handleImportSkill = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Skill Archive', extensions: ['zip'] }],
      });
      if (!selection) return;
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importSkillArchive(archivePath, 'global');
      await refreshGlobalSkills();
      showToast('success', 'Skill imported into ~/.claude/skills');
    } catch (error) {
      devLog.error('Error importing skill:', error);
      showToast('error', 'Failed to import skill archive.');
    }
  }, [refreshGlobalSkills, showToast]);

  // Command handlers
  const handleExportCommands = useCallback(async (commandsToExport: typeof commands) => {
    if (commandsToExport.length === 0) return;
    try {
      const destination = await saveDialog({
        defaultPath: commandsToExport.length === 1 ? `${commandsToExport[0].name || 'command'}.zip` : 'commands-archive.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!destination) return;
      const paths = commandsToExport.map(cmd => cmd.path).filter(Boolean);
      if (paths.length === 0) {
        showToast('error', 'Selected commands are missing paths.');
        return;
      }
      await exportSlashCommandsArchive(paths, destination);
      showToast('success', `Exported ${commandsToExport.length} command(s)`);
    } catch (error) {
      devLog.error('Error exporting commands:', error);
      showToast('error', 'Failed to export commands.');
    }
  }, [showToast]);

  const handleImportCommands = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Commands Archive', extensions: ['zip'] }],
      });
      if (!selection) return;
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importSlashCommandsArchive(archivePath, 'global');
      await handleFullScan({ includeGlobal: true });
      showToast('success', 'Commands imported into ~/.claude/commands');
    } catch (error) {
      devLog.error('Error importing commands:', error);
      showToast('error', 'Failed to import commands archive.');
    }
  }, [handleFullScan, showToast]);

  // Memory handlers
  const handleExportMemories = useCallback(async (memoriesToExport: typeof memories) => {
    if (memoriesToExport.length === 0) return;
    try {
      const destination = await saveDialog({
        defaultPath: memoriesToExport.length === 1 ? 'claude-memory.zip' : 'memories-archive.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!destination) return;
      const paths = memoriesToExport.map(mem => mem.path).filter(Boolean);
      if (paths.length === 0) {
        showToast('error', 'Selected memories are missing paths.');
        return;
      }
      await exportMemoriesArchive(paths, destination);
      showToast('success', `Exported ${memoriesToExport.length} memory file(s)`);
    } catch (error) {
      devLog.error('Error exporting memories:', error);
      showToast('error', 'Failed to export memories.');
    }
  }, [showToast]);

  const handleImportMemories = useCallback(async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [{ name: 'Memories Archive', extensions: ['zip'] }],
      });
      if (!selection) return;
      const archivePath = Array.isArray(selection) ? selection[0] : selection;
      await importMemoriesArchive(archivePath, 'global');
      await handleFullScan({ includeGlobal: true });
      showToast('success', 'Memory files imported into ~/.claude/');
    } catch (error) {
      devLog.error('Error importing memories:', error);
      showToast('error', 'Failed to import memories archive.');
    }
  }, [handleFullScan, showToast]);

  const handleCloneMemory = useCallback(async (memoryToClone: typeof memories[0]) => {
    try {
      const selectedPath = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Destination Project Folder',
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;
      await cloneMemory(memoryToClone, selectedPath);
    } catch (error) {
      devLog.error('Error cloning memory:', error);
      showToast('error', 'Failed to clone memory.');
    }
  }, [cloneMemory, showToast]);

  // View navigation handlers
  const handleShowTeam = () => navigateToView('team');
  const handleShowSubagents = () => navigateToView('subagents');
  const handleShowSkills = () => navigateToView('skills');
  const handleShowMemory = () => navigateToView('memory');
  const handleShowCommands = () => navigateToView('commands');
  const handleShowMCP = () => navigateToView('mcp');
  const handleShowHooks = () => navigateToView('hooks');

  const renderContent = () => {
    switch (currentView) {
      case 'edit':
      case 'create':
      case 'duplicate':
        if (!selectedAgent) return null;
        return (
          <motion.div key={`editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <AgentEditorScreen
              agent={selectedAgent}
              onSave={handleSaveAgent}
              onCancel={cancelEditing}
              mode={currentView}
              existingNames={agents.map(a => a.name).filter(name => name !== selectedAgent.name)}
            />
          </motion.div>
        );

      case 'create-skill':
      case 'edit-skill':
        if (!selectedSkill) return null;
        return (
          <motion.div key={`skill-editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <SkillEditorScreen
              skill={selectedSkill}
              onSave={handleSaveSkill}
              onCancel={cancelEditing}
              mode={currentView}
              existingNames={skills.map(s => s.name).filter(name => name !== selectedSkill.name)}
            />
          </motion.div>
        );

      case 'team':
        return (
          <motion.div key="team" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <AgentTeamView
              agents={agents}
              onBack={handleShowSubagents}
              onShowList={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              onEdit={navigateToAgentEdit}
              onToggleFavorite={toggleAgentFavorite}
              userName={userDisplayName || 'Your'}
            />
          </motion.div>
        );

      case 'skills':
        return (
          <motion.div key="skills" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <SkillListScreen
              skills={skills}
              onCreateSkill={navigateToSkillCreate}
              onEditSkill={navigateToSkillEdit}
              onDeleteSkill={deleteSkill}
              onRevealSkill={handleRevealSkill}
              onExportSkill={handleExportSkill}
              onExportSkills={handleExportSkills}
              onImportSkill={handleImportSkill}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="skills"
              onToggleFavorite={toggleSkillFavorite}
            />
          </motion.div>
        );

      case 'memory':
        return (
          <motion.div key="memory" variants={pageTransition} initial="initial" animate="animate" exit="exit">
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
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="memory"
            />
          </motion.div>
        );

      case 'create-memory':
      case 'edit-memory':
        return (
          <motion.div key={`memory-editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <MemoryScreen
              globalMemory={currentView === 'edit-memory' && selectedMemory ? selectedMemory : globalMemory}
              projectMemory={projectMemory}
              isLoading={isMemoryLoading}
              activeScope={selectedMemory?.scope || memoryActiveScope}
              onScopeChange={setMemoryActiveScope}
              onSave={saveMemory}
              onCancel={handleShowMemory}
            />
          </motion.div>
        );

      case 'commands':
        return (
          <motion.div key="commands" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <SlashCommandListScreen
              commands={commands}
              onCreate={navigateToCommandCreate}
              onEdit={navigateToCommandEdit}
              onDuplicate={duplicateCommand}
              onDelete={deleteCommand}
              onToggleFavorite={toggleCommandFavorite}
              onImport={handleImportCommands}
              onExport={handleExportCommands}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="commands"
            />
          </motion.div>
        );

      case 'create-command':
      case 'edit-command':
        if (!selectedCommand) return null;
        return (
          <motion.div key={`command-editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <SlashCommandEditorScreen
              command={selectedCommand}
              onSave={handleSaveCommand}
              onCancel={cancelEditing}
              mode={currentView === 'create-command' ? 'create' : 'edit'}
              existingNames={commands.map(c => c.name).filter(name => name !== selectedCommand.name)}
            />
          </motion.div>
        );

      case 'mcp':
        return (
          <motion.div key="mcp" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <MCPListScreen
              servers={mcpServersList}
              onCreateServer={navigateToMCPCreate}
              onEditServer={navigateToMCPEdit}
              onDeleteServer={handleDeleteMCP}
              onToggleFavorite={toggleMCPFavorite}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="mcp"
            />
          </motion.div>
        );

      case 'create-mcp':
      case 'edit-mcp':
        return (
          <motion.div key={`mcp-editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <MCPEditorScreen
              server={selectedMCPServer}
              onSave={handleSaveMCP}
              onCancel={cancelEditing}
              mode={currentView === 'create-mcp' ? 'create' : 'edit'}
              existingNames={mcpServersList.map(s => s.name).filter(name => selectedMCPServer ? name !== selectedMCPServer.name : true)}
            />
          </motion.div>
        );

      case 'hooks':
        return (
          <motion.div key="hooks" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <HooksListScreen
              hooks={hooksList}
              onCreateHook={navigateToHookCreate}
              onEditHook={navigateToHookEdit}
              onDeleteHook={handleDeleteHook}
              onToggleFavorite={toggleHookFavorite}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="hooks"
            />
          </motion.div>
        );

      case 'create-hook':
      case 'edit-hook':
        return (
          <motion.div key={`hook-editor-${currentView}`} variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <HooksEditorScreen
              hook={selectedHook}
              onSave={handleSaveHook}
              onCancel={cancelEditing}
              mode={currentView === 'create-hook' ? 'create' : 'edit'}
              existingNames={hooksList.map(h => h.name).filter(name => selectedHook ? name !== selectedHook.name : true)}
            />
          </motion.div>
        );

      case 'subagents':
      default:
        return (
          <motion.div key="subagents" variants={pageTransition} initial="initial" animate="animate" exit="exit">
            <AgentListScreen
              agents={agents}
              onCreate={navigateToAgentCreate}
              onEdit={navigateToAgentEdit}
              onDuplicate={navigateToAgentDuplicate}
              onDelete={deleteAgent}
              onBulkDelete={bulkDeleteAgents}
              onShowTeam={handleShowTeam}
              onShowSubagents={handleShowSubagents}
              onShowSkills={handleShowSkills}
              onShowMemory={handleShowMemory}
              onShowCommands={handleShowCommands}
              onShowMCP={handleShowMCP}
              onShowHooks={handleShowHooks}
              activeView="subagents"
              onToggleFavorite={toggleAgentFavorite}
              onImport={importAgents}
              shortcutHint={isMacLike ? '⌘ N' : 'Ctrl + N'}
            />
          </motion.div>
        );
    }
  };

  return (
    <div className={`min-h-screen bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary ${themeLoaded ? 'transition-colors duration-200' : ''}`}>
      {/* Draggable title bar region for macOS traffic lights - only covers left side to not block header buttons */}
      {isMacLike && (
        <div
          data-tauri-drag-region
          className="fixed top-0 left-0 w-48 h-8 z-[9999]"
        />
      )}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateHome={navigateHome}
        onScan={handleFullScan}
        isScanning={isScanBusy}
        licenseInfo={licenseInfo}
        onResetLicense={handleChangeLicense}
        userDisplayName={userDisplayName}
        onDisplayNameChange={setDisplayName}
        scanSettings={scanSettings}
        onScanSettingsChange={applyScanSettings}
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
        onOpenDocs={() => setShowDocsPanel(true)}
        sessions={sessions}
        isLoadingSessions={isSessionsLoading}
        sessionError={sessionsError}
        onRefreshSessions={refreshSessions}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {showPreActivationUpdate && pendingUpdate && (
        <UpdateAvailableModal
          isOpen={showPreActivationUpdate}
          update={pendingUpdate}
          isInstalling={isInstallingUpdate}
          onInstall={handleInstallUpdate}
          onSkip={handleSkipPreActivationUpdate}
        />
      )}

      <ActivationModal
        isOpen={isActivationOpen}
        defaultDisplayName={userDisplayName}
        defaultScanGlobal={scanSettings.autoScanGlobalOnStartup}
        defaultScanWatched={scanSettings.autoScanWatchedOnStartup}
        defaultScanHome={scanSettings.autoScanHomeDirectoryOnStartup}
        defaultFullDiskAccess={scanSettings.fullDiskAccessEnabled}
        isMacPlatform={isMacLike}
        macOSVersionMajor={macOSMajorVersion}
        onValidateLicense={async ({ licenseKey }) => {
          const result = await validateLicenseWithLemon(licenseKey);
          const status = result.status?.toLowerCase();

          // Reject if not valid, or if status is explicitly bad (revoked, expired, disabled)
          // Allow "inactive" status - licenses start inactive until first activation
          const isBadStatus = status === 'revoked' || status === 'expired' || status === 'disabled';

          if (!result.valid || isBadStatus) {
            const message =
              result.error === 'invalid'
                ? 'This licence key was not recognised.'
                : status === 'revoked'
                  ? 'This licence has been revoked or refunded.'
                  : status === 'expired'
                    ? 'This licence has expired.'
                    : status === 'disabled'
                      ? 'This licence has been disabled.'
                      : 'Unable to validate your licence right now.';
            throw new Error(message);
          }
        }}
        onComplete={async ({ licenseKey, displayName, autoScanGlobal, autoScanWatched, autoScanHome, fullDiskAccessEnabled }) => {
          const trimmedLicenseKey = licenseKey.trim();
          const trimmedDisplayName = displayName.trim();

          // Generate instance name for Lemon Squeezy
          const instanceName = `${platformIdentifier} - ${new Date().toLocaleDateString()}`;

          let activationResult;
          try {
            activationResult = await activateLicenseWithLemon(
              trimmedLicenseKey,
              instanceName
            );
          } catch (error) {
            devLog.error('Activation failed:', error);
            throw new Error('Unable to activate your licence right now. Please check your license key and try again.');
          }

          if (!activationResult.activated || !activationResult.instance) {
            const errorMessage = activationResult.error === 'activation_limit_exceeded'
              ? 'This licence is already active on the maximum number of devices.'
              : activationResult.error === 'license_invalid'
              ? 'This licence key is invalid.'
              : activationResult.error === 'license_inactive'
              ? 'This licence has been revoked, expired, or refunded.'
              : 'Unable to activate your licence right now.';
            throw new Error(errorMessage);
          }

          const licenseRecord: LicenseInfo = {
            licenseKey: trimmedLicenseKey,
            email: activationResult.meta?.customer_email,
            status: 'active',
            lastChecked: new Date().toISOString(),
            instanceId: activationResult.instance.id,
            instanceName: activationResult.instance.name,
            activationLimit: activationResult.licenseKey?.activation_limit ?? 0,
            activationUsage: activationResult.licenseKey?.activation_usage ?? 0,
          };
          await setLicense(licenseRecord);
          await setDisplayName(trimmedDisplayName);

          const updatedScanSettings: ScanSettings = {
            ...scanSettings,
            autoScanGlobalOnStartup: autoScanGlobal,
            autoScanWatchedOnStartup: autoScanWatched,
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
                includeProtectedDirs: false, // Never scan Music/Movies/Pictures - no Claude projects there
                force: true,
              });
            } catch (error) {
              devLog.error('Error discovering home directories during onboarding:', error);
            }
          }

          const shouldScanWatched = autoScanWatched && updatedScanSettings.watchedDirectories.length > 0;

          await handleFullScan({
            includeGlobal: autoScanGlobal,
            additionalDirectories: onboardingDirectories,
            scanWatchedDirectories: shouldScanWatched,
          });

          setIsActivationOpen(false);
        }}
        onClose={() => {
          setIsActivationOpen(false);
        }}
      />

      <ChangeLicenseModal
        isOpen={isChangeLicenseOpen}
        onValidateLicense={async ({ licenseKey }) => {
          const result = await validateLicenseWithLemon(licenseKey);
          const status = result.status?.toLowerCase();
          const isBadStatus = status === 'revoked' || status === 'expired' || status === 'disabled';

          if (!result.valid || isBadStatus) {
            const message =
              result.error === 'invalid'
                ? 'This licence key was not recognised.'
                : status === 'revoked'
                  ? 'This licence has been revoked or refunded.'
                  : status === 'expired'
                    ? 'This licence has expired.'
                    : status === 'disabled'
                      ? 'This licence has been disabled.'
                      : 'Unable to validate your licence right now.';
            throw new Error(message);
          }
        }}
        onComplete={async ({ licenseKey }) => {
          const trimmedLicenseKey = licenseKey.trim();

          // Deactivate old license instance if exists
          if (licenseInfo?.licenseKey && licenseInfo?.instanceId) {
            try {
              await deactivateLicenseWithLemon(licenseInfo.licenseKey, licenseInfo.instanceId);
            } catch (error) {
              // Log but don't fail - the old instance might already be deactivated
              devLog.warn('Failed to deactivate old license instance:', error);
            }
          }

          // Activate new license
          const instanceName = `${platformIdentifier} - ${new Date().toLocaleDateString()}`;
          const activationResult = await activateLicenseWithLemon(trimmedLicenseKey, instanceName);

          if (!activationResult.activated || !activationResult.instance) {
            const errorMessage = activationResult.error === 'activation_limit_exceeded'
              ? 'This licence is already active on the maximum number of devices.'
              : activationResult.error === 'license_invalid'
              ? 'This licence key is invalid.'
              : activationResult.error === 'license_inactive'
              ? 'This licence has been revoked, expired, or refunded.'
              : 'Unable to activate your licence right now.';
            throw new Error(errorMessage);
          }

          const licenseRecord: LicenseInfo = {
            licenseKey: trimmedLicenseKey,
            email: activationResult.meta?.customer_email,
            status: 'active',
            lastChecked: new Date().toISOString(),
            instanceId: activationResult.instance.id,
            instanceName: activationResult.instance.name,
            activationLimit: activationResult.licenseKey?.activation_limit ?? 0,
            activationUsage: activationResult.licenseKey?.activation_usage ?? 0,
          };
          await setLicense(licenseRecord);

          showToast('success', 'Licence changed successfully.');
          setIsChangeLicenseOpen(false);
        }}
        onClose={() => {
          setIsChangeLicenseOpen(false);
        }}
      />

      <KeyboardShortcutsPanel
        isOpen={showShortcutsPanel}
        onClose={() => setShowShortcutsPanel(false)}
        isMacLike={isMacLike}
      />

      <DocsPanel
        isOpen={showDocsPanel}
        onClose={() => setShowDocsPanel(false)}
      />

      <SplashScreen isVisible={showSplash} theme={theme} />
    </div>
  );
};
