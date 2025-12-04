import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentScope, AgentModel, Skill, ToolCategory, ToolRisk, Tool } from '../../types';
import { InputField, TextareaField } from '../form';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { open } from '@tauri-apps/plugin-dialog';
import { extractProjectRootFromSkillPath } from '../../utils/path';
import { WizardStepHeader } from '../wizard';
import { wizardStepVariants } from '../../animations';
import { CheckIcon } from '../icons/CheckIcon';
import { WarningIcon } from '../icons/WarningIcon';
import { ToolsSelector } from '../tools/ToolsSelector';
import { AVAILABLE_TOOLS } from '../../constants';
import { emptyToolsValue, toolsSelectionToValue, toolsValueToArray } from '../../utils/toolHelpers';

type SkillWizardStepId = 'scope' | 'identifier' | 'tools' | 'instructions' | 'review';

const WIZARD_STEPS: { id: SkillWizardStepId; label: string; description: string }[] = [
  {
    id: 'scope',
    label: 'Location & Scope',
    description: 'Choose whether this skill lives in your global ~/.claude/skills folder or inside a specific project.',
  },
  {
    id: 'identifier',
    label: 'Naming & Summary',
    description: 'Give the skill a clear identifier and description so Claude knows when to invoke it.',
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Select allowed tools or leave empty to inherit session defaults.',
  },
  {
    id: 'instructions',
    label: 'Workflow Instructions',
    description: 'Describe the workflow, rules, and expectations that make this skill valuable.',
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Double-check everything before writing SKILL.md on disk.',
  },
];

const TOOL_CATEGORY_ORDER: ToolCategory[] = ['Read-only', 'Edit', 'Execution', 'Other'];

const SCOPE_DETAILS: Record<AgentScope, { title: string; description: string; path: string }> = {
  [AgentScope.Global]: {
    title: 'Global skill',
    description: 'Saved inside ~/.claude/skills/ and available in every project you open.',
    path: '~/.claude/skills/'
  },
  [AgentScope.Project]: {
    title: 'Project skill',
    description: 'Saved inside .claude/skills/ for this project. Perfect for project-specific workflows.',
    path: '.claude/skills/'
  },
};

interface SkillEditorScreenProps {
  skill: Skill;
  onSave: (skill: Skill, options?: { projectPath?: string }) => void;
  onCancel: () => void;
  mode: 'create-skill' | 'edit-skill';
  existingNames: string[];
}

