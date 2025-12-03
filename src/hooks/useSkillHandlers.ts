import { useCallback } from 'react';
import { Skill } from '../types';
import { SkillCommands } from '../utils/workspaceCommands';
import { ToastType } from '../components/Toast';
import { Command } from './useHistory';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  exportSkillDirectory,
  exportSkillsArchive,
  importSkillArchive,
} from '../utils/tauriCommands';

export interface UseSkillHandlersOptions {
  skills: Skill[];
  showToast: (type: ToastType, message: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  executeCommand: (command: Command) => Promise<boolean>;
  undo: () => Promise<string | undefined>;
  saveSkillToWorkspace: (skill: Skill, options?: { projectPath?: string }) => Promise<void>;
  deleteSkillFromWorkspace: (skillId: string) => Promise<void>;
  toggleSkillFavorite: (skill: Skill) => void;
  refreshGlobalSkills: () => Promise<void>;
  cancelEditing: () => void;
}

export interface UseSkillHandlersResult {
  handleSaveSkill: (skill: Skill, options?: { projectPath?: string }) => Promise<void>;
  handleDeleteSkill: (skillId: string) => Promise<void>;
  handleRevealSkill: (skill: Skill) => Promise<void>;
  handleExportSkill: (skill: Skill) => Promise<void>;
  handleExportSkills: (skills: Skill[]) => Promise<void>;
  handleImportSkill: () => Promise<void>;
  handleToggleSkillFavorite: (skill: Skill) => Promise<void>;
}

/**
 * Hook that encapsulates skill-related handlers with undo/redo support
 */
export function useSkillHandlers(options: UseSkillHandlersOptions): UseSkillHandlersResult {
  const {
    skills,
    showToast,
    executeCommand,
    undo,
    saveSkillToWorkspace,
    deleteSkillFromWorkspace,
    toggleSkillFavorite,
    refreshGlobalSkills,
    cancelEditing,
  } = options;

  const handleSaveSkill = useCallback(
    async (skillToSave: Skill, saveOptions?: { projectPath?: string }) => {
      await saveSkillToWorkspace(skillToSave, saveOptions);
      cancelEditing();
    },
    [saveSkillToWorkspace, cancelEditing]
  );

  const handleDeleteSkill = useCallback(
    async (skillIdToDelete: string) => {
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
    },
    [skills, deleteSkillFromWorkspace, saveSkillToWorkspace, executeCommand, showToast, undo]
  );

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

  const handleToggleSkillFavorite = useCallback(
    async (skillToToggle: Skill) => {
      const command = SkillCommands.toggleFavorite(
        skillToToggle,
        async () => {
          toggleSkillFavorite(skillToToggle);
        }
      );

      await executeCommand(command);
    },
    [toggleSkillFavorite, executeCommand]
  );

  return {
    handleSaveSkill,
    handleDeleteSkill,
    handleRevealSkill,
    handleExportSkill,
    handleExportSkills,
    handleImportSkill,
    handleToggleSkillFavorite,
  };
}
