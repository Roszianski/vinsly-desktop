import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent, AgentScope, ScanSettings, LoadAgentsOptions } from './types';
import { LicenseInfo } from './types/licensing';
import { AgentListScreen } from './components/screens/AgentListScreen';
import { AgentEditorScreen } from './components/screens/AgentEditorScreen';
import { AgentTeamView } from './components/screens/AgentTeamView';
import { AnalyticsDashboardScreen } from './components/screens/AnalyticsDashboardScreen';
import { Header } from './components/Header';
import { GuidedTour, TourType, EditorTourMode } from './components/GuidedTour';
import { pageTransition } from './animations';
import { getStorageItem, setStorageItem, removeStorageItem } from './utils/storage';
import { useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast';
import { listAgents, writeAgent, deleteAgent, listAgentsFromDirectory, discoverProjectDirectories } from './utils/tauriCommands';
import { markdownToAgent } from './utils/agentImport';
import { agentToMarkdown } from './utils/agentExport';
import { getScanSettings, saveScanSettings } from './utils/scanSettings';
import { ActivationModal } from './components/ActivationModal';
import { SplashScreen } from './components/SplashScreen';
import { extractProjectRootFromAgentPath } from './utils/path';

type View = 'list' | 'team' | 'analytics' | 'edit' | 'create' | 'duplicate';
export type Theme = 'light' | 'dark';

const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  autoScanGlobalOnStartup: false,
  autoScanHomeDirectoryOnStartup: false,
  watchedDirectories: [],
};
const HOME_DISCOVERY_MAX_DEPTH = 12;
const AGENT_CACHE_KEY = 'vinsly-agent-cache';

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [isMacLike, setIsMacLike] = useState(false);
  const [returnDestination, setReturnDestination] = useState<'list' | 'team'>('list');
  const [isTourActive, setIsTourActive] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activationPresented, setActivationPresented] = useState(false);
  const [scanSettings, setScanSettingsState] = useState<ScanSettings>(DEFAULT_SCAN_SETTINGS);
  const { showToast, toasts, removeToast } = useToast();
  const agentsRef = useRef<Agent[]>([]);
  const agentCacheHydrated = useRef(false);
  const themeResolvedRef = useRef(false);
  const scanSettingsRef = useRef<ScanSettings>(DEFAULT_SCAN_SETTINGS);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const applyScanSettings = useCallback((next: ScanSettings) => {
    scanSettingsRef.current = next;
    setScanSettingsState(next);
  }, []);

  const resolveProjectPath = (preferredPath?: string, existingPath?: string): string | undefined => {
    if (preferredPath && preferredPath.trim().length > 0) {
      return preferredPath.trim();
    }
    return extractProjectRootFromAgentPath(existingPath) || undefined;
  };

  useEffect(() => {
    if (!isOnboardingComplete || agentCacheHydrated.current) {
      return;
    }

    const hydrateAgentsFromCache = async () => {
      const cachedAgents = await getStorageItem<Agent[]>(AGENT_CACHE_KEY);
      if (cachedAgents && cachedAgents.length > 0 && agentsRef.current.length === 0) {
        setAgents(cachedAgents);
      }
      agentCacheHydrated.current = true;
    };
    hydrateAgentsFromCache();
  }, [isOnboardingComplete]);

  useEffect(() => {
    if (!agentCacheHydrated.current) return;
    setStorageItem(AGENT_CACHE_KEY, agents);
  }, [agents]);

  const makeAgentKey = (agent: Agent) => {
    const scopePrefix = agent.scope === AgentScope.Project ? 'project' : 'global';
    const idPart = agent.path || agent.id || agent.name;
    return `${scopePrefix}:${idPart}`;
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';
      setIsMacLike(/mac|iphone|ipad|ipod/i.test(platform));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadAccountData = async () => {
      const storedLicense = await getStorageItem<LicenseInfo>('vinsly-license-info');
      if (storedLicense) {
        setLicenseInfo(storedLicense);
        setIsOnboardingComplete(true);
      } else {
        setIsOnboardingComplete(false);
      }
      const storedName = await getStorageItem<string>('vinsly-display-name');
      if (storedName) {
        setUserDisplayName(storedName);
      }
    };
    loadAccountData();
  }, []);

  useEffect(() => {
    if (!showSplash && !activationPresented && !licenseInfo) {
      setIsActivationOpen(true);
      setActivationPresented(true);
    } else if (!showSplash && !activationPresented) {
      setActivationPresented(true);
    }
  }, [licenseInfo, showSplash, activationPresented]);

  // Load agents from filesystem
  const loadAgents = useCallback(async (
    options: LoadAgentsOptions = {}
  ): Promise<{ total: number; newCount: number }> => {
    const currentScanSettings = scanSettingsRef.current;
    const {
      projectPaths,
      includeGlobal = true,
      scanWatchedDirectories = false,
      additionalDirectories = [],
    } = options;

    try {
      const previousAgents = agentsRef.current;
      const seen = new Set<string>();
      const projectPathList = projectPaths
        ? Array.isArray(projectPaths) ? projectPaths : [projectPaths]
        : [];

      const allAgents: Agent[] = [];

      // Parse global agents
      if (includeGlobal) {
        const globalAgents = await listAgents('global');
        for (const agentFile of globalAgents) {
          const agent = markdownToAgent(agentFile.content, agentFile.name, AgentScope.Global, agentFile.path);
          if (agent) {
            const key = makeAgentKey(agent);
            if (!seen.has(key)) {
              seen.add(key);
              allAgents.push(agent);
            }
          }
        }
      }

      // Parse project agents
      for (const projectPath of projectPathList) {
        try {
          const projectAgents = await listAgents('project', projectPath);
          for (const agentFile of projectAgents) {
            const agent = markdownToAgent(agentFile.content, agentFile.name, AgentScope.Project, agentFile.path);
            if (agent) {
              const key = makeAgentKey(agent);
              if (!seen.has(key)) {
                seen.add(key);
                allAgents.push(agent);
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning project directory ${projectPath}:`, error);
          // Continue with other project paths
        }
      }

      const directoriesToScan = new Set<string>();
      additionalDirectories.filter(Boolean).forEach(dir => directoriesToScan.add(dir));
      if (scanWatchedDirectories) {
        currentScanSettings.watchedDirectories.forEach(directory => directoriesToScan.add(directory));
      }

      for (const directory of directoriesToScan) {
        try {
          const watchedAgents = await listAgentsFromDirectory(directory);
          for (const agentFile of watchedAgents) {
            const agent = markdownToAgent(agentFile.content, agentFile.name, AgentScope.Project, agentFile.path);
            if (agent) {
              const key = makeAgentKey(agent);
              if (!seen.has(key)) {
                seen.add(key);
                allAgents.push(agent);
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning directory ${directory}:`, error);
        }
      }

      if (!includeGlobal) {
        for (const agent of previousAgents) {
          if (agent.scope === AgentScope.Global) {
            const key = makeAgentKey(agent);
            if (!seen.has(key)) {
              seen.add(key);
              allAgents.push(agent);
            }
          }
        }
      }

      // If we weren't asked to scan any project paths or watched dirs,
      // preserve any existing project-scope agents from the previous state.
      if (projectPathList.length === 0 && directoriesToScan.size === 0) {
        for (const agent of previousAgents) {
          if (agent.scope === AgentScope.Project) {
            const key = makeAgentKey(agent);
            if (!seen.has(key)) {
              seen.add(key);
              allAgents.push(agent);
            }
          }
        }
      }

      const previousKeys = new Set(previousAgents.map(makeAgentKey));
      const newCount = allAgents.filter(agent => !previousKeys.has(makeAgentKey(agent))).length;

      setAgents(allAgents);
      return { total: allAgents.length, newCount };
    } catch (error) {
      console.error('Error loading agents:', error);
      showToast('error', 'Failed to load agents from filesystem');
      throw error;
    }
  }, [showToast]);

  const getSystemTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  useEffect(() => {
    // Check for saved theme preference or fall back to stored theme/system preference
    const loadTheme = async () => {
      if (themeResolvedRef.current) return;
      const savedPreference = await getStorageItem<'system' | Theme>('vinsly-theme-preference');
      const systemTheme = getSystemTheme();

      if (savedPreference) {
        const initialTheme = savedPreference === 'system' ? systemTheme : savedPreference;
        if (themeResolvedRef.current) return;
        themeResolvedRef.current = true;
        setThemeMode(initialTheme);
        return;
      }

      const savedTheme = await getStorageItem<Theme>('vinsly-theme');
      const fallbackTheme = savedTheme || systemTheme;
      if (themeResolvedRef.current) return;
      themeResolvedRef.current = true;
      setThemeMode(fallbackTheme);
    };

    loadTheme();

    // Gate agent loading until onboarding completes and activation is closed
    if (!isOnboardingComplete || isActivationOpen) {
      return;
    }

    const initializeAgents = async () => {
      const storedSettings = await getScanSettings();
      applyScanSettings(storedSettings);

      let homeDirectories: string[] = [];
      if (storedSettings.autoScanHomeDirectoryOnStartup) {
        try {
          homeDirectories = await discoverProjectDirectories(HOME_DISCOVERY_MAX_DEPTH);
        } catch (error) {
          console.error('Error discovering home directories:', error);
        }
      }

      const shouldScanWatched = (storedSettings.autoScanGlobalOnStartup || storedSettings.autoScanHomeDirectoryOnStartup)
        && storedSettings.watchedDirectories.length > 0;

      await loadAgents({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        additionalDirectories: homeDirectories,
        scanWatchedDirectories: shouldScanWatched,
      });
    };

    initializeAgents();
  }, [applyScanSettings, isActivationOpen, isOnboardingComplete, loadAgents]);


  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    if (themeLoaded) {
      setStorageItem('vinsly-theme', theme);
    }
  }, [theme, themeLoaded]);

  const setThemeMode = (mode: Theme) => {
    setThemeLoaded(true);
    setTheme(mode);
  };

  const toggleTheme = () => {
    themeResolvedRef.current = true;
    setThemeMode(theme === 'dark' ? 'light' : 'dark');
  };

  const startTour = () => {
    setIsTourActive(true);
  };

  const getTourType = (): TourType => {
    if (currentView === 'team') return 'team';
    if (currentView === 'analytics') return 'analytics';
    if (currentView === 'edit' || currentView === 'create' || currentView === 'duplicate') return 'editor';
    return 'main';
  };

  const getEditorMode = (): EditorTourMode | null => {
    if (currentView === 'edit') return 'form';
    if (currentView === 'create' || currentView === 'duplicate') return 'wizard';
    return null;
  };

  const endTour = () => {
    setIsTourActive(false);
  };

  const handleNavigateHome = () => {
    setCurrentView('list');
    setReturnDestination('list');
    setSelectedAgent(null);
    setIsTourActive(false);
  };

  const handleCreateAgent = useCallback(() => {
    const newAgentTemplate: Agent = {
      id: '',
      name: '',
      scope: AgentScope.Global,
      path: '',
      frontmatter: {
        name: '',
        description: '',
      },
      body: ''
    };
    setSelectedAgent(newAgentTemplate);
    setReturnDestination(currentView === 'team' ? 'team' : 'list');
    setCurrentView('create');
  }, [currentView]);

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
    setSelectedAgent(agent);
    setReturnDestination(currentView === 'team' ? 'team' : 'list');
    setCurrentView('edit');
  };

  const handleDuplicateAgent = (agent: Agent) => {
    const duplicatedAgent: Agent = JSON.parse(JSON.stringify(agent)); // Deep copy

    let newName = `${agent.name}-copy`;
    let i = 1;
    while(agents.some(a => a.name === newName)) {
      i++;
      newName = `${agent.name}-copy-${i}`;
    }

    duplicatedAgent.name = newName;
    duplicatedAgent.frontmatter.name = newName;
    duplicatedAgent.id = '';
    duplicatedAgent.path = '';

    setSelectedAgent(duplicatedAgent);
    setReturnDestination(currentView === 'team' ? 'team' : 'list');
    setCurrentView('duplicate');
  };

  const handleSaveAgent = async (agentToSave: Agent, options?: { projectPath?: string }) => {
    try {
      const markdown = agentToMarkdown(agentToSave);
      const scope = agentToSave.scope === AgentScope.Project ? 'project' : 'global';
      const displayPath = `${agentToSave.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${agentToSave.name}.md`;
      const projectPath = scope === 'project' ? resolveProjectPath(options?.projectPath, agentToSave.path) : undefined;

      if (scope === 'project' && !projectPath) {
        throw new Error('Select a project folder before saving a project agent.');
      }

      // writeAgent returns the absolute file path
      const absolutePath = await writeAgent(scope, agentToSave.name, markdown, projectPath);
      const persistedAgent: Agent = {
        ...agentToSave,
        id: absolutePath || displayPath,
        path: absolutePath || displayPath, // Use the absolute path returned from backend
      };

      if (currentView === 'create' || currentView === 'duplicate') {
        setAgents(prev => [...prev, persistedAgent]);
        showToast('success', `Agent "${agentToSave.name}" created successfully`);
      } else {
        setAgents(prev => prev.map(agent => agent.id === agentToSave.id ? persistedAgent : agent));
        if (agentToSave.path && agentToSave.path !== absolutePath) {
          try {
            await deleteAgent(agentToSave.path);
          } catch (cleanupError) {
            console.warn('Failed to remove previous agent file:', cleanupError);
          }
        }
        showToast('success', `Agent "${agentToSave.name}" updated successfully`);
      }

      setCurrentView(returnDestination);
      setSelectedAgent(null);
    } catch (error) {
      console.error('Error saving agent:', error);
      showToast('error', `Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleDeleteAgent = async (agentIdToDelete: string) => {
    try {
      const agent = agents.find(a => a.id === agentIdToDelete);
      if (!agent) return;

      await deleteAgent(agent.path);
      setAgents(prev => prev.filter(a => a.id !== agentIdToDelete));
      showToast('success', `Agent "${agent.name}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting agent:', error);
      showToast('error', `Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkDelete = async (agentIdsToDelete: string[]) => {
    try {
      const agentsToDelete = agents.filter(a => agentIdsToDelete.includes(a.id));

      for (const agent of agentsToDelete) {
        await deleteAgent(agent.path);
      }

      setAgents(prev => prev.filter(agent => !agentIdsToDelete.includes(agent.id)));
      showToast('success', `Deleted ${agentsToDelete.length} agent(s) successfully`);
    } catch (error) {
      console.error('Error deleting agents:', error);
      showToast('error', `Failed to delete agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportAgents = async (importedAgents: Agent[], errors: string[]) => {
    if (importedAgents.length > 0) {
      // Check for name conflicts and adjust names if needed
      const adjustedAgents = importedAgents.map(agent => {
        let newName = agent.name;
        let counter = 1;

        while (agents.some(a => a.name === newName)) {
          newName = `${agent.name}-${counter}`;
          counter++;
        }

        if (newName !== agent.name) {
          return {
            ...agent,
            name: newName,
            frontmatter: { ...agent.frontmatter, name: newName },
            id: `${agent.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${newName}.md`,
            path: `${agent.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${newName}.md`
          };
        }

        return agent;
      });

      // Persist imported agents to filesystem
      try {
        const persistedAgents: Agent[] = [];
        for (const agent of adjustedAgents) {
          const markdown = agentToMarkdown(agent);
          const scope = agent.scope === AgentScope.Project ? 'project' : 'global';
          const projectPathForImport =
            scope === 'project'
              ? resolveProjectPath(extractProjectRootFromAgentPath(agent.path) || undefined, agent.path)
              : undefined;

          if (scope === 'project' && !projectPathForImport) {
            console.warn(`Skipping project agent "${agent.name}" import due to missing project path`);
            continue;
          }

          const absolutePath = await writeAgent(scope, agent.name, markdown, projectPathForImport);
          persistedAgents.push({
            ...agent,
            id: absolutePath,
            path: absolutePath,
          });
        }

        setAgents(prev => [...prev, ...persistedAgents]);

        if (errors.length > 0) {
          showToast('error', `Imported ${importedAgents.length} agent(s) with ${errors.length} error(s).`);
        } else {
          showToast('success', `Successfully imported ${importedAgents.length} agent(s).`);
        }
      } catch (error) {
        console.error('Error persisting imported agents:', error);
        showToast('error', `Failed to persist imported agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleToggleFavorite = (agentToToggle: Agent) => {
    setAgents(prev =>
      prev.map(agent => {
        const toggleKey = agentToToggle.id || agentToToggle.name;
        const currentKey = agent.id || agent.name;
        if (currentKey === toggleKey) {
          return {
            ...agent,
            isFavorite: !agent.isFavorite
          };
        }
        return agent;
      })
    );
  };

  const handleCancel = () => {
    setCurrentView(returnDestination);
    setSelectedAgent(null);
  };

  const handleShowTeam = () => {
    setCurrentView('team');
    setReturnDestination('team');
  };

  const handleShowList = () => {
    setCurrentView('list');
    setReturnDestination('list');
  };

  const handleShowAnalytics = () => {
    setCurrentView('analytics');
  };

  const handlePersistDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setUserDisplayName(trimmed);
    await setStorageItem('vinsly-display-name', trimmed);
  }, []);

  const handleResetLicense = useCallback(async () => {
    setLicenseInfo(null);
    setIsOnboardingComplete(false);
    setAgents([]);
    agentsRef.current = [];
    agentCacheHydrated.current = false;
    await removeStorageItem('vinsly-license-info');
    await removeStorageItem(AGENT_CACHE_KEY);
    setIsActivationOpen(true);
  }, []);

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
              onShowList={handleShowList}
              onShowTeam={handleShowTeam}
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
              onBack={handleShowList}
              onShowList={handleShowList}
              onShowAnalytics={handleShowAnalytics}
              onEdit={handleEditAgent}
              onToggleFavorite={handleToggleFavorite}
              userName={userDisplayName || 'Your'}
            />
          </motion.div>
        );
      case 'list':
      default:
        return (
          <motion.div
            key="list"
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
              onShowList={handleShowList}
              onShowAnalytics={handleShowAnalytics}
              onToggleFavorite={handleToggleFavorite}
              onImport={handleImportAgents}
              shortcutHint={isMacLike ? '⌘ N' : 'Ctrl + N'}
            />
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary transition-colors duration-200">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onStartTour={startTour}
        onNavigateHome={handleNavigateHome}
        onScan={loadAgents}
        licenseInfo={licenseInfo}
        onResetLicense={handleResetLicense}
        userDisplayName={userDisplayName}
        onDisplayNameChange={handlePersistDisplayName}
        scanSettings={scanSettings}
        onScanSettingsChange={applyScanSettings}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
      <GuidedTour
        isActive={isTourActive}
        onComplete={endTour}
        tourType={getTourType()}
        editorMode={getEditorMode()}
      />
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ActivationModal
        isOpen={isActivationOpen}
        defaultEmail={licenseInfo?.email}
        defaultDisplayName={userDisplayName}
        defaultScanGlobal={scanSettings.autoScanGlobalOnStartup}
        defaultScanHome={scanSettings.autoScanHomeDirectoryOnStartup}
        onComplete={async ({ licenseKey, email, displayName, autoScanGlobal, autoScanHome }) => {
          const nextLicense: LicenseInfo = {
            licenseKey,
            email,
            status: 'active',
            lastChecked: new Date().toISOString()
          };
          setLicenseInfo(nextLicense);
          setUserDisplayName(displayName);
          await setStorageItem('vinsly-license-info', nextLicense);
          await setStorageItem('vinsly-display-name', displayName);

          const updatedScanSettings: ScanSettings = {
            ...scanSettingsRef.current,
            autoScanGlobalOnStartup: autoScanGlobal,
            autoScanHomeDirectoryOnStartup: autoScanHome,
          };
          await saveScanSettings(updatedScanSettings);
          applyScanSettings(updatedScanSettings);

          let onboardingDirectories: string[] = [];
          if (autoScanHome) {
            try {
              onboardingDirectories = await discoverProjectDirectories(HOME_DISCOVERY_MAX_DEPTH);
            } catch (error) {
              console.error('Error discovering home directories during onboarding:', error);
            }
          }

          setIsOnboardingComplete(true);

          const shouldScanWatched = (autoScanGlobal || autoScanHome) && updatedScanSettings.watchedDirectories.length > 0;

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
      <SplashScreen isVisible={showSplash} theme={theme} />
    </div>
  );
};

export default App;
