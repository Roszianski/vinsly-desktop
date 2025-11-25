import { useCallback, useEffect, useRef, useState } from 'react';
import { Agent, AgentScope, LoadAgentsOptions, ScanSettings, Skill } from '../types';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import {
  listAgents,
  writeAgent,
  deleteAgent as deleteAgentFile,
  listAgentsFromDirectory,
  listSkills,
  writeSkill,
  deleteSkill as deleteSkillFile,
  listSkillsFromDirectory,
} from '../utils/tauriCommands';
import { markdownToAgent } from '../utils/agentImport';
import { agentToMarkdown } from '../utils/agentExport';
import { extractProjectRootFromAgentPath, extractProjectRootFromSkillPath } from '../utils/path';
import { skillFileToSkill, skillToMarkdown } from '../utils/skillParser';
import { DEFAULT_SCAN_SETTINGS } from './useScanSettings';
import { ToastType } from '../components/Toast';

const AGENT_CACHE_KEY = 'vinsly-agent-cache';
const SKILL_CACHE_KEY = 'vinsly-skill-cache';

const normalizeProjectRootPath = (input?: string | null): string | null => {
  if (!input) {
    return null;
  }
  return input.replace(/\\/g, '/').replace(/\/+$/, '');
};

const getAgentProjectRootPath = (agent: Agent): string | null => {
  const agentPath = agent.path || agent.id || '';
  return normalizeProjectRootPath(extractProjectRootFromAgentPath(agentPath));
};

const getSkillProjectRootPath = (skill: Skill): string | null => {
  const skillPath = skill.directoryPath || skill.path || '';
  return normalizeProjectRootPath(extractProjectRootFromSkillPath(skillPath));
};

const getSkillDirectoryFromFilePath = (filePath?: string | null): string => {
  if (!filePath) {
    return '';
  }
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.toLowerCase().endsWith('/skill.md')
    ? normalized.slice(0, -'/skill.md'.length)
    : normalized;
};

const resolveProjectPath = (preferredPath?: string, existingPath?: string): string | undefined => {
  if (preferredPath && preferredPath.trim().length > 0) {
    return preferredPath.trim();
  }
  return extractProjectRootFromAgentPath(existingPath) || undefined;
};

const resolveSkillProjectPath = (preferredPath?: string, existingPath?: string): string | undefined => {
  if (preferredPath && preferredPath.trim().length > 0) {
    return preferredPath.trim();
  }
  return extractProjectRootFromSkillPath(existingPath) || undefined;
};

export interface UseWorkspaceOptions {
  showToast: (type: ToastType, message: string) => void;
  scanSettingsRef: React.RefObject<ScanSettings>;
  isOnboardingComplete: boolean;
}

