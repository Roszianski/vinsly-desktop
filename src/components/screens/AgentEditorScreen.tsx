import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Agent, AgentModel, AgentScope, Tool, ToolCategory, ToolRisk } from '../../types';
import { AVAILABLE_TOOLS, AVAILABLE_COLORS } from '../../constants';
import { CodeEditor } from '../CodeEditor';
import { AgentPreviewCard } from '../AgentPreviewCard';
import { wizardStepVariants } from '../../animations';
import { InputField, TextareaField } from '../form';
import { RiskBadge, ToolsSelector } from '../tools';
import { WizardStepHeader } from '../wizard';
import { CheckIcon } from '../icons/CheckIcon';
import { WarningIcon } from '../icons/WarningIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { extractProjectRootFromAgentPath } from '../../utils/path';
import { serializeFrontmatter } from '../../utils/frontmatter';
import { emptyToolsValue, toolsSelectionToValue, toolsValueToArray } from '../../utils/toolHelpers';

interface AgentEditorScreenProps {
  agent: Agent;
  onSave: (agent: Agent, options?: { projectPath?: string }) => void;
  onCancel: () => void;
  mode: 'create' | 'edit' | 'duplicate';
  existingNames: string[];
}

type WizardStepId =
  | 'scope'
  | 'identifier'
  | 'prompt'
  | 'description'
  | 'tools'
  | 'model'
  | 'color'
  | 'review';

type TourStepEventDetail = {
  tourType: string;
  stepIndex: number | null;
  editorMode?: 'wizard' | 'form' | null;
};

const WIZARD_STEPS: { id: WizardStepId; label: string; description: string; required: boolean }[] = [
  {
    id: 'scope',
    label: 'Location',
    description: 'Choose whether this agent lives in the project or your personal library.',
    required: true
  },
  {
    id: 'identifier',
    label: 'Agent identifier',
    description: 'Create a lowercase, hyphenated name that Claude will use.',
    required: true
  },
  {
    id: 'prompt',
    label: 'System prompt',
    description: 'Write comprehensive instructions for the agent.',
    required: true
  },
  {
    id: 'description',
    label: 'Description',
    description: 'Tell Claude when to use this agent.',
    required: true
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Select which tools the agent may call.',
    required: false
  },
  {
    id: 'model',
    label: 'Model',
    description: 'Balance speed and reasoning with the right model choice.',
    required: false
  },
  {
    id: 'color',
    label: 'Colour',
    description: "Choose a colour for Claude's /agents UI.",
    required: false
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Confirm details before writing to disk.',
    required: false
  },
];

const COLOR_BG_MAP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const TOOL_CATEGORY_ORDER: ToolCategory[] = ['Read-only', 'Edit', 'Execution', 'Other'];

const RISK_WEIGHT: Record<ToolRisk, number> = {
  [ToolRisk.High]: 3,
  [ToolRisk.Medium]: 2,
  [ToolRisk.Low]: 1,
  [ToolRisk.Unknown]: 0,
};

const SCOPE_DETAILS: Record<AgentScope, { title: string; description: string; path: string }> = {
  [AgentScope.Global]: {
    title: 'Global agent',
    description: 'Saved inside ~/.claude/agents/ and available in every project you open.',
    path: '~/.claude/agents/'
  },
  [AgentScope.Project]: {
    title: 'Project agent',
    description: 'Saved inside .claude/agents/ for this project. Perfect for project-specific helpers.',
    path: '.claude/agents/'
  },
};

const MODEL_CHOICES: Array<{
  value: 'default' | 'opus' | 'haiku' | 'inherit';
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: 'default',
    title: 'Sonnet',
    description: 'Balanced speed and reasoning — ideal starting point for most agents.',
    badge: 'Recommended'
  },
  {
    value: 'opus',
    title: 'Opus',
    description: 'Most capable option for deep, complex reasoning tasks.'
  },
  {
    value: 'haiku',
    title: 'Haiku',
    description: 'Fast and lightweight for simple checks or utility agents.'
  },
  {
    value: 'inherit',
    title: 'Inherit from parent',
    description: 'Use the same model as the parent conversation when executed.'
  }
];