export const SkillEditorScreen: React.FC<SkillEditorScreenProps> = ({
  skill,
  onSave,
  onCancel,
  mode,
  existingNames,
}) => {
  const [formData, setFormData] = useState<Skill>(skill);
  const [projectFolderPath, setProjectFolderPath] = useState(
    skill.scope === AgentScope.Project ? extractProjectRootFromSkillPath(skill.directoryPath) || '' : ''
  );
  const [nameError, setNameError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState(1);
  const normalizedAllowedTools = useMemo(() => {
    const value = formData.frontmatter.allowedTools;
    if (Array.isArray(value)) {
      return value.map(tool => (tool || '').trim()).filter(Boolean);
    }
    return [];
  }, [formData.frontmatter.allowedTools]);

  const allowedToolsInput = useMemo(() => {
    if (normalizedAllowedTools.length === 0) return '';
    return normalizedAllowedTools.join(', ');
  }, [normalizedAllowedTools]);

  useEffect(() => {
    setFormData(skill);
    setProjectFolderPath(
      skill.scope === AgentScope.Project ? extractProjectRootFromSkillPath(skill.directoryPath) || '' : ''
    );
    setNameError('');
    setCurrentStepIndex(0);
    setVisitedSteps(new Set([0]));
  }, [skill]);

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= WIZARD_STEPS.length) return;
      setDirection(nextIndex > currentStepIndex ? 1 : -1);
      setCurrentStepIndex(nextIndex);
      setVisitedSteps(prev => {
        const next = new Set(prev);
        next.add(nextIndex);
        return next;
      });
    },
    [currentStepIndex]
  );

  const handleNextStep = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  const nameValidation = useMemo(() => {
    const trimmedName = formData.name.trim();
    const duplicates = existingNames
      .filter(name => name !== skill.name)
      .map(name => name.toLowerCase());

    if (!trimmedName) {
      return { valid: false, message: 'Skill name is required.' };
    }
    if (duplicates.includes(trimmedName.toLowerCase())) {
      return { valid: false, message: 'Another skill already uses this name.' };
    }
    return { valid: true, message: '' };
  }, [existingNames, formData.name, skill.name]);

  useEffect(() => {
    setNameError(nameValidation.message);
  }, [nameValidation]);

  const inheritsAllTools = formData.frontmatter.allowedTools === undefined;
  const toolCategories = useMemo(() => {
    return AVAILABLE_TOOLS.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<ToolCategory, Tool[]>);
  }, []);

  const allToolNames = useMemo(() => AVAILABLE_TOOLS.map((tool) => tool.name), []);

  const selectedTools = useMemo(() => {
    if (inheritsAllTools) {
      return new Set(allToolNames);
    }
    return new Set(normalizedAllowedTools);
  }, [allToolNames, inheritsAllTools, normalizedAllowedTools]);

  const updateAllowedToolsSelection = useCallback(
    (updater: (currentSelection: Set<string>) => Set<string>) => {
      setFormData((prev) => {
        const baseList =
          prev.frontmatter.allowedTools === undefined
            ? allToolNames
            : toolsValueToArray(prev.frontmatter.allowedTools);
        const nextSelection = updater(new Set(baseList));
        const normalized = Array.from(nextSelection).sort();
        // For skills, always use array format per official spec
        const nextValue = normalized.length === allToolNames.length ? undefined : normalized.length === 0 ? undefined : normalized;
        return {
          ...prev,
          frontmatter: { ...prev.frontmatter, allowedTools: nextValue },
        };
      });
    },
    [allToolNames]
  );

  const handleToolsChange = (toolName: string, checked: boolean) => {
    updateAllowedToolsSelection((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(toolName);
      } else {
        next.delete(toolName);
      }
      return next;
    });
  };

  const handleCategoryToggle = (category: ToolCategory, checked: boolean) => {
    const categoryTools = toolCategories[category] || [];
    updateAllowedToolsSelection((current) => {
      const next = new Set(current);
      categoryTools.forEach((tool) => {
        if (checked) {
          next.add(tool.name);
        } else {
          next.delete(tool.name);
        }
      });
      return next;
    });
  };

  const handleAllToolsToggle = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      frontmatter: {
        ...prev.frontmatter,
        allowedTools: checked ? undefined : undefined, // undefined means inherit all
      },
    }));
  };

  const categoryStates = useMemo(() => {
    const state: Record<string, { checked: boolean; indeterminate: boolean }> = {};
    const selectedCount = selectedTools.size;
    state.all = {
      checked: inheritsAllTools || selectedCount === allToolNames.length,
      indeterminate: !inheritsAllTools && selectedCount > 0 && selectedCount < allToolNames.length,
    };

    Object.keys(toolCategories).forEach((category) => {
      const tools = toolCategories[category as ToolCategory] || [];
      const total = tools.length;
      const count = tools.filter((tool) => selectedTools.has(tool.name)).length;
      state[category] = {
        checked: total > 0 && count === total,
        indeterminate: count > 0 && count < total,
      };
    });

    return state;
  }, [allToolNames.length, inheritsAllTools, selectedTools, toolCategories]);

  const { overallRisk, riskSummaryText } = useMemo(() => {
    if (inheritsAllTools) {
      return {
        overallRisk: ToolRisk.Unknown,
        riskSummaryText: 'Varied risk — inherits every tool from the active Claude session.',
      };
    }
    if (selectedTools.size === 0) {
      return {
        overallRisk: ToolRisk.Low,
        riskSummaryText: 'No tools selected. The skill will inherit session tools unless specified later.',
      };
    }

    let riskiest = ToolRisk.Low;
    const riskWeight: Record<ToolRisk, number> = {
      [ToolRisk.High]: 3,
      [ToolRisk.Medium]: 2,
      [ToolRisk.Low]: 1,
      [ToolRisk.Unknown]: 0,
    };
    selectedTools.forEach((toolName) => {
      const info = AVAILABLE_TOOLS.find((tool) => tool.name === toolName);
      const risk = info ? info.risk : ToolRisk.Unknown;
      if (riskWeight[risk] > riskWeight[riskiest]) {
        riskiest = risk;
      }
    });

    const summaryMap: Record<ToolRisk, string> = {
      [ToolRisk.High]: 'Execution tools selected. Double-check before saving.',
      [ToolRisk.Medium]: 'Edit/write tools selected. Good balance of capability and safety.',
      [ToolRisk.Low]: 'Read-only tools only. Very safe configuration.',
      [ToolRisk.Unknown]: 'Contains tools with unknown risk levels.',
    };

    return {
      overallRisk: riskiest,
      riskSummaryText: summaryMap[riskiest],
    };
  }, [inheritsAllTools, selectedTools]);

  const isStepComplete = (stepId: SkillWizardStepId): boolean => {
    switch (stepId) {
      case 'scope':
        if (formData.scope === AgentScope.Project) {
          return Boolean(projectFolderPath && projectFolderPath.trim().length > 0);
        }
        return true;
      case 'identifier':
        return Boolean(formData.name.trim() && formData.frontmatter.description?.trim() && nameValidation.valid);
      case 'tools':
        return true; // Tools are optional
      case 'instructions':
        return Boolean(formData.body.trim());
      case 'review':
        return (
          isStepComplete('scope') &&
          isStepComplete('identifier') &&
          isStepComplete('instructions')
        );
      default:
        return false;
    }
  };

  const canProceedFromStep = (stepId: SkillWizardStepId) => {
    if (stepId === 'scope') {
      return isStepComplete(stepId);
    }
    if (stepId === 'identifier') {
      return isStepComplete(stepId);
    }
    if (stepId === 'instructions') {
      return isStepComplete(stepId);
    }
    return true;
  };

  const canSave = isStepComplete('review');

  const handleScopeChange = (scope: AgentScope) => {
    setFormData(current => ({
      ...current,
      scope,
    }));
    if (scope === AgentScope.Global) {
      setProjectFolderPath('');
    }
  };

  const handleChooseProjectFolder = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (isPickingProjectFolder) return;

    setIsPickingProjectFolder(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory'
      });
      if (typeof selected === 'string') {
        setProjectFolderPath(selected);
      }
    } catch (error) {
      console.error('Failed to select project folder for skill:', error);
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const handleInputChange = (field: keyof Skill['frontmatter'], value: string) => {
    setFormData(current => ({
      ...current,
      frontmatter: {
        ...current.frontmatter,
        [field]: value,
      },
    }));
  };

  const handleAllowedToolsChange = (value: string) => {
    const parts = value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
    setFormData(current => ({
      ...current,
      frontmatter: {
        ...current.frontmatter,
        allowedTools: parts.length ? parts : undefined,
      },
    }));
  };

  const handleSave = () => {
    if (!nameValidation.valid) {
      setCurrentStepIndex(1);
      return;
    }
    onSave(
      {
        ...formData,
        name: formData.name.trim(),
        frontmatter: {
          ...formData.frontmatter,
          name: formData.name.trim(),
          description: formData.frontmatter.description?.trim() || '',
          allowedTools: inheritsAllTools ? undefined : normalizedAllowedTools,
        },
      },
      { projectPath: projectFolderPath }
    );
  };

  const completionPercentage = useMemo(() => {
    const completedSteps = WIZARD_STEPS.filter(step => isStepComplete(step.id)).length;
    return Math.round((completedSteps / WIZARD_STEPS.length) * 100);
  }, [formData, projectFolderPath, inheritsAllTools, selectedTools.size, nameValidation.valid]);

  const sidebarSteps = WIZARD_STEPS.map((step, index) => ({
    ...step,
    index,
    isActive: index === currentStepIndex,
    isVisited: visitedSteps.has(index),
    isComplete: isStepComplete(step.id),
  }));

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'scope':
        return (
          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(SCOPE_DETAILS) as AgentScope[]).map((scope) => {
                const detail = SCOPE_DETAILS[scope];
                const selected = formData.scope === scope;
                const isProjectScope = scope === AgentScope.Project;
                return (
                  <button
                    type="button"
                    key={scope}
                    onClick={() => handleScopeChange(scope)}
                    className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
                      selected
                        ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                    }`}
                  >
                    {isProjectScope && (
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={handleChooseProjectFolder}
                          disabled={isPickingProjectFolder}
                          className={`p-1.5 rounded-md transition-colors hover:bg-v-light-border dark:hover:bg-v-border ${isPickingProjectFolder ? 'cursor-wait opacity-80' : ''}`}
                          aria-label="Choose project folder"
                          title={projectFolderPath || 'Choose project folder'}
                        >
                          {isPickingProjectFolder ? (
                            <SpinnerIcon className="h-4 w-4 text-v-accent" />
                          ) : (
                            <FolderIcon
                              className={`h-4 w-4 ${
                                projectFolderPath
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-secondary dark:text-v-text-secondary'
                              }`}
                            />
                          )}
                        </button>
                      </div>
                    )}
                    <p className="text-sm font-bold text-v-light-text-primary dark:text-v-text-primary">{detail.title}</p>
                    <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">{detail.description}</p>
                    <p className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary mt-2">
                      Location: {detail.path}
                    </p>
                  </button>
                );
              })}
            </div>
            {formData.scope === AgentScope.Project && projectFolderPath && (
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary font-mono break-all">
                Saving to: {projectFolderPath}
              </p>
            )}
            {formData.scope === AgentScope.Project && !projectFolderPath && (
              <p className="text-sm text-v-danger flex items-center gap-2">
                <WarningIcon className="h-4 w-4" />
                Select the project root where .claude/skills should live.
              </p>
            )}
          </div>
        );
      case 'identifier':
        return (
          <div className="space-y-4">
            <InputField
              label="Skill identifier"
              id="skill-name"
              value={formData.name}
              onChange={event => {
                const value = event.target.value;
                setFormData(current => ({
                  ...current,
                  name: value,
                  frontmatter: {
                    ...current.frontmatter,
                    name: value,
                  },
                }));
              }}
              placeholder="e.g. excel-automation"
              error={nameError}
              required
            />
            <TextareaField
              label="Description"
              id="skill-description"
              value={formData.frontmatter.description || ''}
              onChange={event => handleInputChange('description', event.target.value)}
              placeholder="Describe when Claude should invoke this skill..."
              rows={4}
              required
              hint="Keep it specific: “Use for filling financial spreadsheets”"
            />
          </div>
        );
      case 'tools':
        return (
          <div className="space-y-4">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Pick categories or individual tools. Selecting every tool omits the field so the skill inherits the session toolset.
            </p>
            <ToolsSelector
              toolsSummaryLabel={inheritsAllTools ? 'Inheriting all session tools' : `${selectedTools.size} selected`}
              categoryStates={categoryStates}
              handleAllToolsToggle={handleAllToolsToggle}
              toolCategoryOrder={TOOL_CATEGORY_ORDER}
              handleCategoryToggle={handleCategoryToggle}
              overallRisk={overallRisk}
              riskSummaryText={riskSummaryText}
              toolCategories={toolCategories}
              selectedTools={selectedTools}
              handleToolsChange={handleToolsChange}
            />
            <div className="space-y-1">
              <InputField
                label="Quick add tools (comma separated)"
                id="skill-allowed-tools"
                value={inheritsAllTools ? '' : allowedToolsInput}
                onChange={event => handleAllowedToolsChange(event.target.value)}
                placeholder="read,write,bash"
                hint="Optional: leave blank to inherit all tools."
              />
            </div>
          </div>
        );
      case 'instructions':
        return (
          <div className="space-y-4">
            <TextareaField
              label="Workflow instructions"
              id="skill-instructions"
              value={formData.body}
              onChange={event => setFormData(current => ({ ...current, body: event.target.value }))}
              placeholder="Outline the exact steps, files, and guardrails this skill should follow."
              rows={12}
              required
            />
            <div className="space-y-2 p-4 bg-v-light-hover/30 dark:bg-v-light-dark/30 rounded-lg border border-v-light-border/50 dark:border-v-border/50">
              <p className="text-xs font-semibold text-v-light-text-primary dark:text-v-text-primary">
                💡 Tips for writing great skills:
              </p>
              <ul className="text-xs text-v-light-text-secondary dark:text-v-text-secondary space-y-1 list-disc list-inside">
                <li>Reference supporting files or directories (e.g., "Load reference/guide.md")</li>
                <li>Document required packages with install commands (e.g., "pip install pandas numpy")</li>
                <li>Keep instructions under 500 lines - use reference files for lengthy content</li>
                <li>Use forward slashes in file paths (e.g., "reference/guide.md")</li>
              </ul>
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-v-light-border dark:border-v-border p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Identifier
                </p>
                <p className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  {formData.name || 'Unnamed skill'}
                </p>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  {formData.frontmatter.description || 'No description provided.'}
                </p>
              </div>
              <div className="rounded-lg border border-v-light-border dark:border-v-border p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Scope
                </p>
                <p className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  {formData.scope === AgentScope.Project ? 'Project skill' : 'Global skill'}
                </p>
                {formData.scope === AgentScope.Project && (
                  <p className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary mt-1 break-all">
                    {projectFolderPath || 'Project path pending selection'}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-v-light-border dark:border-v-border p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary mb-2">
                Instructions preview
              </p>
              <p className="text-v-light-text-secondary dark:text-v-text-secondary whitespace-pre-wrap text-sm max-h-48 overflow-auto custom-scrollbar">
                {formData.body || 'No instructions provided yet.'}
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const title = mode === 'create-skill' ? 'New Skill' : `Edit ${skill.name || 'Skill'}`;
  const saveLabel = mode === 'edit-skill' ? 'Save Changes' : 'Create Skill';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
          {title}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px,1fr]" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        <aside className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">Steps</p>
            <p className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">Skill build overview</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Progress</span>
              <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-v-light-border dark:bg-v-border rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-v-accent to-v-accent-hover rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {sidebarSteps.map(step => (
              <button
                type="button"
                key={step.id}
                onClick={() => goToStep(step.index)}
                className={`w-full text-left flex items-start gap-4 rounded-xl border px-4 py-3 transition-all duration-150 ${
                  step.isActive
                    ? 'border-v-accent/80'
                    : 'border-v-light-border/70 dark:border-v-border/70 hover:border-v-accent/50'
                }`}
                aria-current={step.isActive ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                    step.isComplete && step.isVisited
                      ? 'bg-v-accent text-white border-v-accent'
                      : step.isActive
                      ? 'border-v-accent text-v-accent'
                      : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary'
                  }`}
                >
                  {step.isComplete && step.isVisited ? <CheckIcon className="h-4 w-4" /> : step.index + 1}
                </span>
                <div className="flex-1 pr-2">
                  <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    {step.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <WizardStepHeader currentStepIndex={currentStepIndex} wizardSteps={WIZARD_STEPS} />
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={wizardStepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-6 shadow-xl backdrop-blur-xl"
             
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary rounded-md text-sm transition-transform duration-150 active:scale-95"
            >
              Cancel
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {currentStepIndex > 0 && (
                <button
                  onClick={handlePreviousStep}
                  className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark hover:bg-v-light-border dark:hover:bg-v-border text-v-light-text-primary dark:text-v-text-primary font-semibold text-sm transition-all duration-150 rounded-md active:scale-95"
                >
                  Previous
                </button>
              )}
              {!isLastStep && (
                <button
                  onClick={handleNextStep}
                  disabled={!canProceedFromStep(currentStep.id)}
                  className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 disabled:bg-v-light-border dark:disabled:bg-v-border disabled:text-v-light-text-secondary dark:disabled:text-v-text-secondary disabled:cursor-not-allowed rounded-md active:scale-95"
                >
                  Next
                </button>
              )}
              {isLastStep && (
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 disabled:bg-v-light-border dark:disabled:bg-v-border disabled:text-v-light-text-secondary dark:disabled:text-v-text-secondary disabled:cursor-not-allowed rounded-md active:scale-95"
                >
                  {saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