export interface UseWorkspaceResult {
  agents: Agent[];
  skills: Skill[];
  isScanBusy: boolean;
  agentsRef: React.RefObject<Agent[]>;
  skillsRef: React.RefObject<Skill[]>;
  loadAgents: (options?: LoadAgentsOptions) => Promise<{ total: number; newCount: number }>;
  saveAgent: (agent: Agent, options?: { projectPath?: string }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  bulkDeleteAgents: (agentIds: string[]) => Promise<void>;
  importAgents: (imported: Agent[], errors: string[]) => Promise<void>;
  toggleAgentFavorite: (agent: Agent) => void;
  saveSkill: (skill: Skill, options?: { projectPath?: string }) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  toggleSkillFavorite: (skill: Skill) => void;
  refreshGlobalSkills: () => Promise<void>;
  clearWorkspaceCache: () => Promise<void>;
}

export function useWorkspace(options: UseWorkspaceOptions): UseWorkspaceResult {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isScanBusy, setIsScanBusy] = useState(false);
  const agentsRef = useRef<Agent[]>([]);
  const skillsRef = useRef<Skill[]>([]);
  const workspaceCacheHydrated = useRef(false);
  const inFlightScanCount = useRef(0);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    skillsRef.current = skills;
  }, [skills]);

  useEffect(() => {
    if (!options.isOnboardingComplete || workspaceCacheHydrated.current) {
      return;
    }

    const hydrateWorkspaceFromCache = async () => {
      const [cachedAgents, cachedSkills] = await Promise.all([
        getStorageItem<Agent[]>(AGENT_CACHE_KEY),
        getStorageItem<Skill[]>(SKILL_CACHE_KEY),
      ]);

      if (cachedAgents && cachedAgents.length > 0 && agentsRef.current.length === 0) {
        setAgents(cachedAgents);
      }
      if (cachedSkills && cachedSkills.length > 0 && skillsRef.current.length === 0) {
        setSkills(cachedSkills);
      }
      workspaceCacheHydrated.current = true;
    };

    void hydrateWorkspaceFromCache();
  }, [options.isOnboardingComplete]);

  useEffect(() => {
    if (!workspaceCacheHydrated.current) return;
    setStorageItem(AGENT_CACHE_KEY, agents);
  }, [agents]);

  useEffect(() => {
    if (!workspaceCacheHydrated.current) return;
    setStorageItem(SKILL_CACHE_KEY, skills);
  }, [skills]);

  const makeAgentKey = useCallback((agent: Agent) => {
    const scopePrefix = agent.scope === AgentScope.Project ? 'project' : 'global';
    const idPart = agent.path || agent.id || agent.name;
    return `${scopePrefix}:${idPart}`;
  }, []);

  const makeSkillKey = useCallback((skill: Skill) => {
    const scopePrefix = skill.scope === AgentScope.Project ? 'project' : 'global';
    const idPart = skill.directoryPath || skill.path || skill.name;
    return `${scopePrefix}:${idPart}`;
  }, []);

  const refreshGlobalSkills = useCallback(async () => {
    try {
      const files = await listSkills('global');
      const parsed = files
        .map(skillFileToSkill)
        .filter((skill): skill is Skill => Boolean(skill));
      setSkills(prev => {
        const projectSkills = prev.filter(skill => skill.scope === AgentScope.Project);
        return [...parsed, ...projectSkills];
      });
    } catch (error) {
      console.error('Error refreshing global skills:', error);
    }
  }, []);

  const beginScan = useCallback(() => {
    inFlightScanCount.current += 1;
    setIsScanBusy(true);
  }, []);

  const endScan = useCallback(() => {
    inFlightScanCount.current = Math.max(0, inFlightScanCount.current - 1);
    if (inFlightScanCount.current === 0) {
      setIsScanBusy(false);
    }
  }, []);

  const loadAgents = useCallback(
    async (
      loadOptions: LoadAgentsOptions = {}
    ): Promise<{ total: number; newCount: number }> => {
      beginScan();
      const currentScanSettings = options.scanSettingsRef.current || DEFAULT_SCAN_SETTINGS;
      const {
        projectPaths,
        includeGlobal = true,
        scanWatchedDirectories = false,
        additionalDirectories = [],
      } = loadOptions;

      try {
        const previousAgents = agentsRef.current;
        const previousSkills = skillsRef.current;
        const seenAgents = new Set<string>();
        const seenSkills = new Set<string>();
        const projectPathList = projectPaths
          ? (Array.isArray(projectPaths) ? projectPaths : [projectPaths]).filter(
              path => typeof path === 'string' && path.trim().length > 0
            )
          : [];

        const directoriesToScan = new Set<string>();
        additionalDirectories
          .filter((dir): dir is string => typeof dir === 'string' && dir.trim().length > 0)
          .forEach(dir => directoriesToScan.add(dir));
        if (scanWatchedDirectories) {
          currentScanSettings.watchedDirectories
            .filter(dir => dir && dir.trim().length > 0)
            .forEach(directory => directoriesToScan.add(directory));
        }

        const normalizedScannedRoots = new Set<string>();
        const addNormalizedRoot = (input?: string | null) => {
          const normalized = normalizeProjectRootPath(input);
          if (normalized) {
            normalizedScannedRoots.add(normalized);
          }
        };
        projectPathList.forEach(addNormalizedRoot);
        directoriesToScan.forEach(directory => addNormalizedRoot(directory));

        const shouldReplaceProjectAgent = (agent: Agent) => {
          if (normalizedScannedRoots.size === 0) {
            return false;
          }
          const agentRoot = getAgentProjectRootPath(agent);
          return !!agentRoot && normalizedScannedRoots.has(agentRoot);
        };

        const shouldReplaceProjectSkill = (skill: Skill) => {
          if (normalizedScannedRoots.size === 0) {
            return false;
          }
          const skillRoot = getSkillProjectRootPath(skill);
          return !!skillRoot && normalizedScannedRoots.has(skillRoot);
        };

        const allAgents: Agent[] = [];
        const allSkills: Skill[] = [];

        const addAgent = (agent: Agent | null) => {
          if (!agent) return;
          const key = makeAgentKey(agent);
          if (seenAgents.has(key)) {
            return;
          }
          seenAgents.add(key);
          allAgents.push(agent);
        };

        const addSkill = (skill: Skill | null) => {
          if (!skill) return;
          const key = makeSkillKey(skill);
          if (seenSkills.has(key)) {
            return;
          }
          seenSkills.add(key);
          allSkills.push(skill);
        };

        for (const agent of previousAgents) {
          if (agent.scope === AgentScope.Global) {
            if (!includeGlobal) {
              addAgent(agent);
            }
            continue;
          }

          if (agent.scope === AgentScope.Project && shouldReplaceProjectAgent(agent)) {
            continue;
          }

          addAgent(agent);
        }

        for (const skill of previousSkills) {
          if (skill.scope === AgentScope.Global) {
            if (!includeGlobal) {
              addSkill(skill);
            }
            continue;
          }

          if (skill.scope === AgentScope.Project && shouldReplaceProjectSkill(skill)) {
            continue;
          }

          addSkill(skill);
        }

        if (includeGlobal) {
          const globalAgents = await listAgents('global');
          for (const agentFile of globalAgents) {
            addAgent(
              markdownToAgent(
                agentFile.content,
                agentFile.name,
                AgentScope.Global,
                agentFile.path
              )
            );
          }

          const globalSkills = await listSkills('global');
          for (const skillFile of globalSkills) {
            addSkill(skillFileToSkill(skillFile));
          }
        }

        for (const projectPath of projectPathList) {
          try {
            const [projectAgents, projectSkills] = await Promise.all([
              listAgents('project', projectPath),
              listSkills('project', projectPath),
            ]);

            for (const agentFile of projectAgents) {
              addAgent(
                markdownToAgent(
                  agentFile.content,
                  agentFile.name,
                  AgentScope.Project,
                  agentFile.path
                )
              );
            }

            for (const skillFile of projectSkills) {
              addSkill(skillFileToSkill(skillFile));
            }
          } catch (error) {
            console.error(`Error scanning project directory ${projectPath}:`, error);
          }
        }

        for (const directory of directoriesToScan) {
          try {
            const [watchedAgents, watchedSkills] = await Promise.all([
              listAgentsFromDirectory(directory),
              listSkillsFromDirectory(directory),
            ]);

            for (const agentFile of watchedAgents) {
              addAgent(
                markdownToAgent(
                  agentFile.content,
                  agentFile.name,
                  AgentScope.Project,
                  agentFile.path
                )
              );
            }

            for (const skillFile of watchedSkills) {
              addSkill(skillFileToSkill(skillFile));
            }
          } catch (error) {
            console.error(`Error scanning directory ${directory}:`, error);
          }
        }

        const previousAgentKeys = new Set(previousAgents.map(makeAgentKey));
        const newAgentCount = allAgents.filter(
          agent => !previousAgentKeys.has(makeAgentKey(agent))
        ).length;

        const previousSkillKeys = new Set(previousSkills.map(makeSkillKey));
        const newSkillCount = allSkills.filter(
          skill => !previousSkillKeys.has(makeSkillKey(skill))
        ).length;

        setAgents(allAgents);
        setSkills(allSkills);
        return {
          total: allAgents.length + allSkills.length,
          newCount: newAgentCount + newSkillCount,
        };
      } catch (error) {
        console.error('Error loading workspace:', error);
        options.showToast('error', 'Failed to load assets from filesystem');
        throw error;
      } finally {
        endScan();
      }
    },
    [beginScan, endScan, makeAgentKey, makeSkillKey, options.scanSettingsRef, options.showToast]
  );

  const saveAgent = useCallback(
    async (agentToSave: Agent, saveOptions?: { projectPath?: string }) => {
      try {
        const markdown = agentToMarkdown(agentToSave);
        const scope = agentToSave.scope === AgentScope.Project ? 'project' : 'global';
        const displayPath = `${agentToSave.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${agentToSave.name}.md`;
        const projectPath =
          scope === 'project'
            ? resolveProjectPath(saveOptions?.projectPath, agentToSave.path)
            : undefined;

        if (scope === 'project' && !projectPath) {
          throw new Error('Select a project folder before saving a project agent.');
        }

        const absolutePath = await writeAgent(scope, agentToSave.name, markdown, projectPath);
        const persistedAgent: Agent = {
          ...agentToSave,
          id: absolutePath || displayPath,
          path: absolutePath || displayPath,
        };

        setAgents(prev => {
          const exists = prev.some(agent => agent.id === agentToSave.id);
          if (exists) {
            return prev.map(agent => (agent.id === agentToSave.id ? persistedAgent : agent));
          }
          return [...prev, persistedAgent];
        });

        if (agentToSave.path && agentToSave.path !== absolutePath) {
          try {
            await deleteAgentFile(agentToSave.path);
          } catch (cleanupError) {
            console.warn('Failed to remove previous agent file:', cleanupError);
          }
        }

        options.showToast('success', `Agent "${agentToSave.name}" saved successfully`);
      } catch (error) {
        console.error('Error saving agent:', error);
        options.showToast(
          'error',
          `Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const deleteAgent = useCallback(
    async (agentIdToDelete: string) => {
      try {
        const agent = agentsRef.current.find(a => a.id === agentIdToDelete);
        if (!agent) return;

        await deleteAgentFile(agent.path);
        setAgents(prev => prev.filter(a => a.id !== agentIdToDelete));
        options.showToast('success', `Agent "${agent.name}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting agent:', error);
        options.showToast(
          'error',
          `Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const bulkDeleteAgents = useCallback(
    async (agentIdsToDelete: string[]) => {
      try {
        const agentsToDelete = agentsRef.current.filter(a => agentIdsToDelete.includes(a.id));

        for (const agent of agentsToDelete) {
          await deleteAgentFile(agent.path);
        }

        setAgents(prev => prev.filter(agent => !agentIdsToDelete.includes(agent.id)));
        options.showToast('success', `Deleted ${agentsToDelete.length} agent(s) successfully`);
      } catch (error) {
        console.error('Error deleting agents:', error);
        options.showToast(
          'error',
          `Failed to delete agents: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const importAgents = useCallback(
    async (importedAgents: Agent[], errors: string[]) => {
      if (importedAgents.length === 0) {
        return;
      }

      const adjustedAgents = importedAgents.map(agent => {
        let newName = agent.name;
        let counter = 1;

        while (agentsRef.current.some(a => a.name === newName)) {
          newName = `${agent.name}-${counter}`;
          counter += 1;
        }

        if (newName !== agent.name) {
          return {
            ...agent,
            name: newName,
            frontmatter: { ...agent.frontmatter, name: newName },
            id: `${agent.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${newName}.md`,
            path: `${agent.scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/'}${newName}.md`,
          };
        }

        return agent;
      });

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
          options.showToast(
            'error',
            `Imported ${importedAgents.length} agent(s) with ${errors.length} error(s).`
          );
        } else {
          options.showToast('success', `Successfully imported ${importedAgents.length} agent(s).`);
        }
      } catch (error) {
        console.error('Error persisting imported agents:', error);
        options.showToast(
          'error',
          `Failed to persist imported agents: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const toggleAgentFavorite = useCallback((agentToToggle: Agent) => {
    setAgents(prev =>
      prev.map(agent => {
        const toggleKey = agentToToggle.id || agentToToggle.name;
        const currentKey = agent.id || agent.name;
        if (currentKey === toggleKey) {
          return {
            ...agent,
            isFavorite: !agent.isFavorite,
          };
        }
        return agent;
      })
    );
  }, []);

  const saveSkill = useCallback(
    async (skillToSave: Skill, saveOptions?: { projectPath?: string }) => {
      try {
        const markdown = skillToMarkdown(skillToSave);
        const scope = skillToSave.scope === AgentScope.Project ? 'project' : 'global';
        const projectPath =
          scope === 'project'
            ? resolveSkillProjectPath(saveOptions?.projectPath, skillToSave.directoryPath)
            : undefined;

        if (scope === 'project' && !projectPath) {
          throw new Error('Select a project folder before saving a project skill.');
        }

        const absolutePath = await writeSkill(scope, skillToSave.name, markdown, projectPath);
        const directoryPath = getSkillDirectoryFromFilePath(absolutePath || skillToSave.directoryPath);
        const persistedSkill: Skill = {
          ...skillToSave,
          id: directoryPath || skillToSave.id,
          path: absolutePath || skillToSave.path,
          directoryPath,
          hasAssets: skillToSave.hasAssets,
        };

        setSkills(prev => {
          const exists = prev.some(skill => skill.id === skillToSave.id);
          if (exists) {
            return prev.map(skill => (skill.id === skillToSave.id ? persistedSkill : skill));
          }
          return [...prev, persistedSkill];
        });

        if (
          skillToSave.directoryPath &&
          directoryPath &&
          skillToSave.directoryPath !== directoryPath
        ) {
          try {
            await deleteSkillFile(skillToSave.directoryPath);
          } catch (cleanupError) {
            console.warn('Failed to remove previous skill folder:', cleanupError);
          }
        }

        options.showToast('success', `Skill "${skillToSave.name}" saved successfully`);
      } catch (error) {
        console.error('Error saving skill:', error);
        options.showToast(
          'error',
          `Failed to save skill: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const deleteSkill = useCallback(
    async (skillIdToDelete: string) => {
      try {
        const skill = skillsRef.current.find(s => s.id === skillIdToDelete);
        if (!skill) return;

        const targetPath = skill.directoryPath || skill.path;
        if (!targetPath) {
          throw new Error('Skill folder missing');
        }

        await deleteSkillFile(targetPath);
        setSkills(prev => prev.filter(s => s.id !== skillIdToDelete));
        options.showToast('success', `Skill "${skill.name}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting skill:', error);
        options.showToast(
          'error',
          `Failed to delete skill: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [options.showToast]
  );

  const toggleSkillFavorite = useCallback((skillToToggle: Skill) => {
    setSkills(prev =>
      prev.map(skill => {
        const toggleKey = skillToToggle.id || skillToToggle.name;
        const currentKey = skill.id || skill.name;
        if (currentKey === toggleKey) {
          return {
            ...skill,
            isFavorite: !skill.isFavorite,
          };
        }
        return skill;
      })
    );
  }, []);

  const clearWorkspaceCache = useCallback(async () => {
    setAgents([]);
    setSkills([]);
    agentsRef.current = [];
    skillsRef.current = [];
    workspaceCacheHydrated.current = false;
    await removeStorageItem(AGENT_CACHE_KEY);
    await removeStorageItem(SKILL_CACHE_KEY);
  }, []);

  return {
    agents,
    skills,
    isScanBusy,
    agentsRef,
    skillsRef,
    loadAgents,
    saveAgent,
    deleteAgent,
    bulkDeleteAgents,
    importAgents,
    toggleAgentFavorite,
    saveSkill,
    deleteSkill,
    toggleSkillFavorite,
    refreshGlobalSkills,
    clearWorkspaceCache,
  };
}
