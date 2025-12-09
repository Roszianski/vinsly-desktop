/**
 * AppScreenRouter
 * Handles routing between different screens based on current view
 * Extracts renderContent() logic from App.tsx
 */

import { motion } from 'framer-motion';
import { Agent, Skill } from '../types';
import { View } from '../hooks/useNavigation';
import { AgentEditorScreen } from './screens/AgentEditorScreen';
import { SkillEditorScreen } from './screens/SkillEditorScreen';
import { AgentListScreen } from './screens/AgentListScreen';
import { SkillListScreen } from './screens/SkillListScreen';
import { AgentTeamView } from './screens/AgentTeamView';
import { pageTransition } from '../animations';

interface AppScreenRouterProps {
  // Current view
  currentView: View;
  selectedAgent: Agent | null;
  selectedSkill: Skill | null;

  // Data
  agents: Agent[];
  skills: Skill[];

  // Agent handlers
  onCreateAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  onDuplicateAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
  onBulkDeleteAgents: (agentIds: string[]) => void;
  onSaveAgent: (agent: Agent, options?: { projectPath?: string }) => void;
  onToggleAgentFavorite: (agent: Agent) => void;
  onImportAgents?: (agents: Agent[], errors: string[]) => void;

  // Skill handlers
  onCreateSkill: () => void;
  onEditSkill: (skill: Skill) => void;
  onDeleteSkill: (skillId: string) => void;
  onSaveSkill: (skill: Skill, options?: { projectPath?: string }) => void;
  onToggleSkillFavorite: (skill: Skill) => void;
  onRevealSkill: (skill: Skill) => void;
  onExportSkill: (skill: Skill) => void;
  onExportSkills: (skills: Skill[]) => Promise<void>;
  onImportSkill: () => Promise<void>;

  // Navigation handlers
  onCancel: () => void;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowTeam: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  onShowMCP: () => void;
  onShowHooks: () => void;

  // User info
  userDisplayName: string | null;
  isMacLike: boolean;
}

/**
 * Routes to the appropriate screen based on current view
 */
export function AppScreenRouter({
  currentView,
  selectedAgent,
  selectedSkill,
  agents,
  skills,
  onCreateAgent,
  onEditAgent,
  onDuplicateAgent,
  onDeleteAgent,
  onBulkDeleteAgents,
  onSaveAgent,
  onToggleAgentFavorite,
  onImportAgents,
  onCreateSkill,
  onEditSkill,
  onDeleteSkill,
  onSaveSkill,
  onToggleSkillFavorite,
  onRevealSkill,
  onExportSkill,
  onExportSkills,
  onImportSkill,
  onCancel,
  onShowSubagents,
  onShowSkills,
  onShowTeam,
  onShowMemory,
  onShowCommands,
  onShowMCP,
  onShowHooks,
  userDisplayName,
  isMacLike,
}: AppScreenRouterProps) {
  switch (currentView) {
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
            onSave={onSaveAgent}
            onCancel={onCancel}
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
            onSave={onSaveSkill}
            onCancel={onCancel}
            mode={currentView}
            existingNames={skills.map(skill => skill.name).filter(name => name !== selectedSkill.name)}
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
            onBack={onShowSubagents}
            onShowList={onShowSubagents}
            onShowSkills={onShowSkills}
            onShowMemory={onShowMemory}
            onShowCommands={onShowCommands}
            onShowMCP={onShowMCP}
            onShowHooks={onShowHooks}
            onEdit={onEditAgent}
            onToggleFavorite={onToggleAgentFavorite}
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
            onCreateSkill={onCreateSkill}
            onEditSkill={onEditSkill}
            onDeleteSkill={onDeleteSkill}
            onRevealSkill={onRevealSkill}
            onExportSkill={onExportSkill}
            onExportSkills={onExportSkills}
            onImportSkill={onImportSkill}
            onShowSubagents={onShowSubagents}
            onShowSkills={onShowSkills}
            onShowMemory={onShowMemory}
            onShowCommands={onShowCommands}
            onShowMCP={onShowMCP}
            onShowHooks={onShowHooks}
            activeView="skills"
            onToggleFavorite={onToggleSkillFavorite}
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
            onCreate={onCreateAgent}
            onEdit={onEditAgent}
            onDuplicate={onDuplicateAgent}
            onDelete={onDeleteAgent}
            onBulkDelete={onBulkDeleteAgents}
            onShowTeam={onShowTeam}
            onShowSubagents={onShowSubagents}
            onShowSkills={onShowSkills}
            onShowMemory={onShowMemory}
            onShowCommands={onShowCommands}
            onShowMCP={onShowMCP}
            onShowHooks={onShowHooks}
            activeView="subagents"
            onToggleFavorite={onToggleAgentFavorite}
            onImport={onImportAgents}
            shortcutHint={isMacLike ? '⌘ N' : 'Ctrl + N'}
          />
        </motion.div>
      );
  }
}