export const AgentEditorScreen: React.FC<AgentEditorScreenProps> = ({ agent, onSave, onCancel, mode, existingNames }) => {
  const [formData, setFormData] = useState<Agent>(agent);
  const [nameError, setNameError] = useState('');
  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const [showRawFrontmatter, setShowRawFrontmatter] = useState(false);
  const [rawFrontmatterText, setRawFrontmatterText] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState(1);

  const isWizard = mode !== 'edit';

  useEffect(() => {
    setFormData(agent);
  }, [agent]);

  useEffect(() => {
    if (agent.scope === AgentScope.Project) {
      setProjectFolderPath(extractProjectRootFromAgentPath(agent.path) || '');
    } else {
      setProjectFolderPath('');
    }
  }, [agent]);

  useEffect(() => {
    setCurrentStepIndex(0);
    setVisitedSteps(new Set([0]));
  }, [agent, mode]);

  useEffect(() => {
    if (!isWizard) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TourStepEventDetail>).detail;
      if (!detail || detail.tourType !== 'editor' || detail.editorMode !== 'wizard') return;
      if (typeof detail.stepIndex !== 'number') return;

      const stepMapping: Record<number, WizardStepId> = {
        0: 'scope',
        1: 'scope',
        2: 'tools',
      };

      const targetStepId = stepMapping[detail.stepIndex];
      if (!targetStepId) return;

      const targetIndex = WIZARD_STEPS.findIndex((step) => step.id === targetStepId);
      if (targetIndex === -1 || targetIndex === currentStepIndex) return;

      goToStep(targetIndex);
    };

    window.addEventListener('vinsly-tour-step', handler as EventListener);
    return () => window.removeEventListener('vinsly-tour-step', handler as EventListener);
  }, [currentStepIndex, isWizard]);

  useEffect(() => {
    setRawFrontmatterText(serializeFrontmatter(formData.frontmatter));
  }, [formData.frontmatter]);

  const validateName = useCallback(
    (nameValue: string) => {
      if (!nameValue) {
        setNameError('Name is required.');
        return false;
      }
      if (!/^[a-z-]+$/.test(nameValue)) {
        setNameError('Use lowercase letters and hyphens only (e.g., code-reviewer).');
        return false;
      }
      if (existingNames.includes(nameValue)) {
        setNameError('This name is already taken. Choose a unique identifier.');
        return false;
      }
      setNameError('');
      return true;
    },
    [existingNames]
  );

  useEffect(() => {
    validateName(formData.frontmatter.name);
  }, [formData.frontmatter.name, validateName]);

  const trimmedDescription = (formData.frontmatter.description || '').trim();
  const descriptionTooShort = trimmedDescription.length > 0 && trimmedDescription.length < 40;

  // Validate project folder selection
  useEffect(() => {
    if (formData.scope === AgentScope.Project && !projectFolderPath && visitedSteps.has(0)) {
      setProjectFolderError('Please select a project folder');
    } else {
      setProjectFolderError('');
    }
  }, [formData.scope, projectFolderPath, visitedSteps]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'scope') {
      setFormData((prev) => ({ ...prev, scope: value as AgentScope }));
      return;
    }

    if (name === 'model') {
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, model: value === 'default' ? undefined : (value as AgentModel) },
      }));
      return;
    }

    if (name === 'color') {
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, color: value || undefined },
      }));
      return;
    }

    // Auto-convert agent identifier to lowercase
    if (name === 'name') {
      const lowercaseValue = value.toLowerCase();
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, name: lowercaseValue },
        name: lowercaseValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      frontmatter: { ...prev.frontmatter, [name]: value },
    }));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, body: e.target.value }));
  };

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
  const inheritsAllTools = formData.frontmatter.tools === undefined;

  const selectedTools = useMemo(() => {
    if (inheritsAllTools) {
      return new Set(allToolNames);
    }
    return new Set(toolsValueToArray(formData.frontmatter.tools));
  }, [formData.frontmatter.tools, inheritsAllTools, allToolNames]);

  const updateToolsSelection = useCallback(
    (updater: (currentSelection: Set<string>) => Set<string>) => {
      setFormData((prev) => {
        const baseList =
          prev.frontmatter.tools === undefined
            ? allToolNames
            : toolsValueToArray(prev.frontmatter.tools);
        const nextSelection = updater(new Set(baseList));
        const normalized = Array.from(nextSelection).sort();
        const nextValue = toolsSelectionToValue(normalized, prev.frontmatter.tools, allToolNames.length);
        return {
          ...prev,
          frontmatter: { ...prev.frontmatter, tools: nextValue },
        };
      });
    },
    [allToolNames]
  );

  const handleToolsChange = (toolName: string, checked: boolean) => {
    updateToolsSelection((current) => {
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
    updateToolsSelection((current) => {
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
        tools: checked ? undefined : emptyToolsValue(prev.frontmatter.tools),
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

    TOOL_CATEGORY_ORDER.forEach((category) => {
      const tools = toolCategories[category] || [];
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
        riskSummaryText: 'No tools selected. The agent cannot call tools until you add some.',
      };
    }

    let riskiest = ToolRisk.Low;
    selectedTools.forEach((toolName) => {
      const info = AVAILABLE_TOOLS.find((tool) => tool.name === toolName);
      const risk = info ? info.risk : ToolRisk.Unknown;
      if (RISK_WEIGHT[risk] > RISK_WEIGHT[riskiest]) {
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

  const canSave = !nameError && trimmedDescription.length > 0;

  const currentStep = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Define isStepComplete first (needed by getNextIncompleteStep)
  const isStepComplete = (stepId: WizardStepId) => {
    switch (stepId) {
      case 'scope':
        return Boolean(formData.scope) && (formData.scope === AgentScope.Global || Boolean(projectFolderPath));
      case 'identifier':
        return !nameError && Boolean(formData.frontmatter.name);
      case 'prompt':
        return Boolean(formData.body.trim());
      case 'description':
        return trimmedDescription.length > 0;
      case 'tools':
        return inheritsAllTools || selectedTools.size > 0;
      case 'model':
      case 'color':
        return true;
      case 'review':
        return canSave;
      default:
        return false;
    }
  };

  // Calculate completion percentage for required fields
  const getCompletionPercentage = () => {
    const requiredChecks = [
      Boolean(formData.scope), // Scope selected
      formData.scope === AgentScope.Global || Boolean(projectFolderPath), // Folder if project
      !nameError && Boolean(formData.frontmatter.name), // Valid identifier
      Boolean(formData.body.trim()), // System prompt present
      trimmedDescription.length > 0, // Description present
    ];

    const completed = requiredChecks.filter(Boolean).length;
    return Math.round((completed / requiredChecks.length) * 100);
  };

  const completionPercentage = getCompletionPercentage();

  // Get next incomplete step
  const getNextIncompleteStep = (): number | null => {
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      if (!isStepComplete(WIZARD_STEPS[i].id)) {
        return i;
      }
    }
    return null;
  };

  const nextIncompleteStepIndex = getNextIncompleteStep();

  const canProceedFromStep = (stepId: WizardStepId) => {
    switch (stepId) {
      case 'scope':
        // If project scope is selected, folder must be selected
        return formData.scope === AgentScope.Global || (formData.scope === AgentScope.Project && Boolean(projectFolderPath));
      case 'identifier':
        return !nameError && Boolean(formData.frontmatter.name);
      case 'description':
        return trimmedDescription.length > 0;
      case 'review':
        return canSave;
      default:
        return true;
    }
  };

  const goToStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, WIZARD_STEPS.length - 1));
    if (clamped === currentStepIndex) return;
    setDirection(clamped > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(clamped);
    setVisitedSteps((prev) => {
      const updated = new Set(prev);
      updated.add(clamped);
      return updated;
    });
  };

  const handleNextStep = () => {
    if (!canProceedFromStep(currentStep.id)) return;
    if (!isLastStep) {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex === 0) return;
    goToStep(currentStepIndex - 1);
  };

  const resolveProjectPathForSave = () => {
    if (formData.scope !== AgentScope.Project) {
      return undefined;
    }
    return projectFolderPath || extractProjectRootFromAgentPath(formData.path) || undefined;
  };

  const handleSaveClick = () => {
    if (!canSave) {
      return;
    }
    const projectPath = resolveProjectPathForSave();
    onSave(formData, projectPath ? { projectPath } : undefined);
  };

  const handleProjectFolderPick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (formData.scope !== AgentScope.Project || isPickingProjectFolder) return;

    setIsPickingProjectFolder(true);
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory'
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      setProjectFolderPath(selectedPath);
      setProjectFolderError('');
    } catch (error) {
      console.error('Failed to select project folder:', error);
      setProjectFolderError('Unable to open the folder picker. Please try again.');
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const toolsSummaryLabel = inheritsAllTools
    ? 'Inheriting all session tools'
    : `${selectedTools.size} tool${selectedTools.size === 1 ? '' : 's'} selected`;

  const reviewWarnings: string[] = [];
  if (descriptionTooShort) {
    reviewWarnings.push('Description looks short. Consider describing when Claude should delegate to this agent.');
  }
  if (!formData.body.trim()) {
    reviewWarnings.push('System prompt is empty. Claude will only rely on the short description.');
  }

  const resolvedModelValue = (formData.frontmatter.model || 'default') as 'default' | 'opus' | 'haiku' | 'inherit';

  const handleModelChoice = (choice: 'default' | 'opus' | 'haiku' | 'inherit') => {
    setFormData(prev => ({
      ...prev,
      frontmatter: {
        ...prev.frontmatter,
        model: choice === 'default' ? undefined : choice
      }
    }));
  };

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
                    onClick={() => setFormData((prev) => ({ ...prev, scope }))}
                    className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
                      selected
                        ? isProjectScope && projectFolderError
                          ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                          : 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                    }`}
                  >
                    {isProjectScope && (
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={handleProjectFolderPick}
                          disabled={isPickingProjectFolder}
                          className={`p-1.5 rounded-md transition-colors ${
                            projectFolderError
                              ? 'bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30'
                              : 'hover:bg-v-light-border dark:hover:bg-v-border'
                          } ${isPickingProjectFolder ? 'cursor-wait opacity-80' : ''}`}
                          aria-label="Choose project folder"
                          title={projectFolderPath || 'Choose project folder'}
                        >
                          {isPickingProjectFolder ? (
                            <SpinnerIcon className="h-4 w-4 text-v-accent" />
                          ) : (
                            <FolderIcon
                              className={`h-4 w-4 ${
                                projectFolderError
                                  ? 'text-red-600 dark:text-red-400'
                                  : projectFolderPath
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
            {projectFolderError && formData.scope === AgentScope.Project && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <WarningIcon className="h-4 w-4" />
                {projectFolderError}
              </p>
            )}
          </div>
        );
      case 'identifier':
        return (
          <div data-tour="agent-details">
          <InputField
            label="Agent Identifier"
            id="wizard-name"
            name="name"
            mono
            value={formData.frontmatter.name}
            onChange={handleChange}
            required
            hint="Lowercase letters and hyphens only."
            error={nameError}
          />
          </div>
        );
      case 'prompt':
        return (
          <div className="space-y-4" data-tour="agent-prompt">
            <div>
              <label htmlFor="wizard-body" className="block text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary">
                System prompt
              </label>
              <CodeEditor
                id="wizard-body"
                value={formData.body}
                onChange={handleBodyChange}
                rows={14}
                placeholder="e.g. You are a helpful agent that assists with code review..."
              />
            </div>
            <div className="space-y-2 p-4 bg-v-light-hover/30 dark:bg-v-light-dark/30 rounded-lg border border-v-light-border/50 dark:border-v-border/50">
              <p className="text-xs font-semibold text-v-light-text-primary dark:text-v-text-primary">
                💡 Best practices for system prompts:
              </p>
              <ul className="text-xs text-v-light-text-secondary dark:text-v-text-secondary space-y-1 list-disc list-inside">
                <li><strong>Be specific:</strong> Treat Claude like a new employee—provide explicit instructions, context, and success criteria</li>
                <li><strong>Define the role:</strong> Clearly state what the agent does and its area of expertise</li>
                <li><strong>Use examples:</strong> Include 2-3 concrete examples showing desired input/output format</li>
                <li><strong>Structure with XML:</strong> Use tags like &lt;instructions&gt;, &lt;examples&gt;, &lt;context&gt; for clarity</li>
                <li><strong>Specify outputs:</strong> State exact format, length, and tone requirements</li>
                <li><strong>Single responsibility:</strong> Focus on one clear task rather than multiple responsibilities</li>
              </ul>
            </div>
          </div>
        );
      case 'description':
        return (
          <TextareaField
            label="Description (tell Claude when to use this agent)"
            id="wizard-description"
            name="description"
            value={formData.frontmatter.description}
            onChange={handleChange}
            rows={5}
            placeholder="e.g. Use this agent when reviewing code for security vulnerabilities..."
            hint="Start with 'Use this agent when…' and mention triggers, contexts, or exclusions."
            warning={descriptionTooShort ? 'Descriptions under 40 characters may be too vague for delegations.' : undefined}
          />
        );
      case 'tools':
        return (
          <div className="space-y-3" data-tour="agent-tools">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Pick categories or individual tools. Selecting every tool omits the field so the agent inherits the full session toolset.
            </p>
            <ToolsSelector
              toolsSummaryLabel={toolsSummaryLabel}
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
          </div>
        );
      case 'model':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">Select model</p>
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                Model choice balances speed and reasoning depth for the agent.
              </p>
            </div>
            <div className="space-y-3">
              {MODEL_CHOICES.map(choice => {
                const isSelected = resolvedModelValue === choice.value;
                return (
                  <button
                    type="button"
                    key={choice.value}
                    onClick={() => handleModelChoice(choice.value)}
                    className={`w-full text-left border rounded-xl px-4 py-3 flex items-start gap-4 transition-all ${
                      isSelected
                        ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark shadow-sm'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                    }`}
                  >
                    <span
                      className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-v-accent bg-v-accent text-white'
                          : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary'
                      }`}
                    >
                      {isSelected ? <CheckIcon className="h-3 w-3" /> : ''}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                          {choice.title}
                        </p>
                        {choice.badge && (
                          <span className="text-[10px] uppercase tracking-wide text-white bg-v-accent px-2 py-0.5 rounded-full">
                            {choice.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        {choice.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'color':
        return (
          <div className="space-y-2">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Pick a colour swatch for Claude's /agents UI.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className={`flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer ${!formData.frontmatter.color ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark' : 'border-v-light-border dark:border-v-border hover:border-v-accent'}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="color"
                  value=""
                  checked={!formData.frontmatter.color}
                  onChange={handleChange}
                />
                <span className="h-5 w-5 rounded-full border border-v-light-border dark:border-v-border bg-black dark:bg-white" />
                <span className="text-sm text-v-light-text-primary dark:text-v-text-primary">Automatic</span>
              </label>
              {AVAILABLE_COLORS.map((color) => (
                <label
                  key={color}
                  className={`flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer transition-colors duration-150 ${formData.frontmatter.color === color ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark' : 'border-v-light-border dark:border-v-border hover:border-v-accent'}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="color"
                    value={color}
                    checked={formData.frontmatter.color === color}
                    onChange={handleChange}
                  />
                  <span className={`h-5 w-5 rounded-full ${COLOR_BG_MAP[color] || 'bg-v-accent'}`} />
                  <span className="text-sm capitalize text-v-light-text-primary dark:text-v-text-primary">{color}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-6">
            <AgentPreviewCard agent={formData} />
            {reviewWarnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm space-y-1">
                {reviewWarnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2">
                    <WarningIcon className="h-4 w-4" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t border-v-light-border dark:border-v-border">
              <button
                type="button"
                onClick={() => setShowRawFrontmatter(!showRawFrontmatter)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors rounded-lg"
              >
                <span className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                  Raw frontmatter
                </span>
                <svg
                  className={`h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary transition-transform ${showRawFrontmatter ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {showRawFrontmatter && (
                <div className="mt-3">
                  <TextareaField label="Raw Frontmatter (read-only)" id="rawFrontmatter" value={rawFrontmatterText} onChange={() => {}} rows={8} />
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const title =
    mode === 'create' ? 'Create New Agent' : mode === 'duplicate' ? 'Duplicate Agent' : 'Edit Agent';
  const breadcrumbLabel =
    mode === 'create' ? 'Create New Agent' : mode === 'duplicate' ? 'Duplicate Agent' : `Edit ${agent.name}`;
  const saveLabel = mode === 'edit' ? 'Save Changes' : 'Save Agent';
  const sidebarSteps = WIZARD_STEPS.map((step, index) => ({
    ...step,
    index,
    isActive: index === currentStepIndex,
    isComplete: isStepComplete(step.id),
    isVisited: visitedSteps.has(index),
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <button
          onClick={onCancel}
          className="text-sm font-semibold text-v-accent hover:text-v-accent-hover inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Back to agents
        </button>
        <div className="flex items-center gap-2 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
          <span className="text-v-light-text-primary dark:text-v-text-primary">Agents</span>
          <span>/</span>
          <span className="text-v-light-text-primary dark:text-v-text-primary">{breadcrumbLabel}</span>
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary -ml-px">{title}</h1>
        <p className="text-v-light-text-secondary dark:text-v-text-secondary mt-1">
          Configure your agent's identity, tools, and instructions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px,1fr]" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        <aside className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-5 space-y-4" data-tour="wizard-steps">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">Steps</p>
            <p className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">Agent build overview</p>
          </div>

          {/* Progress Bar */}
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
            {sidebarSteps.map((step) => {
              return (
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
                    {step.isComplete && step.isVisited ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      step.index + 1
                    )}
                  </span>
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                      {step.label}
                    </p>
                  </div>
                </button>
              );
            })}
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
              data-tour="wizard-config-panel"
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
              {(!isWizard || isLastStep) && (
                <button
                  onClick={handleSaveClick}
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
